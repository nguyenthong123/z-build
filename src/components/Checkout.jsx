import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Checkout.css';

const Checkout = ({ onBack, cartItems, onOrderComplete, user }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [step] = useState(1);
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

  const [paymentStep, setPaymentStep] = useState(1); // 1: Form, 2: QR Code
  const [generatedOrder, setGeneratedOrder] = useState(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // Shop's Bank Info (Configurable)
  const [shopBankInfo, setShopBankInfo] = useState({
    bankCode: 'vcb',
    bankName: 'Vietcombank',
    accountNumber: '1014845876', 
    accountName: 'NGUYEN BA TRUNG'
  });

  useEffect(() => {
    const fetchBankInfo = async () => {
      try {
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().bankInfo) {
          setShopBankInfo(docSnap.data().bankInfo);
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
  const shippingCost = formData.shippingMethod === 'express' ? 50000 : 0;
  const tax = subtotal * 0.08;

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
  const total = subtotal + shippingCost + tax - discount;

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
    if (!validateForm()) return;
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const orderNumber = 'ZB' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
      
      const orderDoc = {
        orderNumber,
        userId: user?.uid || 'guest',
        userEmail: user?.email || formData.email,
        userName: user?.name || `${formData.firstName} ${formData.lastName}`,
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || '',
          variant: item.variant || 'Default'
        })),
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          phone: formData.phone
        },
        subtotal,
        shippingCost,
        tax,
        total,
        shippingMethod: formData.shippingMethod,
        paymentMethod: formData.paymentMethod,
        coupon: appliedCoupon ? { code: appliedCoupon.code, type: appliedCoupon.type, value: appliedCoupon.value, discount } : null,
        discount,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderDoc);

      // Increment coupon usedCount
      if (appliedCoupon) {
        try {
          await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
            usedCount: (appliedCoupon.usedCount || 0) + 1
          });
        } catch (e) { console.log('Coupon usage update error:', e); }
      }

      // Gửi email xác nhận (non-blocking, không ảnh hưởng đặt hàng)
      try {
        const payload = {
          email: formData.email || user?.email,
          orderNumber,
          customerName: `${formData.firstName} ${formData.lastName}`,
          items: cartItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image || ''
          })),
          total,
          shippingAddress: orderDoc.shippingAddress,
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

      const finalOrder = {
        orderNumber,
        cartItems: [...cartItems],
        formData,
        total,
        shippingAddress: orderDoc.shippingAddress
      };

      if (formData.paymentMethod === 'bank-transfer') {
        setGeneratedOrder(finalOrder);
        setPaymentStep(2);
        setIsSubmitting(false);
      } else {
        onOrderComplete(finalOrder);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="checkout-page animate-fade-in">
      {/* Mobile Header */}
      <div className="mobile-checkout-header">
        <Link to="/" className="back-btn" style={{ textDecoration: 'none', display: 'flex' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </Link>
        <div className="header-info">
          <span className="header-title">THANH TOÁN</span>
          <span className="step-count">{paymentStep === 2 ? 'Bước 2: Quét mã QR' : `Bước ${step} trên 2`}</span>
        </div>
        <div style={{ width: 24 }}></div>
      </div>

      <div className="container">
        <div className="checkout-layout">
          {/* Form Side */}
          <div className="checkout-form-section">
            <Link to="/" className="checkout-logo desktop-only" style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM7 7H17V9L10 15H17V17H7V15L14 9H7V7Z" fill="#D4AF37"/>
              </svg>
              <span className="logo-text" style={{ color: '#1A2130' }}>ZBUILD</span>
            </Link>
            <div className="desktop-only" style={{ marginBottom: '24px' }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'color 0.2s', padding: '6px 0' }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#1A2130'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#64748B'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Trở về trang chủ
              </Link>
            </div>

            <nav className="checkout-breadcrumbs desktop-only">
              <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={onBack} onMouseOver={e => e.currentTarget.style.color = '#1A2130'} onMouseOut={e => e.currentTarget.style.color = ''}>Giỏ hàng</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span className="active" style={{ cursor: 'pointer' }} onClick={() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Thông tin</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => document.getElementById('shipping-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} onMouseOver={e => e.currentTarget.style.color = '#1A2130'} onMouseOut={e => e.currentTarget.style.color = ''}>Vận chuyển</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} onMouseOver={e => e.currentTarget.style.color = '#1A2130'} onMouseOut={e => e.currentTarget.style.color = ''}>Thanh toán</span>
            </nav>

            <section className="form-block" id="info-section">
              <div className="block-header">
                <h3>Thông tin liên hệ</h3>
                <p className="login-link">Đã có tài khoản? <a href="#">Đăng nhập</a></p>
              </div>
              <div className="input-group">
                <input 
                  type="email" 
                  name="email" 
                  placeholder="Email hoặc số điện thoại" 
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  style={formErrors.email ? { borderColor: '#e74c3c' } : {}}
                />
                {formErrors.email && <span style={{ color: '#e74c3c', fontSize: '0.8rem' }}>{formErrors.email}</span>}
                <div className="checkbox-row">
                  <input type="checkbox" id="newsletter" />
                  <label htmlFor="newsletter">Cập nhật tin tức và ưu đãi độc quyền cho tôi</label>
                </div>
              </div>
            </section>

            <section className="form-block">
              <div className="block-header">
                <h3>Địa chỉ nhận hàng</h3>
              </div>
              <div className="form-grid">
                <input 
                  type="text" 
                  name="firstName" 
                  placeholder="Họ" 
                  className="half"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
                <input 
                  type="text" 
                  name="lastName" 
                  placeholder="Tên" 
                  className="half"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
                <input 
                  type="text" 
                  name="address" 
                  placeholder="Địa chỉ" 
                  className="full"
                  value={formData.address}
                  onChange={handleInputChange}
                />
                <input 
                  type="text" 
                  name="city" 
                  placeholder="Thành phố" 
                  className="half"
                  value={formData.city}
                  onChange={handleInputChange}
                />
                <input 
                  type="text" 
                  name="state" 
                  placeholder="Tỉnh / Thành" 
                  className="half"
                  value={formData.state}
                  onChange={handleInputChange}
                />
                <input 
                  type="text" 
                  name="zipCode" 
                  placeholder="Mã bưu điện" 
                  className="half"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                />
                <select 
                  name="country" 
                  className="half"
                  value={formData.country}
                  onChange={handleInputChange}
                >
                  <option>Vietnam</option>
                  <option>United States</option>
                  <option>Canada</option>
                </select>
                <input 
                  type="tel" 
                  name="phone" 
                  placeholder="Số điện thoại" 
                  className="full"
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={formErrors.phone ? { borderColor: '#e74c3c' } : {}}
                />
                {formErrors.phone && <span style={{ color: '#e74c3c', fontSize: '0.8rem', display: 'block', marginTop: '-8px', marginBottom: '8px' }}>{formErrors.phone}</span>}
              </div>
            </section>

            <section className="form-block" id="shipping-section">
              <div className="block-header">
                <h3>Phương thức vận chuyển</h3>
              </div>
              <div className="shipping-methods">
                <label className={`method-option ${formData.shippingMethod === 'standard' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="standard"
                    checked={formData.shippingMethod === 'standard'}
                    onChange={handleInputChange}
                  />
                  <div className="method-info">
                    <span className="name">Giao hàng tiêu chuẩn</span>
                    <span className="desc">2-3 ngày làm việc</span>
                  </div>
                  <span className="price">Miễn phí</span>
                </label>
                <label className={`method-option ${formData.shippingMethod === 'express' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="express"
                    checked={formData.shippingMethod === 'express'}
                    onChange={handleInputChange}
                  />
                  <div className="method-info">
                    <span className="name">Giao hàng nhanh</span>
                    <span className="desc">Giao hàng ngày mai</span>
                  </div>
                  <span className="price">50.000₫</span>
                </label>
              </div>
            </section>

            <section className="form-block" id="payment-section">
              <div className="block-header">
                <h3>Thanh toán</h3>
                <p className="secure-tag">Tất cả các giao dịch đều được bảo mật và mã hóa.</p>
              </div>
              <div className="payment-methods">
                <div className="payment-tabs">
                  <button 
                    className={`tab ${formData.paymentMethod === 'bank-transfer' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, paymentMethod: 'bank-transfer'})}
                  >
                    Chuyển khoản
                  </button>
                  <button 
                    className={`tab ${formData.paymentMethod === 'credit-card' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, paymentMethod: 'credit-card'})}
                  >
                    Credit Card
                  </button>
                  <button 
                    className={`tab ${formData.paymentMethod === 'paypal' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, paymentMethod: 'paypal'})}
                  >
                    PayPal
                  </button>
                </div>
                
                {formData.paymentMethod === 'bank-transfer' && (
                  <div className="card-fields animate-fade-in">
                    <div className="qr-hint-box" style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Quét mã VietQR nhanh chóng sau khi xác nhận đơn hàng.
                    </div>
                  </div>
                )}
                
                {formData.paymentMethod === 'credit-card' && (
                  <div className="card-fields animate-fade-in">
                    <input 
                      type="text" 
                      name="cardNumber" 
                      placeholder="Số thẻ" 
                      className="full"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                    />
                    <div className="row">
                      <input 
                        type="text" 
                        name="cardExpiry" 
                        placeholder="Ngày hết hạn (MM/YY)" 
                        className="half"
                        value={formData.cardExpiry}
                        onChange={handleInputChange}
                      />
                      <input 
                        type="text" 
                        name="cardCvv" 
                        placeholder="Mã bảo mật" 
                        className="half"
                        value={formData.cardCvv}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {paymentStep === 1 ? (
              <div className="form-footer desktop-only">
                <button className="btn-return" onClick={onBack}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Quay lại giỏ hàng
                </button>
                <button className="btn-primary-action" onClick={handlePlaceOrder} disabled={isSubmitting}>
                  {isSubmitting ? 'Đang xử lý...' : (formData.paymentMethod === 'bank-transfer' ? 'Tiếp tục thanh toán' : 'Hoàn tất đặt hàng')}
                </button>
              </div>
            ) : (
              <div className="qr-payment-step animate-fade-in" style={{ marginTop: '20px' }}>
                <div className="qr-container">
                  <h3>Mã QR Thanh Toán</h3>
                  <p className="qr-instructions">
                    Vui lòng quét mã bên dưới bằng ứng dụng ngân hàng của bạn để thanh toán <b>{Number(total).toLocaleString('vi-VN')}₫</b>
                  </p>
                  
                  <div className="qr-image-wrapper">
                    <img 
                      src={`https://img.vietqr.io/image/${shopBankInfo.bankCode}-${shopBankInfo.accountNumber}-compact.png?amount=${total}&addInfo=${generatedOrder?.orderNumber}&accountName=${encodeURIComponent(shopBankInfo.accountName)}`} 
                      alt="VietQR Code" 
                      className="qr-image"
                    />
                  </div>

                  <div className="bank-info-box">
                    <div className="bank-info-item">
                      <span className="label">Ngân hàng:</span>
                      <span className="value">{shopBankInfo.bankName}</span>
                    </div>
                    <div className="bank-info-item">
                      <span className="label">Số tài khoản:</span>
                      <span className="value">{shopBankInfo.accountNumber}</span>
                    </div>
                    <div className="bank-info-item">
                      <span className="label">Chủ tài khoản:</span>
                      <span className="value">{shopBankInfo.accountName}</span>
                    </div>
                    <div className="bank-info-item">
                      <span className="label">Số tiền:</span>
                      <span className="value">{Number(total).toLocaleString('vi-VN')}₫</span>
                    </div>
                    <div className="bank-info-item">
                      <span className="label">Nội dung:</span>
                      <span className="value">{generatedOrder?.orderNumber}</span>
                    </div>
                    <div className="copy-hint">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                      Nội dung chuyển khoản đã được tạo tự động
                    </div>
                  </div>

                  <button 
                    className="btn-confirm-payment" 
                    onClick={() => onOrderComplete(generatedOrder)}
                  >
                    Tôi đã thanh toán xong
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary Side */}
          <div className="checkout-summary-section">
            <div className="summary-sticky">
              <div className="summary-items">
                {cartItems.map(item => (
                  <div key={item.id} className="summary-item">
                    <div className="img-holder">
                      <img src={item.image} alt={item.name} />
                      <span className="badge">{item.quantity}</span>
                    </div>
                    <div className="item-meta">
                      <span className="name">{item.name}</span>
                      <span className="variant">{item.variant}</span>
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
                      type="text"
                      placeholder="Nhập mã giảm giá"
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
                <div className="line">
                  <span>Tạm tính</span>
                  <span>{Number(subtotal).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="line">
                  <span>Vận chuyển</span>
                  <span className={shippingCost === 0 ? 'free' : ''}>{shippingCost === 0 ? 'Miễn phí' : `${Number(shippingCost).toLocaleString('vi-VN')}₫`}</span>
                </div>
                <div className="line">
                  <span>Thuế ước tính</span>
                  <span>{Number(tax).toLocaleString('vi-VN')}₫</span>
                </div>
                {discount > 0 && (
                  <div className="line discount-line">
                    <span>Giảm giá ({appliedCoupon?.code})</span>
                    <span className="discount-value">-{Number(discount).toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
                <div className="line total">
                  <span>Tổng cộng</span>
                  <span className="total-price">
                    <span className="currency">VNĐ</span> {Number(total).toLocaleString('vi-VN')}₫
                  </span>
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
          THANH TOÁN BẢO MẬT SSL 256-BIT
        </div>
        <button className="btn-place-order" onClick={paymentStep === 1 ? handlePlaceOrder : () => onOrderComplete(generatedOrder)} disabled={isSubmitting}>
          {isSubmitting ? 'ĐANG XỬ LÝ...' : (paymentStep === 1 ? (formData.paymentMethod === 'bank-transfer' ? 'TIẾP TỤC THANH TOÁN' : 'ĐẶT HÀNG') : 'TÔI ĐÃ THANH TOÁN')}
          {!isSubmitting && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        </button>
      </div>
    </div>
  );
};

export default Checkout;
