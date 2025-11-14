/**
 * Google Sheets Service
 * Handles all interactions with Google Sheets API
 */

// Cache for sheet metadata
let sheetMetadata = null;

/**
 * Get all sheet names from the spreadsheet
 */
async function getSheetNames(sheets, spreadsheetId) {
  try {
    if (!sheets || !spreadsheetId) {
      throw new Error('Google Sheets API not initialized. Missing sheets client or spreadsheet ID.');
    }
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    return response.data.sheets.map(sheet => sheet.properties.title);
  } catch (error) {
    console.error('[SheetsService] Error fetching sheet names:', error.message);
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;
      if (status === 403) {
        throw new Error(`Permission denied (403): ${message}. Make sure the service account has access to the spreadsheet.`);
      } else if (status === 404) {
        throw new Error(`Spreadsheet not found (404): ${message}. Check that the spreadsheet ID is correct.`);
      } else if (status === 401) {
        throw new Error(`Authentication failed (401): ${message}. Check your service account credentials.`);
      }
      throw new Error(`Google Sheets API error (${status}): ${message}`);
    }
    throw new Error(`Failed to fetch sheet names: ${error.message}`);
  }
}

/**
 * Read data from a specific sheet
 */
async function readSheet(sheets, spreadsheetId, sheetName, range = null) {
  try {
    const rangeStr = range || `${sheetName}!A:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeStr,
    });
    return response.data.values || [];
  } catch (error) {
    console.error(`Error reading sheet ${sheetName}:`, error);
    return [];
  }
}

/**
 * Build a lookup map from Mapping sheet: UserName -> {schoolName, schoolCode, udsieCode, emisId}
 * This allows us to enrich test sheet data with student information
 */
async function buildStudentLookupMap(sheets, spreadsheetId) {
  try {
    const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
    
    if (!masterData || masterData.length === 0) {
      return new Map();
    }

    const header = masterData[0];
    
    // Find column indices
    const userNameIndex = header.findIndex(h => h.toLowerCase() === 'username');
    const schoolNameIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('school') && lower.includes('name');
    });
    const schoolCodeIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    const udsieCodeIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('udsie') || (lower.includes('school') && lower.includes('code') && !lower.includes('opengrad'));
    });
    const emisIdIndex = header.findIndex(h => h.toLowerCase() === 'emis_id' || h.toLowerCase().includes('emis'));

    if (userNameIndex === -1) {
      console.warn('[SheetsService] Could not find UserName column in Mapping sheet');
      return new Map();
    }

    const lookupMap = new Map();
    
    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      if (!row || row.length === 0) continue;
      
      const userName = row[userNameIndex]?.toString().trim();
      if (!userName) continue;

      lookupMap.set(userName, {
        userName: userName,
        schoolName: schoolNameIndex !== -1 ? (row[schoolNameIndex]?.toString().trim() || '') : '',
        schoolCode: schoolCodeIndex !== -1 ? (row[schoolCodeIndex]?.toString().trim() || '') : '',
        udsieCode: udsieCodeIndex !== -1 ? (row[udsieCodeIndex]?.toString().trim() || '') : '',
        emisId: emisIdIndex !== -1 ? (row[emisIdIndex]?.toString().trim() || '') : '',
      });
    }

    console.log(`[SheetsService] Built student lookup map with ${lookupMap.size} students`);
    return lookupMap;
  } catch (error) {
    console.error('[SheetsService] Error building student lookup map:', error);
    return new Map();
  }
}

/**
 * Find student by student ID only (returns first match)
 */
async function findStudentById(sheets, spreadsheetId, studentId) {
  try {
    const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
    
    if (!masterData || masterData.length === 0) {
      return null;
    }

    const header = masterData[0];
    // Prioritize "opengrad school code" column, fallback to any column with "school"
    let schoolIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    // Fallback to any column with "school" if opengrad school code not found
    if (schoolIdIndex === -1) {
      schoolIdIndex = header.findIndex(h => h.toLowerCase().includes('school'));
    }
    // Prioritize UserName or emis_id for student ID, fallback to student name
    let studentIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return (lower === 'username' || lower === 'emis_id' || lower.includes('student id'));
    });
    // Fallback to any column with "student" if specific ID columns not found
    if (studentIdIndex === -1) {
      studentIdIndex = header.findIndex(h => h.toLowerCase().includes('student') && !h.toLowerCase().includes('school'));
    }

    if (schoolIdIndex === -1 || studentIdIndex === -1) {
      return null;
    }

    // Find matching row by student ID only
    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      const rowStudentId = row[studentIdIndex]?.toString().trim();

      if (rowStudentId === studentId.toString()) {
        return {
          studentId: row[studentIdIndex],
          schoolId: row[schoolIdIndex],
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding student in master sheet:', error);
    return null;
  }
}

/**
 * Find student ID in master sheet and verify school ID
 */
async function findStudentInMaster(sheets, spreadsheetId, studentId, schoolId) {
  try {
    const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
    
    if (!masterData || masterData.length === 0) {
      return null;
    }

    // Assume first row is header: [School ID, Student ID]
    const header = masterData[0];
    // Prioritize "opengrad school code" column, fallback to any column with "school"
    let schoolIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    // Fallback to any column with "school" if opengrad school code not found
    if (schoolIdIndex === -1) {
      schoolIdIndex = header.findIndex(h => h.toLowerCase().includes('school'));
    }
    // Prioritize UserName or emis_id for student ID, fallback to student name
    let studentIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return (lower === 'username' || lower === 'emis_id' || lower.includes('student id'));
    });
    // Fallback to any column with "student" if specific ID columns not found
    if (studentIdIndex === -1) {
      studentIdIndex = header.findIndex(h => h.toLowerCase().includes('student') && !h.toLowerCase().includes('school'));
    }

    if (schoolIdIndex === -1 || studentIdIndex === -1) {
      return null;
    }

    // Find matching row
    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      const rowStudentId = row[studentIdIndex]?.toString().trim();
      const rowSchoolId = row[schoolIdIndex]?.toString().trim();

      if (rowStudentId === studentId.toString() && rowSchoolId === schoolId.toString()) {
        return {
          studentId: row[studentIdIndex],
          schoolId: row[schoolIdIndex],
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding student in master sheet:', error);
    return null;
  }
}

/**
 * Get all students for a school from master sheet
 */
async function getStudentsBySchool(sheets, spreadsheetId, schoolId) {
  try {
    const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
    
    if (!masterData || masterData.length === 0) {
      console.warn('[SheetsService] Mapping sheet is empty or could not be read');
      return [];
    }

    const header = masterData[0];
    // Prioritize "opengrad school code" column, fallback to any column with "school"
    let schoolIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    // Fallback to any column with "school" if opengrad school code not found
    if (schoolIdIndex === -1) {
      schoolIdIndex = header.findIndex(h => h.toLowerCase().includes('school'));
    }
    // Prioritize UserName or emis_id for student ID, fallback to student name
    let studentIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return (lower === 'username' || lower === 'emis_id' || lower.includes('student id'));
    });
    // Fallback to any column with "student" if specific ID columns not found
    if (studentIdIndex === -1) {
      studentIdIndex = header.findIndex(h => h.toLowerCase().includes('student') && !h.toLowerCase().includes('school'));
    }

    if (schoolIdIndex === -1 || studentIdIndex === -1) {
      console.warn(`[SheetsService] Could not find required columns in Mapping sheet. Header: ${JSON.stringify(header)}`);
      return [];
    }

    const schoolColumnName = header[schoolIdIndex];
    console.log(`[SheetsService] Looking for school ID: "${schoolId}" in Mapping sheet`);
    console.log(`[SheetsService] Using column: "${schoolColumnName}" (index: ${schoolIdIndex}), Student ID column index: ${studentIdIndex}`);

    // Normalize the search school ID (trim and convert to string)
    const searchSchoolId = schoolId.toString().trim().toUpperCase();
    
    const students = [];
    const foundSchoolIds = new Set(); // Track all unique school IDs found for debugging
    
    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      if (!row || row.length === 0) continue;
      
      const rowSchoolId = row[schoolIdIndex]?.toString().trim().toUpperCase() || '';
      const rowStudentId = row[studentIdIndex]?.toString().trim() || '';
      
      // Track all school IDs we see
      if (rowSchoolId) {
        foundSchoolIds.add(rowSchoolId);
      }

      // Case-insensitive comparison with trimmed values
      if (rowSchoolId === searchSchoolId && rowStudentId) {
        students.push({
          studentId: row[studentIdIndex],
          schoolId: row[schoolIdIndex],
        });
      }
    }

    if (students.length === 0) {
      console.warn(`[SheetsService] No students found for school ID: "${schoolId}"`);
      console.log(`[SheetsService] Available school IDs in Mapping sheet: ${Array.from(foundSchoolIds).slice(0, 20).join(', ')}${foundSchoolIds.size > 20 ? '...' : ''}`);
    } else {
      console.log(`[SheetsService] Found ${students.length} students for school ID: "${schoolId}"`);
    }

    return students;
  } catch (error) {
    console.error('[SheetsService] Error getting students by school:', error);
    return [];
  }
}

/**
 * Extract username from "Learner Details" column (e.g., "TN1015257176@username.com" -> "TN1015257176")
 */
function extractUsernameFromLearnerDetails(learnerDetails) {
  if (!learnerDetails) return null;
  const str = learnerDetails.toString().trim();
  // Extract part before "@" if it exists
  const atIndex = str.indexOf('@');
  if (atIndex !== -1) {
    return str.substring(0, atIndex);
  }
  return str;
}

/**
 * Check if student exists in a test sheet and enrich with Mapping sheet data
 */
async function findStudentInTestSheet(sheets, spreadsheetId, studentId, testSheetName, studentLookupMap = null) {
  try {
    const testData = await readSheet(sheets, spreadsheetId, testSheetName);
    
    if (!testData || testData.length === 0) {
      return null;
    }

    const header = testData[0];
    
    // Look for "Learner Details" column first (contains username@email.com)
    let learnerDetailsIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('learner') && lower.includes('details');
    });
    
    // Fallback to any column with "student" if Learner Details not found
    const studentIdIndex = learnerDetailsIndex === -1 
      ? header.findIndex(h => h.toLowerCase().includes('student'))
      : -1;

    if (learnerDetailsIndex === -1 && studentIdIndex === -1) {
      return null;
    }

    // Build lookup map if not provided
    if (!studentLookupMap) {
      studentLookupMap = await buildStudentLookupMap(sheets, spreadsheetId);
    }

    // Find matching row
    for (let i = 1; i < testData.length; i++) {
      const row = testData[i];
      let rowStudentId = null;
      let userName = null;

      if (learnerDetailsIndex !== -1) {
        const learnerDetails = row[learnerDetailsIndex]?.toString().trim();
        userName = extractUsernameFromLearnerDetails(learnerDetails);
        rowStudentId = learnerDetails; // Use full learner details for matching
      } else {
        rowStudentId = row[studentIdIndex]?.toString().trim();
        userName = rowStudentId; // Assume student ID is the username
      }

      // Match by studentId (could be full learner details or just ID)
      const matches = rowStudentId && (
        rowStudentId === studentId.toString() || 
        rowStudentId.includes(studentId.toString()) ||
        userName === studentId.toString()
      );

      if (matches) {
        // Return all data for this student, enriched with Mapping sheet data
        const studentData = {};
        header.forEach((col, idx) => {
          studentData[col] = row[idx] || '';
        });

        // Enrich with Mapping sheet data if username found
        if (userName && studentLookupMap.has(userName)) {
          const mappingData = studentLookupMap.get(userName);
          studentData['_enriched'] = {
            schoolName: mappingData.schoolName,
            openGradSchoolCode: mappingData.schoolCode,
            udsieCode: mappingData.udsieCode,
            emisId: mappingData.emisId,
          };
        }

        return studentData;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding student in test sheet ${testSheetName}:`, error);
    return null;
  }
}

