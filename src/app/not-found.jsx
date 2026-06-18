'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main, #f8f9fb)',
      padding: '20px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ fontSize: '6rem', fontWeight: '900', color: '#D4AF37', marginBottom: '10px' }}>404</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>
        Không tìm thấy trang
      </h1>
      <p style={{ color: '#666', marginBottom: '30px', textAlign: 'center' }}>
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          padding: '14px 30px',
          background: '#1a1a1a',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Về trang chủ
      </button>
    </div>
  );
}
