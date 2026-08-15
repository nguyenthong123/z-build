import AdminHeader from './AdminHeader';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, startAfter, limit, addDoc, getDoc, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { slugify } from '../utils/slugify';
import { getDunvexBaseUrl } from '../utils/dunvexSync';

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
        if (!(config?.dunvexWebhookUrl || config?.dunvexApiUrl || config?.apiUrl) || !(config?.dunvexApiKey || config?.apiKey || config?.botApiKey) || !config?.ownerId) return;
        
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const lastSync = syncMeta?.lastAutoSync ? syncMeta.lastAutoSync.toMillis() : 0;
        
        if (now - lastSync >= oneDayMs) {
          setAutoSyncTriggered(true);
          
          // Chạy sync ngầm (không chặn UI)
          try {
            const dunvexBase = getDunvexBaseUrl(config);
            if (!dunvexBase) throw new Error('Không thể xác định URL Dunvex');
            const productsUrl = `${dunvexBase}/api/products`;

            const response = await fetch(productsUrl, {
              method: 'GET',
              headers: { 'x-api-key': config.dunvexApiKey || config.apiKey || config.botApiKey, 'x-owner-id': config.ownerId }
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
                refreshProducts();
              }
            }
          } catch (e) {
            console.warn('Auto-sync failed (non-blocking):', e.message);
          }
        }
      } catch {
        // Silent fail for auto-sync
      }
    };
    
    checkAutoSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncTriggered]);









  /**
   * Helper: lấy config Dunvex từ Firestore + fetch products từ API
   * Trả về { config, products } hoặc null nếu lỗi
   */
  const getDunvexConfigAndProducts = async () => {
    const docRef = doc(db, 'storeSettings', 'main');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || !docSnap.data().openClawConfig) {
      alert("Chưa cấu hình API Endpoint và API Key của Dunvex trong Admin Settings!");
      return null;
    }
    const config = docSnap.data().openClawConfig;
    if (!(config.dunvexWebhookUrl || config.dunvexApiUrl || config.apiUrl) || !(config.dunvexApiKey || config.apiKey || config.botApiKey) || !config.ownerId) {
      alert("Vui lòng cấu hình đầy đủ Webhook URL, API Key và Owner ID của Dunvex trong Admin Settings!");
      return null;
    }
    const dunvexBase2 = getDunvexBaseUrl(config);
    if (!dunvexBase2) throw new Error('Không thể xác định URL Dunvex');
    const productsUrl = `${dunvexBase2}/api/products`;
    try {
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: { 'x-api-key': config.dunvexApiKey || config.apiKey || config.botApiKey, 'x-owner-id': config.ownerId }
      });
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.products) {
        alert("Lỗi từ Dunvex App: " + (data.error || "Không xác định"));
        return null;
      }
      return { config, products: data.products };
    } catch (error) {
      alert("Lỗi kết nối đến Dunvex App: " + error.message);
      return null;
    }
  };

  /**
   * 🔄 NÚT 1: Đồng bộ sản phẩm — CHỈ cập nhật sản phẩm đã có dunvexId
   * Cập nhật: title, price, stock, specs, weight, category, v.v.
   * KHÔNG tạo mới, KHÔNG xoá
   */
  const handleSyncExistingProducts = async () => {
    setIsSyncingExisting(true);
    try {
      const result = await getDunvexConfigAndProducts();
      if (!result) { setIsSyncingExisting(false); return; }
      const { products: dunvexProducts } = result;

      let updatedCount = 0;
      const newlySyncedIds = [];

      for (const dunvexProd of dunvexProducts) {
        if (!dunvexProd.name) continue;
        const dunvexId = dunvexProd.id;

        // Tìm sản phẩm có dunvexId tương ứng trên Web
        let snap = await getDocs(query(collection(db, "products"), where("dunvexId", "==", dunvexId), limit(1)));
        // Fallback: SP sync cũ có thể thiếu dunvexId → tìm bằng tên
        if (snap.empty) {
          snap = await getDocs(query(collection(db, "products"), where("title", "==", dunvexProd.name), limit(1)));
        }
        if (snap.empty) continue; // Không tìm thấy → bỏ qua (không tạo mới)

        const productRef = doc(db, "products", snap.docs[0].id);

        const priceVal = Number(dunvexProd.priceSell) || 0;
        const priceBuyVal = Number(dunvexProd.priceImport) || 0;
        const stockVal = Number(dunvexProd.stock) || 0;
        const dunvexSpecs = dunvexProd.specs || dunvexProd.spec || dunvexProd.quyCach || dunvexProd.specification || dunvexProd.attributes || dunvexProd.size || '';
        const dunvexUnit = dunvexProd.unit || '';
        const dunvexWeight = dunvexProd.weight || dunvexProd.netWeight || '';
        const dunvexPackaging = dunvexProd.packaging || dunvexProd.packing || '';

        let exactCategory = 'Chưa phân loại';
        if (typeof dunvexProd.category === 'object' && dunvexProd.category !== null && dunvexProd.category.name) {
          exactCategory = dunvexProd.category.name;
        } else if (typeof dunvexProd.category === 'string' && dunvexProd.category.trim() !== '') {
          exactCategory = dunvexProd.category;
        }

        await updateDoc(productRef, {
          title: dunvexProd.name,
          dunvexId,
          category: exactCategory,
          basePrice: priceVal,
          discountPrice: priceVal,
          price: priceVal,
          priceBuy: priceBuyVal,
          stock: stockVal,
          trackInventory: true,
          specs: dunvexSpecs,
          unit: dunvexUnit,
          weight: dunvexWeight,
          packaging: dunvexPackaging,
          updatedAt: serverTimestamp()
        });
        updatedCount++;
        newlySyncedIds.push(productRef.id);
      }

      setSyncedProductIds(newlySyncedIds);
      await setDoc(doc(db, 'storeSettings', 'main'),
        { syncMetadata: { lastAutoSync: serverTimestamp(), lastResult: `Cập nhật: ${updatedCount} sản phẩm` } },
        { merge: true }
      );
      setSyncSuccessMessage({
        title: "✅ Đồng bộ sản phẩm thành công!",
        body: `Đã cập nhật ${updatedCount} sản phẩm (tên, giá, tồn kho, quy cách, danh mục).`
      });
      setShowSyncSuccessModal(true);
      refreshProducts();
    } catch (error) {
      console.error("Lỗi đồng bộ sản phẩm:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setIsSyncingExisting(false);
    }
  };

  /**
   * 🆕 NÚT 2: Lấy sản phẩm mới — CHỈ tạo sản phẩm có trên Dunvex mà chưa có trên Web
   * KHÔNG cập nhật sản phẩm cũ, KHÔNG xoá
   */
  const handleFetchNewProducts = async () => {
    setIsFetchingNew(true);
    try {
      const result = await getDunvexConfigAndProducts();
      if (!result) { setIsFetchingNew(false); return; }
      const { products: dunvexProducts } = result;

      // Lấy toàn bộ dunvexId và tên SP hiện có trên Web
      const allSnap = await getDocs(collection(db, "products"));
      const existingDunvexIds = new Set();
      const existingNames = new Set();
      allSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.dunvexId) existingDunvexIds.add(d.dunvexId);
        if (d.title) existingNames.add(d.title.toLowerCase().trim());
      });

      // Lọc sản phẩm mới (có trên Dunvex nhưng chưa có trên Web)
      const newProducts = dunvexProducts.filter(p =>
        p.id && !existingDunvexIds.has(p.id) && !existingNames.has((p.name || '').toLowerCase().trim())
      );

      if (newProducts.length === 0) {
        setSyncSuccessMessage({
          title: "ℹ️ Không có sản phẩm mới",
          body: "Tất cả sản phẩm trên Dunvex App đã có trên Web."
        });
        setShowSyncSuccessModal(true);
        setIsFetchingNew(false);
        return;
      }

      let createdCount = 0;
      const newlyCreatedIds = [];

      for (const dunvexProd of newProducts) {
        if (!dunvexProd.name) continue;
        const dunvexId = dunvexProd.id;
        let slug = slugify(dunvexProd.name);

        // Resolve slug collision
        let slugCount = 0;
        let tempSlug = slug;
        let collision = true;
        while (collision) {
          const testQ = query(collection(db, "products"), where("slug", "==", tempSlug), limit(1));
          const testSnap = await getDocs(testQ);
          if (testSnap.empty) { collision = false; slug = tempSlug; }
          else { slugCount++; tempSlug = `${slugify(dunvexProd.name)}-${slugCount}`; }
        }

        const priceVal = Number(dunvexProd.priceSell) || 0;
        const priceBuyVal = Number(dunvexProd.priceImport) || 0;
        const stockVal = Number(dunvexProd.stock) || 0;
        const dunvexSpecs = dunvexProd.specs || dunvexProd.spec || dunvexProd.quyCach || dunvexProd.specification || dunvexProd.attributes || dunvexProd.size || '';
        const dunvexUnit = dunvexProd.unit || '';
        const dunvexWeight = dunvexProd.weight || dunvexProd.netWeight || '';
        const dunvexPackaging = dunvexProd.packaging || dunvexProd.packing || '';
        const dunvexImage = dunvexProd.image || dunvexProd.imageUrl || dunvexProd.thumbnail || '';

        let exactCategory = 'Chưa phân loại';
        if (typeof dunvexProd.category === 'object' && dunvexProd.category !== null && dunvexProd.category.name) {
          exactCategory = dunvexProd.category.name;
        } else if (typeof dunvexProd.category === 'string' && dunvexProd.category.trim() !== '') {
          exactCategory = dunvexProd.category;
        }

        const newDocRef = await addDoc(collection(db, "products"), {
          dunvexId,
          title: dunvexProd.name,
          slug,
          category: exactCategory,
          basePrice: priceVal,
          discountPrice: priceVal,
          price: priceVal,
          priceBuy: priceBuyVal,
          stock: stockVal,
          trackInventory: true,
          specs: dunvexSpecs,
          unit: dunvexUnit,
          weight: dunvexWeight,
          packaging: dunvexPackaging,
          image: dunvexImage,
          shortDescription: dunvexProd.shortDesc || dunvexProd.shortDescription || '',
          description: dunvexProd.note || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'Draft',
        });
        createdCount++;
        newlyCreatedIds.push(newDocRef.id);
      }

      setSyncedProductIds(newlyCreatedIds);
      await setDoc(doc(db, 'storeSettings', 'main'),
        { syncMetadata: { lastAutoSync: serverTimestamp(), lastResult: `Tạo mới: ${createdCount} sản phẩm` } },
        { merge: true }
      );
      setSyncSuccessMessage({
        title: "🆕 Lấy sản phẩm mới thành công!",
        body: `Đã tạo mới ${createdCount} sản phẩm từ Dunvex App lên Web.`
      });
      setShowSyncSuccessModal(true);
      refreshProducts();
    } catch (error) {
      console.error("Lỗi lấy sản phẩm mới:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setIsFetchingNew(false);
    }
  };

  /**
   * 🗑️ NÚT 3: Xoá sản phẩm cũ — so sánh toàn bộ ID, xoá SP có trên Web nhưng không có trên Dunvex
   * CHỈ xoá sản phẩm có dunvexId, KHÔNG cập nhật, KHÔNG tạo mới
   */
  const handleDeleteMissingProducts = async () => {
    if (!window.confirm("⚠️ Thao tác này sẽ XOÁ VĨNH VIỄN các sản phẩm không còn tồn tại trên Dunvex App.\n\nBạn có chắc chắn muốn tiếp tục?")) {
      return;
    }
    setIsDeletingOld(true);
    try {
      const result = await getDunvexConfigAndProducts();
      if (!result) { setIsDeletingOld(false); return; }
      const { products: dunvexProducts } = result;

      const dunvexIds = new Set(dunvexProducts.map(p => p.id));
      const dunvexNames = new Set(dunvexProducts.map(p => p.name?.toLowerCase().trim()));
      const allSnap = await getDocs(collection(db, "products"));
      
      // Gom danh sách SP cần xoá trước, để hiển thị cho user review
      const toDelete = [];
      for (const docSnap of allSnap.docs) {
        const data = docSnap.data();
        let isOrphan = false;
        if (data.dunvexId) {
          // Có dunvexId nhưng không còn trên Dunvex App
          isOrphan = !dunvexIds.has(data.dunvexId);
        } else if (data.title) {
          // Không có dunvexId → match bằng tên (đã trim, lowercase)
          // SP sync cũ có thể thiếu dunvexId
          isOrphan = !dunvexNames.has(data.title.toLowerCase().trim());
        }
        // SP không có title → SP lỗi → cũng xoá
        // (SP tạo thủ công luôn có title nên an toàn)
        if (isOrphan) {
          toDelete.push({ id: docSnap.id, name: data.title || '(không tên)' });
        }
      }

      if (toDelete.length === 0) {
        setSyncSuccessMessage({
          title: "ℹ️ Không có sản phẩm cũ",
          body: "Tất cả sản phẩm trên Web đều khớp với Dunvex App."
        });
        setShowSyncSuccessModal(true);
        setIsDeletingOld(false);
        return;
      }

      // Hiển thị danh sách SP sẽ xoá để user confirm
      const previewList = toDelete.slice(0, 10).map(p => `• ${p.name}`).join('\n');
      const extra = toDelete.length > 10 ? `\n... và ${toDelete.length - 10} sản phẩm khác` : '';
      if (!window.confirm(`⚠️ Sẽ XOÁ VĨNH VIỄN ${toDelete.length} sản phẩm không còn trên Dunvex App:\n\n${previewList}${extra}\n\nBạn có chắc chắn muốn tiếp tục?`)) {
        setIsDeletingOld(false);
        return;
      }

      let deletedCount = 0;
      for (const item of toDelete) {
        await deleteDoc(doc(db, "products", item.id));
        deletedCount++;
      }

      await setDoc(doc(db, 'storeSettings', 'main'),
        { syncMetadata: { lastAutoSync: serverTimestamp(), lastResult: `Xoá: ${deletedCount} sản phẩm không còn trên app` } },
        { merge: true }
      );
      setSyncSuccessMessage({
        title: "🗑️ Dọn dẹp hoàn tất!",
        body: deletedCount > 0
          ? `Đã xoá ${deletedCount} sản phẩm không còn tồn tại trên Dunvex App.`
          : "Không có sản phẩm nào cần xoá. Tất cả đều khớp với Dunvex App."
      });
      setShowSyncSuccessModal(true);
      refreshProducts();
    } catch (error) {
      console.error("Lỗi xoá sản phẩm cũ:", error);
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
      const q = query(collection(db, "products"));
      const snapshot = await getDocs(q);
      allProductsCache.current = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        price: (doc.data().discountPrice || doc.data().basePrice) 
                ? Number(doc.data().discountPrice || doc.data().basePrice).toLocaleString('vi-VN') + '₫' 
                : 'Liên hệ',
        name: doc.data().title || doc.data().dunvexId || doc.id.substring(0, 12),
        sku: doc.data().sku || doc.id.substring(0, 8).toUpperCase(),
        dunvexId: doc.data().dunvexId,
        title: doc.data().title
      }));
    } catch (error) {
      console.error("Error loading product cache:", error);
    }
  };

  // Search từ cache (không gọi Firestore)
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

  // Refresh cache + reload list (dùng sau sync/delete)
  const refreshProducts = async () => {
    await loadAllProductsCache();
    fetchProducts();
  };

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
        name: doc.data().title || doc.data().dunvexId || doc.id.substring(0, 12),
        sku: doc.data().sku || doc.id.substring(0, 8).toUpperCase(),
        dunvexId: doc.data().dunvexId,
        title: doc.data().title
      }));

      if (selectedCategory !== 'All') {
        productData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      // Cập nhật categories
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
        name: doc.data().title || doc.data().dunvexId || doc.id.substring(0, 12),
        sku: doc.data().sku || doc.id.substring(0, 8).toUpperCase(),
        dunvexId: doc.data().dunvexId,
        title: doc.data().title
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
        refreshProducts();
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
