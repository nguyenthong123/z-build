import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import Footer from './components/Footer';
import MobileNav from './components/MobileNav';
import StorefrontChatBot from './components/StorefrontChatBot';
import SEOHead from './components/SEOHead';
import { useToast } from './context/ToastContext';
import { useWishlist } from './context/WishlistContext';
import { useStorefrontAI } from './hooks/useStorefrontAI';
import { useAuth } from './context/AuthContext';

// Lazy-loaded components (code splitting for performance)
const OrderHistory = lazy(() => import('./components/OrderHistory'));
const OrderDetail = lazy(() => import('./components/OrderDetail'));
const Profile = lazy(() => import('./components/Profile'));
const Wishlist = lazy(() => import('./components/Wishlist'));
const ProductDetail = lazy(() => import('./components/ProductDetail'));
const Cart = lazy(() => import('./components/Cart'));
const Checkout = lazy(() => import('./components/Checkout'));
const Login = lazy(() => import('./components/Login'));
const SignUp = lazy(() => import('./components/SignUp'));
const OrderConfirmation = lazy(() => import('./components/OrderConfirmation'));
const AIAdvisor = lazy(() => import('./components/AIAdvisor'));
const ProductCompare = lazy(() => import('./components/ProductCompare'));

const AdminProductList = lazy(() => import('./components/AdminProductList'));
const AdminAddProduct = lazy(() => import('./components/AdminAddProduct'));
const AdminOrderManagement = lazy(() => import('./components/AdminOrderManagement'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminCustomerManagement = lazy(() => import('./components/AdminCustomerManagement'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));
const AdminSidebar = lazy(() => import('./components/AdminSidebar'));
const AdminProductDetailsForm = lazy(() => import('./components/AdminProductDetailsForm'));
const AdminCouponManagement = lazy(() => import('./components/AdminCouponManagement'));
const AdminAffiliateManagement = lazy(() => import('./components/AdminAffiliateManagement'));
const AdminAIAssistant = lazy(() => import('./components/AdminAIAssistant'));
const PrivacyPolicyVN = lazy(() => import('./pages/PrivacyPolicyVN'));
const TermsOfServiceVN = lazy(() => import('./pages/TermsOfServiceVN'));
const PrivacyPolicyEN = lazy(() => import('./pages/PrivacyPolicyEN'));
const TermsOfServiceEN = lazy(() => import('./pages/TermsOfServiceEN'));

import ErrorBoundary from './components/ErrorBoundary';

// ScrollToTop - cuộn lên đầu khi chuyển trang
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Loading Fallback
function PageLoader() {
  return (
    <div style={{ 
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' 
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '40px', height: '40px', border: '3px solid #eee', 
          borderTopColor: '#D4AF37', borderRadius: '50%', 
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' 
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải...</p>
      </div>
    </div>
  );
}

// 404 Page
function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ 
      minHeight: '80vh', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' 
    }}>
      <SEOHead title="404 - Trang không tồn tại | Zbuild" noindex={true} />
      <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🔍</div>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>
        Trang không tồn tại
      </h1>
      <p style={{ color: 'var(--text-muted)', margin: '12px 0 24px', fontSize: '1.1rem' }}>
        Đường dẫn bạn tìm không có trên hệ thống
      </p>
      <button 
        onClick={() => navigate('/')}
        style={{
          padding: '14px 32px', background: 'var(--primary-yellow)', color: 'var(--primary-dark)',
          border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer'
        }}
      >
        Về trang chủ
      </button>
    </div>
  );
}