/**
 * Get student tests with attendance status
 */
export async function getStudentTests(sheets, spreadsheetId, studentId, schoolId = null) {
  // If schoolId is provided, verify both match. Otherwise, find student by ID only
  let student;
  if (schoolId) {
    student = await findStudentInMaster(sheets, spreadsheetId, studentId, schoolId);
    if (!student) {
      return {
        error: 'Student not found or school ID mismatch',
        tests: [],
      };
    }
  } else {
    student = await findStudentById(sheets, spreadsheetId, studentId);
    if (!student) {
      return {
        error: 'Student not found',
        tests: [],
      };
    }
  }

  // Get all sheet names
  const allSheets = await getSheetNames(sheets, spreadsheetId);
  
  // Filter out 'Mapping' sheet and any other non-test sheets
  const testSheets = allSheets.filter(name => 
    name.toLowerCase() !== 'mapping' && 
    name.toLowerCase() !== 'config'
  );

  // Check attendance for each test
  const tests = [];
  for (const testSheet of testSheets) {
    const studentData = await findStudentInTestSheet(sheets, spreadsheetId, studentId, testSheet);
    tests.push({
      name: testSheet,
      status: studentData ? 'Attended' : 'Absent',
      hasData: !!studentData,
    });
  }

  return {
    student: {
      studentId: student.studentId,
      schoolId: student.schoolId,
    },
    tests,
  };
}

