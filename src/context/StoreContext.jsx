/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    if (location.pathname !== '/') {
      navigate('/');
    }
    const productGrid = document.querySelector('.product-section');
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSelectedCategory(null);
    if (location.pathname !== '/') {
      navigate('/');
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