// Home Page Component
function HomePage({ handleAddToCart, navigate }) {
  
  return (
    <>
      <SEOHead 
        title="Zbuild - Giải pháp Vật liệu Xây dựng & Công nghệ"
        description="Zbuild cung cấp vật liệu xây dựng cao cấp Duraflex, phần mềm quản lý bán hàng và tư vấn AI thông minh cho nhà thầu, đại lý, công trình."
        canonical="/"
      />
      <Hero />
      <ProductGrid 
        onProductClick={(product) => navigate(`/product/${product.slug || product.id}`)} 
        onAddToCart={handleAddToCart} 
      />
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user, isAdmin } = useAuth();
  
  const [intendedDestination, setIntendedDestination] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  
  const productContext = location.state?.productContext || null;
  const storefrontAdvisorState = useStorefrontAI(productContext);
  
  // Admin sidebar navigation using React Router now.

  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('zbuild_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [compareCount, setCompareCount] = useState(() => {
    try {
      const saved = localStorage.getItem(compareKey);
      return saved ? JSON.parse(saved).length : 0;
    } catch { return 0; }
  });

  useEffect(() => {
    localStorage.setItem('zbuild_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Sync compareCount from localStorage (listen for custom events from components)
  useEffect(() => {
    const handleCompareUpdate = () => {
      try {
        const saved = localStorage.getItem(compareKey);
        setCompareCount(saved ? JSON.parse(saved).length : 0);
      } catch { setCompareCount(0); }
    };
    window.addEventListener('compareListUpdated', handleCompareUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === compareKey) handleCompareUpdate();
    });
    return () => {
      window.removeEventListener('compareListUpdated', handleCompareUpdate);
      window.removeEventListener('storage', handleCompareUpdate);
    };
  }, []);

  // Set up Firebase Cloud Messaging for Push Notifications
  useEffect(() => {
    const setupMessaging = async () => {
      if (!user) return;
      try {
        const { messaging } = await import('./firebase');
        if (!messaging) return; // Push not supported in this browser
        
        const { getToken, onMessage } = await import('firebase/messaging');
        const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          const isPlaceholder = !vapidKey || vapidKey.includes('REPLACE') || vapidKey.includes('YOUR_VAPID_KEY');
          
          if (isPlaceholder) {
            console.warn('FCM VAPID Key is missing or using a placeholder. Skipping token generation.');
            return;
          }

          const currentToken = await getToken(messaging, { vapidKey });
          
          if (currentToken) {
            // Save token to Firestore
            await updateDoc(doc(db, 'users', user.uid), {
              fcmTokens: arrayUnion(currentToken)
            }).catch(e => console.log('Không lưu được token, user doc có thể chưa tạo:', e));
          }
        }
        
        // Handle foreground messages
        onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);
          // (NotificationBell handles the actual display logic since backend writes to 'notifications' collection)
        });
      } catch (err) {
        console.error('Lỗi khi thiết lập push notifications', err);
      }
    };
    setupMessaging();
  }, [user]);

  const updateQuantity = (id, delta) => {
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const removeItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const { addToast } = useToast();
  const { syncWithUser, wishlistCount } = useWishlist();

  useEffect(() => {
    syncWithUser(user);
  }, [user, syncWithUser]);

  useEffect(() => {
    const handleAIBatchAdd = (e) => {
      const items = e.detail; 
      if (Array.isArray(items) && items.length > 0) {
        setCartItems(prev => {
          let next = [...prev];
          items.forEach(item => {
            const product = item.product;
            const quantity = item.quantity;
            const existingItem = next.find(i => i.id === product.id);
            if (existingItem) {
              next = next.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity, weight: i.weight || parseFloat(product.weight) || 0 } : i);
            } else {
              next.push({
                id: product.id,
                name: product.title || product.name,
                price: product.discountPrice || product.basePrice || product.price,
                quantity: quantity,
                image: product.image || product.img,
                weight: parseFloat(product.weight) || 0,
                variant: 'Default'
              });
            }
          });
          return next;
        });
        addToast(`Trợ lý AI đã tự động thêm ${items.length} mặt hàng vào giỏ!`, 'success');
      }
    };
    window.addEventListener('AI_ADD_TO_CART_BATCH', handleAIBatchAdd);
    return () => window.removeEventListener('AI_ADD_TO_CART_BATCH', handleAIBatchAdd);
  }, [addToast]);

  const handleAddToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity, weight: item.weight || parseFloat(product.weight) || 0 } : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.title || product.name,
        price: product.discountPrice || product.basePrice || product.price,
        quantity: quantity,
        image: product.image || product.img,
        weight: parseFloat(product.weight) || 0,
        variant: 'Default'
      }];
    });
    addToast(`Đã thêm ${product.title || product.name} vào giỏ hàng`, 'success');
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleOrderComplete = (data) => {
    setOrderData(data);
    setCartItems([]);
    navigate('/order-confirmation');
  };

  const handleLoginRequired = (destination) => {
    setIntendedDestination(destination);
    navigate('/login');
  };

  const handleLogin = (userData) => {
    // onAuthStateChanged in AuthContext will auto-update user state
    addToast(`Chào mừng trở lại, ${userData.name || userData.email}!`, 'success');
    if (intendedDestination) {
      navigate(intendedDestination);
      setIntendedDestination(null);
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast('Đã đăng xuất thành công', 'info');
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      addToast('Lỗi khi đăng xuất', 'error');
    }
  };

  const handleSignUp = (userData) => {
    // onAuthStateChanged in AuthContext will auto-update user state
    addToast('Tạo tài khoản thành công! Chào bạn mới.', 'success');
    if (intendedDestination) {
      navigate(intendedDestination);
      setIntendedDestination(null);
    } else {
      navigate('/');
    }
  };

  // State methods now from Context

  // Helper: Determine current "view" from pathname for MobileNav/Navbar compatibility
  const getViewFromPath = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/product/')) return 'product-detail';
    if (path === '/cart') return 'cart';
    if (path === '/checkout') return 'checkout';
    if (path === '/login') return 'login';
    if (path === '/signup') return 'signup';
    if (path === '/orders') return 'order-history';
    if (path.startsWith('/order/')) return 'order-detail';
    if (path === '/profile') return 'profile';
    if (path === '/compare') return 'compare';
    if (path === '/order-confirmation') return 'order-confirmation';
    // Removed ai-advisor
    if (path.startsWith('/admin')) return `admin-${path.split('/admin/')[1] || 'dashboard'}`;
    return 'home';
  };

  const view = getViewFromPath();
  const isStorefront = !['checkout', 'order-confirmation', 'login', 'signup'].includes(view) && !view.startsWith('admin');
  const showMobileNav = !['checkout', 'order-confirmation', 'login', 'signup'].includes(view);

  // Legacy setView bridge - components that still use setView/onNavigate(string)
  const setView = (viewName) => {
    const viewToRoute = {
      'home': '/',
      'cart': '/cart',
      'checkout': '/checkout',
      'login': '/login',
      'signup': '/signup',
      'order-history': '/orders',
      'order-confirmation': '/order-confirmation',
      'profile': '/profile',
      'wishlist': '/wishlist',
      'compare': '/compare',
      'ai-advisor': '/advisor',
      'admin-dashboard': '/admin/dashboard',
      'admin-products': '/admin/products',
      'admin-add-product': '/admin/add-product',
      'admin-orders': '/admin/orders',
      'admin-order-detail': '/admin/order-detail',
      'admin-affiliates': '/admin/affiliates',
      'admin-ai-knowledge': '/admin/ai-knowledge',
      'admin-ai-assistant': '/admin/ai-assistant',
      'admin-coupons': '/admin/coupons',
      'admin-settings': '/admin/settings',
    };
    navigate(viewToRoute[viewName] || '/');
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      {isStorefront && (
        <Navbar 
          view={view} 
          cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          wishlistCount={wishlistCount}
          compareCount={compareCount}
          onCartClick={() => navigate('/cart')}
          onWishlistClick={() => navigate('/wishlist')}
          onCompareClick={() => navigate('/compare')}
          onProfileClick={() => user ? navigate('/profile') : handleLoginRequired('/profile')}
          onLogout={handleLogout}
        />
      )}
      <main>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* === STOREFRONT ROUTES === */}
          <Route path="/" element={
            <HomePage 
              handleAddToCart={handleAddToCart}
              navigate={navigate}
            />
          } />
          <Route path="/product/:productId" element={
            <ProductDetail 
              onBack={() => navigate(-1)} 
              onAddToCart={(product, qty) => handleAddToCart(product, qty)} 
              isLoggedIn={!!user}
              onLoginRequired={() => handleLoginRequired(location.pathname)}
              onProductSelect={(product) => navigate(`/product/${product.slug || product.id}`)}
              setGlobalProduct={setDetailProduct}
            />
          } />
          <Route path="/cart" element={
            <Cart 
              onBack={() => navigate('/')} 
              onCheckout={() => user ? navigate('/checkout') : handleLoginRequired('/checkout')} 
              cartItems={cartItems}
              updateQuantity={updateQuantity}
              removeItem={removeItem}
              clearCart={clearCart}
            />
          } />
          <Route path="/checkout" element={
            user ? (
              <Checkout 
                onBack={() => navigate('/cart')} 
                cartItems={cartItems}
                onOrderComplete={handleOrderComplete}
                user={user}
              />
            ) : <Navigate to="/login" replace />
          } />
          <Route path="/order-confirmation" element={
            <OrderConfirmation 
              onContinueShopping={() => navigate('/')} 
              orderDetails={orderData}
            />
          } />
          <Route path="/wishlist" element={
            <Wishlist onNavigate={(target, id, product) => {
              if (target === 'product' && (product?.slug || id)) {
                navigate(`/product/${product?.slug || id}`);
              } else {
                navigate('/');
              }
            }} />
          } />
          <Route path="/compare" element={<ProductCompare />} />
          
          {/* === AUTH ROUTES === */}
          <Route path="/login" element={
            <Login 
              onLogin={handleLogin} 
              onBack={() => navigate('/')} 
              onSignUp={() => navigate('/signup')} 
            />
          } />
          <Route path="/signup" element={
            <SignUp 
              onSignUp={handleSignUp} 
              onBack={() => navigate('/')} 
              onLogin={() => navigate('/login')} 
            />
          } />
          
          {/* === USER ROUTES === */}
          <Route path="/orders" element={
            <OrderHistory 
              user={user} 
              onBack={() => navigate('/')} 
              onViewDetails={(order) => { setSelectedOrder(order); navigate(`/order/${order.id}`); }} 
              onNavigate={setView} 
              onLogout={handleLogout}
            />
          } />
          <Route path="/order/:orderId" element={
            <OrderDetail 
              order={selectedOrder} 
              onBack={() => navigate('/orders')} 
              onCancelSuccess={(orderId) => {
                setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'cancelled' } : prev);
                addToast('Đơn hàng đã được hủy thành công', 'success');
              }}
              onEditOrder={(items) => {
                setCartItems(items);
                navigate('/cart');
                addToast('Đã khôi phục giỏ hàng, bạn có thể chỉnh sửa và đặt lại', 'info');
              }}
              onReturnSuccess={(orderId, reason) => {
                setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'return_requested', returnReason: reason } : prev);
                addToast('Đã gửi yêu cầu trả hàng', 'success');
              }}
            />
          } />
          <Route path="/profile" element={
            <Profile user={user} onBack={() => navigate('/')} onNavigate={setView} onLogout={handleLogout} />
          } />
          <Route path="/advisor" element={
            <AIAdvisor onNavigate={(target) => navigate(target === 'home' ? '/' : `/${target}`)} advisorState={storefrontAdvisorState} />
          } />


          {/* === ADMIN ROUTES === */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={
              <AdminDashboard onBack={() => navigate('/')} />
            } />
            <Route path="products" element={
              <AdminProductList 
                onBack={() => navigate('/')} 
                onAddProduct={() => { setEditingProduct(null); navigate('/admin/add-product'); }} 
                onEditProduct={(product) => { setEditingProduct(product); navigate('/admin/add-product'); }}
                onPreviewProduct={(product) => navigate(`/product/${product.slug || product.id}`)}
              />
            } />
            <Route path="add-product" element={
              isAdmin ? (
                <AdminAddProduct 
                  onBack={() => navigate('/admin/products')} 
                  editData={editingProduct}
                  onSave={() => { setEditingProduct(null); navigate('/admin/products'); }} 
                />
              ) : <Navigate to="/login" state={{ from: '/admin/add-product' }} replace />
            } />
            <Route path="orders" element={
              <AdminOrderManagement
                onBack={() => navigate('/')}
                onViewOrderDetail={(order) => { setSelectedOrder(order); navigate('/admin/order-detail'); }}
              />
            } />
            <Route path="order-detail" element={
              <OrderDetail
                order={selectedOrder}
                onBack={() => navigate('/admin/orders')}
                isAdmin={true}
                onCancelSuccess={(orderId) => {
                  setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'cancelled' } : prev);
                  addToast('Đơn hàng đã được hủy thành công', 'success');
                }}
              />
            } />
            <Route path="ai-assistant" element={<AdminAIAssistant />} />
            <Route path="affiliates" element={isAdmin ? <AdminAffiliateManagement onBack={() => navigate('/admin/dashboard')} /> : <Navigate to="/" />} />
            <Route path="customers" element={
              <AdminCustomerManagement onBack={() => navigate('/')} />
            } />

            <Route path="coupons" element={
              <AdminCouponManagement onBack={() => navigate('/admin/dashboard')} />
            } />
            <Route path="settings" element={
              isAdmin ? <AdminSettings onBack={() => navigate('/admin/dashboard')} /> : <Navigate to="/" />
            } />
          </Route>

          <Route path="/chinh-sach-bao-mat" element={<PrivacyPolicyVN />} />
          <Route path="/dieu-khoan-su-dung" element={<TermsOfServiceVN />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyEN />} />
          <Route path="/terms-of-service" element={<TermsOfServiceEN />} />

          {/* === 404 === */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {isStorefront && <Footer />}
      
      {/* Admin Toggle Button */}
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
            onClick={() => navigate('/admin/dashboard')}
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
          onLoginRequired={() => handleLoginRequired(location.pathname)}
          onAddToCart={handleAddToCart} 
          onMaximize={() => { setIsChatBotOpen(false); navigate('/advisor'); }}
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
              handleLoginRequired(location.pathname);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
