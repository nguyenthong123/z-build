'use client';

import dynamic from 'next/dynamic';

// All providers + App must be client-side only (BrowserRouter needs document)
const ClientApp = dynamic(() => import('./ClientApp'), {
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
  return <ClientApp />;
}
