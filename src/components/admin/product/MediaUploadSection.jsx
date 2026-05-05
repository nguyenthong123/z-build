import React from 'react';

const MediaUploadSection = ({ 
  imagePreview, 
  onImageChange, 
  extraImages, 
  extraPreviews, 
  onExtraImageChange, 
  onAddExtra, 
  onRemoveExtra,
  setProduct,
  videoUrl,
  extraVideoUrl,
  onChange
}) => {
  return (
    <section className="form-section card">
      <div className="section-header">
        <div className="section-icon media">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </div>
        <h3>Hình ảnh sản phẩm</h3>
      </div>
      
      {/* Main Image */}
      <div className="form-group">
        <label>Hình ảnh chính (Đại diện)</label>
        <div className="upload-area" onClick={() => document.getElementById('productImage').click()}>
          <input type="file" id="productImage" style={{ display: 'none' }} accept="image/*" onChange={onImageChange} />
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
          ) : (
            <div className="upload-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Bấm để tải hình ảnh chính lên</p>
              <span>Hỗ trợ JPG, PNG, WEBP (Tối đa 5MB)</span>
            </div>
          )}
        </div>
      </div>

      {/* Extra Images Grid */}
      <div className="form-group" style={{ marginTop: '2rem' }}>
        <label>Hình ảnh bổ sung (Ảnh phụ)</label>
        <div className="extra-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '20px', marginTop: '10px' }}>
          {extraImages.map((url, index) => (
            <div key={index} className="extra-image-container">
              <button type="button" className="remove-extra-btn" onClick={() => onRemoveExtra(index)} title="Xóa hình này">×</button>
              <div className="extra-image-upload" onClick={() => document.getElementById(`extraImage${index}`).click()}>
                <input type="file" id={`extraImage${index}`} style={{ display: 'none' }} accept="image/*" onChange={(e) => onExtraImageChange(e, index)} />
                {extraPreviews[index] ? (
                  <img src={extraPreviews[index]} alt={`Sub ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="extra-image-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Tải ảnh {index + 1}</span>
                  </div>
                )}
              </div>
              <div className="url-input-mini">
                <input 
                  type="text" 
                  placeholder="Hoặc dán URL hình..." 
                  value={url || ''} 
                  onChange={(e) => {
                    const newUrls = [...extraImages];
                    newUrls[index] = e.target.value;
                    setProduct(prev => ({ ...prev, extraImages: newUrls }));
                  }}
                  className="mini-input"
                  style={{ width: '100%', fontSize: '11px', padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            </div>
          ))}
          <div className="add-extra-image-box" onClick={onAddExtra} title="Thêm ô ảnh mới">
            <div style={{ textAlign: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <p style={{ fontSize: '12px', marginTop: '5px', fontWeight: '600' }}>Thêm ảnh</p>
            </div>
          </div>
        </div>
      </div>

      {/* Video URLs */}
      <div className="video-url-section" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label>Link Video YouTube 1</label>
            <input type="text" name="videoUrl" value={videoUrl} onChange={onChange} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div className="form-group">
            <label>Link Video YouTube 2</label>
            <input type="text" name="extraVideoUrl" value={extraVideoUrl} onChange={onChange} placeholder="https://youtube.com/watch?v=..." />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MediaUploadSection;
