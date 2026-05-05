import React, { useState } from 'react';

const VariantRow = ({ variant, onUpdateType, onAddValue, onRemoveValue, onDelete }) => {
  const [isInputActive, setIsInputActive] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue && inputValue.trim()) {
      onAddValue(variant.id, inputValue.trim());
      setInputValue('');
      setIsInputActive(false);
    }
  };

  return (
    <div className="variant-row">
      <div className="variant-type">
        <label>Loại tùy chọn</label>
        <input 
          type="text" 
          placeholder="Ví dụ: Màu sắc, Kích thước..."
          value={variant.type} 
          onChange={(e) => onUpdateType(variant.id, e.target.value)} 
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
                onClick={() => onRemoveValue(variant.id, idx)}
              >×</button>
            </span>
          ))}
          
          {isInputActive ? (
            <div className="inline-pill-input">
              <input 
                autoFocus
                type="text" 
                placeholder="Nhập giá trị..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                  if (e.key === 'Escape') {
                    setIsInputActive(false);
                    setInputValue('');
                  }
                }}
              />
              <button type="button" className="save-pill-btn" onClick={handleAdd}>Lưu</button>
            </div>
          ) : (
            <button 
              className="add-pill" 
              type="button" 
              onClick={() => setIsInputActive(true)}
              title="Thêm giá trị"
            >+</button>
          )}
        </div>
      </div>
      <button 
        className="delete-row-btn" 
        type="button" 
        onClick={() => onDelete(variant.id)}
        title="Xóa nhóm biến thể"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  );
};

const VariantsManager = ({ variants, setProduct }) => {
  const addVariant = () => {
    setProduct(prev => ({
      ...prev,
      variants: [...(prev.variants || []), { id: Date.now(), type: 'Tùy chọn mới', values: [] }]
    }));
  };

  const deleteVariant = (id) => {
    setProduct(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }));
  };

  const updateVariantType = (id, newType) => {
    setProduct(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, type: newType } : v)
    }));
  };

  const addVariantValue = (id, value) => {
    setProduct(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === id ? { ...v, values: [...(v.values || []), value] } : v
      )
    }));
  };

  const removeVariantValue = (id, index) => {
    setProduct(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === id ? { ...v, values: v.values.filter((_, i) => i !== index) } : v
      )
    }));
  };

  return (
    <section className="form-section card">
      <div className="section-header">
        <div className="section-icon variants">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <h3>Biến thể sản phẩm</h3>
        <button className="add-variant-btn" type="button" onClick={addVariant}>Thêm tùy chọn</button>
      </div>
      <div className="variants-list">
        {variants?.map(variant => (
          <VariantRow 
            key={variant.id}
            variant={variant}
            onUpdateType={updateVariantType}
            onAddValue={addVariantValue}
            onRemoveValue={removeVariantValue}
            onDelete={deleteVariant}
          />
        ))}
      </div>
    </section>
  );
};

export default VariantsManager;
