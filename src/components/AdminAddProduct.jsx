import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './AdminAddProduct.css';
import AdminSidebar from './AdminSidebar';

const AdminAddProduct = ({ onBack, onSave, editData }) => {
  const [product, setProduct] = useState({
    title: '',
    description: '',
    status: 'Active',
    category: 'Electronics',
    basePrice: '',
    discountPrice: '',
    stock: '',
    trackInventory: true,
    isTrending: false,
    variants: [
      { id: 1, type: 'Size', values: ['S', 'M', 'L'] },
      { id: 2, type: 'Color', values: ['Black', 'Silver'] }
    ],
    extraImages: ['', ''],
    videoUrl: '',
    extraVideoUrl: '',
    demoUrl: '',
    quoteUrl: '',
    pdfUrl: '',
    pricingType: 'one-time', // 'one-time' or 'subscription'
    monthlyPrice: '',
    yearlyPrice: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extraFiles, setExtraFiles] = useState([null, null]);
  const [extraPreviews, setExtraPreviews] = useState([null, null]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (editData) {
      setProduct({
        ...editData,
        // Ensure values are strings for numeric inputs
        basePrice: editData.basePrice || '',
        discountPrice: editData.discountPrice || '',
        stock: editData.stock || '',
        pricingType: editData.pricingType || 'one-time',
        monthlyPrice: editData.monthlyPrice || '',
        yearlyPrice: editData.yearlyPrice || '',
        pdfUrl: editData.pdfUrl || '',
        isTrending: editData.isTrending || false,
      });
      if (editData.image) {
        setImagePreview(editData.image);
      }
      if (editData.extraImages) {
        setExtraPreviews(editData.extraImages);
      }
    }
  }, [editData]);

  const addVariant = () => {
    setProduct(prev => ({
      ...prev,
      variants: [...prev.variants, { id: Date.now(), type: 'Tùy chọn mới', values: [] }]
    }));
  };

  const deleteVariant = (id) => {
    setProduct(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }));
  };

  const addPill = (variantId) => {
    const newVal = prompt("Nhập giá trị mới (ví dụ: 12mm, Chống cháy...):");
    if (newVal && newVal.trim()) {
      setProduct(prev => ({
        ...prev,
        variants: prev.variants.map(v => 
          v.id === variantId ? { ...v, values: [...v.values, newVal.trim()] } : v
        )
      }));
    }
  };

  const generateDescription = async () => {
    if (!product.title) {
      alert("Vui lòng nhập tên sản phẩm trước để AI có thể phân tích.");
      return;
    }

    setIsGenerating(true);
    try {
      // Ưu tiên sử dụng DeepSeek như yêu cầu của người dùng
      const deepseekKey = import.meta.env.VITE_DEEPSEEK_GENERAL_KEY;
      
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `Bạn là chuyên gia tư vấn vật liệu xây dựng và giải pháp công nghệ. 
              Nhiệm vụ: Viết mô tả sản phẩm chuyên nghiệp, thuyết phục.
              
              Đầu vào: Tên sản phẩm, Trạng thái, Mô tả sơ bộ.
              Yêu cầu trả về JSON (chỉ JSON):
              1. "description": Nội dung chuẩn SEO, sử dụng HTML (<strong>, <p>, <ul>, <li>).
              2. "status": Nếu tên có "phân phối", trả về "Phân phối".
              3. "category": Đề xuất 1 trong: "Vật liệu xây dựng", "Phần mềm & Dịch vụ", "Thiết bị vệ sinh", "Trang trí nội thất", "Công cụ & Dụng cụ", "Điện tử".
              4. "demoUrl": Nếu là phần mềm, tìm/đề xuất link demo.
              5. "quoteUrl": Nếu là phân phối, tìm/đề xuất link báo giá.
              6. "variants": Đề xuất 2-3 loại biến thể phù hợp.`
            },
            {
              role: "user",
              content: `Tên: ${product.title}\nTrạng thái: ${product.status}\nSơ bộ: ${product.description}`
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiResponse = JSON.parse(data.choices[0].message.content);
      
      // Normalize variants to ensure they always have a 'values' array
      const normalizedVariants = aiResponse.variants?.map((v, index) => ({
        id: Date.now() + index,
        type: v.type || 'Tùy chọn',
        values: Array.isArray(v.values) ? v.values : []
      })) || prev.variants;

      setProduct(prev => ({ 
        ...prev, 
        description: aiResponse.description,
        status: aiResponse.status || prev.status,
        category: aiResponse.category || prev.category,
        demoUrl: aiResponse.demoUrl || prev.demoUrl || '',
        quoteUrl: aiResponse.quoteUrl || prev.quoteUrl || '',
        variants: normalizedVariants
      }));
    } catch (error) {
      console.error("Error generating with AI:", error);
      alert("Lỗi khi kết nối AI: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDescriptionChange = (content) => {
    setProduct(prev => ({
      ...prev,
      description: content
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProduct(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  const handleExtraImageChange = (e, index) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newFiles = [...extraFiles];
      newFiles[index] = file;
      setExtraFiles(newFiles);

      const newPreviews = [...extraPreviews];
      newPreviews[index] = URL.createObjectURL(file);
      setExtraPreviews(newPreviews);
    }
  };

  const handleSave = async () => {
    // Đối với trạng thái 'Phân phối', cho phép để trống giá hoặc giá bằng 0
    const isPriceRequired = product.status !== 'Phân phối';
    if (!product.title || (isPriceRequired && !product.basePrice)) {
      alert(isPriceRequired ? "Vui lòng điền tên sản phẩm và giá gốc" : "Vui lòng điền tên sản phẩm");
      return;
    }

    setIsSaving(true);
    let imageUrl = '';

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.error) {
           throw new Error(data.error.message);
        }
        imageUrl = data.secure_url;
      } else if (editData && editData.image) {
        imageUrl = editData.image;
      }

      // Upload extra images
      const extraUrls = [...(product.extraImages || ['', ''])];
      for (let i = 0; i < extraFiles.length; i++) {
        if (extraFiles[i]) {
          const formData = new FormData();
          formData.append('file', extraFiles[i]);
          formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
          });
          const d = await res.json();
          if (d.secure_url) extraUrls[i] = d.secure_url;
        }
      }

      if (editData) {
        const productRef = doc(db, "products", editData.id);
        const { id, ...updateData } = product; // Remove id if present in state
        await updateDoc(productRef, {
          ...updateData,
          image: imageUrl,
          extraImages: extraUrls,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "products"), {
          ...product,
          image: imageUrl,
          extraImages: extraUrls,
          createdBy: auth.currentUser?.email || 'Hệ thống',
          createdAt: new Date().toISOString()
        });
      }

      setIsSaving(false);
      onSave();
    } catch (e) {
      console.error("Error saving product: ", e);
      alert("Lưu sản phẩm thất bại: " + e.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-add-product-page">
      <AdminSidebar activePage="products" />
      
      <div className="admin-main-content">
        <header className="admin-content-header">
          <div className="header-left">
            <nav className="breadcrumb">
              <span onClick={onBack} className="back-link">Sản phẩm</span>
              <span className="separator">/</span>
              <span className="current">{editData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</span>
            </nav>
            <h1>{editData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h1>
          </div>
          <div className="header-actions">
            <button className="cancel-btn" onClick={onBack} disabled={isSaving}>Hủy</button>
            <button className="save-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : editData ? 'Cập nhật' : 'Lưu sản phẩm'}
            </button>
          </div>
        </header>

        <div className="add-product-container">
          <div className="main-form-column">
            {/* Basic Information */}
            <section className="form-section card">
              <div className="section-header">
                <div className="section-icon info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </div>
                <h3>Thông tin cơ bản</h3>
              </div>
              <div className="form-group">
                <label>Tên sản phẩm</label>
                <input 
                  type="text" 
                  name="title"
                  placeholder="Ví dụ: Tai nghe không dây cao cấp" 
                  value={product.title}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>Mô tả sản phẩm</label>
                  <button 
                    type="button" 
                    onClick={generateDescription} 
                    disabled={isGenerating}
                    style={{
                      background: 'linear-gradient(135deg, #FFB800 0%, #FF8A00 100%)',
                      color: '#1a1a2e',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '700',
                      transition: 'all 0.3s ease',
                      opacity: isGenerating ? 0.7 : 1
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M3 5h4"/></svg>
                    {isGenerating ? 'Đang tạo...' : 'Tự động viết bằng AI'}
                  </button>
                </div>
                <div className="rich-editor-container">
                  <ReactQuill 
                    theme="snow"
                    value={product.description}
                    onChange={handleDescriptionChange}
                    placeholder="Mô tả các tính năng và lợi ích nổi bật của sản phẩm..."
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'clean']
                      ],
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Product Media */}
            <section className="form-section card">
              <div className="section-header">
                <div className="section-icon media">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>
                <h3>Hình ảnh sản phẩm</h3>
              </div>
              <div 
                className="upload-area" 
                onClick={() => document.getElementById('productImage').click()} 
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <input 
                  type="file" 
                  id="productImage" 
                  style={{ display: 'none' }} 
                  accept="image/*" 
                  onChange={handleImageChange} 
                />
                {imagePreview ? (
                  <img src={imagePreview} alt="Xem trước" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                ) : (
                  <div className="upload-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>Kéo thả hình ảnh vào đây, hoặc <span>chọn từ máy tính</span></p>
                    <span style={{ color: '#FFB800', fontWeight: 'bold' }}>Kích thước khuyên dùng: 1000 x 1100 px (Dọc)</span>
                    <span>Hỗ trợ: JPG, PNG, WEBP (Tối đa 5MB)</span>
                  </div>
                )}
              </div>

              <div className="extra-media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', padding: '15px' }}>
                {[0, 1].map(index => (
                  <div key={index} className="extra-image-container">
                    <div 
                      className="extra-image-upload" 
                      onClick={() => document.getElementById(`extraImage${index}`).click()} 
                      style={{ 
                        border: '2px dashed #e0e4e9', 
                        borderRadius: '12px', 
                        aspectRatio: '16/9',
                        width: '100%',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer', 
                        overflow: 'hidden', 
                        marginBottom: '8px',
                        background: '#fafbfc',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input type="file" id={`extraImage${index}`} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleExtraImageChange(e, index)} />
                      {extraPreviews[index] ? (
                        <img src={extraPreviews[index]} alt="Sub" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f5f5f5' }} />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#999' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          <p style={{ fontSize: '11px', margin: '4px 0 0', fontWeight: '500' }}>Ảnh phụ {index + 1} (16:9)</p>
                          <p style={{ fontSize: '9px', opacity: 0.7 }}>Khuyên dùng: 1280x720px</p>
                        </div>
                      )}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Hoặc dán URL ảnh..." 
                      value={product.extraImages[index] || ''} 
                      onChange={(e) => {
                        const newUrls = [...product.extraImages];
                        newUrls[index] = e.target.value;
                        setProduct(prev => ({ ...prev, extraImages: newUrls }));
                        const newPreviews = [...extraPreviews];
                        newPreviews[index] = e.target.value;
                        setExtraPreviews(newPreviews);
                      }}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #e0e0e0' }}
                    />
                  </div>
                ))}
              </div>

              <div className="video-url-input" style={{ padding: '0 15px 15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Video YouTube 1</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        name="videoUrl"
                        placeholder="Link youtube..." 
                        value={product.videoUrl}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px' }}
                      />
                      <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#FFB800' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Video YouTube 2</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        name="extraVideoUrl"
                        placeholder="Link youtube..." 
                        value={product.extraVideoUrl || ''}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px' }}
                      />
                      <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#FFB800' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Variants Section */}
            <section className="form-section card">
              <div className="section-header">
                <div className="section-icon variants">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
                <h3>Biến thể sản phẩm</h3>
                <button className="add-variant-btn" type="button" onClick={addVariant}>Thêm tùy chọn</button>
              </div>
              <div className="variants-list">
                {product.variants?.map(variant => (
                  <div key={variant.id} className="variant-row">
                    <div className="variant-type">
                      <label>Loại tùy chọn</label>
                      <input 
                        type="text" 
                        value={variant.type} 
                        onChange={(e) => {
                          const newType = e.target.value;
                          setProduct(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => v.id === variant.id ? { ...v, type: newType } : v)
                          }));
                        }} 
                      />
                    </div>
                    <div className="variant-values">
                      <label>Giá trị tùy chọn</label>
                      <div className="pill-container">
                        {variant.values?.map((val, idx) => (
                          <span key={idx} className="value-pill">
                            {val}
                            <button 
                              type="button"
                              className="remove-pill"
                              style={{ border: 'none', background: 'none', color: '#ff4d4f', marginLeft: '6px', cursor: 'pointer', fontSize: '14px' }}
                              onClick={() => {
                                setProduct(prev => ({
                                  ...prev,
                                  variants: prev.variants.map(v => 
                                    v.id === variant.id ? { ...v, values: v.values.filter((_, i) => i !== idx) } : v
                                  )
                                }));
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button className="add-pill" type="button" onClick={() => addPill(variant.id)}>+</button>
                      </div>
                    </div>
                    <button className="delete-row-btn" type="button" onClick={() => deleteVariant(variant.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Mobile Actions (Hidden on Desktop) */}
            <div className="mobile-only-save p-4">
               <button className="save-btn w-full py-4 text-lg font-bold" onClick={handleSave} disabled={isSaving}>
                 {isSaving ? 'Đang lưu...' : editData ? 'Cập nhật' : 'Lưu sản phẩm'}
               </button>
            </div>
          </div>

          <div className="side-form-column">
            {/* Organization */}
            <section className="form-section card">
              <div className="section-header">
                <h3>PHÂN LOẠI</h3>
              </div>
              <div className="form-group">
                <label>Trạng thái</label>
                <select name="status" value={product.status} onChange={handleChange}>
                  <option value="Active">Hoạt động</option>
                  <option value="Phân phối">Phân phối</option>
                  <option value="Draft">Bản nháp</option>
                  <option value="Inactive">Ngừng kinh doanh</option>
                  <option value="Agency">Áp dụng cho đại lý</option>
                  <option value="Contractor">Áp dụng cho thầu thợ</option>
                  <option value="Homeowner">Áp dụng cho chủ nhà</option>
                </select>
              </div>
              <div className="form-group">
                <label>Danh mục</label>
                <select name="category" value={product.category} onChange={handleChange}>
                   <option value="Vật liệu xây dựng">Vật liệu xây dựng</option>
                  <option value="Phần mềm & Dịch vụ">Phần mềm & Dịch vụ</option>
                  <option value="Thiết bị vệ sinh">Thiết bị vệ sinh</option>
                  <option value="Trang trí nội thất">Trang trí nội thất</option>
                  <option value="Công cụ & Dụng cụ">Công cụ & Dụng cụ</option>
                  <option value="Điện tử">Điện tử</option>
                  <option value="Laptops">Laptop</option>
                  <option value="Âm thanh">Âm thanh</option>
                </select>
              </div>
            </section>

            {/* Pricing */}
            <section className="form-section card">
              <div className="section-header">
                <h3>GIÁ CẢ</h3>
              </div>
              <div className="form-group">
                <label>{product.status === 'Phân phối' ? 'Giá tới nơi' : 'Giá gốc'}</label>
                <div className="input-with-prefix">
                  <span className="prefix">VNĐ</span>
                  <input 
                    type="number" 
                    name="basePrice"
                    placeholder="0"
                    value={product.basePrice}
                    onChange={handleChange}
                  />
                </div>
              </div>
               <div className="form-group">
                <label>{product.status === 'Phân phối' ? 'Chính hãng (Tùy chọn)' : 'Giá khuyến mãi'}</label>
                <div className="input-with-prefix">
                  <span className="prefix">VNĐ</span>
                  <input 
                    type="number" 
                    name="discountPrice"
                    placeholder="0"
                    value={product.discountPrice}
                    onChange={handleChange}
                  />
                </div>
                <span className="input-hint">
                  {product.status === 'Phân phối' 
                    ? 'Nếu để trống cả 2 giá, hệ thống sẽ hiện "Liên hệ báo giá"' 
                    : 'Để trống nếu không có giảm giá'}
                </span>
              </div>

              {/* Advanced Pricing for Software/Subscription */}
              {product.category === 'Phần mềm & Dịch vụ' && (
                <div className="advanced-pricing-box animate-fade-in" style={{ marginTop: '15px', padding: '15px', background: '#f0f7ff', borderRadius: '12px', border: '1px solid #cce5ff' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#004085', marginBottom: '10px', display: 'block' }}>CẤU HÌNH GIÁ THUÊ BAO</label>
                  
                  <div className="form-group">
                    <label>Loại hình thanh toán</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        type="button"
                        onClick={() => setProduct(prev => ({ ...prev, pricingType: 'one-time' }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid', borderColor: product.pricingType === 'one-time' ? '#007bff' : '#ddd', background: product.pricingType === 'one-time' ? '#e7f3ff' : 'white', color: product.pricingType === 'one-time' ? '#007bff' : '#666', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Mua một lần
                      </button>
                      <button 
                        type="button"
                        onClick={() => setProduct(prev => ({ ...prev, pricingType: 'subscription' }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid', borderColor: product.pricingType === 'subscription' ? '#007bff' : '#ddd', background: product.pricingType === 'subscription' ? '#e7f3ff' : 'white', color: product.pricingType === 'subscription' ? '#007bff' : '#666', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Thuê bao
                      </button>
                    </div>
                  </div>

                  {product.pricingType === 'subscription' && (
                    <div className="subscription-fields animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Giá mỗi tháng</label>
                        <input 
                          type="number" 
                          name="monthlyPrice"
                          placeholder="VNĐ / tháng"
                          value={product.monthlyPrice}
                          onChange={handleChange}
                          style={{ padding: '8px 10px', fontSize: '13px' }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Giá mỗi năm</label>
                        <input 
                          type="number" 
                          name="yearlyPrice"
                          placeholder="VNĐ / năm"
                          value={product.yearlyPrice}
                          onChange={handleChange}
                          style={{ padding: '8px 10px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Stock */}
            <section className="form-section card">
              <div className="section-header">
                <h3>KHO HÀNG</h3>
              </div>
              <div className="form-group">
                <label>Số lượng tồn kho</label>
                <input 
                  type="number" 
                  name="stock"
                  placeholder="0"
                  value={product.stock}
                  onChange={handleChange}
                />
              </div>
              <div className="toggle-group">
                <div className="toggle-info">
                  <strong>Theo dõi kho hàng</strong>
                  <span>Tự động cập nhật số lượng khi có đơn hàng</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    name="trackInventory"
                    checked={product.trackInventory}
                    onChange={handleChange}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              <div className="toggle-group">
                <div className="toggle-info">
                  <strong>Đánh dấu là sản phẩm Trending</strong>
                  <span>Sản phẩm sẽ hiển thị trong danh sách Xu hướng hiện nay</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    name="isTrending"
                    checked={product.isTrending}
                    onChange={handleChange}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              {product.category === 'Phần mềm & Dịch vụ' && (
                <div className="form-group animate-fade-in" style={{ marginTop: '15px', padding: '15px', background: 'rgba(33, 150, 243, 0.05)', borderRadius: '10px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                  <label style={{ color: '#2196F3', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Đường dẫn Bản Demo (Dành cho Phần mềm)
                  </label>
                  <input 
                    type="text" 
                    name="demoUrl"
                    placeholder="https://demo.example.com" 
                    value={product.demoUrl || ''}
                    onChange={handleChange}
                    style={{ borderColor: 'rgba(33, 150, 243, 0.3)' }}
                  />
                  <span className="input-hint">Nút "Xem Bản Demo" sẽ hiển thị trong trang chi tiết sản phẩm.</span>
                </div>
              )}

              {product.status === 'Phân phối' && (
                <div className="form-group animate-fade-in" style={{ marginTop: '15px', padding: '15px', background: 'rgba(76, 175, 80, 0.05)', borderRadius: '10px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                  <label style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Đường dẫn Báo Giá Ngay
                  </label>
                  <input 
                    type="text" 
                    name="quoteUrl"
                    placeholder="Link báo giá (Zalo, Google Form...)" 
                    value={product.quoteUrl || ''}
                    onChange={handleChange}
                    style={{ borderColor: 'rgba(76, 175, 80, 0.3)' }}
                  />
                  <span className="input-hint">Nút "Báo giá ngay" sẽ hiển thị trong trang chi tiết sản phẩm.</span>
                </div>
              )}

              {/* Document/Price List Section */}
              <div className="form-group animate-fade-in" style={{ marginTop: '15px', padding: '15px', background: '#eefcf5', borderRadius: '10px', border: '1px solid #c3e6cb' }}>
                <label style={{ color: '#155724', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Tài liệu/Bảng giá (Google Docs/Web Link)
                </label>
                <input 
                  type="text" 
                  name="pdfUrl"
                  placeholder="Dán link Google Docs hoặc link web tại đây..." 
                  value={product.pdfUrl || ''}
                  onChange={handleChange}
                  style={{ borderColor: '#c3e6cb' }}
                />
                <span className="input-hint">Hiển thị nút "Xem Bảng Giá/Tài liệu" trong trang chi tiết.</span>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer */}
      <div className="mobile-sticky-footer mobile-only">
        <button className="save-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Đang lưu...' : editData ? 'Cập nhật' : 'Lưu sản phẩm'}
        </button>
      </div>
    </div>
  );
};

export default AdminAddProduct;
