'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileNav from './MobileNav';
import StorefrontChatBot from './StorefrontChatBot';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useWishlist } from '../context/WishlistContext';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { 
    cartItems, compareCount, handleLoginRequired, 
    handleAddToCart, detailProduct, isChatBotOpen, setIsChatBotOpen,
    storefrontAdvisorState
  } = useAppContext();
  const { wishlistCount } = useWishlist();

  const getViewFromPath = () => {
    if (!pathname || pathname === '/') return 'home';
    if (pathname.startsWith('/product/')) return 'product-detail';
    if (pathname === '/cart') return 'cart';
    if (pathname === '/checkout') return 'checkout';
    if (pathname === '/login') return 'login';
    if (pathname === '/signup') return 'signup';
    if (pathname === '/orders') return 'order-history';
    if (pathname.startsWith('/order/')) return 'order-detail';
    if (pathname === '/profile') return 'profile';
    if (pathname === '/compare') return 'compare';
    if (pathname === '/order-confirmation') return 'order-confirmation';
    if (pathname.startsWith('/admin')) return `admin-${pathname.split('/admin/')[1] || 'dashboard'}`;
    return 'home';
  };

  const view = getViewFromPath();
  const isStorefront = !['checkout', 'order-confirmation', 'login', 'signup'].includes(view) && !view.startsWith('admin');
  const showMobileNav = !['checkout', 'order-confirmation', 'login', 'signup'].includes(view);

  // setView adapter for legacy components
  const setView = (target) => {
    const routeMap = {
      'home': '/',
      'cart': '/cart',
      'checkout': '/checkout',
      'login': '/login',
      'signup': '/signup',
      'order-history': '/orders',
      'profile': '/profile',
      'compare': '/compare',
      'wishlist': '/wishlist',
      'admin-dashboard': '/admin/dashboard',
      'admin-products': '/admin/products',
      'admin-add-product': '/admin/add-product',
      'admin-settings': '/admin/settings',
      'admin-ai-assistant': '/admin/ai-assistant',
      'admin-affiliates': '/admin/affiliates',
      'admin-orders': '/admin/orders',
      'dashboard': '/profile', // User profile overview
      'payments': '/profile', // Placeholder if payments view is not separate
      'settings': '/profile'
    };
    
    // If it's in the map, use the map. Otherwise prepend / if it's missing
    if (routeMap[target]) {
      router.push(routeMap[target]);
    } else {
      router.push(target.startsWith('/') ? target : `/${target}`);
    }
  };

  return (
    <div className="app-container">
      {isStorefront && (
        <Navbar 
          view={view} 
          cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          wishlistCount={wishlistCount}
          compareCount={compareCount}
          onCartClick={() => router.push('/cart')}
          onWishlistClick={() => router.push('/wishlist')}
          onCompareClick={() => router.push('/compare')}
          onProfileClick={() => user ? router.push('/profile') : handleLoginRequired('/profile')}
          onLogout={() => { /* will handle logout in Navbar itself or pass down */ }}
        />
      )}
      <main>
        {children}
      </main>

      {isStorefront && <Footer />}
      
      {isAdmin && (
        <div 
          className={`admin-toggle-container desktop-only ${view === 'product-detail' ? 'shifted' : ''}`}
          style={{ 
            position: 'fixed', 
            zIndex: 9999, 
            display: view.startsWith('admin') ? 'none' : 'block',
            bottom: view === 'product-detail' ? '80px' : '20px',
            left: '20px',
            transition: 'bottom 0.3s ease'
          }}
        >
          <button 
            onClick={() => router.push('/admin/dashboard')}
            style={{ background: '#1a1a2e', color: 'white', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
            title="Quản trị viên"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </button>
        </div>
      )}

      {isStorefront && (
        <StorefrontChatBot 
          isOpen={isChatBotOpen} 
          setIsOpen={setIsChatBotOpen} 
          isLoggedIn={!!user}
          user={user}
          onLoginRequired={() => handleLoginRequired(pathname)}
          onAddToCart={handleAddToCart} 
          advisorState={storefrontAdvisorState}
        />
      )}
      {showMobileNav && (
        <MobileNav 
          mode={view.startsWith('admin') ? 'admin' : 'user'}
          activePage={
            view.startsWith('admin') ? (
              view === 'admin-products' ? 'products' : 
              view === 'admin-ai-knowledge' ? 'ai_knowledge' : 
              view === 'admin-add-product' ? 'add_product' : 
              view === 'admin-ai-assistant' ? 'ai-assistant' :
              view === 'admin-affiliates' ? 'affiliates' :
              view === 'admin-orders' ? 'orders' : 'dashboard'
            ) : view
          }
          user={user}
          isAdminUser={isAdmin}
          setView={setView}
          onNavigate={(target) => setView(target)}
          handleLoginRequired={handleLoginRequired}
          detailProduct={detailProduct}
          onAddToCart={handleAddToCart}
          onToggleChatBot={() => {
            if (user) {
              setIsChatBotOpen(!isChatBotOpen);
            } else {
              handleLoginRequired(pathname);
            }
          }}
        />
      )}
    </div>
  );
}
