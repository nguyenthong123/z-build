import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Fuse from 'fuse.js';

const extractAreaFromSpecs = (str) => {
  if (!str) return null;
  const matchMM = str.match(/(\d{3,4})\s*[xX*]\s*(\d{3,4})/);
  if (matchMM) {
    const w = parseFloat(matchMM[1]) / 1000;
    const l = parseFloat(matchMM[2]) / 1000;
    return w * l;
  }
  const matchM = str.match(/(\d+\.?\d*)\s*[xX*]\s*(\d+\.?\d*)/);
  if (matchM) {
    const w = parseFloat(matchM[1]);
    const l = parseFloat(matchM[2]);
    if (w < 10 && l < 10) return w * l; 
  }
  return null;
};

const extractWeight = (item) => {
  if (item.weight) {
    const w = parseFloat(item.weight.toString().replace(/[^\d.]/g, ''));
    if (!isNaN(w) && w > 0) return w;
  }
  const str = `${item.name} ${item.specs || ''}`;
  const match = str.match(/(\d+\.?\d*)\s*kg/i);
  if (match) return parseFloat(match[1]);
  return 0;
};

const NORMS = {
  "Trần thả": {
    "name": "Hệ trần nổi (605x1210)",
    "wastage": 0.05,
    "variants": {
      "60x60": {
        "label": "Hộp vuông 60x60 (cắt đôi tấm 605x1210)",
        "description": "Mỗi tấm 605x1210 cắt thành 2 tấm 605x605. 1 tấm = 2 hộp vuông. Cần thêm thanh phụ 600.",
        "panelMultiplier": 0.5, // 1 tấm 605x1210 = 2 tấm 605x605
        "extraNote": "⚠️ Tấm 605x1210 sẽ được cắt đôi tại công trình. Hao hụt cắt cao hơn."
      },
      "60x120": {
        "label": "Hộp chữ nhật 60x120 (nguyên tấm 605x1210)",
        "description": "Dùng nguyên tấm 605x1210, không cắt. Tiết kiệm nhân công, ít hao hụt.",
        "panelMultiplier": 1, // 1 tấm = 1 ô
        "extraNote": ""
      }
    },
    "required": [
      { "keyword": "thanh chính trần thả", "searchTerms": ["thanh chính", "xương chính", "t3600"], "unit": "thanh", "norm": 0.23, "label": "Thanh chính (3.66m)" },
      { "keyword": "thanh phụ 1.2", "searchTerms": ["thanh phụ 12", "thanh phụ 1.2", "t1200"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (1.22m)" },
      { "keyword": "thanh phụ 0.6", "searchTerms": ["thanh phụ 60", "thanh phụ 0.6", "t600"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (0.61m)", "note": "Dùng nhiều hơn khi thả 60x60" },
      { "keyword": "thanh viền tường", "searchTerms": ["viền tường", "thanh v", "v góc"], "unit": "thanh", "norm": 0.2, "label": "Thanh viền V (3m)" },
      { "keyword": "tấm trần thả", "searchTerms": ["tấm trần thả", "tấm 605", "605x1210", "tấm ánh kim", "thạch cao in hoa văn"], "unit": "tấm", "isPanel": true, "defaultArea": 0.732, "label": "Tấm trần trang trí (605x1210)" },
      { "keyword": "ty treo", "searchTerms": ["ty treo", "tắc kê", "tăng đơ", "phụ kiện"], "unit": "bộ", "norm": 0.6, "label": "Vật tư phụ (Ty treo, tắc kê)" }
    ]
  },
  "Trần chìm": {
    "name": "Hệ trần chìm (Thạch cao)",
    "wastage": 0.08,
    "required": [
      { "keyword": "khung chìm", "searchTerms": ["xương chìm", "khung chìm", "u chìm"], "unit": "thanh", "norm": 0.8, "label": "Khung xương trần chìm (U chính & U phụ)" },
      { "keyword": "v góc chìm", "searchTerms": ["v chìm", "viền tường", "v góc"], "unit": "thanh", "norm": 0.2, "label": "Thanh viền V góc" },
      { "keyword": "tấm thạch cao", "searchTerms": ["tấm thạch cao", "gyproc"], "unit": "tấm", "isPanel": true, "defaultArea": 2.9768, "label": "Tấm thạch cao" },
      { "keyword": "vít thạch cao", "searchTerms": ["vít thạch cao", "vít đen"], "unit": "con", "norm": 20, "label": "Vít chuyên dụng" },
      { "keyword": "bột xử lý mối nối", "searchTerms": ["bột xử lý", "gyp-filler", "bột trét"], "unit": "kg", "norm": 0.15, "label": "Bột xử lý mối nối" }
    ]
  },
  "Vách ngăn": {
    "name": "Hệ vách ngăn",
    "wastage": 0.08,
    "required": [
      { "keyword": "khung vách ngăn", "searchTerms": ["xương vách", "khung vách", "u âm", "u dương"], "unit": "thanh", "norm": 0.7, "label": "Khung xương vách" },
      { "keyword": "tấm thạch cao", "searchTerms": ["tấm thạch cao", "gyproc"], "unit": "tấm", "isPanel": true, "multiplier": 2, "defaultArea": 2.9768, "label": "Tấm thạch cao (2 mặt)" },
      { "keyword": "vít", "searchTerms": ["vít thạch cao"], "unit": "con", "norm": 30, "label": "Vít chuyên dụng" },
      { "keyword": "keo silicon", "searchTerms": ["keo silicon", "keo apollo", "silicone"], "unit": "chai", "norm": 0.1, "label": "Keo Silicon" },
      { "keyword": "foam trám", "searchTerms": ["foam", "bọt nở", "pu foam"], "unit": "chai", "norm": 0.08, "label": "Foam trám hở" }
    ]
  },
  "Sàn nhẹ": {
    "name": "Hệ sàn nhẹ DuraFlex",
    "wastage": 0.05,
    "required": [
      { "keyword": "tấm duraflex sàn", "searchTerms": ["duraflex", "cemboard", "tấm xi măng", "làm sàn"], "unit": "tấm", "isPanel": true, "defaultArea": 2.9768, "label": "Tấm DuraFlex làm sàn" },
      { "keyword": "sắt hộp", "searchTerms": ["sắt hộp", "khung sắt", "thép hộp"], "unit": "m", "norm": 3.7, "label": "Hệ khung sắt hộp" },
      { "keyword": "vít sàn", "searchTerms": ["vít sàn", "vít tự khoan", "vít cánh chim"], "unit": "con", "norm": 25, "label": "Vít sàn chuyên dụng" },
      { "keyword": "sơn sắt", "searchTerms": ["sơn sắt", "sơn chống rỉ", "sơn mạ kẽm"], "unit": "kg", "norm": 0.07, "label": "Sơn chống rỉ (khung sắt)" },
      { "keyword": "keo silicon", "searchTerms": ["keo silicon", "apollo", "silicone"], "unit": "chai", "norm": 0.1, "label": "Keo xử lý mối nối" }
    ]
  },
  "Sơn tường": {
    "name": "Hệ Sơn Tường (Lót & Phủ)",
    "wastage": 0.05,
    "required": [
      { "keyword": "bột bả", "searchTerms": ["bột bả", "bột trét", "mastic", "jotun", "dulux"], "unit": "bao", "norm": 0.025, "label": "Bột bả tường (Bao 40kg, định mức ~1.2kg/m2)" },
      { "keyword": "sơn lót", "searchTerms": ["sơn lót", "kháng kiềm", "primer"], "unit": "thùng", "norm": 0.006, "label": "Sơn lót kháng kiềm (Thùng 18L, ~150m2/thùng)" },
      { "keyword": "sơn phủ", "searchTerms": ["sơn phủ", "sơn nội thất", "sơn ngoại thất", "sơn bóng"], "unit": "thùng", "norm": 0.012, "label": "Sơn phủ (Thùng 18L, ~80m2/thùng/2 lớp)" },
      { "keyword": "con lăn", "searchTerms": ["con lăn", "rulo", "cọ sơn"], "unit": "cái", "norm": 0.02, "label": "Rulo/Con lăn sơn" }
    ]
  },
  "Ốp tường": {
    "name": "Hệ Ốp Tường Nhựa (Lam sóng / Nano)",
    "wastage": 0.05,
    "required": [
      { "keyword": "tấm ốp tường", "searchTerms": ["tấm nano", "lam sóng", "nhựa giả gỗ", "pvc vân đá"], "unit": "tấm", "isPanel": true, "defaultArea": 1.2, "label": "Tấm ốp tường (Nano / Lam sóng)" },
      { "keyword": "keo dán", "searchTerms": ["keo titebond", "silicone", "keo dán tấm ốp", "keo dán gỗ"], "unit": "chai", "norm": 0.15, "label": "Keo dán chuyên dụng (Titebond/Silicone)" },
      { "keyword": "ke bát", "searchTerms": ["ke bát", "ke inox", "ngàm inox", "con ke"], "unit": "cái", "norm": 3, "label": "Ke/Ngàm Inox (giữ tấm)" },
      { "keyword": "vít", "searchTerms": ["vít tự khoan", "vít", "đinh"], "unit": "con", "norm": 5, "label": "Vít gắn ke" },
      { "keyword": "phào chỉ", "searchTerms": ["phào", "chỉ", "len chân tường", "nẹp"], "unit": "thanh", "norm": 0.2, "label": "Phào chỉ / Nẹp viền trang trí" }
    ]
  },
  "Sơn sắt": {
    "name": "Hệ Sơn Sắt / Kim Loại",
    "wastage": 0.05,
    "required": [
      { "keyword": "sơn chống rỉ", "searchTerms": ["sơn lót sắt", "chống rỉ", "sơn mạ kẽm"], "unit": "kg", "norm": 0.15, "label": "Sơn lót chống rỉ (Định mức ~6-7m2/kg)" },
      { "keyword": "sơn sắt phủ", "searchTerms": ["sơn sắt", "sơn dầu", "sơn kim loại", "sơn phủ sắt"], "unit": "kg", "norm": 0.15, "label": "Sơn phủ màu kim loại" },
      { "keyword": "dung môi pha sơn", "searchTerms": ["dung môi", "xăng thơm", "thinner"], "unit": "lít", "norm": 0.03, "label": "Dung môi / Xăng pha sơn (Tỷ lệ 10-20%)" },
      { "keyword": "cọ sơn", "searchTerms": ["cọ", "chổi sơn", "rulo lăn sơn sắt"], "unit": "cái", "norm": 0.05, "label": "Cọ quét / Rulo nhỏ" }
    ]
  }
};

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  if (typeof priceStr === 'number') return priceStr;
  const clean = priceStr.toString().replace(/[^\d]/g, '');
  return parseInt(clean) || 0;
};

export const calculateConstructionMaterials = async ({ projectType, area, tileLayout, customerPreferences }) => {
  const system = NORMS[projectType];
  if (!system) return { error: `Không tìm thấy loại công trình "${projectType}". Các loại hợp lệ: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ, Sơn tường, Ốp tường, Sơn sắt.` };

  // Xác định kiểu thả (chỉ áp dụng cho Trần thả)
  let variant = null;
  if (system.variants) {
    variant = system.variants[tileLayout] || system.variants['60x120']; // Mặc định 60x120 nếu không chỉ định
  }

  try {
    const snap = await getDocs(collection(db, 'products'));
    const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), name: doc.data().title || '' }));

    const formatCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';

    let totalAmount = 0;
    let totalWeight = 0;
    const materials = [];

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
      let highestScore = Infinity; 

      const queriesToTry = [req.keyword, ...(req.searchTerms || [])];
      
      for (const q of queriesToTry) {
        const results = fuse.search(q);
        if (results.length > 0) {
          // Lọc: loại bỏ sản phẩm bán theo m2 và sản phẩm không phải vật tư xây dựng
          const materialResults = results.filter(r => {
            const item = r.item;
            // Bỏ qua sản phẩm đã ngừng bán
            const isInactive = item.status && item.status.toString().toLowerCase().includes("inactive");
            if (isInactive) return false;
            // Bỏ qua sản phẩm bán theo m2 (tấm ốp trang trí, sàn gỗ...)
            const isPerM2 = (item.pricing_type === 'per_m2' || item.sell_by === 'm2' || item.unit === 'm2');
            if (isPerM2) return false;
            return true;
          });
          const targetResults = materialResults.length > 0 ? materialResults : results.filter(r => {
            const isInactive = r.item.status && r.item.status.toString().toLowerCase().includes("inactive");
            return !isInactive;
          });
          
          if (targetResults.length > 0) {
             // Boost score for items matching customerPreferences
             if (customerPreferences) {
               targetResults.forEach(r => {
                 const prefLower = customerPreferences.toLowerCase();
                 const nameLower = r.item.name.toLowerCase();
                 // If the item name contains any key word from preferences, improve score (lower is better in Fuse)
                 const prefWords = prefLower.split(/[\s,]+/);
                 let matches = 0;
                 prefWords.forEach(w => {
                   if (w.length > 2 && nameLower.includes(w)) matches++;
                 });
                 if (matches > 0) {
                   r.score = r.score / (1 + (matches * 0.8)); // drastically improve score
                 }
               });
               // Re-sort after boosting
               targetResults.sort((a, b) => a.score - b.score);
             }

             if (targetResults[0].score < highestScore) {
               highestScore = targetResults[0].score;
               bestMatch = targetResults[0].item;
             }
          }
        }
      }

      let theoreticalQty = 0;
      if (req.isPanel) {
        const panelArea = extractAreaFromSpecs(bestMatch?.specs || bestMatch?.name) || req.defaultArea;
        // Nếu có variant (vd: 60x60), mỗi tấm tạo ra 1/multiplier tấm nhỏ
        const multiplier = variant ? variant.panelMultiplier : 1;
        const effectiveArea = panelArea * multiplier; // Diện tích thực mỗi tấm sau khi cắt
        theoreticalQty = (area * (req.multiplier || 1)) / effectiveArea;
        
      } else {
        if (projectType === "Trần thả" && req.label.includes("0.61m")) {
          // Nếu hệ trần 60x120 (panelMultiplier === 1), KHÔNG DÙNG thanh phụ 0.6m
          if (variant && variant.panelMultiplier === 1) {
            theoreticalQty = 0;
          } else {
            theoreticalQty = area * req.norm;
          }
        } else {
          theoreticalQty = area * req.norm;
        }
      }

      // Bỏ qua vật tư nếu số lượng lý thuyết = 0 (ví dụ thanh phụ 0.6m của hệ 60x120)
      if (theoreticalQty === 0 && !req.isPanel) {
        return; // Dùng 'return' trong forEach giống như 'continue'
      }

      const qtyWithWastage = theoreticalQty * (1 + system.wastage);

      let quantity = qtyWithWastage;
      if (["tấm", "thanh", "bộ", "cuộn", "con", "chai", "lon"].includes(req.unit)) {
        quantity = Math.ceil(qtyWithWastage);
      } else {
        quantity = Math.round(qtyWithWastage * 100) / 100;
      }

      const unitPrice = bestMatch ? parsePrice(bestMatch.discountPrice || bestMatch.price || bestMatch.basePrice) : 0;
      const lineTotal = unitPrice * quantity;
      
      const unitWeight = bestMatch ? extractWeight(bestMatch) : 0;
      const lineWeight = unitWeight * quantity;

      materials.push({
        name: bestMatch ? bestMatch.name : `(Vật tư: ${req.label})`,
        specs: bestMatch ? (bestMatch.specs || "-") : "-",
        quantity: quantity,
        unit: req.unit,
        price: unitPrice > 0 ? formatCurrency(unitPrice) : "Liên hệ báo giá",
        total: unitPrice > 0 ? formatCurrency(lineTotal) : "Liên hệ báo giá",
        weight: lineWeight > 0 ? `${Math.round(lineWeight * 100)/100} kg` : "-",
        status: bestMatch ? "Có thể cung cấp" : "Chưa có trên hệ thống",
        note: req.note || ''
      });

      totalAmount += lineTotal;
      totalWeight += lineWeight;
    });

    let responseText = `### Bảng Dự Toán Vật Tư ${projectType} ${area}m²${variant ? ' — ' + variant.label : ''}\n\n`;
    if (variant?.extraNote) {
      responseText += `> ${variant.extraNote}\n\n`;
    }
    responseText += `| Tên Sản Phẩm | Quy Cách | Số Lượng | Đơn Vị | Đơn Giá (VNĐ) | Thành Tiền (VNĐ) | Trọng Lượng |\n`;
    responseText += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    
    materials.forEach(m => {
      responseText += `| ${m.name} | ${m.specs} | ${m.quantity} | ${m.unit} | ${m.price} | ${m.total} | ${m.weight} |\n`;
    });

    responseText += `\n**💰 Tổng chi phí dự kiến:** \`${formatCurrency(totalAmount)}\`\n`;
    if (totalWeight > 0) {
      responseText += `**⚖️ Tổng trọng lượng ước tính:** \`${Math.round(totalWeight * 100)/100} kg\` (Phục vụ xếp xe vận chuyển)\n`;
    }
    responseText += `\n*Lưu ý: Báo giá trên đã bao gồm hệ số hao hụt tiêu chuẩn (${system.wastage * 100}% đối với ${projectType.toLowerCase()}).*\n\n`;
    
    return {
      success: true,
      data: materials,
      total_amount: formatCurrency(totalAmount),
      total_weight_kg: totalWeight,
      markdown_response: responseText
    };

  } catch (error) {
    return { error: 'Lỗi tính toán vật tư: ' + error.message };
  }
};
