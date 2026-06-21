'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Cart from '../../components/Cart';
import { useAppContext } from '../../context/AppContext';

export default function CartPage() {
  const router = useRouter();
  const { cartItems, updateQuantity, removeItem, clearCart } = useAppContext();

  return (
    <Cart 
      cartItems={cartItems} 
      updateQuantity={updateQuantity} 
      removeItem={removeItem} 
      clearCart={clearCart}
      onBack={() => router.push('/')}
      onCheckout={() => router.push('/checkout')}
    />
  );
}
