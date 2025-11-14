import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { getStudentTests, getTestDetails, getSchoolStats } from './sheetsService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Google Sheets API
let sheets;
let spreadsheetId;

async function initializeSheets() {
  try {
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      throw new Error('GOOGLE_SPREADSHEET_ID is not set in environment variables');
    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const authClient = await auth.getClient();
      sheets = google.sheets({ version: 'v4', auth: authClient });
      spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

      console.log('✅ Google Sheets API initialized with service account');
      console.log(`   Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
      console.log(`   Spreadsheet ID: ${spreadsheetId}`);
    } else if (process.env.GOOGLE_API_KEY) {
      sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
      spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
      console.log('✅ Google Sheets API initialized with API key');
      console.log(`   Spreadsheet ID: ${spreadsheetId}`);
    } else {
      throw new Error('No authentication method configured. Please set either GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY or GOOGLE_API_KEY in .env file');
    }
  } catch (error) {
    console.error('❌ Error initializing Google Sheets:', error.message);
    console.error('   Full error:', error);
    throw error;
  }
}

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    name: 'School Dash API',
    version: '1.0.0',
    status: 'running',
    message: 'Welcome to the School Dash API',
    endpoints: {
      health: '/health',
      student: {
        tests: '/api/student/tests?studentId=STUDENT_ID&schoolId=SCHOOL_ID (schoolId optional)',
        testDetails: '/api/student/test-details?studentId=STUDENT_ID&testName=TEST_NAME'
      },
      school: {
        stats: '/api/school/stats?schoolId=SCHOOL_ID'
      }
    },
    frontend: 'Access the frontend application at http://localhost:3000',
    documentation: 'This is a REST API for accessing school and student data from Google Sheets'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'School Dash API is running' });
});

// Debug endpoint - inspect Master sheet structure
app.get('/api/debug/master', async (req, res) => {
  try {
    if (!sheets || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Google Sheets API not initialized',
        details: 'Check server logs for authentication errors.'
      });
    }

    // First, get all sheet names to find the Mapping sheet (or Master as fallback)
    let allSheets = [];
    let masterSheetName = 'Mapping';
    try {
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      allSheets = sheetsResponse.data.sheets.map(sheet => sheet.properties.title);
      
      // Find Mapping sheet first (case-insensitive), then Master as fallback
      const mappingSheet = allSheets.find(name => name.toLowerCase() === 'mapping');
      if (mappingSheet) {
        masterSheetName = mappingSheet;
      } else {
        const masterSheet = allSheets.find(name => name.toLowerCase() === 'master');
        if (masterSheet) {
          masterSheetName = masterSheet;
        } else if (allSheets.length > 0) {
          // If no exact match, use first sheet or one that contains "mapping" or "master"
          const mappingLike = allSheets.find(name => name.toLowerCase().includes('mapping'));
          if (mappingLike) {
            masterSheetName = mappingLike;
          } else {
            const masterLike = allSheets.find(name => name.toLowerCase().includes('master'));
            if (masterLike) {
              masterSheetName = masterLike;
            }
          }
        }
      }
    } catch (err) {
      console.error('[API] Error getting sheet names:', err.message);
    }

    // Read Master sheet directly
    let masterData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${masterSheetName}!A1:Z1000`,
      });
      masterData = response.data.values || [];
    } catch (rangeError) {
      console.error('[API] Error reading Master sheet:', rangeError.message);
      return res.status(500).json({
        error: 'Failed to read Master sheet',
        details: rangeError.message,
        availableSheets: allSheets,
        masterSheetName: masterSheetName
      });
    }
    
    if (!masterData || masterData.length === 0) {
      return res.json({
        error: 'Master sheet is empty or could not be read',
        rowCount: 0,
        headers: []
      });
    }

    const header = masterData[0];
    
    // Find school ID column
    let schoolIdIndex = header.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('opengrad') && lower.includes('school') && lower.includes('code');
    });
    if (schoolIdIndex === -1) {
      schoolIdIndex = header.findIndex(h => h.toLowerCase().includes('school'));
    }
    
    const studentIdIndex = header.findIndex(h => h.toLowerCase().includes('student') && !h.toLowerCase().includes('school'));

    // Get unique school IDs (first 50)
    const schoolIds = new Set();
    if (schoolIdIndex !== -1) {
      for (let i = 1; i < Math.min(masterData.length, 1000); i++) {
        const row = masterData[i];
        if (row && row[schoolIdIndex]) {
          const id = row[schoolIdIndex].toString().trim();
          if (id) schoolIds.add(id);
        }
      }
    }

    res.json({
      rowCount: masterData.length,
      availableSheets: allSheets,
      masterSheetName: masterSheetName,
      headers: header,
      columnIndices: {
        schoolId: schoolIdIndex,
        studentId: studentIdIndex,
        schoolColumnName: schoolIdIndex !== -1 ? header[schoolIdIndex] : null,
        studentColumnName: studentIdIndex !== -1 ? header[studentIdIndex] : null
      },
      uniqueSchoolIds: Array.from(schoolIds).sort().slice(0, 50),
      sampleRows: masterData.slice(1, 6).map(row => {
        const obj = {};
        header.forEach((col, idx) => {
          obj[col] = row[idx] || '';
        });
        return obj;
      })
    });
  } catch (error) {
    console.error('[API] Error in debug endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to read Master sheet'
    });
  }
});

