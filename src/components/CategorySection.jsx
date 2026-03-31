import React from 'react';
import './CategorySection.css';

const categories = [
  { id: 1, name: 'Vật liệu xây dựng', img: '/vat-lieu-xay-dung.png' },
  { id: 2, name: 'Phần mềm & Dịch vụ', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=400&h=400&auto=format&fit=crop' },
  { id: 3, name: 'Thi công & Lắp đặt', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=400&h=400&auto=format&fit=crop' },
  { id: 4, name: 'Trang trí nội thất', img: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=400&h=400&auto=format&fit=crop' },
  { id: 5, name: 'Điện & Nước', img: '/dien-nuoc.png' },
  { id: 6, name: 'Máy móc thiết bị', img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=400&h=400&auto=format&fit=crop' },
];

const CategorySection = ({ onCategorySelect, activeCategory }) => {
  return (
    <section className="categories container">
      <div className="section-header">
        <h2>Nhóm ngành kinh doanh</h2>
        <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect(null); }} aria-label="Xem tất cả nhóm ngành kinh doanh">Tất cả</a>
      </div>
      <div className="category-grid">
        {categories.map(cat => (
          <div 
            key={cat.id} 
            className={`category-item ${activeCategory === cat.name ? 'active' : ''}`}
            onClick={() => onCategorySelect(cat.name)}
            role="button"
            aria-label={`Chọn ngành: ${cat.name}`}
          >
            <div className="category-img-wrapper">
              <img src={cat.img} alt={cat.name} loading="lazy" />
            </div>
            <span>{cat.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CategorySection;
