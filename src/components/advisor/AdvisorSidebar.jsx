import React from 'react';

const AdvisorSidebar = ({ activeTab, setActiveTab, onNavigate, userName }) => {
  return (
    <aside className="advisor-side-nav">
      <div className="nav-brand">
        <div className="avatar-gold">ZB</div>
        <span className="brand-name">Z-BUILD</span>
      </div>
      
      <nav className="nav-links">
        {[
          { id: 'dashboard', label: 'Bảng điều khiển', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
          { id: 'products', label: 'Sản phẩm', icon: <><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></> },
          { id: 'orders', label: 'Đơn hàng', icon: <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></> },
          { id: 'analytics', label: 'Phân tích', icon: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></> }
        ].map(item => (
          <button 
            key={item.id} 
            className={`nav-btn ${activeTab === item.id ? 'active' : ''}`} 
            onClick={() => setActiveTab(item.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
            <span>{item.label}</span>
          </button>
        ))}
        <div style={{ padding: '0 20px', margin: '15px 0' }}><hr style={{ border: 'none', borderTop: '1px solid #E2E8F0' }} /></div>
        <button className="nav-btn" onClick={() => onNavigate('home')} style={{ color: '#E11D48' }}>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ stroke: '#E11D48' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
           <span>Thoát AI Advisor</span>
        </button>
      </nav>

      <footer className="nav-footer">
        <div className="user-avatar">{userName?.charAt(0) || 'T'}</div>
        <div className="user-details">
          <h4>{userName}</h4>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Đại lý Gold</span>
        </div>
      </footer>
    </aside>
  );
};

export default AdvisorSidebar;