// Get student tests (attendance status)
app.get('/api/student/tests', async (req, res) => {
  try {
    const { studentId, schoolId } = req.query;

    if (!sheets || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Google Sheets API not initialized. Check server logs for authentication errors.',
        details: 'The server may not be properly configured with Google Sheets credentials.'
      });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    console.log(`[API] Fetching tests for student: ${studentId}${schoolId ? `, school: ${schoolId}` : ''}`);
    const result = await getStudentTests(sheets, spreadsheetId, studentId, schoolId || null);

    if (result.error) {
      console.error(`[API] Error for student ${studentId}:`, result.error);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Error fetching student tests:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
    const errorDetails = error.response?.data?.message || 'Check server logs for more details';
    res.status(500).json({ 
      error: `Failed to fetch student tests: ${errorMessage}`,
      details: errorDetails,
      studentId: req.query.studentId
    });
  }
});

// Get detailed test results for a student
app.get('/api/student/test-details', async (req, res) => {
  try {
    const { studentId, testName } = req.query;

    if (!sheets || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Google Sheets API not initialized. Check server logs for authentication errors.',
        details: 'The server may not be properly configured with Google Sheets credentials.'
      });
    }

    if (!studentId || !testName) {
      return res.status(400).json({ error: 'Student ID and test name are required' });
    }

    console.log(`[API] Fetching test details for student: ${studentId}, test: ${testName}`);
    const result = await getTestDetails(sheets, spreadsheetId, studentId, testName);

    if (result.error) {
      console.error(`[API] Error for student ${studentId}, test ${testName}:`, result.error);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Error fetching test details:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
    const errorDetails = error.response?.data?.message || 'Check server logs for more details';
    res.status(500).json({ 
      error: `Failed to fetch test details: ${errorMessage}`,
      details: errorDetails,
      studentId: req.query.studentId,
      testName: req.query.testName
    });
  }
});

// Get enriched test sheet data
app.get('/api/test/enriched', async (req, res) => {
  try {
    const { testName } = req.query;

    if (!sheets || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Google Sheets API not initialized. Check server logs for authentication errors.',
        details: 'The server may not be properly configured with Google Sheets credentials.'
      });
    }

    if (!testName) {
      return res.status(400).json({ error: 'Test name is required' });
    }

    const { enrichTestSheet } = await import('./sheetsService.js');
    const enrichedData = await enrichTestSheet(sheets, spreadsheetId, testName);

    res.json({
      testName,
      data: enrichedData,
      rowCount: enrichedData.length - 1, // Exclude header
    });
  } catch (error) {
    console.error('[API] Error fetching enriched test data:', error);
    res.status(500).json({ 
      error: `Failed to fetch enriched test data: ${error.message}`,
      details: 'Check server logs for more details',
      testName: req.query.testName
    });
  }
});

// Get school statistics
app.get('/api/school/stats', async (req, res) => {
  try {
    const { schoolId } = req.query;

    if (!sheets || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Google Sheets API not initialized. Check server logs for authentication errors.',
        details: 'The server may not be properly configured with Google Sheets credentials.',
        troubleshooting: [
          '1. Verify .env file exists in backend directory',
          '2. Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set',
          '3. Ensure GOOGLE_SPREADSHEET_ID is correct',
          '4. Verify the service account has access to the spreadsheet'
        ]
      });
    }

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID is required' });
    }

    console.log(`[API] Fetching stats for school: ${schoolId}`);
    const result = await getSchoolStats(sheets, spreadsheetId, schoolId);

    if (result.error) {
      console.error(`[API] Error for school ${schoolId}:`, result.error);
    } else {
      console.log(`[API] Successfully fetched stats for school ${schoolId}: ${result.totalStudents} students, ${result.testStats?.length || 0} tests`);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Error fetching school stats:', error);
    console.error('   Error stack:', error.stack);
    
    let errorMessage = 'Unknown error occurred';
    let errorDetails = 'Check server logs for more details';
    let errorCode = null;

    if (error.response) {
      // Google API error
      errorCode = error.response.status;
      errorMessage = error.response.data?.error?.message || error.message;
      errorDetails = `Google Sheets API error (${errorCode}): ${error.response.data?.error?.message || 'Unknown API error'}`;
    } else if (error.message) {
      errorMessage = error.message;
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        errorDetails = 'Network error: Could not connect to Google Sheets API. Check your internet connection.';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorDetails = 'Authentication error: Service account may not have access to the spreadsheet. Verify the service account email has been shared with the Google Sheet.';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorDetails = 'Permission error: Service account does not have permission to access the spreadsheet. Share the sheet with: ' + (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'your service account email');
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorDetails = 'Spreadsheet not found: Check that GOOGLE_SPREADSHEET_ID is correct and the spreadsheet exists.';
      }
    }

    res.status(500).json({ 
      error: `Failed to fetch school statistics: ${errorMessage}`,
      details: errorDetails,
      schoolId: req.query.schoolId,
      errorCode: errorCode,
      troubleshooting: errorCode === 403 ? [
        '1. Open your Google Sheet',
        '2. Click "Share" button',
        '3. Add email: ' + (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'your-service-account@...'),
        '4. Give "Viewer" permission',
        '5. Click "Send"'
      ] : undefined
    });
  }
});

// Initialize and start server
initializeSheets()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to initialize Google Sheets API:', error.message);
    console.error('   Server will start but API endpoints may not work.');
    console.error('   Please check your .env file configuration.');
    
    // Start server anyway so health check works
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT} (with errors)`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log('⚠️  Google Sheets API is not initialized. API endpoints will return errors.');
    });
  });

