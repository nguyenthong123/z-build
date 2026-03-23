import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import './AdminAIInsights.css';

const AdminAIInsights = ({ onBack }) => {
  const [insights, setInsights] = useState({
    orderSummary: null,
    lowStockAlerts: [],
    pricingTips: [],
    loading: true
  });
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    generateInsights();
  }, []);

  const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

  const generateInsights = async () => {
    try {
      const [ordersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'products'))
      ]);

      const orders = ordersSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() };
      });
      const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // === ORDER SUMMARY (today + this week) ===
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayOrders = orders.filter(o => o.createdAt && o.createdAt >= today);
      const weekOrders = orders.filter(o => o.createdAt && o.createdAt >= weekAgo);
      const pendingOrders = orders.filter(o => o.status === 'pending');
      const shippingOrders = orders.filter(o => o.status === 'shipping');

      const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
      const weekRevenue = weekOrders.reduce((s, o) => s + (o.total || 0), 0);
      const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);

      // Top products this week
      const productCounts = {};
      weekOrders.forEach(o => {
        (o.items || []).forEach(item => {
          const name = item.name || item.title || 'Unknown';
          productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
        });
      });
      const topProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, quantity: qty }));

      const orderSummary = {
        today: { count: todayOrders.length, revenue: todayRevenue },
        week: { count: weekOrders.length, revenue: weekRevenue },
        pending: pendingOrders.length,
        shipping: shippingOrders.length,
        totalRevenue,
        totalOrders: orders.length,
        topProducts,
        avgOrderValue: orders.length > 0 ? Math.round(orders.reduce((s, o) => s + (o.total || 0), 0) / orders.length) : 0
      };

      // === LOW STOCK ALERTS ===
      const lowStockAlerts = products
        .filter(p => p.stock !== undefined && p.stock <= 10)
        .map(p => ({
          id: p.id,
          name: p.title,
          stock: p.stock,
          category: p.category || 'Chung',
          severity: p.stock === 0 ? 'critical' : p.stock <= 3 ? 'warning' : 'info',
          image: p.image
        }))
        .sort((a, b) => a.stock - b.stock);

      // === PRICING TIPS ===
      const pricingTips = [];

      // Find products with no sales
      const soldProductNames = new Set();
      orders.forEach(o => (o.items || []).forEach(item => soldProductNames.add(item.name || item.title)));
      
      products.forEach(p => {
        if (p.title && !soldProductNames.has(p.title) && p.price > 0) {
          pricingTips.push({
            type: 'no_sales',
            product: p.title,
            message: `"${p.title}" chưa có đơn hàng nào. Xem xét giảm giá hoặc tạo combo/khuyến mãi.`,
            icon: '📉'
          });
        }
      });

      // High margin suggestion
      products.forEach(p => {
        if (p.price && p.priceBuy && p.price > 0 && p.priceBuy > 0) {
          const margin = ((p.price - p.priceBuy) / p.price * 100).toFixed(1);
          if (margin < 15) {
            pricingTips.push({
              type: 'low_margin',
              product: p.title,
              message: `"${p.title}" có biên lợi nhuận chỉ ${margin}%. Cân nhắc tăng giá hoặc tìm nguồn hàng rẻ hơn.`,
              icon: '⚠️'
            });
          }
          if (margin > 60) {
            pricingTips.push({
              type: 'high_margin',
              product: p.title,
              message: `"${p.title}" có biên lợi nhuận ${margin}%. Có thể giảm giá nhẹ để tăng sức cạnh tranh.`,
              icon: '💰'
            });
          }
        }
      });

      // Pending orders alert
      if (pendingOrders.length > 3) {
        pricingTips.unshift({
          type: 'action_needed',
          product: null,
          message: `Có ${pendingOrders.length} đơn hàng đang chờ xác nhận! Xử lý ngay để tránh mất khách.`,
          icon: '🔔'
        });
      }

      setInsights({
        orderSummary,
        lowStockAlerts,
        pricingTips,
        loading: false
      });
    } catch (err) {
      console.error('AI Insights Error:', err);
      setInsights(prev => ({ ...prev, loading: false }));
    }
  };

  if (insights.loading) {
    return (
      <div className="admin-product-page">
        <AdminSidebar activePage="ai_insights" />
        <div className="admin-main-content">
          <div className="ai-insights-loading" style={{ height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ai-spinner"></div>
            <p>🤖 AI đang phân tích dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  const { orderSummary, lowStockAlerts, pricingTips } = insights;

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="ai_insights" />
      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">AI Auto-Admin</span></nav>
          
          <div className="header-main-row">
            <div className="title-group">
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2em' }}>🤖</span> AI Auto-Admin
              </h1>
              <p className="description">Tóm tắt & cảnh báo tự động từ hệ thống AI.</p>
            </div>
            
            <div className="header-actions-group">
              <div className="btn-group">
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                <button className="primary-add-btn" onClick={generateInsights} style={{ background: '#D4AF37', color: '#1a1a2e', boxShadow: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.3 3.3"/></svg>
                  <span className="desktop-only">Cập nhật</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content-body">

      {/* Tab Navigation */}
      <div className="ai-tabs">
        <button className={`ai-tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
          📊 Tổng quan đơn hàng
        </button>
        <button className={`ai-tab ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
          ⚠️ Cảnh báo tồn kho
          {lowStockAlerts.length > 0 && <span className="ai-badge">{lowStockAlerts.length}</span>}
        </button>
        <button className={`ai-tab ${activeTab === 'tips' ? 'active' : ''}`} onClick={() => setActiveTab('tips')}>
          💡 Gợi ý kinh doanh
          {pricingTips.length > 0 && <span className="ai-badge">{pricingTips.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="ai-tab-content">
        {activeTab === 'summary' && orderSummary && (
          <div className="ai-summary">
            <div className="ai-kpi-grid">
              <div className="ai-kpi-card gold">
                <span className="ai-kpi-icon">📦</span>
                <div className="ai-kpi-value">{orderSummary.today.count}</div>
                <div className="ai-kpi-label">Đơn hôm nay</div>
                <div className="ai-kpi-sub">{formatCurrency(orderSummary.today.revenue)}</div>
              </div>
              <div className="ai-kpi-card blue">
                <span className="ai-kpi-icon">📈</span>
                <div className="ai-kpi-value">{orderSummary.week.count}</div>
                <div className="ai-kpi-label">Đơn tuần này</div>
                <div className="ai-kpi-sub">{formatCurrency(orderSummary.week.revenue)}</div>
              </div>
              <div className="ai-kpi-card orange">
                <span className="ai-kpi-icon">⏳</span>
                <div className="ai-kpi-value">{orderSummary.pending}</div>
                <div className="ai-kpi-label">Chờ xác nhận</div>
                <div className="ai-kpi-sub">Cần xử lý ngay</div>
              </div>
              <div className="ai-kpi-card green">
                <span className="ai-kpi-icon">🚚</span>
                <div className="ai-kpi-value">{orderSummary.shipping}</div>
                <div className="ai-kpi-label">Đang giao</div>
                <div className="ai-kpi-sub">Đang vận chuyển</div>
              </div>
            </div>

            <div className="ai-summary-details">
              <div className="ai-detail-card">
                <h4>📊 Thống kê tổng</h4>
                <div className="ai-detail-row">
                  <span>Tổng doanh thu (đã giao)</span>
                  <strong>{formatCurrency(orderSummary.totalRevenue)}</strong>
                </div>
                <div className="ai-detail-row">
                  <span>Tổng đơn hàng</span>
                  <strong>{orderSummary.totalOrders}</strong>
                </div>
                <div className="ai-detail-row">
                  <span>Giá trị TB / đơn</span>
                  <strong>{formatCurrency(orderSummary.avgOrderValue)}</strong>
                </div>
              </div>

              {orderSummary.topProducts.length > 0 && (
                <div className="ai-detail-card">
                  <h4>🏆 Top sản phẩm tuần này</h4>
                  {orderSummary.topProducts.map((p, i) => (
                    <div className="ai-detail-row" key={i}>
                      <span>{i + 1}. {p.name}</span>
                      <strong>{p.quantity} đã bán</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="ai-alerts">
            {lowStockAlerts.length === 0 ? (
              <div className="ai-empty">
                <span className="ai-empty-icon">✅</span>
                <h4>Tất cả sản phẩm đều đủ hàng!</h4>
                <p>Không có sản phẩm nào dưới ngưỡng 10 đơn vị tồn kho.</p>
              </div>
            ) : (
              <div className="ai-alerts-list">
                {lowStockAlerts.map((alert, i) => (
                  <div className={`ai-alert-item ${alert.severity}`} key={i}>
                    <div className="ai-alert-left">
                      {alert.image ? (
                        <img src={alert.image} alt="" className="ai-alert-img" />
                      ) : (
                        <div className="ai-alert-icon">
                          {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                        </div>
                      )}
                      <div>
                        <strong>{alert.name}</strong>
                        <span className="ai-alert-category">{alert.category}</span>
                      </div>
                    </div>
                    <div className="ai-alert-right">
                      <span className={`ai-stock-badge ${alert.severity}`}>
                        {alert.stock === 0 ? 'HẾT HÀNG' : `Còn ${alert.stock}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="ai-tips">
            {pricingTips.length === 0 ? (
              <div className="ai-empty">
                <span className="ai-empty-icon">🎯</span>
                <h4>Mọi thứ đang ổn!</h4>
                <p>AI chưa phát hiện vấn đề cần lưu ý.</p>
              </div>
            ) : (
              <div className="ai-tips-list">
                {pricingTips.map((tip, i) => (
                  <div className={`ai-tip-item ${tip.type}`} key={i}>
                    <span className="ai-tip-icon">{tip.icon}</span>
                    <div className="ai-tip-content">
                      <p>{tip.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      </div>
      </div>
  );
};

export default AdminAIInsights;
