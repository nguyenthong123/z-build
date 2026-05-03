import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const BasicInfoForm = ({ title, slug, description, onChange, onDescriptionChange }) => {
  return (
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
          value={title}
          onChange={onChange}
        />
      </div>
      <div className="form-group">
        <label>Slug (URL thân thiện)</label>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            name="slug"
            value={slug}
            onChange={onChange}
            style={{ background: '#f5f5f5', color: '#666' }}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Mô tả sản phẩm</label>
        <div className="rich-editor-container">
          <ReactQuill 
            theme="snow"
            value={description}
            onChange={onDescriptionChange}
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
  );
};

export default BasicInfoForm;
