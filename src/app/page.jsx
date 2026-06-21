'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import SEOHead from '../components/SEOHead';
import { useStore } from '../context/StoreContext';

export default function HomePage() {
  const router = useRouter();
  const { handleCategorySelect } = useStore();

  return (
    <>
      <SEOHead 
        title="Zbuild - Giải pháp vật liệu xây dựng & công nghệ quản lý"
        description="Zbuild là nền tảng thương mại điện tử chuyên về vật liệu xây dựng, nội thất và cung cấp các giải pháp công nghệ quản lý bán hàng toàn diện."
      />
      <Hero onNavigate={(target) => router.push(target === 'home' ? '/' : `/${target}`)} />
      <ProductGrid onProductClick={(product) => router.push(`/product/${product.slug || product.id}`)} />
    </>
  );
}
