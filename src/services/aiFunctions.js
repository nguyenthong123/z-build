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
import { collection, getDocs, query, orderBy, where, doc, getDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp } from 'firebase/firestore';
import { calculateConstructionMaterials } from './MaterialService';
import Fuse from 'fuse.js';

// ============ FUNCTION DEFINITIONS (cho DeepSeek/OpenAI tools format) ============

// ============================================================
// ADMIN AI FUNCTIONS — Quản trị: tạo/sửa sản phẩm, tồn kho, thống kê
// ============================================================
// ============================================================
// ADMIN AI FUNCTIONS — Quản trị: tạo/sửa sản phẩm, tồn kho, thống kê
// ============================================================
export const ADMIN_AI_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Cập nhật thông tin của một hoặc nhiều sản phẩm (tên, mô tả, giá, danh mục, quy cách, đóng gói, trọng lượng, số lượng tồn kho, trạng thái, hình ảnh) dựa theo tên hiện tại.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên hoặc từ khóa sản phẩm CẦN TÌM ĐỂ SỬA (bắt buộc, ví dụ: 'Tấm DURAflex')" },
          new_title: { type: "string", description: "Đổi tên sản phẩm thành tên mới này (tùy chọn)" },
          category: { type: "string", description: "Tên danh mục mới (tùy chọn)" },
          price: { type: "number", description: "Giá bán mới bằng số (tùy chọn)" },
          stock: { type: "number", description: "Số lượng tồn kho mới bằng số (tùy chọn)" },
          status: { type: "string", description: "Trạng thái mới: Draft, Active, Inactive (tùy chọn)" },
          description: { type: "string", description: "Nội dung mô tả HTML mới chuẩn SEO (tùy chọn)" },
          specs: { type: "string", description: "Thông số kỹ thuật/quy cách mới (tùy chọn)" },
          packaging: { type: "string", description: "Quy cách đóng gói mới (tùy chọn)" },
          weight: { type: "string", description: "Trọng lượng mới (tùy chọn)" },
          imageUrl: { type: "string", description: "URL ảnh mới (nếu admin gửi ảnh)" }
        },
        required: ["product_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Tạo sản phẩm mới. Hỗ trợ: ảnh (imageUrl từ upload), video YouTube (videoUrl), trạng thái (status: Draft/Active). Nếu người dùng gửi ảnh hoặc link YouTube, hãy dùng analyze_youtube_link trước rồi gọi create_product với đầy đủ thông tin.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Tên sản phẩm (KHÔNG bao gồm quy cách vào tên)" },
          category: { type: "string", description: "Danh mục sản phẩm. Bắt buộc nhập." },
          basePrice: { type: "number", description: "Giá gốc của sản phẩm" },
          discountPrice: { type: "number", description: "Giá khuyến mãi (tùy chọn)" },
          stock: { type: "number", description: "Số lượng tồn kho ban đầu (mặc định 100)" },
          weight: { type: "string", description: "Trọng lượng riêng" },
          packaging: { type: "string", description: "Quy cách đóng gói" },
          specs: { type: "string", description: "Quy cách sản phẩm" },
          shortDesc: { type: "string", description: "Mô tả ngắn gọn" },
          imageUrl: { type: "string", description: "URL ảnh sản phẩm (nếu admin gửi kèm ảnh, tự động lấy từ tin nhắn)" },
          videoUrl: { type: "string", description: "Link YouTube video sản phẩm (nếu có)" },
          status: { type: "string", description: "Trạng thái: Draft (nháp, mặc định) hoặc Active (đăng luôn)" }
        },
        required: ["title", "basePrice", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_product_stock",
      description: "Cập nhật số lượng tồn kho của một sản phẩm dựa theo tên.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên sản phẩm cần cập nhật tồn kho" },
          new_stock: { type: "number", description: "Số lượng tồn kho mới" }
        },
        required: ["product_name", "new_stock"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_draft_products",
      description: "Lấy danh sách các sản phẩm đang ở trạng thái nháp.",
      parameters: { type: "object", properties: {} }
    }
  },

  {
    type: "function",
    function: {
      name: "get_store_stats",
      description: "Lấy thống kê tổng quan cửa hàng: tổng sản phẩm, đơn hàng, doanh thu.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Tìm kiếm sản phẩm trong cửa hàng theo tên hoặc danh mục.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Danh mục (nếu biết)" },
          max_results: { type: "number", description: "Số kết quả tối đa, mặc định 5" }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_detail",
      description: "Lấy chi tiết một sản phẩm: giá bán, tồn kho, mô tả.",
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
      description: "Đếm số lượng sản phẩm trong cửa hàng.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Danh mục cần đếm (bỏ trống = tất cả)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Kiểm tra trạng thái đơn hàng theo mã đơn hoặc email.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Mã đơn hàng" },
          customer_email: { type: "string", description: "Email khách hàng" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_history",
      description: "Lấy lịch sử đơn hàng gần đây.",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string", description: "Email khách hàng (bỏ trống = tất cả)" },
          status_filter: { type: "string", description: "Lọc theo trạng thái" },
          max_results: { type: "number", description: "Số lượng đơn, mặc định 10" }
        }
      }
    }
  }
];

