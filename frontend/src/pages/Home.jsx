import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

function Home() {
  const navigate = useNavigate();
  const [viewType, setViewType] = useState('student'); // 'student' or 'school'
  const [studentId, setStudentId] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (viewType === 'student') {
      if (studentId) {
        navigate(`/student?studentId=${studentId}`);
      }
    } else {
      if (schoolId) {
        navigate(`/school?schoolId=${schoolId}`);
      }
    }
  };

  return (
    <div className="container">
      <div className="header-section">
        <div className="logo-container">
          <img src="/logo.png" alt="OpenGrad Logo" className="logo" />
        </div>
        <h1 className="main-title">School Dashboard</h1>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="card">
          <div className="form-group">
            <label htmlFor="viewType">Select Dashboard Type</label>
            <select
              id="viewType"
              value={viewType}
              onChange={(e) => {
                setViewType(e.target.value);
                setStudentId('');
                setSchoolId('');
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="student">🎓 Student Dashboard</option>
              <option value="school">🏫 School Dashboard</option>
            </select>
          </div>

          <form onSubmit={handleSubmit}>
            {viewType === 'student' ? (
              <>
                <p style={{ color: '#666', marginBottom: '20px', marginTop: '10px' }}>
                  View your test attendance and detailed performance metrics
                </p>
                <div className="form-group">
                  <label htmlFor="studentId">Student ID</label>
                  <input
                    id="studentId"
                    type="text"
                    placeholder="e.g., STU001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  View My Dashboard
                </button>
              </>
            ) : (
              <>
                <p style={{ color: '#666', marginBottom: '20px', marginTop: '10px' }}>
                  View aggregated statistics for all students in your school
                </p>
                <div className="form-group">
                  <label htmlFor="schoolId">School ID</label>
                  <input
                    id="schoolId"
                    type="text"
                    placeholder="e.g., SCHOOL001"
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  View School Dashboard
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Home;

