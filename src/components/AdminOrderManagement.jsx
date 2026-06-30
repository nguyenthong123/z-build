import React, { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import './AdminOrderManagement.css';

import AdminHeader from './AdminHeader';

const AdminOrderManagement = ({ onBack, onViewOrderDetail }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, return_requested: 0, returned: 0, revenue: 0 });

  useEffect(() => {
    fetchOrders();
  }, []);

  const ITEMS_PER_PAGE = 20;
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
      const snapshot = await getDocs(q);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);

      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
      }));
      setOrders(data);
      
      // Tính stats (Dựa trên dữ liệu đang hiển thị)
      const s = { total: data.length, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, return_requested: 0, returned: 0, revenue: 0 };
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

  const loadMoreOrders = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'orders'), 
        orderBy('createdAt', 'desc'), 
        startAfter(lastVisible),
        limit(ITEMS_PER_PAGE)
      );
      const snapshot = await getDocs(q);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);

      const newData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
      }));
      
      const updatedOrders = [...orders, ...newData];
      setOrders(updatedOrders);
      
      // Recalc stats
      const s = { total: updatedOrders.length, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, return_requested: 0, returned: 0, revenue: 0 };
      updatedOrders.forEach(o => {
        if (s[o.status] !== undefined) s[o.status]++;
        if (o.status === 'delivered') s.revenue += (o.total || 0);
      });
      setStats(s);
    } catch (err) {
      console.error('Error loading more orders:', err);
    } finally {
      setLoadingMore(false);
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
      const s = { total: updated.length, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, return_requested: 0, returned: 0, revenue: 0 };
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
    const flow = { pending: 'confirmed', confirmed: 'shipping', shipping: 'delivered', return_requested: 'returned' };
    return flow[current] || null;
  };

  const getStatusLabel = (s) => {
    const map = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy', return_requested: 'Yêu cầu trả hàng', returned: 'Đã hoàn hàng' };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    const map = { pending: '#FFB800', confirmed: '#2196F3', shipping: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336', return_requested: '#E65100', returned: '#D32F2F' };
    return map[s] || '#888';
  };

  const getNextActionLabel = (s) => {
    const map = { pending: 'Xác nhận', confirmed: 'Giao hàng', shipping: 'Đã giao', return_requested: 'Xác nhận thu hồi' };
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
    return false;
  };

  const handleSyncBank = async () => {
    setIsSyncing(true);
    try {
      const docSnap = await getDoc(doc(db, 'storeSettings', 'main'));
      let apiUrl = '';
      if (docSnap.exists() && docSnap.data().googleSheetUrl) {
        apiUrl = docSnap.data().googleSheetUrl;
      }
      if (!apiUrl) {
        apiUrl = 'https://script.google.com/macros/s/AKfycbwKEEu9Yapfdpt_MpCneQvR4BRORrIK9NHv6EJYoJbtH9ocOrxeh-1tOzI3lmFLaT41/exec';
      }

      const res = await fetch(apiUrl);
      const dataObj = await res.json();
      const transactions = dataObj.data || [];

      let syncedCount = 0;

      for (const order of orders) {
        if (order.status === 'pending' && order.paymentMethod === 'bank-transfer') {
          const match = transactions.find(t => {
            const amountStr = t['Phát sinh'] || '';
            const desc = (t['Nội dung'] || '').toUpperCase();
            const orderNum = (order.orderNumber || '').toUpperCase();
            
            const parsedAmount = parseInt(amountStr.replace(/[^\d]/g, ''), 10);
            return amountStr.includes('+') && parsedAmount === order.total && orderNum && desc.includes(orderNum);
          });

          if (match) {
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
              status: 'processing',
              paymentStatus: 'paid',
              updatedAt: serverTimestamp()
            });
            syncedCount++;
          }
        }
      }

      if (syncedCount > 0) {
        alert(`Đã đồng bộ thành công! Tìm thấy và tự động duyệt ${syncedCount} đơn hàng chuyển khoản.`);
        fetchOrders(true);
      } else {
        alert('Không tìm thấy giao dịch ngân hàng nào khớp với các đơn hàng đang chờ duyệt.');
      }
    } catch (err) {
      console.error('Lỗi đồng bộ:', err);
      alert('Có lỗi khi đồng bộ giao dịch ngân hàng: ' + err.message);
    }
    setIsSyncing(false);
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
    { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled },
    { key: 'return_requested', label: 'Yêu cầu trả hàng', count: stats.return_requested },
    { key: 'returned', label: 'Đã trả hàng', count: stats.returned }
  ];



  return (
    <div className="admin-product-page">

      <div className="admin-main-content">
        <AdminHeader
          title="Quản lý đơn hàng"
          actions={
            <>
              <div className="search-box" style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '220px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="text"
                  placeholder="Tìm đơn hàng..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ fontSize: '12px', border: 'none', outline: 'none', background: 'transparent', flex: 1 }}
                />
              </div>
              <button className="home-icon-btn" onClick={() => window.location.href = '/'} title="Về trang chủ" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px', height: '32px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
              <button className="export-btn" onClick={exportToCSV} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px', height: '32px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Xuất CSV
              </button>
              <button 
                onClick={handleSyncBank}
                disabled={isSyncing}
                style={{ background: '#1a1a2e', border: 'none', borderRadius: '8px', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isSyncing ? 'rotating' : ''}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.65 1.64"/></svg>
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ NH'}
              </button>
            </>
          }
        />

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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="aom-status-badge" style={{ backgroundColor: getStatusColor(order.status) + '18', color: getStatusColor(order.status), borderColor: getStatusColor(order.status), alignSelf: 'flex-start' }}>
                              {getStatusLabel(order.status)}
                            </span>
                            {order.status === 'return_requested' && order.returnReason && (
                              <span style={{ fontSize: '11px', color: '#E65100', background: '#FFF3E0', padding: '2px 6px', borderRadius: '4px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.returnReason}>
                                Lý do: {order.returnReason}
                              </span>
                            )}
                          </div>
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
                    <div className="aom-mc-header" style={order.status === 'return_requested' ? { flexWrap: 'wrap', gap: '8px' } : {}}>
                      <div className="aom-mc-left">
                        <span className="aom-mc-id">#{order.orderNumber || order.id.substring(0, 8)}</span>
                        <span className="aom-mc-date">{formatDate(order.createdAt)}</span>
                      </div>
                      <span className="aom-status-badge" style={{ backgroundColor: getStatusColor(order.status) + '18', color: getStatusColor(order.status), borderColor: getStatusColor(order.status) }}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.status === 'return_requested' && order.returnReason && (
                        <div style={{ width: '100%', fontSize: '12px', color: '#E65100', background: '#FFF3E0', padding: '4px 8px', borderRadius: '4px' }}>
                          <strong>Lý do trả hàng:</strong> {order.returnReason}
                        </div>
                      )}
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

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button 
                    onClick={loadMoreOrders}
                    disabled={loadingMore}
                    style={{
                      padding: '10px 24px', background: 'var(--adv-gold)', color: 'white',
                      border: 'none', borderRadius: '8px', fontWeight: 600, cursor: loadingMore ? 'not-allowed' : 'pointer',
                      opacity: loadingMore ? 0.7 : 1
                    }}
                  >
                    {loadingMore ? 'Đang tải...' : 'Xem thêm đơn hàng'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderManagement;
