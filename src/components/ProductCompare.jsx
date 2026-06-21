import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import './ProductCompare.css';

const MAX_COMPARE = 3;
const STORAGE_KEY = 'compareList';

// ============================================================
// ProductCompare — Compare up to 3 products side by side
// ============================================================
const ProductCompare = () => {
  const router = useRouter();

  // --- State ---
  const [compareIds, setCompareIds] = useState(() => {
    // Priority 1: passed via navigation state
    if (location.state?.compareIds && Array.isArray(location.state.compareIds)) {
      return location.state.compareIds.slice(0, MAX_COMPARE);
    }
    // Priority 2: load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).slice(0, MAX_COMPARE) : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState([]);         // full product objects loaded from Firestore
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allProductsCache, setAllProductsCache] = useState([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // --- Persist compare list to localStorage ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  // --- Load full product data whenever compareIds change ---
  useEffect(() => {
    if (compareIds.length === 0) {
      setProducts([]);
      return;
    }

    const loadProducts = async () => {
      setLoading(true);
      try {
        const results = [];
        for (const id of compareIds) {
          // Try direct doc fetch first
          const docRef = doc(db, 'products', id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            results.push({ id: docSnap.id, ...docSnap.data() });
          } else {
            // Fallback: search by slug
            const q = query(
              collection(db, 'products'),
              where('slug', '==', id),
              limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const d = snap.docs[0];
              results.push({ id: d.id, ...d.data() });
            }
          }
        }
        setProducts(results);
      } catch (err) {
        console.error('Error loading compare products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [compareIds]);

  // --- Preload all product titles for search on first mount ---
  useEffect(() => {
    const loadAllProducts = async () => {
      if (cacheLoaded) return;
      try {
        const snap = await getDocs(
          query(collection(db, 'products'), orderBy('title', 'asc'), limit(200))
        );
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.title && p.status !== 'Draft' && p.status !== 'Inactive');
        setAllProductsCache(list);
        setCacheLoaded(true);
      } catch (err) {
        console.error('Error loading product catalog:', err);
        setCacheLoaded(true); // don't retry forever
      }
    };
    loadAllProducts();
  }, [cacheLoaded]);

  // --- Search handler with debounce ---
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    setShowSuggestions(true);

    debounceRef.current = setTimeout(() => {
      const q = val.toLowerCase();
      const filtered = allProductsCache
        .filter(p => {
          const title = (p.title || '').toLowerCase();
          const category = (p.category || '').toLowerCase();
          return title.includes(q) || category.includes(q);
        })
        .filter(p => !compareIds.includes(p.id))
        .slice(0, 8);

      setSuggestions(filtered);
      setSearching(false);
    }, 250);
  }, [allProductsCache, compareIds]);

  // --- Click outside to close suggestions ---
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Add product to compare list ---
  const addProduct = (product) => {
    if (compareIds.length >= MAX_COMPARE) return;
    if (compareIds.includes(product.id)) return;
    setCompareIds(prev => {
      const updated = [...prev, product.id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('compareListUpdated'));
      return updated;
    });
    setSearchValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // --- Remove product from compare list ---
  const removeProduct = (productId) => {
    setCompareIds(prev => {
      const updated = prev.filter(id => id !== productId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('compareListUpdated'));
      return updated;
    });
  };

  // --- Clear all ---
  const clearAll = () => {
    setCompareIds([]);
    setProducts([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('compareListUpdated'));
  };

  // --- "So sánh bằng AI" — navigate to AIAdvisor with pre-filled prompt ---
  const handleAICompare = () => {
    if (products.length < 2) return;

    const productLines = products.map(p => {
      const price = p.discountPrice || p.basePrice || 0;
      const priceStr = price > 0 ? `${Number(price).toLocaleString('vi-VN')}₫` : 'Liên hệ';
      return `- **${p.title}** (${p.category || 'Chung'}): ${priceStr} — ${(p.specs || p.description || '').replace(/<[^>]+>/g, '').substring(0, 120)}`;
    }).join('\n');

    const prompt = `📊 So sánh chi tiết các sản phẩm sau:\n\n${productLines}\n\nHãy giúp tôi phân tích ưu/nhược điểm của từng sản phẩm, so sánh về giá, chất lượng, tính năng và đưa ra đề xuất nên chọn sản phẩm nào dựa trên nhu cầu sử dụng.`;

    sessionStorage.setItem('comparePrompt', prompt);
    router.push('/advisor');
  };

  // --- Helpers ---
  const getFormattedPrice = (product) => {
    if (product.pricingType === 'subscription') {
      return `${Number(product.monthlyPrice || 0).toLocaleString('vi-VN')}₫/tháng`;
    }
    const price = product.discountPrice || product.basePrice || 0;
    if (Number(price) === 0) return 'Liên hệ';
    return `${Number(price).toLocaleString('vi-VN')}₫`;
  };

  const getDisplayPrice = (product) => {
    const price = product.discountPrice || product.basePrice || 0;
    if (product.pricingType === 'subscription') {
      return `${Number(product.monthlyPrice || 0).toLocaleString('vi-VN')}₫/tháng`;
    }
    if (Number(price) === 0) return 'Liên hệ';
    return `${Number(price).toLocaleString('vi-VN')}₫`;
  };

  const getOldPrice = (product) => {
    if (!product.discountPrice || !product.basePrice) return null;
    const discount = Number(String(product.discountPrice).replace(/[^0-9.-]+/g, ''));
    const base = Number(String(product.basePrice).replace(/[^0-9.-]+/g, ''));
    if (discount && base && discount < base) {
      return `${base.toLocaleString('vi-VN')}₫`;
    }
    return null;
  };

  const getRating = (product) => {
    const rating = product.rating || product.avgRating || 0;
    const count = product.reviewCount || product.ratingCount || 0;
    return { rating: Number(rating) || 0, count: Number(count) || 0 };
  };

  const renderStars = (rating) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    if (half) stars += '☆';
    const empty = 5 - full - (half ? 1 : 0);
    for (let i = 0; i < empty; i++) stars += '☆';
    return stars || '☆☆☆☆☆';
  };

  const getCleanDesc = (product) => {
    const text = product.description || '';
    return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').substring(0, 150);
  };

  const getFeatures = (product) => {
    const features = [];
    if (product.specs) features.push(product.specs);
    if (product.features && Array.isArray(product.features)) {
      features.push(...product.features.slice(0, 3));
    } else if (product.features && typeof product.features === 'string') {
      features.push(product.features);
    }
    // Parse description for bullet points
    if (!features.length && product.description) {
      const bullets = product.description.match(/[•\-\*]\s*.+/g);
      if (bullets) {
        features.push(...bullets.map(b => b.replace(/[•\-\*]\s*/, '').replace(/<[^>]+>/g, '')).slice(0, 4));
      }
    }
    return features;
  };

  // --- Render: Empty State ---
  if (!loading && compareIds.length === 0) {
    return (
      <div className="product-compare-page animate-fade-in">
        <div className="container">
          <div className="compare-header">
            <button className="back-btn" onClick={() => router.push('/')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Quay lại
            </button>
            <h1>So sánh sản phẩm</h1>
            <div style={{ width: '100px' }} />
          </div>

          <div className="compare-empty">
            <div className="compare-empty-icon">⚖️</div>
            <h2>Chưa có sản phẩm nào để so sánh</h2>
            <p>Thêm sản phẩm từ trang chi tiết hoặc tìm kiếm bên dưới để bắt đầu so sánh.</p>
            <button className="browse-btn" onClick={() => router.push('/')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Xem sản phẩm
            </button>
          </div>

          {/* Search even on empty state */}
          <div className="compare-add-section" style={{ marginTop: '32px' }}>
            <div className="compare-search-wrapper" ref={searchRef}>
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                className="compare-search-input"
                type="text"
                placeholder="Tìm sản phẩm để so sánh..."
                value={searchValue}
                onChange={handleSearchChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              {showSuggestions && (
                <div className="compare-suggestions">
                  {searching ? (
                    <div className="compare-suggestion-loading">Đang tìm...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="compare-suggestion-empty">Không tìm thấy sản phẩm</div>
                  ) : (
                    suggestions.map(p => (
                      <div key={p.id} className="compare-suggestion-item" onClick={() => addProduct(p)}>
                        <img
                          className="compare-suggestion-img"
                          src={p.image || 'https://placehold.co/100'}
                          alt={p.title}
                        />
                        <div className="compare-suggestion-info">
                          <div className="compare-suggestion-name">{p.title}</div>
                          <div className="compare-suggestion-cat">{p.category || 'Chung'}</div>
                        </div>
                        <span className="compare-suggestion-price">{getDisplayPrice(p)}</span>
                        <span className="compare-suggestion-add">+</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {compareIds.length >= MAX_COMPARE && (
              <div className="compare-max-warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Tối đa {MAX_COMPARE} sản phẩm để so sánh
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Loading ---
  if (loading) {
    return (
      <div className="product-compare-page animate-fade-in">
        <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <div style={{
            width: '48px', height: '48px', border: '4px solid var(--divider)',
            borderTopColor: 'var(--primary-yellow)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Đang tải sản phẩm...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // --- Compute table column count ---
  const columnCount = Math.max(compareIds.length, 1);

  return (
    <div className="product-compare-page animate-fade-in">
      <div className="container">
        {/* Header */}
        <div className="compare-header">
          <button className="back-btn" onClick={() => router.push('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Quay lại
          </button>
          <h1>So sánh sản phẩm ({products.length}/{MAX_COMPARE})</h1>
          <div className="compare-header-actions">
            {products.length >= 2 && (
              <button className="btn-compare-ai" onClick={handleAICompare}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a4 4 0 0 1 4 4v1h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h3V6a4 4 0 0 1 4-4z"/>
                  <rect x="11" y="12" width="2" height="5" rx="1"/>
                </svg>
                So sánh bằng AI
              </button>
            )}
          </div>
        </div>

        {/* Search / Add */}
        <div className="compare-add-section">
          <div className="compare-search-wrapper" ref={searchRef}>
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              className="compare-search-input"
              type="text"
              placeholder={compareIds.length >= MAX_COMPARE ? 'Đã đạt tối đa 3 sản phẩm' : 'Thêm sản phẩm để so sánh...'}
              value={searchValue}
              onChange={handleSearchChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              disabled={compareIds.length >= MAX_COMPARE}
            />
            {showSuggestions && (
              <div className="compare-suggestions">
                {searching ? (
                  <div className="compare-suggestion-loading">Đang tìm...</div>
                ) : suggestions.length === 0 ? (
                  <div className="compare-suggestion-empty">Không tìm thấy sản phẩm</div>
                ) : (
                  suggestions.map(p => (
                    <div key={p.id} className="compare-suggestion-item" onClick={() => addProduct(p)}>
                      <img
                        className="compare-suggestion-img"
                        src={p.image || 'https://placehold.co/100'}
                        alt={p.title}
                      />
                      <div className="compare-suggestion-info">
                        <div className="compare-suggestion-name">{p.title}</div>
                        <div className="compare-suggestion-cat">{p.category || 'Chung'}</div>
                      </div>
                      <span className="compare-suggestion-price">{getDisplayPrice(p)}</span>
                      <span className="compare-suggestion-add">+</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {compareIds.length >= MAX_COMPARE && (
            <div className="compare-max-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Tối đa {MAX_COMPARE} sản phẩm để so sánh
            </div>
          )}
        </div>

        {/* Comparison Table */}
        <div className="compare-table-wrapper">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Thông số</th>
                {products.map(p => (
                  <th key={p.id}>
                    <div className="compare-column-header">
                      <div className="compare-product-img-wrapper">
                        <img
                          src={p.image || 'https://placehold.co/400'}
                          alt={p.title}
                          onError={(e) => { e.target.src = 'https://placehold.co/400'; }}
                        />
                        <button
                          className="compare-remove-btn"
                          onClick={() => removeProduct(p.id)}
                          title="Xóa sản phẩm"
                        >
                          ×
                        </button>
                      </div>
                      <div className="compare-product-name">{p.title}</div>
                    </div>
                  </th>
                ))}
                {/* Fill remaining empty columns */}
                {products.length < 1 && (
                  <th>
                    <div className="compare-column-header">
                      <div className="compare-slot-empty">
                        <span className="slot-icon">📦</span>
                        Thêm sản phẩm
                      </div>
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Price Row */}
              <tr>
                <td>Giá</td>
                {products.map(p => (
                  <td key={p.id}>
                    <div className="compare-price">
                      {getFormattedPrice(p)}
                      {getOldPrice(p) && <span className="old-price">{getOldPrice(p)}</span>}
                    </div>
                  </td>
                ))}
                {products.length === 0 && <td><span className="compare-price">—</span></td>}
              </tr>

              {/* Category Row */}
              <tr>
                <td>Danh mục</td>
                {products.map(p => (
                  <td key={p.id}>
                    <span className="compare-category-pill">{p.category || 'Chung'}</span>
                  </td>
                ))}
                {products.length === 0 && <td>—</td>}
              </tr>

              {/* Brand Row */}
              <tr>
                <td>Thương hiệu</td>
                {products.map(p => (
                  <td key={p.id}>{p.brand || 'Zbuild'}</td>
                ))}
                {products.length === 0 && <td>—</td>}
              </tr>

              {/* Description / Specs Row */}
              <tr>
                <td>Mô tả</td>
                {products.map(p => (
                  <td key={p.id}>
                    <div className="compare-desc">
                      {p.specs ? (
                        <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-main)' }}>
                          {p.specs}
                        </strong>
                      ) : null}
                      {getCleanDesc(p) || '—'}
                    </div>
                  </td>
                ))}
                {products.length === 0 && <td>—</td>}
              </tr>

              {/* Rating Row */}
              <tr>
                <td>Đánh giá</td>
                {products.map(p => {
                  const { rating, count } = getRating(p);
                  return (
                    <td key={p.id}>
                      <div className="compare-rating">
                        <span className="compare-stars">{renderStars(rating)}</span>
                        {count > 0 && (
                          <span className="compare-rating-count">({count})</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                {products.length === 0 && <td>—</td>}
              </tr>

              {/* Features / Highlights Row */}
              <tr>
                <td>Tính năng</td>
                {products.map(p => {
                  const features = getFeatures(p);
                  return (
                    <td key={p.id}>
                      <div className="compare-features">
                        {features.length > 0 ? (
                          <ul>
                            {features.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                {products.length === 0 && <td>—</td>}
              </tr>

              {/* Stock Row */}
              <tr>
                <td>Tồn kho</td>
                {products.map(p => (
                  <td key={p.id}>
                    {p.stock !== undefined && p.stock !== null ? (
                      p.stock > 0 ? (
                        <span style={{ color: '#22C55E', fontWeight: 600 }}>Còn hàng ({p.stock})</span>
                      ) : (
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>Hết hàng</span>
                      )
                    ) : '—'}
                  </td>
                ))}
                {products.length === 0 && <td>—</td>}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Actions */}
        <div className="compare-bottom-actions">
          {products.length >= 2 && (
            <button className="btn-compare-ai" onClick={handleAICompare}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a4 4 0 0 1 4 4v1h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h3V6a4 4 0 0 1 4-4z"/>
                <rect x="11" y="12" width="2" height="5" rx="1"/>
              </svg>
              So sánh bằng AI
            </button>
          )}
          <button className="btn-compare-clear" onClick={clearAll}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Xóa tất cả
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCompare;
