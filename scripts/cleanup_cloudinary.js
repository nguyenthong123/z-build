/**
 * Cloudinary Image Garbage Collector
 * 
 * Quét toàn bộ ảnh trong Cloudinary, kiểm tra ảnh nào còn được
 * tham chiếu trong Firestore (products, ai_consultations...).
 * Xóa ảnh mồ côi (không còn sản phẩm/bài viết nào dùng).
 * 
 * Cách chạy:
 *   cd /Volumes/DATA_SSD/Projects/zbuild/nexus-store
 *   node scripts/cleanup_cloudinary.js [--dry-run]
 * 
 * --dry-run: Chỉ liệt kê ảnh sẽ xóa, không xóa thật.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env.local manually (không cần dotenv dependency)
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, '..', '.env.local'));

// ========== CONFIG ==========
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
const API_SECRET = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_BATCH = 100; // Số ảnh xóa mỗi lần gọi API (Cloudinary limit)
const PAGE_SIZE = 500;    // Số ảnh lấy mỗi trang

// Firestore config (cần service account key cho server-side)
// Nếu không có, dùng REST API với API key từ env
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('❌ Thiếu Cloudinary credentials trong .env.local');
  console.error('   Cần: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, _API_KEY, _API_SECRET');
  process.exit(1);
}

// ========== HELPERS ==========

function cloudinaryRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD_NAME}${endpoint}`,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Lấy danh sách ảnh từ Cloudinary (phân trang).
 */
async function listAllImages() {
  const allImages = [];
  let nextCursor = null;

  console.log('🔍 Đang quét ảnh từ Cloudinary...');

  do {
    const params = new URLSearchParams({
      max_results: PAGE_SIZE,
      type: 'upload',
      prefix: '', // Tất cả ảnh
    });
    if (nextCursor) params.set('next_cursor', nextCursor);

    const result = await cloudinaryRequest(
      'GET',
      `/resources/image?${params.toString()}`
    );

    if (result.error) {
      console.error('❌ Cloudinary error:', result.error.message);
      break;
    }

    const resources = result.resources || [];
    allImages.push(
      ...resources.map((r) => ({
        public_id: r.public_id,
        url: r.secure_url,
        created_at: r.created_at,
        bytes: r.bytes,
        format: r.format,
      }))
    );

    nextCursor = result.next_cursor;
    console.log(`   📸 Đã lấy ${allImages.length} ảnh...`);
  } while (nextCursor);

  console.log(`   ✅ Tổng: ${allImages.length} ảnh trong Cloudinary`);
  return allImages;
}

/**
 * Lấy tất cả URL ảnh đang được tham chiếu trong Firestore.
 */
async function getReferencedImageUrls() {
  console.log('🔍 Đang quét ảnh tham chiếu từ Firestore...');

  const referencedUrls = new Set();
  const collections = ['products', 'ai_consultations'];

  for (const colName of collections) {
    try {
      // Dùng Firestore REST API
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${colName}?key=${FIREBASE_API_KEY}&pageSize=500`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.documents) {
        for (const doc of data.documents) {
          const fields = doc.fields || {};
          const imageFields = ['image', 'extraImages', 'images'];

          for (const field of imageFields) {
            const val = fields[field];
            if (!val) continue;

            if (val.stringValue) {
              referencedUrls.add(val.stringValue);
            } else if (val.arrayValue?.values) {
              for (const item of val.arrayValue.values) {
                if (item.stringValue) referencedUrls.add(item.stringValue);
              }
            }
          }
        }
      }
      console.log(`   📄 ${colName}: đã quét`);
    } catch (err) {
      console.warn(`   ⚠️ Không quét được ${colName}:`, err.message);
    }
  }

  console.log(`   ✅ Tổng: ${referencedUrls.size} URL ảnh đang được tham chiếu`);
  return referencedUrls;
}

/**
 * Xóa ảnh khỏi Cloudinary.
 */
async function deleteImages(publicIds) {
  if (!publicIds.length) return 0;

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Sẽ xóa ${publicIds.length} ảnh:`);
    publicIds.forEach((id) => console.log(`     - ${id}`));
    return publicIds.length;
  }

  let deleted = 0;
  for (let i = 0; i < publicIds.length; i += DELETE_BATCH) {
    const batch = publicIds.slice(i, i + DELETE_BATCH);
    const result = await cloudinaryRequest('DELETE', '/resources/image/upload', {
      public_ids: batch,
    });

    if (result.deleted) {
      const count = Object.keys(result.deleted).length;
      deleted += count;
      console.log(`   🗑️ Đã xóa ${count}/${batch.length} ảnh (batch ${Math.floor(i / DELETE_BATCH) + 1})`);
    }

    if (result.deleted_counts) {
      const partial = Object.values(result.deleted_counts).reduce((a, b) => {
        return a + (b.original || 0);
      }, 0);
      if (partial === 0) {
        console.log(`   ⚠️ Một số ảnh không xóa được (có thể đã bị xóa trước đó)`);
      }
    }
  }

  return deleted;
}

// ========== MAIN ==========

async function main() {
  console.log('\n🧹 ZBUILD CLOUDINARY GARBAGE COLLECTOR');
  console.log('======================================');
  if (DRY_RUN) console.log('⚠️  CHẾ ĐỘ DRY-RUN — không xóa thật\n');
  else console.log('⚠️  CHẾ ĐỘ THẬT — sẽ xóa ảnh!\n');

  // 1. Lấy tất cả ảnh Cloudinary
  const allImages = await listAllImages();
  if (!allImages.length) {
    console.log('✅ Không có ảnh nào. Thoát.');
    return;
  }

  // 2. Lấy tất cả URL đang tham chiếu
  const referencedUrls = await getReferencedImageUrls();

  // 3. Tìm ảnh mồ côi
  const orphans = [];
  let totalOrphanBytes = 0;

  for (const img of allImages) {
    // Kiểm tra: URL có trong danh sách tham chiếu không?
    const isReferenced =
      referencedUrls.has(img.url) ||
      // Kiểm tra thêm variant URLs (http/https, các transformation)
      Array.from(referencedUrls).some((refUrl) => {
        try {
          return (
            refUrl.replace(/^https?:/, '') === img.url.replace(/^https?:/, '') ||
            refUrl.includes(img.public_id)
          );
        } catch {
          return false;
        }
      });

    if (!isReferenced) {
      orphans.push(img);
      totalOrphanBytes += img.bytes || 0;
    }
  }

  console.log(`\n📊 KẾT QUẢ:`);
  console.log(`   Tổng ảnh Cloudinary: ${allImages.length}`);
  console.log(`   Đang tham chiếu:     ${allImages.length - orphans.length}`);
  console.log(`   Ảnh mồ côi:          ${orphans.length}`);
  console.log(`   Dung lượng rác:      ${(totalOrphanBytes / 1024 / 1024).toFixed(2)} MB`);

  if (!orphans.length) {
    console.log('\n✅ Không có ảnh rác. Tuyệt vời!');
    return;
  }

  // 4. Xóa ảnh mồ côi
  console.log(`\n🗑️ ${DRY_RUN ? '[DRY-RUN] ' : ''}Đang xóa ${orphans.length} ảnh mồ côi...`);
  const orphanIds = orphans.map((img) => img.public_id);
  const deleted = await deleteImages(orphanIds);

  const savedMB = (totalOrphanBytes / 1024 / 1024).toFixed(2);
  console.log(`\n✅ ${DRY_RUN ? '[DRY-RUN] ' : ''}Hoàn tất! Đã xóa ${deleted} ảnh, tiết kiệm ~${savedMB} MB`);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
