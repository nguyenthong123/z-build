import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, query, where, serverTimestamp, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Checkout.css';

const Checkout = ({ onBack, cartItems, onOrderComplete, user }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Vietnam',
    phone: '',
    shippingMethod: 'standard',
    paymentMethod: 'bank-transfer', // Default to bank transfer for easy setup
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });

  const [paymentStep] = useState(1); // 1: Form, 2: QR Code
  const [generatedOrder, setGeneratedOrder] = useState(null);
  const [orderNumber] = useState(() => 'ZB' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000));

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false);
  const [pollingTimeout, setPollingTimeout] = useState(false);
  const [bankTransactionInfo, setBankTransactionInfo] = useState(null);

  // Timeout for App Script polling (10 minutes)
  useEffect(() => {
    if (formData.paymentMethod !== 'bank-transfer' || !orderNumber) return;
    const timer = setTimeout(() => setPollingTimeout(true), 600000);
    return () => clearTimeout(timer);
  }, [formData.paymentMethod, orderNumber]);

  // Auto-checkout polling from App Script URL
  useEffect(() => {
    if (formData.paymentMethod !== 'bank-transfer' || !orderNumber || pollingTimeout) return;

    const checkPayment = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwKEEu9Yapfdpt_MpCneQvR4BRORrIK9NHv6EJYoJbtH9ocOrxeh-1tOzI3lmFLaT41/exec';
        const res = await fetch(SCRIPT_URL);
        const json = await res.json();
        
        if (json && json.data && Array.isArray(json.data)) {
          // Check if any transaction matches the orderNumber in "Nội dung"
          const hasPaid = json.data.find(tx => tx['Nội dung'] && tx['Nội dung'].includes(orderNumber));
          if (hasPaid && !autoCheckoutTriggered) {
            setBankTransactionInfo(hasPaid);
            setAutoCheckoutTriggered(true);
          }
        }
      } catch (err) {
        console.error('Error checking payment:', err);
      }
    };

    // Check immediately, then every 10 seconds
    checkPayment();
    const intervalId = setInterval(checkPayment, 10000);

    return () => clearInterval(intervalId);
  }, [formData.paymentMethod, orderNumber, autoCheckoutTriggered, pollingTimeout]);

  useEffect(() => {
    if (autoCheckoutTriggered && !isSubmitting && paymentStep === 1) {
      handlePlaceOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckoutTriggered]);

  // Shop's Bank Info (Configurable)
  const [shopBankInfo, setShopBankInfo] = useState({
    bankCode: 'vcb',
    bankName: 'Vietcombank',
    accountNumber: '1014845876', 
    accountName: 'NGUYEN BA TRUNG'
  });

  // Dynamic Shipping Settings
  const [shippingSettings, setShippingSettings] = useState(null);
  const [openClawConfig, setOpenClawConfig] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  // Auto-fill user data if logged in
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user && user.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setFormData(prev => ({
              ...prev,
              email: data.email || user.email || prev.email,
              firstName: data.firstName || prev.firstName,
              lastName: data.lastName || prev.lastName,
              address: data.address || prev.address,
              city: data.city || prev.city,
              state: data.state || prev.state,
              zipCode: data.zipCode || prev.zipCode,
              phone: data.phone || prev.phone,
            }));
          } else if (user.email) {
            setFormData(prev => ({ ...prev, email: user.email }));
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    const fetchBankInfo = async () => {
      try {
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.bankInfo) {
            setShopBankInfo(data.bankInfo);
          }
          if (data.shippingSettings) {
            setShippingSettings(data.shippingSettings);
          }
          if (data.openClawConfig) {
            setOpenClawConfig(data.openClawConfig);
          }
        }
      } catch (error) {
        console.error('Error fetching bank info:', error);
      }
    };
    fetchBankInfo();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const totalWeight = cartItems.reduce((acc, item) => {
    const itemWeight = parseFloat(item.weight) || 0;
    return acc + (itemWeight * item.quantity);
  }, 0);

  let shippingCost = 0;
  if (formData.shippingMethod === 'express') {
    if (distanceKm !== null && shippingSettings) {
      const rules = shippingSettings.distanceRules || [];
      const sortedRules = [...rules].sort((a, b) => (parseFloat(a.maxDistance) || 0) - (parseFloat(b.maxDistance) || 0));
      
      let matchedRule = null;
      for (const rule of sortedRules) {
        if (distanceKm <= parseFloat(rule.maxDistance)) {
          matchedRule = rule;
          break;
        }
      }
      
      const pricePerKg = matchedRule 
        ? parseInt(matchedRule.pricePerKg) || 0
        : parseInt(shippingSettings.fallbackPricePerKg || 10000);
      
      shippingCost = totalWeight * pricePerKg;

      // Áp dụng khuyến mãi giảm phí ship theo giá trị đơn hàng (nhiều mốc)
      if (shippingSettings.shippingDiscountRules && shippingSettings.shippingDiscountRules.length > 0) {
        // Sắp xếp các mốc giảm dần theo giá trị đơn hàng
        const sortedRules = [...shippingSettings.shippingDiscountRules].sort((a, b) => 
          (parseFloat(b.minOrderValue) || 0) - (parseFloat(a.minOrderValue) || 0)
        );
        
        for (const rule of sortedRules) {
          const minOrder = parseFloat(rule.minOrderValue) || 0;
          const discountPct = parseFloat(rule.discountPercent) || 0;
          
          if (subtotal >= minOrder && discountPct > 0) {
            shippingCost = Math.round(shippingCost - (shippingCost * discountPct / 100));
            break; // Chỉ áp dụng mốc cao nhất thỏa mãn
          }
        }
      }
    } else {
      // If user hasn't located yet, show 0 or some base fallback
      shippingCost = 0; 
    }
  }

  const handleGetLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (shippingSettings?.storeLat && shippingSettings?.storeLng) {
            const d = getDistanceFromLatLonInKm(
              parseFloat(shippingSettings.storeLat),
              parseFloat(shippingSettings.storeLng),
              position.coords.latitude,
              position.coords.longitude
            );
            setDistanceKm(d);
          }
          setIsLocating(false);
        },
        (err) => {
          if (err.code === 1) {
            alert('Không thể lấy vị trí. Vui lòng cho phép trình duyệt truy cập định vị.');
          } else if (err.code === 2) {
            alert('Không thể xác định vị trí. Vui lòng bật Wi-Fi trên máy Mac của bạn (dù đang dùng mạng dây) để hỗ trợ định vị.');
          } else {
            alert('Lỗi khi lấy vị trí: ' + err.message);
          }
          setIsLocating(false);
        }
      );
    } else {
      alert('Trình duyệt của bạn không hỗ trợ định vị.');
      setIsLocating(false);
    }
  };

  // Coupon discount calculation
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      return Math.round(subtotal * appliedCoupon.value / 100);
    }
    if (appliedCoupon.type === 'fixed') {
      return Math.min(appliedCoupon.value, subtotal);
    }
    if (appliedCoupon.type === 'free_shipping') {
      return shippingCost;
    }
    return 0;
  };
  const discount = calculateDiscount();
  const total = subtotal + shippingCost - discount;

  // Validate coupon from Firestore
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase().trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setCouponError('Mã giảm giá không tồn tại.');
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }
      const couponDoc = snapshot.docs[0];
      const coupon = { id: couponDoc.id, ...couponDoc.data() };

      // Validate active
      if (!coupon.active) {
        setCouponError('Mã giảm giá đã bị vô hiệu hóa.');
        setCouponLoading(false);
        return;
      }
      // Validate expiry
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError('Mã giảm giá đã hết hạn.');
        setCouponLoading(false);
        return;
      }
      // Validate usage limit
      if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) {
        setCouponError('Mã giảm giá đã hết lượt sử dụng.');
        setCouponLoading(false);
        return;
      }
      // Validate min order
      if (coupon.minOrder > 0 && subtotal < coupon.minOrder) {
        setCouponError(`Đơn hàng tối thiểu ${Number(coupon.minOrder).toLocaleString('vi-VN')}₫ để sử dụng mã này.`);
        setCouponLoading(false);
        return;
      }
      setAppliedCoupon(coupon);
      setCouponError('');
    } catch (err) {
      console.error('Coupon validation error:', err);
      setCouponError('Lỗi khi kiểm tra mã giảm giá.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.email.trim()) errors.email = 'Vui lòng nhập email hoặc SĐT';
    if (!formData.firstName.trim()) errors.firstName = 'Vui lòng nhập họ';
    if (!formData.lastName.trim()) errors.lastName = 'Vui lòng nhập tên';
    if (!formData.address.trim()) errors.address = 'Vui lòng nhập địa chỉ';
    if (!formData.city.trim()) errors.city = 'Vui lòng nhập thành phố';
    if (!formData.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc (chữ đỏ) trước khi xác nhận đơn hàng.');
      return;
    }
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Validate items before proceeding
      const orderRef = doc(collection(db, 'orders'));
      
      let newTotal = 0;
      let newSubtotal = 0;
      let realDiscount = 0;
      let finalOrderData = null;

      await runTransaction(db, async (transaction) => {
        // 1. Read all products
        const productRefs = cartItems.map(item => doc(db, 'products', item.id));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        
        // Read coupon if applied
        let couponSnap = null;
        if (appliedCoupon) {
          couponSnap = await transaction.get(doc(db, 'coupons', appliedCoupon.id));
        }

        // 2. Validate and calculate
        const itemsToBuy = [];
        
        for (let i = 0; i < productSnaps.length; i++) {
          const pSnap = productSnaps[i];
          if (!pSnap.exists()) {
            throw new Error(`Sản phẩm "${cartItems[i].name}" không còn tồn tại hoặc đã bị xóa.`);
          }
          const pData = pSnap.data();
          const buyQty = cartItems[i].quantity;
          
          // Stock validation
          let newStock = undefined;
          if (pData.stock !== undefined && pData.trackInventory !== false) {
            const currentStock = Number(pData.stock);
            // [UX] Không chặn đặt hàng khi hết tồn kho để tránh mất Sale. 
            // Cửa hàng có thể nhập thêm hàng và giao trễ cho khách.
            newStock = currentStock - buyQty;
          }
          
          // Price validation (use discountPrice if > 0, else basePrice)
          let realPrice = Number(pData.discountPrice);
          if (!realPrice || realPrice <= 0) {
            realPrice = Number(pData.basePrice) || 0;
          }
          
          newSubtotal += realPrice * buyQty;
          
          itemsToBuy.push({
            ref: productRefs[i],
            newStock: newStock,
            id: cartItems[i].id,
            name: pData.title,
            price: realPrice,
            quantity: buyQty,
            image: cartItems[i].image || '',
            weight: Number(pData.weight) || 0,
            variant: cartItems[i].variant || 'Default'
          });
        }

        // Coupon validation
        if (appliedCoupon && couponSnap && couponSnap.exists()) {
          const cData = couponSnap.data();
          if (!cData.active) throw new Error("Mã giảm giá đã bị vô hiệu hóa.");
          if (cData.maxUses > 0 && (cData.usedCount || 0) >= cData.maxUses) throw new Error("Mã giảm giá đã hết lượt sử dụng.");
          if (cData.minOrder > 0 && newSubtotal < cData.minOrder) throw new Error(`Đơn hàng tối thiểu ${Number(cData.minOrder).toLocaleString('vi-VN')}₫ để sử dụng mã này.`);
          if (cData.expiryDate && new Date(cData.expiryDate) < new Date()) throw new Error("Mã giảm giá đã hết hạn.");
          
          if (cData.type === 'percent') realDiscount = Math.round(newSubtotal * cData.value / 100);
          else if (cData.type === 'fixed') realDiscount = Math.min(cData.value, newSubtotal);
          else if (cData.type === 'free_shipping') realDiscount = shippingCost;
        }

        const newTax = newSubtotal * 0.08;
        newTotal = newSubtotal + shippingCost + newTax - realDiscount;

        const shippingAddress = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          phone: formData.phone
        };

        // 3. Writes
        // Disable client-side stock and coupon updates to prevent Firestore Permission Denied errors.
        // Stock management should ideally be handled by a secure backend or webhook (like Dunvex).
        
        const orderDocData = {
          orderNumber,
          userId: user?.uid || 'guest',
          userEmail: user?.email || formData.email,
          userName: user?.name || `${formData.firstName} ${formData.lastName}`,
          items: itemsToBuy.map(({ id, name, price, quantity, image, variant, weight }) => ({
            id, name, price, quantity, image, variant, weight: weight || 0
          })),
          shippingAddress,
          bankTransaction: bankTransactionInfo || null,
          subtotal: newSubtotal,
          shippingCost,
          tax: newTax,
          total: newTotal,
          shippingMethod: formData.shippingMethod,
          paymentMethod: formData.paymentMethod,
          coupon: appliedCoupon ? { code: appliedCoupon.code, type: appliedCoupon.type, value: appliedCoupon.value, discount: realDiscount } : null,
          discount: realDiscount,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(orderRef, orderDocData);

        finalOrderData = {
          orderNumber,
          cartItems: itemsToBuy, // Use items with real prices
          formData,
          total: newTotal,
          shippingAddress
        };
      }); // End transaction

      // Send webhook to Dunvex (non-blocking)
      try {
        if (openClawConfig && openClawConfig.apiUrl && openClawConfig.botApiKey && openClawConfig.ownerId) {
          let base = openClawConfig.apiUrl.replace(/\/api\/products\/?$/, '');
          base = base.replace(/\/+$/, '');
          const webhookUrl = `${base}/api/order-webhook`;

          const webhookItems = finalOrderData.cartItems.map(item => ({
            productId: item.id,
            productName: item.name,
            qty: Number(item.quantity) || 1,
            price: Number(item.price) || 0
          }));

          const webhookBody = {
            ownerId: openClawConfig.ownerId,
            customerName: `${formData.firstName} ${formData.lastName}`.trim(),
            customerPhone: formData.phone || '',
            customerEmail: formData.email || user?.email || '',
            customerAddress: `${formData.address}, ${formData.city}`.trim(),
            items: webhookItems,
            shippingFee: Number(shippingCost) || 0,
            note: `Đơn đặt từ web storefront, Mã đơn: ${orderNumber}`
          };

          fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': openClawConfig.botApiKey
            },
            body: JSON.stringify(webhookBody)
          })
          .then(res => res.json())
          .then(data => {
            console.log('Dunvex webhook response:', data);
          })
          .catch(err => {
            console.error('Dunvex webhook error:', err);
          });
        }
      } catch (webhookErr) {
        console.error('Failed to trigger Dunvex webhook:', webhookErr);
      }

      // Save profile data for future auto-fill if user is logged in
      if (user && user.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            phone: formData.phone,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.error("Error updating user profile:", error);
        }
      }

      // Send emails (non-blocking)
      try {
        const payload = {
          email: formData.email || user?.email,
          orderNumber,
          customerName: `${formData.firstName} ${formData.lastName}`,
          items: finalOrderData.cartItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image || ''
          })),
          total: finalOrderData.total,
          shippingAddress: finalOrderData.shippingAddress,
          paymentMethod: formData.paymentMethod,
          shippingMethod: formData.shippingMethod
        };

        // Email cho khách hàng
        fetch('https://script.google.com/macros/s/AKfycbyMQ8DHAd1yC7IrKJLQB_cBZsJkG3BqymJqhcjfABC4hNpsnZ7oo2u77nxfSWeoMZHl/exec', {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => console.log('Email send (non-critical):', err));

        // Email cho Admin
        const adminDoc = await getDoc(doc(db, 'settings', 'admins'));
        if (adminDoc.exists()) {
          const adminEmails = adminDoc.data().emails || [];
          adminEmails.forEach(adminEmail => {
            fetch('https://script.google.com/macros/s/AKfycbyMQ8DHAd1yC7IrKJLQB_cBZsJkG3BqymJqhcjfABC4hNpsnZ7oo2u77nxfSWeoMZHl/exec', {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...payload,
                email: adminEmail,
                orderNumber: `[ĐƠN HÀNG MỚI] ${orderNumber}`,
              })
            }).catch(e => console.log('Admin Email error:', e));
          });
        }
      } catch (emailErr) {
        console.log('Email error (non-critical):', emailErr);
      }

      if (formData.paymentMethod === 'bank-transfer') {
        setGeneratedOrder(finalOrderData);
        onOrderComplete(finalOrderData);
      } else {
        onOrderComplete(finalOrderData);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert(error.message || 'Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="checkout-page animate-fade-in">
      {/* Mobile Header */}
      <div className="mobile-checkout-header">
        <Link to="/cart" className="back-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', color: '#0F172A', fontWeight: 600, fontSize: '0.9rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </Link>
        <div className="header-info">
          <span className="header-title">THANH TOÁN</span>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37' }}></div>
          <div style={{ width: '16px', height: '1.5px', background: '#e2e8f0' }}></div>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e2e8f0' }}></div>
        </div>
      </div>

      <div className="container">
        <div className="checkout-layout">
          {/* Form Side */}
          <div className="checkout-form-section">
            {/* Desktop-only logo + breadcrumbs */}
            <Link to="/" className="checkout-logo desktop-only" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM7 7H17V9L10 15H17V17H7V15L14 9H7V7Z" fill="#D4AF37"/>
              </svg>
              <span className="logo-text" style={{ color: '#1A2130' }}>ZBUILD</span>
            </Link>
            <div className="desktop-only" style={{ marginBottom: '24px' }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Trở về trang chủ
              </Link>
            </div>

            {/* ========== SECTION 1: CONTACT INFO ========== */}
            <section className="form-block" id="info-section">
              <div className="block-header">
                <span className="block-step">1</span>
                <h3>Thông tin liên hệ</h3>
                {user && <span className="login-link" style={{ fontSize: '0.75rem', color: '#22c55e' }}>✓ Đã đăng nhập</span>}
              </div>
              <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input 
                    type="email" name="email" placeholder="Email" 
                    value={formData.email} onChange={handleInputChange} required
                    style={{ paddingLeft: '42px', ...(formErrors.email ? { borderColor: '#e74c3c' } : {}) }}
                  />
                </div>
                {formErrors.email && <span style={{ color: '#e74c3c', fontSize: '0.78rem', marginTop: '-4px' }}>{formErrors.email}</span>}
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <input 
                    type="tel" name="phone" placeholder="Số điện thoại" 
                    value={formData.phone} onChange={handleInputChange} required
                    style={{ paddingLeft: '42px', ...(formErrors.phone ? { borderColor: '#e74c3c' } : {}) }}
                  />
                </div>
                {formErrors.phone && <span style={{ color: '#e74c3c', fontSize: '0.78rem', marginTop: '-4px' }}>{formErrors.phone}</span>}
              </div>
            </section>

            {/* ========== SECTION 2: ADDRESS ========== */}
            <section className="form-block">
              <div className="block-header">
                <span className="block-step">2</span>
                <h3>Địa chỉ nhận hàng</h3>
              </div>
              <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" name="firstName" placeholder="Họ" className="half" value={formData.firstName} onChange={handleInputChange} />
                  <input type="text" name="lastName" placeholder="Tên" className="half" value={formData.lastName} onChange={handleInputChange} />
                </div>
                <input type="text" name="address" placeholder="Địa chỉ cụ thể (số nhà, tên đường...)" className="full" value={formData.address} onChange={handleInputChange} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" name="city" placeholder="Quận / Huyện" className="half" value={formData.city} onChange={handleInputChange} />
                  <input type="text" name="state" placeholder="Tỉnh / Thành phố" className="half" value={formData.state} onChange={handleInputChange} />
                </div>
              </div>
            </section>

            {/* ========== SECTION 3: SHIPPING ========== */}
            <section className="form-block" id="shipping-section">
              <div className="block-header">
                <span className="block-step">3</span>
                <h3>Phương thức vận chuyển</h3>
              </div>
              <div className="shipping-methods">
                <label className={`method-option ${formData.shippingMethod === 'standard' ? 'active' : ''}`}>
                  <input type="radio" name="shippingMethod" value="standard" checked={formData.shippingMethod === 'standard'} onChange={handleInputChange} />
                  <span className="method-icon">🏭</span>
                  <div className="method-info">
                    <span className="name">Lấy hàng tại kho</span>
                    <span className="desc">Đến kho trực tiếp nhận hàng</span>
                  </div>
                  <span className="price">Miễn phí</span>
                </label>
                <label className={`method-option ${formData.shippingMethod === 'express' ? 'active' : ''}`}>
                  <input type="radio" name="shippingMethod" value="express" checked={formData.shippingMethod === 'express'} onChange={handleInputChange} />
                  <span className="method-icon">🚚</span>
                  <div className="method-info">
                    <span className="name">Giao hàng tận nơi</span>
                    <span className="desc">Vận chuyển đến địa chỉ của bạn</span>
                  </div>
                  <span className="price">{distanceKm !== null ? `${shippingCost.toLocaleString('vi-VN')}₫` : '—'}</span>
                </label>
              </div>
              {formData.shippingMethod === 'express' && (
                <div style={{ marginTop: '12px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <button type="button" onClick={(e) => { e.preventDefault(); handleGetLocation(); }} disabled={isLocating} className="btn-secondary" style={{ margin: 0, width: '100%' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {isLocating ? 'Đang định vị...' : (distanceKm !== null ? '📍 Cập nhật vị trí' : '📍 Lấy vị trí để tính phí')}
                  </button>
                  {distanceKm !== null && (
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div><div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Khoảng cách</div><strong style={{ fontSize: '0.9rem' }}>{distanceKm.toFixed(1)} km</strong></div>
                      <div><div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Trọng lượng</div><strong style={{ fontSize: '0.9rem' }}>{totalWeight} kg</strong></div>
                      <div><div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Phí vận chuyển</div><strong style={{ fontSize: '0.9rem', color: '#E11D48' }}>{shippingCost.toLocaleString('vi-VN')}₫</strong></div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ========== SECTION 4: PAYMENT ========== */}
            <section className="form-block" id="payment-section">
              <div className="block-header">
                <span className="block-step">4</span>
                <h3>Thanh toán</h3>
                <p className="secure-tag" style={{ margin: 0 }}>🔒 Bảo mật SSL</p>
              </div>
              <div className="shipping-methods" style={{ marginBottom: formData.paymentMethod === 'bank-transfer' ? '12px' : '0' }}>
                <label className={`method-option ${formData.paymentMethod === 'bank-transfer' ? 'active' : ''}`}>
                  <input type="radio" name="paymentMethod" value="bank-transfer" checked={formData.paymentMethod === 'bank-transfer'} onChange={handleInputChange} />
                  <span className="method-icon">🏦</span>
                  <div className="method-info">
                    <span className="name">Chuyển khoản ngân hàng</span>
                    <span className="desc">Quét mã VietQR — tự động xác nhận</span>
                  </div>
                </label>
                <label className={`method-option ${formData.paymentMethod === 'cod' ? 'active' : ''}`}>
                  <input type="radio" name="paymentMethod" value="cod" checked={formData.paymentMethod === 'cod'} onChange={handleInputChange} />
                  <span className="method-icon">💵</span>
                  <div className="method-info">
                    <span className="name">Thanh toán khi nhận hàng</span>
                    <span className="desc">Trả tiền mặt khi nhận hàng (COD)</span>
                  </div>
                </label>
              </div>

              {formData.paymentMethod === 'bank-transfer' && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '0.95rem' }}>
                    Tổng cần chuyển: <span style={{ color: '#E11D48', fontSize: '1.2rem' }}>{Number(total).toLocaleString('vi-VN')}₫</span>
                  </div>
                  <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '0.8rem' }}>Nội dung chuyển khoản: <strong>{orderNumber}</strong></p>
                  {shopBankInfo?.bankCode && shopBankInfo?.accountNumber && (
                    <img 
                      src={`https://img.vietqr.io/image/${shopBankInfo.bankCode}-${shopBankInfo.accountNumber}-compact2.png?amount=${total}&addInfo=${orderNumber}&accountName=${encodeURIComponent(shopBankInfo.accountName || '')}`}
                      alt="VietQR" style={{ width: '180px', height: '180px', objectFit: 'contain', margin: '0 auto' }}
                    />
                  )}
                  <div style={{ background: '#fff', borderRadius: '10px', padding: '12px', marginTop: '12px', fontSize: '0.8rem', textAlign: 'left', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#94a3b8' }}>Ngân hàng</span><strong>{shopBankInfo?.bankName}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#94a3b8' }}>Số TK</span><strong>{shopBankInfo?.accountNumber}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Chủ TK</span><strong>{shopBankInfo?.accountName}</strong></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: '#10b981', fontSize: '0.8rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Hệ thống tự động xác nhận sau khi chuyển khoản
                  </div>
                </div>
              )}
            </section>

            {/* Desktop form footer */}
            <div className="form-footer desktop-only">
              <button className="btn-return" onClick={onBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Quay lại giỏ hàng
              </button>
              <button className="btn-primary-action" onClick={handlePlaceOrder} disabled={isSubmitting}>
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đơn hàng'}
              </button>
            </div>
          </div>

          {/* ========== ORDER SUMMARY ========== */}
          <div className="checkout-summary-section">
            <div className="summary-sticky">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0F172A' }}>
                📋 Đơn hàng ({cartItems.length} sản phẩm)
              </h3>
              
              <div className="summary-items">
                {cartItems.map(item => (
                  <div key={item.id} className="summary-item">
                    <div className="img-holder">
                      <img src={item.image} alt={item.name} />
                      <span className="badge">{item.quantity}</span>
                    </div>
                    <div className="item-meta">
                      <span className="name">{item.name}</span>
                      <span className="variant">{Number(item.price).toLocaleString('vi-VN')}₫</span>
                    </div>
                    <span className="price">{Number(item.price * item.quantity).toLocaleString('vi-VN')}₫</span>
                  </div>
                ))}
              </div>

              <div className="discount-code-row">
                {appliedCoupon ? (
                  <div className="applied-coupon">
                    <div className="coupon-tag">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      <span>{appliedCoupon.code}</span>
                      <span className="coupon-discount-label">
                        {appliedCoupon.type === 'percent' ? `-${appliedCoupon.value}%` : appliedCoupon.type === 'free_shipping' ? 'Free Ship' : `-${Number(appliedCoupon.value).toLocaleString('vi-VN')}₫`}
                      </span>
                    </div>
                    <button className="btn-remove-coupon" onClick={handleRemoveCoupon}>✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text" placeholder="Mã giảm giá"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      style={couponError ? { borderColor: '#e74c3c' } : {}}
                    />
                    <button onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                      {couponLoading ? '...' : 'Áp dụng'}
                    </button>
                  </>
                )}
              </div>
              {couponError && <div className="coupon-error">{couponError}</div>}

              <div className="billing-details">
                <div className="line"><span>Tạm tính</span><span>{Number(subtotal).toLocaleString('vi-VN')}₫</span></div>
                <div className="line"><span>Vận chuyển</span><span className={shippingCost === 0 ? 'free' : ''}>{shippingCost === 0 ? 'Miễn phí' : `${Number(shippingCost).toLocaleString('vi-VN')}₫`}</span></div>
                {discount > 0 && (
                  <div className="line discount-line"><span>Giảm giá ({appliedCoupon?.code})</span><span className="discount-value">-{Number(discount).toLocaleString('vi-VN')}₫</span></div>
                )}
                <div className="line total">
                  <span>Tổng cộng</span>
                  <span className="total-price">{Number(total).toLocaleString('vi-VN')}₫</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="mobile-checkout-cta">
        <div className="secure-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          THANH TOÁN BẢO MẬT • SSL 256-BIT
        </div>
        
        {(formData.paymentMethod === 'bank-transfer' && paymentStep === 1 && !pollingTimeout) ? (
          <div className="waiting-payment" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#10B981', fontWeight: '500', background: '#ECFDF5', padding: '14px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
            <div style={{ width: '18px', height: '18px', border: '3px solid #10B981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            Hệ thống đang chờ nhận tiền...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>Tổng thanh toán</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#E11D48' }}>{Number(total).toLocaleString('vi-VN')}₫</span>
            </div>
            <button className="btn-place-order" onClick={paymentStep === 1 ? handlePlaceOrder : () => onOrderComplete(generatedOrder)} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  Đang xử lý...
                </>
              ) : (
                (paymentStep === 1 ? (formData.paymentMethod === 'bank-transfer' ? 'Tôi đã thanh toán xong' : 'Xác nhận đơn hàng') : 'Tiếp tục mua sắm')
              )}
              {!isSubmitting && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Checkout;
