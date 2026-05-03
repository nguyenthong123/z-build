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
      <div className="upload-area" onClick={() => document.getElementById('productImage').click()}>
        <input type="file" id="productImage" style={{ display: 'none' }} accept="image/*" onChange={onImageChange} />
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
        ) : (
          <div className="upload-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p>Chọn hình ảnh chính</p>
          </div>
        )}
      </div>

      {/* Extra Images Grid */}
      <div className="extra-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', marginTop: '15px' }}>
        {extraImages.map((url, index) => (
          <div key={index} className="extra-image-container">
            <button type="button" className="remove-extra-btn" onClick={() => onRemoveExtra(index)}>×</button>
            <div className="extra-image-upload" onClick={() => document.getElementById(`extraImage${index}`).click()}>
              <input type="file" id={`extraImage${index}`} style={{ display: 'none' }} accept="image/*" onChange={(e) => onExtraImageChange(e, index)} />
              {extraPreviews[index] ? (
                <img src={extraPreviews[index]} alt="Sub" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px' }}>Ảnh phụ {index + 1}</p>
                </div>
              )}
            </div>
            <input 
              type="text" 
              placeholder="URL..." 
              value={url || ''} 
              onChange={(e) => {
                const newUrls = [...extraImages];
                newUrls[index] = e.target.value;
                setProduct(prev => ({ ...prev, extraImages: newUrls }));
              }}
              style={{ width: '100%', fontSize: '11px' }}
            />
          </div>
        ))}
        <div className="add-extra-image-box" onClick={onAddExtra}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
      </div>

      {/* Video URLs */}
      <div className="video-url-input" style={{ padding: '15px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label>Video YouTube 1</label>
            <input type="text" name="videoUrl" value={videoUrl} onChange={onChange} placeholder="Link youtube..." />
          </div>
          <div>
            <label>Video YouTube 2</label>
            <input type="text" name="extraVideoUrl" value={extraVideoUrl} onChange={onChange} placeholder="Link youtube..." />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MediaUploadSection;
