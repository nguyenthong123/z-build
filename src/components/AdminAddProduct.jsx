import React from 'react';
import AdminSidebar from './AdminSidebar';
import { useProductForm } from '../hooks/useProductForm';

// Sub-components
import BasicInfoForm from './admin/product/BasicInfoForm';
import MediaUploadSection from './admin/product/MediaUploadSection';
import VariantsManager from './admin/product/VariantsManager';
import ClassificationSection from './admin/product/ClassificationSection';
import PricingSection from './admin/product/PricingSection';
import InventorySection from './admin/product/InventorySection';

import './AdminAddProduct.css';

const AdminAddProduct = ({ onBack, onSave, editData }) => {
  const {
    product, setProduct,
    imagePreview, extraPreviews,
    isSaving,
    handleChange, handleDescriptionChange,
    handleImageChange, handleExtraImageChange,
    addExtraImage, removeExtraImage,
    saveProduct
  } = useProductForm(editData, onSave);

  return (
    <div className="admin-product-page">
      <AdminSidebar activePage="products" />
      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">{editData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</span></nav>
          
          <div className="header-main-row">
             <div className="title-group">
                <h1>{editData ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h1>
                <p className="description">Thiết lập thông tin, hình ảnh và giá bán cho sản phẩm của bạn.</p>
             </div>
             
             <div className="header-actions-group">
                <div className="btn-group" style={{ display: 'flex', gap: '10px' }}>
                  <button className="secondary-btn" onClick={onBack}>Hủy</button>
                  <button className="primary-add-btn" onClick={saveProduct} disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : (editData ? 'Cập nhật sản phẩm' : 'Lưu sản phẩm')}
                  </button>
                </div>
             </div>
          </div>
        </header>

        <div className="admin-content-body">
          <div className="add-product-container">
            <div className="main-form-column">
              <BasicInfoForm 
                title={product.title}
                slug={product.slug}
                description={product.description}
                onChange={handleChange}
                onDescriptionChange={handleDescriptionChange}
              />

              <MediaUploadSection 
                imagePreview={imagePreview}
                onImageChange={handleImageChange}
                extraImages={product.extraImages}
                extraPreviews={extraPreviews}
                onExtraImageChange={handleExtraImageChange}
                onAddExtra={addExtraImage}
                onRemoveExtra={removeExtraImage}
                setProduct={setProduct}
                videoUrl={product.videoUrl}
                extraVideoUrl={product.extraVideoUrl}
                onChange={handleChange}
              />

              <VariantsManager 
                variants={product.variants}
                setProduct={setProduct}
              />

              {/* Mobile Actions */}
              <div className="mobile-only-save p-4">
                 <button className="save-btn w-full py-4 text-lg font-bold" onClick={saveProduct} disabled={isSaving}>
                   {isSaving ? 'Đang lưu...' : editData ? 'Cập nhật' : 'Lưu sản phẩm'}
                 </button>
              </div>
            </div>

            <div className="side-form-column">
              <ClassificationSection 
                status={product.status}
                category={product.category}
                onChange={handleChange}
              />

              <PricingSection 
                basePrice={product.basePrice}
                discountPrice={product.discountPrice}
                status={product.status}
                category={product.category}
                pricingType={product.pricingType}
                monthlyPrice={product.monthlyPrice}
                yearlyPrice={product.yearlyPrice}
                onChange={handleChange}
                setProduct={setProduct}
              />

              <InventorySection 
                stock={product.stock}
                trackInventory={product.trackInventory}
                isTrending={product.isTrending}
                category={product.category}
                status={product.status}
                demoUrl={product.demoUrl}
                quoteUrl={product.quoteUrl}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAddProduct;
