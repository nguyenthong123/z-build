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
      { "keyword": "khung trần chìm", "searchTerms": ["xương chìm", "khung chìm", "basi", "tika"], "unit": "thanh", "norm": 1.9, "label": "Khung xương trần chìm" },
      { "keyword": "thanh viền tường", "searchTerms": ["viền tường", "thanh v"], "unit": "thanh", "norm": 0.4, "label": "Thanh viền V" },
      { "keyword": "tấm thạch cao", "searchTerms": ["tấm thạch cao", "gyproc", "yoshino", "boral"], "unit": "tấm", "isPanel": true, "defaultArea": 2.9768, "label": "Tấm thạch cao" },
      { "keyword": "vít thạch cao", "searchTerms": ["vít thạch cao", "vít đen"], "unit": "con", "norm": 20, "label": "Vít chuyên dụng" },
      { "keyword": "bột xử lý mối nối", "searchTerms": ["bột xử lý", "gyp-filler", "bột trét"], "unit": "kg", "norm": 0.5, "label": "Bột xử lý mối nối" }
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
  }
};

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  if (typeof priceStr === 'number') return priceStr;
  const clean = priceStr.toString().replace(/[^\d]/g, '');
  return parseInt(clean) || 0;
};

export const getConsultationFramework = async ({ projectType }) => {
  const pt = projectType?.toLowerCase() || '';
  
  if (pt.includes('thả')) {
    return { 
      success: true, 
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm TRẦN THẢ. Bạn BẮT BUỘC phải hỏi khách 2 thông tin này trước khi tính vật tư: 1. Diện tích cần thi công là bao nhiêu m2? 2. Khách muốn dùng hệ thả 60x60 (cắt đôi tấm) hay 60x120 (nguyên tấm)? 3. Khách ưu tiên tấm thạch cao hay tấm nhựa ánh kim? Khi khách trả lời đủ, hãy dùng calculate_construction_materials với tileLayout tương ứng."
    };
  }
  if (pt.includes('chìm')) {
    return {
      success: true,
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm TRẦN CHÌM. BẮT BUỘC hỏi khách: 1. Diện tích trần bao nhiêu m2? 2. Có ưu tiên thương hiệu thạch cao nào không (Gyproc, Vĩnh Tường, Boral...)? 3. Khung xương thường hay khung xương cao cấp? Khi có đủ thông tin, dùng calculate_construction_materials."
    };
  }
  if (pt.includes('vách') || pt.includes('ngăn')) {
    return {
      success: true,
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm VÁCH NGĂN. BẮT BUỘC hỏi khách: 1. Diện tích vách bao nhiêu m2? 2. Có yêu cầu cách âm hay chống cháy không? Khách chưa trả lời thì không tính toán bừa."
    };
  }
  if (pt.includes('sàn')) {
    return {
      success: true,
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm SÀN NHẸ. BẮT BUỘC hỏi khách: 1. Diện tích sàn? 2. Có cần chịu tải trọng nặng không (để tư vấn độ dày tấm)? Không tự tính toán nếu chưa có diện tích."
    };
  }
  if (pt.includes('sơn')) {
    return {
      success: true,
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm SƠN TƯỜNG. BẮT BUỘC hỏi khách: 1. Diện tích mặt tường cần sơn? 2. Sơn nội thất hay ngoại thất? 3. Có dùng bột bả không?"
    };
  }
  if (pt.includes('ốp')) {
    return {
      success: true,
      instruction: "MẬT LỆNH CHO AI: Khách đang quan tâm ỐP TƯỜNG. BẮT BUỘC hỏi khách: 1. Diện tích tường cần ốp? 2. Dùng Tấm Nano phẳng hay Tấm Lam sóng? Khi khách trả lời đủ, gọi calculate_construction_materials."
    };
  }

  return {
    success: true,
    instruction: "MẬT LỆNH CHO AI: Không rõ khách muốn làm hạng mục gì. BẠN PHẢI HỎI KHÁCH: 'Anh/chị muốn thi công hạng mục gì (Trần, Vách, Sàn, Sơn hay Ốp tường) và diện tích khoảng bao nhiêu ạ?'"
  };
};

export const calculateConstructionMaterials = async ({ projectType, area, tileLayout }) => {
  if (projectType?.toLowerCase() === 'trần') {
    return { error: 'LỖI: projectType không được là "Trần". Bạn HÃY HỎI LẠI khách hàng xem họ muốn làm "Trần thả" hay "Trần chìm" để có bảng vật tư chính xác nhất.' };
  }

  const system = NORMS[projectType];
  if (!system) return { error: `Không tìm thấy loại công trình "${projectType}". Các loại hợp lệ: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ.` };

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
          if (targetResults.length > 0 && targetResults[0].score < highestScore) {
             highestScore = targetResults[0].score;
             bestMatch = targetResults[0].item;
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
