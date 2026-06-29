// App.jsx — sets up routing and global providers

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoLivePage from './pages/GoLivePage';
import StreamPage from './pages/StreamPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    // AuthProvider must wrap SocketProvider (socket needs auth state)
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-dark-base">
            <Navbar />
            <main>
              <Routes>
                {/* Public routes */}
                <Route path="/"              element={<HomePage />} />
                <Route path="/login"         element={<LoginPage />} />
                <Route path="/register"      element={<RegisterPage />} />
                <Route path="/stream/:streamKey" element={<StreamPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />

                {/* Protected routes — require login */}
                <Route path="/go-live" element={
                  <ProtectedRoute><GoLivePage /></ProtectedRoute>
                } />

                {/* 404 */}
                <Route path="*" element={
                  <div className="flex items-center justify-center min-h-[60vh] text-text-secondary">
                    Page not found
                  </div>
                } />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}