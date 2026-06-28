import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Fuse from 'fuse.js';

const NORMS = {
  "Trần thả": {
    "name": "Hệ trần nổi (605x1210)",
    "required": [
      { "keyword": "thanh chính trần thả", "searchTerms": ["thanh chính", "xương chính", "t3600"], "unit": "thanh", "norm": 0.23, "label": "Thanh chính (3.66m)" },
      { "keyword": "thanh phụ 1.2", "searchTerms": ["thanh phụ 12", "thanh phụ 1.2", "t1200"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (1.22m)" },
      { "keyword": "thanh phụ 0.6", "searchTerms": ["thanh phụ 60", "thanh phụ 0.6", "t600"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (0.61m)" },
      { "keyword": "thanh viền tường", "searchTerms": ["viền tường", "thanh v", "v góc"], "unit": "thanh", "norm": 0.2, "label": "Thanh viền V (3m)" },
      { "keyword": "tấm trần thả", "searchTerms": ["tấm trần thả", "tấm 605", "605x1210"], "unit": "tấm", "norm": 1.37, "label": "Tấm trần trang trí (605x1210)" },
      { "keyword": "ty treo", "searchTerms": ["ty treo", "tắc kê", "tăng đơ", "phụ kiện"], "unit": "bộ", "norm": 0.6, "label": "Vật tư phụ (Ty treo, tắc kê)" }
    ]
  },
  "Trần chìm": {
    "name": "Hệ trần chìm (Thạch cao)",
    "required": [
      { "keyword": "khung trần chìm", "searchTerms": ["xương chìm", "khung chìm", "basi", "tika"], "unit": "thanh", "norm": 1.9, "label": "Khung xương trần chìm" },
      { "keyword": "thanh viền tường", "searchTerms": ["viền tường", "thanh v"], "unit": "thanh", "norm": 0.4, "label": "Thanh viền V" },
      { "keyword": "tấm thạch cao", "searchTerms": ["tấm thạch cao", "gyproc", "yoshino", "boral"], "unit": "tấm", "norm": 0.35, "label": "Tấm thạch cao" },
      { "keyword": "vít thạch cao", "searchTerms": ["vít thạch cao", "vít đen"], "unit": "con", "norm": 20, "label": "Vít chuyên dụng" },
      { "keyword": "bột xử lý mối nối", "searchTerms": ["bột xử lý", "gyp-filler", "bột trét"], "unit": "kg", "norm": 0.5, "label": "Bột xử lý mối nối" }
    ]
  },
  "Vách ngăn": {
    "name": "Hệ vách ngăn",
    "required": [
      { "keyword": "khung vách ngăn", "searchTerms": ["xương vách", "khung vách", "u âm", "u dương"], "unit": "thanh", "norm": 0.7, "label": "Khung xương vách" },
      { "keyword": "tấm thạch cao", "searchTerms": ["tấm thạch cao", "gyproc"], "unit": "tấm", "norm": 0.7, "label": "Tấm thạch cao (2 mặt)" },
      { "keyword": "vít", "searchTerms": ["vít thạch cao"], "unit": "con", "norm": 30, "label": "Vít chuyên dụng" }
    ]
  },
  "Sàn nhẹ": {
    "name": "Hệ sàn nhẹ DuraFlex",
    "required": [
      { "keyword": "tấm duraflex sàn", "searchTerms": ["duraflex", "cemboard", "tấm xi măng", "làm sàn"], "unit": "tấm", "norm": 0.35, "label": "Tấm DuraFlex làm sàn" },
      { "keyword": "sắt hộp", "searchTerms": ["sắt hộp", "khung sắt", "thép hộp"], "unit": "m", "norm": 3.7, "label": "Hệ khung sắt hộp" },
      { "keyword": "vít sàn", "searchTerms": ["vít sàn", "vít tự khoan", "vít cánh chim"], "unit": "con", "norm": 25, "label": "Vít sàn chuyên dụng" }
    ]
  }
};

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  if (typeof priceStr === 'number') return priceStr;
  const clean = priceStr.toString().replace(/[^\d]/g, '');
  return parseInt(clean) || 0;
};

export const calculateConstructionMaterials = async ({ projectType, area }) => {
  const system = NORMS[projectType];
  if (!system) return { error: `Không tìm thấy loại công trình "${projectType}". Các loại hợp lệ: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ.` };

  try {
    const snap = await getDocs(collection(db, 'products'));
    const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), name: doc.data().title || '' }));

    const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

    let totalAmount = 0;
    const materials = [];

    // Initialize Fuse with all products
    const fuse = new Fuse(allProducts, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'category', weight: 0.2 },
        { name: 'specs', weight: 0.2 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true
    });

    system.required.forEach(req => {
      let bestMatch = null;
      let highestScore = Infinity; // For fuse, lower score is better (0 is perfect)

      // We search using the main keyword and searchTerms
      const queriesToTry = [req.keyword, ...(req.searchTerms || [])];
      
      for (const q of queriesToTry) {
        const results = fuse.search(q);
        if (results.length > 0) {
          // Filter out inactive products if possible, or heavily penalize them
          const activeResults = results.filter(r => {
             const isInactive = r.item.status && r.item.status.toString().toLowerCase().includes("inactive");
             return !isInactive;
          });
          
          const targetResults = activeResults.length > 0 ? activeResults : results;
          
          if (targetResults[0].score < highestScore) {
             highestScore = targetResults[0].score;
             bestMatch = targetResults[0].item;
          }
        }
      }

      let quantity = area * req.norm;
      if (["tấm", "thanh", "bộ", "cuộn", "con"].includes(req.unit)) {
        quantity = Math.ceil(quantity);
      } else {
        quantity = Math.round(quantity * 100) / 100;
      }

      const unitPrice = bestMatch ? parsePrice(bestMatch.discountPrice || bestMatch.price || bestMatch.basePrice) : 0;
      const lineTotal = unitPrice * quantity;

      materials.push({
        name: bestMatch ? bestMatch.name : `(Vật tư: ${req.label})`,
        quantity: quantity,
        unit: req.unit,
        price: formatCurrency(unitPrice),
        total: formatCurrency(lineTotal),
        status: bestMatch ? (bestMatch.stock > 0 || bestMatch.stock === undefined ? "Sẵn hàng" : "Hết hàng") : "Chưa có trên hệ thống",
      });

      totalAmount += lineTotal;
    });

    let responseText = `### Bảng Dự Toán Vật Tư ${projectType} ${area}m²\n\n`;
    responseText += `| Tên Sản Phẩm | Số Lượng | Đơn Vị | Đơn Giá (VNĐ) | Thành Tiền (VNĐ) | Trạng Thái |\n`;
    responseText += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    
    materials.forEach(m => {
      responseText += `| ${m.name} | ${m.quantity} | ${m.unit} | ${m.price} | ${m.total} | ${m.status} |\n`;
    });

    responseText += `\n**Tổng chi phí vật tư dự kiến: ${formatCurrency(totalAmount)}**\n\n`;
    responseText += `*Lưu ý: Báo giá trên dựa trên định mức kỹ thuật tiêu chuẩn của Tâm An. Hao hụt thi công ước tính 5-10% chưa được tính vào bảng này.*\n\n`;
    
    return {
      success: true,
      data: materials,
      total_amount: formatCurrency(totalAmount),
      markdown_response: responseText
    };

  } catch (error) {
    return { error: 'Lỗi tính toán vật tư: ' + error.message };
  }
};
