import AdminHeader from './AdminHeader';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  apiGetProducts, 
  apiDeleteProduct, 
  apiBatchDeleteProducts, 
  apiDunvexSyncProducts 
} from '../services/sqliteApi';
import { slugify } from '../utils/slugify';

import './AdminProductList.css';

const AdminProductList = ({ onAddProduct, onEditProduct, onPreviewProduct }) => {

  const [activeTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('admin_product_search') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const allProductsCache = useRef([]); // Cache toàn bộ SP để search local
  const searchTimerRef = useRef(null); // Debounce timer
  const [isSyncingExisting, setIsSyncingExisting] = useState(false); // nút 1: cập nhật
  const [isFetchingNew, setIsFetchingNew] = useState(false); // nút 2: lấy mới
  const [isDeletingOld, setIsDeletingOld] = useState(false); // nút 3: xoá cũ
  const [syncedProductIds, setSyncedProductIds] = useState([]);
  const [showSyncSuccessModal, setShowSyncSuccessModal] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState({ title: '', body: '' });
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);
  const [showSyncPanels, setShowSyncPanels] = useState(true);
  
  // Batch delete states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => sessionStorage.getItem('admin_product_category') || 'All');
  const [allCategories, setAllCategories] = useState(new Set(['All', 'Chưa phân loại']));

  // Sync filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('admin_product_search', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('admin_product_category', selectedCategory);
  }, [selectedCategory]);

  // Tự động đồng bộ ngầm khi admin mở trang
  useEffect(() => {
    const checkAutoSync = async () => {
      if (autoSyncTriggered) return;
      setAutoSyncTriggered(true);
      try {
        await apiDunvexSyncProducts();
        fetchProducts();
      } catch (e) {
        console.warn('Auto-sync notice:', e.message);
      }
    };
    checkAutoSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncTriggered]);









  /**
   * 🔄 NÚT 1: Đồng bộ sản phẩm từ Dunvex vào SQLite
   */
  const handleSyncExistingProducts = async () => {
    setIsSyncingExisting(true);
    try {
      const res = await apiDunvexSyncProducts();
      setSyncSuccessMessage({
        title: "✅ Đồng bộ sản phẩm thành công!",
        body: res.message || `Đã đồng bộ ${res.updated || 0} cập nhật, ${res.created || 0} tạo mới từ Dunvex vào SQLite.`
      });
      setShowSyncSuccessModal(true);
      fetchProducts();
    } catch (error) {
      console.error("Lỗi đồng bộ sản phẩm:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setIsSyncingExisting(false);
    }
  };

  /**
   * 🆕 NÚT 2: Lấy sản phẩm mới từ Dunvex vào SQLite
   */
  const handleFetchNewProducts = async () => {
    setIsFetchingNew(true);
    try {
      const res = await apiDunvexSyncProducts();
      setSyncSuccessMessage({
        title: "🆕 Lấy sản phẩm mới thành công!",
        body: res.message || `Đã cập nhật sản phẩm mới từ Dunvex vào SQLite.`
      });
      setShowSyncSuccessModal(true);
      fetchProducts();
    } catch (error) {
      console.error("Lỗi lấy sản phẩm mới:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setIsFetchingNew(false);
    }
  };

  /**
   * 🗑️ NÚT 3: Xoá sản phẩm
   */
  const handleDeleteMissingProducts = async () => {
    if (!window.confirm("Hệ thống tự động đồng bộ trạng thái sản phẩm với Dunvex. Bạn có muốn làm mới dữ liệu từ Dunvex ngay bây giờ không?")) {
      return;
    }
    setIsDeletingOld(true);
    try {
      const res = await apiDunvexSyncProducts();
      setSyncSuccessMessage({
        title: "🗑️ Dọn dẹp & làm mới hoàn tất!",
        body: res.message || "Dữ liệu SQLite đã đồng bộ với Dunvex."
      });
      setShowSyncSuccessModal(true);
      fetchProducts();
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsDeletingOld(false);
    }
  };

  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const ITEMS_PER_PAGE = 1000;

  // Load cache toàn bộ SP khi mount
  useEffect(() => { loadAllProductsCache(); }, []);

  // Debounce search: đợi 300ms sau khi gõ xong mới filter
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (searchQuery) {
        searchFromCache(searchQuery);
      } else {
        fetchProducts(); // Quay về pagination
        setHasMore(true);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery) fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Load tất cả SP vào cache (dùng cho search local)
  const loadAllProductsCache = async () => {
    try {
      const rawProducts = await apiGetProducts();
      allProductsCache.current = rawProducts.map(p => ({
        ...p,
        price: (p.discountPrice || p.basePrice || p.price) 
                ? Number(p.discountPrice || p.basePrice || p.price).toLocaleString('vi-VN') + '₫' 
                : 'Liên hệ',
        name: p.title || p.dunvexId || p.id.substring(0, 12),
        sku: p.sku || p.id.substring(0, 8).toUpperCase(),
        dunvexId: p.dunvexId,
        title: p.title
      }));
    } catch (error) {
      console.error("Error loading product cache:", error);
    }
  };

  // Search từ cache
  const searchFromCache = useCallback((query) => {
    setLoading(true);
    const removeAccents = (str) => {
      return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };
    const q = removeAccents(query);
    const filtered = allProductsCache.current.filter(p => {
      const matchesTab = activeTab === 'All' || p.status === activeTab;
      const matchesCategory = selectedCategory === 'All' || (p.category || 'Chưa phân loại') === selectedCategory;
      const matchesSearch = !q ||
        removeAccents(p.name || '').includes(q) ||
        removeAccents(p.sku || '').includes(q) ||
        removeAccents(p.dunvexId || '').includes(q) ||
        removeAccents(p.title || '').includes(q);
      return matchesTab && matchesCategory && matchesSearch;
    });
    setProducts(filtered);
    setHasMore(false);
    setLoading(false);
  }, [activeTab, selectedCategory]);

  // Refresh cache + reload list
  const refreshProducts = async () => {
    await loadAllProductsCache();
    fetchProducts();
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const rawProducts = await apiGetProducts({
        category: selectedCategory === 'All' ? null : selectedCategory,
        search: searchQuery
      });
      
      setHasMore(false);

      const productData = rawProducts.map(p => ({
        ...p,
        price: (p.discountPrice || p.basePrice || p.price) 
                ? Number(p.discountPrice || p.basePrice || p.price).toLocaleString('vi-VN') + '₫' 
                : 'Liên hệ',
        name: p.title || p.dunvexId || p.id.substring(0, 12),
        sku: p.sku || p.id.substring(0, 8).toUpperCase(),
        dunvexId: p.dunvexId,
        title: p.title
      }));

      // Cập nhật categories
      setAllCategories(prev => {
        const newSet = new Set(prev);
        rawProducts.forEach(p => newSet.add(p.category || 'Chưa phân loại'));
        return newSet;
      });

      setProducts(productData);
      allProductsCache.current = productData;
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    // With SQLite API returning full filtered sets fast, loadMore is not needed
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi cơ sở dữ liệu SQLite?")) {
      try {
        await apiDeleteProduct(id);
        setSelectedProducts(prev => prev.filter(pId => pId !== id));
        refreshProducts();
      } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedProducts.length} sản phẩm đã chọn khỏi cơ sở dữ liệu SQLite?`)) {
      try {
        setLoading(true);
        await apiBatchDeleteProducts(selectedProducts);
        setSelectedProducts([]);
        refreshProducts();
      } catch (error) {
        alert("Lỗi khi xóa hàng loạt: " + error.message);
        setLoading(false);
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



  // allCategories is managed in state

  const filteredProducts = products.filter(p => {
    const matchesTab = activeTab === 'All' || p.status === activeTab;
    const matchesCategory = selectedCategory === 'All' || (p.category || 'Chưa phân loại') === selectedCategory;
    const removeAccents = (str) => {
      return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };
    const q = removeAccents(searchQuery);
    // Tìm theo: tên SP, SKU, dunvexId, title gốc (phòng trường hợp name bị null)
    const matchesSearch = !q || 
      removeAccents(p.name || '').includes(q) || 
      removeAccents(p.sku || '').includes(q) ||
      removeAccents(p.dunvexId || '').includes(q) ||
      removeAccents(p.title || '').includes(q);
    return matchesTab && matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const aSynced = syncedProductIds.includes(a.id);
    const bSynced = syncedProductIds.includes(b.id);
    if (aSynced && !bSynced) return -1;
    if (!aSynced && bSynced) return 1;
    return 0;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set([...selectedProducts, ...filteredProducts.map(p => p.id)]);
      setSelectedProducts(Array.from(newSelected));
    } else {
      const filteredIds = new Set(filteredProducts.map(p => p.id));
      setSelectedProducts(selectedProducts.filter(id => !filteredIds.has(id)));
    }
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  return (
    <div className="admin-product-page">
      
      <div className="admin-main-content">
                <AdminHeader
          title="Quản lý sản phẩm"
          actions={
            <>
              <button className="home-icon-btn desktop-only" onClick={() => window.location.href = '/'} title="Về trang chủ" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#1a1a2e' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
              <button 
                onClick={() => setShowSyncPanels(!showSyncPanels)}
                title="Đồng bộ dữ liệu từ Dunvex"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '0 12px', height: '32px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', background: '#fff',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  color: '#475569', whiteSpace: 'nowrap'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"
                  style={{ transform: showSyncPanels ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                Đồng bộ
              </button>
              <button className="ai-btn" onClick={() => {
                let prompt = 'Hãy quét danh sách sản phẩm và tự động viết mô tả chi tiết, phân loại danh mục, thông số cho tất cả các sản phẩm đang ở trạng thái Draft';
                if (selectedProducts.length > 0) {
                  const selectedNames = products.filter(p => selectedProducts.includes(p.id)).map(p => `- ${p.name || p.id}`).join('\\n');
                  prompt = `Tôi có danh sách các sản phẩm sau cần viết hoặc cập nhật nội dung chi tiết:\\n${selectedNames}\\n\\nHãy hỏi tôi xem tôi muốn bạn TỰ ĐỘNG VIẾT LUÔN cho các sản phẩm này, hay tôi muốn CUNG CẤP THÊM THÔNG TIN (như tính năng, thành phần, ưu điểm...) để bạn dựa vào đó viết cho chính xác hơn.\\n\\nLưu ý:\\n- Đừng viết nội dung sản phẩm vội, hãy chờ quyết định của tôi.\\n- Khi tôi yêu cầu viết (có hoặc không có thông tin thêm), hãy cập nhật TỪNG SẢN PHẨM MỘT bằng công cụ update_product. Hãy viết bài mô tả (description) thật DÀI, CHĂM CHÚT, HẤP DẪN bằng mã HTML. Hãy khéo léo chèn tên của từng sản phẩm vào nội dung mô tả nhiều lần để bài viết trông tự nhiên và giống như được viết riêng cho sản phẩm đó.`;
                }
                sessionStorage.setItem('ai-prompt', prompt);
                window.dispatchEvent(new Event('trigger-admin-ai-prompt'));
              }} style={{ padding: '0 12px', height: '32px', borderRadius: '8px', backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Viết nội dung (AI)
              </button>
              <button className="primary-add-btn" onClick={onAddProduct} style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', padding: '0 14px', height: '32px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Thêm SP
              </button>
            </>
          }
          extra={
            showSyncPanels && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600, whiteSpace: 'nowrap', flex: 1 }}>
                  🔄 Đồng bộ tồn kho & giá từ Dunvex App
                </span>
                <button onClick={handleSyncExistingProducts} disabled={isSyncingExisting} title="Cập nhật tên, giá, tồn kho, quy cách cho sản phẩm đã có" style={{ padding: '0 10px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: isSyncingExisting ? 'wait' : 'pointer', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', opacity: isSyncingExisting ? 0.7 : 1 }}>
                  <svg className={isSyncingExisting ? "spin-animation" : ""} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  {isSyncingExisting ? "Đang cập nhật..." : "Đồng bộ SP"}
                </button>
                <button onClick={handleFetchNewProducts} disabled={isFetchingNew} title="Lấy sản phẩm mới từ Dunvex App chưa có trên Web" style={{ padding: '0 10px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: isFetchingNew ? 'wait' : 'pointer', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', opacity: isFetchingNew ? 0.7 : 1 }}>
                  <svg className={isFetchingNew ? "spin-animation" : ""} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  {isFetchingNew ? "Đang lấy..." : "Lấy SP mới"}
                </button>
                <button onClick={handleDeleteMissingProducts} disabled={isDeletingOld} title="Xoá sản phẩm không còn trên Dunvex App" style={{ padding: '0 10px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: isDeletingOld ? 'wait' : 'pointer', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', opacity: isDeletingOld ? 0.7 : 1 }}>
                  <svg className={isDeletingOld ? "spin-animation" : ""} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  {isDeletingOld ? "Đang xoá..." : "Xoá SP cũ"}
                </button>
              </div>
            )
          }
          toolbar={
            <>
              <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: 1, maxWidth: '340px', backgroundColor: '#fff', border: '1px solid #e2e8f0', margin: 0, padding: '0 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm sản phẩm..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '13px', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 0 }}
                  />
                </div>
                <div className="category-filter" style={{ width: '170px', flexShrink: 0, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ width: '100%', height: '38px', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', color: '#334155', fontWeight: 500, fontSize: '13px', padding: '0 10px' }}
                  >
                    {Array.from(allCategories).map(cat => (
                      <option key={cat} value={cat}>{cat === 'All' ? 'Tất cả danh mục' : cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                onClick={handleBatchDelete} 
                disabled={selectedProducts.length === 0}
                style={{ 
                  padding: '0 14px', height: '38px', borderRadius: '8px', 
                  backgroundColor: selectedProducts.length > 0 ? '#fef2f2' : '#f8fafc', 
                  color: selectedProducts.length > 0 ? '#ef4444' : '#cbd5e1', 
                  border: selectedProducts.length > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', 
                  display: 'flex', alignItems: 'center', gap: '5px', cursor: selectedProducts.length > 0 ? 'pointer' : 'not-allowed', 
                  fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                Xoá{selectedProducts.length > 0 ? ` (${selectedProducts.length})` : ''}
              </button>
            </>
          }
        />

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
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.id))}
                          onChange={handleSelectAll}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th>Sản phẩm</th>
                      <th>Danh mục</th>
                      <th>Giá tiền</th>
                      <th>Tồn kho</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                          Không tìm thấy sản phẩm nào. Vui lòng kiểm tra lại từ khóa tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map(product => (
                        <tr key={product.id} onClick={() => onPreviewProduct(product)} className={syncedProductIds.includes(product.id) ? 'highlight-row' : ''} style={{ cursor: 'pointer', backgroundColor: selectedProducts.includes(product.id) ? 'rgba(212, 175, 55, 0.05)' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => handleSelectProduct(product.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td>
                            <div className="product-cell">
                              <img src={product.image ? product.image.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : (product.extraImages?.[0] ? product.extraImages[0].replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : 'https://placehold.co/100')} alt="" />
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Grid View */}
              <div className="mobile-product-list mobile-only">
                {/* Quick-select bar for mobile */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '10px', padding: '0 2px'
                }}>
                  <button
                    onClick={() => {
                      if (filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.id))) {
                        setSelectedProducts([]);
                      } else {
                        setSelectedProducts(filteredProducts.map(p => p.id));
                      }
                    }}
                    style={{
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px',
                      borderRadius: '20px', border: '1px solid #e2e8f0',
                      background: '#fff', color: '#475569', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.id))}
                      readOnly
                      style={{ width: '14px', height: '14px', cursor: 'pointer', margin: 0 }}
                    />
                    {filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.id))
                      ? `Bỏ chọn (${selectedProducts.length})`
                      : `Chọn tất cả (${filteredProducts.length})`}
                  </button>
                  {selectedProducts.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                      Đã chọn {selectedProducts.length}
                    </span>
                  )}
                </div>
                {filteredProducts.map(product => (
                  <div className="mobile-card" key={product.id} onClick={() => onPreviewProduct(product)} style={{ position: 'relative' }}>
                    {/* Selection checkbox — top-right corner */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectProduct(product.id);
                      }}
                      style={{
                        position: 'absolute', top: '12px', right: '12px', zIndex: 5,
                        width: '26px', height: '26px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: selectedProducts.includes(product.id)
                          ? '#D4AF37'
                          : 'rgba(255,255,255,0.9)',
                        border: selectedProducts.includes(product.id)
                          ? '2px solid #D4AF37'
                          : '2px solid #d1d5db',
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {selectedProducts.includes(product.id) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                    <div className="card-header">
                      <img src={product.image ? product.image.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : (product.extraImages?.[0] ? product.extraImages[0].replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : 'https://placehold.co/100')} alt="" />
                      <div className="card-title-info" style={{ paddingRight: '36px' }}>
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
        {showSyncSuccessModal && (
          <div className="custom-modal-overlay">
            <div className="custom-modal-content">
              <h3>{syncSuccessMessage.title}</h3>
              <p>{syncSuccessMessage.body}</p>
              <button className="custom-modal-btn" onClick={() => setShowSyncSuccessModal(false)}>Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductList;
