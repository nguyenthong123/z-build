'use client';

import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './ToastContext';
import { StoreProvider } from './StoreContext';
import { WishlistProvider } from './WishlistContext';
import { AppProvider } from './AppContext';
import { ThemeProvider } from './ThemeContext';

export const RootProviders = ({ children }) => {
  return (
    <HelmetProvider>
      <ToastProvider>
        <AuthProvider>
          <ThemeProvider>
            <StoreProvider>
              <WishlistProvider>
                <AppProvider>
                  {children}
                </AppProvider>
              </WishlistProvider>
            </StoreProvider>
          </ThemeProvider>
        </AuthProvider>
      </ToastProvider>
    </HelmetProvider>
  );
};
