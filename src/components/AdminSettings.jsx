import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import './AdminSettings.css';

const VIETNAMESE_BANKS = [
  { code: 'vcb', name: 'Vietcombank' },
  { code: 'vtb', name: 'VietinBank' },
  { code: 'bidv', name: 'BIDV' },
  { code: 'agribank', name: 'Agribank' },
  { code: 'mbbank', name: 'MBBank' },
  { code: 'techcombank', name: 'Techcombank' },
  { code: 'acb', name: 'ACB' },
  { code: 'vpbank', name: 'VPBank' },
  { code: 'tpbank', name: 'TPBank' },
  { code: 'sacombank', name: 'Sacombank' },
  { code: 'hdbank', name: 'HDBank' },
  { code: 'vib', name: 'VIB' },
  { code: 'shb', name: 'SHB' },
  { code: 'ocb', name: 'OCB' },
  { code: 'msb', name: 'MSB' },
  { code: 'seabank', name: 'SeABank' },
  { code: 'eximbank', name: 'Eximbank' },
  { code: 'lpbank', name: 'LPBank' },
  { code: 'momo', name: 'MoMo' },
];

const formatCurrencyToWords = (num) => {
  if (!num || isNaN(num)) return '';
  if (num >= 1000000000) return `${(num / 1000000000).toLocaleString('vi-VN')} tỷ`;
  if (num >= 1000000) return `${(num / 1000000).toLocaleString('vi-VN')} triệu`;
  if (num >= 1000) return `${(num / 1000).toLocaleString('vi-VN')} ngàn`;
  return `${num.toLocaleString('vi-VN')} đ`;
};

