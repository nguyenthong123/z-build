'use client';

import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminAIAssistant from './AdminAIAssistant';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

import { AdminAIProvider } from '../context/AdminAIContext';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Short delay to allow Firestore adminEmails to sync
    const timer = setTimeout(() => {
      if (!loading && !isAdmin) {
        navigate('/login', { replace: true });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [loading, isAdmin, navigate]);

  if (loading) return <div className="admin-loading">Đang tải cấu hình quản trị...</div>;
  if (!isAdmin) return null;

  return (
    <AdminAIProvider>
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-page-card">
            <Outlet />
          </div>
        </main>
        <AdminAIAssistant />
      </div>
    </AdminAIProvider>
  );
};


