import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GlobalStyles from './GlobalStyles';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AssignmentsPage from './pages/AssignmentsPage';
import AssignmentDetailPage from './pages/AssignmentDetailPage';
import StreamPage from './pages/StreamPage';
import SettingsPage from './pages/SettingsPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminErrorsPage from './pages/admin/AdminErrorsPage';
import AdminSystemPage from './pages/admin/AdminSystemPage';
import AdminBusinessPage from './pages/admin/AdminBusinessPage';
import Schedule from './pages/Schedule';
import WeeklyView from './pages/WeeklyView';
import StudentRoute from './components/StudentRoute';

function App() {
  return (
    <BrowserRouter>
      <GlobalStyles />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Administrators sign in through the one login page like everyone
            else. Kept as a redirect so existing bookmarks still land somewhere
            useful. */}
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route element={<StudentRoute />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/stream" element={<StreamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/weekly" element={<WeeklyView />} />
        </Route>
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="errors" element={<AdminErrorsPage />} />
            <Route path="system" element={<AdminSystemPage />} />
            <Route path="business" element={<AdminBusinessPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;