const AdminSettings = () => {
  const [bankInfo, setBankInfo] = useState({
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: ''
  });
  const [footerInfo, setFooterInfo] = useState({
    tagline: '',
    phone: '',
    email: '',
    address: '',
    copyright: ''
  });
  const [openClawConfig, setOpenClawConfig] = useState({
    dunvexApiKey: '',
    dunvexWebhookUrl: '',
    apiUrl: '',
    ownerId: ''
  });
  const [telegramChatConfig, setTelegramChatConfig] = useState({
    botToken: '',
    botConnected: false,
    chatId: '',
    groupForwardEnabled: false,
    enabled: false
  });
  const [adminEmails, setAdminEmails] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Dùng arrayUnion/arrayRemove để tránh race condition khi nhiều admin cùng sửa
  const addAdminEmail = async (email) => {
    try {
      const adminDocRef = doc(db, 'settings', 'admins');
      await updateDoc(adminDocRef, { emails: arrayUnion(email) });
    } catch (err) {
      console.error('Lỗi thêm admin email:', err);
      setToast({ message: 'Lỗi thêm phân quyền!', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const removeAdminEmail = async (email) => {
    try {
      const adminDocRef = doc(db, 'settings', 'admins');
      await updateDoc(adminDocRef, { emails: arrayRemove(email) });
    } catch (err) {
      console.error('Lỗi xoá admin email:', err);
      setToast({ message: 'Lỗi xoá phân quyền!', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAddAdmin = () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (email && !adminEmails.includes(email)) {
      setAdminEmails(prev => [...prev, email]);
      setNewAdminEmail('');
      addAdminEmail(email);
    }
  };

  const handleRemoveAdmin = (email) => {
    setAdminEmails(prev => prev.filter(e => e !== email));
    removeAdminEmail(email);
  };
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [shippingSettings, setShippingSettings] = useState({
    storeLat: '',
    storeLng: '',
    fallbackPricePerKg: 10000,
    distanceRules: [{ maxDistance: 10, pricePerKg: 5000 }],
    shippingDiscountRules: []
  });
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
          const raw = docSnap.data().openClawConfig;
          setOpenClawConfig({
            dunvexApiKey: raw.dunvexApiKey || raw.apiKey || raw.botApiKey || '',
            dunvexWebhookUrl: raw.dunvexWebhookUrl || raw.webhookUrl || '',
            apiUrl: raw.apiUrl || '',
            ownerId: raw.ownerId || ''
          });
        } else {
          setOpenClawConfig({ 
            dunvexApiKey: '',
            dunvexWebhookUrl: '',
            apiUrl: process.env.NEXT_PUBLIC_OPENCLAW_API_URL || 'http://localhost:8000/chat',
            ownerId: ''
          });
        }

        if (docSnap.exists() && docSnap.data().googleSheetUrl) {
          setGoogleSheetUrl(docSnap.data().googleSheetUrl);
        } else {
          setGoogleSheetUrl("https://script.google.com/macros/s/AKfycbyjxwNzi7j1KMpLdrYFfPzYFYhEmFhb9ercrPho5CMXCTRKE_dx0iaoYOFwP8t20gZG/exec");
        }

        if (docSnap.exists() && docSnap.data().shippingSettings) {
          setShippingSettings(docSnap.data().shippingSettings);
        }

        if (docSnap.exists() && docSnap.data().footerInfo) {
          setFooterInfo(docSnap.data().footerInfo);
        } else {
          setFooterInfo({
            tagline: 'Giải pháp vật liệu xây dựng & công nghệ quản lý bán hàng dành cho nhà thầu, đại lý chuyên nghiệp.',
            phone: '0905 123 456',
            email: 'contact@zbuild.click',
            address: '123 Đường ABC, Quận XYZ, TP. HCM',
            copyright: '2026 ZBUILD Store. Bảo lưu mọi quyền.'
          });
        }

        if (docSnap.exists() && docSnap.data().telegramChatConfig) {
          setTelegramChatConfig(docSnap.data().telegramChatConfig);
        } else {
          setTelegramChatConfig({
            botToken: '',
            botConnected: false,
            chatId: '',
            groupForwardEnabled: false,
            enabled: false
          });
        }

        const adminDocRef = doc(db, 'settings', 'admins');
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists() && adminSnap.data().emails) {
          setAdminEmails(adminSnap.data().emails);
        } else {
          setAdminEmails((process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'nbt1024@gmail.com').split(','));
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
      await setDoc(docRef, { bankInfo, openClawConfig, googleSheetUrl, shippingSettings, footerInfo, telegramChatConfig }, { merge: true });

      setToast({ message: 'Lưu cấu hình thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu cài đặt:', err);
      setToast({ message: 'Có lỗi xảy ra khi lưu!', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleToggleBotConnection = async () => {
    const isConnecting = !telegramChatConfig.botConnected;
    if (isConnecting && !telegramChatConfig.botToken.trim()) {
      alert("Vui lòng nhập Telegram Bot Token trước khi kết nối!");
      return;
    }

    setIsSaving(true);
    try {
      // First save current state to DB
      const docRef = doc(db, 'storeSettings', 'main');
      const updatedConfig = {
        ...telegramChatConfig,
        botConnected: isConnecting
      };
      
      await setDoc(docRef, { telegramChatConfig: updatedConfig }, { merge: true });
      setTelegramChatConfig(updatedConfig);

      // Call backend function API to register/unregister webhook
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal 
        ? "https://us-central1-z-build-dunvex.cloudfunctions.net/server"
        : "";
      const response = await fetch(`${baseUrl}/api/setup-telegram-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramChatConfig.botToken.trim(),
          botConnected: isConnecting
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Không thể thiết lập Webhook Bot");
      }

      setToast({
        message: isConnecting 
          ? 'Đăng ký Webhook Telegram Bot thành công!' 
          : 'Đã xoá Webhook Telegram Bot thành công!',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối Telegram: " + err.message);
      // Revert state
      const docRef = doc(db, 'storeSettings', 'main');
      const reverted = {
        ...telegramChatConfig,
        botConnected: !isConnecting
      };
      await setDoc(docRef, { telegramChatConfig: reverted }, { merge: true });
      setTelegramChatConfig(reverted);
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleGetStoreLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setShippingSettings(prev => ({
            ...prev,
            storeLat: position.coords.latitude,
            storeLng: position.coords.longitude
          }));
          setToast({ message: 'Lấy vị trí thành công!', type: 'success' });
          setTimeout(() => setToast(null), 3000);
        },
        () => {
          setToast({ message: 'Không thể lấy vị trí. Vui lòng cho phép quyền truy cập vị trí.', type: 'error' });
          setTimeout(() => setToast(null), 3000);
        }
      );
    } else {
      setToast({ message: 'Trình duyệt của bạn không hỗ trợ định vị.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="admin-product-page">
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
                  <button className="home-icon-btn desktop-only" onClick={() => window.location.href = '/'} title="Về trang chủ">
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
                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Ngân hàng nhận thanh toán</label>
                    <select 
                      name="bankCode" 
                      value={bankInfo.bankCode} 
                      onChange={(e) => {
                        const selectedBank = VIETNAMESE_BANKS.find(b => b.code === e.target.value);
                        setBankInfo(prev => ({
                          ...prev,
                          bankCode: e.target.value,
                          bankName: selectedBank ? selectedBank.name : e.target.value
                        }));
                      }} 
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '15px' }}
                    >
                      <option value="">-- Chọn ngân hàng --</option>
                      {VIETNAMESE_BANKS.map(bank => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name} ({bank.code.toUpperCase()})
                        </option>
                      ))}
                    </select>
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
                  <h3>🤖 Cấu hình Kết nối Dunvex</h3>
                  <p>Nhập API Key & Webhook URL từ trang Cài Đặt của Dunvex để đồng bộ dữ liệu.</p>
                </div>

                {/* ── API Key Dunvex ── */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔑</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px' }}>API Key (từ Dunvex)</span>
                  </div>
                  <input 
                    type="text" 
                    value={openClawConfig.dunvexApiKey} 
                    onChange={(e) => setOpenClawConfig({ ...openClawConfig, dunvexApiKey: e.target.value })} 
                    placeholder="dvx_... (copy từ Cài Đặt Dunvex → API & Webhook)"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#fff', fontFamily: 'monospace' }}
                  />
                  <p className="field-hint" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Vào Dunvex → ⚙️ Cài Đặt → API & Webhook → copy API Key <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px', fontSize: '10px' }}>dvx_...</code> dán vào đây.
                  </p>
                </div>

                {/* ── Webhook URL Dunvex ── */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🌐</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px' }}>Webhook URL (từ Dunvex)</span>
                  </div>
                  <input 
                    type="text" 
                    value={openClawConfig.dunvexWebhookUrl} 
                    onChange={(e) => setOpenClawConfig({ ...openClawConfig, dunvexWebhookUrl: e.target.value })} 
                    placeholder="https://dunvex-build-xxx.vercel.app/api/order-webhook?token=wh_..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', fontFamily: 'monospace' }}
                  />
                  <p className="field-hint" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Vào Dunvex → ⚙️ Cài Đặt → API & Webhook → copy Webhook URL dán vào đây.
                  </p>
                </div>

                {/* ── API Endpoint ── */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔗</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px' }}>API Endpoint (Chat AI)</span>
                  </div>
                  <input 
                    type="text" 
                    value={openClawConfig.apiUrl} 
                    onChange={(e) => setOpenClawConfig({ ...openClawConfig, apiUrl: e.target.value })} 
                    placeholder="http://localhost:8000/chat hoặc ngrok url..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#fff' }}
                  />
                  <p className="field-hint" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    * URL kết nối tới AI Chatbot (OpenClaw). Nếu web chạy HTTPS, Endpoint <strong>PHẢI</strong> là HTTPS.
                  </p>
                </div>

                {/* ── Owner ID ── */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🏪</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px' }}>Mã cửa hàng (Owner ID)</span>
                  </div>
                  <input 
                    type="text" 
                    value={openClawConfig.ownerId || ''} 
                    onChange={(e) => setOpenClawConfig({ ...openClawConfig, ownerId: e.target.value })} 
                    placeholder="Nhập Owner ID trên Dunvex..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#fff' }}
                  />
                  <p className="field-hint" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Mã định danh cửa hàng trên Dunvex. Dùng để đồng bộ dữ liệu & xác thực.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="settings-panel" style={{ marginTop: '24px' }}>
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2z"/></svg> Cấu hình Vận chuyển (Giao tới nơi)</h3>
                  <p>Cài đặt phí vận chuyển dựa trên khoảng cách từ kho đến khách hàng.</p>
                </div>
                
                <div className="setting-field">
                  <label>Vĩ độ Kho hàng (Lat)</label>
                  <input 
                    type="number" 
                    value={shippingSettings.storeLat} 
                    onChange={(e) => setShippingSettings(prev => ({ ...prev, storeLat: parseFloat(e.target.value) || '' }))}
                    placeholder="VD: 10.762622"
                  />
                </div>
                <div className="setting-field">
                  <label>Kinh độ Kho hàng (Lng)</label>
                  <input 
                    type="number" 
                    value={shippingSettings.storeLng} 
                    onChange={(e) => setShippingSettings(prev => ({ ...prev, storeLng: parseFloat(e.target.value) || '' }))}
                    placeholder="VD: 106.660172"
                  />
                </div>
                
                <button type="button" className="btn-secondary" onClick={handleGetStoreLocation} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> Lấy vị trí hiện tại của tôi (Làm vị trí Kho)
                </button>

                <div className="setting-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ margin: 0 }}>Các mốc phí vận chuyển</label>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => setShippingSettings(prev => ({
                        ...prev,
                        distanceRules: [...(prev.distanceRules || []), { maxDistance: '', pricePerKg: '' }]
                      }))}
                      style={{ padding: '4px 10px', fontSize: '13px' }}
                    >
                      + Thêm mốc mới
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(shippingSettings.distanceRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>Dưới bao nhiêu Km?</span>
                          <input 
                            type="number" 
                            placeholder="VD: 10"
                            value={rule.maxDistance}
                            onChange={(e) => {
                              const newRules = [...shippingSettings.distanceRules];
                              newRules[idx].maxDistance = e.target.value !== '' ? parseFloat(e.target.value) : '';
                              setShippingSettings(prev => ({ ...prev, distanceRules: newRules }));
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>Giá 1 kg (VNĐ)</span>
                          <input 
                            type="number" 
                            placeholder="VD: 5000"
                            value={rule.pricePerKg}
                            onChange={(e) => {
                              const newRules = [...shippingSettings.distanceRules];
                              newRules[idx].pricePerKg = e.target.value !== '' ? parseInt(e.target.value) : '';
                              setShippingSettings(prev => ({ ...prev, distanceRules: newRules }));
                            }}
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newRules = [...shippingSettings.distanceRules];
                            newRules.splice(idx, 1);
                            setShippingSettings(prev => ({ ...prev, distanceRules: newRules }));
                          }}
                          style={{ background: 'none', border: 'none', color: '#E11D48', cursor: 'pointer', padding: '5px', marginTop: '20px' }}
                          title="Xóa mốc này"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    ))}
                    {(!shippingSettings.distanceRules || shippingSettings.distanceRules.length === 0) && (
                      <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', padding: '10px' }}>Chưa có mốc phí nào.</div>
                    )}
                  </div>
                </div>

                <div className="setting-field" style={{ marginTop: '15px' }}>
                  <label>Đơn giá mặc định khi vượt mốc (VNĐ/kg)</label>
                  <input 
                    type="number" 
                    value={shippingSettings.fallbackPricePerKg} 
                    onChange={(e) => setShippingSettings(prev => ({ ...prev, fallbackPricePerKg: parseInt(e.target.value) || 0 }))}
                    placeholder="10000"
                  />
                  <p className="field-hint" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    * Áp dụng nếu khoảng cách lớn hơn tất cả các mốc bạn đã cấu hình ở trên.
                  </p>
                </div>

                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: '#111' }}>🎁 Khuyến mãi vận chuyển theo giá trị đơn hàng</h4>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => setShippingSettings(prev => ({
                        ...prev,
                        shippingDiscountRules: [...(prev.shippingDiscountRules || []), { minOrderValue: '', discountPercent: '' }]
                      }))}
                      style={{ padding: '4px 10px', fontSize: '13px' }}
                    >
                      + Thêm mốc mới
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(shippingSettings.shippingDiscountRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#fff3cd', padding: '10px', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>Đơn hàng từ (VNĐ)</span>
                          <input 
                            type="number" 
                            placeholder="VD: 15000000"
                            value={rule.minOrderValue}
                            onChange={(e) => {
                              const newRules = [...shippingSettings.shippingDiscountRules];
                              newRules[idx].minOrderValue = e.target.value !== '' ? parseInt(e.target.value) : '';
                              setShippingSettings(prev => ({ ...prev, shippingDiscountRules: newRules }));
                            }}
                          />
                          {rule.minOrderValue !== '' && rule.minOrderValue !== undefined && (
                            <span style={{ fontSize: '12px', color: '#d97706', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                              💡 Tương đương: {formatCurrencyToWords(rule.minOrderValue)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>Giảm phí vận chuyển (%)</span>
                          <input 
                            type="number" 
                            placeholder="VD: 50"
                            value={rule.discountPercent}
                            min="0"
                            max="100"
                            onChange={(e) => {
                              const newRules = [...shippingSettings.shippingDiscountRules];
                              newRules[idx].discountPercent = e.target.value !== '' ? parseInt(e.target.value) : '';
                              setShippingSettings(prev => ({ ...prev, shippingDiscountRules: newRules }));
                            }}
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newRules = [...shippingSettings.shippingDiscountRules];
                            newRules.splice(idx, 1);
                            setShippingSettings(prev => ({ ...prev, shippingDiscountRules: newRules }));
                          }}
                          style={{ background: 'none', border: 'none', color: '#E11D48', cursor: 'pointer', padding: '5px', marginTop: '20px' }}
                          title="Xóa mốc này"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    ))}
                    {(!shippingSettings.shippingDiscountRules || shippingSettings.shippingDiscountRules.length === 0) && (
                      <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', padding: '10px' }}>Chưa có cấu hình khuyến mãi vận chuyển nào.</div>
                    )}
                  </div>
                  <p className="field-hint" style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                    * Hệ thống sẽ tự động chọn mốc khuyến mãi tốt nhất phù hợp với giá trị đơn hàng.
                  </p>
                </div>
              </div>
            </div>
            <div className="settings-panel" style={{ marginTop: '24px' }}>
              <div className="settings-section">
                <div className="settings-section-header">
                  <h3>📝 Cấu hình Chân trang (Footer)</h3>
                  <p>Thiết lập các thông tin liên hệ và bản quyền hiển thị dưới chân trang web.</p>
                </div>
                <div className="settings-form-grid">
                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Tagline / Mô tả ngắn</label>
                    <textarea 
                      value={footerInfo.tagline} 
                      onChange={(e) => setFooterInfo({ ...footerInfo, tagline: e.target.value })} 
                      placeholder="Nhập mô tả ngắn dưới logo..."
                      rows={2}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '15px', outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                  <div className="setting-field">
                    <label>Số điện thoại / Hotline</label>
                    <input 
                      type="text" 
                      value={footerInfo.phone} 
                      onChange={(e) => setFooterInfo({ ...footerInfo, phone: e.target.value })} 
                      placeholder="Nhập hotline..."
                    />
                  </div>
                  <div className="setting-field">
                    <label>Email liên hệ</label>
                    <input 
                      type="email" 
                      value={footerInfo.email} 
                      onChange={(e) => setFooterInfo({ ...footerInfo, email: e.target.value })} 
                      placeholder="Nhập email..."
                    />
                  </div>
                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Địa chỉ</label>
                    <input 
                      type="text" 
                      value={footerInfo.address} 
                      onChange={(e) => setFooterInfo({ ...footerInfo, address: e.target.value })} 
                      placeholder="Nhập địa chỉ văn phòng..."
                    />
                  </div>
                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Thông tin bản quyền (Copyright)</label>
                    <input 
                      type="text" 
                      value={footerInfo.copyright} 
                      onChange={(e) => setFooterInfo({ ...footerInfo, copyright: e.target.value })} 
                      placeholder="VD: 2026 ZBUILD Store. Bảo lưu mọi quyền."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Telegram Live Chat Settings */}
            <div className="settings-panel" style={{ marginTop: '24px' }}>
              <div className="settings-section">
                <div className="settings-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h3>💬 Cấu hình Telegram Live Chat</h3>
                    <p>Thiết lập kết nối với Telegram Bot để chuyển tiếp tin nhắn và chat trực tiếp với khách hàng.</p>
                  </div>
                  <div className="switch-container">
                    <span className="switch-label">Kích hoạt Live Chat (Thay AI)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={telegramChatConfig.enabled || false}
                        onChange={(e) => setTelegramChatConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-form-grid" style={{ marginTop: '20px' }}>
                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ margin: 0 }}>Telegram Bot Token</label>
                      <div className="switch-container">
                        <span className="switch-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {telegramChatConfig.botConnected ? "🟢 Đã kết nối" : "🔴 Ngắt kết nối"}
                        </span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={telegramChatConfig.botConnected || false}
                            onChange={handleToggleBotConnection}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="VD: 5849302195:AAH6vQ4g..."
                      value={telegramChatConfig.botToken || ''}
                      onChange={(e) => setTelegramChatConfig(prev => ({ ...prev, botToken: e.target.value }))}
                      disabled={telegramChatConfig.botConnected}
                    />
                    <p className="field-hint" style={{ fontSize: '12px', color: '#64748B', marginTop: '5px' }}>
                      * Nhập Token từ @BotFather. Khi bật công tắc "Kết nối", hệ thống sẽ tự động đăng ký Webhook nhận tin nhắn.
                    </p>
                  </div>

                  <div className="setting-field" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ margin: 0 }}>Telegram Chat ID / Nhóm ID</label>
                      <div className="switch-container">
                        <span className="switch-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Gửi vào Nhóm
                        </span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={telegramChatConfig.groupForwardEnabled || false}
                            onChange={(e) => setTelegramChatConfig(prev => ({ ...prev, groupForwardEnabled: e.target.checked }))}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="VD: -1001859384725 hoặc 59284720"
                      value={telegramChatConfig.chatId || ''}
                      onChange={(e) => setTelegramChatConfig(prev => ({ ...prev, chatId: e.target.value }))}
                    />
                    <p className="field-hint" style={{ fontSize: '12px', color: '#64748B', marginTop: '5px' }}>
                      * ID của nhóm chat hoặc ID tài khoản Telegram nhận tin nhắn. Đối với nhóm siêu riêng tư (Supergroup), ID thường có tiền tố `-100`.
                    </p>
                  </div>
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
                      placeholder="Nhập email (VD: admin@zbuild.click)" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAdmin();
                        }
                      }}
                    />
                    <button 
                      type="button"
                      className="btn-add-role"
                      onClick={handleAddAdmin}
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
                            onClick={() => handleRemoveAdmin(email)}
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
