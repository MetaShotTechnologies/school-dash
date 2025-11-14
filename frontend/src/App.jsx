import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import StudentDashboard from './pages/StudentDashboard';
import SchoolDashboard from './pages/SchoolDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/school" element={<SchoolDashboard />} />
      </Routes>
    </div>
  );
}

export default App;

