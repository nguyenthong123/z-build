import React from 'react';
import './MobileNav.css';

const MobileNav = ({ mode, activePage, onNavigate, user, isAdminUser, handleLoginRequired, setView, onToggleChatBot }) => {
  const isAdmin = mode === 'admin';

  const userTabs = [
    { id: 'home', label: 'Home', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, action: () => setView('home') },
    { id: 'ai-advisor', label: 'Advisor', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0-9-9c0 1.48.35 2.89 1.01 4.1L3 21l4.9-1.01A8.96 8.96 0 0 0 12 21Z"/><circle cx="12" cy="12" r="3"/></svg>, action: () => onToggleChatBot() },
    { id: 'cart', label: 'Cart', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, action: () => setView('cart') },
    { id: 'wishlist', label: 'Wishlist', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, action: () => setView('wishlist') },

    isAdminUser ? (
      { 
        id: 'admin', 
        label: 'Admin', 
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, 
        action: () => onNavigate('admin-dashboard') 
      }
    ) : (
      { id: 'profile', label: 'Profile', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, action: () => user ? setView('profile') : handleLoginRequired('profile') }
    )
  ];

  const adminTabs = [
    { id: 'home', label: 'Home', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, action: () => onNavigate('home') },
    { id: 'products', label: 'Sản phẩm', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M12 22V12"/></svg>, action: () => onNavigate('admin-products') },
    { id: 'add_product', label: 'Thêm mới', isSpecial: true, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>, action: () => onNavigate('admin-add-product') },
    { id: 'customers', label: 'Khách hàng', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, action: () => onNavigate('admin-customers') },
    { id: 'settings', label: 'Cài đặt', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.6 1.51z"/></svg>, action: () => onNavigate('admin-settings') },
  ];

  const [isVisible, setIsVisible] = React.useState(true);
  const lastScrollY = React.useRef(0);

  React.useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            setIsVisible(prev => prev ? false : prev);
          } else {
            setIsVisible(prev => !prev ? true : prev);
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tabs = isAdmin ? adminTabs : userTabs;

  return (
    <div className={`mobile-bottom-nav ${isAdmin ? 'admin-mode' : ''} ${!isVisible ? 'nav-hidden' : ''}`}>
      {tabs.map((tab) => (
        <button 
          key={tab.id}
          className={`nav-item ${tab.isSpecial ? 'special-btn' : ''} ${activePage === tab.id ? 'active' : ''}`}
          onClick={tab.action}
          aria-label={tab.label}
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
