'use client';

import '../index.css';
import '../App.css';
import '../i18n/config';

import { RootProviders } from '../context/RootProviders';
import LayoutWrapper from '../components/LayoutWrapper';

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <title>Zbuild - Giải pháp vật liệu xây dựng & công nghệ quản lý bán hàng</title>
        <meta name="description" content="Zbuild - Nền tảng thương mại điện tử chuyên về vật liệu xây dựng, nội thất và giải pháp công nghệ quản lý bán hàng." />
      </head>
      <body>
        <RootProviders>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </RootProviders>
      </body>
    </html>
  );
}
