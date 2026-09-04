/**
 * Auto-generate sitemap.xml + products.json from SQLite
 * Usage: node scripts/generate-seo-files.cjs
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://zbuild.click';
const OUT = path.join(__dirname, '..', 'public');
const SQLITE_PATH = path.join(__dirname, '..', 'data', 'zbuild.sqlite');

async function fetchProducts() {
  // 1. Try local SQLite database first
  if (fs.existsSync(SQLITE_PATH)) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(SQLITE_PATH);
      const rows = db.prepare("SELECT * FROM products WHERE status != 'Inactive'").all();
      console.log(`Loaded ${rows.length} active products from local SQLite`);
      return rows;
    } catch (e) {
      console.warn('Could not read local SQLite via node:sqlite:', e.message);
    }
  }

  // 2. Fallback to existing products.json if present
  const existingPath = path.join(OUT, 'products.json');
  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      console.log(`Using existing products.json with ${existing.length} products`);
      return existing;
    } catch {}
  }

  return [];
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

  // Build product listing (visible to bots, auto-hidden when React mounts)
  const items = prods.map(p => {
    const price = Number(p.discountPrice || p.price || 0);
    const priceStr = price > 0 ? new Intl.NumberFormat('vi-VN').format(price) + ' VND' : 'Liên hệ';
    const url = p.slug ? SITE_URL + '/product/' + p.slug : SITE_URL;
    const desc = (p.description || p.shortDescription || '').replace(/<[^>]+>/g, '').substring(0, 200);
    return '    <div>\n' +
      '      <h2><a href="' + url + '">' + esc(p.title) + '</a></h2>\n' +
      '      <p>' + esc(desc) + '</p>\n' +
      '      <span>' + priceStr + '</span> | <span>' + (p.category || '') + '</span>\n' +
      (p.specs ? '      <small>Quy cách: ' + esc(p.specs) + '</small>\n' : '') +
      '    </div>';
  }).join('\n');

  const snippet = '<!-- SEO fallback: hidden when React mounts -->\n' +
    '<script>\n' +
    '  (function(){\n' +
    '    var t=setInterval(function(){\n' +
    '      if(document.getElementById("root").innerHTML.trim().length>50){\n' +
    '        var f=document.getElementById("seo-fallback");\n' +
    '        if(f)f.style.display="none";clearInterval(t);\n' +
    '      }\n' +
    '    },100);\n' +
    '    setTimeout(function(){clearInterval(t)},8000);\n' +
    '  })();\n' +
    '</' + 'script>\n' +
    '<section id="seo-fallback">\n' +
    '<h1>Danh sách sản phẩm Zbuild - Vật liệu xây dựng</h1>\n' +
    '<p>Zbuild cung cấp ' + prods.length + ' sản phẩm vật liệu xây dựng: Duraflex, tấm PVC, tấm xi măng sợi, trần thả, gạch ốp lát và nhiều hơn nữa.</p>\n' +
    items + '\n' +
    '</section>';

  const re = /<!-- SEO_START -->[\s\S]*<!-- SEO_END -->/;
  html = html.replace(re, '<!-- SEO_START -->\n' + snippet + '\n    <!-- SEO_END -->');

  fs.writeFileSync(idxPath, html);
  console.log('Injected ' + prods.length + ' products into index.html for bots');
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

(async () => {
  console.log('Generating SEO files from SQLite...');
  try {
    const prods = await fetchProducts();
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    if (prods && prods.length > 0) {
      genSitemap(prods);
      genProductsJSON(prods);
      injectIntoIndexHTML(prods);
      const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
      console.log('Products: ' + prods.length + ' | Categories: ' + cats.length + ' | URLs: ' + (prods.length + cats.length + 4));
    } else {
      console.log('No products found, skipping SEO injection.');
    }
    console.log('Done!');
  } catch (e) {
    console.warn('SEO generation warning:', e.message);
  }
})();
