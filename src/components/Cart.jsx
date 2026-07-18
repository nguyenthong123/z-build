import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './Cart.css';

const CartItemRow = ({ item, updateQuantity, updateVariant, removeItem }) => {
  const [inputValue, setInputValue] = useState(String(item.quantity).replace('.', ','));

  useEffect(() => {
    // eslint-disable-next-line
    setInputValue(prev => {
      const currentParsed = parseFloat(prev.replace(',', '.'));
      if (!isNaN(currentParsed) && currentParsed !== item.quantity && !prev.endsWith(',')) {
        return String(item.quantity).replace('.', ',');
      }
      return prev;
    });
  }, [item.quantity]);

  const handleChange = (e) => {
    let valStr = e.target.value.replace(/[^0-9.,]/g, '').replace('.', ',');
    const parts = valStr.split(',');
    if (parts.length > 2) valStr = parts[0] + ',' + parts.slice(1).join('');
    setInputValue(valStr);

    const parsed = parseFloat(valStr.replace(',', '.'));
    if (!isNaN(parsed) && valStr !== '' && !valStr.endsWith(',')) {
      updateQuantity(item.id, parsed, true);
    }
  };

  const handleBlur = () => {
    let parsed = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) parsed = 1;
    setInputValue(String(parsed).replace('.', ','));
    updateQuantity(item.id, parsed, true);
  };

  return (
    <div className="cart-item">
      <div className="item-main">
        <div className="item-img">
          <img src={item.image} alt={item.name} />
        </div>
        <div className="item-info">
          <h3>{item.name}</h3>
          <span className="item-variant">{item.variant || item.specs || ''}</span>
          
          {/* Ô nhập kích thước / mét dài / mét vuông */}
          <div className="item-size-input">
            <span className="size-label">K.thước / Mét:</span>
            <input
              type="text"
              className="size-field"
              placeholder={item.unit ? `Nhập số ${item.unit}` : 'VD: 2.5m, 3m²...'}
              value={item.variant || ''}
              onChange={(e) => updateVariant(item.id, e.target.value)}
            />
          </div>
          
          {/* Mobile Price */}
          <span className="item-price-mobile">{Number(item.price).toLocaleString('vi-VN')}₫</span>
          
          {/* Mobile Quantity Selector with +/- buttons */}
          <div className="item-qty-mobile">
            <span className="qty-label">Số lượng:</span>
            <div className="qty-control-row">
              <button
                type="button"
                className="qty-btn"
                onClick={() => {
                  const newQty = Math.max(0.1, item.quantity - 1);
                  updateQuantity(item.id, newQty, true);
                }}
              >–</button>
              <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="qty-input"
              />
              <button
                type="button"
                className="qty-btn"
                onClick={() => {
                  updateQuantity(item.id, item.quantity + 1, true);
                }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Columns */}
      <div className="desktop-only item-price">{Number(item.price).toLocaleString('vi-VN')}₫</div>
      <div className="desktop-only item-qty">
        <div className="qty-control" style={{ background: 'transparent', padding: 0 }}>
          <input 
            type="text" 
            value={inputValue} 
            onChange={handleChange}
            onBlur={handleBlur}
            style={{ width: '100px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', fontSize: '14px' }}
          />
        </div>
      </div>
      <div className="desktop-only item-total">{Number(item.price * item.quantity).toLocaleString('vi-VN')}₫</div>

      <button className="remove-item" onClick={() => removeItem(item.id)} title="Xóa sản phẩm">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        <span className="desktop-only">Xóa</span>
      </button>
    </div>
  );
};

