import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // Auto-reload if it's a chunk loading failure after new deployment
    if (error && (
      error.name === 'ChunkLoadError' || 
      (error.message && (error.message.includes('Loading chunk') || error.message.includes('dynamically imported module')))
    )) {
      const hasReloaded = sessionStorage.getItem('eb_chunk_reloaded');
      if (!hasReloaded) {
        sessionStorage.setItem('eb_chunk_reloaded', 'true');
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '65vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px 20px',
          fontFamily: 'Outfit, system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e', marginBottom: '12px' }}>Đã xảy ra lỗi kết nối hoặc hiển thị</h1>
          <p style={{ color: '#64748b', fontSize: '0.98rem', marginBottom: '24px', maxWidth: '480px', lineHeight: '1.5' }}>
            Hệ thống đang cập nhật hoặc dữ liệu phản hồi bị gián đoạn. Vui lòng nhấn nút bên dưới để làm mới trang.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                sessionStorage.removeItem('eb_chunk_reloaded');
                window.location.reload();
              }}
              style={{
                padding: '12px 24px',
                background: '#FFB800',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255,184,0,0.3)'
              }}
            >
              🔄 Tải lại trang
            </button>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              style={{
                padding: '12px 24px',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              🏠 về trang chủ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
