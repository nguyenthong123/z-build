'use client';

import dynamic from 'next/dynamic';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';

// Dynamic import to avoid SSR issues with Firebase and browser APIs
const App = dynamic(() => import('../App'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f9fb',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #eee',
        borderTopColor: '#D4AF37',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: '#666', fontWeight: 600 }}>Đang tải Zbuild...</p>
    </div>
  )
});

export default function Page() {
  return (
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  );
}
