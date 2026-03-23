import React from 'react';
import './Hero.css';

const Hero = () => {
  return (
    <section className="hero">
      <div className="container hero-container">
        <div className="hero-content animate-fade-in">
          <span className="hero-tag">GIẢI PHÁP XÂY DỰNG & CÔNG NGHỆ 4.0</span>
          <h1 className="hero-title">
            Cung cấp <span className="highlight">Vật liệu & Phần mềm</span> chuyên dụng cho ngành Thầu thợ
          </h1>
          <p className="hero-description">
            Từ tấm ván sợi xi măng Duraflex chất lượng cao đến hệ thống quản lý bán hàng thông minh, 
            chúng tôi mang tới giải pháp toàn diện để tối ưu hóa mọi công trình và doanh nghiệp.
          </p>
          <div className="hero-btns">
            <button className="btn btn-primary">Khám phá ngay</button>
            <button className="btn btn-secondary">Tư vấn giải pháp</button>
          </div>
        </div>
      </div>
      <div className="hero-overlay"></div>
    </section>
  );
};

export default Hero;
