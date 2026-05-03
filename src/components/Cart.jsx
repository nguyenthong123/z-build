import React from 'react';
import './Cart.css';

const Cart = ({ onBack, onCheckout, cartItems, updateQuantity, removeItem, clearCart }) => {
  const clearAll = () => {
    if(window.confirm('Xóa tất cả sản phẩm khỏi giỏ hàng?')) {
      clearCart();
    }
  };

  const subtotal = Math.round(cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0));
  const shipping = 0; // Free shipping
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;

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
                <div key={item.id} className="cart-item">
                  <div className="item-main">
                    <div className="item-img">
                      <img src={item.image} alt={item.name} />
                    </div>
                    <div className="item-info">
                      <h3>{item.name}</h3>
                      <span className="item-variant">{item.variant}</span>
                      {/* Mobile Price */}
                      <span className="item-price-mobile">{Number(item.price).toLocaleString('vi-VN')}₫</span>
                      
                      {/* Mobile Quantity Selector inside info for mobile layout */}
                      <div className="item-qty-mobile">
                         <div className="qty-control">
                            <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                          </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Columns */}
                  <div className="desktop-only item-price">{Number(item.price).toLocaleString('vi-VN')}₫</div>
                  <div className="desktop-only item-qty">
                    <div className="qty-control">
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                  </div>
                  <div className="desktop-only item-total">{Number(item.price * item.quantity).toLocaleString('vi-VN')}₫</div>

                  <button className="remove-item" onClick={() => removeItem(item.id)} title="Xóa sản phẩm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                    <span className="desktop-only">Xóa</span>
                  </button>
                </div>
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
                  <span className="free">MIỄN PHÍ</span>
                </div>
                <div className="summary-row">
                  <span>Thuế Ước tính</span>
                  <span>{Number(tax).toLocaleString('vi-VN')}₫</span>
                </div>
              </div>
              
              <div className="summary-total">
                <span>Tổng cộng</span>
                <span>{Number(total).toLocaleString('vi-VN')}₫</span>
              </div>


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
