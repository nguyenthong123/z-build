import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useWishlist } from '../context/WishlistContext';
import { useStore } from '../context/StoreContext';
import { useAppContext } from '../context/AppContext';
import Fuse from 'fuse.js';
import './ProductGrid.css';

const ProductGrid = ({ onProductClick }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesList, setCategoriesList] = useState([]);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { searchQuery, selectedCategory: category } = useStore();
  const { handleAddToCart } = useAppContext();

  useEffect(() => {
    const fetchAllProducts = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        
        const loadedProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          tag: doc.data().category || 'NỔI BẬT',
          name: doc.data().title,
          price: doc.data().discountPrice || doc.data().basePrice,
          oldPrice: doc.data().basePrice,
          img: doc.data().image ? doc.data().image.replace('/upload/', '/upload/f_auto,q_auto,w_500,c_fill/') : 'https://placehold.co/400x400.png?text=ZBUILD'
        })).filter(p => p.status === 'active' || (p.status !== 'Draft' && p.status !== 'Inactive'));
        
        // Sort products by createdAt desc
        loadedProducts.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        
        setProducts(loadedProducts);
        
        // Extract unique categories in alphabetical order
        const uniqueCats = new Set();
        loadedProducts.forEach(p => {
          if (p.category) {
            uniqueCats.add(p.category);
          }
        });
        setCategoriesList(Array.from(uniqueCats).sort());
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllProducts();
  }, []);

  // Smooth scroll helper
  const scrollToCategory = (catName) => {
    const sectionId = `cat-sec-${catName.replace(/\s+/g, '-').toLowerCase()}`;
    const element = document.getElementById(sectionId);
    if (element) {
      // Calculate offset for sticky header if exists
      const offset = 90; 
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Scroll to category when selectedCategory updates globally
  useEffect(() => {
    if (category) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        scrollToCategory(category);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [category]);

  // Fuzzy search results client-side
  const searchResults = React.useMemo(() => {
    if (searchQuery && searchQuery !== "trending") {
      const fuse = new Fuse(products, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'tag', weight: 1.5 },
          { name: 'category', weight: 1.5 },
          { name: 'description', weight: 1 },
          { name: 'sku', weight: 1 }
        ],
        threshold: 0.4,
        ignoreLocation: true
      });
      return fuse.search(searchQuery).map(result => result.item);
    }
    return [];
  }, [searchQuery, products]);

  // Filter trending products client-side
  const trendingProducts = React.useMemo(() => {
    if (searchQuery === "trending") {
      return products.filter(p => p.isTrending === true);
    }
    return [];
  }, [searchQuery, products]);

  // Group products by category client-side
  const groupedProducts = React.useMemo(() => {
    if (searchQuery) return {};
    
    const grouped = {};
    products.forEach(p => {
      const cat = p.category || 'Khác';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(p);
    });
    return grouped;
  }, [searchQuery, products]);

  const renderProductCard = (product) => (
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
        <button 
          className="add-to-cart-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart(product, 1);
          }}
        >
          Thêm vào giỏ hàng
        </button>
      </div>
    </div>
  );

  const formatCategoryTitle = (catName) => {
    if (catName.toLowerCase().includes('giá tại kho')) {
      return catName;
    }
    return `${catName} - Giá tại kho`;
  };

  return (
    <section className="product-section container">
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>Đang tải sản phẩm...</div>
      ) : searchQuery ? (
        /* Search Query or Trending Results Mode */
        <div className="search-results-section">
          <div className="category-header-container">
            <div className="category-title-ribbon">
              <span className="category-title-ribbon-text">
                {searchQuery === "trending" ? "Sản phẩm nổi bật" : `Kết quả: "${searchQuery}"`}
              </span>
            </div>
          </div>
          
          <div className="product-grid">
            {searchQuery === "trending" ? (
              trendingProducts.length > 0 ? (
                trendingProducts.map(renderProductCard)
              ) : (
                <div style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>Không có sản phẩm nổi bật nào.</div>
              )
            ) : (
              searchResults.length > 0 ? (
                searchResults.map(renderProductCard)
              ) : (
                <div style={{ padding: '40px', gridColumn: '1/-1', textAlign: 'center' }}>Không tìm thấy sản phẩm nào.</div>
              )
            )}
          </div>
        </div>
      ) : (
        /* Normal Mode: Grouped by Category stacked on homepage */
        <>
          {/* Quick Links Anchors Bar */}
          {categoriesList.length > 0 && (
            <div className="category-tabs-container">
              {categoriesList.map((catName) => (
                <button
                  key={catName}
                  className="category-tab-btn"
                  onClick={() => scrollToCategory(catName)}
                >
                  {catName}
                </button>
              ))}
              {groupedProducts['Khác'] && groupedProducts['Khác'].length > 0 && (
                <button
                  key="Khác"
                  className="category-tab-btn"
                  onClick={() => scrollToCategory('Khác')}
                >
                  Sản phẩm khác
                </button>
              )}
            </div>
          )}

          {/* Grouped Categories Lists */}
          {categoriesList.map((catName) => {
            const catProducts = groupedProducts[catName] || [];
            if (catProducts.length === 0) return null;
            const sectionId = `cat-sec-${catName.replace(/\s+/g, '-').toLowerCase()}`;
            
            return (
              <div key={catName} id={sectionId} className="category-product-block">
                <div className="category-header-container">
                  <div className="category-title-ribbon">
                    <span className="category-title-ribbon-text">
                      {formatCategoryTitle(catName)}
                    </span>
                  </div>
                </div>
                
                <div className="product-grid">
                  {catProducts.map(renderProductCard)}
                </div>
              </div>
            );
          })}

          {/* Fallback for products with no category */}
          {groupedProducts['Khác'] && groupedProducts['Khác'].length > 0 && (
            <div id="cat-sec-khác" className="category-product-block">
              <div className="category-header-container">
                <div className="category-title-ribbon">
                  <span className="category-title-ribbon-text">
                    Sản phẩm khác - Giá tại kho
                  </span>
                </div>
              </div>
              
              <div className="product-grid">
                {groupedProducts['Khác'].map(renderProductCard)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ProductGrid;
