'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductDetail from '../../../components/ProductDetail';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProductPage({ params }) {
  const router = useRouter();
  const { detailProduct, setDetailProduct, handleAddToCart, handleLoginRequired } = useAppContext();
  const { user } = useAuth();
  
  const unwrappedParams = React.use(params);
  const productId = unwrappedParams.productId;

  return (
    <ProductDetail 
      product={detailProduct} 
      onBack={() => router.push('/')} 
      onAddToCart={handleAddToCart}
      isLoggedIn={!!user}
      onLoginRequired={() => handleLoginRequired(`/product/${productId}`)}
      setGlobalProduct={setDetailProduct}
    />
  );
}
