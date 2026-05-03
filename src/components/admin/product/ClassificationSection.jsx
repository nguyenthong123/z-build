import React from 'react';

const ClassificationSection = ({ status, category, onChange }) => {
  return (
    <section className="form-section card">
      <div className="section-header">
        <h3>PHÂN LOẠI</h3>
      </div>
      <div className="form-group">
        <label>Trạng thái</label>
        <select name="status" value={status} onChange={onChange}>
          <option value="Active">Hoạt động</option>
          <option value="Phân phối">Phân phối</option>
          <option value="Draft">Bản nháp</option>
          <option value="Inactive">Ngừng kinh doanh</option>
          <option value="Agency">Áp dụng cho đại lý</option>
          <option value="Contractor">Áp dụng cho thầu thợ</option>
          <option value="Homeowner">Áp dụng cho chủ nhà</option>
        </select>
      </div>
      <div className="form-group">
        <label>Danh mục</label>
        <select name="category" value={category} onChange={onChange}>
          <option value="Giải pháp AI">Giải pháp AI</option>
          <option value="Vật liệu xây dựng">Vật liệu xây dựng</option>
          <option value="Phần mềm & Dịch vụ">Phần mềm & Dịch vụ</option>
          <option value="Thiết bị vệ sinh">Thiết bị vệ sinh</option>
          <option value="Trang trí nội thất">Trang trí nội thất</option>
          <option value="Công cụ & Dụng cụ">Công cụ & Dụng cụ</option>
          <option value="Điện tử">Điện tử</option>
          <option value="Laptops">Laptop</option>
          <option value="Âm thanh">Âm thanh</option>
        </select>
      </div>
    </section>
  );
};

export default ClassificationSection;
