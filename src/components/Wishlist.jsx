import React from 'react';
import { useWishlist } from '../context/WishlistContext';
import './Wishlist.css';

const Wishlist = ({ onNavigate }) => {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  if (wishlist.length === 0) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-empty">
          <div className="empty-icon">💛</div>
          <h2>Danh sách yêu thích trống</h2>
          <p>Hãy khám phá và lưu sản phẩm bạn thích!</p>
          <button className="btn-explore" onClick={() => onNavigate('home')}>
            Khám phá sản phẩm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="wishlist-container">
        {/* Header */}
        <div className="wishlist-header">
          <div className="wishlist-title-area">
            <h1>
              <span className="heart-icon">❤️</span>
              Yêu thích của tôi
            </h1>
            <span className="wishlist-count">{wishlist.length} sản phẩm</span>
          </div>
          <button className="btn-clear-all" onClick={clearWishlist}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Xoá tất cả
          </button>
        </div>

        {/* Grid */}
        <div className="wishlist-grid">
          {wishlist.map((product, index) => (
            <div 
              className="wishlist-card" 
              key={product.id}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="wl-card-image" onClick={() => onNavigate('product', product.id, product)}>
                <img src={product.image} alt={product.title} loading="lazy" />
                <div className="wl-card-overlay">
                  <span>Xem chi tiết →</span>
                </div>
              </div>
              <div className="wl-card-body">
                <span className="wl-category">{product.category}</span>
                <h3 
                  className="wl-title" 
                  onClick={() => onNavigate('product', product.id, product)}
                >
                  {product.title}
                </h3>
                <div className="wl-price">{formatPrice(product.price)}</div>
                <div className="wl-card-actions">
                  <button 
                    className="btn-add-cart"
                    onClick={() => {
                      // Dispatch add to cart event
                      window.dispatchEvent(new CustomEvent('addToCart', { detail: product }));
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    Thêm vào giỏ
                  </button>
                  <button 
                    className="btn-remove-wl"
                    onClick={() => removeFromWishlist(product.id)}
                    title="Xoá khỏi yêu thích"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                </div>
              </div>
              {/* Added time */}
              <div className="wl-added-time">
                Đã thêm {new Date(product.addedAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
