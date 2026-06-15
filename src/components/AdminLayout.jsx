import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminAIAssistant from './AdminAIAssistant';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
  const { isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="admin-loading">Đang tải cấu hình quản trị...</div>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  const isAIPage = location.pathname === '/admin/ai-assistant';

  return (
    <div className="admin-container">
      <AdminSidebar />
      <main className="admin-main" style={{ display: isAIPage ? 'none' : 'block' }}>
        <Outlet />
      </main>
      <div style={{ display: isAIPage ? 'block' : 'none' }} className="admin-ai-persistent-wrapper">
        <AdminAIAssistant />
      </div>
    </div>
  );
};

export default AdminLayout;
