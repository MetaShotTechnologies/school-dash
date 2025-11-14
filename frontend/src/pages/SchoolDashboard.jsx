import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { schoolAPI } from '../services/api';
import '../App.css';

function SchoolDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const schoolId = searchParams.get('schoolId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schoolStats, setSchoolStats] = useState(null);

  useEffect(() => {
    if (!schoolId) {
      navigate('/');
      return;
    }

    fetchSchoolStats();
  }, [schoolId]);

  const fetchSchoolStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await schoolAPI.getStats(schoolId);
      
      if (data.error) {
        // Build detailed error message
        let errorMessage = data.error;
        if (data.details) {
          errorMessage += `\n\nDetails: ${data.details}`;
        }
        if (data.troubleshooting && Array.isArray(data.troubleshooting)) {
          errorMessage += `\n\nTroubleshooting:\n${data.troubleshooting.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
        }
        if (data.errorCode) {
          errorMessage += `\n\nError Code: ${data.errorCode}`;
        }
        setError(errorMessage);
      } else {
        setSchoolStats(data);
      }
    } catch (err) {
      console.error('Error fetching school stats:', err);
      const errorData = err.response?.data || {};
      let errorMessage = errorData.error || 'Failed to fetch school statistics';
      
      if (errorData.details) {
        errorMessage += `\n\nDetails: ${errorData.details}`;
      }
      if (errorData.troubleshooting && Array.isArray(errorData.troubleshooting)) {
        errorMessage += `\n\nTroubleshooting:\n${errorData.troubleshooting.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
      }
      if (errorData.errorCode) {
        errorMessage += `\n\nError Code: ${errorData.errorCode}`;
      }
      if (!err.response) {
        errorMessage += '\n\nNetwork Error: Could not connect to the server. Make sure the backend is running.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">Loading school statistics...</div>
        </div>
      </div>
    );
  }

  if (error && !schoolStats) {
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

  // Prepare chart data
  const attendanceData = schoolStats?.testStats?.map(test => ({
    name: test.testName,
    attendance: test.attendancePercent,
    avgScore: test.avgScore,
  })) || [];

  return (
    <div className="container">
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
      <div className="card">
        <div className="dashboard-header">
          <div>
            <h1>School Dashboard</h1>
            <p style={{ color: '#666', marginTop: '5px' }}>
              School ID: {schoolId}
            </p>
          </div>
        </div>

        {error && (
          <div className="error" style={{ whiteSpace: 'pre-line', lineHeight: '1.6', marginBottom: '20px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Summary Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Students</h3>
            <div className="value">{schoolStats?.totalStudents || 0}</div>
          </div>
          <div className="stat-card">
            <h3>Average Attendance</h3>
            <div className="value">{schoolStats?.overallStats?.avgAttendance?.toFixed(1) || 0}%</div>
          </div>
          <div className="stat-card">
            <h3>Average Score</h3>
            <div className="value">{schoolStats?.overallStats?.avgScore?.toFixed(1) || 0}</div>
          </div>
        </div>

        {/* Attendance Chart */}
        {attendanceData.length > 0 && (
          <div className="chart-container">
            <h2>Attendance by Test</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendance" fill="#667eea" name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Average Score Chart */}
        {attendanceData.length > 0 && (
          <div className="chart-container">
            <h2>Average Score by Test</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgScore" fill="#764ba2" name="Average Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Test Statistics Table */}
        <h2 style={{ marginTop: '40px' }}>Test Statistics</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Total Students</th>
              <th>Attended</th>
              <th>Attendance %</th>
              <th>Average Score</th>
            </tr>
          </thead>
          <tbody>
            {schoolStats?.testStats?.map((test) => (
              <tr key={test.testName}>
                <td><strong>{test.testName}</strong></td>
                <td>{test.totalStudents}</td>
                <td>{test.attendedCount}</td>
                <td>{test.attendancePercent.toFixed(1)}%</td>
                <td>{test.avgScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Top Performers */}
        {schoolStats?.testStats?.some(test => test.topPerformers?.length > 0) && (
          <div style={{ marginTop: '40px' }}>
            <h2>Top Performers by Test</h2>
            {schoolStats.testStats
              .filter(test => test.topPerformers?.length > 0)
              .map((test) => (
                <div key={test.testName} style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#555' }}>{test.testName}</h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student ID</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.topPerformers.map((performer, index) => (
                        <tr key={index}>
                          <td>#{index + 1}</td>
                          <td>{performer.studentId}</td>
                          <td><strong>{performer.score.toFixed(1)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SchoolDashboard;

