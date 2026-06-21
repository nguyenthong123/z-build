'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AIAdvisor from '../../components/AIAdvisor';
import { useAppContext } from '../../context/AppContext';

export default function AdvisorPage() {
  const router = useRouter();
  const { storefrontAdvisorState } = useAppContext();

  return (
    <AIAdvisor 
      onNavigate={(target) => router.push(target === 'home' ? '/' : `/${target}`)} 
      advisorState={storefrontAdvisorState} 
    />
  );
}
