import React, { useState } from 'react';

const VariantsManager = ({ variants, setProduct }) => {
  const [activeVariantInput, setActiveVariantInput] = useState(null);
  const [newPillValue, setNewPillValue] = useState('');

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

  const handleAddPill = (variantId) => {
    if (newPillValue && newPillValue.trim()) {
      setProduct(prev => ({
        ...prev,
        variants: (prev.variants || []).map(v => 
          v.id === variantId ? { ...v, values: [...(v.values || []), newPillValue.trim()] } : v
        )
      }));
      setNewPillValue('');
      setActiveVariantInput(null);
    }
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
                      onClick={() => {
                        setProduct(prev => ({
                          ...prev,
                          variants: prev.variants.map(v => 
                            v.id === variant.id ? { ...v, values: v.values.filter((_, i) => i !== idx) } : v
                          )
                        }));
                      }}
                    >×</button>
                  </span>
                ))}
                {activeVariantInput === variant.id ? (
                  <div className="inline-pill-input">
                    <input 
                      autoFocus
                      type="text" 
                      value={newPillValue}
                      onChange={(e) => setNewPillValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPill(variant.id);
                        }
                        if (e.key === 'Escape') setActiveVariantInput(null);
                      }}
                    />
                  </div>
                ) : (
                  <button className="add-pill" type="button" onClick={() => setActiveVariantInput(variant.id)}>+</button>
                )}
              </div>
            </div>
            <button className="delete-row-btn" type="button" onClick={() => deleteVariant(variant.id)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default VariantsManager;
