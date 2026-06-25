import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './Footer.css';

const Footer = () => {
  const [footerInfo, setFooterInfo] = useState({
    tagline: 'Giải pháp vật liệu xây dựng & công nghệ quản lý bán hàng dành cho nhà thầu, đại lý chuyên nghiệp.',
    copyright: '2026 ZBUILD Store. Bảo lưu mọi quyền.',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    const fetchFooter = async () => {
      try {
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().footerInfo) {
          setFooterInfo(prev => ({
            ...prev,
            ...docSnap.data().footerInfo
          }));
        }
      } catch (err) {
        console.error("Lỗi tải cấu hình chân trang:", err);
      }
    };
    fetchFooter();
  }, []);

  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <div className="logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM7 7H17V9L10 15H17V17H7V15L14 9H7V7Z" fill="currentColor"/>
              </svg>
            </div>
            <span className="logo-text">ZBUILD</span>
          </div>
          <p>{footerInfo.tagline}</p>
          {(footerInfo.phone || footerInfo.email || footerInfo.address) && (
            <div className="footer-contact-info" style={{ marginTop: '15px', fontSize: '14px', color: '#a0aec0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {footerInfo.phone && <div>📞 Hotline: {footerInfo.phone}</div>}
              {footerInfo.email && <div>✉️ Email: {footerInfo.email}</div>}
              {footerInfo.address && <div>📍 Địa chỉ: {footerInfo.address}</div>}
            </div>
          )}
          <div className="social-links">
            {/* Social icons */}
          </div>
        </div>
        
        <div className="footer-links">
          <h4>Sản phẩm</h4>
          <ul>
            <li><a href="#">Vật liệu xây dựng</a></li>
            <li><a href="#">Phần mềm quản lý</a></li>
            <li><a href="#">Thi công & Lắp đặt</a></li>
            <li><a href="#">Trang trí nội thất</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h4>Công ty</h4>
          <ul>
            <li><a href="#">Giới thiệu</a></li>
            <li><a href="#">Liên hệ</a></li>
            <li><a href="#">Tuyển dụng</a></li>
            <li><a href="#">Tin tức</a></li>
          </ul>
        </div>

        <div className="footer-newsletter">
          <h4>Đăng ký nhận tin</h4>
          <p>Nhận thông tin khuyến mãi và cập nhật sản phẩm mới nhất.</p>
          <div className="newsletter-form">
            <input type="email" placeholder="Nhập email của bạn" />
            <button aria-label="Đăng ký nhận bản tin email">Đăng ký</button>
          </div>
        </div>
      </div>
      <div className="footer-bottom container">
        <p>&copy; {footerInfo.copyright}</p>
        <div className="footer-policy">
          <a href="/chinh-sach-bao-mat">Chính sách bảo mật</a>
          <a href="/dieu-khoan-su-dung">Điều khoản sử dụng</a>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
