import http.server
import json
import os
import re
import sqlite3
import urllib.request
import urllib.parse
import uuid
from datetime import datetime

PORT = int(os.environ.get('PORT', 8001))
DB_PATH = os.environ.get('ZBUILD_DB_PATH', '/opt/zbuild/zbuild.db')
DUNVEX_API_URL = 'https://dunvex.com/api'
DUNVEX_API_KEY = 'dvx_f1dbc799aaf2ca9039db8ee941f95ea41d0c8952c51a4b8f'
DUNVEX_OWNER_ID = 'ng6vUtYb4ndgxXsfEwqdnMPbmrF2'
ORDER_WEBHOOK_URL = os.environ.get('ORDER_WEBHOOK_URL', 'https://34.169.201.51/webhook/dunvex-order')

# DeepSeek AI Engine (Tiết kiệm nhất: deepseek-chat / V3)
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'
DEEPSEEK_MODEL = 'deepseek-chat'

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        conn = get_db()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updatedAt TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                dunvexId TEXT,
                title TEXT,
                slug TEXT UNIQUE,
                category TEXT,
                basePrice REAL DEFAULT 0,
                discountPrice REAL DEFAULT 0,
                price REAL DEFAULT 0,
                priceBuy REAL DEFAULT 0,
                stock REAL DEFAULT 0,
                specs TEXT,
                unit TEXT,
                weight TEXT,
                packaging TEXT,
                image TEXT,
                extraImages TEXT,
                shortDescription TEXT,
                description TEXT,
                status TEXT DEFAULT 'Draft',
                createdAt TEXT,
                updatedAt TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                dunvexId TEXT,
                name TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                type TEXT,
                status TEXT DEFAULT 'active',
                syncedAt TEXT,
                createdAt TEXT,
                updatedAt TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                userId TEXT,
                userName TEXT,
                userEmail TEXT,
                userPhone TEXT,
                items TEXT,
                shippingAddress TEXT,
                total REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                paymentMethod TEXT DEFAULT 'cod',
                createdAt TEXT,
                updatedAt TEXT
            )
        """)
        cursor = conn.execute("PRAGMA table_info(products)")
        columns = [col['name'] for col in cursor.fetchall()]
        if columns and 'extraImages' not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN extraImages TEXT")
            print("Auto-migration: Added column extraImages to products table")
        conn.commit()
        conn.close()
    except Exception as e:
        print("Auto-migration notice:", e)

init_db()

def slugify(text):
    if not text:
        return ''
    s = text.lower().strip()
    replacements = {
        'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'đ': 'd'
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s).strip('-')
    return s

def clean_html_content(raw_text):
    if not raw_text:
        return ''
    text = str(raw_text).strip()
    
    # Strip leading '=' or single/double quotes at edges
    text = re.sub(r'^[=\s\'"`]+', '', text)
    text = re.sub(r'[\'"`\s]+$', '', text)
    
    # Strip markdown code blocks like ```html ... ``` or ``` ... ```
    text = re.sub(r'^```(?:html|markdown|xml)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)
    
    # Remove any zero-width or weird control characters
    text = re.sub(r'[\u200b\u200e\u200f\ufeff\r]', '', text)
    
    # Remove DOCTYPE
    text = re.sub(r'<!DOCTYPE[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Extract body content if <body> exists, otherwise strip <head>...</head>, <html>, </html>, <body>, </body>
    body_match = re.search(r'<body[^>]*>([\s\S]*?)</body>', text, flags=re.IGNORECASE)
    if body_match:
        text = body_match.group(1)
    else:
        text = re.sub(r'<head[^>]*>[\s\S]*?</head>', '', text, flags=re.IGNORECASE)
        text = re.sub(r'</?html[^>]*>', '', text, flags=re.IGNORECASE)
        text = re.sub(r'</?body[^>]*>', '', text, flags=re.IGNORECASE)

    # Remove any remaining <style>...</style> blocks that might break global page styling
    text = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', text, flags=re.IGNORECASE)
    # Remove any <script>...</script> blocks
    text = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<title[^>]*>[\s\S]*?</title>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<meta[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</?header[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</?section[^>]*>', '', text, flags=re.IGNORECASE)
    
    return text.strip()

def cleanup_legacy_descriptions():
    try:
        conn = get_db()
        rows = conn.execute("SELECT id, description FROM products WHERE description IS NOT NULL AND (description LIKE '=%' OR description LIKE '%<!DOCTYPE%' OR description LIKE '%<html%' OR description LIKE '%<style%')").fetchall()
        for r in rows:
            cleaned = clean_html_content(r['description'])
            if cleaned != r['description']:
                conn.execute("UPDATE products SET description = ? WHERE id = ?", (cleaned, r['id']))
        conn.commit()
        conn.close()
        if rows:
            print(f"[Auto-Clean] Cleaned {len(rows)} legacy corrupt descriptions in SQLite")
    except Exception as e:
        print("[Auto-Clean] Notice:", e)

cleanup_legacy_descriptions()

def get_default_html_description(title, category, specs):
    return f"""<h3>1. Giới thiệu tổng quan sản phẩm {title}</h3>
<p><strong>{title}</strong> là giải pháp vật liệu xây dựng cao cấp thuộc danh mục <strong>{category}</strong>, được sản xuất trên dây chuyền hiện đại đáp ứng các tiêu chuẩn khắt khe cho công trình dân dụng và dự án công nghiệp.</p>

