import AdminHeader from './AdminHeader';
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, startAfter, limit, addDoc, getDoc, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { slugify } from '../utils/slugify';

import './AdminProductList.css';

const AdminProductList = ({ onAddProduct, onEditProduct, onPreviewProduct }) => {

  const [activeTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedProductIds, setSyncedProductIds] = useState([]);
  const [showSyncSuccessModal, setShowSyncSuccessModal] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState({ title: '', body: '' });
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);
  const [showSyncPanels, setShowSyncPanels] = useState(true);
  
  // Batch delete states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [allCategories, setAllCategories] = useState(new Set(['All', 'Chưa phân loại']));



  // Tự động đồng bộ 1 ngày 1 lần khi admin mở trang
  useEffect(() => {
    const checkAutoSync = async () => {
      if (autoSyncTriggered) return;
      try {
        const settingsRef = doc(db, 'storeSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) return;
        
        const data = settingsSnap.data();
        const syncMeta = data.syncMetadata;
        const config = data.openClawConfig;
        
        // Chỉ tự động nếu có config Dunvex
        if (!config?.apiUrl || !config?.botApiKey || !config?.ownerId) return;
        
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const lastSync = syncMeta?.lastAutoSync ? syncMeta.lastAutoSync.toMillis() : 0;
        
        if (now - lastSync >= oneDayMs) {
          setAutoSyncTriggered(true);
          setIsSyncing(true);
          
          // Chạy sync ngầm (không chặn UI)
          try {
            let base = config.apiUrl.replace(/\/api\/products\/?$/, '');
            base = base.replace(/\/+$/, '');
            const productsUrl = `${base}/api/products`;

            const response = await fetch(productsUrl, {
              method: 'GET',
              headers: { 'x-api-key': config.botApiKey, 'x-owner-id': config.ownerId }
            });

            if (response.ok) {
              const resData = await response.json();
              if (resData.success && resData.products) {
                let updatedCount = 0, deletedCount = 0;
                
                for (const dunvexProd of resData.products) {
                  if (!dunvexProd.name) continue;
                  const dunvexId = dunvexProd.id;
                  
                  let q = query(collection(db, "products"), where("dunvexId", "==", dunvexId), limit(1));
                  let snap = await getDocs(q);
                  let productRef = null;

                  if (!snap.empty) {
                    productRef = doc(db, "products", snap.docs[0].id);
                  }

                  if (productRef) {
                    // CHỈ update giá + tồn kho, giữ mô tả/hình ảnh
                    await updateDoc(productRef, {
                      dunvexId, basePrice: Number(dunvexProd.priceSell)||0, discountPrice: Number(dunvexProd.priceSell)||0,
                      price: Number(dunvexProd.priceSell)||0, priceBuy: Number(dunvexProd.priceImport)||0,
                      stock: Number(dunvexProd.stock)||0, trackInventory: true, updatedAt: serverTimestamp()
                    });
                    updatedCount++;
                  }
                  // KHÔNG tạo SP mới khi sync — chỉ cập nhật SP đã có dunvexId
                }
                
                // Xoá SP không còn trên app
                const allSnap = await getDocs(collection(db, "products"));
                const activeIds = new Set(resData.products.map(p => p.id));
                for (const ds of allSnap.docs) {
                  if (ds.data().dunvexId && !activeIds.has(ds.data().dunvexId)) {
                    await deleteDoc(doc(db, "products", ds.id));
                    deletedCount++;
                  }
                }
                
                // Lưu thời gian sync
                await setDoc(doc(db, 'storeSettings', settingsRef.id), 
                  { syncMetadata: { lastAutoSync: serverTimestamp(), lastResult: `Đồng bộ tự động: ${updatedCount} cập nhật, ${deletedCount} xoá` } }, 
                  { merge: true }
                );
                
                console.log(`🔄 Auto-sync: ${updatedCount} updated, ${deletedCount} deleted`);
                fetchProducts();
              }
            }
          } catch (e) {
            console.warn('Auto-sync failed (non-blocking):', e.message);
          } finally {
            setIsSyncing(false);
          }
        }
      } catch (e) {
        // Silent fail for auto-sync
      }
    };
    
    checkAutoSync();
  }, [autoSyncTriggered]);







  const normalizeCategory = (cat) => {
    if (!cat) return 'Chung';
    let clean = cat.trim();
    const lower = clean.toLowerCase();
    
    if (lower === 'sơn - giá tại kho' || lower === 'sơn' || lower === 'son' || lower === 'son - gia tai kho') {
      return 'Sơn sắt - Giá tại kho';
    }
    if (lower.startsWith('sơn sắt')) {
      return 'Sơn sắt - Giá tại kho';
    }
    if (lower.startsWith('nhựa và phụ kiện')) {
      return 'Nhựa và Phụ kiện tấm nhựa - Giá tại kho';
    }
    if (lower.startsWith('trần và phụ kiện')) {
      return 'Trần và Phụ kiện - Giá tại kho';
    }
    if (lower.startsWith('tấm duraflex')) {
      return 'Tấm DURAflex - Giá tại kho';
    }
    if (lower.startsWith('panel')) {
      return 'Panel - Giá tại kho';
    }
    if (lower.startsWith('keo trám')) {
      return 'Keo trám - Giá tại kho';
    }
    if (lower.startsWith('tính m2')) {
      return 'Tính m2 - Giá tại kho';
    }
    
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const handleSyncFromDunvex = async () => {
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'storeSettings', 'main');
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || !docSnap.data().openClawConfig) {
        alert("Chưa cấu hình API Endpoint và API Key của Dunvex trong Admin Settings!");
        setIsSyncing(false);
        return;
      }
      const config = docSnap.data().openClawConfig;
      if (!config.apiUrl || !config.botApiKey || !config.ownerId) {
        alert("Vui lòng cấu hình đầy đủ API Endpoint, API Key và Owner ID của Dunvex trong Admin Settings!");
        setIsSyncing(false);
        return;
      }

      // Resolve products url
      let base = config.apiUrl.replace(/\/api\/products\/?$/, '');
      base = base.replace(/\/+$/, '');
      const productsUrl = `${base}/api/products`;

      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'x-api-key': config.botApiKey,
          'x-owner-id': config.ownerId
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.products) {
        let updatedCount = 0;
        let createdCount = 0; // unused now — kept for reference
        let newlySyncedIds = [];
        
        for (const dunvexProd of data.products) {
          if (!dunvexProd.name) continue;
          
          const dunvexId = dunvexProd.id;
          const initialSlug = slugify(dunvexProd.name);
          let slug = initialSlug;
          
          // 1. Try to find by dunvexId first
          let q = query(collection(db, "products"), where("dunvexId", "==", dunvexId), limit(1));
          let snap = await getDocs(q);
          
          let productRef = null;
          let existingProduct = null;

          if (!snap.empty) {
            productRef = doc(db, "products", snap.docs[0].id);
            existingProduct = { id: snap.docs[0].id, ...snap.docs[0].data() };
          } else {
            // 2. Fallback: Find by slug (for backward compatibility)
            q = query(collection(db, "products"), where("slug", "==", initialSlug), limit(1));
            snap = await getDocs(q);
            if (!snap.empty) {
              const docData = snap.docs[0].data();
              if (!docData.dunvexId) {
                productRef = doc(db, "products", snap.docs[0].id);
                existingProduct = { id: snap.docs[0].id, ...docData };
              }
            }
          }

          // 3. Resolve slug collision if creating new or if slug changed
          if (!productRef || (existingProduct && existingProduct.slug !== slug)) {
            let slugCount = 0;
            let tempSlug = slug;
            let slugCollision = true;
            
            while (slugCollision) {
              const testQ = query(
                collection(db, "products"), 
                where("slug", "==", tempSlug), 
                limit(1)
              );
              const testSnap = await getDocs(testQ);
              
              if (testSnap.empty) {
                slugCollision = false;
                slug = tempSlug;
              } else {
                if (productRef && testSnap.docs[0].id === productRef.id) {
                  slugCollision = false;
                  slug = tempSlug;
                } else {
                  slugCount++;
                  tempSlug = `${initialSlug}-${slugCount}`;
                }
              }
            }
          }
          
          const priceVal = Number(dunvexProd.priceSell) || 0;
          const priceBuyVal = Number(dunvexProd.priceImport) || 0;
          const stockVal = Number(dunvexProd.stock) || 0;

          if (productRef) {
            // Update existing: CHỈ cập nhật giá và tồn kho, giữ nguyên nội dung đã chỉnh sửa
            const updateData = {
              dunvexId: dunvexId,
              basePrice: priceVal,
              discountPrice: priceVal,
              price: priceVal,
              priceBuy: priceBuyVal,
              stock: stockVal,
              trackInventory: true,
              updatedAt: serverTimestamp()
            };
            await updateDoc(productRef, updateData);
            updatedCount++;
            newlySyncedIds.push(productRef.id);
          }
          // KHÔNG tạo SP mới khi sync — chỉ cập nhật SP đã có dunvexId
        }
        
        // 4. Clean up: CHỈ xoá sản phẩm có dunvexId (từ Dunvex) mà đã bị xoá trên app
        const storefrontSnap = await getDocs(collection(db, "products"));
        const dunvexIdsInResponse = new Set(data.products.map(p => p.id));
        let deletedCount = 0;
        
        for (const docSnap of storefrontSnap.docs) {
          const docId = docSnap.id;
          const docData = docSnap.data();
          
          // Chỉ xoá nếu sản phẩm CÓ dunvexId (xác nhận từ Dunvex) VÀ không còn trên app
          if (docData.dunvexId && !dunvexIdsInResponse.has(docData.dunvexId)) {
            await deleteDoc(doc(db, "products", docId));
            deletedCount++;
          }
        }
        
        
        setSyncedProductIds(newlySyncedIds);
        // Lưu timestamp đồng bộ
        await setDoc(doc(db, 'storeSettings', 'main'), 
          { syncMetadata: { lastAutoSync: serverTimestamp(), lastResult: `Thủ công: ${updatedCount} cập nhật${deletedCount > 0 ? `, ${deletedCount} xoá` : ''}` } }, 
          { merge: true }
        );
        setSyncSuccessMessage({
          title: "Đồng bộ từ Dunvex App thành công!",
          body: `Đã cập nhật ${updatedCount} sản phẩm${deletedCount > 0 ? `, gỡ bỏ ${deletedCount} sản phẩm đã xoá trên app` : ''}.\n\n⚠️ Không tạo SP mới — chỉ đồng bộ SP đã có trong store.`
        });
        setShowSyncSuccessModal(true);
        fetchProducts(); // Reload products table
      } else {
        alert("Lỗi từ Dunvex App: " + (data.error || "Không xác định"));
      }
    } catch (error) {
      console.error("Lỗi đồng bộ Dunvex:", error);
      alert("Lỗi kết nối đến Dunvex App: " + error.message);
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

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedProducts.length} sản phẩm đã chọn không? Hành động này không thể hoàn tác!`)) {
      try {
        setLoading(true);
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
                <button onClick={handleSyncFromDunvex} disabled={isSyncing} style={{ padding: '0 12px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <svg className={isSyncing ? "spin-animation" : ""} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  {isSyncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
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
                      <img src={product.image ? product.image.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_fill/') : 'https://placehold.co/100'} alt="" />
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
