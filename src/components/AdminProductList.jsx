import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, startAfter, limit } from 'firebase/firestore';
import { db } from '../firebase';
import './AdminProductList.css';
import AdminSidebar from './AdminSidebar';

const AdminProductList = ({ onBack, onAddProduct, onEditProduct, onPreviewProduct }) => {
  const [activeTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncPricesFromSheet = async () => {
    setIsSyncing(true);
    try {
      const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjxwNzi7j1KMpLdrYFfPzYFYhEmFhb9ercrPho5CMXCTRKE_dx0iaoYOFwP8t20gZG/exec";
      const response = await fetch(`${APP_SCRIPT_URL}?action=get_all_products_from_sheet`);
      const data = await response.json();
      
      if (data.success && data.products) {
        let updatedCount = 0;
        for (const sheetProduct of data.products) {
          if (!sheetProduct.id || !sheetProduct.price) continue;
          
          try {
            const priceString = String(sheetProduct.price).replace(/[^\d]/g, '');
            const newPrice = Number(priceString);
            
            if (!isNaN(newPrice) && newPrice > 0) {
              const productRef = doc(db, "products", sheetProduct.id);
              await updateDoc(productRef, {
                discountPrice: newPrice
              });
              updatedCount++;
            }
          } catch (e) {
            console.error("Error updating product:", sheetProduct.id, e);
          }
        }
        alert(`Đã đồng bộ giá thành công cho ${updatedCount} sản phẩm!`);
        fetchProducts(); // Reload table
      } else {
        alert("Lỗi từ Google Sheet: " + (data.error || "Không xác định"));
      }
    } catch (error) {
      console.error("Lỗi đồng bộ:", error);
      alert("Không thể kết nối đến Google Sheet. Vui lòng kiểm tra lại cấu hình Web App.");
    } finally {
      setIsSyncing(false);
    }
  };

  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(ITEMS_PER_PAGE));
      const querySnapshot = await getDocs(q);
      
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);

      const productData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        price: (doc.data().discountPrice || doc.data().basePrice) 
                ? Number(doc.data().discountPrice || doc.data().basePrice).toLocaleString('vi-VN') + '₫' 
                : 'Liên hệ',
        name: doc.data().title,
        sku: doc.data().sku || doc.id.substring(0, 8).toUpperCase()
      }));
      setProducts(productData);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "products"), 
        orderBy("createdAt", "desc"), 
        startAfter(lastVisible),
        limit(ITEMS_PER_PAGE)
      );
      const querySnapshot = await getDocs(q);
      
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);

      const productData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        price: (doc.data().discountPrice || doc.data().basePrice) 
                ? Number(doc.data().discountPrice || doc.data().basePrice).toLocaleString('vi-VN') + '₫' 
                : 'Liên hệ',
        name: doc.data().title,
        sku: doc.data().sku || doc.id.substring(0, 8).toUpperCase()
      }));
      setProducts(prev => [...prev, ...productData]);
    } catch (error) {
      console.error("Error loading more products:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) {
      try {
        await deleteDoc(doc(db, "products", id));
        fetchProducts();
      } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
      case 'Hoạt động': return '#4CAF50';
      case 'Draft': return '#FFB800';
      case 'Inactive': return '#F44336';
      default: return '#888';
    }
  };

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const filteredProducts = products.filter(p => {
    const matchesTab = activeTab === 'All' || p.status === activeTab;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="products" />
      
      <div className="admin-main-content">
        <header className={`admin-content-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Sản phẩm</span></nav>
          
          <div className="header-main-row">
            <div className="title-group">
              <h1>Quản lý sản phẩm</h1>
              <p className="description">Theo dõi và cập nhật tất cả sản phẩm của bạn.</p>
            </div>
            
            <div className="header-actions-group">
              <div className="search-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm nhanh..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="btn-group">
                <button className="home-icon-btn desktop-only" onClick={onBack} title="Về trang chủ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                <button className="sync-btn desktop-only" onClick={handleSyncPricesFromSheet} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: '#333' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                  {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Sheet'}
                </button>
                <button className="primary-add-btn" onClick={onAddProduct}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                  <span className="desktop-only">Thêm sản phẩm</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content-body">
          {loading ? (
            <div className="loading-container">Đang tải dữ liệu...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-responsive desktop-only">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Danh mục</th>
                      <th>Giá tiền</th>
                      <th>Tồn kho</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(product => (
                      <tr key={product.id} onClick={() => onPreviewProduct(product)}>
                        <td>
                          <div className="product-cell">
                            <img src={product.image ? product.image.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : 'https://placehold.co/100'} alt="" />
                            <div className="info">
                              <strong>{product.name}</strong>
                              <span>{product.sku}</span>
                            </div>
                          </div>
                        </td>
                        <td>{product.category || 'Chưa phân loại'}</td>
                        <td className="price-text">{product.price}</td>
                        <td>{product.stock || 0}</td>
                        <td>
                          <span className="status-dot" style={{ backgroundColor: getStatusColor(product.status) }}></span>
                          {product.status}
                        </td>
                        <td className="text-right">
                          <div className="table-actions">
                            <button className="edit-icon" onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button className="delete-icon" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Grid View */}
              <div className="mobile-product-list mobile-only">
                {filteredProducts.map(product => (
                  <div className="mobile-card" key={product.id} onClick={() => onPreviewProduct(product)}>
                    <div className="card-header">
                      <img src={product.image ? product.image.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : 'https://placehold.co/100'} alt="" />
                      <div className="card-title-info">
                        <strong>{product.name}</strong>
                        <span className="card-extra">{product.sku} • {product.category}</span>
                        <div className="card-status" style={{ color: getStatusColor(product.status) }}>
                           {product.status}
                        </div>
                      </div>
                    </div>
                    <div className="card-footer">
                      <div className="card-data">
                        <span className="card-price">{product.price}</span>
                        <span className="card-stock">{product.stock} trong kho</span>
                      </div>
                      <div className="card-btns">
                        <button className="m-edit-btn" onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}>Sửa</button>
                        <button className="m-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>Xóa</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && !searchQuery && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <button 
                    onClick={loadMoreProducts} 
                    disabled={loadingMore}
                    style={{ 
                      padding: '10px 24px', 
                      background: '#fff', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      fontWeight: 500,
                      color: '#4b5563'
                    }}
                  >
                    {loadingMore ? 'Đang tải...' : 'Tải thêm sản phẩm'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProductList;
