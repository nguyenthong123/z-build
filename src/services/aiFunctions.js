/**
 * AI Function Calling Service
 * Phase 3.1 - Cho phép AI truy vấn Firestore real-time
 * 
 * Functions:
 * - search_products: Tìm sản phẩm theo tên/category
 * - get_product_detail: Chi tiết 1 sản phẩm (giá, tồn kho, mô tả)
 * - count_products: Đếm sản phẩm theo category
 * - check_order_status: Kiểm tra trạng thái đơn hàng
 * - get_order_history: Lịch sử đơn hàng của khách
 * - generate_quotation: Tạo báo giá tự động
 * - get_store_stats: Thống kê nhanh cửa hàng
 */

import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { calculateConstructionMaterials } from './MaterialService';

// ============ FUNCTION DEFINITIONS (cho DeepSeek/OpenAI tools format) ============

export const AI_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "calculate_construction_materials",
      description: "Tính toán số lượng vật tư cần thiết (thạch cao, khung xương, phụ kiện) cho các hạng mục thi công.",
      parameters: {
        type: "object",
        properties: {
          projectType: { type: "string", description: "Loại hạng mục thi công: 'Trần thả', 'Trần chìm', 'Vách ngăn', 'Sàn nhẹ'" },
          area: { type: "number", description: "Diện tích cần thi công (m2)" }
        },
        required: ["projectType", "area"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Tạo đơn hàng mới vào hệ thống khi khách hàng chốt đơn mua hàng.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Tên khách hàng" },
          customerPhone: { type: "string", description: "Số điện thoại" },
          customerAddress: { type: "string", description: "Địa chỉ giao hàng" },
          items: {
            type: "array",
            description: "Danh sách sản phẩm trong đơn",
            items: {
              type: "object",
              properties: {
                productName: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" }
              }
            }
          }
        },
        required: ["customerName", "customerPhone", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Tạo sản phẩm mới vào danh mục sản phẩm của hệ thống (Ví dụ: khách hàng yêu cầu thêm mã hàng mới).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Tên sản phẩm (Lưu ý: KHÔNG bao gồm quy cách vào tên)" },
          category: { 
            type: "string", 
            description: "Danh mục sản phẩm. Bắt buộc nhập. Nếu người dùng chưa cung cấp, HÃY DỪNG LẠI và yêu cầu họ cung cấp (hãy gợi ý dựa trên 'Danh mục hiện có' trong System Prompt)." 
          },
          basePrice: { type: "number", description: "Giá gốc của sản phẩm" },
          discountPrice: { type: "number", description: "Giá khuyến mãi (tùy chọn)" },
          stock: { type: "number", description: "Số lượng tồn kho ban đầu (mặc định 100)" },
          weight: { type: "string", description: "Trọng lượng riêng (VD: 5.4kg)" },
          packaging: { type: "string", description: "Quy cách đóng gói (Ví dụ: 10 tấm/hộp)" },
          specs: { type: "string", description: "Quy cách sản phẩm (Ví dụ: 400x3000, 1.22mx2.44mx18mm...)" },
          shortDesc: { type: "string", description: "Mô tả ngắn gọn hoặc yêu cầu của khách về sản phẩm (để AI tự động mở rộng thành bài viết)" }
        },
        required: ["title", "basePrice", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Tìm kiếm sản phẩm trong cửa hàng Zbuild theo tên hoặc danh mục. Trả về danh sách sản phẩm khớp.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm (tên sản phẩm hoặc mô tả)" },
          category: { type: "string", description: "Danh mục sản phẩm (nếu biết)" },
          max_results: { type: "number", description: "Số kết quả tối đa trả về, mặc định 5" }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_detail",
      description: "Lấy chi tiết một sản phẩm cụ thể theo tên hoặc ID: giá bán, giá nhập, tồn kho, mô tả, hình ảnh.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên sản phẩm cần tra cứu" },
          product_id: { type: "string", description: "ID sản phẩm (nếu biết)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "count_products",
      description: "Đếm số lượng sản phẩm trong cửa hàng, có thể filter theo danh mục.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Danh mục cần đếm (bỏ trống = đếm tất cả)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Kiểm tra trạng thái đơn hàng theo mã đơn hoặc email khách hàng.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Mã đơn hàng (VD: ZBMMYIT7C093)" },
          customer_email: { type: "string", description: "Email khách hàng" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_history",
      description: "Lấy lịch sử đơn hàng gần đây của cửa hàng hoặc theo email khách hàng.",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string", description: "Email khách hàng (bỏ trống = tất cả đơn)" },
          status_filter: { type: "string", description: "Lọc theo trạng thái: pending, confirmed, shipping, delivered, cancelled" },
          max_results: { type: "number", description: "Số lượng đơn trả về, mặc định 10" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_quotation",
      description: "Tạo báo giá tự động cho khách hàng dựa trên danh sách sản phẩm và số lượng yêu cầu.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Danh sách sản phẩm cần báo giá",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string", description: "Tên sản phẩm" },
                quantity: { type: "number", description: "Số lượng" }
              },
              required: ["product_name", "quantity"]
            }
          },
          customer_name: { type: "string", description: "Tên khách hàng (cho tiêu đề báo giá)" }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart_batch",
      description: "Thêm một danh sách các sản phẩm vào giỏ hàng của khách hàng sau khi khách hàng đồng ý chốt đơn từ báo giá.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Danh sách sản phẩm cần thêm vào giỏ",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string", description: "Tên sản phẩm" },
                quantity: { type: "number", description: "Số lượng" }
              },
              required: ["product_name", "quantity"]
            }
          }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_store_stats",
      description: "Lấy thống kê tổng quan cửa hàng: tổng sản phẩm, tổng đơn hàng, doanh thu, đơn chờ xử lý.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_draft_products",
      description: "Lấy danh sách các sản phẩm đang ở trạng thái nháp (Draft) hoặc chưa có mô tả chi tiết để tiến hành cập nhật.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_product_details",
      description: "Cập nhật chi tiết một sản phẩm (mô tả chuẩn SEO bằng HTML, quy cách, danh mục). Cần giữ nguyên trạng thái Nháp (Draft) để người dùng có thể tự kiểm tra và thêm hình ảnh.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID của sản phẩm cần cập nhật" },
          description: { type: "string", description: "Đoạn mã HTML mô tả chi tiết sản phẩm (KHÔNG bọc trong markdown ```html)" },
          category: { type: "string", description: "Danh mục sản phẩm" },
          specs: { type: "string", description: "Thông số kỹ thuật/quy cách" }
        },
        required: ["product_id", "description"]
      }
    }
  }
];

