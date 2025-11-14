# 📊 School Dash

A data-driven dashboard system where users (students or schools) can access insights directly from Google Sheets via a clean web UI — without using any separate database.

## 🧩 Features

- **Student Dashboard**: View test attendance and detailed performance metrics
- **School Dashboard**: View aggregated statistics for all students in a school
- **Real-time Updates**: Data syncs automatically as Google Sheets are updated
- **Zero Database**: Powered entirely by Google Sheets

## 🏗️ Architecture

```
Google Sheets (Data Layer)
    ↓
Google Sheets API (Access Layer)
    ↓
Backend API (Express Server)
    ↓
Frontend Web App (React + Vite)
```

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with Sheets API enabled
- Google Sheets spreadsheet with proper structure (see below)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd school-dash
npm run install:all
```

### 2. Set Up Google Sheets API

#### Option A: Service Account (Recommended for Private Sheets)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Sheets API**
4. Create a **Service Account**:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Give it a name and create
   - Click on the service account → "Keys" → "Add Key" → "Create new key" → JSON
   - Download the JSON file
5. Share your Google Sheet with the service account email (found in the JSON file)
6. Copy the service account email and private key to your `.env` file

#### Option B: API Key (For Public Sheets Only)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Sheets API**
3. Go to "APIs & Services" → "Credentials"
4. Create an **API Key**
5. Copy the API key to your `.env` file
6. Make your Google Sheet publicly viewable (Share → "Anyone with the link can view")

### 3. Configure Environment Variables

#### Backend Configuration

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Google Sheets Configuration
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here

# Option 1: Service Account (Recommended)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Option 2: API Key (For public sheets)
# GOOGLE_API_KEY=your_api_key_here

# Server Configuration
PORT=3001
```

#### Frontend Configuration (Optional)

Copy `frontend/.env.example` to `frontend/.env` if you need to change the API URL:

```bash
cp frontend/.env.example frontend/.env
```

### 4. Set Up Google Sheets Structure

Your Google Sheets file should have the following structure:

#### Master Sheet (Required)

| School ID | Student ID |
|-----------|------------|
| SCHOOL001 | STU001 |
| SCHOOL001 | STU002 |
| SCHOOL002 | STU003 |

**Sheet Name**: `Master` (case-sensitive)

**Column Requirements**:
- **School ID**: Unique identifier for each school
- **Student ID**: Unique identifier for each student

#### Test Sheets (One per test)

Each test should be a separate sheet. Example for "Aptitude Test":

| Student ID | Score | Total Marks | Percentage | Grade |
|------------|-------|-------------|------------|-------|
| STU001 | 85 | 100 | 85% | A |
| STU002 | 72 | 100 | 72% | B |

**Sheet Names**: Any name except "Master" or "Config" (e.g., "Aptitude Test", "Verbal Test", "Math Test")

**Important**: 
- The first row must be headers
- The Student ID column must contain "student" in the header (case-insensitive)
- Score columns should contain "score", "mark", or "total" in the header

### 5. Run the Application

#### Development Mode (Both Frontend and Backend)

```bash
npm run dev
```

This will start:
- Backend API on `http://localhost:3001`
- Frontend app on `http://localhost:3000`

#### Run Separately

**Backend only:**
```bash
npm run dev:backend
```

**Frontend only:**
```bash
npm run dev:frontend
```

### 6. Access the Dashboard

Open your browser and navigate to:
- **Homepage**: `http://localhost:3000`
- **Student Dashboard**: Enter student ID and school ID
- **School Dashboard**: Enter school ID

## 📊 Usage

### Student Dashboard

1. Enter your **Student ID**
2. Enter your **School ID**
3. View all tests with attendance status (✅ Attended / ❌ Absent)
4. Click "View Details" on any attended test to see detailed metrics

### School Dashboard

1. Enter your **School ID**
2. View:
   - Summary statistics (Total Students, Avg Attendance, Avg Score)
   - Attendance charts by test
   - Average score charts
   - Detailed test statistics
   - Top performers for each test

## 🔧 API Endpoints

### Student Endpoints

- `GET /api/student/tests?studentId={id}&schoolId={schoolId}`
  - Returns list of tests with attendance status

- `GET /api/student/test-details?studentId={id}&testName={name}`
  - Returns detailed metrics for a specific test

### School Endpoints

- `GET /api/school/stats?schoolId={id}`
  - Returns aggregated statistics for all students in the school

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, React Router, Recharts
- **Backend**: Node.js, Express, Google APIs
- **Data Source**: Google Sheets

## 📝 Notes

- The system works best with up to ~10K rows per sheet
- For larger datasets, consider migrating to BigQuery or Firebase
- Service account authentication is recommended for production
- All data is read-only (no write operations)

## 🐛 Troubleshooting

### "Student not found" Error
- Verify the student exists in the Master sheet
- Check that the School ID matches exactly
- Ensure Student ID matches exactly (case-sensitive)

### "Failed to fetch" Error
- Check that Google Sheets API is enabled
- Verify service account has access to the spreadsheet
- Ensure spreadsheet ID is correct in `.env`

### Charts Not Displaying
- Check browser console for errors
- Verify Recharts is installed: `npm install` in frontend directory

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

