# Google Sheets Setup Guide

This guide will help you set up your Google Sheets file for use with School Dash.

## 📋 Required Sheets Structure

### 1. Master Sheet (Required)

**Sheet Name**: `Master` (exact name, case-sensitive)

**Structure**:

| School ID | Student ID |
|-----------|------------|
| SCHOOL001 | STU001 |
| SCHOOL001 | STU002 |
| SCHOOL002 | STU003 |
| SCHOOL002 | STU004 |

**Column Requirements**:
- **School ID**: Unique identifier for each school
- **Student ID**: Unique identifier for each student

**Notes**:
- First row must be headers
- Column names should contain keywords:
  - School ID column: "school" (case-insensitive)
  - Student ID column: "student" (case-insensitive, but must not contain "school")

### 2. Test Sheets (One per test)

**Sheet Names**: Any name except "Master" or "Config" (e.g., "Aptitude Test", "Verbal Test", "Math Test")

**Example Structure - Aptitude Test**:

| Student ID | Score | Total Marks | Percentage | Grade | Section 1 | Section 2 |
|------------|-------|-------------|------------|-------|-----------|-----------|
| STU001 | 85 | 100 | 85% | A | 40 | 45 |
| STU002 | 72 | 100 | 72% | B | 35 | 37 |
| STU003 | 90 | 100 | 90% | A+ | 45 | 45 |

**Column Requirements**:
- **Student ID**: Must match Student IDs in Master sheet (exact match, case-sensitive)
- **Score Columns**: Any column with "score", "mark", or "total" in the header (case-insensitive)
- Additional columns: Any other metrics you want to display

**Notes**:
- First row must be headers
- Student ID column must contain "student" in the header (case-insensitive)
- Students not in the sheet are marked as "Absent"
- Score calculation: If multiple score columns exist, they are summed

## 📝 Example Complete Setup

### Sheet 1: Master

| School ID | Student ID |
|-----------|------------|
| SCHOOL001 | STU001 |
| SCHOOL001 | STU002 |
| SCHOOL002 | STU003 |

### Sheet 2: Aptitude Test

| Student ID | Score | Total Marks | Percentage | Grade |
|------------|-------|-------------|------------|-------|
| STU001 | 85 | 100 | 85% | A |
| STU002 | 72 | 100 | 72% | B |

### Sheet 3: Verbal Test

| Student ID | Score | Total Marks | Percentage | Grade |
|------------|-------|-------------|------------|-------|
| STU001 | 90 | 100 | 90% | A+ |
| STU002 | 88 | 100 | 88% | A |

### Sheet 4: Math Test

| Student ID | Score | Total Marks | Percentage | Grade |
|------------|-------|-------------|------------|-------|
| STU001 | 78 | 100 | 78% | B+ |

## 🔍 Column Detection Logic

The system automatically detects columns using these rules:

1. **Student ID Column**: First column with "student" in the header (must not contain "school")
2. **School ID Column**: First column with "school" in the header (Master sheet only)
3. **Score Columns**: All columns with "score", "mark", or "total" in the header

## ✅ Best Practices

1. **Consistent Student ID Format**: Use the same Student ID format across all sheets
2. **Header Row**: Always keep the first row as headers
3. **No Empty Rows**: Avoid empty rows in the middle of data
4. **Case Sensitivity**: Student ID matching is case-sensitive, sheet names are also case-sensitive
5. **Test Names**: Use descriptive test names (e.g., "Midterm Math Test" instead of "Test1")

## 🚨 Common Issues

### Issue: "Student not found"
- **Cause**: Student ID doesn't match exactly (case-sensitive)
- **Solution**: Ensure Student ID in test sheet matches Student ID in Master sheet exactly

### Issue: "School not found"
- **Cause**: School ID doesn't exist in Master sheet
- **Solution**: Verify School ID spelling and case

### Issue: Scores not calculating
- **Cause**: No columns with "score", "mark", or "total" in header
- **Solution**: Add a column with one of these keywords in the header

### Issue: Wrong columns being read
- **Cause**: Column detection found wrong columns
- **Solution**: Ensure your headers contain the expected keywords (student, school, score, etc.)

## 📊 Testing Your Setup

1. Create a test Master sheet with 2-3 students
2. Create a test sheet with 1-2 students
3. Try accessing the dashboard with:
   - Student: Use roll number and school ID from Master sheet
   - School: Use school ID from Master sheet
4. Verify data appears correctly

## 🔄 Updating Data

Simply update your Google Sheets file - the dashboard will reflect changes in real-time (no need to restart the server).

