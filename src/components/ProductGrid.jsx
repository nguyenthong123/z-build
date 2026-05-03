import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useWishlist } from '../context/WishlistContext';
import './ProductGrid.css';

const ProductGrid = ({ onProductClick, searchQuery, category }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toggleWishlist, isInWishlist } = useWishlist();

  const filteredProducts = React.useMemo(() => {
    if (searchQuery && searchQuery !== "trending") {
      const lowerQuery = searchQuery.toLowerCase();
      return products.filter(p =>
        (p.name && p.name.toLowerCase().includes(lowerQuery)) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
        (p.tag && p.tag.toLowerCase().includes(lowerQuery))
      );
    }
    return products;
  }, [searchQuery, products]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    let q;
    if (searchQuery === "trending") {
      q = query(collection(db, "products"), where("isTrending", "==", true));
    } else if (category) {
      q = query(collection(db, "products"), where("category", "==", category));
    } else {
      q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(20));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let productData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        tag: doc.data().category || 'NỔI BẬT',
        name: doc.data().title,
        price: doc.data().discountPrice || doc.data().basePrice,
        oldPrice: doc.data().basePrice,
        img: doc.data().image || 'https://placehold.co/400x400.png?text=ZBUILD'
      }));

      // Sắp xếp thủ công để tránh lỗi đòi hỏi Composite Index từ Firestore
      if (searchQuery === "trending" || category) {
        productData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        if (searchQuery === "trending") {
          productData = productData.slice(0, 20);
        }
      }

      setProducts(productData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products for grid:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [category, searchQuery]);



  return (
    <section className="product-section container">
      <div className="section-header">
        <h2>{category ? `${category}` : searchQuery ? (searchQuery === "trending" ? "Xu hướng hiện nay" : `Results for "${searchQuery}"`) : "Xu hướng hiện nay"}</h2>
        <a href="#" className="view-all">Xem tất cả</a>
      </div>
      <div className="product-grid">
        {loading ? (
          <div style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>Đang tải sản phẩm...</div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <div key={product.id} className="product-card" onClick={() => onProductClick(product)}>
              <div className="product-img-wrapper">
                <span className="product-tag">{product.tag}</span>
                <button 
                  className={`wishlist-heart ${isInWishlist(product.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(product);
                  }}
                  title={isInWishlist(product.id) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isInWishlist(product.id) ? '#EF4444' : 'none'} stroke={isInWishlist(product.id) ? '#EF4444' : 'currentColor'} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <img src={product.img} alt={product.name} loading="lazy" />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <div className="price-container">
                  {Number(product.price) > 0 ? (
                    <>
                      {product.oldPrice > product.price && <span className="old-price">{Number(product.oldPrice).toLocaleString('vi-VN')}₫</span>}
                      <span className="current-price">{Number(product.price).toLocaleString('vi-VN')}₫</span>
                    </>
                  ) : (
                    <span className="current-price contact-price">Liên hệ báo giá</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>
            {searchQuery === "trending" ? "Không có sản phẩm trending nào." : "Không tìm thấy sản phẩm nào."}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
