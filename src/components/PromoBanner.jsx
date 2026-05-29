import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import './PromoBanner.css';

const PromoBanner = () => {
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [timeLeft, setTimeLeft] = useState({
    hours: 12,
    minutes: 45,
    seconds: 30
  });

  useEffect(() => {
    // Lấy mã giảm giá mới nhất đang hoạt động
    const fetchCoupon = async () => {
      try {
        const q = query(collection(db, 'coupons'), where('active', '==', true), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setActiveCoupon(snapshot.docs[0].data());
        }
      } catch (err) {
        console.error("Lỗi khi tải mã giảm giá cho banner:", err);
      }
    };
    fetchCoupon();

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
          <h2>
            {activeCoupon 
              ? `Flash Sale: Giảm ngay ${activeCoupon.type === 'percent' ? activeCoupon.value + '%' : Number(activeCoupon.value).toLocaleString('vi-VN') + '₫'}!`
              : 'Flash Sale: Giảm tới 20% Vật liệu!'}
          </h2>
          <p>
            {activeCoupon && activeCoupon.description 
              ? activeCoupon.description 
              : 'Nhận ngay ưu đãi đặc biệt cho tấm Duraflex, vật tư xây dựng và phần mềm quản lý. Giá đã được giảm trực tiếp!'}
          </p>
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
