import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, startAfter, limit, addDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './AdminProductList.css';
import AdminSidebar from './AdminSidebar';

const AdminProductList = ({ onAddProduct, onEditProduct, onPreviewProduct }) => {
  const [activeTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  
  // Batch delete states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'storeSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().googleSheetUrl) {
          setGoogleSheetUrl(settingsSnap.data().googleSheetUrl);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleUpdatePrices = async () => {
    if (!googleSheetUrl || !googleSheetUrl.includes("docs.google.com/spreadsheets")) {
      alert("Vui lòng dán đúng link Google Sheet (có chứa docs.google.com/spreadsheets...) để đồng bộ!");
      return;
    }

    const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert("Link Google Sheet không hợp lệ, không tìm thấy ID!");
      return;
    }
    const sheetId = match[1];

    const gidMatch = googleSheetUrl.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '';

    setIsSyncing(true);
    try {
      const settingsRef = doc(db, 'storeSettings', 'main');
      await setDoc(settingsRef, { googleSheetUrl }, { merge: true });

      const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjxwNzi7j1KMpLdrYFfPzYFYhEmFhb9ercrPho5CMXCTRKE_dx0iaoYOFwP8t20gZG/exec";
      const response = await fetch(`${APP_SCRIPT_URL}?action=bulk_import_products&sheet_id=${sheetId}&gid=${gid}`);
      const data = await response.json();
      
      if (data.success && data.products) {
        let updatedCount = 0;
        
        // Fetch existing products
        const existingProductsSnap = await getDocs(collection(db, "products"));
        const existingProductsMap = new Map();
        existingProductsSnap.forEach(doc => {
          const name = (doc.data().title || '').toLowerCase().trim();
          existingProductsMap.set(name, doc.id);
        });

        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          const productNameLower = sheetProduct.name.toLowerCase().trim();
          
          if (existingProductsMap.has(productNameLower)) {
            // Update price
            const productId = existingProductsMap.get(productNameLower);
            const priceString = String(sheetProduct.price).replace(/[^\d]/g, '');
            const newPrice = Number(priceString);
            
            if (!isNaN(newPrice) && newPrice > 0) {
              const productRef = doc(db, "products", productId);
              await updateDoc(productRef, {
                discountPrice: newPrice,
                basePrice: newPrice,
                price: newPrice
              });
              updatedCount++;
            }
          }
        }
        alert(`Đồng bộ giá thành công!\n- Đã cập nhật giá cho ${updatedCount} sản phẩm.`);
        fetchProducts(); // Reload table
      } else {
        alert("Lỗi từ Google Sheet: " + (data.error || "Không xác định"));
      }
    } catch (error) {
      console.error("Lỗi đồng bộ:", error);
      alert("Không thể kết nối đến Google Sheet. Vui lòng kiểm tra lại cấu hình.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncInfo = async () => {
    if (!googleSheetUrl || !googleSheetUrl.includes("docs.google.com/spreadsheets")) {
      alert("Vui lòng dán đúng link Google Sheet (có chứa docs.google.com/spreadsheets...) để đồng bộ!");
      return;
    }

    const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert("Link Google Sheet không hợp lệ, không tìm thấy ID!");
      return;
    }
    const sheetId = match[1];

    const gidMatch = googleSheetUrl.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '';

    setIsSyncing(true);
    try {
      const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjxwNzi7j1KMpLdrYFfPzYFYhEmFhb9ercrPho5CMXCTRKE_dx0iaoYOFwP8t20gZG/exec";
      const response = await fetch(`${APP_SCRIPT_URL}?action=bulk_import_products&sheet_id=${sheetId}&gid=${gid}`);
      const data = await response.json();
      
      if (data.success && data.products) {
        let updatedCount = 0;
        
        // Fetch existing products
        const existingProductsSnap = await getDocs(collection(db, "products"));
        const existingProductsMap = new Map();
        existingProductsSnap.forEach(doc => {
          const name = (doc.data().title || '').toLowerCase().trim();
          existingProductsMap.set(name, doc.id);
        });

        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          const productNameLower = sheetProduct.name.toLowerCase().trim();
          
          if (existingProductsMap.has(productNameLower)) {
            const productId = existingProductsMap.get(productNameLower);
            const productRef = doc(db, "products", productId);
            
            const updateData = {};
            if (sheetProduct.category) updateData.category = sheetProduct.category;
            if (sheetProduct.weight) updateData.weight = Number(sheetProduct.weight);
            if (sheetProduct.specs) updateData.specs = sheetProduct.specs;
            if (sheetProduct.stock) updateData.stock = Number(sheetProduct.stock);
            
            if (Object.keys(updateData).length > 0) {
              await updateDoc(productRef, updateData);
              updatedCount++;
            }
          }
        }
        alert(`Đồng bộ thông tin thành công!\n- Đã cập nhật Danh mục, Trọng lượng, Quy cách cho ${updatedCount} sản phẩm.`);
        fetchProducts(); // Reload table
      } else {
        alert("Lỗi từ Google Sheet: " + (data.error || "Không xác định"));
      }
    } catch (error) {
      console.error("Lỗi đồng bộ thông tin:", error);
      alert("Không thể kết nối đến Google Sheet. Vui lòng kiểm tra lại cấu hình.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportProducts = async () => {
    if (!googleSheetUrl || !googleSheetUrl.includes("docs.google.com/spreadsheets")) {
      alert("Vui lòng dán đúng link Google Sheet (có chứa docs.google.com/spreadsheets...) để tải!");
      return;
    }

    const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert("Link Google Sheet không hợp lệ, không tìm thấy ID!");
      return;
    }
    const sheetId = match[1];

    const gidMatch = googleSheetUrl.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '';

    setIsSyncing(true);
    try {
      const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjxwNzi7j1KMpLdrYFfPzYFYhEmFhb9ercrPho5CMXCTRKE_dx0iaoYOFwP8t20gZG/exec";
      const response = await fetch(`${APP_SCRIPT_URL}?action=bulk_import_products&sheet_id=${sheetId}&gid=${gid}`);
      const data = await response.json();
      
      if (data.success && data.products) {
        let createdCount = 0;
        
        // Fetch existing products to avoid duplicates
        const existingProductsSnap = await getDocs(collection(db, "products"));
        const existingProductNames = new Set(existingProductsSnap.docs.map(d => (d.data().title || '').toLowerCase().trim()));

        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          const productNameLower = sheetProduct.name.toLowerCase().trim();
          
          if (!existingProductNames.has(productNameLower)) {
            try {
              const priceString = sheetProduct.price ? String(sheetProduct.price).replace(/[^\d]/g, '') : '0';
              const priceNum = Number(priceString);
              const newProduct = {
                title: sheetProduct.name,
                slug: sheetProduct.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
                category: sheetProduct.category || "Chung",
                basePrice: priceNum,
                discountPrice: priceNum,
                price: priceNum,
                status: "Draft",
                stock: sheetProduct.stock ? Number(sheetProduct.stock) : 100,
                trackInventory: true,
                description: "",
                specs: sheetProduct.specs || "",
                image: sheetProduct.image || "",
                weight: sheetProduct.weight ? Number(sheetProduct.weight) : "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: "Sheet_Import"
              };
              await addDoc(collection(db, "products"), newProduct);
              existingProductNames.add(productNameLower); // Prevent duplicates in the same sync
              createdCount++;
            } catch (e) {
              console.error("Error creating product:", sheetProduct.name, e);
            }
          }
        }
        alert(`Tải sản phẩm mới thành công!\n- Đã thêm ${createdCount} sản phẩm mới (trạng thái Draft).`);
        fetchProducts(); // Reload table
      } else {
        alert("Lỗi từ Google Sheet: " + (data.error || "Không xác định"));
      }
    } catch (error) {
      console.error("Lỗi tải sản phẩm:", error);
      alert("Không thể kết nối đến Google Sheet. Vui lòng kiểm tra lại cấu hình.");
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
        setSelectedProducts(prev => prev.filter(pId => pId !== id));
        fetchProducts();
      } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedProducts.length} sản phẩm đã chọn không? Hành động này không thể hoàn tác!`)) {
      try {
        setLoading(true);
        // Delete all selected products in parallel
        await Promise.all(selectedProducts.map(id => deleteDoc(doc(db, "products", id))));
        setSelectedProducts([]);
        fetchProducts();
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

  const uniqueCategories = ['All', ...new Set(products.map(p => p.category || 'Chưa phân loại'))];

  const filteredProducts = products.filter(p => {
    const matchesTab = activeTab === 'All' || p.status === activeTab;
    const matchesCategory = selectedCategory === 'All' || (p.category || 'Chưa phân loại') === selectedCategory;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesCategory && matchesSearch;
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

              <div className="search-box category-filter" style={{ minWidth: '150px' }}>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '8px', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'Tất cả danh mục' : cat}</option>
                  ))}
                </select>
              </div>

              <div className="btn-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedProducts.length > 0 && (
                  <button className="primary-add-btn" onClick={handleBatchDelete} style={{ backgroundColor: '#F44336', color: '#fff' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    <span className="desktop-only">Xóa ({selectedProducts.length})</span>
                  </button>
                )}
                <input 
                  type="text" 
                  className="desktop-only"
                  placeholder="Dán link Google Sheet vào đây..." 
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  style={{ width: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '14px' }}
                />
                <button className="sync-btn desktop-only" onClick={handleUpdatePrices} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: '#333' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                  {isSyncing ? 'Đang tải...' : 'Cập nhật giá'}
                </button>
                <button className="sync-btn desktop-only" onClick={handleSyncInfo} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {isSyncing ? 'Đang tải...' : 'Đồng bộ Thông tin'}
                </button>
                <button className="sync-btn desktop-only" onClick={handleImportProducts} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #212B36', backgroundColor: '#212B36', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {isSyncing ? 'Đang tải...' : 'Lấy SP mới'}
                </button>
                <button className="primary-add-btn" onClick={onAddProduct} style={{ backgroundColor: '#212B36' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                  <span className="desktop-only">Thêm</span>
                </button>
                <button 
                  className="primary-add-btn" 
                  onClick={() => {
                    sessionStorage.setItem('ai-prompt', 'Hãy quét danh sách sản phẩm và tự động viết mô tả chi tiết, phân loại danh mục, thông số cho tất cả các sản phẩm đang ở trạng thái Draft');
                    window.dispatchEvent(new CustomEvent('admin-nav', { detail: 'ai-assistant' }));
                  }}
                  style={{ backgroundColor: '#D4AF37', color: '#1a1a1a' }}
                >
                  🪄 <span className="desktop-only">Viết nội dung (AI)</span>
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
                        <tr key={product.id} onClick={() => onPreviewProduct(product)} style={{ cursor: 'pointer', backgroundColor: selectedProducts.includes(product.id) ? 'rgba(212, 175, 55, 0.05)' : 'transparent' }}>
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
                      ))
                    )}
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