/**
 * Enrich all rows in a test sheet with Mapping sheet data
 */
export async function enrichTestSheet(sheets, spreadsheetId, testSheetName) {
  try {
    const testData = await readSheet(sheets, spreadsheetId, testSheetName);
    
    if (!testData || testData.length === 0) {
      return testData;
    }

    const header = testData[0];
    
    // Look for "Learner Details" column
    const learnerDetailsIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('learner') && lower.includes('details');
    });

    if (learnerDetailsIndex === -1) {
      // No Learner Details column, return as-is
      return testData;
    }

    // Build lookup map once
    const studentLookupMap = await buildStudentLookupMap(sheets, spreadsheetId);

    // Add enrichment columns to header if they don't exist
    const enrichedHeader = [...header];
    const schoolNameCol = 'School Name';
    const schoolCodeCol = 'OpenGrad School Code';
    const udsieCodeCol = 'UDSIE Code';
    const emisIdCol = 'EMIS ID';

    if (!enrichedHeader.includes(schoolNameCol)) enrichedHeader.push(schoolNameCol);
    if (!enrichedHeader.includes(schoolCodeCol)) enrichedHeader.push(schoolCodeCol);
    if (!enrichedHeader.includes(udsieCodeCol)) enrichedHeader.push(udsieCodeCol);
    if (!enrichedHeader.includes(emisIdCol)) enrichedHeader.push(emisIdCol);

    // Enrich each row
    const enrichedData = [enrichedHeader];
    
    for (let i = 1; i < testData.length; i++) {
      const row = [...testData[i]];
      const learnerDetails = row[learnerDetailsIndex]?.toString().trim() || '';
      const userName = extractUsernameFromLearnerDetails(learnerDetails);

      // Add enrichment data
      if (userName && studentLookupMap.has(userName)) {
        const mappingData = studentLookupMap.get(userName);
        row.push(mappingData.schoolName || '');
        row.push(mappingData.schoolCode || '');
        row.push(mappingData.udsieCode || '');
        row.push(mappingData.emisId || '');
      } else {
        // Add empty values if no match found
        row.push('', '', '', '');
      }
      
      enrichedData.push(row);
    }

    return enrichedData;
  } catch (error) {
    console.error(`Error enriching test sheet ${testSheetName}:`, error);
    return testData; // Return original data on error
  }
}

