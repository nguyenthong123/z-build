import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import './Profile.css';
import AccountSidebar from './AccountSidebar';

const Profile = ({ user, onBack, onNavigate, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { addToast } = useToast();
  
  const isGoogleLinked = auth.currentUser?.providerData?.some(provider => provider.providerId === 'google.com');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        onNavigate('home');
        return;
      }

      setFormData({
        fullName: user.displayName || '',
        email: user.email || '',
        phone: '' // Initial value, will be fetched from Firestore
      });

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFormData(prev => ({
            ...prev,
            fullName: userData.fullName || user.displayName || '',
            phone: userData.phone || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [onNavigate]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      // 1. Update Firebase Auth Profile (DisplayName)
      await updateProfile(user, {
        displayName: formData.fullName
      });

      // 2. Update Firestore for additional info (phone, etc.)
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const updateData = {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        updatedAt: new Date()
      };

      if (userDoc.exists()) {
        await updateDoc(userDocRef, updateData);
      } else {
        await setDoc(userDocRef, {
          ...updateData,
          createdAt: new Date()
        });
      }

      addToast("Cập nhật thông tin thành công!", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      addToast("Không thể cập nhật thông tin. Vui lòng thử lại.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      addToast("Vui lòng nhập đầy đủ thông tin mật khẩu!", "warning");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addToast("Mật khẩu mới không khớp!", "error");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      addToast("Mật khẩu mới phải từ 6 ký tự trở lên!", "warning");
      return;
    }

    setUpdatingPassword(true);
    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      addToast("Đổi mật khẩu thành công!", "success");
    } catch (error) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/wrong-password') {
        addToast("Mật khẩu hiện tại không chính xác.", "error");
      } else {
        addToast("Có lỗi xảy ra. Hãy chắc chắn bạn vừa đăng nhập gần đây.", "error");
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center' }}>Đang tải thông tin...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Sidebar */}
        <AccountSidebar user={user} activeView="profile" onViewChange={onNavigate} onLogout={onLogout} />

        {/* Main Content */}
        <div className="profile-content">
          <header className="content-header">
            <div className="header-mobile">
              <button className="back-btn" onClick={onBack}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <h2>Hồ sơ của tôi</h2>
            </div>
            
            <div className="title-section desktop-only">
              <h1>Thông tin cá nhân</h1>
              <p>Cập nhật chi tiết cá nhân và thông tin liên lạc của bạn để giữ cho hồ sơ luôn mới nhất.</p>
            </div>
          </header>

          <div className="profile-sections">
            {/* Personal Information Card */}
            <section className="profile-card">
              <div className="card-body">
                <div className="form-group full-width">
                  <label>Họ và tên</label>
                  <input 
                    type="text" 
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleFormChange}
                    placeholder="Nhập họ và tên đầy đủ"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Địa chỉ Email</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      disabled
                      placeholder="Email"
                      style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    className="save-btn" 
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </section>

            {/* Change Password Card */}
            <section className="profile-card">
              <div className="card-header">
                <div className="header-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3>Đổi mật khẩu</h3>
              </div>
              
              {isGoogleLinked ? (
                <div className="card-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#DB4437" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px' }}>
                     <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <h4 style={{ color: '#1E293B', marginBottom: '8px' }}>Xác thực qua Google</h4>
                  <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: '1.5' }}>Bạn đang đăng nhập bằng Google. Bảo mật và mật khẩu của bạn được quản lý an toàn bởi tài khoản Google nên không cần thiết lập ở đây.</p>
                </div>
              ) : (
              <div className="card-body">
                <div className="form-group full-width">
                  <label>Mật khẩu hiện tại</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="••••••••••••"
                      style={{ paddingRight: '45px' }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '5px' }}>
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Mật khẩu mới</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Nhập mật khẩu mới"
                        style={{ paddingRight: '45px' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '5px' }}>
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Xác nhận mật khẩu mới"
                        style={{ paddingRight: '45px' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '5px' }}>
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    className="update-btn"
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword}
                  >
                    {updatingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </div>
              )}
            </section>

            {/* Account Actions */}
            <div className="account-footer-actions">
              <button 
                className="delete-account-btn"
                onClick={() => addToast("Tính năng này hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.", "info")}
              >
                Xoá tài khoản
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
