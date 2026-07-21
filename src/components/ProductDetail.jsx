import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './ProductDetail.css';
import ProductReview from './ProductReview';
import SEOHead from './SEOHead';

const ProductDetail = ({ product: propProduct, onBack, onAddToCart, isLoggedIn, onLoginRequired, setGlobalProduct }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeMedia, setActiveMedia] = useState({ type: 'image', index: 0 });
  const [selectedVariants, setSelectedVariants] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [visibleThumbs, setVisibleThumbs] = useState(4);
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 });

  const renderSpecs = (specs) => {
    if (!specs) return null;
    
    let cleanSpecs = specs.trim();
    if (cleanSpecs.startsWith('(') && cleanSpecs.endsWith(')')) {
      cleanSpecs = cleanSpecs.substring(1, cleanSpecs.length - 1);
    }
    
    if (cleanSpecs.includes(',')) {
      const items = cleanSpecs.split(',').map(item => item.trim()).filter(Boolean);
      
      return (
        <div className="specs-tags-container">
          {items.map((item, index) => (
            <span key={index} className="specs-tag-item">{item}</span>
          ))}
        </div>
      );
    }
    
    return (
      <div className="specs-badges">
        <span className="specs-badge">{cleanSpecs}</span>
      </div>
    );
  };

  const formatWeight = (weight) => {
    if (!weight) return '';
    const str = String(weight).trim();
    if (/[a-zA-Z]/.test(str)) return str;
    return `${str} kg`;
  };

  // Fetch product from Firestore if not passed as prop
  useEffect(() => {
    const fetchProduct = async () => {
      if (propProduct && propProduct.title) {
        setFetchedProduct(null); // Use prop product
        return;
      }
      const idToFetch = productId || propProduct?.id;
      if (!idToFetch) return;
      
      setLoading(true);
      try {
        // Run standard ID fetch and Slug fetch in parallel for maximum speed
        const docRef = doc(db, 'products', idToFetch);
        const slugQuery = query(collection(db, "products"), where("slug", "==", idToFetch), limit(1));
        
        const [docSnap, slugSnap] = await Promise.all([
          getDoc(docRef),
          getDocs(slugQuery)
        ]);
        
        if (docSnap.exists()) {
          setFetchedProduct({ id: docSnap.id, ...docSnap.data() });
        } else if (!slugSnap.empty) {
          const firstDoc = slugSnap.docs[0];
          setFetchedProduct({ id: firstDoc.id, ...firstDoc.data() });
        } else {
          setFetchedProduct(null);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId, propProduct]);

  // Use prop product if it has full data, otherwise use fetched
  const product = (propProduct && propProduct.title) ? propProduct : fetchedProduct;

  // Initialize selected variants when product changes
  useEffect(() => {
    setActiveMedia({ type: 'image', index: 0 });
    if (product?.variants) {
      const initialVariants = {};
      product.variants.forEach(variant => {
        if (variant.values && variant.values.length > 0) {
          initialVariants[variant.type] = variant.values[0];
        }
      });
      setSelectedVariants(initialVariants);
    }
    
    if (product) {
      setGlobalProduct?.(product);
    }
    
    // Set visible thumbs based on screen size
    const updateVisibleThumbs = () => {
      setVisibleThumbs(window.innerWidth < 768 ? 3 : 4);
    };
    updateVisibleThumbs();
    window.addEventListener('resize', updateVisibleThumbs);
    
    return () => {
      setGlobalProduct?.(null);
      window.removeEventListener('resize', updateVisibleThumbs);
    };
  }, [product, setGlobalProduct]);

  useEffect(() => {
    const fetchRelated = async () => {
      if (product?.category) {
        try {
          const q = query(
            collection(db, "products"),
            where("category", "==", product.category),
            limit(10) // Tăng limit lên một chút để bù đắp các sản phẩm bản nháp bị lọc đi
          );
          const snap = await getDocs(q);
          const list = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => p.id !== product?.id && p.status !== 'Draft' && p.status !== 'Inactive')
            .slice(0, 4);
          setRelatedProducts(list);
        } catch (error) {
          console.error("Error fetching related products:", error);
        }
      }
    };
    fetchRelated();
  }, [product]);

  const getOptimizedUrl = (url, width = 800) => {
    if (!url) return '';
    if (typeof url === 'string' && url.includes('/upload/')) {
      // Tối ưu ảnh qua Cloudinary: tự động định dạng (WebP), nén chất lượng, giới hạn chiều rộng
      return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
    }
    return url;
  };

  const images = React.useMemo(() => {
    const optimizedMain = getOptimizedUrl(product?.image, 1000);
    const optimizedExtras = (product?.extraImages || []).filter(img => img).map(img => getOptimizedUrl(img, 1000));
    if (!optimizedMain && optimizedExtras.length > 0) {
      return optimizedExtras;
    }
    return [ optimizedMain || 'https://placehold.co/800', ...optimizedExtras ];
  }, [product]);

  const videos = React.useMemo(() => [
    product?.videoUrl,
    product?.extraVideoUrl
  ].filter(v => v), [product]);

  const allMedia = React.useMemo(() => [
    ...images.map((url, i) => ({ type: 'image', url, index: i })),
    ...videos.map((url, i) => ({ type: 'video', url, index: i }))
  ], [images, videos]);

  // Auto-advance logic removed as per user request

  // Sync thumbnail view with active media
  useEffect(() => {
    const currentIndex = allMedia.findIndex(m => m.type === activeMedia.type && m.index === activeMedia.index);
    if (currentIndex !== -1) {
      // If current is outside the [start, start + visibleThumbs - 1] range, adjust start
      if (currentIndex < thumbnailStartIndex) {
        setThumbnailStartIndex(currentIndex);
      } else if (currentIndex >= thumbnailStartIndex + visibleThumbs) {
        setThumbnailStartIndex(Math.max(0, currentIndex - (visibleThumbs - 1)));
      }
    }
  }, [activeMedia, allMedia, thumbnailStartIndex, visibleThumbs]);

  const handleNextThumb = () => {
    if (thumbnailStartIndex + visibleThumbs < allMedia.length) {
      setThumbnailStartIndex(prev => prev + 1);
    }
  };

  const handlePrevThumb = () => {
    if (thumbnailStartIndex > 0) {
      setThumbnailStartIndex(prev => prev - 1);
    }
  };

  // Handle back navigation
  const handleBack = onBack || (() => navigate(-1));

  const handleRelatedClick = (p) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(`/product/${p.slug || p.id}`);
  };

  // === EARLY RETURNS (must be after ALL hooks) ===
  if (loading) {
    return (
      <div className="product-detail-page container" style={{ padding: '100px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '48px', height: '48px', border: '4px solid #f0f0f0', 
            borderTopColor: '#FFB800', borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite' 
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Đang tải sản phẩm...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page container" style={{ padding: '100px 20px', textAlign: 'center' }}>
        <h2>Không tìm thấy sản phẩm</h2>
        <button className="back-btn" onClick={handleBack} style={{ marginTop: '20px', padding: '10px 20px', background: '#FFB800', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}> Quay lại trang chủ</button>
      </div>
    );
  }





  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    // Hỗ trợ: watch?v=, embed/, youtu.be/, shorts/, live/, v/
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? match[1] : null;
  };

  const formatExternalUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http')) return trimmed;
    return `https://${trimmed}`;
  };

  const handleExternalClick = (url) => {
    const formatted = formatExternalUrl(url);
    if (formatted) window.open(formatted, '_blank');
  };

  const handleVariantSelect = (type, value) => {
    setSelectedVariants(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const rawDiscountPrice = Number(String(product.discountPrice || '').replace(/[^0-9.-]+/g,""));
  const rawBasePrice = Number(String(product.basePrice || '').replace(/[^0-9.-]+/g,""));
  const hasRealDiscount = product.discountPrice && rawDiscountPrice > 0 && rawDiscountPrice < rawBasePrice;
  const displayPrice = hasRealDiscount ? rawDiscountPrice : rawBasePrice;
  const discountPercent = hasRealDiscount ? Math.round((1 - rawDiscountPrice / rawBasePrice) * 100) : 0;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "image": images || [],
    "description": product.description?.replace(/<[^>]+>/g, '').substring(0, 300) || product.title,
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Zbuild"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://zbuild.click/product/${product.slug || product.id}`,
      "priceCurrency": "VND",
      "price": product.pricingType === 'subscription' ? (product.monthlyPrice || 0) : (product.discountPrice || product.basePrice || 0),
      "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Zbuild"
      }
    }
  };

  return (
    <div className="product-detail-page animate-fade-in">
      <SEOHead 
        title={`${product.title} | Zbuild`} 
        description={product.description?.replace(/<[^>]+>/g, '').substring(0, 150) || product.title}
        ogImage={images[0]}
        canonical={`/product/${product.slug || product.id}`}
        schemaData={productSchema}
      />
      {/* Mobile Special Header */}
      <div className="mobile-detail-header">
        <button className="back-btn" onClick={handleBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span className="header-title">Chi tiết sản phẩm</span>
        <div className="header-actions">
          <button className="icon-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
          </button>
          <button className="icon-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
      </div>

      <div className="container">
        {/* Breadcrumbs - Hidden on Mobile */}
        <nav className="breadcrumbs desktop-only">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Trang chủ</a> / <a href="#">{product.category || 'Danh mục'}</a> / <span className="current">{product.title}</span>
        </nav>

        <div className="product-main">
          {/* Gallery */}
          <div className="gallery-section">
            <div className="main-image">
              {activeMedia.type === 'video' ? (
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={getYoutubeEmbedUrl(videos[activeMedia.index]) ? `${getYoutubeEmbedUrl(videos[activeMedia.index])}?autoplay=1` : ''} 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                  style={{ borderRadius: '12px', aspectRatio: '1/1', display: getYoutubeEmbedUrl(videos[activeMedia.index]) ? 'block' : 'none' }}
                ></iframe>
              ) : (
                <img src={images[activeMedia.index]} alt={product.title} />
              )}
              <button className="wishlist-btn desktop-only">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>
            <div 
              className="thumbnails-container"
            >
              {allMedia.length > visibleThumbs && (
                <button 
                  className={`thumb-nav-btn prev ${thumbnailStartIndex === 0 ? 'disabled' : ''}`} 
                  onClick={handlePrevThumb}
                  disabled={thumbnailStartIndex === 0}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              )}
              
              <div className="thumbnails">
                {allMedia.slice(thumbnailStartIndex, thumbnailStartIndex + visibleThumbs).map((media) => {
                  const isActive = activeMedia.type === media.type && activeMedia.index === media.index;
                  
                  if (media.type === 'image') {
                    return (
                      <div 
                        key={`img-${media.index}`} 
                        className={`thumb ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setActiveMedia({ type: 'image', index: media.index });
                        }}
                      >
                        <img src={media.url} alt={`Thumbnail ${media.index}`} />
                      </div>
                    );
                  } else {
                    return (
                      <div 
                         key={`vid-${media.index}`}
                         className={`thumb video-thumb ${isActive ? 'active' : ''}`}
                         onClick={() => {
                           setActiveMedia({ type: 'video', index: media.index });
                         }}
                      >
                        <div className="video-overlay">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                        {getYoutubeId(media.url) ? (
                          <img src={`https://img.youtube.com/vi/${getYoutubeId(media.url)}/0.jpg`} alt={`Video ${media.index}`} />
                        ) : (
                          <div className="video-placeholder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25a29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>

              {allMedia.length > visibleThumbs && (
                <button 
                  className={`thumb-nav-btn next ${thumbnailStartIndex + visibleThumbs >= allMedia.length ? 'disabled' : ''}`} 
                  onClick={handleNextThumb}
                  disabled={thumbnailStartIndex + visibleThumbs >= allMedia.length}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="info-section">
            <div className="info-header">
              <span className="bestseller-badge">SẢN PHẨM MỚI</span>
              <h1 className="product-title">{product.title}</h1>
              <div className="rating-row" style={{ cursor: 'pointer' }} onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="stars">
                  {reviewStats.count > 0 ? (
                    <div style={{ display: 'flex', color: '#FFB800', gap: '2px', alignItems: 'center' }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < Math.round(reviewStats.average) ? "currentColor" : "none"} stroke={i < Math.round(reviewStats.average) ? "currentColor" : "#d1d1d1"} strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  ) : '⭐⭐⭐⭐⭐'}
                </div>
                <span className="review-count" style={{ color: '#666', fontSize: '0.9rem' }}>
                  {reviewStats.count > 0 ? `${reviewStats.average} (${reviewStats.count} đánh giá)` : '(Chưa có đánh giá)'}
                </span>
              </div>
            </div>

            <div className="price-row">
              {product.pricingType === 'subscription' ? (
                <div className="subscription-pricing">
                  <div className="sub-price-grid">
                    <div className="sub-price-card monthly">
                      <span className="sub-label">Hàng tháng</span>
                      <span className="sub-value">{Number(product.monthlyPrice || 0).toLocaleString('vi-VN')}₫</span>
                    </div>
                    <div className="sub-price-card yearly">
                      <span className="sub-label">Hàng năm (Tiết kiệm)</span>
                      <span className="sub-value">{Number(product.yearlyPrice || 0).toLocaleString('vi-VN')}₫</span>
                    </div>
                  </div>
                </div>
              ) : (!product.basePrice || Number(product.basePrice) === 0) ? (
                <div className="contact-price-box">
                  <span className="contact-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Liên hệ báo giá
                  </span>
                  <p className="contact-desc">Vui lòng liên hệ trực tiếp hoặc xem tài liệu đính kèm để nhận ưu đãi tốt nhất.</p>
                </div>
              ) : (
                <div className="standard-pricing">
                  <div className="price-stack">
                    <span className="price-label">
                      {product.status === 'Phân phối' && !hasRealDiscount ? 'Chính hãng:' : ''}
                    </span>
                    <span className="current-price">
                      {displayPrice.toLocaleString('vi-VN')}₫ {product.unit ? `/ ${product.unit}` : ''}
                    </span>
                  </div>
                  {hasRealDiscount && (
                    <div className="price-stack discounted">
                      <span className="price-label">
                        {product.status === 'Phân phối' ? 'Giá tới nơi:' : 'Giá gốc:'}
                      </span>
                      <span className="old-price">
                        {rawBasePrice.toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  )}
                  {hasRealDiscount && !product.status?.includes('Phân phối') && (
                    <span className="discount-badge">
                      GIẢM {discountPercent}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="shipping-info">Miễn phí vận chuyển cho đơn hàng từ 500.000₫</p>

            {/* Specs Section */}
            {(product.specs || (product.weight && String(product.weight).trim() !== '') || product.packaging) && (
              <div className="specs-detail-group" style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {product.specs && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>QUY CÁCH / KÍCH THƯỚC</label>
                      {renderSpecs(product.specs)}
                    </div>
                  )}
                  {((product.weight && String(product.weight).trim() !== '') || product.packaging) && (
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      {product.weight && String(product.weight).trim() !== '' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>TRỌNG LƯỢNG</label>
                          <div className="specs-badges">
                            <span className="specs-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>⚖️ {formatWeight(product.weight)}</span>
                          </div>
                        </div>
                      )}
                      {product.packaging && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>ĐÓNG GÓI</label>
                          <div className="specs-badges">
                            <span className="specs-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>📦 {product.packaging}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick CTA: Thêm vào giỏ + Mua ngay — đặt ngay dưới trọng lượng */}
            <div className="cta-quick-row" style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
              <div className="quantity-selector" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-light, #f8fafc)', borderRadius: '12px', padding: '4px', border: '1px solid var(--divider, #e2e8f0)', flexShrink: 0 }}>
                <button onClick={() => quantity > 1 && setQuantity(quantity - 1)} disabled={quantity <= 1} style={{ width: '36px', height: '36px', border: 'none', background: 'var(--card-bg, #white)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>−</button>
                <span style={{ minWidth: '36px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: 'var(--text-main, #1e293b)' }}>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} style={{ width: '36px', height: '36px', border: 'none', background: 'var(--card-bg, #white)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>+</button>
              </div>
              <button className="btn-add-cart" onClick={() => onAddToCart(product, quantity)} style={{ flex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Thêm vào giỏ hàng
              </button>
              <button className="btn-buy-now" style={{ flex: 1 }} onClick={() => { onAddToCart(product, quantity); navigate('/checkout'); }}>Mua ngay</button>
            </div>

            {/* Selectors */}
            <div className="selectors">
              {product.variants && product.variants.map((variant, vIdx) => (
                <div key={vIdx} className="selector-group">
                  <label>{variant.type.toUpperCase()}</label>
                  <div className="storage-options">
                    {variant.values.map((val, idx) => (
                      <button 
                        key={idx} 
                        className={`storage-btn ${selectedVariants[variant.type] === val ? 'active' : ''}`}
                        onClick={() => handleVariantSelect(variant.type, val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div className="cta-section">
              {(product.quoteUrl || product.pdfUrl) && (
                <button 
                  onClick={() => isLoggedIn ? handleExternalClick(product.pdfUrl || product.quoteUrl) : onLoginRequired()}
                  className="btn-quote-link"
                  style={{ 
                    flex: '2', 
                    background: '#4CAF50', 
                    color: 'white', 
                    fontWeight: '700', 
                    padding: '18px', 
                    borderRadius: '14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px', 
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  {isLoggedIn ? 'Báo giá ngay' : 'Đăng nhập để xem báo giá'}
                </button>
              )}
              {product.demoUrl && product.category === 'Phần mềm & Dịch vụ' && (
                <button 
                  onClick={() => handleExternalClick(product.demoUrl)}
                  className="btn-demo-link"
                  style={{ 
                    flex: '1', 
                    background: '#2196F3', 
                    color: 'white', 
                    fontWeight: '700', 
                    padding: '18px', 
                    borderRadius: '14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px', 
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Trải nghiệm Demo
                </button>
              )}
              <button
                className="btn-compare"
                onClick={() => {
                  if (!product?.id) return;
                  try {
                    const userId = auth?.currentUser?.uid || 'guest';
                    const compareKey = `zbuild_compare_${userId}`;
                    const current = JSON.parse(localStorage.getItem(compareKey) || '[]');
                    if (!current.includes(product.id)) {
                      const updated = [...current, product.id].slice(0, 3);
                      localStorage.setItem(compareKey, JSON.stringify(updated));
                      window.dispatchEvent(new Event('compareListUpdated'));
                    }
                    navigate('/compare');
                  } catch (e) { console.error('Error adding to compare', e); }
                }}
                style={{
                  flex: '1',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  fontWeight: '600',
                  padding: '18px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  fontSize: '1rem',
                  border: '1px solid var(--divider)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-yellow)';
                  e.currentTarget.style.background = '#FFF9E6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--divider)';
                  e.currentTarget.style.background = 'var(--card-bg)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  <rect x="6" y="11" width="5" height="8" rx="1"/>
                  <rect x="13" y="11" width="5" height="8" rx="1"/>
                </svg>
                So sánh
              </button>
            </div>

          </div>
        </div>

        {/* Description Section */}
        {product.description && product.description.trim().length > 10 ? (
          <div className="description-section">
            <h2>Mô tả sản phẩm</h2>
            <div 
              className="product-description-content"
              dangerouslySetInnerHTML={{ 
                __html: product.description.replace(/&nbsp;/g, ' ').replace(/[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\u200b\r]/g, ' ') 
              }}
            ></div>
          </div>
        ) : (
          <div className="description-section" style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p style={{ fontSize: '1rem', margin: 0 }}>Chưa có mô tả chi tiết cho sản phẩm này</p>
          </div>
        )}

        {/* Reviews Section */}
        <ProductReview 
          productId={product.id} 
          isLoggedIn={isLoggedIn} 
          onLoginRequired={onLoginRequired} 
          onReviewsLoaded={setReviewStats} 
        />

        {/* Related Products */}
        <div className="related-section">
          <h2>Sản phẩm liên quan</h2>
          <div className="related-grid">
            {relatedProducts.length > 0 ? relatedProducts.map((p, i) => (
              <div key={i} className="related-card" onClick={() => handleRelatedClick(p)}>
                <div className="related-img">
                  {p.image ? (
                    <img src={getOptimizedUrl(p.image, 400)} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="related-img-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  )}
                  <button className="wishlist-small" onClick={(e) => e.stopPropagation()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                </div>
                <h3>{p.title}</h3>
                <span className="related-price">
                  {p.pricingType === 'subscription' 
                    ? `Từ ${Number(p.monthlyPrice || 0).toLocaleString('vi-VN')}₫`
                    : Number(p.discountPrice || p.basePrice || 0) > 0 
                      ? `${Number(p.discountPrice || p.basePrice).toLocaleString('vi-VN')}₫ ${p.unit ? `/ ${p.unit}` : ''}`
                      : 'Liên hệ'}
                </span>
              </div>
            )) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#666' }}>
                Đang tìm sản phẩm cùng nhóm ngành...
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProductDetail;
