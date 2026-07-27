import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrdersByCustomerId, fetchPaymentsByCustomerId, fetchCustomerByPhone } from '../services/dunvexApi';
import './CustomerDebts.css';

const formatCurrency = (n) => {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('vi-VN');
};

const formatDate = (d) => {
  if (!d) return '';
  const date = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (d) => {
  if (!d) return '';
  const date = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusMap = {
  pending: { label: 'Chờ xác nhận', color: '#F59E0B', bg: '#FEF3C7' },
  confirmed: { label: 'Đã xác nhận', color: '#3B82F6', bg: '#DBEAFE' },
  shipping: { label: 'Đang giao', color: '#8B5CF6', bg: '#EDE9FE' },
  delivered: { label: 'Đã giao', color: '#10B981', bg: '#D1FAE5' },
  cancelled: { label: 'Đã hủy', color: '#EF4444', bg: '#FEE2E2' },
  completed: { label: 'Hoàn thành', color: '#10B981', bg: '#D1FAE5' },
  paid: { label: 'Đã thanh toán', color: '#10B981', bg: '#D1FAE5' },
  partial: { label: 'Thanh toán 1 phần', color: '#F59E0B', bg: '#FEF3C7' },
  unpaid: { label: 'Chưa thanh toán', color: '#EF4444', bg: '#FEE2E2' },
  'Đơn chốt': { label: 'Đơn chốt', color: '#3B82F6', bg: '#DBEAFE' },
  'Đơn nháp': { label: 'Đơn nháp', color: '#9CA3AF', bg: '#F3F4F6' },
};

const getStatusStyle = (s) => statusMap[s] || statusMap['pending'];

const OrderDetailModal = ({ order, onClose }) => {
  const total = Number(order.totalAmount || order.total || 0);
  return (
    <div className="cd-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cd-modal">
        <div className="cd-modal-header">
          <div>
            <h2 className="cd-modal-title">{order.orderNumber || 'Đơn hàng'}</h2>
            <div className="cd-modal-docid">ID đối soát: <code>{order.id || order.orderNumber}</code></div>
            <div className="cd-modal-title-row">
              <span className="cd-modal-status" style={{ color: getStatusStyle(order.status).color, background: getStatusStyle(order.status).bg }}>
                {getStatusStyle(order.status).label}
              </span>
            </div>
            <p className="cd-modal-date">{formatDateTime(order.createdAt)}</p>
          </div>
          <button className="cd-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cd-modal-body">
          <div className="cd-modal-section">
            <h4>📦 Sản phẩm ({(order.items || []).length})</h4>
            <div className="cd-modal-items">
              {(order.items || []).map((item, i) => (
                <div key={i} className="cd-modal-item">
                  <div className="cd-modal-item-main">
                    <span className="cd-modal-item-name">{item.name || item.productName || 'Sản phẩm'}</span>
                    <span className="cd-modal-item-qty">×{item.qty || item.quantity || 1}</span>
                  </div>
                  <div className="cd-modal-item-price">
                    <span>{formatCurrency(item.price || 0)}đ</span>
                    <span className="cd-modal-item-subtotal">= {formatCurrency((item.qty || item.quantity || 1) * (item.price || 0))}đ</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="cd-modal-total-line">
              <span>Tổng cộng</span>
              <span>{formatCurrency(total)}đ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomerDebts = () => {
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e?.preventDefault();
    const phone = searchPhone.trim();
    if (!phone) return;

    setLoading(true);
    setError('');
    setCustomer(null);
    setOrders([]);
    setPayments([]);

    try {
      // B1: Tìm customer theo SĐT
      const cust = await fetchCustomerByPhone(phone);
      if (!cust) {
        setError(`Không tìm thấy khách hàng với SĐT "${phone}".`);
        setLoading(false);
        setSearched(true);
        return;
      }
      setCustomer(cust);

      // B2: Lấy orders + payments theo customerId
      const [ordersData, paymentsData] = await Promise.all([
        fetchOrdersByCustomerId(cust.id).catch(() => []),
        fetchPaymentsByCustomerId(cust.id).catch(() => []),
      ]);

      const sorted = (ordersData || []).sort((a, b) => {
        const dA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
        const dB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
        return dB - dA;
      });

      setOrders(sorted);
      setPayments(paymentsData || []);
    } catch (err) {
      console.error('Lỗi tải công nợ:', err);
      setError('Không thể kết nối đến hệ thống. Thử lại sau.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const totalOrderAmount = orders.reduce((sum, o) => sum + (Number(o.totalAmount || o.total || 0)), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount || 0)), 0);
  const remainingDebt = Math.max(0, totalOrderAmount - totalPaid);
  const totalOrders = orders.length;
  const unpaidOrders = orders.filter(o => {
    const orderPayments = payments.filter(p => p.orderId === o.id || p.orderNumber === (o.orderNumber || o.id));
    const paid = orderPayments.reduce((s, p) => s + (Number(p.amount || 0)), 0);
    return paid < Number(o.totalAmount || o.total || 0);
  }).length;

  const getOrderPaidAmount = (orderId) => {
    return payments.filter(p => p.orderId === orderId || p.orderNumber === orderId)
      .reduce((sum, p) => sum + (Number(p.amount || 0)), 0);
  };

  const getOrderRemaining = (order) => {
    const orderId = order.id || order.orderNumber;
    const paid = getOrderPaidAmount(orderId);
    return Math.max(0, Number(order.totalAmount || order.total || 0) - paid);
  };

  return (
    <div className="customer-debts-page">
      <div className="cd-header">
        <button className="cd-back-btn" onClick={() => navigate('/')}>← Quay lại</button>
        <div>
          <h1 className="cd-title">📋 Tra cứu công nợ</h1>
          <p className="cd-subtitle">Nhập số điện thoại khách hàng để xem công nợ</p>
        </div>
      </div>

      <form className="cd-search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="cd-search-input"
          placeholder="Nhập số điện thoại khách hàng..."
          value={searchPhone}
          onChange={e => setSearchPhone(e.target.value)}
        />
        <button className="cd-search-btn" type="submit" disabled={loading || !searchPhone.trim()}>
          {loading ? '🔍 Đang tìm...' : '🔍 Tra cứu'}
        </button>
      </form>

      {error && (
        <div className="cd-error">
          <div className="cd-error-icon">⚠️</div>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="cd-loading">
          <div className="cd-spinner" />
          <p>Đang tải...</p>
        </div>
      )}

      {!loading && searched && orders.length === 0 && !error && (
        <div className="cd-empty">
          <div className="cd-empty-icon">📭</div>
          <p>Không tìm thấy đơn hàng nào cho khách hàng này.</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <>
          {customer && (
            <div className="cd-customer-label">
              👤 Khách hàng: <strong>{customer.name || 'N/A'}</strong>
              {customer.phone && <> — {customer.phone}</>}
              <span className="cd-customer-id">ID: <code>{customer.id}</code></span>
            </div>
          )}
          <div className="cd-summary-grid">
            <div className="cd-summary-card cd-card-total">
              <div className="cd-card-label">Tổng đơn hàng</div>
              <div className="cd-card-value">{formatCurrency(totalOrderAmount)}đ</div>
              <div className="cd-card-sub">{totalOrders} đơn hàng</div>
            </div>
            <div className="cd-summary-card cd-card-paid">
              <div className="cd-card-label">Đã thanh toán</div>
              <div className="cd-card-value">{formatCurrency(totalPaid)}đ</div>
              <div className="cd-card-sub">{payments.length} giao dịch</div>
            </div>
            <div className="cd-summary-card cd-card-due">
              <div className="cd-card-label">Còn nợ</div>
              <div className="cd-card-value">{formatCurrency(remainingDebt)}đ</div>
              <div className="cd-card-sub">{unpaidOrders} đơn chưa tất toán</div>
            </div>
          </div>

          <div className="cd-section-title">📦 Đơn hàng ({orders.length})</div>
          <div className="cd-orders-list">
            {orders.map((order, idx) => {
              const orderId = order.id || order.orderNumber || `#${idx}`;
              const paidAmount = getOrderPaidAmount(orderId);
              const remaining = getOrderRemaining(order);
              const total = Number(order.totalAmount || order.total || 0);

              return (
                <div key={orderId} className="cd-order-card" onClick={() => setSelectedOrder(order)}>
                  <div className="cd-order-main-info">
                    <div>
                      <div className="cd-order-id">
                        {order.orderNumber || orderId}
                        <span className="cd-order-date">{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="cd-order-docid">ID: <code>{order.id || order.orderNumber}</code></div>
                      <div className="cd-order-meta">
                        <span>{(order.items || []).length} sản phẩm</span>
                        <span className="cd-order-status" style={{ color: getStatusStyle(order.status).color, background: getStatusStyle(order.status).bg }}>
                          {getStatusStyle(order.status).label}
                        </span>
                      </div>
                    </div>
                    <div className="cd-order-amounts">
                      <div className="cd-order-total">{formatCurrency(total)}đ</div>
                      {remaining > 0 && total > 0 && (
                        <div className="cd-order-remaining">Còn {formatCurrency(remaining)}đ</div>
                      )}
                      {paidAmount >= total && total > 0 && (
                        <div className="cd-order-paid">✓ Đã thanh toán</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {payments.length > 0 && (
            <>
              <div className="cd-section-title">💰 Lịch sử thanh toán ({payments.length})</div>
              <div className="cd-payments-list">
                <div className="cd-payments-header">
                  <span>Thời gian</span>
                  <span>Số tiền</span>
                  <span>Phương thức</span>
                  <span>Ghi chú</span>
                </div>
                {[...payments].sort((a, b) => {
                  const dA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
                  const dB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
                  return dB - dA;
                }).map((p, i) => (
                  <div key={i} className="cd-payments-row">
                    <span className="cd-payment-date">{formatDateTime(p.createdAt)}</span>
                    <span className="cd-payment-amount">{formatCurrency(p.amount)}đ</span>
                    <span>{p.paymentMethod || 'Chuyển khoản'}</span>
                    <span className="cd-payment-note">{p.note || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
};

export default CustomerDebts;