// ============================================================
// STOREFRONT AI FUNCTIONS — Tư vấn khách hàng, báo giá, đơn hàng
// ============================================================
export const STOREFRONT_AI_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Cập nhật thông tin của một hoặc nhiều sản phẩm (giá, danh mục, số lượng tồn kho, trạng thái) dựa theo tên hoặc từ khóa tên sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên hoặc từ khóa sản phẩm cần cập nhật (ví dụ: 'Tấm DURAflex 8.0mm' hoặc 'Tấm DURAflex')" },
          category: { type: "string", description: "Tên danh mục mới (tùy chọn)" },
          price: { type: "number", description: "Giá bán mới bằng số (tùy chọn)" },
          stock: { type: "number", description: "Số lượng tồn kho mới bằng số (tùy chọn)" },
          status: { type: "string", description: "Trạng thái mới: Draft, Active, Inactive (tùy chọn)" }
        },
        required: ["product_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Tìm kiếm sản phẩm trong cửa hàng Zbuild theo tên hoặc danh mục.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Danh mục (nếu biết)" },
          max_results: { type: "number", description: "Số kết quả tối đa, mặc định 5" }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_detail",
      description: "Lấy chi tiết một sản phẩm: giá bán, tồn kho, mô tả.",
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
      description: "Đếm số lượng sản phẩm trong cửa hàng.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Danh mục cần đếm (bỏ trống = tất cả)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Kiểm tra trạng thái đơn hàng theo mã đơn hoặc email.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Mã đơn hàng" },
          customer_email: { type: "string", description: "Email khách hàng" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_history",
      description: "Lấy lịch sử đơn hàng gần đây.",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string", description: "Email khách hàng (bỏ trống = tất cả)" },
          status_filter: { type: "string", description: "Lọc theo trạng thái" },
          max_results: { type: "number", description: "Số lượng đơn, mặc định 10" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_quotation",
      description: "Tạo báo giá tự động cho khách hàng dựa trên danh sách sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                quantity: { type: "number" }
              },
              required: ["product_name", "quantity"]
            }
          },
          customer_name: { type: "string" }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart_batch",
      description: "Thêm danh sách sản phẩm vào giỏ hàng sau khi khách đồng ý chốt đơn từ báo giá.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                quantity: { type: "number" }
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
      name: "calculate_construction_materials",
      description: "Tính toán số lượng vật tư cần thiết cho các hạng mục thi công. CHỈ DÙNG KHI KHÁCH MUỐN BẢNG VẬT TƯ CHI TIẾT. QUAN TRỌNG: Với trần thả, PHẢI hỏi khách muốn thả kiểu 60x60 (hộp vuông, cắt đôi tấm) hay 60x120 (nguyên tấm) TRƯỚC KHI gọi function này.",
      parameters: {
        type: "object",
        properties: {
          projectType: { type: "string", description: "Loại hạng mục: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ" },
          area: { type: "number", description: "Diện tích cần thi công (m2)" },
          tileLayout: { type: "string", description: "CHỈ CHO TRẦN THẢ: '60x60' (hộp vuông, cắt đôi tấm 605x1210) hoặc '60x120' (nguyên tấm). LUÔN HỎI KHÁCH TRƯỚC. Mặc định: 60x120." }
        },
        required: ["projectType", "area"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_m2_quotation",
      description: "Báo giá nhanh theo mét vuông (m2). Dùng khi khách chỉ muốn biết GIÁ/M2 hoặc tổng chi phí theo diện tích, không cần bảng vật tư chi tiết. Function này trả về danh sách sản phẩm phù hợp kèm đơn giá/m2.",
      parameters: {
        type: "object",
        properties: {
          projectType: { type: "string", description: "Loại hạng mục: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ, hoặc 'Tất cả' nếu không rõ" },
          area: { type: "number", description: "Diện tích (m2). Nếu khách chỉ hỏi giá/m2, để area = 1" },
          keyword: { type: "string", description: "Từ khóa tìm kiếm sản phẩm (nếu khách hỏi sản phẩm cụ thể, ví dụ: 'tấm ánh kim')" }
        },
        required: ["projectType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Tạo đơn hàng mới khi khách hàng chốt đơn mua hàng.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          customerAddress: { type: "string" },
          items: {
            type: "array",
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
      name: "update_product_price",
      description: "Cập nhật giá của sản phẩm (giá gốc và/hoặc giá khuyến mãi).",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên sản phẩm cần cập nhật giá" },
          base_price: { type: "number", description: "Giá gốc mới" },
          discount_price: { type: "number", description: "Giá khuyến mãi mới (tùy chọn)" }
        },
        required: ["product_name", "base_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_product_status",
      description: "Đổi trạng thái sản phẩm: Nháp (Draft) thành Hoạt động (Active) hoặc Ngừng (Inactive).",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên sản phẩm cần đổi trạng thái" },
          status: { type: "string", description: "Trạng thái mới: Draft, Active, Inactive" }
        },
        required: ["product_name", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_product",
      description: "Xóa sản phẩm khỏi hệ thống. Chỉ dùng khi admin yêu cầu rõ ràng.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Tên sản phẩm cần xóa" }
        },
        required: ["product_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "Cập nhật trạng thái đơn hàng: pending sang confirmed/shipping/delivered/cancelled.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Mã đơn hàng" },
          new_status: { type: "string", description: "Trạng thái mới: confirmed, shipping, delivered, cancelled" }
        },
        required: ["order_number", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_customer_info",
      description: "Tra cứu thông tin và lịch sử mua hàng của một khách hàng.",
      parameters: {
        type: "object",
        properties: {
          customer_email: { type: "string", description: "Email khách hàng cần tra cứu" }
        },
        required: ["customer_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_coupon",
      description: "Tạo mới hoặc vô hiệu hóa mã giảm giá.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "create hoặc deactivate" },
          code: { type: "string", description: "Mã giảm giá (VD: SUMMER2026)" },
          discount_type: { type: "string", description: "(khi create) Loại: percentage hoặc fixed" },
          discount_value: { type: "number", description: "(khi create) Giá trị giảm: % hoặc số tiền" },
          min_order: { type: "number", description: "(khi create) Đơn tối thiểu" },
          max_uses: { type: "number", description: "(khi create) Số lần sử dụng tối đa" }
        },
        required: ["action", "code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_youtube_link",
      description: "Phân tích link YouTube để lấy tiêu đề, mô tả, thumbnail và dùng thông tin tạo sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          youtube_url: { type: "string", description: "Link YouTube cần phân tích" }
        },
        required: ["youtube_url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_products_excel",
      description: "Xuất toàn bộ danh sách sản phẩm ra file Excel (.xlsx). Hỗ trợ lọc theo category và trạng thái.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Lọc theo danh mục (tùy chọn)" },
          status: { type: "string", description: "Lọc theo trạng thái: Draft, Active, Inactive (tùy chọn)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sync_prices_from_sheet",
      description: "Đồng bộ giá sản phẩm từ Google Sheet. Admin gửi link sheet, AI đọc và cập nhật giá dựa theo ID hoặc tên sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          sheet_url: { type: "string", description: "Link Google Sheet (dạng published CSV hoặc share link)" },
          match_field: { type: "string", description: "Cột để so khớp: id hoặc title (mặc định: id)" }
        },
        required: ["sheet_url"]
      }
    }
  }
];



// Backward compatibility
export const AI_FUNCTIONS = [...ADMIN_AI_FUNCTIONS, ...STOREFRONT_AI_FUNCTIONS].filter((v, i, a) => 
  a.findIndex(t => t.function.name === v.function.name) === i
);

// ============ FUNCTION IMPLEMENTATIONS ============

const sanitizeNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const num = Number(str);
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

async function searchProducts({ keyword = '', category = '', max_results = 5 }) {
  try {
    // Load tối đa 500 sản phẩm — đủ cho hầu hết cửa hàng
    const snap = await getDocs(query(collection(db, 'products'), limit(500)));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.title);

    // Nếu có keyword → dùng Fuse.js fuzzy search (chịu được sai chính tả, dấu)
    if (keyword) {
      const fuse = new Fuse(products, {
        keys: ['title', 'description', 'category'],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeScore: true
      });
      const results = fuse.search(keyword);
      if (results.length > 0) {
        products = results.slice(0, max_results).map(r => r.item);
      } else {
        // Fallback: tìm contains đơn giản (đã chuẩn hoá)
        const kw = keyword.toLowerCase();
        products = products.filter(p =>
          (p.title || '').toLowerCase().includes(kw) ||
          (p.description || '').toLowerCase().includes(kw) ||
          (p.category || '').toLowerCase().includes(kw)
        ).slice(0, max_results);
      }
    }

    // Filter bổ sung theo category nếu có
    if (category && products.length > 0) {
      const fuseCat = new Fuse(products, {
        keys: ['category'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 1
      });
      const catResults = fuseCat.search(category);
      if (catResults.length > 0) {
        products = catResults.slice(0, max_results).map(r => r.item);
      } else {
        const cat = category.toLowerCase();
        products = products.filter(p => (p.category || '').toLowerCase().includes(cat)).slice(0, max_results);
      }
    }

    // Nếu không có keyword & không có category → trả về top sản phẩm
    if (!keyword && !category) {
      products = products.slice(0, max_results);
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

    // Deduct stock
    for (const item of items) {
      if (item.productName) {
        const pSnap = await getDocs(query(collection(db, "products"), orderBy("title", "asc")));
        const allProds = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const found = allProds.find(p => (p.title || '').toLowerCase().includes(item.productName.toLowerCase()));
        if (found && found.stock !== undefined) {
          const newStock = Math.max(0, found.stock - (Number(item.quantity) || 1));
          await updateDoc(doc(db, "products", found.id), { stock: newStock });
        }
      }
    }

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
    const { title, category, basePrice, discountPrice, stock = 100, weight = "", shortDesc = "", specs = "", packaging = "", imageUrl = "", videoUrl = "", status = "Draft" } = args;

    // Tự động sinh nội dung chi tiết bài viết sản phẩm bằng AI
    let description = "";
    const aiApiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (aiApiKey) {
      try {
        const prompt = `Bạn là copywriter chuyên nghiệp. Viết một bài mô tả sản phẩm CHI TIẾT, CHUYÊN SÂU, chuẩn SEO cho sản phẩm: "${title}".
Thông tin bổ sung: ${shortDesc ? `Mô tả ngắn: ${shortDesc}. ` : ''}Quy cách: ${specs || 'Chưa có'}. Đóng gói: ${packaging || 'Chưa có'}.

YÊU CẦU BẮT BUỘC:
- Bài viết TỐI THIỂU 500 TỪ, càng chi tiết càng tốt.
- Bố cục rõ ràng: Giới thiệu chung → Ưu điểm nổi bật (5+ ý) → Thông số kỹ thuật → Ứng dụng thực tế → Cam kết chất lượng.
- Dùng HTML cơ bản: h3, p, ul, li, strong, em.
- Văn phong chuyên nghiệp, thuyết phục, hướng tới khách hàng xây dựng.
- Chỉ trả về HTML, KHÔNG bọc trong \`\`\`html.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 2048 }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const raw = await response.text();
          let data;
          try { data = JSON.parse(raw); }
          catch (parseErr) {
            console.warn('Description JSON parse error — retrying once:', parseErr.message);
            const retryRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
              body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 2048 }),
            });
            if (retryRes.ok) {
              const retryRaw = await retryRes.text();
              data = JSON.parse(retryRaw);
            }
          }
          if (data) {
            let content = data.choices?.[0]?.message?.content || "";
            description = content.replace(/```html/g, '').replace(/```/g, '').trim();
          }
        }
      } catch (err) {
        console.error("Auto generate description failed:", err.message);
      }
    }

    const priceNum = sanitizeNumber(basePrice);
    const discountNum = discountPrice ? sanitizeNumber(discountPrice) : priceNum;

    const newProduct = {
      title,
      slug: slugify(title),
      category,
      shortDescription: shortDesc || "",
      basePrice: priceNum,
      discountPrice: discountNum,
      price: discountNum, // Giá bán hiện tại sẽ là giá khuyến mãi (nếu có)
      description,
      specs,
      packaging,
      weight,
      status: (status === "Active" ? "Active" : "Draft"), // Hỗ trợ tạo Active luôn nếu admin yêu cầu
      stock: Number(stock),
      trackInventory: true,
      image: imageUrl || "",
      videoUrl: videoUrl || "",
      extraImages: imageUrl ? [imageUrl] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "AI_Bot"
    };

    const docRef = await addDoc(collection(db, "products"), newProduct);
    return {
      success: true,
      message: status === "Active" 
        ? `Đã tạo và KÍCH HOẠT sản phẩm "${title}" thành công! Vào Store để xem ngay.` 
        : `Đã lưu NHÁP sản phẩm "${title}". Vào Quản lý Sản phẩm để duyệt và thêm ảnh.`,
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

async function updateProductStock({ product_name, new_stock }) {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const kw = (product_name || '').toLowerCase();
    const found = allProducts.find(p => (p.title || '').toLowerCase().includes(kw));
    
    if (found) {
      await updateDoc(doc(db, "products", found.id), { 
        stock: Number(new_stock),
        trackInventory: true
      });
      return { success: true, message: `Đã cập nhật tồn kho của "${found.title}" thành ${new_stock}.` };
    } else {
      return { success: false, error: `Không tìm thấy sản phẩm nào khớp với tên "${product_name}".` };
    }
  } catch (err) {
    return { error: 'Lỗi cập nhật tồn kho: ' + err.message };
  }
}


async function updateProductPrice({ product_name, base_price, discount_price }) {
  try {
    const snap = await getDocs(collection(db, "products"));
    const allP = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const kw = (product_name || "").toLowerCase();
    const found = allP.find(p => (p.title || "").toLowerCase().includes(kw));
    if (!found) return { error: "Không tìm thấy sản phẩm: " + product_name }
    const update = { price: sanitizeNumber(base_price), basePrice: sanitizeNumber(base_price), updatedAt: new Date().toISOString() };
    if (discount_price !== undefined) { update.discountPrice = sanitizeNumber(discount_price); update.price = sanitizeNumber(discount_price); }
    await updateDoc(doc(db, "products", found.id), update);
    return { success: true, message: "Đã cập nhật giá " + found.title + ": " + formatCurrency(update.price) };
  } catch (err) { return { error: "Lỗi cập nhật giá: " + err.message }; }
}

async function updateProductStatus({ product_name, status }) {
  try {
    const snap = await getDocs(collection(db, "products"));
    const allP = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const kw = (product_name || "").toLowerCase();
    const found = allP.find(p => (p.title || "").toLowerCase().includes(kw));
    if (!found) return { error: "Không tìm thấy sản phẩm: " + product_name }
    const validStatuses = ["Draft", "Active", "Inactive"];
    const newStatus = validStatuses.find(s => s.toLowerCase() === (status || "").toLowerCase()) || status;
    await updateDoc(doc(db, "products", found.id), { status: newStatus, updatedAt: new Date().toISOString() });
    return { success: true, message: "Da doi trang thai " + found.title + " -> " + newStatus };
  } catch (err) { return { error: "Lỗi cập nhật trạng thái: " + err.message }; }
}

async function deleteProduct({ product_name }) {
  try {
    const snap = await getDocs(collection(db, "products"));
    const allP = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const kw = (product_name || "").toLowerCase();
    const found = allP.find(p => (p.title || "").toLowerCase().includes(kw));
    if (!found) return { error: "Không tìm thấy sản phẩm: " + product_name }
    await deleteDoc(doc(db, "products", found.id));
    return { success: true, message: "Da xoa san pham: " + found.title };
  } catch (err) { return { error: "Lỗi xóa sản phẩm: " + err.message }; }
}

async function updateOrderStatus({ order_number, new_status }) {
  try {
    const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const num = (order_number || "").toUpperCase();
    const found = orders.find(o => (o.orderNumber || "").toUpperCase().includes(num) || o.id.toUpperCase().includes(num));
    if (!found) return { error: "Không tìm thấy đơn hàng: " + order_number }
    const validStatuses = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
    const newS = validStatuses.find(s => s === (new_status || "").toLowerCase()) || new_status;
    if (!validStatuses.includes(newS)) return { error: "Trạng thái không hợp lệ. Dùng: " + validStatuses.join(", ") }
    await updateDoc(doc(db, "orders", found.id), { status: newS, updatedAt: new Date().toISOString() });
    return { success: true, message: "Da cap nhat don " + (found.orderNumber || found.id.substring(0,8)) + " -> " + newS };
  } catch (err) { return { error: "Lỗi cập nhật đơn hàng: " + err.message }; }
}

async function getCustomerInfo({ customer_email }) {
  try {
    const [userSnap, ordersSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("email", "==", customer_email), limit(1))),
      getDocs(query(collection(db, "orders"), where("userEmail", "==", customer_email), orderBy("createdAt", "desc"), limit(10)))
    ]);
    const user = userSnap.docs.length > 0 ? userSnap.docs[0].data() : null;
    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() }));
    const totalSpent = orders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0);
    return {
      customer: user ? { name: user.displayName || user.name, email: user.email, phone: user.phone || "N/A" } : { email: customer_email },
      total_orders: orders.length,
      total_spent: formatCurrency(totalSpent),
      recent_orders: orders.slice(0, 5).map(o => ({
        id: o.orderNumber || o.id.substring(0,8),
        status: o.status,
        total: formatCurrency(o.total),
        date: o.createdAt ? new Intl.DateTimeFormat("vi-VN").format(o.createdAt) : "N/A"
      }))
    };
  } catch (err) { return { error: "Lỗi tra cứu khách hàng: " + err.message }; }
}

async function manageCoupon({ action, code, discount_type, discount_value, min_order, max_uses }) {
  try {
    if (action === "deactivate") {
      const snap = await getDocs(query(collection(db, "coupons"), where("code", "==", code), limit(1)));
      if (snap.empty) return { error: "Không tìm thấy mã: " + code }
      await updateDoc(doc(db, "coupons", snap.docs[0].id), { active: false, updatedAt: new Date().toISOString() });
      return { success: true, message: "Da vo hieu hoa ma: " + code };
    }
    if (action === "create") {
      if (!discount_type || !discount_value) return { error: "Thiếu discount_type hoặc discount_value." }
      const newCoupon = {
        code: (code || "").toUpperCase(),
        discountType: discount_type,
        discountValue: sanitizeNumber(discount_value),
        minOrder: sanitizeNumber(min_order || 0),
        maxUses: max_uses ? Number(max_uses) : 100,
        usedCount: 0,
        active: true,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "coupons"), newCoupon);
      return { success: true, message: "Da tao ma giam gia " + newCoupon.code + " (" + (discount_type === "percentage" ? discount_value + "%" : formatCurrency(discount_value)) + ")" };
    }
    return { error: "Action không hợp lệ. Dùng create hoặc deactivate." };
  } catch (err) { return { error: "Lỗi quản lý coupon: " + err.message }; }
}

async function analyzeYouTubeLink({ youtube_url }) {
  try {
    if (!youtube_url || (!youtube_url.includes("youtube.com") && !youtube_url.includes("youtu.be"))) {
      return { error: "Link không hợp lệ. Vui lòng gửi link YouTube." };
    }
    const aiApiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (!aiApiKey) return { error: "Chưa cấu hình DEEPSEEK API Key." };
    const prompt = "Phân tích video YouTube này và trả về thông tin sản phẩm dạng JSON thuần (không markdown):\n{\n  \"title\": \"Tên sản phẩm (tiếng Việt, ngắn gọn)\",\n  \"category\": \"Danh mục phù hợp nhất\",\n  \"description\": \"Mô tả HTML sản phẩm chuẩn SEO (200-300 từ, dùng thẻ h3, p, ul, li, strong)\",\n  \"specs\": \"Thông số kỹ thuật chính\",\n  \"price_estimate\": \"Giá ước tính nếu có\"\n}\nLink: " + youtube_url;
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + aiApiKey },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.3 })
    });
    if (!res.ok) return { error: "Lỗi gọi AI phân tích YouTube." };
    const data = await res.json();
    const text = data.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        ...parsed,
        videoUrl: youtube_url,
        hint: "Dung thong tin tren de goi create_product. Nho dung videoUrl=" + youtube_url + " de gan video cho san pham."
      };
    }
    return { success: true, raw: text, videoUrl: youtube_url, hint: "Dung thong tin tren de tao san pham voi create_product." };
  } catch (err) { return { error: "Lỗi phân tích YouTube: " + err.message }; }
}

async function exportProductsExcel({ category = "", status = "" }) {
  try {
    const snap = await getDocs(collection(db, "products"));
    let allP = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (category) {
      allP = allP.filter(p => (p.category || "").toLowerCase().includes(category.toLowerCase()));
    }
    if (status) {
      const s = status.toLowerCase();
      allP = allP.filter(p => (p.status || "").toLowerCase() === s);
    }
    
    if (allP.length === 0) {
      return { error: "Không có sản phẩm nào khớp điều kiện lọc." };
    }
    
    const rows = allP.map(p => ({
      ID: p.id,
      "Tên sản phẩm": p.title || "",
      "Danh mục": p.category || "",
      "Giá gốc": p.basePrice || p.price || 0,
      "Giá KM": p.discountPrice || p.price || 0,
      "Tồn kho": p.stock || 0,
      "Trạng thái": p.status || "Draft",
      "Quy cách": p.specs || "",
      "Đóng gói": p.packaging || "",
      "Slug": p.slug || "",
    }));
    
    // Generate XLSX in browser - trigger download directly
    if (typeof window !== "undefined") {
      try {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 14 },
          { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "San Pham");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const filename = "san-pham-zbuild-" + new Date().toISOString().slice(0, 10) + ".xlsx";
        // Trigger browser download
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return {
          success: true,
          message: "Da xuat " + allP.length + " san pham ra file Excel: " + filename,
          total: allP.length,
          filename: filename
        };
      } catch (xerr) {
        console.warn("XLSX error:", xerr);
      }
    }
    
    return {
      success: true,
      message: "Da lay " + allP.length + " san pham (dang JSON, cai xlsx de xuat Excel).",
      total: allP.length,
      products: rows.slice(0, 20)
    };
  } catch (err) { return { error: "Lỗi xuất Excel: " + err.message }; }
}

async function syncPricesFromSheet({ sheet_url, match_field = "id" }) {
  try {
    if (!sheet_url || (!sheet_url.includes("docs.google.com") && !sheet_url.includes("spreadsheets"))) {
      return { error: "Link khong hop le. Vui long gui link Google Sheet (da publish CSV hoac share)." };
    }
    
    let csvUrl = sheet_url;
    const idMatch = sheet_url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      const sheetId = idMatch[1];
      const gidMatch = sheet_url.match(/gid=(\d+)/);
      csvUrl = "https://docs.google.com/spreadsheets/d/" + sheetId + "/export?format=csv" + (gidMatch ? "&gid=" + gidMatch[1] : "");
    }
    
    const res = await fetch(csvUrl);
    if (!res.ok) {
      return { error: "Khong the doc sheet. Hay dam bao sheet da duoc publish ra web (File -> Share -> Publish to web -> CSV)." };
    }
    const csvText = await res.text();
    
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { error: "Sheet trong hoac chi co 1 dong." };
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === "id" || h === "product_id" || h === "productid");
    const titleIdx = headers.findIndex(h => h === "title" || h === "ten" || h === "name" || h === "ten san pham");
    const priceIdx = headers.findIndex(h => h === "price" || h === "gia" || h === "base_price" || h === "discount_price" || h === "gia moi");
    const discountIdx = headers.findIndex(h => h === "discount_price" || h === "gia km" || h === "discount");
    
    if (match_field === "id" && idIdx === -1) {
      return { error: "Khong tim thay cot 'id' trong sheet. Dung match_field='title' de so khop theo ten, hoac them cot ID vao sheet." };
    }
    if (match_field === "title" && titleIdx === -1) {
      return { error: "Khong tim thay cot 'title' trong sheet. Dung match_field='id' de so khop theo ID." };
    }
    if (priceIdx === -1) {
      return { error: "Khong tim thay cot 'price/gia' trong sheet. Hay them cot gia." };
    }
    
    const snap = await getDocs(collection(db, "products"));
    const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let updated = 0;
    let notFound = 0;
    const updates = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const matchVal = (match_field === "id" ? cols[idIdx] : cols[titleIdx]) || "";
      if (!matchVal) continue;
      
      const priceVal = sanitizeNumber(cols[priceIdx]);
      if (priceVal <= 0) continue;
      
      let found;
      if (match_field === "id") {
        found = allProducts.find(p => p.id === matchVal || p.id.includes(matchVal));
      } else {
        found = allProducts.find(p => (p.title || "").toLowerCase().includes(matchVal.toLowerCase()));
      }
      
      if (found) {
        const update = { price: priceVal, basePrice: priceVal, updatedAt: new Date().toISOString() };
        if (discountIdx !== -1 && cols[discountIdx]) {
          const discVal = sanitizeNumber(cols[discountIdx]);
          if (discVal > 0) { update.discountPrice = discVal; update.price = discVal; }
        }
        await updateDoc(doc(db, "products", found.id), update);
        updates.push({ id: found.title, oldPrice: found.price, newPrice: update.price });
        updated++;
      } else {
        notFound++;
      }
    }
    
    return {
      success: true,
      message: "Da dong bo " + updated + " san pham" + (notFound > 0 ? ", " + notFound + " san pham khong tim thay" : "") + ".",
      updated: updated,
      not_found: notFound,
      changes: updates.slice(0, 10)
    };
  } catch (err) { return { error: "Lỗi đồng bộ giá từ sheet: " + err.message }; }
}

async function updateProduct({ product_name, new_title, category, price, stock, status, description, specs, packaging, weight, imageUrl }) {
  try {
    const snap = await getDocs(collection(db, "products"));
    const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const kw = (product_name || '').toLowerCase().trim();
    const matched = allProducts.filter(p => (p.title || '').toLowerCase().includes(kw));
    
    if (matched.length === 0) {
      return { success: false, error: `Không tìm thấy sản phẩm nào khớp với tên "${product_name}".` };
    }
    
    const updateData = { updatedAt: new Date().toISOString() };
    if (new_title !== undefined) {
      updateData.title = new_title;
      updateData.slug = slugify(new_title);
    }
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) {
      const pNum = sanitizeNumber(price);
      updateData.price = pNum;
      updateData.basePrice = pNum;
      updateData.discountPrice = pNum;
    }
    if (stock !== undefined) {
      updateData.stock = Number(stock);
      updateData.trackInventory = true;
    }
    if (status !== undefined) {
      const validStatuses = ["Draft", "Active", "Inactive"];
      updateData.status = validStatuses.find(s => s.toLowerCase() === status.toLowerCase()) || status;
    }
    if (description !== undefined) updateData.description = description;
    if (specs !== undefined) updateData.specs = specs;
    if (packaging !== undefined) updateData.packaging = packaging;
    if (weight !== undefined) updateData.weight = weight;
    if (imageUrl !== undefined && imageUrl !== "") {
      updateData.image = imageUrl;
      updateData.extraImages = [imageUrl];
    }
    
    await Promise.all(matched.map(p => updateDoc(doc(db, "products", p.id), updateData)));
    
    return {
      success: true,
      message: `Đã cập nhật thông tin cho ${matched.length} sản phẩm thành công!`,
      updated_products: matched.map(p => p.title)
    };
  } catch (err) {
    return { error: 'Lỗi cập nhật sản phẩm: ' + err.message };
  }
}

/**
 * Báo giá nhanh theo mét vuông (m2)
 * Tìm sản phẩm phù hợp, tính giá/m2 dựa trên specs thực tế
 * KHÔNG hardcode category — tự phân tích từ dữ liệu sản phẩm
 */
async function getM2Quotation({ projectType, area = 1, keyword = '' }) {
  try {
    const snap = await getDocs(collection(db, 'products'));
    let allProducts = snap.docs.map(d => ({ id: d.id, ...d.data(), name: d.data().title || '' }));

    const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

    // Lọc sản phẩm: active + KHÔNG phải vật tư phụ (vít, keo, thanh xương, bột...)
    const isMaterial = (name) => /vít|keo d[áa]n|thanh|xương|bột|ty treo|tắc kê|foam|sơn|băng keo|bông thủy tinh|ghim|đinh/i.test(name);
    
    let products = allProducts.filter(p => {
      if (p.status === 'Inactive' || !p.title) return false;
      const name = (p.title + ' ' + (p.category || '') + ' ' + (p.specs || '')).toLowerCase();
      if (isMaterial(name)) return false;

      // Nếu có keyword cụ thể → tìm chính xác
      if (keyword) {
        return name.includes(keyword.toLowerCase());
      }

      // Không có keyword → tìm theo loại công trình (chỉ dùng category gợi ý, không hardcode)
      if (projectType === 'Tất cả' || !projectType) return true;
      
      // Match linh hoạt: tìm trong category và title
      const typeWords = projectType.toLowerCase().split(/[\s,]+/);
      return typeWords.some(w => w.length > 2 && name.includes(w));
    });

    // Giới hạn kết quả
    products = products.slice(0, 10);

    if (products.length === 0) {
      // Fallback: bỏ filter project type, chỉ giữ filter vật tư phụ + active
      products = allProducts.filter(p => {
        if (p.status === 'Inactive' || !p.title) return false;
        const name = (p.title + ' ' + (p.category || '')).toLowerCase();
        return !isMaterial(name);
      }).slice(0, 8);

      if (products.length === 0) {
        return {
          success: true,
          markdown_response: `### Báo giá ${projectType || 'Sản phẩm'}\n\nChưa tìm thấy sản phẩm phù hợp trong hệ thống.\n\nVui lòng thử từ khóa khác hoặc liên hệ trực tiếp để được tư vấn.`
        };
      }
    }

    // Extract diện tích tấm từ specs để tính số tấm/m2
    const extractArea = (item) => {
      const str = `${item.specs || ''} ${item.name || ''}`;
      const matchMM = str.match(/(\d{3,4})\s*[xX*]\s*(\d{3,4})/);
      if (matchMM) {
        return (parseFloat(matchMM[1]) / 1000) * (parseFloat(matchMM[2]) / 1000);
      }
      return 2.9768; // Default: 1220x2440
    };



    const parsePrice = (price) => {
      if (typeof price === 'number') return price;
      if (typeof price === 'string') return parseFloat(price.replace(/[^0-9.-]+/g, "")) || 0;
      return 0;
    };

    let responseText = `### 📋 Báo Giá ${projectType}${keyword ? ' - ' + keyword : ''}${area > 1 ? ' (' + area + 'm²)' : ''}\n\n`;

    if (area > 1 && products.length > 0) {
      responseText += `Dưới đây là các sản phẩm phù hợp và chi phí ước tính cho diện tích **${area}m²**:\n\n`;
    }

    responseText += `| Sản Phẩm | Đơn Giá/m² | ${area > 1 ? 'Số Lượng' : 'KL/Tấm'} | ${area > 1 ? 'Thành Tiền' : 'Quy Cách'} | Tồn Kho |\n`;
    responseText += `| :--- | :--- | :--- | :--- | :--- |\n`;

    let cheapestProduct = null;
    let cheapestTotal = Infinity;

    products.forEach(p => {
      const panelArea = extractArea(p);
      const pricePerUnit = parsePrice(p.discountPrice || p.price || p.basePrice);
      const pricePerM2 = panelArea > 0 ? Math.round(pricePerUnit / panelArea) : pricePerUnit;
      const qty = area > 1 ? Math.ceil(area / panelArea) : 1;
      const lineTotal = pricePerUnit * qty;

      if (lineTotal < cheapestTotal) {
        cheapestTotal = lineTotal;
        cheapestProduct = p;
      }

      responseText += `| ${p.name} | ${formatCurrency(pricePerM2)} | ${area > 1 ? qty + ' tấm' : (p.weight || '-')} | ${area > 1 ? formatCurrency(lineTotal) : (p.specs || '-')} | ${p.stock > 0 ? '✅ ' + p.stock : '❌ Hết'} |\n`;
    });

    if (area > 1 && cheapestProduct) {
      responseText += `\n**💰 Tổng chi phí thấp nhất:** \`${formatCurrency(cheapestTotal)}\` với **${cheapestProduct.name}**\n`;
    }

    responseText += `\n> 💡 *Đây là báo giá theo m2. Để có bảng vật tư đầy đủ (kèm thanh xương, vít, keo...), hãy yêu cầu "tính vật tư chi tiết".*`;

    return {
      success: true,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: parsePrice(p.discountPrice || p.price || p.basePrice),
        stock: p.stock || 0
      })),
      markdown_response: responseText
    };
  } catch (err) {
    return { error: 'Lỗi báo giá m2: ' + err.message };
  }
}

