import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import { useWishlist } from '../context/WishlistContext';
import Fuse from 'fuse.js';
import './ProductGrid.css';

const ProductGrid = ({ onProductClick, searchQuery, category }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const { toggleWishlist, isInWishlist } = useWishlist();
  
  const ITEMS_PER_PAGE = 12;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchInitialProducts();
  }, [category, searchQuery]);

  const fetchInitialProducts = async () => {
    setLoading(true);
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);

    try {
      let q;
      // Trạng thái tìm kiếm: Cần tải toàn bộ (hoặc số lượng lớn) để Fuse.js hoạt động mượt
      if (searchQuery && searchQuery !== "trending") {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      } 
      // Trạng thái bình thường: Áp dụng phân trang limit()
      else {
        if (searchQuery === "trending") {
          q = query(collection(db, "products"), where("isTrending", "==", true), limit(ITEMS_PER_PAGE));
        } else if (category) {
          q = query(collection(db, "products"), where("category", "==", category), limit(ITEMS_PER_PAGE));
        } else {
          q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(ITEMS_PER_PAGE));
        }
      }

      const querySnapshot = await getDocs(q);
      processProducts(querySnapshot, true);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      let q;
      if (searchQuery === "trending") {
        q = query(collection(db, "products"), where("isTrending", "==", true), startAfter(lastVisible), limit(ITEMS_PER_PAGE));
      } else if (category) {
        q = query(collection(db, "products"), where("category", "==", category), startAfter(lastVisible), limit(ITEMS_PER_PAGE));
      } else {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(ITEMS_PER_PAGE));
      }

      const querySnapshot = await getDocs(q);
      processProducts(querySnapshot, false);
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const processProducts = (querySnapshot, isInitial) => {
    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    if (lastDoc) setLastVisible(lastDoc);
    
    // Nếu đang tìm kiếm bằng Fuse thì không hiện nút "Load More"
    if (searchQuery && searchQuery !== "trending") {
      setHasMore(false);
    } else {
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);
    }

    let productData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      tag: doc.data().category || 'NỔI BẬT',
      name: doc.data().title,
      price: doc.data().discountPrice || doc.data().basePrice,
      oldPrice: doc.data().basePrice,
      img: doc.data().image ? doc.data().image.replace('/upload/', '/upload/f_auto,q_auto,w_500,c_fill/') : 'https://placehold.co/400x400.png?text=ZBUILD'
    }));

    productData = productData.filter(p => p.status !== 'Draft' && p.status !== 'Inactive');

    if (isInitial) {
      setProducts(productData);
    } else {
      setProducts(prev => [...prev, ...productData]);
    }
  };

  // Tích hợp Fuse.js (Fuzzy Search)
  const filteredProducts = React.useMemo(() => {
    if (searchQuery && searchQuery !== "trending") {
      const fuse = new Fuse(products, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'tag', weight: 1.5 },
          { name: 'category', weight: 1.5 },
          { name: 'description', weight: 1 },
          { name: 'sku', weight: 1 }
        ],
        threshold: 0.4, // Càng cao càng cho phép sai nhiều lỗi
        ignoreLocation: true
      });
      const results = fuse.search(searchQuery);
      return results.map(result => result.item);
    }
    return products;
  }, [searchQuery, products]);

  return (
    <section className="product-section container">
      <div className="section-header">
        <h2>{category ? `${category}` : searchQuery ? (searchQuery === "trending" ? "Xu hướng hiện nay" : `Kết quả tìm kiếm cho "${searchQuery}"`) : "Xu hướng hiện nay"}</h2>
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
                {product.specs && <p className="product-specs">{product.specs}</p>}
                <div className="price-container">
                  {Number(String(product.price).replace(/[^0-9.-]+/g,"")) > 0 ? (
                    <>
                      {Number(String(product.oldPrice).replace(/[^0-9.-]+/g,"")) > Number(String(product.price).replace(/[^0-9.-]+/g,"")) && (
                        <span className="old-price">{Number(String(product.oldPrice).replace(/[^0-9.-]+/g,"")).toLocaleString('vi-VN')}₫</span>
                      )}
                      <span className="current-price">{Number(String(product.price).replace(/[^0-9.-]+/g,"")).toLocaleString('vi-VN')}₫</span>
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

        {hasMore && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '20px' }}>
            <button 
              onClick={loadMore} 
              disabled={loadingMore}
              style={{ 
                padding: '12px 32px', 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 600, 
                transition: 'all 0.3s',
                color: '#334155'
              }}
              onMouseOver={(e) => e.target.style.background = '#f1f5f9'}
              onMouseOut={(e) => e.target.style.background = '#f8fafc'}
            >
              {loadingMore ? 'Đang tải thêm...' : 'Xem thêm sản phẩm'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
