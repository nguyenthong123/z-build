import React, { createContext, useContext, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  const router = useRouter();
  const pathname = usePathname();

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    if (pathname !== '/') {
      router.push('/');
    }
    const productGrid = document.querySelector('.product-section');
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSelectedCategory(null);
    if (pathname !== '/') {
      router.push('/');
    }
    const productGrid = document.querySelector('.product-section');
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <StoreContext.Provider value={{
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      handleCategorySelect,
      handleSearch
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
