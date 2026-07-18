/**
 * Auto-generate sitemap.xml + products.json from Firebase Firestore
 * Usage: node scripts/generate-seo-files.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load env from .env.local if exists (local dev)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

if (!PROJECT_ID || !API_KEY) {
  console.error('Missing Firebase config. Set FIREBASE_PROJECT_ID and FIREBASE_API_KEY env vars.');
  process.exit(1);
}

const SITE_URL = 'https://zbuild.click';
const OUT = path.join(__dirname, '..', 'public');

async function fetchProducts() {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/products?key=' + API_KEY + '&pageSize=500';
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.error) return reject(new Error(json.error.message));
          const docs = json.documents || [];
          const prods = docs.map(doc => {
            const f = doc.fields || {};
            const g = n => { const x = f[n]; return x ? (x.stringValue || x.integerValue || x.doubleValue || x.booleanValue || x.timestampValue || null) : null; };
            return { id: doc.name.split('/').pop(), title: g('title') || '', slug: g('slug') || '', category: g('category') || '', description: g('description') || '', shortDescription: g('shortDescription') || '', price: g('price') || g('basePrice') || 0, discountPrice: g('discountPrice') || 0, image: g('image') || '', status: g('status') || 'Draft', specs: g('specs') || '', packaging: g('packaging') || '', weight: g('weight') || '', updatedAt: g('updatedAt') || g('createdAt') || '' };
          }).filter(p => p.title && p.status !== 'Inactive');
          console.log('Fetched ' + prods.length + ' active products');
          resolve(prods);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function genSitemap(prods) {
  const urls = [
    { loc: SITE_URL + '/', cf: 'daily', p: '1.0' },
    { loc: SITE_URL + '/products.json', cf: 'daily', p: '0.8' },
    { loc: SITE_URL + '/cart', cf: 'monthly', p: '0.5' },
    { loc: SITE_URL + '/wishlist', cf: 'monthly', p: '0.5' },
  ];
  prods.forEach(p => { if (p.slug) urls.push({ loc: SITE_URL + '/product/' + p.slug, cf: 'weekly', p: '0.9', lm: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : null }); });
  const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
  cats.forEach(c => { urls.push({ loc: SITE_URL + '/category/' + c.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), cf: 'weekly', p: '0.7' }); });
  const xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n' + urls.map(u => '  <url>\n    <loc>' + u.loc + '</loc>\n    <changefreq>' + u.cf + '</changefreq>\n    <priority>' + u.p + '</priority>' + (u.lm ? '\n    <lastmod>' + u.lm + '</lastmod>' : '') + '\n  </url>').join('\n') + '\n</urlset>';
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), xml);
  console.log('Generated sitemap.xml with ' + urls.length + ' URLs');
}

function genProductsJSON(prods) {
  const feed = prods.map(p => ({ title: p.title, slug: p.slug, category: p.category, description: (p.description || p.shortDescription || '').replace(/<[^>]+>/g, '').substring(0, 300), price: Number(p.discountPrice || p.price || 0), price_formatted: new Intl.NumberFormat('vi-VN').format(Number(p.discountPrice || p.price || 0)) + ' VND', image_url: p.image || null, url: p.slug ? SITE_URL + '/product/' + p.slug : SITE_URL, specs: p.specs || '', packaging: p.packaging || '', weight: p.weight || '', in_stock: true, last_updated: p.updatedAt || '' }));
  fs.writeFileSync(path.join(OUT, 'products.json'), JSON.stringify(feed, null, 2));
  console.log('Generated products.json with ' + feed.length + ' products');
}


function injectIntoIndexHTML(prods) {
  const idxPath = path.join(__dirname, '..', 'index.html');
  let html = fs.readFileSync(idxPath, 'utf8');

  // Build product listing HTML (hidden from users, visible to bots)
  const items = prods.map(p => {
    const price = Number(p.discountPrice || p.price || 0);
    const priceStr = price > 0 ? new Intl.NumberFormat('vi-VN').format(price) + ' VND' : 'Liên hệ';
    const url = p.slug ? SITE_URL + '/product/' + p.slug : SITE_URL;
    const desc = (p.description || p.shortDescription || '').replace(/<[^>]+>/g, '').substring(0, 200);
    return '    <div>\n' +
      '      <h2><a href="' + url + '">' + p.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</a></h2>\n' +
      '      <p>' + desc.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>\n' +
      '      <span>' + priceStr + '</span> | <span>' + (p.category || '') + '</span>\n' +
      (p.specs ? '      <small>Quy cách: ' + p.specs.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</small>\n' : '') +
      '    </div>';
  }).join('\n');

  const snippet = '<!-- Bot-readable product catalog (hidden from users) -->\n' +
    '<noscript>\n' +
    '<section style="display:none" aria-hidden="true">\n' +
    '<h1>Danh sách sản phẩm Zbuild - Vật liệu xây dựng</h1>\n' +
    '<p>Zbuild cung cấp ' + prods.length + ' sản phẩm vật liệu xây dựng: DURAflex, tấm PVC, tấm xi măng sợi, trần thả, gạch ốp lát và nhiều hơn nữa.</p>\n' +
    items + '\n' +
    '</section>\n' +
    '</noscript>';

  html = html.replace('<!-- SEO_PRODUCTS -->', snippet);
  fs.writeFileSync(idxPath, html);
  console.log('Injected ' + prods.length + ' products into index.html for bots');
}


(async () => {
  console.log('Fetching products from Firestore...');
  try {
    const prods = await fetchProducts();
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    genSitemap(prods);
    genProductsJSON(prods);
    injectIntoIndexHTML(prods);
    const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
    console.log('Products: ' + prods.length + ' | Categories: ' + cats.length + ' | URLs: ' + (prods.length + cats.length + 4));
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