const Cart = ({ onBack, onCheckout, cartItems, updateQuantity, updateVariant, removeItem, clearCart }) => {
  const clearAll = () => {
    if(window.confirm('Xóa tất cả sản phẩm khỏi giỏ hàng?')) {
      clearCart();
    }
  };

  const [shippingSettings, setShippingSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().shippingSettings) {
          setShippingSettings(docSnap.data().shippingSettings);
        }
      } catch (error) {
        console.error("Error fetching shipping settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const subtotal = Math.round(cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0));
  const shipping = 0; // Temp display value
  const total = subtotal + shipping;

  if (cartItems.length === 0) {
    return (
      <div className="cart-page empty-cart-view animate-fade-in">
        <div className="container">
          <div className="empty-content">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>Có vẻ như bạn chưa thêm bất kỳ sản phẩm nào vào giỏ hàng.</p>
            <button className="btn-continue" onClick={onBack}>Tiếp tục mua sắm</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page animate-fade-in">
      {/* Mobile Special Header */}
      <div className="mobile-cart-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span className="header-title">Giỏ hàng</span>
        <button className="clear-btn" onClick={clearAll}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </div>

      <div className="container">
        <h1 className="cart-title desktop-only">Giỏ hàng mua sắm</h1>

        <div className="cart-layout">
          {/* Items List */}
          <div className="cart-items-section">
            <div className="desktop-only cart-labels">
              <span>SẢN PHẨM</span>
              <span>GIÁ</span>
              <span>SỐ LƯỢNG</span>
              <span>TỔNG CỘNG</span>
            </div>
            
            <div className="items-list">
              {cartItems.map(item => (
                <CartItemRow 
                  key={item.id} 
                  item={item} 
                  updateQuantity={updateQuantity}
                  updateVariant={updateVariant}
                  removeItem={removeItem} 
                />
              ))}
            </div>

            <div className="cart-footer-actions desktop-only">
              <button className="btn-secondary" onClick={onBack}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Tiếp tục mua sắm
              </button>
              <button className="btn-text" onClick={clearAll}>Xóa tất cả</button>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="order-summary-section">
            <div className="summary-card">
              <h2>Tóm tắt đơn hàng</h2>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>Tạm tính</span>
                  <span>{Number(subtotal).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="summary-row">
                  <span>Phí vận chuyển</span>
                  <span style={{ fontSize: '13px', color: '#64748B' }}>Chưa tính (Xem lúc thanh toán)</span>
                </div>

              </div>
              
              <div className="summary-total">
                <span>Tổng cộng</span>
                <span>{Number(total).toLocaleString('vi-VN')}₫</span>
              </div>

              {shippingSettings && shippingSettings.shippingDiscountRules && shippingSettings.shippingDiscountRules.length > 0 && (
                <div className="shipping-promo-box" style={{ marginTop: '20px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    Ưu đãi vận chuyển
                  </h4>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '13px', color: '#15803D' }}>
                    {[...shippingSettings.shippingDiscountRules]
                      .sort((a, b) => (parseFloat(b.minOrderValue) || 0) - (parseFloat(a.minOrderValue) || 0))
                      .map((rule, idx) => {
                        const minVal = parseFloat(rule.minOrderValue) || 0;
                        const pct = parseFloat(rule.discountPercent) || 0;
                        const isAchieved = subtotal >= minVal;
                        
                        let displayVal = `${(minVal / 1000000).toLocaleString('vi-VN')}tr`;
                        if (minVal < 1000000) {
                          displayVal = `${(minVal / 1000).toLocaleString('vi-VN')}k`;
                        }
                        
                        return (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', opacity: isAchieved ? 1 : 0.7 }}>
                            <span>
                              {isAchieved ? <svg width="14" height="14" style={{marginRight:'4px', display:'inline-block', verticalAlign:'text-bottom', color:'#059669'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : "• "} 
                              Đơn từ {displayVal}:
                            </span>
                            <strong style={{ background: isAchieved ? '#DCFCE7' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>Giảm {pct}%</strong>
                          </li>
                        );
                      })}
                  </ul>
                  <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#166534', fontStyle: 'italic', borderTop: '1px dashed #BBF7D0', paddingTop: '10px' }}>
                    * Phí giao hàng chi tiết sẽ được tính dựa trên khoảng cách tại bước thanh toán.
                  </div>
                </div>
              )}


              <button className="btn-checkout" onClick={onCheckout}>
                Thanh toán ngay
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>

              <div className="trust-badge-cart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Đảm bảo thanh toán an toàn
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Checkout Bar */}
      <div className="mobile-cart-bottom">
        <div className="mobile-total-info">
          <span className="label">Tổng giá trị</span>
          <span className="value">{Number(total).toLocaleString('vi-VN')}₫</span>
        </div>
        <button className="btn-checkout-mobile" onClick={onCheckout}>
          Thanh toán
        </button>
      </div>
    </div>
  );
};

export default Cart;