// ============ FUNCTION IMPLEMENTATIONS ============

const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

async function searchProducts({ keyword = '', category = '', max_results = 5 }) {
  try {
    const snap = await getDocs(collection(db, 'products'));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by keyword
    if (keyword) {
      const kw = keyword.toLowerCase();
      products = products.filter(p =>
        (p.title || '').toLowerCase().includes(kw) ||
        (p.description || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      );
    }

    // Filter by category
    if (category) {
      const cat = category.toLowerCase();
      products = products.filter(p => (p.category || '').toLowerCase().includes(cat));
    }

    return products.slice(0, max_results).map(p => ({
      id: p.id,
      name: p.title,
      price: formatCurrency(p.price),
      price_raw: p.price,
      category: p.category || 'Chung',
      in_stock: p.stock !== undefined ? (p.stock > 0 ? `Còn ${p.stock}` : 'Hết hàng') : 'Không theo dõi',
      image: p.image || null,
      description: (p.description || '').substring(0, 200)
    }));
  } catch (err) {
    return { error: 'Lỗi truy vấn sản phẩm: ' + err.message };
  }
}

async function getProductDetail({ product_name = '', product_id = '' }) {
  try {
    if (product_id) {
      const docSnap = await getDoc(doc(db, 'products', product_id));
      if (docSnap.exists()) {
        const p = { id: docSnap.id, ...docSnap.data() };
        return {
          id: p.id, name: p.title, price: formatCurrency(p.price), price_raw: p.price,
          buy_price: p.priceBuy ? formatCurrency(p.priceBuy) : 'N/A',
          category: p.category || 'Chung', stock: p.stock ?? 'Không theo dõi',
          description: p.description || '', image: p.image || null,
          specs: p.specs || null
        };
      }
    }

    if (product_name) {
      const snap = await getDocs(collection(db, 'products'));
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const kw = product_name.toLowerCase();
      const found = products.find(p => (p.title || '').toLowerCase().includes(kw));
      if (found) {
        return {
          id: found.id, name: found.title, price: formatCurrency(found.price), price_raw: found.price,
          buy_price: found.priceBuy ? formatCurrency(found.priceBuy) : 'N/A',
          category: found.category || 'Chung', stock: found.stock ?? 'Không theo dõi',
          description: found.description || '', image: found.image || null,
          specs: found.specs || null
        };
      }
    }

    return { error: 'Không tìm thấy sản phẩm' };
  } catch (err) {
    return { error: 'Lỗi truy vấn: ' + err.message };
  }
}

async function countProducts({ category = '' }) {
  try {
    const snap = await getDocs(collection(db, 'products'));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (category) {
      const cat = category.toLowerCase();
      products = products.filter(p => (p.category || '').toLowerCase().includes(cat));
    }

    // Group by category
    const categoryCounts = {};
    products.forEach(p => {
      const c = p.category || 'Chung';
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });

    return { total: products.length, by_category: categoryCounts };
  } catch (err) {
    return { error: 'Lỗi đếm sản phẩm: ' + err.message };
  }
}

async function addToCartBatch({ items = [] }) {
  try {
    if (!items || items.length === 0) return { error: "Danh sách sản phẩm trống" };

    const snap = await getDocs(collection(db, 'products'));
    const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const productsToAdd = [];
    const notFound = [];

    for (const item of items) {
      const kw = item.product_name.toLowerCase();
      // Tìm sản phẩm khớp nhất
      const found = allProducts.find(p => (p.title || '').toLowerCase().includes(kw));
      if (found) {
        productsToAdd.push({
          product: { id: found.id, ...found },
          quantity: Number(item.quantity) || 1
        });
      } else {
        notFound.push(item.product_name);
      }
    }

    if (productsToAdd.length > 0) {
      window.dispatchEvent(new CustomEvent('AI_ADD_TO_CART_BATCH', { detail: productsToAdd }));
      let msg = `Đã thêm thành công ${productsToAdd.length} loại sản phẩm vào giỏ hàng!`;
      if (notFound.length > 0) {
        msg += ` Tuy nhiên, không tìm thấy các sản phẩm sau: ${notFound.join(', ')}.`;
      }
      return { success: true, message: msg };
    } else {
      return { success: false, error: 'Không tìm thấy sản phẩm nào khớp trong hệ thống để thêm vào giỏ.' };
    }
  } catch (err) {
    return { error: 'Lỗi thêm vào giỏ: ' + err.message };
  }
}

async function checkOrderStatus({ order_number = '', customer_email = '' }) {
  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() }));

    let found = null;
    
    if (order_number) {
      found = orders.find(o => 
        (o.orderNumber || '').toUpperCase().includes(order_number.toUpperCase()) ||
        o.id.toUpperCase().includes(order_number.toUpperCase())
      );
    } else if (customer_email) {
      found = orders.find(o => (o.userEmail || '').toLowerCase() === customer_email.toLowerCase());
    }

    if (!found) return { error: 'Không tìm thấy đơn hàng' };

    const statusMap = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao hàng', delivered: 'Đã giao thành công', cancelled: 'Đã hủy' };

    return {
      order_number: found.orderNumber || found.id.substring(0, 10),
      status: statusMap[found.status] || found.status,
      total: formatCurrency(found.total),
      items: (found.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: formatCurrency(i.price) })),
      customer: found.userName || `${found.shippingAddress?.firstName || ''} ${found.shippingAddress?.lastName || ''}`.trim(),
      date: found.createdAt ? new Intl.DateTimeFormat('vi-VN').format(found.createdAt) : 'N/A',
      payment_method: found.paymentMethod || 'COD'
    };
  } catch (err) {
    return { error: 'Lỗi tra cứu đơn hàng: ' + err.message };
  }
}

