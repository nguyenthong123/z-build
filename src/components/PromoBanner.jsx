import React, { useState, useEffect } from 'react';
import './PromoBanner.css';

const PromoBanner = () => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 12,
    minutes: 45,
    seconds: 30
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) seconds--;
        else {
          seconds = 59;
          if (minutes > 0) minutes--;
          else {
            minutes = 59;
            if (hours > 0) hours--;
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="promo-banner container">
      <div className="banner-content">
        <div className="banner-text">
          <span className="badge-promo">ƯU ĐÃI CÓ HẠN</span>
          <h2>Flash Sale: Giảm tới 20% Vật liệu!</h2>
          <p>Nhận ngay ưu đãi đặc biệt cho tấm Duraflex, vật tư xây dựng và phần mềm quản lý. Số lượng có hạn!</p>
        </div>
        
        <div className="countdown">
          <div className="time-unit">
            <span className="value">{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className="label">Giờ</span>
          </div>
          <div className="separator">:</div>
          <div className="time-unit">
            <span className="value">{timeLeft.minutes.toString().padStart(2, '0')}</span>
            <span className="label">Phút</span>
          </div>
          <div className="separator">:</div>
          <div className="time-unit">
            <span className="value">{timeLeft.seconds.toString().padStart(2, '0')}</span>
            <span className="label">Giây</span>
          </div>
        </div>

        <button className="claim-btn" aria-label="Nhận ưu đãi giảm giá ngay">Nhận ngay</button>
      </div>
    </section>
  );
};

export default PromoBanner;
