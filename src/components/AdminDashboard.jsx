import React, { useState, useEffect, useRef } from 'react';
import { apiGetOrders, apiGetProducts } from '../services/sqliteApi';
import './AdminDashboard.css';

import AdminHeader from './AdminHeader';

const AdminDashboard = () => {


  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('7days');
  const canvasRef = useRef(null);

  const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';
  
  const getStatusLabel = (s) => {
    const map = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };
    return map[s] || s;
  };

  const getStatusColor = (s) => {
    const map = { pending: '#FFB800', confirmed: '#2196F3', shipping: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336' };
    return map[s] || '#888';
  };

  const drawChart = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Group orders by date
    const days = chartPeriod === '7days' ? 7 : 30;
    const dataPoints = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      const dayRevenue = orders
        .filter(o => {
          if (!o.createdAt || o.status === 'cancelled') return false;
          const oDate = (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString().split('T')[0];
          return oDate === dateStr;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

      dataPoints.push({ label, value: dayRevenue });
    }

    const maxVal = Math.max(...dataPoints.map(d => d.value), 1000000);
    
    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      const val = maxVal - (maxVal / 4) * i;
      ctx.fillText(formatCurrency(val), padding.left - 8, y + 4);
    }

    if (dataPoints.length < 2) return;

    // Draw area gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, 'rgba(30, 41, 59, 0.2)');
    gradient.addColorStop(1, 'rgba(30, 41, 59, 0.0)');

    ctx.beginPath();
    const getX = (idx) => padding.left + (chartW / (dataPoints.length - 1)) * idx;
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    ctx.moveTo(getX(0), getY(dataPoints[0].value));
    for (let i = 1; i < dataPoints.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(dataPoints[i - 1].value);
      const curX = getX(i);
      const curY = getY(dataPoints[i].value);
      const cX1 = prevX + (curX - prevX) / 2;
      const cX2 = curX - (curX - prevX) / 2;
      ctx.bezierCurveTo(cX1, prevY, cX2, curY, curX, curY);
    }

    // Fill area
    ctx.lineTo(getX(dataPoints.length - 1), h - padding.bottom);
    ctx.lineTo(getX(0), h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(dataPoints[0].value));
    for (let i = 1; i < dataPoints.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(dataPoints[i - 1].value);
      const curX = getX(i);
      const curY = getY(dataPoints[i].value);
      const cX1 = prevX + (curX - prevX) / 2;
      const cX2 = curX - (curX - prevX) / 2;
      ctx.bezierCurveTo(cX1, prevY, cX2, curY, curX, curY);
    }
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots and X labels
    const step = days === 30 ? 5 : 1;
    dataPoints.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.value);

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // X Label
      if (i % step === 0 || i === dataPoints.length - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x, h - padding.bottom + 20);
      }
    });
  }, [chartPeriod, orders]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (orders.length > 0) drawChart();
  }, [orders, chartPeriod, drawChart]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersDataRaw, productsData] = await Promise.all([
        apiGetOrders(),
        apiGetProducts()
      ]);
      
      const ordersData = (ordersDataRaw || []).map(d => ({
        ...d,
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date()
      }));
      
      setOrders(ordersData);
      setProducts(productsData || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  // Total Revenue includes all non-cancelled orders for chart consistency
  const totalRevenue = orders.filter(o => o?.status && o.status !== 'cancelled').reduce((s, o) => s + (Number(o?.total) || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o?.status === 'pending').length;
  const deliveredOrders = orders.filter(o => o?.status === 'delivered').length;
  const cancelledOrders = orders.filter(o => o?.status === 'cancelled').length;
  const avgOrderValue = totalOrders > 0 ? Math.round(orders.reduce((s, o) => s + (Number(o?.total) || 0), 0) / totalOrders) : 0;
  
  // Unique customers
  const uniqueCustomers = new Set(orders.map(o => o?.userEmail).filter(Boolean)).size;

  // Top selling products
  const activeProductTitles = new Set(products.map(p => (p.title || p.name || '').trim().toLowerCase()));
  
  const productSales = {};
  orders.forEach(o => {
    if (o?.status && o.status !== 'cancelled') {
      (o.items || []).forEach(item => {
        if (!item) return;
        const rawTitle = item.name || 'Unknown';
        const normalizedTitle = rawTitle.trim().toLowerCase();
        
        // Only show if the product still exists in our current product list
        if (!activeProductTitles.has(normalizedTitle)) return;
        
        if (!productSales[rawTitle]) productSales[rawTitle] = { name: rawTitle, quantity: 0, revenue: 0, image: item.image };
        productSales[rawTitle].quantity += (Number(item.quantity) || 1);
        productSales[rawTitle].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
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

  if (loading) {
    return (
      <div className="admin-product-page">
        <div className="admin-main-content">
          <div className="loading-container">Đang tải dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-product-page">
      <div className="admin-main-content">
        <AdminHeader
          title="Bảng điều khiển"
          actions={
            <button className="home-icon-btn desktop-only" onClick={() => window.location.href = '/'} title="Về trang chủ" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
          }
        />

        <div className="admin-content-body">
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
  </div>
);
};

export default AdminDashboard;
