import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from './AdminSidebar';
import './AdminCustomerManagement.css';

const TIERS = [
  { key: 'platinum', label: 'Platinum', minSpent: 50000000, color: '#9C27B0', icon: '💎' },
  { key: 'gold', label: 'Gold', minSpent: 20000000, color: '#FFB800', icon: '🥇' },
  { key: 'silver', label: 'Silver', minSpent: 5000000, color: '#90A4AE', icon: '🥈' },
  { key: 'bronze', label: 'Bronze', minSpent: 0, color: '#CD7F32', icon: '🥉' }
];

const AdminCustomerManagement = ({ onBack }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [stats, setStats] = useState({ total: 0, platinum: 0, gold: 0, silver: 0, bronze: 0 });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      const ordersData = ordersSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
      }));

      // Aggregate by email
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
            address: o.shippingAddress
          };
        }
        customerMap[email].orders.push(o);
        if (o.status !== 'cancelled') {
          customerMap[email].totalSpent += (o.total || 0);
        }
        if (o.createdAt < customerMap[email].firstOrder) customerMap[email].firstOrder = o.createdAt;
        if (o.createdAt > customerMap[email].lastOrder) customerMap[email].lastOrder = o.createdAt;
        // Update name/phone if better
        if (!customerMap[email].name || customerMap[email].name === 'Khách vãng lai') {
          const name = o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`.trim();
          if (name) customerMap[email].name = name;
        }
        if (!customerMap[email].phone && o.shippingAddress?.phone) {
          customerMap[email].phone = o.shippingAddress.phone;
        }
      });

      // Assign tiers
      const customerList = Object.values(customerMap).map(c => {
        const tier = TIERS.find(t => c.totalSpent >= t.minSpent) || TIERS[TIERS.length - 1];
        return { ...c, tier: tier.key, tierLabel: tier.label, tierColor: tier.color, tierIcon: tier.icon, orderCount: c.orders.length };
      });

      customerList.sort((a, b) => b.totalSpent - a.totalSpent);
      setCustomers(customerList);

      // Stats
      const s = { total: customerList.length, platinum: 0, gold: 0, silver: 0, bronze: 0 };
      customerList.forEach(c => { if (s[c.tier] !== undefined) s[c.tier]++; });
      setStats(s);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
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
    const matchTier = tierFilter === 'all' || c.tier === tierFilter;
    return matchSearch && matchTier;
  });

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="customers" />

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
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Tier Stats */}
        <div className="acm-tier-stats">
          <div className="acm-tier-card total">
            <span className="acm-tier-icon">👥</span>
            <span className="acm-tier-value">{stats.total}</span>
            <span className="acm-tier-label">Tổng khách hàng</span>
          </div>
          {TIERS.map(t => (
            <div className="acm-tier-card" key={t.key} style={{ borderColor: t.color }} onClick={() => setTierFilter(tierFilter === t.key ? 'all' : t.key)}>
              <span className="acm-tier-icon">{t.icon}</span>
              <span className="acm-tier-value" style={{ color: t.color }}>{stats[t.key]}</span>
              <span className="acm-tier-label">{t.label}</span>
            </div>
          ))}
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
                      <th>Hạng</th>
                      <th>Đơn hàng</th>
                      <th>Tổng chi tiêu</th>
                      <th>Đơn gần nhất</th>
                      <th className="text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c, i) => (
                      <tr key={i} className={selectedCustomer?.email === c.email ? 'selected' : ''}>
                        <td>
                          <div className="acm-customer-cell">
                            <div className="acm-avatar" style={{ background: c.tierColor + '22', color: c.tierColor }}>
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
                          <span className="acm-tier-badge" style={{ background: c.tierColor + '18', color: c.tierColor, borderColor: c.tierColor }}>
                            {c.tierIcon} {c.tierLabel}
                          </span>
                        </td>
                        <td className="acm-order-count">{c.orderCount}</td>
                        <td className="price-text">{formatCurrency(c.totalSpent)}</td>
                        <td className="acm-date">{formatDate(c.lastOrder)}</td>
                        <td className="text-right">
                          <button className="acm-detail-btn" onClick={() => setSelectedCustomer(selectedCustomer?.email === c.email ? null : c)}>
                            {selectedCustomer?.email === c.email ? 'Đóng' : 'Xem'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="mobile-only acm-mobile-list">
                {filteredCustomers.map((c, i) => (
                  <div className="acm-mobile-card" key={i} onClick={() => setSelectedCustomer(selectedCustomer?.email === c.email ? null : c)}>
                    <div className="acm-mc-top">
                      <div className="acm-mc-info">
                        <div className="acm-avatar-sm" style={{ background: c.tierColor + '22', color: c.tierColor }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{c.name}</strong>
                          <span className="acm-mc-email">{c.email}</span>
                        </div>
                      </div>
                      <span className="acm-tier-badge" style={{ background: c.tierColor + '18', color: c.tierColor, borderColor: c.tierColor }}>
                        {c.tierIcon} {c.tierLabel}
                      </span>
                    </div>
                    <div className="acm-mc-bottom">
                      <span>{c.orderCount} đơn hàng</span>
                      <span className="acm-mc-spent">{formatCurrency(c.totalSpent)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Customer Detail Panel */}
          {selectedCustomer && (
            <div className="acm-detail-panel">
              <div className="acm-detail-header">
                <div className="acm-detail-avatar" style={{ background: selectedCustomer.tierColor + '22', color: selectedCustomer.tierColor }}>
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="acm-detail-info">
                  <h3>{selectedCustomer.name}</h3>
                  <span>{selectedCustomer.email}</span>
                  {selectedCustomer.phone && <span>📱 {selectedCustomer.phone}</span>}
                </div>
                <span className="acm-tier-badge lg" style={{ background: selectedCustomer.tierColor + '18', color: selectedCustomer.tierColor, borderColor: selectedCustomer.tierColor }}>
                  {selectedCustomer.tierIcon} {selectedCustomer.tierLabel}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCustomerManagement;
