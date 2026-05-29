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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '10px' }}>Đã xảy ra lỗi kết nối</h1>
          <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '24px', maxWidth: '500px' }}>
            Hệ thống tạm thời không thể hiển thị nội dung này do sự cố kết nối hoặc dữ liệu không phản hồi. Xin lỗi bạn vì sự bất tiện này.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              background: '#FFB800',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
