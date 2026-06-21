import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, startAfter, limit, addDoc, getDoc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

import './AdminProductList.css';

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
  const [allCategories, setAllCategories] = useState(new Set(['All', 'Chưa phân loại']));

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
        
        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          
          const slug = sheetProduct.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
          const q = query(collection(db, "products"), where("slug", "==", slug), limit(1));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            // Update price
            const productId = snap.docs[0].id;
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
        
        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          
          const slug = sheetProduct.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
          const q = query(collection(db, "products"), where("slug", "==", slug), limit(1));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            const productId = snap.docs[0].id;
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
        
        for (const sheetProduct of data.products) {
          if (!sheetProduct.name) continue;
          
          const slug = sheetProduct.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
          const q = query(collection(db, "products"), where("slug", "==", slug), limit(1));
          const snap = await getDocs(q);
          
          if (snap.empty) {
            try {
              const priceString = sheetProduct.price ? String(sheetProduct.price).replace(/[^\d]/g, '') : '0';
              const priceNum = Number(priceString);
              const newProduct = {
                title: sheetProduct.name,
                slug: slug,
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
  
  const ITEMS_PER_PAGE = 1000;

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let q;
      if (selectedCategory === 'All') {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(ITEMS_PER_PAGE));
      } else {
        q = query(collection(db, "products"), where("category", "==", selectedCategory), limit(ITEMS_PER_PAGE));
      }
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

      if (selectedCategory !== 'All') {
        productData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      setAllCategories(prev => {
        const newSet = new Set(prev);
        productData.forEach(p => newSet.add(p.category || 'Chưa phân loại'));
        return newSet;
      });

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
      let q;
      if (selectedCategory === 'All') {
        q = query(
          collection(db, "products"), 
          orderBy("createdAt", "desc"), 
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        q = query(
          collection(db, "products"), 
          where("category", "==", selectedCategory), 
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      }
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

      if (selectedCategory !== 'All') {
        productData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      setAllCategories(prev => {
        const newSet = new Set(prev);
        productData.forEach(p => newSet.add(p.category || 'Chưa phân loại'));
        return newSet;
      });

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

  // allCategories is managed in state

  const filteredProducts = products.filter(p => {
    const matchesTab = activeTab === 'All' || p.status === activeTab;
    const matchesCategory = selectedCategory === 'All' || (p.category || 'Chưa phân loại') === selectedCategory;
    const removeAccents = (str) => {
      return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };
    const matchesSearch = removeAccents(p.name).includes(removeAccents(searchQuery)) || 
                          removeAccents(p.sku).includes(removeAccents(searchQuery));
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
      
      <div className="admin-main-content">
        <header className={`admin-content-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Sản phẩm</span></nav>
          
          <div className="header-main-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="title-group" style={{ flex: 1, minWidth: '250px' }}>
              <h1 style={{ textAlign: 'left' }}>Quản lý sản phẩm</h1>
              <p className="description" style={{ textAlign: 'left' }}>Theo dõi và cập nhật tất cả sản phẩm của bạn.</p>
            </div>
            
            <div className="header-actions-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', width: 'auto' }}>
              <input 
                type="text" 
                className="desktop-only"
                placeholder="Dán link Google Sheet..." 
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                style={{ width: '200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '14px' }}
              />
              <button className="sync-btn desktop-only" onClick={handleUpdatePrices} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: '#333' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                Giá
              </button>
              <button className="sync-btn desktop-only" onClick={handleSyncInfo} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Thông tin
              </button>
              <button className="sync-btn desktop-only" onClick={handleImportProducts} disabled={isSyncing} style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid #212B36', backgroundColor: '#212B36', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Lấy SP mới
              </button>
              <button className="ai-btn" onClick={() => {
                let prompt = 'Hãy quét danh sách sản phẩm và tự động viết mô tả chi tiết, phân loại danh mục, thông số cho tất cả các sản phẩm đang ở trạng thái Draft';
                if (selectedProducts.length > 0) {
                  const selectedNames = products.filter(p => selectedProducts.includes(p.id)).map(p => `- ${p.name || p.id}`).join('\n');
                  prompt = `Tôi có danh sách các sản phẩm sau cần viết hoặc cập nhật nội dung chi tiết:\n${selectedNames}\n\nHãy hỏi tôi xem tôi muốn bạn TỰ ĐỘNG VIẾT LUÔN cho các sản phẩm này, hay tôi muốn CUNG CẤP THÊM THÔNG TIN (như tính năng, thành phần, ưu điểm...) để bạn dựa vào đó viết cho chính xác hơn.\n\nLưu ý:\n- Đừng viết nội dung sản phẩm vội, hãy chờ quyết định của tôi.\n- Khi tôi yêu cầu viết (có hoặc không có thông tin thêm), hãy cập nhật TỪNG SẢN PHẨM MỘT bằng công cụ update_product. Hãy viết bài mô tả (description) thật DÀI, CHĂM CHÚT, HẤP DẪN bằng mã HTML. Hãy khéo léo chèn tên của từng sản phẩm vào nội dung mô tả nhiều lần để bài viết trông tự nhiên và giống như được viết riêng cho sản phẩm đó.`;
                }
                sessionStorage.setItem('ai-prompt', prompt);
                window.location.href = '/admin/ai-assistant';
              }} style={{ padding: '0 16px', borderRadius: '8px', backgroundColor: '#eab308', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Viết nội dung (AI)
              </button>
              <button className="primary-add-btn" onClick={onAddProduct} style={{ backgroundColor: '#212B36', borderRadius: '8px', padding: '0 16px', height: 'auto', minHeight: '36px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                Thêm SP
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <div className="search-box" style={{ flex: 1, maxWidth: '400px', backgroundColor: '#fff', border: '1px solid #edf2f7', margin: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm sản phẩm..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="category-filter" style={{ minWidth: '200px', backgroundColor: '#fff', border: '1px solid #edf2f7', borderRadius: '14px', padding: '0 8px' }}>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ width: '100%', height: '100%', minHeight: '44px', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', color: '#1a1a2e', fontWeight: 500 }}
                >
                  {Array.from(allCategories).map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'Tất cả danh mục' : cat}</option>
                  ))}
                </select>
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
