import React from 'react';
import './Footer.css';

const Footer = () => {
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
          <p>Giải pháp vật liệu xây dựng & công nghệ quản lý bán hàng dành cho nhà thầu, đại lý chuyên nghiệp.</p>
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
            <button>Đăng ký</button>
          </div>
        </div>
      </div>
      <div className="footer-bottom container">
        <p>&copy; 2026 ZBUILD Store. Bảo lưu mọi quyền.</p>
        <div className="footer-policy">
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Điều khoản sử dụng</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
