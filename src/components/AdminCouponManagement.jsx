import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from './AdminSidebar';
import './AdminCouponManagement.css';

const AdminCouponManagement = ({ onBack }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percent', // percent, fixed, free_shipping
    value: '',
    minOrder: '',
    maxUses: '',
    expiryDate: '',
    description: '',
    active: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'coupons'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCoupons(data);
    } catch (err) {
      console.error('Error fetching coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '', type: 'percent', value: '', minOrder: '', maxUses: '',
      expiryDate: '', description: '', active: true
    });
    setEditingCoupon(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.value) return;

    const couponData = {
      code: formData.code.toUpperCase().replace(/\s/g, ''),
      type: formData.type,
      value: Number(formData.value),
      minOrder: formData.minOrder ? Number(formData.minOrder) : 0,
      maxUses: formData.maxUses ? Number(formData.maxUses) : 0, // 0 = unlimited
      usedCount: editingCoupon ? (editingCoupon.usedCount || 0) : 0,
      expiryDate: formData.expiryDate || null,
      description: formData.description,
      active: formData.active,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), couponData);
      } else {
        couponData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'coupons'), couponData);
      }
      resetForm();
      fetchCoupons();
    } catch (err) {
      console.error('Error saving coupon:', err);
      alert('Lỗi khi lưu mã giảm giá!');
    }
  };

  const handleEdit = (coupon) => {
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrder: coupon.minOrder || '',
      maxUses: coupon.maxUses || '',
      expiryDate: coupon.expiryDate || '',
      description: coupon.description || '',
      active: coupon.active !== false
    });
    setEditingCoupon(coupon);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa mã giảm giá này?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', id));
      fetchCoupons();
    } catch (err) {
      console.error('Error deleting coupon:', err);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), { active: !coupon.active });
      fetchCoupons();
    } catch (err) {
      console.error('Error toggling coupon:', err);
    }
  };

  const formatValue = (coupon) => {
    if (coupon.type === 'percent') return `${coupon.value}%`;
    if (coupon.type === 'fixed') return `${Number(coupon.value).toLocaleString('vi-VN')}₫`;
    if (coupon.type === 'free_shipping') return 'Miễn phí ship';
    return coupon.value;
  };

  const isExpired = (coupon) => {
    if (!coupon.expiryDate) return false;
    return new Date(coupon.expiryDate) < new Date();
  };

  const getStatusBadge = (coupon) => {
    if (!coupon.active) return <span className="badge inactive">Tắt</span>;
    if (isExpired(coupon)) return <span className="badge expired">Hết hạn</span>;
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return <span className="badge used-up">Đã hết</span>;
    return <span className="badge active">Hoạt động</span>;
  };

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="coupons" />
      
      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Mã giảm giá</span></nav>
          
          <div className="header-main-row">
            <div className="title-group">
              <h1>Mã giảm giá</h1>
              <p className="description">{coupons.length} mã · Quản lý mã giảm giá, khuyến mãi.</p>
            </div>
            
            <div className="header-actions-group">
              <div className="btn-group">
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                <button className="primary-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                  <span className="desktop-only">Tạo mã mới</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content-body">
          {/* Form Modal */}
          {showForm && (
            <div className="coupon-form-overlay" onClick={(e) => e.target.className === 'coupon-form-overlay' && resetForm()}>
              <form className="coupon-form" onSubmit={handleSubmit}>
                <h2>{editingCoupon ? 'Sửa mã giảm giá' : 'Tạo mã giảm giá mới'}</h2>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Mã coupon</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder="VD: SALE20, FREESHIP..."
                      required
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Loại giảm giá</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option value="percent">Giảm theo %</option>
                      <option value="fixed">Giảm cố định (VNĐ)</option>
                      <option value="free_shipping">Miễn phí vận chuyển</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{formData.type === 'percent' ? 'Phần trăm giảm (%)' : formData.type === 'fixed' ? 'Số tiền giảm (₫)' : 'Giá trị (bỏ qua)'}</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={e => setFormData({...formData, value: e.target.value})}
                      placeholder={formData.type === 'percent' ? '20' : '50000'}
                      required={formData.type !== 'free_shipping'}
                      disabled={formData.type === 'free_shipping'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Đơn tối thiểu (₫)</label>
                    <input
                      type="number"
                      value={formData.minOrder}
                      onChange={e => setFormData({...formData, minOrder: e.target.value})}
                      placeholder="0 = không giới hạn"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Số lần dùng tối đa</label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={e => setFormData({...formData, maxUses: e.target.value})}
                      placeholder="0 = không giới hạn"
                    />
                  </div>
                  <div className="form-group">
                    <label>Ngày hết hạn</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Mô tả</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Mô tả ngắn cho mã giảm giá..."
                  />
                </div>

                <div className="form-group">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={e => setFormData({...formData, active: e.target.checked})}
                    />
                    <span className="toggle-switch"></span>
                    Kích hoạt mã giảm giá
                  </label>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={resetForm}>Hủy</button>
                  <button type="submit" className="btn-save">{editingCoupon ? 'Cập nhật' : 'Tạo mã'}</button>
                </div>
              </form>
            </div>
          )}

          {/* Coupon Table */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Đang tải mã giảm giá...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <h3>Chưa có mã giảm giá</h3>
              <p>Tạo mã khuyến mãi đầu tiên để thu hút khách hàng!</p>
              <button className="primary-add-btn" style={{ margin: '0 auto' }} onClick={() => setShowForm(true)}>Tạo mã đầu tiên</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Đơn tối thiểu</th>
                    <th>Đã dùng</th>
                    <th>Hết hạn</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(coupon => (
                    <tr key={coupon.id} className={!coupon.active || isExpired(coupon) ? 'row-inactive' : ''}>
                      <td>
                        <code className="coupon-code">{coupon.code}</code>
                        {coupon.description && <span className="coupon-desc">{coupon.description}</span>}
                      </td>
                      <td>
                        <span className={`type-badge ${coupon.type}`}>
                          {coupon.type === 'percent' ? '% Phần trăm' : coupon.type === 'fixed' ? '₫ Cố định' : '🚚 Free Ship'}
                        </span>
                      </td>
                      <td className="value-cell">{formatValue(coupon)}</td>
                      <td>{coupon.minOrder ? `${Number(coupon.minOrder).toLocaleString('vi-VN')}₫` : '—'}</td>
                      <td>
                        <span className="usage-count">
                          {coupon.usedCount || 0}{coupon.maxUses > 0 ? ` / ${coupon.maxUses}` : ' / ∞'}
                        </span>
                      </td>
                      <td>{coupon.expiryDate || '—'}</td>
                      <td>{getStatusBadge(coupon)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-icon" onClick={() => toggleActive(coupon)} title={coupon.active ? 'Tắt' : 'Bật'}>
                            {coupon.active ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            )}
                          </button>
                          <button className="btn-icon" onClick={() => handleEdit(coupon)} title="Sửa">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="btn-icon danger" onClick={() => handleDelete(coupon.id)} title="Xóa">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCouponManagement;
