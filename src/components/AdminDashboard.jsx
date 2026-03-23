import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from './AdminSidebar';
import './AdminDashboard.css';

const AdminDashboard = ({ onBack }) => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('7days');
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (orders.length > 0) drawChart();
  }, [orders, chartPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'products'))
      ]);
      
      const ordersData = ordersSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
      }));
      
      const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setOrders(ordersData);
      setProducts(productsData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const avgOrderValue = totalOrders > 0 ? Math.round(orders.reduce((s, o) => s + (o.total || 0), 0) / totalOrders) : 0;
  
  // Unique customers
  const uniqueCustomers = new Set(orders.map(o => o.userEmail).filter(Boolean)).size;

  // Top selling products
  const productSales = {};
  orders.forEach(o => {
    if (o.status !== 'cancelled') {
      (o.items || []).forEach(item => {
        const key = item.name || 'Unknown';
        if (!productSales[key]) productSales[key] = { name: key, quantity: 0, revenue: 0, image: item.image };
        productSales[key].quantity += (item.quantity || 1);
        productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    }
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  // Recent orders
  const recentOrders = orders.slice(0, 5);

  // Order status distribution
  const statusDistrib = {
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    shipping: orders.filter(o => o.status === 'shipping').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  };

  const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';
  
  const getStatusLabel = (s) => {
    const map = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    const map = { pending: '#FFB800', confirmed: '#2196F3', shipping: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336' };
    return map[s] || '#888';
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  // Draw revenue chart on canvas
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Determine date range
    let days = 7;
    if (chartPeriod === '30days') days = 30;
    if (chartPeriod === '90days') days = 90;

    const now = new Date();
    const labels = [];
    const values = [];
    const orderCounts = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      
      const dayOrders = orders.filter(o => {
        const od = o.createdAt;
        return od.toISOString().split('T')[0] === key && o.status !== 'cancelled';
      });
      values.push(dayOrders.reduce((s, o) => s + (o.total || 0), 0));
      orderCounts.push(dayOrders.length);
    }

    const maxVal = Math.max(...values, 1);
    const padding = { top: 30, right: 20, bottom: 40, left: 10 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
    }

    if (values.length < 2) return;

    const stepX = chartW / (values.length - 1);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
    gradient.addColorStop(0, 'rgba(67, 97, 238, 0.15)');
    gradient.addColorStop(1, 'rgba(67, 97, 238, 0)');

    // Area fill
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH - (values[0] / maxVal) * chartH);
    for (let i = 1; i < values.length; i++) {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (values[i] / maxVal) * chartH;
      const prevX = padding.left + (i - 1) * stepX;
      const prevY = padding.top + chartH - (values[i - 1] / maxVal) * chartH;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
    ctx.lineTo(padding.left + (values.length - 1) * stepX, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH - (values[0] / maxVal) * chartH);
    for (let i = 1; i < values.length; i++) {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (values[i] / maxVal) * chartH;
      const prevX = padding.left + (i - 1) * stepX;
      const prevY = padding.top + chartH - (values[i - 1] / maxVal) * chartH;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
    ctx.strokeStyle = '#4361ee';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots on non-zero values
    values.forEach((v, i) => {
      if (v > 0) {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - (v / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#4361ee';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // X labels
    ctx.fillStyle = '#999';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(values.length / 10));
    labels.forEach((l, i) => {
      if (i % labelStep === 0 || i === labels.length - 1) {
        const x = padding.left + i * stepX;
        ctx.fillText(l, x, H - padding.bottom + 18);
      }
    });
  };

  if (loading) {
    return (
      <div className="admin-product-page">
        <AdminSidebar activePage="dashboard" />
        <div className="admin-main-content">
          <div className="loading-container">Đang tải dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="dashboard" />

      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Dashboard</span></nav>
          <div className="header-main-row">
            <div className="title-group">
              <h1>Bảng điều khiển</h1>
              <p className="description">Tổng quan hoạt động kinh doanh của bạn.</p>
            </div>
            <div className="header-actions-group">
              <div className="btn-group">
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="dash-kpis">
          <div className="dash-kpi-card revenue">
            <div className="dash-kpi-icon">💰</div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-value">{formatCurrency(totalRevenue)}</span>
              <span className="dash-kpi-label">Doanh thu</span>
            </div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon">📦</div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-value">{totalOrders}</span>
              <span className="dash-kpi-label">Tổng đơn hàng</span>
            </div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon">👥</div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-value">{uniqueCustomers}</span>
              <span className="dash-kpi-label">Khách hàng</span>
            </div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon">💳</div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-value">{formatCurrency(avgOrderValue)}</span>
              <span className="dash-kpi-label">Giá trị TB/đơn</span>
            </div>
          </div>
        </div>

        <div className="admin-content-body dash-grid">
          {/* Revenue Chart */}
          <div className="dash-card dash-chart-card">
            <div className="dash-card-header">
              <h3>📈 Doanh thu</h3>
              <div className="dash-chart-controls">
                {['7days', '30days', '90days'].map(p => (
                  <button key={p} className={`dash-period-btn ${chartPeriod === p ? 'active' : ''}`} onClick={() => setChartPeriod(p)}>
                    {p === '7days' ? '7 ngày' : p === '30days' ? '30 ngày' : '90 ngày'}
                  </button>
                ))}
              </div>
            </div>
            <div className="dash-chart-wrap">
              <canvas ref={canvasRef} className="dash-canvas" />
            </div>
          </div>

          {/* Order Status Distribution */}
          <div className="dash-card dash-status-card">
            <div className="dash-card-header">
              <h3>📊 Phân bổ đơn hàng</h3>
            </div>
            <div className="dash-status-list">
              {Object.entries(statusDistrib).map(([key, val]) => {
                const pct = totalOrders > 0 ? Math.round((val / totalOrders) * 100) : 0;
                return (
                  <div className="dash-status-row" key={key}>
                    <div className="dash-status-label">
                      <span className="dash-status-dot" style={{ background: getStatusColor(key) }}></span>
                      <span>{getStatusLabel(key)}</span>
                    </div>
                    <div className="dash-status-bar-wrap">
                      <div className="dash-status-bar" style={{ width: `${pct}%`, background: getStatusColor(key) }}></div>
                    </div>
                    <span className="dash-status-count">{val} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="dash-card dash-top-products">
            <div className="dash-card-header">
              <h3>🏆 Top sản phẩm bán chạy</h3>
            </div>
            {topProducts.length === 0 ? (
              <div className="dash-empty-mini">Chưa có dữ liệu bán hàng</div>
            ) : (
              <div className="dash-product-list">
                {topProducts.map((p, i) => (
                  <div className="dash-product-row" key={i}>
                    <span className="dash-product-rank">#{i + 1}</span>
                    {p.image && <img src={p.image} alt="" className="dash-product-img" />}
                    <div className="dash-product-info">
                      <strong>{p.name}</strong>
                      <span>{p.quantity} đã bán • {formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="dash-card dash-recent-orders">
            <div className="dash-card-header">
              <h3>🕐 Đơn hàng gần đây</h3>
            </div>
            {recentOrders.length === 0 ? (
              <div className="dash-empty-mini">Chưa có đơn hàng</div>
            ) : (
              <div className="dash-orders-list">
                {recentOrders.map((o, i) => (
                  <div className="dash-order-row" key={i}>
                    <div className="dash-order-left">
                      <span className="dash-order-id">#{o.orderNumber || o.id.substring(0, 8)}</span>
                      <span className="dash-order-customer">{o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`}</span>
                    </div>
                    <div className="dash-order-right">
                      <span className="dash-order-amount">{formatCurrency(o.total)}</span>
                      <span className="dash-order-status" style={{ color: getStatusColor(o.status), background: getStatusColor(o.status) + '18' }}>
                        {getStatusLabel(o.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="dash-card dash-quick-stats">
            <div className="dash-card-header">
              <h3>⚡ Thống kê nhanh</h3>
            </div>
            <div className="dash-quick-grid">
              <div className="dash-quick-item">
                <span className="dash-quick-num" style={{ color: '#4CAF50' }}>{deliveredOrders}</span>
                <span className="dash-quick-label">Đã giao</span>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-num" style={{ color: '#FFB800' }}>{pendingOrders}</span>
                <span className="dash-quick-label">Chờ xử lý</span>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-num" style={{ color: '#F44336' }}>{cancelledOrders}</span>
                <span className="dash-quick-label">Đã hủy</span>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-num" style={{ color: '#2196F3' }}>{products.length}</span>
                <span className="dash-quick-label">Sản phẩm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
