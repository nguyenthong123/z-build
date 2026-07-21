import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

const Navbar = ({ onCartClick, onWishlistClick, onProfileClick, onLogout, view, cartCount = 0, wishlistCount = 0, compareCount = 0, onCompareClick }) => {
  const [searchValue, setSearchValue] = React.useState('');
  const { isDark, toggleTheme } = useTheme();
  const { user, isLoggedIn } = useAuth();
  const { handleSearch, setSelectedCategory, setSearchQuery } = useStore();
  const [isNavVisible, setIsNavVisible] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'vi' ? 'en' : 'vi';
    i18n.changeLanguage(nextLang);
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    navigate('/');
    setSelectedCategory(null);
    setSearchQuery('');
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 70) {
        setIsNavVisible(false); // Scrolling down - hiding
      } else {
        setIsNavVisible(true); // Scrolling up - showing
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    handleSearch(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchValue);
    }
  };

  return (
    <nav className={`navbar ${view === 'product-detail' ? 'product-view' : ''} ${view === 'cart' ? 'cart-view' : ''} ${view === 'compare' ? 'compare-view' : ''} ${(view === 'order-history' || view === 'profile') ? 'profile-view' : ''} ${!isNavVisible ? 'nav-hidden' : ''}`}>
      <div className="container nav-content">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM7 7H17V9L10 15H17V17H7V15L14 9H7V7Z" fill="currentColor"/>
            </svg>
          </div>
          <span className="logo-text">ZBUILD</span>
        </div>

        <div className="search-bar">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input 
            type="text" 
            placeholder={t('nav.search_placeholder')} 
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <ul className="nav-links">
          <li><a href="/" className={view === 'home' && !searchValue ? 'active' : ''} onClick={handleLogoClick}>{t('nav.store')}</a></li>
          <li><a href="/" onClick={(e) => { e.preventDefault(); handleSearch('deals'); }}>{t('nav.deals')}</a></li>
        </ul>

        <div className="nav-actions">
          <button 
            className="icon-btn theme-toggle" 
            onClick={toggleTheme} 
            title={isDark ? t('nav.light_mode') : t('nav.dark_mode')}
            aria-label={isDark ? t('nav.switch_light') : t('nav.switch_dark')}
          >
            {isDark ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button 
            className={`icon-btn badge-btn ${view === 'wishlist' ? 'active' : ''}`} 
            onClick={onWishlistClick} 
            title={t('nav.wishlist')}
            aria-label={t('nav.wishlist_count', { count: wishlistCount })}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={view === 'wishlist' ? '#EF4444' : 'none'} stroke={view === 'wishlist' ? '#EF4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {wishlistCount > 0 && <span className="nav-badge wishlist-badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>}
          </button>
          <button 
            className={`icon-btn badge-btn compare-btn ${view === 'compare' ? 'active' : ''}`} 
            onClick={onCompareClick || (() => navigate('/compare'))} 
            title="So sánh"
            aria-label={`So sánh sản phẩm (${compareCount})`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={view === 'compare' ? '#F5C400' : 'none'} stroke={view === 'compare' ? '#F5C400' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              <rect x="6" y="11" width="5" height="8" rx="1"/>
              <rect x="13" y="11" width="5" height="8" rx="1"/>
            </svg>
            {compareCount > 0 && <span className="nav-badge compare-badge">{compareCount > 99 ? '99+' : compareCount}</span>}
          </button>
          {isLoggedIn && <NotificationBell user={user} />}
          <button 
            className={`icon-btn ${(view === 'order-history' || view === 'profile') ? 'active' : ''}`} 
            onClick={onProfileClick} 
            title={isLoggedIn ? t('nav.profile_tooltip') : t('nav.login_tooltip')}
            aria-label={isLoggedIn ? t('nav.profile') : t('nav.login')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          {isLoggedIn && (
            <button className="icon-btn logout-btn" onClick={onLogout} title={t('nav.logout')} aria-label={t('nav.logout')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          )}
          <button 
            className={`icon-btn badge-btn ${view === 'cart' ? 'active' : ''}`} 
            onClick={onCartClick}
            title={t('nav.cart')}
            aria-label={t('nav.cart_count', { count: cartCount })}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {cartCount > 0 && <span className="nav-badge">{cartCount > 99 ? '99+' : cartCount}</span>}
          </button>
        </div>
        <button
          className="icon-btn lang-switch"
          onClick={toggleLanguage}
          title={t('general.language_switch')}
          aria-label={t('general.language')}
        >
          <span className="lang-switch-text">{t('general.language_switch')}</span>
        </button>
      </div>
    </nav>

  );
};

export default Navbar;
