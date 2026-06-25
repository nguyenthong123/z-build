import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import { useWishlist } from '../context/WishlistContext';
import { useStore } from '../context/StoreContext';
import Fuse from 'fuse.js';
import './ProductGrid.css';

const ProductGrid = ({ onProductClick }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [categoriesList, setCategoriesList] = useState([]);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { searchQuery, selectedCategory: category, handleCategorySelect } = useStore();
  
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        const uniqueCats = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.category && data.status === 'active') {
            uniqueCats.add(data.category);
          }
        });
        setCategoriesList(['Tất cả', ...Array.from(uniqueCats)]);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchInitialProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, searchQuery]);

  const fetchValidProducts = async (startDoc) => {
    let currentStartDoc = startDoc;
    let accumulated = [];
    let newLastVisible = startDoc;
    let moreDocsAvailable = true;

    const isFuseSearch = searchQuery && searchQuery !== "trending";

    while (accumulated.length < ITEMS_PER_PAGE && moreDocsAvailable) {
      let q;
      if (isFuseSearch) {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      } else {
        if (currentStartDoc) {
          if (searchQuery === "trending") {
            q = query(collection(db, "products"), where("isTrending", "==", true), startAfter(currentStartDoc), limit(ITEMS_PER_PAGE));
          } else if (category) {
            q = query(collection(db, "products"), where("category", "==", category), startAfter(currentStartDoc), limit(ITEMS_PER_PAGE));
          } else {
            q = query(collection(db, "products"), orderBy("createdAt", "desc"), startAfter(currentStartDoc), limit(ITEMS_PER_PAGE));
          }
        } else {
          if (searchQuery === "trending") {
            q = query(collection(db, "products"), where("isTrending", "==", true), limit(ITEMS_PER_PAGE));
          } else if (category) {
            q = query(collection(db, "products"), where("category", "==", category), limit(ITEMS_PER_PAGE));
          } else {
            q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(ITEMS_PER_PAGE));
          }
        }
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        moreDocsAvailable = false;
        break;
      }

      newLastVisible = snapshot.docs[snapshot.docs.length - 1];
      currentStartDoc = newLastVisible;

      let batch = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        tag: doc.data().category || 'NỔI BẬT',
        name: doc.data().title,
        price: doc.data().discountPrice || doc.data().basePrice,
        oldPrice: doc.data().basePrice,
        img: doc.data().image ? doc.data().image.replace('/upload/', '/upload/f_auto,q_auto,w_500,c_fill/') : 'https://placehold.co/400x400.png?text=ZBUILD'
      }));

      batch = batch.filter(p => p.status !== 'Draft' && p.status !== 'Inactive');
      accumulated = [...accumulated, ...batch];

      if (isFuseSearch || snapshot.docs.length < ITEMS_PER_PAGE) {
        moreDocsAvailable = false;
      }
    }

    return {
      products: accumulated,
      lastVisible: newLastVisible,
      hasMore: moreDocsAvailable
    };
  };

  const fetchInitialProducts = async () => {
    setLoading(true);
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);

    try {
      const result = await fetchValidProducts(null);
      setProducts(result.products);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
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
      const result = await fetchValidProducts(lastVisible);
      setProducts(prev => [...prev, ...result.products]);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
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
        <h2>{category ? `${category}` : searchQuery ? (searchQuery === "trending" ? "Tất cả sản phẩm" : `Kết quả tìm kiếm cho "${searchQuery}"`) : "Tất cả sản phẩm"}</h2>
        <a href="#" className="view-all">Xem tất cả</a>
      </div>
      
      {categoriesList.length > 1 && (
        <div className="category-tabs-container">
          {categoriesList.map((catName) => (
            <button
              key={catName}
              className={`category-tab-btn ${((catName === 'Tất cả' && !category) || category === catName) ? 'active' : ''}`}
              onClick={() => handleCategorySelect(catName === 'Tất cả' ? null : catName)}
            >
              {catName}
            </button>
          ))}
        </div>
      )}

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
