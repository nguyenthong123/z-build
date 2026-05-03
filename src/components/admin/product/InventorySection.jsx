import React from 'react';

const InventorySection = ({ 
  stock, 
  trackInventory, 
  isTrending, 
  category, 
  status, 
  demoUrl, 
  quoteUrl, 
  onChange 
}) => {
  return (
    <section className="form-section card">
      <div className="section-header">
        <h3>KHO HÀNG</h3>
      </div>
      <div className="form-group">
        <label>Số lượng tồn kho</label>
        <input type="number" name="stock" placeholder="0" value={stock} onChange={onChange} />
      </div>
      <div className="toggle-group">
        <div className="toggle-info">
          <strong>Theo dõi kho hàng</strong>
          <span>Tự động cập nhật số lượng khi có đơn hàng</span>
        </div>
        <label className="switch">
          <input type="checkbox" name="trackInventory" checked={trackInventory} onChange={onChange} />
          <span className="slider round"></span>
        </label>
      </div>
      <div className="toggle-group">
        <div className="toggle-info">
          <strong>Đánh dấu là sản phẩm Trending</strong>
          <span>Sản phẩm sẽ hiển thị trong danh sách Xu hướng hiện nay</span>
        </div>
        <label className="switch">
          <input type="checkbox" name="isTrending" checked={isTrending} onChange={onChange} />
          <span className="slider round"></span>
        </label>
      </div>

      {category === 'Phần mềm & Dịch vụ' && (
        <div className="form-group" style={{ marginTop: '15px', padding: '15px', background: 'rgba(33, 150, 243, 0.05)', borderRadius: '10px' }}>
          <label>Đường dẫn Bản Demo</label>
          <input type="text" name="demoUrl" placeholder="https://demo.example.com" value={demoUrl || ''} onChange={onChange} />
        </div>
      )}

      {status === 'Phân phối' && (
        <div className="form-group" style={{ marginTop: '15px', padding: '15px', background: 'rgba(76, 175, 80, 0.05)', borderRadius: '10px' }}>
          <label>Đường dẫn Báo Giá Ngay</label>
          <input type="text" name="quoteUrl" placeholder="Link báo giá..." value={quoteUrl || ''} onChange={onChange} />
        </div>
      )}
    </section>
  );
};

export default InventorySection;
