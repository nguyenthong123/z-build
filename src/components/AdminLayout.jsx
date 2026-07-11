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
  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a' }}>
      <div style={{ textAlign: 'center', color: '#fff', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ marginBottom: 8 }}>Quyền truy cập bị từ chối</h2>
        <p style={{ color: '#999', marginBottom: 24 }}>Tài khoản của bạn không có quyền quản trị.<br/>Vui lòng đăng nhập bằng email admin.</p>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Đăng nhập lại
        </button>
      </div>
    </div>
  );

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