async function getOrderHistory({ customer_email = '', status_filter = '', max_results = 10 }) {
  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    let orders = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() }));

    if (customer_email) {
      orders = orders.filter(o => (o.userEmail || '').toLowerCase() === customer_email.toLowerCase());
    }
    if (status_filter) {
      orders = orders.filter(o => o.status === status_filter);
    }

    const statusMap = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };

    return orders.slice(0, max_results).map(o => ({
      order_number: o.orderNumber || o.id.substring(0, 10),
      status: statusMap[o.status] || o.status,
      total: formatCurrency(o.total),
      items_count: (o.items || []).length,
      customer: o.userName || `${o.shippingAddress?.firstName || ''} ${o.shippingAddress?.lastName || ''}`.trim(),
      date: o.createdAt ? new Intl.DateTimeFormat('vi-VN').format(o.createdAt) : 'N/A'
    }));
  } catch (err) {
    return { error: 'Lỗi truy vấn đơn hàng: ' + err.message };
  }
}

async function generateQuotation({ items = [], customer_name = 'Quý khách' }) {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const quotationItems = [];
    let grandTotal = 0;

    for (const item of items) {
      const kw = (item.product_name || '').toLowerCase();
      const found = allProducts.find(p => (p.title || '').toLowerCase().includes(kw));

      if (found) {
        const lineTotal = (found.price || 0) * (item.quantity || 1);
        grandTotal += lineTotal;
        quotationItems.push({
          name: found.title,
          unit_price: formatCurrency(found.price),
          unit_price_raw: found.price,
          quantity: item.quantity || 1,
          total: formatCurrency(lineTotal),
          total_raw: lineTotal,
          in_stock: found.stock !== undefined ? (found.stock >= (item.quantity || 1) ? 'Đủ hàng' : `Chỉ còn ${found.stock}`) : 'Có sẵn'
        });
      } else {
        quotationItems.push({
          name: item.product_name,
          unit_price: 'Không tìm thấy',
          quantity: item.quantity || 1,
          total: 'N/A',
          in_stock: 'Không xác định'
        });
      }
    }

    return {
      quotation_for: customer_name,
      date: new Intl.DateTimeFormat('vi-VN').format(new Date()),
      items: quotationItems,
      grand_total: formatCurrency(grandTotal),
      grand_total_raw: grandTotal,
      note: 'Báo giá có hiệu lực trong 7 ngày. Giá chưa bao gồm phí vận chuyển.'
    };
  } catch (err) {
    return { error: 'Lỗi tạo báo giá: ' + err.message };
  }
}

