'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Profile from '../../components/Profile';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { addToast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      addToast('Đã đăng xuất thành công', 'success');
      router.push('/');
    } catch (error) {
      addToast('Lỗi khi đăng xuất: ' + error.message, 'error');
    }
  };

  return (
    <Profile 
      user={user} 
      onBack={() => router.push('/')} 
      onNavigate={(path) => router.push(path)} 
      onLogout={handleLogout} 
    />
  );
}
