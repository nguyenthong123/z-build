import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { WishlistProvider } from './context/WishlistContext'
import { AdminAIProvider } from './context/AdminAIContext'
import { AuthProvider } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
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
  </StrictMode>,
)