async function getStoreStats() {
  try {
    const [productsSnap, ordersSnap] = await Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')))
    ]);

    const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const revenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const lowStock = products.filter(p => p.stock !== undefined && p.stock <= 5).length;

    // Category breakdown
    const categories = {};
    products.forEach(p => {
      const c = p.category || 'Chung';
      categories[c] = (categories[c] || 0) + 1;
    });

    return {
      total_products: products.length,
      total_orders: orders.length,
      pending_orders: pendingOrders,
      total_revenue: formatCurrency(revenue),
      total_revenue_raw: revenue,
      low_stock_count: lowStock,
      categories: categories,
      unique_customers: new Set(orders.map(o => o.userEmail).filter(Boolean)).size
    };
  } catch (err) {
    return { error: 'Lỗi lấy thống kê: ' + err.message };
  }
}

async function createOrder({ customerName, customerPhone, customerAddress = "", items = [] }) {
  try {
    let total = 0;
    const orderItems = items.map(item => {
      const pPrice = Number(item.price) || 0;
      const pQty = Number(item.quantity) || 1;
      total += pPrice * pQty;
      return {
        name: item.productName,
        price: pPrice,
        quantity: pQty,
        id: "ai_" + Math.random().toString(36).substr(2, 9),
        image: ""
      };
    });

    const newOrder = {
      orderNumber: "AI_" + Date.now().toString().slice(-6),
      userId: "ai_bot_user",
      userName: customerName || "Khách Hàng (Tạo bởi AI)",
      userEmail: "ai-generated@zbuild.click",
      status: "pending",
      paymentMethod: "COD",
      shippingAddress: {
        firstName: customerName || "",
        lastName: "",
        address: customerAddress || "Khách chốt qua Chat",
        phone: customerPhone || "",
        city: "",
        district: "",
        ward: ""
      },
      items: orderItems,
      total: total,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "orders"), newOrder);
    return {
      success: true,
      message: `Đã tạo đơn hàng thành công! Mã đơn: ${newOrder.orderNumber}`,
      orderId: docRef.id,
      orderNumber: newOrder.orderNumber,
      total: formatCurrency(total)
    };
  } catch (err) {
    return { error: 'Lỗi tạo đơn hàng: ' + err.message };
  }
}

const slugify = (text) => {
  if (!text) return '';
  const from = "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ·/_,:;";
  const to   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd------";
  let str = text.toLowerCase().trim();
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }
  str = str.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  return str;
};