/**
 * Get detailed test results for a student
 */
export async function getTestDetails(sheets, spreadsheetId, studentId, testName) {
  const studentData = await findStudentInTestSheet(sheets, spreadsheetId, studentId, testName);
  
  if (!studentData) {
    return {
      error: 'Student not found in this test',
      data: null,
    };
  }

  // Merge enriched data into main data object for easier access
  const enrichedData = { ...studentData };
  if (studentData._enriched) {
    enrichedData['School Name'] = studentData._enriched.schoolName;
    enrichedData['OpenGrad School Code'] = studentData._enriched.openGradSchoolCode;
    enrichedData['UDSIE Code'] = studentData._enriched.udsieCode;
    enrichedData['EMIS ID'] = studentData._enriched.emisId;
    delete enrichedData._enriched; // Remove nested object
  }

  return {
    testName,
    data: enrichedData,
  };
}

/**
 * Get school statistics
 */
export async function getSchoolStats(sheets, spreadsheetId, schoolId) {
  try {
    if (!sheets || !spreadsheetId) {
      return {
        error: 'Google Sheets API not initialized',
        details: 'The server may not be properly configured with Google Sheets credentials.',
        stats: null,
      };
    }

    if (!schoolId) {
      return {
        error: 'School ID is required',
        stats: null,
      };
    }

    console.log(`[SheetsService] Getting stats for school: ${schoolId}`);
    
    // Get all students for this school
    const students = await getStudentsBySchool(sheets, spreadsheetId, schoolId);
    
    if (students.length === 0) {
      console.warn(`[SheetsService] No students found for school: ${schoolId}`);
      
      // Try to get a list of available school IDs for better error message
      let availableSchoolIds = [];
      try {
        const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
        if (masterData && masterData.length > 0) {
          const header = masterData[0];
          // Prioritize "opengrad school code" column, fallback to any column with "school"
          let schoolIdIndex = header.findIndex(h => {
            const lower = h.toLowerCase();
            return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
          });
          // Fallback to any column with "school" if opengrad school code not found
          if (schoolIdIndex === -1) {
            schoolIdIndex = header.findIndex(h => h.toLowerCase().includes('school'));
          }
          if (schoolIdIndex !== -1) {
            const schoolIdSet = new Set();
            for (let i = 1; i < masterData.length; i++) {
              const row = masterData[i];
              if (row && row[schoolIdIndex]) {
                const id = row[schoolIdIndex].toString().trim();
                if (id) schoolIdSet.add(id);
              }
            }
            availableSchoolIds = Array.from(schoolIdSet).sort().slice(0, 10);
          }
        }
      } catch (err) {
        console.error('[SheetsService] Error getting available school IDs:', err);
      }
      
      let errorDetails = 'Verify the School ID is correct and exists in the Mapping sheet of your Google Spreadsheet.';
      if (availableSchoolIds.length > 0) {
        errorDetails += ` Available school IDs (first 10): ${availableSchoolIds.join(', ')}`;
      }
      
      return {
        error: `School "${schoolId}" not found or has no students in the Mapping sheet`,
        details: errorDetails,
        stats: null,
      };
    }

    console.log(`[SheetsService] Found ${students.length} students for school: ${schoolId}`);

    // Get all test sheets
    let allSheets;
    try {
      allSheets = await getSheetNames(sheets, spreadsheetId);
    } catch (error) {
      console.error(`[SheetsService] Error fetching sheet names for school ${schoolId}:`, error.message);
      return {
        error: `Failed to fetch sheet names: ${error.message}`,
        details: 'This could be due to permission issues or the spreadsheet not being accessible.',
        stats: null,
      };
    }

    const testSheets = allSheets.filter(name => 
      name.toLowerCase() !== 'mapping' && 
      name.toLowerCase() !== 'config'
    );

    console.log(`[SheetsService] Found ${testSheets.length} test sheets`);

    // Build lookup map to get UserNames for students
    const studentLookupMap = await buildStudentLookupMap(sheets, spreadsheetId);
    
    // Create a set of UserNames for students in this school
    // We need to match by UserName (from Mapping sheet) not Student Name
    const masterData = await readSheet(sheets, spreadsheetId, 'Mapping');
    const header = masterData[0];
    const userNameIndex = header.findIndex(h => h.toLowerCase() === 'username');
    const studentNameIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('student') && lower.includes('name') && !lower.includes('school');
    });
    const schoolCodeIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    
    // Build set of UserNames for students in this school
    const studentUserNames = new Set();
    const studentNameToUserName = new Map();
    
    if (userNameIndex !== -1 && studentNameIndex !== -1 && schoolCodeIndex !== -1) {
      const searchSchoolId = schoolId.toString().trim().toUpperCase();
      for (let i = 1; i < masterData.length; i++) {
        const row = masterData[i];
        if (!row || row.length === 0) continue;
        
        const rowSchoolId = row[schoolCodeIndex]?.toString().trim().toUpperCase() || '';
        const rowUserName = row[userNameIndex]?.toString().trim() || '';
        const rowStudentName = row[studentNameIndex]?.toString().trim() || '';
        
        if (rowSchoolId === searchSchoolId && rowUserName) {
          studentUserNames.add(rowUserName);
          if (rowStudentName) {
            studentNameToUserName.set(rowStudentName, rowUserName);
          }
        }
      }
    }
    
    console.log(`[SheetsService] Found ${studentUserNames.size} UserNames for school ${schoolId}`);

    // Calculate stats for each test
    const testStats = [];
    const studentIds = students.map(s => s.studentId.toString().trim());

    for (const testSheet of testSheets) {
      const testData = await readSheet(sheets, spreadsheetId, testSheet);
      
      if (!testData || testData.length === 0) {
        continue;
      }

      const header = testData[0];
      
      // Look for "Learner Details" column first (contains username@email.com)
      const learnerDetailsIndex = header.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('learner') && lower.includes('details');
      });
      
      // Fallback to any column with "student" if Learner Details not found
      const studentIdIndex = learnerDetailsIndex === -1 
        ? header.findIndex(h => h.toLowerCase().includes('student'))
        : -1;

      if (learnerDetailsIndex === -1 && studentIdIndex === -1) {
        console.warn(`[SheetsService] No student identifier column found in test sheet: ${testSheet}`);
        continue;
      }

      const scoreIndices = header
        .map((col, idx) => ({ col, idx }))
        .filter(({ col }) => {
          const lower = col.toLowerCase();
          return lower.includes('score') || lower.includes('mark') || lower.includes('total');
        })
        .map(({ idx }) => idx);

      let attendedCount = 0;
      let totalScore = 0;
      let scoreCount = 0;
      const studentScores = [];

      for (let i = 1; i < testData.length; i++) {
        const row = testData[i];
        let matched = false;
        let rowUserName = null;
        let rowStudentId = null;

        if (learnerDetailsIndex !== -1) {
          // Extract username from Learner Details (e.g., "TN1014033746@username.com" -> "TN1014033746")
          const learnerDetails = row[learnerDetailsIndex]?.toString().trim() || '';
          rowUserName = extractUsernameFromLearnerDetails(learnerDetails);
          matched = rowUserName && studentUserNames.has(rowUserName);
          rowStudentId = learnerDetails;
        } else if (studentIdIndex !== -1) {
          // Try matching by student name or other identifier
          rowStudentId = row[studentIdIndex]?.toString().trim();
          // Try matching by student name
          matched = studentIds.includes(rowStudentId);
          // Also try matching by UserName if we have a mapping
          if (!matched && rowStudentId) {
            const userName = studentNameToUserName.get(rowStudentId);
            if (userName && studentUserNames.has(userName)) {
              matched = true;
              rowUserName = userName;
            }
          }
        }

        if (matched) {
          attendedCount++;
          
          // Calculate score (use first score column found, or sum all)
          let score = 0;
          if (scoreIndices.length > 0) {
            score = scoreIndices.reduce((sum, idx) => {
              const val = parseFloat(row[idx]) || 0;
              return sum + val;
            }, 0);
          }

          if (score > 0) {
            totalScore += score;
            scoreCount++;
            studentScores.push({
              studentId: rowUserName || rowStudentId,
              score,
            });
          }
        }
      }

      const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;
      const attendancePercent = (attendedCount / students.length) * 100;

      testStats.push({
        testName: testSheet,
        totalStudents: students.length,
        attendedCount,
        attendancePercent: Math.round(attendancePercent * 100) / 100,
        avgScore: Math.round(avgScore * 100) / 100,
        topPerformers: studentScores
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(s => {
            const student = students.find(st => st.studentId.toString().trim() === s.studentId.toString().trim());
            return {
              studentId: student?.studentId || s.studentId,
              score: s.score,
            };
          }),
      });
    }

    // Calculate overall stats
    const overallAttendance = testStats.reduce((sum, t) => sum + t.attendancePercent, 0) / testStats.length || 0;
    const overallAvgScore = testStats.reduce((sum, t) => sum + t.avgScore, 0) / testStats.length || 0;

    console.log(`[SheetsService] Successfully calculated stats for school ${schoolId}: ${testStats.length} tests processed`);

    return {
      schoolId,
      totalStudents: students.length,
      overallStats: {
        avgAttendance: Math.round(overallAttendance * 100) / 100,
        avgScore: Math.round(overallAvgScore * 100) / 100,
      },
      testStats,
    };
  } catch (error) {
    console.error(`[SheetsService] Unexpected error getting school stats for ${schoolId}:`, error);
    return {
      error: `Unexpected error: ${error.message}`,
      details: error.stack || 'Check server logs for more details',
      stats: null,
    };
  }
}

