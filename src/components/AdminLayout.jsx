'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminAIAssistant from './AdminAIAssistant';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

import { AdminAIProvider } from '../context/AdminAIContext';

export default function AdminLayout({ children }) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/login');
    }
  }, [loading, isAdmin, router]);

  if (loading) return <div className="admin-loading">Đang tải cấu hình quản trị...</div>;
  if (!isAdmin) return null;

  return (
    <AdminAIProvider>
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main">
          {children}
        </main>
        <AdminAIAssistant />
      </div>
    </AdminAIProvider>
  );
};


