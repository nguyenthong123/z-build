/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import './AdminAffiliateManagement.css';

const AdminAffiliateManagement = () => {
  const formatVND = (value) => {
    return (parseFloat(value) || 0).toLocaleString('vi-VN') + 'đ';
  };

  const [activeTab, setActiveTab] = useState('affiliates');
  const [affiliates, setAffiliates] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [newAffiliate, setNewAffiliate] = useState({ email: '', name: '', phone: '' });
  const [newRevenue, setNewRevenue] = useState({ affiliateId: '', amount: '', note: '' });
  const [newPromo, setNewPromo] = useState({ 
    productId: '', 
    productPrice: '',
    discountPercent: '', 
    discountAmount: '', 
    note: '' 
  });
  
  // Data for Lists
  const [revenueHistory, setRevenueHistory] = useState([]);
  const [promoList, setPromoList] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Affiliates
      const affSnap = await getDocs(collection(db, 'affiliates'));
      const affData = affSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAffiliates(affData);

      // Fetch Products (for promotion selection)
      const prodSnap = await getDocs(collection(db, 'products'));
      const prodData = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prodData);

      // Fetch Revenue History
      const revSnap = await getDocs(query(collection(db, 'affiliate_revenue'), orderBy('createdAt', 'desc')));
      setRevenueHistory(revSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Promos (Global Commission Rules)
      const promoSnap = await getDocs(collection(db, 'affiliate_promotions'));
      setPromoList(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching affiliate data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // Ưu tiên giá khuyến mãi (discountPrice), sau đó tới giá gốc (basePrice)
      const price = parseFloat(product.discountPrice || product.basePrice || product.price) || 0;
      setNewPromo(prev => ({
        ...prev,
        productId,
        productPrice: price,
        discountAmount: prev.discountPercent ? Math.round(price * parseFloat(prev.discountPercent) / 100) : prev.discountAmount
      }));
    } else {
      setNewPromo(prev => ({ ...prev, productId: '', productPrice: '' }));
    }
  };

  const handlePriceChange = (val) => {
    const price = parseFloat(val) || 0;
    setNewPromo(prev => ({
      ...prev,
      productPrice: val,
      discountAmount: prev.discountPercent ? Math.round(price * parseFloat(prev.discountPercent) / 100) : prev.discountAmount
    }));
  };

  const handlePercentChange = (percent) => {
    const p = parseFloat(percent) || 0;
    const amount = Math.round((parseFloat(newPromo.productPrice) || 0) * p / 100);
    setNewPromo(prev => ({
      ...prev,
      discountPercent: percent,
      discountAmount: amount
    }));
  };

  const handleAddAffiliate = async (e) => {
    e.preventDefault();
    if (!newAffiliate.email) return;
    try {
      await addDoc(collection(db, 'affiliates'), {
        ...newAffiliate,
        createdAt: serverTimestamp(),
        totalRevenue: 0,
        status: 'active'
      });
      setNewAffiliate({ email: '', name: '', phone: '' });
      fetchData();
    } catch (error) {
      alert("Lỗi khi thêm cộng tác viên: " + error.message);
    }
  };

  const handleAddRevenue = async (e) => {
    e.preventDefault();
    if (!newRevenue.affiliateId || !newRevenue.amount) return;
    try {
      const amount = parseFloat(newRevenue.amount);
      await addDoc(collection(db, 'affiliate_revenue'), {
        ...newRevenue,
        amount,
        createdAt: serverTimestamp()
      });
      
      // Update affiliate total
      const affRef = doc(db, 'affiliates', newRevenue.affiliateId);
      const aff = affiliates.find(a => a.id === newRevenue.affiliateId);
      await updateDoc(affRef, {
        totalRevenue: (aff.totalRevenue || 0) + amount
      });

      setNewRevenue({ affiliateId: '', amount: '', note: '' });
      fetchData();
    } catch (error) {
      alert("Lỗi khi ghi nhận doanh thu: " + error.message);
    }
  };

  const handleAddPromo = async (e) => {
    e.preventDefault();
    if (!newPromo.productId) return;
    try {
      const product = products.find(p => p.id === newPromo.productId);
      
      await addDoc(collection(db, 'affiliate_promotions'), {
        ...newPromo,
        productName: product.title,
        createdAt: serverTimestamp()
      });
      
      setNewPromo({ productId: '', productPrice: '', discountPercent: '', discountAmount: '', note: '' });
      fetchData();
    } catch (error) {
      alert("Lỗi khi tạo định mức chiết khấu: " + error.message);
    }
  };

  const handleDeleteAffiliate = async (id) => {
    if (window.confirm("Xóa cộng tác viên này?")) {
      await deleteDoc(doc(db, 'affiliates', id));
      fetchData();
    }
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

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="affiliates" />
      <div className="admin-main-content">
        <header className={`admin-content-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
          <div className="header-nav">
            <Link to="/admin/dashboard" className="back-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Quay lại Admin
            </Link>
          </div>
          <div className="header-title">
            <h1>Team Affiliate</h1>
            <p>Hệ thống quản lý đội ngũ cộng tác viên bán hàng</p>
          </div>
        </header>

        <div className="admin-content-body">
          <div className="affiliate-tabs">
        <button 
          className={activeTab === 'affiliates' ? 'active' : ''} 
          onClick={() => setActiveTab('affiliates')}
        >
          Cộng tác viên
        </button>
        <button 
          className={activeTab === 'revenue' ? 'active' : ''} 
          onClick={() => setActiveTab('revenue')}
        >
          Ghi nhận doanh thu
        </button>
        <button 
          className={activeTab === 'promos' ? 'active' : ''} 
          onClick={() => setActiveTab('promos')}
        >
          Thiết lập định mức
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'affiliates' && (
          <div className="affiliates-section">
            <div className="stats-row">
              <div className="stat-card">
                <span className="label">Tổng cộng tác viên</span>
                <span className="count">{affiliates.length}</span>
              </div>
              <div className="stat-card">
                <span className="label">Tổng doanh thu hệ thống</span>
                <span className="count">
                  {affiliates.reduce((sum, a) => sum + (a.totalRevenue || 0), 0).toLocaleString()}đ
                </span>
              </div>
            </div>

            <div className="management-grid">
              <div className="form-card">
                <h3>Thêm cộng tác viên mới</h3>
                <form onSubmit={handleAddAffiliate}>
                  <div className="input-group">
                    <label>Email</label>
                    <input 
                      type="email" 
                      placeholder="email@example.com"
                      value={newAffiliate.email}
                      onChange={e => setNewAffiliate({...newAffiliate, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Họ tên</label>
                    <input 
                      type="text" 
                      placeholder="Tên cộng tác viên"
                      value={newAffiliate.name}
                      onChange={e => setNewAffiliate({...newAffiliate, name: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="btn-primary">Thêm thành viên</button>
                </form>
              </div>

              <div className="list-card">
                <h3>Danh sách đội ngũ</h3>
                {loading ? <p>Đang tải...</p> : (
                  <div className="affiliate-list">
                    {affiliates.map(aff => (
                      <div key={aff.id} className="aff-item">
                        <div className="aff-info">
                          <span className="aff-name">{aff.name || 'N/A'}</span>
                          <span className="aff-email">{aff.email}</span>
                        </div>
                        <div className="aff-stats">
                          <span className="rev-badge">{formatVND(aff.totalRevenue)}</span>
                          <button 
                            className="btn-icon delete"
                            onClick={() => handleDeleteAffiliate(aff.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="revenue-section">
            <div className="management-grid">
              <div className="form-card">
                <h3>Cập nhật doanh thu mới</h3>
                <form onSubmit={handleAddRevenue}>
                  <div className="input-group">
                    <label>Cộng tác viên</label>
                    <select 
                      value={newRevenue.affiliateId}
                      onChange={e => setNewRevenue({...newRevenue, affiliateId: e.target.value})}
                      required
                    >
                      <option value="">Chọn thành viên...</option>
                      {affiliates.map(aff => (
                        <option key={aff.id} value={aff.id}>{aff.name} ({aff.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Số tiền doanh thu (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={newRevenue.amount}
                      onChange={e => setNewRevenue({...newRevenue, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Ghi chú</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Đơn hàng X"
                      value={newRevenue.note}
                      onChange={e => setNewRevenue({...newRevenue, note: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="btn-primary">Ghi nhận doanh thu</button>
                </form>
              </div>

              <div className="list-card">
                <h3>Lịch sử biến động</h3>
                <div className="history-list">
                  {revenueHistory.map(rev => (
                    <div key={rev.id} className="history-item">
                      <div className="history-info">
                        <span className="hist-user">{affiliates.find(a => a.id === rev.affiliateId)?.name || 'N/A'}</span>
                        <span className="hist-note">{rev.note}</span>
                      </div>
                      <div className="history-amount">
                         + {formatVND(rev.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="promos-section">
            <div className="management-grid">
              <div className="form-card">
                <h3>Thiết lập định mức chiết khấu</h3>
                <form onSubmit={handleAddPromo}>
                  <div className="input-group">
                    <label>Sản phẩm liên kết</label>
                    <select 
                      value={newPromo.productId}
                      onChange={e => handleProductChange(e.target.value)}
                      required
                    >
                      <option value="">Chọn sản phẩm...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Giá tiền hệ thống (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={newPromo.productPrice} 
                      onChange={e => handlePriceChange(e.target.value)}
                    />
                    <span className="input-hint">{formatVND(newPromo.productPrice)}</span>
                  </div>
                  <div className="input-group">
                    <label>% chiết khấu</label>
                    <input 
                      type="number" 
                      placeholder="%"
                      value={newPromo.discountPercent}
                      onChange={e => handlePercentChange(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>Số tiền chiết khấu (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="Số tiền"
                      value={newPromo.discountAmount}
                      onChange={e => setNewPromo({...newPromo, discountAmount: e.target.value})}
                    />
                  </div>
                  <div className="input-group">
                    <label>Ghi chú</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Áp dụng cho team A"
                      value={newPromo.note}
                      onChange={e => setNewPromo({...newPromo, note: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="btn-primary">Lưu định mức</button>
                </form>
              </div>

              <div className="list-card">
                <h3>Bảng định mức chiết khấu Affiliate</h3>
                <div className="table-container">
                  <table className="affiliate-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Giá hệ thống</th>
                        <th>%</th>
                        <th>Số tiền</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoList.map(p => (
                        <tr key={p.id}>
                          <td className="col-product">
                            <div className="prod-name">{p.productName}</div>
                            <div className="prod-note">{p.note}</div>
                          </td>
                          <td>{formatVND(p.productPrice)}</td>
                          <td>{p.discountPercent}%</td>
                          <td className="col-amount">{formatVND(p.discountAmount)}</td>
                          <td>
                            <button 
                              className="btn-icon delete"
                              onClick={async () => {
                                if(window.confirm("Xóa định mức này?")) {
                                  await deleteDoc(doc(db, 'affiliate_promotions', p.id));
                                  fetchData();
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {promoList.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{textAlign: 'center', padding: '32px', color: '#64748b'}}>
                            Chưa có định mức chiết khấu nào được thiết lập
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAffiliateManagement;