export async function createProduct(args) {
  try {
    const { title, category, basePrice, discountPrice, stock = 100, weight = "", shortDesc = "", specs = "", packaging = "" } = args;

    // Tự động sinh nội dung chi tiết bài viết sản phẩm bằng AI
    let description = "";
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const prompt = `Viết một bài mô tả sản phẩm chuyên nghiệp, hấp dẫn, chuẩn SEO cho sản phẩm có tên là "${title}".
Thông tin bổ sung: ${shortDesc ? `Mô tả ngắn: ${shortDesc}` : ''} | Quy cách: ${specs} | Đóng gói: ${packaging}.
Yêu cầu:
- Trình bày bố cục rõ ràng, chia thành các phần: Giới thiệu chung, Ưu điểm nổi bật, Ứng dụng.
- Dùng định dạng HTML cơ bản (các thẻ h3, p, ul, li, strong).
- Chỉ trả về đoạn mã HTML thuần, KHÔNG BỌC TRONG markdown block \`\`\`html.`;

        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiApiKey}` },
          body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7 })
        });
        
        if (response.ok) {
          const data = await response.json();
          let content = data.choices[0]?.message?.content || "";
          description = content.replace(/```html/g, '').replace(/```/g, '').trim();
        }
      } catch (err) {
        console.error("Auto generate description failed:", err);
      }
    }

    const priceNum = Number(basePrice);
    const discountNum = discountPrice ? Number(discountPrice) : priceNum;

    const newProduct = {
      title,
      slug: slugify(title),
      category,
      basePrice: priceNum,
      discountPrice: discountNum,
      price: discountNum, // Giá bán hiện tại sẽ là giá khuyến mãi (nếu có)
      description,
      specs,
      packaging,
      weight,
      status: "Draft", // Viết hoa chữ D để khớp với getStatusColor
      stock: Number(stock),
      trackInventory: true,
      image: "",
      extraImages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "AI_Bot"
    };

    const docRef = await addDoc(collection(db, "products"), newProduct);
    return {
      success: true,
      message: `Đã lưu NHÁP sản phẩm "${title}". Bạn có thể vào phần Quản lý Sản phẩm để up thêm hình ảnh và chuyển sang trạng thái Hoạt động.`,
      productId: docRef.id,
      slug: newProduct.slug
    };
  } catch (err) {
    return { error: 'Lỗi tạo sản phẩm: ' + err.message };
  }
}

async function getDraftProducts() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Lọc ra các sản phẩm Draft hoặc chưa có description
    let drafts = products.filter(p => p.status === 'Draft' || !p.description || p.description.trim() === '');
    
    return drafts.map(p => ({
      id: p.id,
      title: p.title,
      category: p.category || 'Chung',
      price: formatCurrency(p.price),
      specs: p.specs || '',
      status: p.status
    }));
  } catch (err) {
    return { error: 'Lỗi lấy danh sách sản phẩm nháp: ' + err.message };
  }
}

async function updateProductDetails({ product_id, description, category, specs }) {
  try {
    const productRef = doc(db, 'products', product_id);
    const updateData = {
      description: description || "",
      // Giữ nguyên trạng thái Draft để người dùng tự thêm hình ảnh rồi mới Active
      updatedAt: new Date().toISOString()
    };
    if (category) updateData.category = category;
    if (specs) updateData.specs = specs;

    await updateDoc(productRef, updateData);
    
    return { success: true, message: `Đã cập nhật mô tả cho sản phẩm ID ${product_id} (Trạng thái vẫn là Nháp).` };
  } catch (err) {
    return { error: 'Lỗi cập nhật chi tiết sản phẩm: ' + err.message };
  }
}

// ============ FUNCTION EXECUTOR ============

export async function executeFunction(name, args) {
  const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

  switch (name) {
    case 'search_products': return await searchProducts(parsedArgs);
    case 'get_product_detail': return await getProductDetail(parsedArgs);
    case 'count_products': return await countProducts(parsedArgs);
    case 'check_order_status': return await checkOrderStatus(parsedArgs);
    case 'get_order_history': return await getOrderHistory(parsedArgs);
    case 'generate_quotation': return await generateQuotation(parsedArgs);
    case 'add_to_cart_batch': return await addToCartBatch(parsedArgs);
    case 'get_store_stats': return await getStoreStats(parsedArgs);
    case 'calculate_construction_materials': return await calculateConstructionMaterials(parsedArgs);
    case 'create_order': return await createOrder(parsedArgs);
    case 'create_product': return await createProduct(parsedArgs);
    case 'get_draft_products': return await getDraftProducts(parsedArgs);
    case 'update_product_details': return await updateProductDetails(parsedArgs);
    default: return { error: `Function "${name}" không tồn tại` };
  }
}
