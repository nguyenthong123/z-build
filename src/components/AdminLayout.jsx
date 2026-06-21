'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminAIAssistant from './AdminAIAssistant';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

import { AdminAIProvider } from '../context/AdminAIContext';

export default function AdminLayout({ children }) {
  const { isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/login');
    }
  }, [loading, isAdmin, router]);

  if (loading) return <div className="admin-loading">Đang tải cấu hình quản trị...</div>;
  if (!isAdmin) return null;

  const isAIPage = pathname === '/admin/ai-assistant';

  return (
    <AdminAIProvider>
      <div className="admin-container">
        <AdminSidebar />
        <main className="admin-main" style={{ display: isAIPage ? 'none' : 'block' }}>
          {children}
        </main>
        <div style={{ display: isAIPage ? 'block' : 'none' }} className="admin-ai-persistent-wrapper">
          <AdminAIAssistant />
        </div>
      </div>
    </AdminAIProvider>
  );
};


