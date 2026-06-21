'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import SignUp from '../../components/SignUp';
import { useToast } from '../../context/ToastContext';

export default function SignUpPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleSignUp = () => {
    addToast('Đăng ký tài khoản thành công!', 'success');
    router.push('/');
  };

  return (
    <SignUp 
      onSignUp={handleSignUp}
      onBack={() => router.push('/')}
      onLogin={() => router.push('/login')}
    />
  );
}
