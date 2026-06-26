const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Screenshot 1: Home - Desktop viewport only
  const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p1.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await p1.waitForTimeout(2000);
  await p1.screenshot({ path: '/Users/zomby/zbuild-home-dt.png' });
  console.log('✅ Home desktop');
  
  // Screenshot 2: Home - Mobile viewport only  
  const p2 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await p2.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await p2.waitForTimeout(2000);
  await p2.screenshot({ path: '/Users/zomby/zbuild-home-mb.png' });
  console.log('✅ Home mobile');
  
  // Screenshot 3: Login mobile
  const p3 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await p3.goto('http://localhost:3000/login', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await p3.waitForTimeout(2000);
  await p3.screenshot({ path: '/Users/zomby/zbuild-login-mb.png' });
  console.log('✅ Login mobile');
  
  // Screenshot 4: Product Detail mobile (use slug that exists)
  const p4 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await p4.goto('http://localhost:3000/product/tam-op-panel-kim-loai-13', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await p4.waitForTimeout(5000);
  await p4.screenshot({ path: '/Users/zomby/zbuild-product-mb.png' });
  console.log('✅ Product mobile');
  
  await browser.close();
  console.log('Done!');
})();
