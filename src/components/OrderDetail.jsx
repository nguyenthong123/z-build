import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './OrderDetail.css';

const OrderDetail = ({ order, onBack, onCancelSuccess, onEditOrder, onReturnSuccess }) => {
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  if (!order) {
    return (
      <div className="order-detail-page">
        <div className="container">
          <p>Không tìm thấy đơn hàng.</p>
          <button onClick={onBack}>Quay lại</button>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'confirmed': return 'Đã xác nhận';
      case 'shipping': return 'Đang vận chuyển';
      case 'delivered': return 'Đã giao';
      case 'cancelled': return 'Đã hủy';
      case 'return_requested': return 'Yêu cầu trả hàng';
      case 'returned': return 'Đã trả hàng';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return '#4CAF50';
      case 'pending':
      case 'confirmed': return '#FF9800';
      case 'shipping': return '#2196F3';
      case 'cancelled': 
      case 'return_requested':
      case 'returned': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusStep = (status) => {
    switch (status) {
      case 'pending': return 1;
      case 'confirmed': return 2;
      case 'shipping': return 3;
      case 'delivered': return 4;
      case 'cancelled': return 0;
      default: return 0;
    }
  };

  const handleCancelOrder = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp()
      });
      if (onCancelSuccess) onCancelSuccess(order.id);
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Có lỗi xảy ra khi hủy đơn hàng. Vui lòng thử lại!');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleEditOrder = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp()
      });
      if (onCancelSuccess) onCancelSuccess(order.id);
      if (onEditOrder) onEditOrder(order.items || []);
    } catch (error) {
      console.error('Error editing order:', error);
      alert('Có lỗi xảy ra khi chuyển sang chế độ sửa đơn.');
      setCancelling(false);
    }
  };

  const handleReturnOrder = async () => {
    if (!returnReason.trim()) {
      alert('Vui lòng nhập lý do trả hàng');
      return;
    }
    setReturning(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'return_requested',
        returnReason: returnReason.trim(),
        updatedAt: serverTimestamp(),
      });
      if (onReturnSuccess) onReturnSuccess(order.id, returnReason.trim());
    } catch (error) {
      console.error('Error returning order:', error);
      alert('Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại!');
    } finally {
      setReturning(false);
      setShowReturnModal(false);
    }
  };

  // Check if within 1 hour
  let isWithinOneHour = false;
  if (order.createdAt) {
    const orderTime = order.createdAt?.toDate ? order.createdAt.toDate().getTime() : order.createdAt;
    const now = new Date().getTime();
    if (now - orderTime <= 60 * 60 * 1000) {
      isWithinOneHour = true;
    }
  }

  const subtotal = (order.items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const statusStep = getStatusStep(order.status);
  const steps = [
    { label: 'Đặt hàng', icon: '📋' },
    { label: 'Xác nhận', icon: '✅' },
    { label: 'Vận chuyển', icon: '🚚' },
    { label: 'Đã giao', icon: '📦' }
  ];

  return (
    <div className="order-detail-page animate-fade-in">
      <div className="container">
        {/* Header */}
        <div className="od-header">
          <button className="od-back-btn" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Quay lại
          </button>
          <div className="od-header-info">
            <h1>Đơn hàng #{order.orderNumber}</h1>
            <span className="od-date">{order.date}</span>
          </div>
          <div className="od-status-badge" style={{ backgroundColor: `${getStatusColor(order.status)}15`, color: getStatusColor(order.status), borderColor: getStatusColor(order.status) }}>
            {getStatusLabel(order.status)}
          </div>
        </div>

        {/* Progress Steps - only show if not cancelled */}
        {order.status !== 'cancelled' && (
          <div className="od-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${((statusStep - 1) / 3) * 100}%` }}></div>
            </div>
            <div className="progress-steps">
              {steps.map((step, idx) => (
                <div key={idx} className={`progress-step ${idx + 1 <= statusStep ? 'completed' : ''} ${idx + 1 === statusStep ? 'current' : ''}`}>
                  <div className="step-circle">{idx + 1 <= statusStep ? step.icon : (idx + 1)}</div>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancelled notice */}
        {order.status === 'cancelled' && (
          <div className="od-cancelled-notice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>Đơn hàng này đã bị hủy</span>
          </div>
        )}

        {/* Return requested notice */}
        {order.status === 'return_requested' && (
          <div className="od-cancelled-notice" style={{ background: '#FFF3E0', color: '#E65100', borderColor: '#FFE0B2' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2"><path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 1.63-7.5l-2.26 2.26"/></svg>
            <span>Đang yêu cầu trả hàng/Hoàn tiền. Lý do: {order.returnReason}</span>
          </div>
        )}

        {order.status === 'returned' && (
          <div className="od-cancelled-notice" style={{ background: '#FFEBEE', color: '#D32F2F', borderColor: '#FFCDD2' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span>Đơn hàng đã được trả lại.</span>
          </div>
        )}

        <div className="od-grid">
          {/* Order Items */}
          <div className="od-card od-items-card">
            <h3>Sản phẩm đã đặt ({order.items?.length || 0})</h3>
            <div className="od-items-list">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="od-item">
                  <div className="od-item-img">
                    <img src={item.image || 'https://placehold.co/80'} alt={item.name} />
                  </div>
                  <div className="od-item-info">
                    <h4>{item.name}</h4>
                    <span className="od-item-variant">{item.variant || 'Default'}</span>
                    <span className="od-item-qty">x{item.quantity}</span>
                  </div>
                  <div className="od-item-price">
                    {Number(item.price * item.quantity).toLocaleString('vi-VN')}₫
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="od-pricing">
              <div className="od-price-row">
                <span>Tạm tính</span>
                <span>{Number(subtotal).toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="od-price-row">
                <span>Phí vận chuyển</span>
                {order.shippingCost > 0 ? (
                  <span>{Number(order.shippingCost).toLocaleString('vi-VN')}₫</span>
                ) : (
                  <span className="free-text">Miễn phí</span>
                )}
              </div>
              {order.tax > 0 && (
                <div className="od-price-row">
                  <span>Thuế (8% VAT)</span>
                  <span>{Number(order.tax).toLocaleString('vi-VN')}₫</span>
                </div>
              )}

              <div className="od-price-row od-total">
                <span>Tổng cộng</span>
                <span>{Number(order.total).toLocaleString('vi-VN')}₫</span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="od-right-col">
            {/* Shipping Info */}
            <div className="od-card">
              <h3>Thông tin giao hàng</h3>
              <div className="od-info-content">
                <div className="od-info-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>{order.shippingAddress?.firstName} {order.shippingAddress?.lastName}</span>
                </div>
                <div className="od-info-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>{order.shippingAddress?.phone || 'Chưa cung cấp'}</span>
                </div>
                <div className="od-info-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div>
                    <span>{order.shippingAddress?.address}</span>
                    <span className="od-address-sub">{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="od-card">
              <h3>Thanh toán</h3>
              <div className="od-info-content">
                <div className="od-info-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <span>
                    {order.paymentMethod === 'bank-transfer' ? 'Chuyển khoản ngân hàng' : 
                     order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : 
                     'Thẻ tín dụng / Ghi nợ'}
                  </span>
                </div>
                <div className="od-info-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <span>
                    {order.shippingMethod === 'express' ? 'Giao nhanh (1-2 ngày)' : 'Giao tiêu chuẩn (3-5 ngày)'}
                  </span>
                </div>
                {order.bankTransaction && (
                  <div style={{ marginTop: '15px', padding: '12px', background: '#F1F5F9', borderRadius: '8px', fontSize: '0.9rem', color: '#334155' }}>
                    <div style={{ fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>Thông tin chuyển khoản ghi nhận:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px' }}>
                      <strong>Ngày:</strong> <span>{order.bankTransaction['Ngày']}</span>
                      <strong>Mã GD:</strong> <span>{order.bankTransaction['Transaction ID']}</span>
                      <strong>Số tiền:</strong> <span style={{ color: '#10B981', fontWeight: 'bold' }}>{order.bankTransaction['Phát sinh']}</span>
                      <strong>Nội dung:</strong> <span>{order.bankTransaction['Nội dung']}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cancel/Edit Button */}
            {order.status === 'pending' && isWithinOneHour && (
              <div className="od-card od-cancel-card">
                {!showCancelConfirm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="od-cancel-btn" onClick={() => setShowCancelConfirm(true)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      Hủy đơn hàng
                    </button>
                    <button className="btn-secondary" onClick={handleEditOrder} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Sửa đơn hàng
                    </button>
                  </div>
                ) : (
                  <div className="od-cancel-confirm">
                    <p>Bạn có chắc chắn muốn hủy đơn hàng này?</p>
                    <div className="od-cancel-actions">
                      <button className="od-cancel-no" onClick={() => setShowCancelConfirm(false)}>Không, giữ đơn</button>
                      <button className="od-cancel-yes" onClick={handleCancelOrder} disabled={cancelling}>
                        {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {order.status === 'pending' && !isWithinOneHour && (
              <div className="od-card" style={{ padding: '15px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#64748B' }}>
                <p style={{ margin: 0 }}>Đã quá 60 phút kể từ khi đặt hàng. Không thể tự hủy hoặc sửa đơn. Vui lòng liên hệ hỗ trợ nếu cần.</p>
              </div>
            )}

            {/* Return Order */}
            {order.status === 'delivered' && (
              <div className="od-card od-cancel-card">
                <button className="od-cancel-btn" onClick={() => setShowReturnModal(true)} style={{ background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}><path d="M21.5 2v6h-6M2.13 15.57a9 9 0 1 0 1.63-7.5l-2.26 2.26"/></svg>
                  Yêu cầu Trả hàng / Hoàn tiền
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReturnModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Lý do trả hàng</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Vui lòng cho chúng tôi biết lý do bạn muốn trả hàng (nhầm sản phẩm, lỗi, v.v.)
            </p>
            <textarea 
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Nhập lý do..."
              style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px', fontSize: '14px', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowReturnModal(false)} disabled={returning}>Hủy bỏ</button>
              <button className="btn-primary" onClick={handleReturnOrder} disabled={returning}>
                {returning ? 'Đang gửi...' : 'Xác nhận trả hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
