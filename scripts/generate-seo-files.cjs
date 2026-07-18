/**
 * Script tự động generate sitemap.xml + products.json từ Firebase Firestore
 * 
 * Chạy: node scripts/generate-seo-files.cjs
 * Tự động chạy trước build với: npm run build (đã tích hợp prebuild)
 * 
 * Output:
 * - public/sitemap.xml  → Google Bot đọc được toàn bộ URL sản phẩm
 * - public/products.json → AI bot / crawler đọc được danh sách sản phẩm đầy đủ
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// ─── CONFIG ──────────────────────────────────────────────────
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 
                   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                   process.env.VITE_FIREBASE_PROJECT_ID || 
                   
const API_KEY = process.env.FIREBASE_API_KEY || 
                process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
                process.env.VITE_FIREBASE_API_KEY ||

const SITE_URL = 'https://zbuild.click';
const OUTPUT_DIR = path.join(__dirname, '..', 'public');
// ─────────────────────────────────────────────────────────────

/**
 * Gọi Firestore REST API để lấy danh sách sản phẩm
 */
async function fetchProducts() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products?key=${API_KEY}&pageSize=500`;
  
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`Firestore API error: ${json.error.message}`));
            return;
          }
          const documents = json.documents || [];
          const products = documents
            .map(doc => {
              const fields = doc.fields || {};
              const getField = (name) => {
                const f = fields[name];
                if (!f) return null;
                return f.stringValue || f.integerValue || f.doubleValue || f.booleanValue || f.timestampValue || null;
              };
              return {
                id: doc.name.split('/').pop(),
                title: getField('title') || '',
                slug: getField('slug') || '',
                category: getField('category') || '',
                description: getField('description') || '',
                shortDescription: getField('shortDescription') || '',
                price: getField('price') || getField('basePrice') || 0,
                discountPrice: getField('discountPrice') || 0,
                image: getField('image') || '',
                status: getField('status') || 'Draft',
                specs: getField('specs') || '',
                packaging: getField('packaging') || '',
                weight: getField('weight') || '',
                updatedAt: getField('updatedAt') || getField('createdAt') || '',
              };
            })
            .filter(p => p.title && p.status !== 'Inactive');
          
          console.log(`✅ Fetched ${products.length} active products from Firestore`);
          resolve(products);
        } catch (err) {
          reject(new Error(`Failed to parse Firestore response: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Generate sitemap.xml
 */
function generateSitemap(products) {
  const urls = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/products.json`, changefreq: 'daily', priority: '0.8' },
    { loc: `${SITE_URL}/cart`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/wishlist`, changefreq: 'monthly', priority: '0.5' },
  ];

  // Thêm URL từng sản phẩm
  products.forEach(p => {
    if (p.slug) {
      urls.push({
        loc: `${SITE_URL}/product/${p.slug}`,
        changefreq: 'weekly',
        priority: '0.9',
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : undefined
      });
    }
  });

  // Thêm category pages
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  categories.forEach(cat => {
    const catSlug = cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    urls.push({
      loc: `${SITE_URL}/category/${catSlug}`,
      changefreq: 'weekly',
      priority: '0.7'
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml);
  console.log(`✅ Generated sitemap.xml with ${urls.length} URLs`);
}

/**
 * Generate products.json — AI bot data feed
 * Cung cấp đầy đủ thông tin sản phẩm cho AI crawler (ChatGPT, Gemini, Perplexity...)
 */
function generateProductsJSON(products) {
  const feed = products.map(p => ({
    title: p.title,
    slug: p.slug,
    category: p.category,
    description: (p.description || p.shortDescription || '').replace(/<[^>]+>/g, '').substring(0, 300),
    price: Number(p.discountPrice || p.price || 0),
    price_formatted: new Intl.NumberFormat('vi-VN').format(Number(p.discountPrice || p.price || 0)) + '₫',
    image_url: p.image || null,
    url: p.slug ? `${SITE_URL}/product/${p.slug}` : SITE_URL,
    specs: p.specs || '',
    packaging: p.packaging || '',
    weight: p.weight || '',
    in_stock: true,
    last_updated: p.updatedAt || ''
  }));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'products.json'), JSON.stringify(feed, null, 2));
  console.log(`✅ Generated products.json with ${feed.length} products`);
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Fetching products from Firestore...\n');
  
  try {
    const products = await fetchProducts();
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    generateSitemap(products);
    generateProductsJSON(products);
    
    // Stats
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    console.log(`\n📊 SEO Stats:`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Sitemap URLs: ${products.length + categories.length + 4}`);
    console.log(`\n🚀 Done! Files saved to public/`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
