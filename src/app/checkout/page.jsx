'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Checkout from '../../components/Checkout';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function CheckoutPage() {
  const router = useRouter();
  const { cartItems, handleOrderComplete, intendedDestination } = useAppContext();
  const { user } = useAuth();

  return (
    <Checkout 
      cartItems={cartItems} 
      onBack={() => router.push('/cart')} 
      onComplete={handleOrderComplete} 
      user={user}
      intendedDestination={intendedDestination}
    />
  );
}
