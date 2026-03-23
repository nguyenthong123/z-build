import React from 'react';
import './OrderConfirmation.css';

const OrderConfirmation = ({ onContinueShopping, orderDetails }) => {
  const { orderNumber, cartItems, total, shippingAddress } = orderDetails;
  
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0.08;

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };

  return (
    <div className="confirmation-page animate-fade-in">
      <div className="container">
        <div className="confirmation-content">
          <div className="success-hero">
            <div className="check-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1>Cảm ơn bạn đã đặt hàng!</h1>
            <p className="order-number">Đơn hàng <strong>#{orderNumber}</strong></p>
            
            <div className="delivery-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span>Dự kiến giao hàng: <strong>{estimatedDelivery.toLocaleDateString('vi-VN', dateOptions)}</strong></span>
            </div>
          </div>

          <div className="confirmation-grid">
            {/* Order Summary */}
            <div className="order-details-card">
              <h3>Chi tiết đơn hàng</h3>
              <div className="items-list">
                {cartItems.map(item => (
                  <div key={item.id} className="confirm-item">
                    <div className="item-img">
                      <img src={item.image} alt={item.name} />
                      <span className="qty-badge">{item.quantity}</span>
                    </div>
                    <div className="item-info">
                      <span className="name">{item.name}</span>
                      <span className="variant">{item.variant}</span>
                    </div>
                    <span className="price">{Number(item.price * item.quantity).toLocaleString('vi-VN')}₫</span>
                  </div>
                ))}
              </div>

              <div className="pricing-split">
                <div className="row">
                  <span>Tạm tính</span>
                  <span>{Number(subtotal).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="row">
                  <span>Vận chuyển</span>
                  <span className="free">Miễn phí</span>
                </div>
                <div className="row">
                  <span>Thuế Ước tính</span>
                  <span>{Number(tax).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="row total">
                  <span>Tổng cộng</span>
                  <span className="final-price">VNĐ {Number(total || (subtotal + tax)).toLocaleString('vi-VN')}₫</span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="customer-info-section">
              <div className="info-block">
                <h4>Chi tiết giao hàng</h4>
                <p>{shippingAddress.firstName} {shippingAddress.lastName}</p>
                <p>{shippingAddress.address}</p>
                <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                <p>{shippingAddress.country}</p>
              </div>
              <div className="info-block">
                <h4>Phương thức thanh toán</h4>
                <div className="payment-summary">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <span>{orderDetails?.formData?.paymentMethod === 'bank-transfer' ? 'Chuyển khoản ngân hàng' : orderDetails?.formData?.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Thẻ tín dụng / Ghi nợ'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="confirmation-footer">
            <button className="btn-continue-shopping" onClick={onContinueShopping}>
              Tiếp tục mua sắm
            </button>
            <p className="help-text">Cần hỗ trợ? <a href="#">Liên hệ với đội ngũ hỗ trợ của chúng tôi</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
