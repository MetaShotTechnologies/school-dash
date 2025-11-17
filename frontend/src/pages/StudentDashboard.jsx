import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { studentAPI } from '../services/api';
import '../App.css';

function StudentDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = searchParams.get('studentId');
  const schoolId = searchParams.get('schoolId'); // Optional, will be fetched from backend if not provided

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testDetails, setTestDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!studentId) {
      navigate('/');
      return;
    }

    fetchStudentTests();
  }, [studentId]);

  const fetchStudentTests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentAPI.getTests(studentId, schoolId);
      
      if (data.error) {
        let errorMessage = data.error;
        if (data.details) {
          errorMessage += `\n\nDetails: ${data.details}`;
        }
        setError(errorMessage);
      } else {
        setStudentData(data);
      }
    } catch (err) {
      console.error('Error fetching student tests:', err);
      const errorData = err.response?.data || {};
      let errorMessage = errorData.error || 'Failed to fetch student data';
      
      if (errorData.details) {
        errorMessage += `\n\nDetails: ${errorData.details}`;
      }
      if (!err.response) {
        errorMessage += '\n\nNetwork Error: Could not connect to the server. Make sure the backend is running.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestDetails = async (testName) => {
    if (!testName || selectedTest === testName) {
      setSelectedTest(null);
      setTestDetails(null);
      return;
    }

    try {
      setLoadingDetails(true);
      setSelectedTest(testName);
      const data = await studentAPI.getTestDetails(studentId, testName);
      
      if (data.error) {
        setError(data.error);
        setTestDetails(null);
      } else {
        setTestDetails(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch test details');
      setTestDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">Loading student data...</div>
        </div>
      </div>
    );
  }

  if (error && !studentData) {
    return (
      <div className="container">
        <div className="card">
          <div className="error" style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
            <strong>Error:</strong> {error}
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="dashboard-header-with-logo">
          <div className="logo-container-small">
            <img src="/logo.png" alt="OpenGrad Logo" className="logo-small" />
          </div>
          <div style={{ flex: 1 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginLeft: 'auto', display: 'block' }}>
              ← Back to Home
            </button>
          </div>
        </div>
        <div className="dashboard-header">
          <div>
            <h1>Student Dashboard</h1>
            {studentData?.student && (
              <p style={{ color: '#666', marginTop: '5px' }}>
                Student ID: {studentData.student.studentId} | School: {studentData.student.schoolId}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="error" style={{ whiteSpace: 'pre-line', lineHeight: '1.6', marginBottom: '20px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <h2>Test Attendance</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {studentData?.tests?.map((test) => (
              <tr key={test.name} className={test.hasData ? 'clickable-row' : ''}>
                <td>{test.name}</td>
                <td>
                  <span className={`badge ${test.status === 'Attended' ? 'badge-success' : 'badge-danger'}`}>
                    {test.status === 'Attended' ? '✅ Attended' : '❌ Absent'}
                  </span>
                </td>
                <td>
                  {test.hasData ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => fetchTestDetails(test.name)}
                      disabled={loadingDetails && selectedTest === test.name}
                    >
                      {loadingDetails && selectedTest === test.name ? 'Loading...' : 'View Details'}
                    </button>
                  ) : (
                    <span style={{ color: '#999' }}>No data available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {testDetails && (
          <div style={{ marginTop: '40px' }}>
            <h2>Test Details: {testDetails.testName}</h2>
            <div className="chart-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(testDetails.data).map(([key, value]) => (
                    <tr key={key}>
                      <td><strong>{key}</strong></td>
                      <td>{value || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;

