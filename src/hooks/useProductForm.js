import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { slugify } from '../utils/slugify';

/**
 * Custom hook to manage product form state, image uploads, and saving.
 */
export const useProductForm = (editData, onSave) => {
  const [product, setProduct] = useState({
    title: '',
    slug: '',
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
    extraImages: [],
    videoUrl: '',
    extraVideoUrl: '',
    demoUrl: '',
    quoteUrl: '',
    pdfUrl: '',
    pricingType: 'one-time',
    monthlyPrice: '',
    yearlyPrice: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extraFiles, setExtraFiles] = useState([]);
  const [extraPreviews, setExtraPreviews] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (editData && !isInitialized) {
      setProduct({
        ...editData,
        basePrice: editData.basePrice || '',
        discountPrice: editData.discountPrice || '',
        stock: editData.stock || '',
        pricingType: editData.pricingType || 'one-time',
        monthlyPrice: editData.monthlyPrice || '',
        yearlyPrice: editData.yearlyPrice || '',
        pdfUrl: editData.pdfUrl || '',
        isTrending: editData.isTrending || false,
        extraImages: editData.extraImages || [],
        variants: editData.variants || [],
      });
      if (editData.image) setImagePreview(editData.image);
      if (editData.extraImages) {
        setExtraPreviews(editData.extraImages);
        setExtraFiles(new Array(editData.extraImages.length).fill(null));
      }
      setIsInitialized(true);
    }
  }, [editData, isInitialized]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProduct(prev => {
      const newState = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      if (name === 'title' && !editData) {
        newState.slug = slugify(value);
      }
      return newState;
    });
  };

  const handleDescriptionChange = (content) => {
    setProduct(prev => ({ ...prev, description: content }));
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

  const addExtraImage = () => {
    setProduct(prev => ({ ...prev, extraImages: [...prev.extraImages, ''] }));
    setExtraFiles(prev => [...prev, null]);
    setExtraPreviews(prev => [...prev, null]);
  };

  const removeExtraImage = (index) => {
    setProduct(prev => ({ ...prev, extraImages: prev.extraImages.filter((_, i) => i !== index) }));
    setExtraFiles(prev => prev.filter((_, i) => i !== index));
    setExtraPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Helper for Cloudinary environment variables
  const getEnv = (key, fallback) => {
    const value = import.meta.env[key];
    return (value && value !== 'REPLACE_ME') ? value : fallback;
  };

  const saveProduct = async () => {
    if (!product.title) {
      alert("Vui lòng điền tên sản phẩm");
      return;
    }

    setIsSaving(true);
    let imageUrl = product.image || '';

    try {
      const cloudName = getEnv('VITE_CLOUDINARY_CLOUD_NAME', 'dtdgrcznj');
      const uploadPreset = getEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'zbuild');
      
      // Upload main image
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(`Upload failed: ${data.error?.message}`);
        if (data.secure_url) imageUrl = data.secure_url;
      }

      // Upload extra images
      const extraUrls = [...(product.extraImages || [])];
      for (let i = 0; i < extraFiles.length; i++) {
        if (extraFiles[i]) {
          const formData = new FormData();
          formData.append('file', extraFiles[i]);
          formData.append('upload_preset', uploadPreset);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
          });
          const d = await res.json();
          if (res.ok && d.secure_url) extraUrls[i] = d.secure_url;
        }
      }

      const { id: _id, ...cleanData } = product;
      const finalData = {
        ...cleanData,
        slug: product.slug || slugify(product.title),
        image: imageUrl,
        extraImages: extraUrls,
        updatedAt: new Date().toISOString()
      };

      if (editData?.id) {
        await updateDoc(doc(db, "products", editData.id), finalData);
      } else {
        await addDoc(collection(db, "products"), {
          ...finalData,
          createdBy: auth.currentUser?.email || 'Hệ thống',
          createdAt: new Date().toISOString()
        });
      }

      if (onSave) onSave();
    } catch (e) {
      console.error("Save failed:", e);
      alert(`Lỗi: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    product, setProduct,
    imagePreview, extraPreviews,
    isSaving,
    handleChange, handleDescriptionChange,
    handleImageChange, handleExtraImageChange,
    addExtraImage, removeExtraImage,
    saveProduct
  };
};
