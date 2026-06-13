import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const NORMS = {
  "Trần thả": {
    "name": "Hệ trần nổi (605x1210)",
    "required": [
      { "keyword": "thanh chính", "unit": "thanh", "norm": 0.23, "label": "Thanh chính (3.66m)" },
      { "keyword": "thanh phụ 1.2", "searchTerms": ["thanh phụ 12", "thanh phụ 1.2"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (1.22m)" },
      { "keyword": "thanh phụ 0.6", "searchTerms": ["thanh phụ 60", "thanh phụ 0.6"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (0.61m)" },
      { "keyword": "thanh viền tường", "unit": "thanh", "norm": 0.2, "label": "Thanh viền V (3m)" },
      { "keyword": "tấm trần thả", "unit": "tấm", "norm": 1.37, "label": "Tấm trần trang trí (605x1210)" },
      { "keyword": "phụ kiện trần thả", "unit": "bộ", "norm": 0.6, "label": "Vật tư phụ (Ty treo, tắc kê)" }
    ]
  },
  "Trần chìm": {
    "name": "Hệ trần chìm (Thạch cao)",
    "required": [
      { "keyword": "khung trần chìm", "unit": "thanh", "norm": 1.9, "label": "Khung xương trần chìm" },
      { "keyword": "thanh viền tường", "unit": "thanh", "norm": 0.4, "label": "Thanh viền V" },
      { "keyword": "tấm thạch cao", "unit": "tấm", "norm": 0.35, "label": "Tấm thạch cao" },
      { "keyword": "vít thạch cao", "unit": "con", "norm": 20, "label": "Vít chuyên dụng" },
      { "keyword": "bột xử lý", "unit": "kg", "norm": 0.5, "label": "Bột xử lý mối nối" }
    ]
  },
  "Vách ngăn": {
    "name": "Hệ vách ngăn",
    "required": [
      { "keyword": "khung vách ngăn", "unit": "thanh", "norm": 0.7, "label": "Khung xương vách" },
      { "keyword": "tấm thạch cao", "unit": "tấm", "norm": 0.7, "label": "Tấm thạch cao (2 mặt)" },
      { "keyword": "vít", "unit": "con", "norm": 30, "label": "Vít chuyên dụng" }
    ]
  },
  "Sàn nhẹ": {
    "name": "Hệ sàn nhẹ DuraFlex",
    "required": [
      { "keyword": "tấm duraflex", "unit": "tấm", "norm": 0.35, "label": "Tấm DuraFlex làm sàn" },
      { "keyword": "khung sắt", "unit": "m", "norm": 3.7, "label": "Hệ khung sắt hộp" },
      { "keyword": "vít sàn", "unit": "con", "norm": 25, "label": "Vít sàn chuyên dụng" }
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
    const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), name: doc.data().title })); // Tương thích name/title

    const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

    let totalAmount = 0;
    const materials = [];

    system.required.forEach(req => {
      const searchQueries = req.searchTerms || [req.keyword];
      let bestMatch = null;
      let highestScore = 0;

      for (const q of searchQueries) {
        const queryWords = q.toLowerCase().split(/\s+/);

        for (const p of allProducts) {
          const name = (p.name || "").toLowerCase();
          const category = (p.category || "").toLowerCase();
          const specs = (p.specs || "").toLowerCase();
          const fullText = `${name} ${category} ${specs}`;

          if (queryWords.every(w => fullText.includes(w))) {
            let score = 10;
            queryWords.forEach(w => {
              if (name.includes(w)) score += 5;
              if (specs.includes(w)) score += 2;
            });
            if (p.status && p.status.toString().toLowerCase().includes("active")) score += 3;
            if (p.price && p.price !== 0) score += 2;

            if (score > highestScore) {
              highestScore = score;
              bestMatch = p;
            }
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
        status: bestMatch ? (bestMatch.stock > 0 ? "Sẵn hàng" : "Hết hàng") : "Chưa có trên hệ thống",
      });

      totalAmount += lineTotal;
    });

    // Formatting markdown response similar to bot_zbuid
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
