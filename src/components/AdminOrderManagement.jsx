import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from './AdminSidebar';
import './AdminOrderManagement.css';

const AdminOrderManagement = ({ onBack, onViewOrderDetail }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
      }));
      setOrders(data);
      
      // Tính stats
      const s = { total: data.length, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 };
      data.forEach(o => {
        if (s[o.status] !== undefined) s[o.status]++;
        if (o.status === 'delivered') s.revenue += (o.total || 0);
      });
      setStats(s);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Tạo thông báo cho user
      const order = orders.find(o => o.id === orderId);
      if (order && order.userId) {
        await addDoc(collection(db, 'notifications'), {
          userId: order.userId,
          title: 'Cập nhật đơn hàng',
          message: `Đơn hàng #${order.orderNumber || orderId.substring(0, 8)} của bạn đã chuyển sang trạng thái: ${getStatusLabel(newStatus)}.`,
          type: 'order_update',
          link: `/order/${orderId}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      // Recalc stats
      const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      const s = { total: updated.length, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 };
      updated.forEach(o => {
        if (s[o.status] !== undefined) s[o.status]++;
        if (o.status === 'delivered') s.revenue += (o.total || 0);
      });
      setStats(s);
    } catch (err) {
      console.error('Error updating:', err);
      alert('Lỗi cập nhật trạng thái!');
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextStatus = (current) => {
    const flow = { pending: 'confirmed', confirmed: 'shipping', shipping: 'delivered' };
    return flow[current] || null;
  };

  const getStatusLabel = (s) => {
    const map = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    const map = { pending: '#FFB800', confirmed: '#2196F3', shipping: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336' };
    return map[s] || '#888';
  };

  const getNextActionLabel = (s) => {
    const map = { pending: 'Xác nhận', confirmed: 'Giao hàng', shipping: 'Đã giao' };
    return map[s] || null;
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

  const filterByDate = (order) => {
    if (dateFilter === 'all') return true;
    const now = new Date();
    const orderDate = order.createdAt;
    if (dateFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    }
    if (dateFilter === 'month') {
      return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredOrders = orders.filter(o => {
    const matchTab = activeTab === 'all' || o.status === activeTab;
    const matchSearch = searchQuery === '' ||
      (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchDate = filterByDate(o);
    return matchTab && matchSearch && matchDate;
  });

  const toggleSelectOrder = (id) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const bulkUpdateStatus = async (newStatus) => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`Cập nhật ${selectedOrders.length} đơn hàng sang "${getStatusLabel(newStatus)}"?`)) return;
    for (const id of selectedOrders) {
      await updateOrderStatus(id, newStatus);
    }
    setSelectedOrders([]);
  };

  const exportToCSV = () => {
    const headers = ['Mã đơn', 'Khách hàng', 'Email', 'SĐT', 'Tổng tiền', 'Trạng thái', 'Ngày đặt', 'Sản phẩm'];
    const rows = filteredOrders.map(o => [
      o.orderNumber || o.id,
      o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`,
      o.userEmail || '',
      o.shippingAddress?.phone || '',
      o.total || 0,
      getStatusLabel(o.status),
      formatDate(o.createdAt),
      (o.items || []).map(i => `${i.name} x${i.quantity}`).join('; ')
    ]);
    
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donhang_zbuild_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusTabs = [
    { key: 'all', label: 'Tất cả', count: stats.total },
    { key: 'pending', label: 'Chờ xác nhận', count: stats.pending },
    { key: 'confirmed', label: 'Đã xác nhận', count: stats.confirmed },
    { key: 'shipping', label: 'Đang giao', count: stats.shipping },
    { key: 'delivered', label: 'Đã giao', count: stats.delivered },
    { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled }
  ];

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="orders" />

      <div className="admin-main-content">
        <header className={`admin-content-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Đơn hàng</span></nav>

          <div className="header-main-row">
            <div className="title-group">
              <h1>Quản lý đơn hàng</h1>
              <p className="description">Theo dõi và xử lý tất cả đơn hàng của khách.</p>
            </div>
            <div className="header-actions-group">
              <div className="search-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="text"
                  placeholder="Tìm mã đơn, khách hàng..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="btn-group">
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                <button className="export-btn" onClick={exportToCSV}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  <span className="desktop-only">Xuất CSV</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="aom-stats">
          <div className="aom-stat-card aom-stat-revenue">
            <div className="aom-stat-icon">💰</div>
            <div className="aom-stat-info">
              <span className="aom-stat-value">{formatCurrency(stats.revenue)}</span>
              <span className="aom-stat-label">Doanh thu (đã giao)</span>
            </div>
          </div>
          <div className="aom-stat-card">
            <div className="aom-stat-icon">📦</div>
            <div className="aom-stat-info">
              <span className="aom-stat-value">{stats.total}</span>
              <span className="aom-stat-label">Tổng đơn</span>
            </div>
          </div>
          <div className="aom-stat-card">
            <div className="aom-stat-icon">⏳</div>
            <div className="aom-stat-info">
              <span className="aom-stat-value">{stats.pending}</span>
              <span className="aom-stat-label">Chờ xử lý</span>
            </div>
          </div>
          <div className="aom-stat-card">
            <div className="aom-stat-icon">🚚</div>
            <div className="aom-stat-info">
              <span className="aom-stat-value">{stats.shipping}</span>
              <span className="aom-stat-label">Đang giao</span>
            </div>
          </div>
        </div>

        <div className="admin-content-body">
          {/* Filter Tabs + Date */}
          <div className="aom-toolbar">
            <div className="aom-tabs">
              {statusTabs.map(tab => (
                <button
                  key={tab.key}
                  className={`aom-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tab.count > 0 && <span className="aom-tab-count">{tab.count}</span>}
                </button>
              ))}
            </div>
            <div className="aom-date-filter">
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày qua</option>
                <option value="month">Tháng này</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedOrders.length > 0 && (
            <div className="aom-bulk-bar">
              <span>Đã chọn <strong>{selectedOrders.length}</strong> đơn hàng</span>
              <div className="aom-bulk-actions">
                <button onClick={() => bulkUpdateStatus('confirmed')} className="aom-bulk-btn confirm">Xác nhận</button>
                <button onClick={() => bulkUpdateStatus('shipping')} className="aom-bulk-btn ship">Giao hàng</button>
                <button onClick={() => bulkUpdateStatus('delivered')} className="aom-bulk-btn deliver">Đã giao</button>
                <button onClick={() => setSelectedOrders([])} className="aom-bulk-btn cancel">Bỏ chọn</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-container">Đang tải đơn hàng...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="aom-empty">
              <div className="aom-empty-icon">📭</div>
              <h3>Không có đơn hàng nào</h3>
              <p>Thay đổi bộ lọc để xem đơn hàng khác</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="table-responsive desktop-only">
                <table className="admin-table aom-table">
                  <thead>
                    <tr>
                      <th className="th-check">
                        <input type="checkbox" checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onChange={toggleSelectAll} />
                      </th>
                      <th>Mã đơn hàng</th>
                      <th>Khách hàng</th>
                      <th>Sản phẩm</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Ngày đặt</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id} className={selectedOrders.includes(order.id) ? 'selected' : ''}>
                        <td className="td-check">
                          <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelectOrder(order.id)} />
                        </td>
                        <td>
                          <span className="aom-order-id" onClick={() => onViewOrderDetail && onViewOrderDetail(order)}>
                            #{order.orderNumber || order.id.substring(0, 8)}
                          </span>
                        </td>
                        <td>
                          <div className="aom-customer">
                            <strong>{order.userName || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`}</strong>
                            <span>{order.userEmail}</span>
                          </div>
                        </td>
                        <td>
                          <div className="aom-items-preview">
                            {(order.items || []).slice(0, 2).map((item, i) => (
                              <span key={i} className="aom-item-tag">{item.name} ×{item.quantity}</span>
                            ))}
                            {(order.items || []).length > 2 && <span className="aom-item-more">+{order.items.length - 2}</span>}
                          </div>
                        </td>
                        <td className="price-text">{formatCurrency(order.total)}</td>
                        <td>
                          <span className="aom-status-badge" style={{ backgroundColor: getStatusColor(order.status) + '18', color: getStatusColor(order.status), borderColor: getStatusColor(order.status) }}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="aom-date">{formatDate(order.createdAt)}</td>
                        <td className="text-right">
                          <div className="aom-actions">
                            {getNextStatus(order.status) && (
                              <button
                                className="aom-action-btn primary"
                                onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                                disabled={updatingId === order.id}
                                title={getNextActionLabel(order.status)}
                              >
                                {updatingId === order.id ? '...' : getNextActionLabel(order.status)}
                              </button>
                            )}
                            <button className="aom-action-btn view" onClick={() => onViewOrderDetail && onViewOrderDetail(order)} title="Xem chi tiết">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="mobile-only aom-mobile-list">
                {filteredOrders.map(order => (
                  <div className="aom-mobile-card" key={order.id} onClick={() => onViewOrderDetail && onViewOrderDetail(order)}>
                    <div className="aom-mc-header">
                      <div className="aom-mc-left">
                        <span className="aom-mc-id">#{order.orderNumber || order.id.substring(0, 8)}</span>
                        <span className="aom-mc-date">{formatDate(order.createdAt)}</span>
                      </div>
                      <span className="aom-status-badge" style={{ backgroundColor: getStatusColor(order.status) + '18', color: getStatusColor(order.status), borderColor: getStatusColor(order.status) }}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="aom-mc-body">
                      <div className="aom-mc-customer">
                        <strong>{order.userName || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`}</strong>
                        <span>{(order.items || []).length} sản phẩm</span>
                      </div>
                      <span className="aom-mc-total">{formatCurrency(order.total)}</span>
                    </div>
                    {getNextStatus(order.status) && (
                      <div className="aom-mc-actions">
                        <button
                          className="aom-action-btn primary full"
                          onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, getNextStatus(order.status)); }}
                          disabled={updatingId === order.id}
                        >
                          {updatingId === order.id ? 'Đang xử lý...' : getNextActionLabel(order.status)}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderManagement;
