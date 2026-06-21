'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Wishlist from '../../components/Wishlist';
import { useAppContext } from '../../context/AppContext';

export default function WishlistPage() {
  const router = useRouter();
  const { handleAddToCart } = useAppContext();

  return (
    <Wishlist 
      onNavigate={(path) => router.push(path)} 
      onAddToCart={handleAddToCart} 
    />
  );
}
