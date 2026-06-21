'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Login from '../../components/Login';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

export default function LoginPage() {
  const router = useRouter();
  const { intendedDestination } = useAppContext();
  const { addToast } = useToast();

  const handleLogin = () => {
    addToast('Đăng nhập thành công!', 'success');
    if (intendedDestination) {
      router.push(intendedDestination);
    } else {
      router.push('/');
    }
  };

  return (
    <Login 
      onLogin={handleLogin}
      onBack={() => router.push('/')}
      onSignUp={() => router.push('/signup')}
    />
  );
}
