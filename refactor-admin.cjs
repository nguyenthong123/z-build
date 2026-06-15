const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.startsWith('Admin') && f.endsWith('.jsx'));

files.forEach(file => {
  if (file === 'AdminSidebar.jsx' || file === 'AdminLayout.jsx') return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove AdminSidebar import
  content = content.replace(/import AdminSidebar from '.\/AdminSidebar';\n/g, '');
  
  // Remove <AdminSidebar /> usage with any props
  content = content.replace(/\s*<AdminSidebar[^>]*\/>/g, '');
  
  // Remove <div className="admin-product-page"> or similar wrappers if they only wrap AdminSidebar and the main content
  // Actually, wait, let's just replace the exact lines if we can.
  // It's safer to just let the layout wrap it, and leaving the `<div className="admin-product-page">` is mostly harmless if we just remove AdminSidebar!
  
  fs.writeFileSync(filePath, content);
  console.log('Processed', file);
});
