import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './OrderHistory.css';
import AccountSidebar from './AccountSidebar';

const OrderHistory = ({ user, onBack, onViewDetails, onNavigate, onLogout }) => {
  const [activeTab, setActiveTab] = useState('Tất cả đơn hàng');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const orderData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            orderNumber: data.orderNumber || doc.id,
            date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
            status: data.status || 'pending',
            total: data.total || 0,
            itemCount: data.items?.length || 0,
            items: (data.items || []).map(item => ({
              name: item.name,
              image: item.image || 'https://placehold.co/200',
              price: item.price,
              quantity: item.quantity
            })),
            shippingAddress: data.shippingAddress || {},
            paymentMethod: data.paymentMethod || 'N/A',
            shippingMethod: data.shippingMethod || 'standard',
            createdAt: data.createdAt
          };
        });
        setOrders(orderData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'confirmed': return 'Đã xác nhận';
      case 'shipping': return 'Đang vận chuyển';
      case 'delivered': return 'Đã giao';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'Tất cả đơn hàng' || 
                      (activeTab === 'Đang xử lý' && (order.status === 'pending' || order.status === 'confirmed' || order.status === 'shipping')) ||
                      (activeTab === 'Đã hoàn thành' && order.status === 'delivered') ||
                      (activeTab === 'Đã hủy' && order.status === 'cancelled');
    const matchesSearch = (order.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return '#4CAF50';
      case 'pending':
      case 'confirmed': return '#FF9800';
      case 'shipping': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  return (
    <div className="order-history-page">
      <div className="order-history-container">
        {/* Desktop/Tablet Sidebar */}
        <AccountSidebar user={user} activeView="order-history" onViewChange={onNavigate} onLogout={onLogout} />

        {/* Main Content */}
        <div className="order-history-content">
          <header className="content-header">
            <div className="header-mobile">
              <button className="back-btn" onClick={onBack}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <h2>Lịch sử đơn hàng</h2>
            </div>
            
            <div className="header-desktop-row">
              <div className="title-section">
                <h1>Lịch sử đơn hàng</h1>
                <p>Theo dõi, quản lý và tải xuống hóa đơn cho tất cả các giao dịch mua hàng của bạn.</p>
              </div>
              <div className="search-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm đơn hàng..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-tabs">
              {['Tất cả đơn hàng', 'Đang xử lý', 'Đã hoàn thành', 'Đã hủy'].map(tab => (
                <button 
                  key={tab} 
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>

          <div className="orders-list">
            {loading ? (
              <div className="empty-orders">
                <div style={{ fontSize: '1.1rem', color: '#888' }}>Đang tải đơn hàng...</div>
              </div>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-card-main">
                    <div className="order-thumbnail">
                      <img src={order.items[0]?.image || 'https://placehold.co/200'} alt={order.items[0]?.name || 'Sản phẩm'} />
                    </div>
                    
                    <div className="order-info">
                      <div className="status-row">
                        <span className="status-label" style={{ backgroundColor: `${getStatusColor(order.status)}15`, color: getStatusColor(order.status) }}>
                          {getStatusLabel(order.status).toUpperCase()}
                        </span>
                        <span className="order-date">{order.date}</span>
                      </div>
                      <h3 className="order-id">Đơn hàng #{order.orderNumber}</h3>
                      <p className="order-item-summary">
                        {order.items[0]?.name || 'Sản phẩm'} {order.itemCount > 1 && `& ${order.itemCount - 1} sản phẩm khác`}
                      </p>
                      
                      <div className="order-milestone">
                        {order.status === 'delivered' ? (
                          <div className="milestone-text">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={getStatusColor(order.status)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>Đã giao hàng thành công</span>
                          </div>
                        ) : order.status === 'cancelled' ? (
                          <div className="milestone-text">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={getStatusColor(order.status)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            <span>Đơn hàng đã bị hủy</span>
                          </div>
                        ) : (
                          <div className="milestone-text">
                            <div className="pulse-dot" style={{ backgroundColor: getStatusColor(order.status) }}></div>
                            <span>{order.status === 'pending' ? 'Đang chờ xác nhận' : order.status === 'confirmed' ? 'Đã xác nhận, đang chuẩn bị' : 'Đang trên đường giao'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="order-actions-desktop">
                      <div className="order-price">{Number(order.total).toLocaleString('vi-VN')}₫</div>
                      <div className="action-btns">
                        {order.status === 'delivered' && <button className="invoice-btn">Hóa đơn</button>}
                        <button className="details-btn" onClick={() => onViewDetails(order)}>
                          Xem chi tiết
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="order-card-footer-mobile">
                    <div className="total-group">
                      <span className="total-label">Tổng tiền</span>
                      <span className="total-value">{Number(order.total).toLocaleString('vi-VN')}₫</span>
                    </div>
                    <button className="details-btn-mobile" onClick={() => onViewDetails(order)}>
                      Chi tiết đơn hàng
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-orders">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <p>{!user ? 'Vui lòng đăng nhập để xem lịch sử đơn hàng.' : 'Bạn chưa có đơn hàng nào. Hãy bắt đầu mua sắm!'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHistory;
