import React, { useState, useEffect } from 'react';
import { 
  apiGetCustomers, 
  apiGetOrders, 
  apiSaveCustomer, 
  apiDeleteCustomer, 
  apiDunvexSyncCustomers 
} from '../services/sqliteApi';
import './AdminCustomerManagement.css';

// Màu sắc theo loại khách hàng
const TYPE_COLORS = {
  'Admin':       { color: '#E53935', bg: '#E5393518' },
  'Thầu Thợ':   { color: '#1565C0', bg: '#1565C018' },
  'Chủ nhà':    { color: '#2E7D32', bg: '#2E7D3218' },
  'Cửa Hàng':   { color: '#F57F17', bg: '#F57F1718' },
  'Khách web':  { color: '#6A1B9A', bg: '#6A1B9A18' },
  'Khách hàng': { color: '#6A1B9A', bg: '#6A1B9A18' },
  'default':    { color: '#546E7A', bg: '#546E7A18' },
};

const getTypeStyle = (type) => TYPE_COLORS[type] || TYPE_COLORS['default'];

const AdminCustomerManagement = ({ onBack }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [adminEmails] = useState(['nbt1024@gmail.com']);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomers = async (admins = adminEmails) => {
    setLoading(true);
    try {
      const ordersData = await apiGetOrders();
      const syncedCustomers = await apiGetCustomers();

      // Helper: determine customer type
      const resolveType = (email, dunvexType) => {
        if (email && admins.some(a => a.toLowerCase().trim() === email.toLowerCase().trim())) return 'Admin';
        if (dunvexType) return dunvexType;
        if (email && email !== 'unknown') return 'Khách hàng';
        return 'Khách vãng lai';
      };

      // Aggregate by email from orders
      const customerMap = {};
      ordersData.forEach(o => {
        const email = o.userEmail || 'unknown';
        if (!customerMap[email]) {
          customerMap[email] = {
            email,
            name: o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`.trim() || 'Khách vãng lai',
            phone: o.shippingAddress?.phone || '',
            orders: [],
            totalSpent: 0,
            firstOrder: o.createdAt,
            lastOrder: o.createdAt,
            address: o.shippingAddress,
            dunvexType: ''
          };
        }
        customerMap[email].orders.push(o);
        if (o.status !== 'cancelled') customerMap[email].totalSpent += (o.total || 0);
        if (o.createdAt < customerMap[email].firstOrder) customerMap[email].firstOrder = o.createdAt;
        if (o.createdAt > customerMap[email].lastOrder) customerMap[email].lastOrder = o.createdAt;
        if (!customerMap[email].name || customerMap[email].name === 'Khách vãng lai') {
          const name = o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`.trim();
          if (name) customerMap[email].name = name;
        }
        if (!customerMap[email].phone && o.shippingAddress?.phone) customerMap[email].phone = o.shippingAddress.phone;
      });

      // Merge with synced customers from Dunvex
      syncedCustomers.forEach(sc => {
        const email = sc.email || `dunvex_${sc.id}`;
        if (!customerMap[email]) {
          customerMap[email] = {
            id: sc.id,
            email: sc.email || '',
            name: sc.name || 'Khách hàng từ Dunvex',
            phone: sc.phone || '',
            orders: [],
            totalSpent: 0,
            firstOrder: null,
            lastOrder: null,
            address: { street: sc.address || '' },
            dunvexType: sc.type || ''
          };
        } else {
          if (!customerMap[email].id) customerMap[email].id = sc.id;
          if (!customerMap[email].dunvexType) customerMap[email].dunvexType = sc.type || '';
          if (!customerMap[email].name || customerMap[email].name === 'Khách vãng lai') customerMap[email].name = sc.name;
          if (!customerMap[email].phone) customerMap[email].phone = sc.phone;
        }
      });

      // Build final list with type
      const customerList = Object.values(customerMap).map(c => ({
        ...c,
        customerType: resolveType(c.email, c.dunvexType),
        orderCount: c.orders.length
      }));

      customerList.sort((a, b) => b.totalSpent - a.totalSpent);
      setCustomers(customerList);
      setStats({ total: customerList.length });
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromDunvex = async () => {
    if (!window.confirm("Bắt đầu đồng bộ khách hàng từ phần mềm Dunvex vào SQLite?")) return;
    
    setSyncing(true);
    try {
      const res = await apiDunvexSyncCustomers();
      alert(`Đồng bộ thành công! Thêm mới: ${res.created || 0}, Cập nhật: ${res.updated || 0} khách hàng.`);
      await fetchCustomers();
    } catch (err) {
      console.error('Error syncing customers:', err);
      alert("Đồng bộ thất bại: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteCustomer = async (c) => {
    if (!c.id) {
      alert("Khách hàng này chưa có ID trong SQLite để xóa.");
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa khách hàng "${c.name}" khỏi SQLite?`)) return;
    try {
      await apiDeleteCustomer(c.id);
      alert("Đã xóa khách hàng thành công!");
      if (selectedCustomer?.email === c.email) setSelectedCustomer(null);
      await fetchCustomers();
    } catch (err) {
      alert("Lỗi khi xóa khách hàng: " + err.message);
    }
  };

  const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';
  const formatDate = (date) => {
    if (!date) return '—';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const getStatusLabel = (s) => {
    const map = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    const map = { pending: '#FFB800', confirmed: '#2196F3', shipping: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336' };
    return map[s] || '#888';
  };

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

  const filteredCustomers = customers.filter(c => {
    const matchSearch = searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || '').includes(searchQuery);
    const matchType = typeFilter === 'all' || c.customerType === typeFilter;
    return matchSearch && matchType;
  });

  // Unique types for filter buttons
  const allTypes = [...new Set(customers.map(c => c.customerType))].filter(Boolean);

  return (
    <div className="admin-product-page">

      <div className="admin-main-content">
        <header className={`admin-content-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Khách hàng</span></nav>
          <div className="header-main-row">
            <div className="title-group">
              <h1>Quản lý khách hàng</h1>
              <p className="description">Xem thông tin và phân hạng khách hàng.</p>
            </div>
            <div className="header-actions-group">
              <div className="search-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" placeholder="Tìm khách hàng..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="btn-group">
                <button 
                  className={`admin-btn primary ${syncing ? 'loading' : ''}`}
                  onClick={handleSyncFromDunvex}
                  disabled={syncing}
                >
                  {syncing ? 'Đang đồng bộ...' : '🔄 Đồng bộ từ Dunvex'}
                </button>
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Type Stats */}
        <div className="acm-tier-stats">
          <div className="acm-tier-card total" onClick={() => setTypeFilter('all')} style={{ cursor: 'pointer', outline: typeFilter === 'all' ? '2px solid #1a73e8' : 'none', outlineOffset: '2px' }}>
            <span className="acm-tier-icon">👥</span>
            <span className="acm-tier-value">{stats.total}</span>
            <span className="acm-tier-label">Tất cả</span>
          </div>
          {allTypes.map(type => {
            const style = getTypeStyle(type);
            const count = customers.filter(c => c.customerType === type).length;
            return (
              <div className="acm-tier-card" key={type}
                style={{ borderTop: `4px solid ${style.color}`, cursor: 'pointer', outline: typeFilter === type ? `2px solid ${style.color}` : 'none', outlineOffset: '2px' }}
                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              >
                <span className="acm-tier-value" style={{ color: style.color }}>{count}</span>
                <span className="acm-tier-label">{type}</span>
              </div>
            );
          })}
        </div>

        <div className="admin-content-body">
          {loading ? (
            <div className="loading-container">Đang tải dữ liệu khách hàng...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="acm-empty">
              <div className="acm-empty-icon">👥</div>
              <h3>Chưa có khách hàng nào</h3>
              <p>Khách hàng sẽ xuất hiện khi có đơn hàng đầu tiên</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="table-responsive desktop-only">
                <table className="admin-table acm-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Liên hệ</th>
                      <th>Loại</th>
                      <th>Đơn hàng</th>
                      <th>Tổng chi tiêu</th>
                      <th>Đơn gần nhất</th>
                      <th className="text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c, i) => {
                      const typeStyle = getTypeStyle(c.customerType);
                      return (
                        <tr key={i} className={selectedCustomer?.email === c.email ? 'selected' : ''}>
                          <td>
                            <div className="acm-customer-cell">
                              <div className="acm-avatar" style={{ background: typeStyle.bg, color: typeStyle.color }}>
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <strong>{c.name}</strong>
                            </div>
                          </td>
                          <td>
                            <div className="acm-contact">
                              <span>{c.email}</span>
                              {c.phone && <span className="acm-phone">{c.phone}</span>}
                            </div>
                          </td>
                          <td>
                            <span className="acm-tier-badge" style={{ background: typeStyle.bg, color: typeStyle.color, borderColor: typeStyle.color }}>
                              {c.customerType}
                            </span>
                          </td>
                          <td className="acm-order-count">{c.orderCount}</td>
                          <td className="price-text">{formatCurrency(c.totalSpent)}</td>
                          <td className="acm-date">{formatDate(c.lastOrder)}</td>
                          <td className="text-right">
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button className="acm-detail-btn" onClick={() => setSelectedCustomer(selectedCustomer?.email === c.email ? null : c)}>
                                {selectedCustomer?.email === c.email ? 'Đóng' : 'Xem'}
                              </button>
                              {c.id && (
                                <button 
                                  className="acm-detail-btn" 
                                  style={{ color: '#d32f2f', borderColor: '#ffcdd2', background: '#ffebee', padding: '4px 8px' }} 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c); }}
                                  title="Xóa khách hàng khỏi SQLite"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="mobile-only acm-mobile-list">
                {filteredCustomers.map((c, i) => {
                  const typeStyle = getTypeStyle(c.customerType);
                  return (
                    <div className="acm-mobile-card" key={i} onClick={() => setSelectedCustomer(selectedCustomer?.email === c.email ? null : c)}>
                      <div className="acm-mc-top">
                        <div className="acm-mc-info">
                          <div className="acm-avatar-sm" style={{ background: typeStyle.bg, color: typeStyle.color }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{c.name}</strong>
                            <span className="acm-mc-email">{c.email}</span>
                          </div>
                        </div>
                        <span className="acm-tier-badge" style={{ background: typeStyle.bg, color: typeStyle.color, borderColor: typeStyle.color }}>
                          {c.customerType}
                        </span>
                      </div>
                      <div className="acm-mc-bottom">
                        <span>{c.orderCount} đơn hàng</span>
                        <span className="acm-mc-spent">{formatCurrency(c.totalSpent)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Customer Detail Panel */}
          {selectedCustomer && (() => {
            const typeStyle = getTypeStyle(selectedCustomer.customerType);
            return (
            <div className="acm-detail-panel">
              <div className="acm-detail-header">
                <div className="acm-detail-avatar" style={{ background: typeStyle.bg, color: typeStyle.color }}>
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="acm-detail-info">
                  <h3>{selectedCustomer.name}</h3>
                  <span>{selectedCustomer.email}</span>
                  {selectedCustomer.phone && <span>📱 {selectedCustomer.phone}</span>}
                </div>
                <span className="acm-tier-badge lg" style={{ background: typeStyle.bg, color: typeStyle.color, borderColor: typeStyle.color }}>
                  {selectedCustomer.customerType}
                </span>
                <button className="acm-close-btn" onClick={() => setSelectedCustomer(null)}>✕</button>
              </div>

              <div className="acm-detail-stats">
                <div className="acm-ds-item">
                  <span className="acm-ds-val">{selectedCustomer.orderCount}</span>
                  <span className="acm-ds-label">Đơn hàng</span>
                </div>
                <div className="acm-ds-item">
                  <span className="acm-ds-val">{formatCurrency(selectedCustomer.totalSpent)}</span>
                  <span className="acm-ds-label">Tổng chi tiêu</span>
                </div>
                <div className="acm-ds-item">
                  <span className="acm-ds-val">{formatCurrency(Math.round(selectedCustomer.totalSpent / selectedCustomer.orderCount))}</span>
                  <span className="acm-ds-label">TB/đơn</span>
                </div>
                <div className="acm-ds-item">
                  <span className="acm-ds-val">{formatDate(selectedCustomer.firstOrder)}</span>
                  <span className="acm-ds-label">Đơn đầu tiên</span>
                </div>
              </div>

              <h4>Lịch sử đơn hàng</h4>
              <div className="acm-order-history">
                {selectedCustomer.orders.map((o, i) => (
                  <div className="acm-oh-row" key={i}>
                    <div className="acm-oh-left">
                      <span className="acm-oh-id">#{o.orderNumber || o.id.substring(0, 8)}</span>
                      <span className="acm-oh-date">{formatDate(o.createdAt)}</span>
                    </div>
                    <div className="acm-oh-right">
                      <span className="acm-oh-amount">{formatCurrency(o.total)}</span>
                      <span className="acm-oh-status" style={{ color: getStatusColor(o.status), background: getStatusColor(o.status) + '18' }}>
                        {getStatusLabel(o.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default AdminCustomerManagement;