<h3>2. Bảng thông số kỹ thuật chi tiết</h3>
<table style="width:100%; border-collapse: collapse; margin: 12px 0;">
  <thead>
    <tr style="background:#f1f5f9;">
      <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;">Thông số</th>
      <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;">Chi tiết</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Tên sản phẩm</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{title}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Phân loại</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{category}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Quy cách kỹ thuật</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{specs if specs else 'Tiêu chuẩn nhà sản xuất'}</td></tr>
    <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Ứng dụng</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Công trình dân dụng & công nghiệp</td></tr>
  </tbody>
</table>

<h3>3. Đặc điểm & Ưu điểm vượt trội</h3>
<ul>
  <li><strong>Độ bền cao:</strong> Khả năng chống chịu thời tiết, chống ăn mòn và thích ứng tốt với khí hậu nóng ẩm Việt Nam.</li>
  <li><strong>Tiêu chuẩn chuẩn hóa:</strong> {specs if specs else 'Sản xuất theo kích thước chuẩn, dễ đồng bộ phụ kiện'}.</li>
  <li><strong>Thẩm mỹ hoàn hảo:</strong> Bề mặt tinh xảo, màu sắc bền đẹp theo thời gian.</li>
  <li><strong>Tiết kiệm chi phí:</strong> Thi công nhanh chóng, giảm thiểu tối đa hao hụt và nhân công.</li>
</ul>

<h3>4. Hướng dẫn thi công & Lắp đặt</h3>
<ol>
  <li><strong>Bước 1 - Chuẩn bị bề mặt & hệ khung:</strong> Kiểm tra độ phẳng, khoảng cách xà gồ/khung đỡ trước khi tiến hành.</li>
  <li><strong>Bước 2 - Lắp ghép & Cố định:</strong> Sử dụng phụ kiện chuyên dụng, vít bắn và ke góc đồng bộ để cố định chắc chắn.</li>
  <li><strong>Bước 3 - Hoàn thiện & Nghiệm thu:</strong> Xử lý các mối nối, vệ sinh bề mặt và kiểm tra độ khít kín.</li>
</ol>

<h3>5. Câu hỏi thường gặp (FAQ)</h3>
<p><strong>Hỏi:</strong> Sản phẩm {title} có chế độ bảo hành như thế nào?</p>
<p><strong>Đáp:</strong> Sản phẩm được phân phối chính hãng bởi Zbuild với chính sách bảo hành theo đúng tiêu chuẩn của nhà sản xuất.</p>

<p><em>Sản phẩm được phân phối và bảo hành chính hãng tại hệ thống Zbuild.</em></p>"""

def build_ai_product_prompt(title, category, specs, search_context='', instructions='', product_info=''):
    sys_prompt = "Bạn là chuyên gia Content SEO & Kỹ sư vật liệu xây dựng hàng đầu của Zbuild. Bạn viết bài mô tả sản phẩm bằng MÃ HTML CHUẨN SEO, cấu trúc chuyên nghiệp, từ ngữ hấp dẫn, thuyết phục khách hàng và nhà thầu."
    
    user_prompt = f"""Hãy viết bài viết mô tả chi tiết, chuyên sâu, chuẩn SEO cho sản phẩm sau:
- Tên sản phẩm: {title}
- Danh mục / Phân loại: {category}
- Quy cách / Thông số: {specs if specs else 'Theo tiêu chuẩn nhà sản xuất'}
{f"- Thông tin bổ sung: {product_info}" if product_info else ""}
{f"- Dữ liệu từ Internet: {search_context}" if search_context else ""}
{f"- Yêu cầu đặc biệt từ Admin: {instructions}" if instructions else ""}

