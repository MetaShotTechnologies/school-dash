import axios from 'axios';

// Use relative URL by default (works with Vite proxy in dev)
// Set VITE_API_URL env variable to override (e.g., for production)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
});

export const studentAPI = {
  getTests: async (studentId, schoolId = null) => {
    const params = { studentId };
    if (schoolId) {
      params.schoolId = schoolId;
    }
    const response = await api.get('/api/student/tests', { params });
    return response.data;
  },

  getTestDetails: async (studentId, testName) => {
    const response = await api.get('/api/student/test-details', {
      params: { studentId, testName },
    });
    return response.data;
  },
};

export const schoolAPI = {
  getStats: async (schoolId) => {
    const response = await api.get('/api/school/stats', {
      params: { schoolId },
    });
    return response.data;
  },
};

export default api;

