import React from 'react';

const PricingSection = ({ 
  basePrice, 
  discountPrice, 
  status, 
  category, 
  pricingType, 
  monthlyPrice, 
  yearlyPrice, 
  onChange, 
  setProduct 
}) => {
  return (
    <section className="form-section card">
      <div className="section-header">
        <h3>GIÁ CẢ</h3>
      </div>
      <div className="form-group">
        <label>{status === 'Phân phối' ? 'Giá tới nơi' : 'Giá gốc'}</label>
        <div className="input-with-prefix">
          <span className="prefix">VNĐ</span>
          <input type="number" name="basePrice" placeholder="0" value={basePrice} onChange={onChange} />
        </div>
      </div>
      <div className="form-group">
        <label>{status === 'Phân phối' ? 'Chính hãng (Tùy chọn)' : 'Giá khuyến mãi'}</label>
        <div className="input-with-prefix">
          <span className="prefix">VNĐ</span>
          <input type="number" name="discountPrice" placeholder="0" value={discountPrice} onChange={onChange} />
        </div>
      </div>

      {category === 'Phần mềm & Dịch vụ' && (
        <div className="advanced-pricing-box" style={{ marginTop: '15px', padding: '15px', background: '#f0f7ff', borderRadius: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#004085' }}>CẤU HÌNH GIÁ THUÊ BAO</label>
          <div className="form-group">
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setProduct(prev => ({ ...prev, pricingType: 'one-time' }))}
                className={pricingType === 'one-time' ? 'active' : ''}
                style={{ flex: 1, padding: '8px' }}
              >Mua một lần</button>
              <button 
                type="button" 
                onClick={() => setProduct(prev => ({ ...prev, pricingType: 'subscription' }))}
                className={pricingType === 'subscription' ? 'active' : ''}
                style={{ flex: 1, padding: '8px' }}
              >Thuê bao</button>
            </div>
          </div>
          {pricingType === 'subscription' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input type="number" name="monthlyPrice" placeholder="VNĐ / tháng" value={monthlyPrice} onChange={onChange} />
              <input type="number" name="yearlyPrice" placeholder="VNĐ / năm" value={yearlyPrice} onChange={onChange} />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PricingSection;
