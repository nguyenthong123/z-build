import React from 'react';
import './MobileNav.css';

const MobileNav = ({ mode, activePage, onNavigate, user, handleLoginRequired, setView, onToggleChatBot }) => {
  const isAdmin = mode === 'admin';

  const userTabs = [
    { id: 'home', label: 'Home', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, action: () => setView('home') },
    { id: 'ai-advisor', label: 'Advisor', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0-9-9c0 1.48.35 2.89 1.01 4.1L3 21l4.9-1.01A8.96 8.96 0 0 0 12 21Z"/><circle cx="12" cy="12" r="3"/></svg>, action: () => onToggleChatBot() },
    { id: 'cart', label: 'Cart', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, action: () => setView('cart') },
    { id: 'wishlist', label: 'Wishlist', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, action: () => setView('wishlist') },
    { id: 'profile', label: 'Profile', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, action: () => user ? setView('profile') : handleLoginRequired('profile') }
  ];

  const adminTabs = [
    { id: 'home', label: 'Home', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, action: () => setView('home') },
    { id: 'products', label: 'Sản phẩm', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M12 22V12"/></svg>, action: () => onNavigate('admin-products') },
    { id: 'add_product', label: 'Thêm mới', isSpecial: true, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>, action: () => onNavigate('admin-add-product') },
    { id: 'ai_knowledge', label: 'AI Data', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="7" cy="13" r="1"/><circle cx="17" cy="13" r="1"/></svg>, action: () => onNavigate('admin-ai-knowledge') },
    { id: 'orders', label: 'Đơn hàng', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, action: () => onNavigate('admin-orders') }
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <div className={`mobile-bottom-nav ${isAdmin ? 'admin-mode' : ''}`}>
      {tabs.map((tab) => (
        <button 
          key={tab.id}
          className={`nav-item ${tab.isSpecial ? 'special-btn' : ''} ${activePage === tab.id ? 'active' : ''}`}
          onClick={tab.action}
        >
          {tab.isSpecial ? (
            <div className="special-icon-box">{tab.icon}</div>
          ) : (
            tab.icon
          )}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MobileNav;
