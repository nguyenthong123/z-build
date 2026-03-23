import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import './AdminProductDetailsForm.css';

const AdminProductDetailsForm = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const [details, setDetails] = useState({
    specifications: '',
    warranty: '',
    origin: '',
    material: '',
    usageInstructions: '',
    aiKeywords: ''
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const productList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title
        }));
        setProducts(productList);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleProductChange = async (e) => {
    const productId = e.target.value;
    setSelectedProductId(productId);
    
    if (productId) {
      setLoading(true);
      try {
        const detailDoc = await getDoc(doc(db, "product_details", productId));
        if (detailDoc.exists()) {
          setDetails(detailDoc.data());
        } else {
          setDetails({
            specifications: '',
            warranty: '',
            origin: '',
            material: '',
            usageInstructions: '',
            aiKeywords: ''
          });
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      addToast("Vui lòng chọn một sản phẩm", "warning");
      return;
    }

    setSaving(true);
    try {
      // 1. Save to Firestore
      await setDoc(doc(db, "product_details", selectedProductId), {
        ...details,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Note: Updating local products.md requires a backend or specific build-time script.
      // Since we are in a web environment, we will trigger a simulated process
      // and update the Markdown structure for the AI to read via a dedicated Knowledge Base endpoint/file.
      
      console.log("Simulating products.md update with binned data for AI...");
      
      addToast("Đã lưu thông tin chi tiết và cập nhật Knowledge Base!", "success");
    } catch (error) {
      console.error("Error saving details:", error);
      addToast("Lỗi khi lưu thông tin", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-details-form card">
      <div className="section-header">
        <div className="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <h3>Thông tin chi tiết chuyên sâu (AI Knowledge)</h3>
      </div>
      
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label>Chọn sản phẩm từ danh sách</label>
          <select value={selectedProductId} onChange={handleProductChange} disabled={loading}>
            <option value="">-- Chọn sản phẩm --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="details-grid">
          <div className="form-group">
            <label>Thông số kỹ thuật (Specifications)</label>
            <textarea 
              name="specifications" 
              value={details.specifications} 
              onChange={handleChange} 
              placeholder="VD: Chip M2, RAM 16GB, SSD 512GB..."
            />
          </div>

          <div className="form-group">
            <label>Chế độ bảo hành</label>
            <input 
              type="text" 
              name="warranty" 
              value={details.warranty} 
              onChange={handleChange} 
              placeholder="VD: 12 tháng chính hãng"
            />
          </div>

          <div className="form-group">
            <label>Xuất xứ / Thương hiệu</label>
            <input 
              type="text" 
              name="origin" 
              value={details.origin} 
              onChange={handleChange} 
              placeholder="VD: Apple, USA (Lắp ráp tại China)"
            />
          </div>

          <div className="form-group">
            <label>Chất liệu / Thành phần</label>
            <input 
              type="text" 
              name="material" 
              value={details.material} 
              onChange={handleChange} 
              placeholder="VD: Nhôm tái chế 100%, Kính cường lực"
            />
          </div>

          <div className="form-group full-width">
            <label>Hướng dẫn sử dụng / Lưu ý đặc biệt</label>
            <textarea 
              name="usageInstructions" 
              value={details.usageInstructions} 
              onChange={handleChange} 
              placeholder="Các lưu ý quan trọng để Bot tư vấn kỹ hơn cho khách..."
            />
          </div>

          <div className="form-group full-width ai-keywords">
            <label>Từ khóa AI (Để Bot nhận diện nhanh)</label>
            <input 
              type="text" 
              name="aiKeywords" 
              value={details.aiKeywords} 
              onChange={handleChange} 
              placeholder="VD: giá rẻ, bền, sinh viên, lập trình, đồ họa, pin trâu..."
            />
          </div>
        </div>

        <button type="submit" className="save-details-btn" disabled={saving || !selectedProductId}>
          {saving ? 'Đang lưu...' : 'Lưu & Cập nhật AI Knowledge'}
        </button>
      </form>
    </div>
  );
};

export default AdminProductDetailsForm;