QUY TẮC ĐỊNH DẠNG HTML BẮT BUỘC:
1. Trả về mã HTML thuần (KHÔNG BỌC TRONG markdown block ```html).
2. Sử dụng cấu trúc chuẩn SEO sau:
   - <h3>1. Giới thiệu tổng quan & Ứng dụng thực tế</h3>: Nêu bật tên "{title}", giải pháp cho công trình dân dụng & công nghiệp.
   - <h3>2. Bảng thông số kỹ thuật chi tiết</h3>: Tạo bảng <table><thead><tr><th>Thông số</th><th>Chi tiết</th></tr></thead><tbody>...</tbody></table> rõ ràng (Độ dày, Tiêu chuẩn, Chiều dài, Màu sắc, Ứng dụng...).
   - <h3>3. Đặc điểm & Ưu điểm vượt trội</h3>: Danh sách <ul><li><strong>[Đặc tính]</strong>: [Giải thích chi tiết]</li></ul> (Độ bền, khả năng chịu lực, chống ẩm, chống ăn mòn, thẩm mỹ).
   - <h3>4. Hướng dẫn thi công & Lắp đặt chuẩn kỹ thuật</h3>: Danh sách từng bước <ol><li><strong>Bước 1 - Chuẩn bị</strong>: ...</li><li><strong>Bước 2 - Lắp đặt</strong>: ...</li><li><strong>Bước 3 - Cố định & Hoàn thiện</strong>: ...</li></ol>.
   - <h3>5. Câu hỏi thường gặp (FAQ)</h3>: Trả lời 2-3 câu hỏi thực tế khách hàng hay hỏi dưới dạng <p><strong>Hỏi:</strong> ...</p><p><strong>Đáp:</strong> ...</p>.
   - <h3>6. Cam kết chất lượng & Bảo hành Zbuild</h3>: Đoạn kết ngắn gọn, uy tín.
3. Không chèn các ký tự lạ, không để thẻ HTML bị rách. Chèn từ khóa "{title}" tự nhiên xuyên suốt bài viết."""
    return sys_prompt, user_prompt

def make_unique_slug(conn, base_title, current_id=None):
    slug_base = slugify(base_title) or 'sp'
    candidate = slug_base
    counter = 1
    while True:
        row = conn.execute("SELECT id FROM products WHERE slug = ?", (candidate,)).fetchone()
        if not row or (current_id and row['id'] == current_id):
            return candidate
        candidate = f"{slug_base}-{counter}"
        counter += 1

def get_clean_path(raw_path):
    p = raw_path.rstrip('/')
    if p.startswith('/api/zbuild'):
        p = p[len('/api/zbuild'):]
    return p

class ZbuildHandler(http.server.BaseHTTPRequestHandler):
    def respond_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')
        self.end_headers()
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def parse_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = get_clean_path(parsed.path)
        qs = urllib.parse.parse_qs(parsed.query)

        # 1. Health check
        if path == '' or path == '/health':
            self.respond_json({'status': 'ok', 'service': 'zbuild-sqlite-api', 'time': datetime.now().isoformat()})
            return

        # 2. Get Products list
        if path == '/products':
            category = qs.get('category', [None])[0]
            search = qs.get('search', [None])[0]
            status_filter = qs.get('status', [None])[0]
            limit_val = int(qs.get('limit', [1000])[0])

            conn = get_db()
            query = "SELECT * FROM products WHERE 1=1"
            params = []
            if category and category != 'All':
                query += " AND category = ?"
                params.append(category)
            if search:
                query += " AND (title LIKE ? OR specs LIKE ?)"
                params.append(f"%{search}%")
                params.append(f"%{search}%")
            if status_filter:
                query += " AND status = ?"
                params.append(status_filter)

            query += " ORDER BY createdAt DESC LIMIT ?"
            params.append(limit_val)

            rows = conn.execute(query, params).fetchall()
            products = []
            for r in rows:
                d = dict(r)
                if isinstance(d.get('extraImages'), str):
                    try:
                        parsed_extra = json.loads(d['extraImages'])
                        d['extraImages'] = parsed_extra if isinstance(parsed_extra, list) else ([parsed_extra] if parsed_extra else [])
                    except:
                        d['extraImages'] = [d['extraImages']] if d['extraImages'].strip() else []
                elif not isinstance(d.get('extraImages'), list):
                    d['extraImages'] = []
                products.append(d)
            conn.close()
            self.respond_json({'success': True, 'count': len(products), 'products': products})
            return

        # 3. Get Single Product by ID or Slug
        if path.startswith('/products/'):
            pid = path.split('/products/')[1]
            conn = get_db()
            row = conn.execute("SELECT * FROM products WHERE id = ? OR slug = ?", (pid, pid)).fetchone()
            conn.close()
            if row:
                d = dict(row)
                if isinstance(d.get('extraImages'), str):
                    try:
                        parsed_extra = json.loads(d['extraImages'])
                        d['extraImages'] = parsed_extra if isinstance(parsed_extra, list) else ([parsed_extra] if parsed_extra else [])
                    except:
                        d['extraImages'] = [d['extraImages']] if d['extraImages'].strip() else []
                elif not isinstance(d.get('extraImages'), list):
                    d['extraImages'] = []
                self.respond_json({'success': True, 'product': d})
            else:
                self.respond_json({'success': False, 'error': 'Product not found'}, 404)
            return

        # 4. Get Customers
        if path == '/customers':
            conn = get_db()
            rows = conn.execute("SELECT * FROM customers ORDER BY createdAt DESC").fetchall()
            conn.close()
            self.respond_json({'success': True, 'customers': [dict(r) for r in rows]})
            return

        # 5. Get Orders
        if path == '/orders':
            user_id = qs.get('userId', [None])[0]
            conn = get_db()
            if user_id:
                rows = conn.execute("SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC", (user_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM orders ORDER BY createdAt DESC").fetchall()
            conn.close()
            orders = []
            for r in rows:
                d = dict(r)
                if isinstance(d.get('items'), str):
                    try: d['items'] = json.loads(d['items'])
                    except: pass
                if isinstance(d.get('shippingAddress'), str):
                    try: d['shippingAddress'] = json.loads(d['shippingAddress'])
                    except: pass
                orders.append(d)
            self.respond_json({'success': True, 'orders': orders})
            return

        # 6. Get Settings
        if path.startswith('/settings/'):
            key = path.split('/settings/')[1]
            conn = get_db()
            row = conn.execute("SELECT * FROM settings WHERE key = ?", (key,)).fetchone()
            conn.close()
            if row:
                try: val = json.loads(row['value'])
                except: val = row['value']
                self.respond_json({'success': True, 'key': key, 'value': val})
            else:
                self.respond_json({'success': True, 'key': key, 'value': None})
            return

        self.respond_json({'error': 'Not found'}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = get_clean_path(parsed.path)
        body = self.parse_body()

        # 1. Create Product
        if path == '/products':
            title = body.get('title', '').strip()
            if not title:
                self.respond_json({'error': 'Missing title'}, 400)
                return
            pid = body.get('id') or str(uuid.uuid4())[:8]
            conn = get_db()
            slug = body.get('slug') or make_unique_slug(conn, title, pid)
            
            extra_imgs = body.get('extraImages', [])
            if isinstance(extra_imgs, str):
                try:
                    parsed_extra = json.loads(extra_imgs)
                    extra_imgs = parsed_extra if isinstance(parsed_extra, list) else ([parsed_extra] if parsed_extra else [])
                except:
                    extra_imgs = [extra_imgs] if extra_imgs.strip() else []
            if isinstance(extra_imgs, list):
                extra_imgs = [str(img).strip() for img in extra_imgs if img and isinstance(img, str) and str(img).strip()]
            else:
                extra_imgs = []

            conn.execute("""
                INSERT INTO products (
                    id, dunvexId, title, slug, category, basePrice, discountPrice, price, priceBuy,
                    stock, specs, unit, weight, packaging, image, extraImages, shortDescription,
                    description, status, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                pid, body.get('dunvexId', ''), title, slug, body.get('category', 'Chưa phân loại'),
                float(body.get('basePrice', 0)), float(body.get('discountPrice', 0)),
                float(body.get('price', 0)), float(body.get('priceBuy', 0)),
                float(body.get('stock', 0)), body.get('specs', ''), body.get('unit', ''),
                str(body.get('weight', '')), body.get('packaging', ''), body.get('image', ''),
                json.dumps(extra_imgs, ensure_ascii=False), body.get('shortDescription', ''),
                body.get('description', ''), body.get('status', 'Draft')
            ))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'id': pid, 'slug': slug})
            return

        # 2. Batch Delete Products
        if path == '/products/batch-delete':
            ids = body.get('ids', [])
            if not ids:
                self.respond_json({'error': 'Empty ids'}, 400)
                return
            conn = get_db()
            placeholders = ','.join(['?'] * len(ids))
            conn.execute(f"DELETE FROM products WHERE id IN ({placeholders})", ids)
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'deleted': len(ids)})
            return

        # 3. Create / Upsert Customer
        if path == '/customers':
            cid = body.get('id') or body.get('phone') or str(uuid.uuid4())[:8]
            conn = get_db()
            conn.execute("""
                INSERT OR REPLACE INTO customers (
                    id, dunvexId, name, email, phone, address, type, status, syncedAt, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            """, (
                cid, body.get('dunvexId', ''), body.get('name', ''), body.get('email', ''),
                body.get('phone', ''), body.get('address', ''), body.get('type', 'Khách hàng'),
                body.get('status', 'active')
            ))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'id': cid})
            return

        # 4. Create Order
        if path == '/orders':
            oid = body.get('id') or ('ORD-' + str(uuid.uuid4())[:8].upper())
            items_str = json.dumps(body.get('items', []), ensure_ascii=False)
            addr_str = json.dumps(body.get('shippingAddress', {}), ensure_ascii=False)
            conn = get_db()
            conn.execute("""
                INSERT INTO orders (
                    id, userId, userName, userEmail, userPhone, items, shippingAddress,
                    total, status, paymentMethod, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                oid, body.get('userId', 'guest'), body.get('userName', ''), body.get('userEmail', ''),
                body.get('userPhone', ''), items_str, addr_str, float(body.get('total', 0)),
                body.get('status', 'pending'), body.get('paymentMethod', 'cod')
            ))
            conn.commit()
            conn.close()

            # Forward order to n8n Webhook / Dunvex in background
            try:
                payload = json.dumps({
                    'orderId': oid,
                    'customerName': body.get('userName', ''),
                    'customerPhone': body.get('userPhone', ''),
                    'customerEmail': body.get('userEmail', ''),
                    'customerAddress': body.get('shippingAddress', {}).get('street', '') if isinstance(body.get('shippingAddress'), dict) else '',
                    'totalAmount': float(body.get('total', 0)),
                    'items': body.get('items', [])
                }).encode('utf-8')
                req = urllib.request.Request(ORDER_WEBHOOK_URL, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
                urllib.request.urlopen(req, timeout=5)
            except Exception as e:
                print('Order webhook forward warning:', e)

            self.respond_json({'success': True, 'orderId': oid})
            return

        # 5. Save Settings
        if path.startswith('/settings/'):
            key = path.split('/settings/')[1]
            val_str = json.dumps(body.get('value', {}), ensure_ascii=False)
            conn = get_db()
            conn.execute("""
                INSERT OR REPLACE INTO settings (key, value, updatedAt)
                VALUES (?, ?, datetime('now'))
            """, (key, val_str))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'key': key})
            return

        # 6. SYNC PRODUCTS FROM DUNVEX
        if path == '/sync/dunvex-products':
            mode = body.get('mode', 'sync_existing')
            try:
                req = urllib.request.Request(
                    f"{DUNVEX_API_URL}/products",
                    headers={'x-api-key': DUNVEX_API_KEY, 'x-owner-id': DUNVEX_OWNER_ID}
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                
                dunvex_prods = data.get('products', [])
                conn = get_db()
                updated_count = 0
                created_count = 0
                deleted_count = 0

                # Chế độ 3: Dọn dẹp & xóa sản phẩm cũ không còn trên Dunvex
                if mode == 'clean_deleted':
                    dunvex_ids = set(str(p.get('id', '')).strip() for p in dunvex_prods if p.get('id'))
                    dunvex_titles = set(p.get('name', '').strip().lower() for p in dunvex_prods if p.get('name'))

                    rows = conn.execute("SELECT id, dunvexId, title FROM products").fetchall()
                    to_delete_ids = []
                    for r in rows:
                        p_did = str(r['dunvexId'] or '').strip()
                        p_title = (r['title'] or '').strip().lower()
                        is_in_dunvex = (p_did and p_did in dunvex_ids) or (p_title and p_title in dunvex_titles)
                        if not is_in_dunvex:
                            to_delete_ids.append(r['id'])

                    if to_delete_ids:
                        placeholders = ','.join(['?'] * len(to_delete_ids))
                        conn.execute(f"DELETE FROM products WHERE id IN ({placeholders})", to_delete_ids)
                        deleted_count = len(to_delete_ids)

                    conn.commit()
                    conn.close()
                    self.respond_json({
                        'success': True,
                        'deleted': deleted_count,
                        'totalFromDunvex': len(dunvex_prods),
                        'message': f'Dọn dẹp hoàn tất: Đã xóa {deleted_count} sản phẩm không còn tồn tại trên Dunvex.'
                    })
                    return

                # Chế độ 2: Chỉ lấy sản phẩm mới từ Dunvex
                elif mode == 'fetch_new':
                    for p in dunvex_prods:
                        if not p.get('name'): continue
                        did = str(p.get('id', ''))
                        title = p.get('name', '').strip()
                        row = conn.execute("SELECT id FROM products WHERE dunvexId = ? OR title = ?", (did, title)).fetchone()
                        if not row:
                            price = float(p.get('priceSell', 0) or 0)
                            price_buy = float(p.get('priceImport', 0) or 0)
                            stock = float(p.get('stock', 0) or 0)
                            specs = str(p.get('specs') or p.get('spec') or p.get('quyCach') or '')
                            unit = str(p.get('unit') or '')
                            weight = str(p.get('weight') or p.get('netWeight') or '')
                            packaging = str(p.get('packaging') or p.get('packing') or '')
                            img = str(p.get('image') or p.get('imageUrl') or p.get('thumbnail') or '')
                            cat = p.get('category')
                            if isinstance(cat, dict): cat = cat.get('name', 'Chưa phân loại')
                            elif not cat: cat = 'Chưa phân loại'

                            pid = str(uuid.uuid4())[:8]
                            slug = make_unique_slug(conn, title, pid)
                            conn.execute("""
                                INSERT INTO products (
                                    id, dunvexId, title, slug, category, basePrice, discountPrice, price, priceBuy,
                                    stock, specs, unit, weight, packaging, image, status, createdAt, updatedAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', datetime('now'), datetime('now'))
                            """, (pid, did, title, slug, cat, price, price, price, price_buy, stock, specs, unit, weight, packaging, img))
                            created_count += 1

                    conn.commit()
                    conn.close()
                    self.respond_json({
                        'success': True,
                        'created': created_count,
                        'totalFromDunvex': len(dunvex_prods),
                        'message': f'Lấy sản phẩm mới hoàn tất: Đã thêm {created_count} sản phẩm mới từ Dunvex.'
                    })
                    return

                # Chế độ 1: Đồng bộ tồn kho & giá sản phẩm hiện có
                else:
                    for p in dunvex_prods:
                        if not p.get('name'): continue
                        did = str(p.get('id', ''))
                        title = p.get('name', '').strip()
                        price = float(p.get('priceSell', 0) or 0)
                        price_buy = float(p.get('priceImport', 0) or 0)
                        stock = float(p.get('stock', 0) or 0)
                        specs = str(p.get('specs') or p.get('spec') or p.get('quyCach') or '')
                        unit = str(p.get('unit') or '')
                        weight = str(p.get('weight') or p.get('netWeight') or '')
                        packaging = str(p.get('packaging') or p.get('packing') or '')
                        img = str(p.get('image') or p.get('imageUrl') or p.get('thumbnail') or '')
                        cat = p.get('category')
                        if isinstance(cat, dict): cat = cat.get('name', 'Chưa phân loại')
                        elif not cat: cat = 'Chưa phân loại'

                        row = conn.execute("SELECT id, image FROM products WHERE dunvexId = ? OR title = ?", (did, title)).fetchone()
                        if row:
                            keep_img = row['image'] if row['image'] else img
                            conn.execute("""
                                UPDATE products SET
                                    dunvexId = ?, title = ?, category = ?, basePrice = ?, discountPrice = ?,
                                    price = ?, priceBuy = ?, stock = ?, specs = ?, unit = ?, weight = ?,
                                    packaging = ?, image = ?, updatedAt = datetime('now')
                                WHERE id = ?
                            """, (did, title, cat, price, price, price, price_buy, stock, specs, unit, weight, packaging, keep_img, row['id']))
                            updated_count += 1
                        else:
                            pid = str(uuid.uuid4())[:8]
                            slug = make_unique_slug(conn, title, pid)
                            conn.execute("""
                                INSERT INTO products (
                                    id, dunvexId, title, slug, category, basePrice, discountPrice, price, priceBuy,
                                    stock, specs, unit, weight, packaging, image, status, createdAt, updatedAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', datetime('now'), datetime('now'))
                            """, (pid, did, title, slug, cat, price, price, price, price_buy, stock, specs, unit, weight, packaging, img))
                            created_count += 1

                    conn.commit()
                    conn.close()
                    self.respond_json({
                        'success': True,
                        'updated': updated_count,
                        'created': created_count,
                        'totalFromDunvex': len(dunvex_prods),
                        'message': f'Đồng bộ hoàn tất: {updated_count} cập nhật, {created_count} tạo mới.'
                    })
                    return
            except Exception as e:
                self.respond_json({'success': False, 'error': str(e)}, 500)
                return

        # 7. SYNC CUSTOMERS FROM DUNVEX
        if path == '/sync/dunvex-customers':
            try:
                req = urllib.request.Request(
                    f"{DUNVEX_API_URL}/customers",
                    headers={'x-api-key': DUNVEX_API_KEY, 'x-owner-id': DUNVEX_OWNER_ID}
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                
                dunvex_custs = data.get('customers', [])
                conn = get_db()
                synced_count = 0

                for c in dunvex_custs:
                    if not c.get('name') and not c.get('phone') and not c.get('email'): continue
                    cid = c.get('email') or c.get('phone') or str(c.get('id', ''))
                    conn.execute("""
                        INSERT OR REPLACE INTO customers (
                            id, dunvexId, name, email, phone, address, type, status, syncedAt, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
                    """, (
                        cid, str(c.get('id', '')), c.get('name', ''), c.get('email', ''),
                        c.get('phone', ''), c.get('address', ''), c.get('type', 'Khách hàng'),
                        c.get('status', 'active')
                    ))
                    synced_count += 1

                conn.commit()
                conn.close()
                self.respond_json({
                    'success': True,
                    'synced': synced_count,
                    'total': len(dunvex_custs),
                    'message': f'Đồng bộ thành công {synced_count} khách hàng từ Dunvex.'
                })
            except Exception as e:
                self.respond_json({'success': False, 'error': str(e)}, 500)
            return

        # 8. AI ENRICH PRODUCT WITH TAVILY & AI
        if path == '/ai/enrich':
            product_id = body.get('productId')
            title = body.get('title') or ''
            specs = body.get('specs') or ''
            category = body.get('category') or ''
            instructions = body.get('instructions') or ''
            product_info = body.get('productInfo') or ''
            tavily_key = body.get('tavilyApiKey') or os.environ.get('TAVILY_API_KEY', '')

            # 1. Search Tavily if key provided
            search_context = ''
            if tavily_key:
                try:
                    search_query = f"{title} vật liệu xây dựng {specs}".strip()
                    t_payload = json.dumps({'query': search_query, 'max_results': 3}).encode('utf-8')
                    t_req = urllib.request.Request(
                        'https://api.tavily.com/search',
                        data=t_payload,
                        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {tavily_key}'},
                        method='POST'
                    )
                    with urllib.request.urlopen(t_req, timeout=10) as t_resp:
                        t_data = json.loads(t_resp.read().decode('utf-8'))
                        results = t_data.get('results', [])
                        search_context = '\n'.join([f"- {r.get('title')}: {r.get('content')}" for r in results])
                except Exception as te:
                    print('Tavily search notice:', te)

            # 2. Call DeepSeek AI for HTML SEO Generation
            ai_desc = None
            if DEEPSEEK_API_KEY:
                try:
                    sys_prompt, user_prompt = build_ai_product_prompt(
                        title=title, category=category, specs=specs,
                        search_context=search_context, instructions=instructions, product_info=product_info
                    )

                    payload = json.dumps({
                        'model': DEEPSEEK_MODEL,
                        'messages': [
                            {'role': 'system', 'content': sys_prompt},
                            {'role': 'user', 'content': user_prompt}
                        ],
                        'temperature': 0.6,
                        'max_tokens': 3000
                    }).encode('utf-8')

                    req = urllib.request.Request(
                        DEEPSEEK_ENDPOINT,
                        data=payload,
                        headers={
                            'Content-Type': 'application/json',
                            'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
                        },
                        method='POST'
                    )
                    with urllib.request.urlopen(req, timeout=50) as resp:
                        res_data = json.loads(resp.read().decode('utf-8'))
                        raw_content = res_data['choices'][0]['message']['content']
                        ai_desc = clean_html_content(raw_content)
                        if ai_desc:
                            print(f'DeepSeek AI successfully enriched HTML for {title}')
                except Exception as aie:
                    print('DeepSeek AI error notice:', aie)

            # Fallback template if AI API fails
            desc = ai_desc if ai_desc else get_default_html_description(title, category, specs)

            if product_id:
                conn = get_db()
                conn.execute("UPDATE products SET description = ?, status = 'active', updatedAt = datetime('now') WHERE id = ? OR slug = ?", (desc, product_id, product_id))
                conn.commit()
                conn.close()

            self.respond_json({
                'success': True,
                'productId': product_id,
                'description': desc,
                'aiGenerated': bool(ai_desc)
            })
            return

        # 9. AI BULK ENRICH - QUÉT & TỰ ĐỘNG VIẾT BÀI THEO THỨ TỰ CHO NHIỀU SẢN PHẨM
        if path == '/ai/bulk-enrich':
            status_filter = body.get('status')
            limit_val = int(body.get('limit', 10))
            product_ids = body.get('productIds', [])
            instructions = body.get('instructions', '')
            tavily_key = body.get('tavilyApiKey') or os.environ.get('TAVILY_API_KEY', '')

            conn = get_db()
            targets = []

            if product_ids and len(product_ids) > 0:
                placeholders = ','.join(['?'] * len(product_ids))
                rows = conn.execute(f"SELECT * FROM products WHERE id IN ({placeholders}) ORDER BY id ASC LIMIT ?", [*product_ids, limit_val]).fetchall()
                targets = [dict(r) for r in rows]
            else:
                # Ưu tiên sản phẩm trạng thái Draft hoặc chưa có bài viết / bài viết quá ngắn (< 50 ký tự)
                query = "SELECT * FROM products WHERE (status = 'Draft' OR description IS NULL OR length(description) < 50)"
                params = []
                if status_filter and status_filter.lower() == 'draft':
                    query = "SELECT * FROM products WHERE status = 'Draft'"
                query += " ORDER BY id ASC LIMIT ?"
                params.append(limit_val)
                rows = conn.execute(query, params).fetchall()
                targets = [dict(r) for r in rows]

                # Nếu không còn draft nào, lấy sản phẩm bất kỳ chưa có mô tả đầy đủ
                if not targets:
                    rows = conn.execute("SELECT * FROM products WHERE description IS NULL OR length(description) < 100 ORDER BY id ASC LIMIT ?", (limit_val,)).fetchall()
                    targets = [dict(r) for r in rows]

            enriched_results = []
            for p in targets:
                p_id = p['id']
                p_title = p.get('title', '').strip()
                p_cat = p.get('category', 'Vật liệu xây dựng')
                p_specs = p.get('specs', '')

                # 1. Tra cứu thông tin bổ sung nếu có Tavily
                search_ctx = ''
                if tavily_key:
                    try:
                        search_query = f"{p_title} vật liệu xây dựng {p_specs}".strip()
                        t_payload = json.dumps({'query': search_query, 'max_results': 2}).encode('utf-8')
                        t_req = urllib.request.Request(
                            'https://api.tavily.com/search',
                            data=t_payload,
                            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {tavily_key}'},
                            method='POST'
                        )
                        with urllib.request.urlopen(t_req, timeout=10) as t_resp:
                            t_data = json.loads(t_resp.read().decode('utf-8'))
                            results = t_data.get('results', [])
                            search_ctx = '\n'.join([f"- {r.get('title')}: {r.get('content')}" for r in results])
                    except Exception as te:
                        print(f"Tavily search warning for {p_title}:", te)

                # 2. Gọi DeepSeek AI tạo nội dung HTML chính xác theo tên sản phẩm
                ai_content = None
                if DEEPSEEK_API_KEY:
                    try:
                        sys_prompt, user_prompt = build_ai_product_prompt(
                            title=p_title, category=p_cat, specs=p_specs,
                            search_context=search_ctx, instructions=instructions
                        )

                        ds_payload = json.dumps({
                            'model': DEEPSEEK_MODEL,
                            'messages': [
                                {'role': 'system', 'content': sys_prompt},
                                {'role': 'user', 'content': user_prompt}
                            ],
                            'temperature': 0.6,
                            'max_tokens': 3000
                        }).encode('utf-8')

                        ds_req = urllib.request.Request(
                            DEEPSEEK_ENDPOINT,
                            data=ds_payload,
                            headers={
                                'Content-Type': 'application/json',
                                'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
                            },
                            method='POST'
                        )
                        with urllib.request.urlopen(ds_req, timeout=50) as resp:
                            res_data = json.loads(resp.read().decode('utf-8'))
                            raw_desc = res_data['choices'][0]['message']['content']
                            ai_content = clean_html_content(raw_desc)
                    except Exception as de:
                        print(f"DeepSeek bulk enrich error for {p_title}:", de)

                # 3. Fallback chuẩn nếu API lỗi mạng
                if not ai_content:
                    ai_content = get_default_html_description(p_title, p_cat, p_specs)

                # 4. Cập nhật trực tiếp vào SQLite đúng theo ID và tên sản phẩm
                conn.execute("""
                    UPDATE products SET
                        description = ?,
                        status = 'active',
                        updatedAt = datetime('now')
                    WHERE id = ?
                """, (ai_content, p_id))
                conn.commit()

                enriched_results.append({
                    'id': p_id,
                    'title': p_title,
                    'category': p_cat,
                    'aiGenerated': bool(ai_content and len(ai_content) > 100),
                    'descLength': len(ai_content)
                })

            conn.close()

            self.respond_json({
                'success': True,
                'totalTargeted': len(targets),
                'processedCount': len(enriched_results),
                'products': enriched_results,
                'message': f"Đã tự động tạo bài viết HTML chuẩn SEO và cập nhật thành công cho {len(enriched_results)} sản phẩm."
            })
            return

        # 10. AI ADMIN CHAT
        if path == '/ai/chat':
            user_msg = body.get('message', '')
            history = body.get('history', [])
            instructions = body.get('instructions', '')

            messages = []
            if instructions:
                messages.append({'role': 'system', 'content': instructions})
            else:
                messages.append({'role': 'system', 'content': 'Bạn là Trợ lý AI Quản trị của Z-BUILD, hỗ trợ admin quản lý sản phẩm, đơn hàng, khách hàng.'})
            
            for h in history:
                messages.append({'role': h.get('role', 'user'), 'content': h.get('content', '')})
            
            messages.append({'role': 'user', 'content': user_msg})

            reply_text = ''
            if DEEPSEEK_API_KEY:
                try:
                    payload = json.dumps({
                        'model': DEEPSEEK_MODEL,
                        'messages': messages,
                        'temperature': 0.4,
                        'max_tokens': 3000
                    }).encode('utf-8')
                    req = urllib.request.Request(
                        DEEPSEEK_ENDPOINT,
                        data=payload,
                        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {DEEPSEEK_API_KEY}'},
                        method='POST'
                    )
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        res_data = json.loads(resp.read().decode('utf-8'))
                        reply_text = res_data['choices'][0]['message']['content']
                except Exception as e:
                    print('DeepSeek chat error:', e)
                    reply_text = f"⚠️ Lỗi kết nối AI: {str(e)}"
            else:
                reply_text = "⚠️ Chưa cấu hình DEEPSEEK_API_KEY trên VPS."

            self.respond_json({'success': True, 'reply': reply_text, 'message': reply_text})
            return

        self.respond_json({'error': 'Not found'}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = get_clean_path(parsed.path)
        body = self.parse_body()

        if path.startswith('/products/'):
            pid = path.split('/products/')[1]
            conn = get_db()
            row = conn.execute("SELECT * FROM products WHERE id = ? OR LOWER(id) = LOWER(?) OR dunvexId = ? OR slug = ?", (pid, pid, pid, pid)).fetchone()
            if not row:
                conn.close()
                self.respond_json({'error': 'Product not found'}, 404)
                return

            real_id = row['id']
            fields = []
            values = []
            allowed = ['title', 'slug', 'category', 'basePrice', 'discountPrice', 'price', 'priceBuy', 'stock', 'specs', 'unit', 'weight', 'packaging', 'image', 'extraImages', 'shortDescription', 'description', 'status']
            for k in allowed:
                if k in body:
                    # Protect description against conversational filler
                    if k == 'description':
                        val = str(body[k] or '').strip()
                        val_lower = val.lower()
                        if (val_lower.startswith('chào bạn') or val_lower.startswith('chào sếp') or 
                            'bạn muốn tôi xử lý theo hướng nào' in val_lower or 'hãy cho tôi biết lựa chọn' in val_lower):
                            continue
                        val = clean_html_content(val)
                        fields.append("description = ?")
                        values.append(val)
                    elif k == 'extraImages':
                        val = body[k]
                        if isinstance(val, str):
                            try:
                                parsed_extra = json.loads(val)
                                val = parsed_extra if isinstance(parsed_extra, list) else ([parsed_extra] if parsed_extra else [])
                            except:
                                val = [val] if val.strip() else []
                        if isinstance(val, list):
                            val = [str(img).strip() for img in val if img and isinstance(img, str) and str(img).strip()]
                        else:
                            val = []
                        val_json = json.dumps(val, ensure_ascii=False)
                        fields.append("extraImages = ?")
                        values.append(val_json)
                    else:
                        fields.append(f"{k} = ?")
                        values.append(body[k])
            
            if fields:
                fields.append("updatedAt = datetime('now')")
                values.append(real_id)
                clause = ", ".join(fields)
                conn.execute(f"UPDATE products SET {clause} WHERE id = ?", values)
                conn.commit()
            conn.close()
            self.respond_json({'success': True, 'id': real_id})
            return

        if path.startswith('/orders/'):
            oid = path.split('/orders/')[1]
            conn = get_db()
            fields = []
            values = []
            allowed = ['status', 'total', 'paymentMethod', 'userName', 'userPhone', 'userEmail']
            for k in allowed:
                if k in body:
                    fields.append(f"{k} = ?")
                    values.append(body[k])
            if fields:
                fields.append("updatedAt = datetime('now')")
                values.append(oid)
                clause = ", ".join(fields)
                conn.execute(f"UPDATE orders SET {clause} WHERE id = ?", values)
                conn.commit()
            conn.close()
            self.respond_json({'success': True, 'id': oid})
            return

        self.respond_json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = get_clean_path(parsed.path)

        if path.startswith('/products/'):
            pid = path.split('/products/')[1]
            conn = get_db()
            conn.execute("DELETE FROM products WHERE id = ? OR slug = ?", (pid, pid))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'deleted': pid})
            return

        if path.startswith('/customers/'):
            cid = path.split('/customers/')[1]
            conn = get_db()
            conn.execute("DELETE FROM customers WHERE id = ?", (cid,))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'deleted': cid})
            return

        if path.startswith('/orders/'):
            oid = path.split('/orders/')[1]
            conn = get_db()
            conn.execute("DELETE FROM orders WHERE id = ?", (oid,))
            conn.commit()
            conn.close()
            self.respond_json({'success': True, 'deleted': oid})
            return

        self.respond_json({'error': 'Not found'}, 404)

def run():
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), ZbuildHandler)
    print(f"Zbuild SQLite API server running on port {PORT}...")
    server.serve_forever()

if __name__ == '__main__':
    run()