// ============ FUNCTION EXECUTOR ============

export async function executeFunction(name, args) {
  let parsedArgs = args;
  if (typeof args === 'string') {
    try {
      parsedArgs = JSON.parse(args);
      } catch {
        try {
          // Fix unescaped newlines and tabs
          let sanitized = args.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
          parsedArgs = JSON.parse(sanitized);
        } catch {
        throw new Error("Lỗi tham số từ AI (JSON không hợp lệ). Vui lòng thử yêu cầu ngắn gọn hơn hoặc không dùng ngoặc kép trong nội dung.");
      }
    }
  }

  switch (name) {
    case 'update_product': return await updateProduct(parsedArgs);
    case 'search_products': return await searchProducts(parsedArgs);
    case 'get_product_detail': return await getProductDetail(parsedArgs);
    case 'count_products': return await countProducts(parsedArgs);
    case 'check_order_status': return await checkOrderStatus(parsedArgs);
    case 'get_order_history': return await getOrderHistory(parsedArgs);
    case 'generate_quotation': return await generateQuotation(parsedArgs);
    case 'add_to_cart_batch': return await addToCartBatch(parsedArgs);
    case 'get_store_stats': return await getStoreStats(parsedArgs);
    case 'calculate_construction_materials': return await calculateConstructionMaterials(parsedArgs);
    case 'get_m2_quotation': return await getM2Quotation(parsedArgs);
    case 'create_order': return await createOrder(parsedArgs);
    case 'create_product': return await createProduct(parsedArgs);
    case 'get_draft_products': return await getDraftProducts(parsedArgs);
    case 'update_product_details': return await updateProductDetails(parsedArgs);
    case 'update_product_stock': return await updateProductStock(parsedArgs);
        case "update_product_price": return await updateProductPrice(parsedArgs);
    case "update_product_status": return await updateProductStatus(parsedArgs);
    case "delete_product": return await deleteProduct(parsedArgs);
    case "update_order_status": return await updateOrderStatus(parsedArgs);
    case "get_customer_info": return await getCustomerInfo(parsedArgs);
    case "manage_coupon": return await manageCoupon(parsedArgs);
    case "analyze_youtube_link": return await analyzeYouTubeLink(parsedArgs);
    case "export_products_excel": return await exportProductsExcel(parsedArgs);
    case "sync_prices_from_sheet": return await syncPricesFromSheet(parsedArgs);
    default: return { error: `Function "${name}" không tồn tại` };
  }
}
