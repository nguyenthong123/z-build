import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHead = ({ 
  title = 'Zbuild - Giải pháp Vật liệu Xây dựng & Công nghệ',
  description = 'Zbuild cung cấp vật liệu xây dựng chất lượng cao, phần mềm quản lý bán hàng và tư vấn AI thông minh cho nhà thầu, đại lý.',
  keywords = 'vật liệu xây dựng, Duraflex, tấm PVC, phần mềm quản lý, Zbuild',
  ogImage = '/og-image.jpg',
  ogType = 'website',
  canonical,
  noindex = false,
  schemaData = null
}) => {
  const siteUrl = 'https://zbuild.click';
  const fullUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      <meta property="og:site_name" content="Zbuild" />
      <meta property="og:locale" content="vi_VN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />

      {/* Canonical */}
      {canonical && <link rel="canonical" href={fullUrl} />}

      {/* Misc */}
      <meta name="theme-color" content="#1a1a2e" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      {/* Structured Data (JSON-LD) for SEO & AI Bots */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;
