// apiClient.js
// Single Axios instance for all API calls.
// Automatically adds JWT token from localStorage to every request.

import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',  // Vite proxy forwards this to http://localhost:5000/api
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token before every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — if token expired, log the user out
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
