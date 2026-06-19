import React from 'react';

const ClassificationSection = ({ status, category, onChange, existingCategories = [] }) => {
  // Kết hợp danh mục mặc định và danh mục lấy từ database
  const defaultCats = ["Giải pháp AI", "Vật liệu xây dựng", "Phần mềm & Dịch vụ", "Thiết bị vệ sinh", "Trang trí nội thất", "Công cụ & Dụng cụ", "Điện tử", "Laptop", "Âm thanh"];
  const allCategories = Array.from(new Set([...defaultCats, ...existingCategories])).sort();

  return (
    <section className="form-section card">
      <div className="section-header">
        <h3>📂 PHÂN LOẠI <span style={{color:'#f59e0b',fontSize:'11px',fontWeight:400}}>← AI: category + status</span></h3>
      </div>
      <div className="form-group">
        <label>Trạng thái <span style={{color:'#f59e0b',fontSize:'11px'}}>← AI: status (Draft/Active)</span></label>
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
        <label>Danh mục <span style={{color:'#f59e0b',fontSize:'11px'}}>← AI: category</span></label>
        <input 
          type="text" 
          name="category" 
          value={category} 
          onChange={onChange} 
          list="category-list"
          placeholder="Chọn hoặc nhập danh mục mới..."
          autoComplete="off"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            fontSize: '0.95rem',
            outline: 'none',
            background: '#fff'
          }}
        />
        <datalist id="category-list">
          {allCategories.map((cat, index) => (
            <option key={index} value={cat} />
          ))}
        </datalist>
      </div>
    </section>
  );
};

export default ClassificationSection;
