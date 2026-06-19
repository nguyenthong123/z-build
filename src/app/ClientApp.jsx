'use client';

import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import { WishlistProvider } from '../context/WishlistContext';
import { AdminAIProvider } from '../context/AdminAIContext';
import { AuthProvider } from '../context/AuthContext';
import { StoreProvider } from '../context/StoreContext';
import App from '../App';

export default function ClientApp() {
  return (
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <StoreProvider>
                <WishlistProvider>
                  <ToastProvider>
                    <AdminAIProvider>
                      <App />
                    </AdminAIProvider>
                  </ToastProvider>
                </WishlistProvider>
              </StoreProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </HelmetProvider>
    </I18nextProvider>
  );
}
