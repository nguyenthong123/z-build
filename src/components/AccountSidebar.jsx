import React from 'react';
import './AccountSidebar.css';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '../context/ToastContext';

const AccountSidebar = ({ user, activeView, onViewChange, onLogout }) => {
  const { addToast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (onLogout) onLogout();
      addToast('Đã đăng xuất thành công', 'info');
    } catch (error) {
      console.error("Logout error:", error);
      addToast('Lỗi khi đăng xuất', 'error');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
    )},
    { id: 'order-history', label: 'Lịch sử đơn hàng', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    )},
    { id: 'profile', label: 'Hồ sơ của tôi', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )},
    { id: 'payments', label: 'Thanh toán', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
    )},
    { id: 'settings', label: 'Cài đặt', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.72l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    )}
  ];

  return (
    <aside className="account-sidebar">
      <div className="account-user-card">
        <div className="user-avatar-small">
          {user?.photoURL ? (
            <img src={user.photoURL} alt={user.displayName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          )}
        </div>
        <div className="user-info-text">
          <span className="label">TÀI KHOẢN</span>
          <h3>{user?.name || 'Khách'}</h3>
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button 
            key={item.id}
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      
      <div className="sidebar-promo">
        <span className="promo-tag">NÂNG CẤP</span>
        <h4>Tham gia Gold Plus để miễn phí vận chuyển</h4>
        <button className="promo-btn">Tìm hiểu ngay</button>
      </div>

      <button className="sign-out-btn" onClick={handleLogout}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        Đăng xuất
      </button>
    </aside>
  );
};

export default AccountSidebar;
