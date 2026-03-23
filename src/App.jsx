import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CategorySection from './components/CategorySection';
import PromoBanner from './components/PromoBanner';
import ProductGrid from './components/ProductGrid';
import Footer from './components/Footer';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import OrderConfirmation from './components/OrderConfirmation';
import Login from './components/Login';
import SignUp from './components/SignUp';
import MobileNav from './components/MobileNav';
import StorefrontChatBot from './components/StorefrontChatBot';
import SEOHead from './components/SEOHead';
import { useToast } from './context/ToastContext';
import { useWishlist } from './context/WishlistContext';

// Lazy-loaded components (code splitting for performance)
const OrderHistory = lazy(() => import('./components/OrderHistory'));
const OrderDetail = lazy(() => import('./components/OrderDetail'));
const Profile = lazy(() => import('./components/Profile'));
const Wishlist = lazy(() => import('./components/Wishlist'));

const AdminProductList = lazy(() => import('./components/AdminProductList'));
const AdminAddProduct = lazy(() => import('./components/AdminAddProduct'));
const AdminOrderManagement = lazy(() => import('./components/AdminOrderManagement'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminCustomerManagement = lazy(() => import('./components/AdminCustomerManagement'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));
const AdminSidebar = lazy(() => import('./components/AdminSidebar'));
const AdminProductDetailsForm = lazy(() => import('./components/AdminProductDetailsForm'));
const AdminAIInsights = lazy(() => import('./components/AdminAIInsights'));
const AdminCouponManagement = lazy(() => import('./components/AdminCouponManagement'));

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
function HomePage({ onCategorySelect, selectedCategory, searchQuery, handleAddToCart, navigate }) {
  return (
    <>
      <SEOHead 
        title="Zbuild - Giải pháp Vật liệu Xây dựng & Công nghệ"
        description="Zbuild cung cấp vật liệu xây dựng cao cấp Duraflex, phần mềm quản lý bán hàng và tư vấn AI thông minh cho nhà thầu, đại lý, công trình."
        canonical="/"
      />
      <Hero />
      <CategorySection onCategorySelect={onCategorySelect} activeCategory={selectedCategory} />
      <PromoBanner />
      <ProductGrid 
        onProductClick={(product) => navigate(`/product/${product.id}`)} 
        onAddToCart={handleAddToCart} 
        searchQuery={searchQuery}
        category={selectedCategory}
      />
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [user, setUser] = useState(null);
  const [adminEmails, setAdminEmails] = useState(['nbt1024@gmail.com']);
  const [intendedDestination, setIntendedDestination] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  
  // Admin sidebar navigation
  useEffect(() => {
    const handleNav = (e) => {
      const page = e.detail;
      const adminRoutes = {
        'ai_knowledge': '/admin/ai-knowledge',
        'products': '/admin/products',
        'orders': '/admin/orders',
        'coupons': '/admin/coupons',
        'customers': '/admin/customers',
        'dashboard': '/admin/dashboard',
        'ai_insights': '/admin/ai-insights',
        'settings': '/admin/settings'
      };
      if (adminRoutes[page]) navigate(adminRoutes[page]);
    };
    window.addEventListener('admin-nav', handleNav);
    return () => window.removeEventListener('admin-nav', handleNav);
  }, [navigate]);

  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('zbuild_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('zbuild_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL || null
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
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
          // You need to replace this VAPID key conceptually, but Firebase needs it
          const currentToken = await getToken(messaging, { 
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BM_REPLACE_ME' 
          });
          
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

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const { doc, getDoc, setDoc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        const adminDocRef = doc(db, 'settings', 'admins');
        const adminDoc = await getDoc(adminDocRef);
        
        let currentEmails = ['trunghieu.nd01@gmail.com', 'nbt1024@gmail.com'];
        
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          if (!remoteEmails.includes('nbt1024@gmail.com')) {
            const updated = [...remoteEmails, 'nbt1024@gmail.com'];
            await updateDoc(adminDocRef, { emails: updated });
            currentEmails = updated;
          } else {
            currentEmails = remoteEmails;
          }
        } else {
          await setDoc(adminDocRef, { emails: currentEmails });
        }
        setAdminEmails(currentEmails);
      } catch (error) {
        console.error("Error fetching admins:", error);
      }
    };
    fetchAdmins();
  }, []);

  const isAdmin = user && adminEmails.some(e => e.toLowerCase().trim() === user.email.toLowerCase().trim());

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

  const handleAddToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.title || product.name,
        price: product.discountPrice || product.basePrice || product.price,
        quantity: quantity,
        image: product.image || product.img,
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
    setUser(userData);
    addToast(`Chào mừng trở lại, ${userData.name}!`, 'success');
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
    setUser(userData);
    addToast('Tạo tài khoản thành công! Chào bạn mới.', 'success');
    if (intendedDestination) {
      navigate(intendedDestination);
      setIntendedDestination(null);
    } else {
      navigate('/');
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSelectedCategory(null);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    if (location.pathname !== '/') {
      navigate('/');
    }
    const productGrid = document.querySelector('.product-section');
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
    if (path === '/wishlist') return 'wishlist';
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
      // Removed ai-advisor
      'admin-dashboard': '/admin/dashboard',
      'admin-products': '/admin/products',
      'admin-add-product': '/admin/add-product',
      'admin-orders': '/admin/orders',
      'admin-order-detail': '/admin/order-detail',
      'admin-customers': '/admin/customers',
      'admin-ai-knowledge': '/admin/ai-knowledge',
      'admin-ai-insights': '/admin/ai-insights',
      'admin-coupons': '/admin/coupons',
    };
    navigate(viewToRoute[viewName] || '/');
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      {isStorefront && (
        <Navbar 
          view={view} 
          user={user}
          isLoggedIn={!!user}
          cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          wishlistCount={wishlistCount}
          onLogoClick={() => { navigate('/'); setSelectedCategory(null); setSearchQuery(''); }} 
          onCartClick={() => navigate('/cart')}
          onWishlistClick={() => navigate('/wishlist')}
          onProfileClick={() => user ? navigate('/profile') : handleLoginRequired('/profile')}
          onLogout={handleLogout}
          onSearch={handleSearch}
        />
      )}
      <main>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* === STOREFRONT ROUTES === */}
          <Route path="/" element={
            <HomePage 
              onCategorySelect={handleCategorySelect}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
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
              onProductSelect={(product) => navigate(`/product/${product.id}`)}
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
            <Wishlist onNavigate={(target, id) => {
              if (target === 'product' && id) {
                navigate(`/product/${id}`);
              } else {
                navigate('/');
              }
            }} />
          } />
          
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
            />
          } />
          <Route path="/profile" element={
            <Profile user={user} onBack={() => navigate('/')} onNavigate={setView} onLogout={handleLogout} />
          } />


          {/* === ADMIN ROUTES === */}
          <Route path="/admin/dashboard" element={
            <AdminDashboard onBack={() => navigate('/')} />
          } />
          <Route path="/admin/products" element={
            <AdminProductList 
              onBack={() => navigate('/')} 
              onAddProduct={() => { setEditingProduct(null); navigate('/admin/add-product'); }} 
              onEditProduct={(product) => { setEditingProduct(product); navigate('/admin/add-product'); }}
              onPreviewProduct={(product) => navigate(`/product/${product.id}`)}
            />
          } />
          <Route path="/admin/add-product" element={
            <AdminAddProduct 
              onBack={() => navigate('/admin/products')} 
              editData={editingProduct}
              onSave={() => { setEditingProduct(null); navigate('/admin/products'); }} 
            />
          } />
          <Route path="/admin/orders" element={
            <AdminOrderManagement
              onBack={() => navigate('/')}
              onViewOrderDetail={(order) => { setSelectedOrder(order); navigate('/admin/order-detail'); }}
            />
          } />
          <Route path="/admin/order-detail" element={
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
          <Route path="/admin/customers" element={
            <AdminCustomerManagement onBack={() => navigate('/')} />
          } />
          <Route path="/admin/ai-insights" element={
            <AdminAIInsights onBack={() => navigate('/admin/dashboard')} />
          } />
          <Route path="/admin/coupons" element={
            <AdminCouponManagement onBack={() => navigate('/admin/dashboard')} />
          } />
          <Route path="/admin/settings" element={
            <AdminSettings onBack={() => navigate('/admin/dashboard')} />
          } />

          {/* === 404 === */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>

      {isStorefront && <Footer />}
      
      {/* Admin Toggle Button */}
      {isAdmin && (
        <div 
          className={`admin-toggle-container ${view === 'product-detail' ? 'shifted' : ''}`}
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
          onLoginRequired={() => handleLoginRequired(location.pathname)}
          onAddToCart={handleAddToCart} 
        />
      )}
      {showMobileNav && (
        <MobileNav 
          mode={view.startsWith('admin') ? 'admin' : 'user'}
          activePage={
            view.startsWith('admin') ? (
              view === 'admin-products' ? 'products' : 
              view === 'admin-ai-knowledge' ? 'ai_knowledge' : 
              view === 'admin-add-product' ? 'add_product' : 'dashboard'
            ) : view
          }
          user={user}
          setView={setView}
          onNavigate={(target) => setView(target)}
          handleLoginRequired={handleLoginRequired}
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
