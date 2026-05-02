import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import './AdminSettings.css';

const AdminSettings = ({ onBack }) => {
  const [bankInfo, setBankInfo] = useState({
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: ''
  });
  const [openClawConfig, setOpenClawConfig] = useState({
    apiUrl: ''
  });
  const [adminEmails, setAdminEmails] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().bankInfo) {
          setBankInfo(docSnap.data().bankInfo);
        } else {
          setBankInfo({ bankCode: 'vcb', bankName: 'Vietcombank', accountNumber: '1014845876', accountName: 'NGUYEN BA TRUNG' });
        }

        if (docSnap.exists() && docSnap.data().openClawConfig) {
          setOpenClawConfig(docSnap.data().openClawConfig);
        } else {
          setOpenClawConfig({ apiUrl: import.meta.env.VITE_OPENCLAW_API_URL || 'http://localhost:8000/chat' });
        }

        const adminDocRef = doc(db, 'settings', 'admins');
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists() && adminSnap.data().emails) {
          setAdminEmails(adminSnap.data().emails);
        } else {
          setAdminEmails((import.meta.env.VITE_ADMIN_EMAILS || 'nbt1024@gmail.com').split(','));
        }
      } catch (err) {
        console.error('Lỗi khi tải cài đặt:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBankInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'storeSettings', 'main');
      await setDoc(docRef, { bankInfo, openClawConfig }, { merge: true });

      const adminDocRef = doc(db, 'settings', 'admins');
      await setDoc(adminDocRef, { emails: adminEmails }, { merge: true });

      setToast({ message: 'Lưu cấu hình thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu cài đặt:', err);
      setToast({ message: 'Có lỗi xảy ra khi lưu!', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="settings" />
      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Cài đặt hệ thống</span></nav>
          
          <div className="header-main-row">
             <div className="title-group">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2em' }}>⚙️</span> Cài đặt & Cấu hình
                </h1>
                <p className="description">Quản lý các cấu hình chung, thông tin thanh toán của cửa hàng.</p>
             </div>
             
             <div className="header-actions-group">
                <div className="btn-group">
                  <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </button>
                  <button className="primary-add-btn" onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? (
                       <div className="spinner-border"></div>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        <span className="desktop-only">Lưu cài đặt</span>
                      </>
                    )}
                  </button>
                </div>
             </div>
          </div>
        </header>

        <div className="admin-content-body">
          {isLoading ? (
            <div className="settings-loading">
              <div className="spinner"></div>
              <p>Đang tải cấu hình...</p>
            </div>
          ) : (
            <>
            <div className="settings-panel">
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3>🏦 Thông tin Ngân hàng (VietQR)</h3>
                  <p>Thông tin này sẽ được sử dụng để tạo mã QR tự động ở phần thanh toán.</p>
                </div>
                <div className="settings-form-grid">
                  <div className="setting-field">
                    <label>Mã Ngân hàng (VD: vcb, vtb, bidv)</label>
                    <input 
                      type="text" 
                      name="bankCode" 
                      value={bankInfo.bankCode} 
                      onChange={handleChange} 
                      placeholder="vcb"
                    />
                  </div>
                  <div className="setting-field">
                    <label>Tên Ngân hàng</label>
                    <input 
                      type="text" 
                      name="bankName" 
                      value={bankInfo.bankName} 
                      onChange={handleChange} 
                      placeholder="Vietcombank"
                    />
                  </div>
                  <div className="setting-field">
                    <label>Số tài khoản</label>
                    <input 
                      type="text" 
                      name="accountNumber" 
                      value={bankInfo.accountNumber} 
                      onChange={handleChange} 
                      placeholder="Nhập số tài khoản..."
                    />
                  </div>
                  <div className="setting-field">
                    <label>Tên chủ tài khoản (Không dấu)</label>
                    <input 
                      type="text" 
                      name="accountName" 
                      value={bankInfo.accountName} 
                      onChange={handleChange} 
                      placeholder="NGUYEN VAN A"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="settings-panel" style={{ marginTop: '24px' }}>
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3>🤖 Cấu hình OpenClaw Bot</h3>
                  <p>Thiết lập kết nối với AI Advisor chạy trên Termux hoặc Server riêng.</p>
                </div>
                <div className="setting-field" style={{ maxWidth: '100%' }}>
                  <label>API Endpoint (URL Chat)</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      value={openClawConfig.apiUrl} 
                      onChange={(e) => setOpenClawConfig({ ...openClawConfig, apiUrl: e.target.value })} 
                      placeholder="http://localhost:8000/chat hoặc ngrok url..."
                      style={{ flex: 1 }}
                    />
                  </div>
                  <p className="field-hint" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    * Lưu ý: Nếu trang web chạy HTTPS, API Endpoint cũng <strong>PHẢI</strong> là HTTPS (sử dụng Ngrok hoặc Cloudflare Tunnel).
                  </p>
                </div>
              </div>
            </div>
            
            <div className="settings-panel" style={{ marginTop: '24px' }}>
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Phân quyền Quản trị viên</h3>
                  <p>Thêm hoặc xóa Email của những người được phép truy cập vào trang Quản trị.</p>
                </div>
                
                <div className="roles-management">
                  <div className="add-role-group">
                    <input 
                      type="email" 
                      placeholder="Nhập email (VD: admin@zbuild.vn)" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newAdminEmail.trim() && !adminEmails.includes(newAdminEmail.trim().toLowerCase())) {
                            setAdminEmails([...adminEmails, newAdminEmail.trim().toLowerCase()]);
                            setNewAdminEmail('');
                          }
                        }
                      }}
                    />
                    <button 
                      type="button"
                      className="btn-add-role"
                      onClick={() => {
                        if (newAdminEmail.trim() && !adminEmails.includes(newAdminEmail.trim().toLowerCase())) {
                          setAdminEmails([...adminEmails, newAdminEmail.trim().toLowerCase()]);
                          setNewAdminEmail('');
                        }
                      }}
                    >
                      Thêm
                    </button>
                  </div>

                  <div className="roles-list">
                    {adminEmails.map((email, idx) => (
                      <div className="role-item" key={idx}>
                        <div className="role-user">
                           <div className="role-avatar">{email.charAt(0).toUpperCase()}</div>
                           <div className="role-info">
                             <span className="role-email">{email}</span>
                             <span className="role-badge">Admin</span>
                           </div>
                        </div>
                        {email.toLowerCase() !== 'nbt1024@gmail.com' ? (
                          <button 
                            className="btn-remove-role"
                            onClick={() => setAdminEmails(adminEmails.filter(e => e !== email))}
                            title="Xóa quyền"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </button>
                        ) : (
                          <span className="role-root-badge" title="Tài khoản gốc không thể khóa">Root</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
          )}
        </div>

        {toast && (
          <div className={`settings-toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
