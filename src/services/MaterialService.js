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
    "required": [
      { "keyword": "thanh chính trần thả", "searchTerms": ["thanh chính", "xương chính", "t3600"], "unit": "thanh", "norm": 0.23, "label": "Thanh chính (3.66m)" },
      { "keyword": "thanh phụ 1.2", "searchTerms": ["thanh phụ 12", "thanh phụ 1.2", "t1200"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (1.22m)" },
      { "keyword": "thanh phụ 0.6", "searchTerms": ["thanh phụ 60", "thanh phụ 0.6", "t600"], "unit": "thanh", "norm": 1.37, "label": "Thanh phụ (0.61m)" },
      { "keyword": "thanh viền tường", "searchTerms": ["viền tường", "thanh v", "v góc"], "unit": "thanh", "norm": 0.2, "label": "Thanh viền V (3m)" },
      { "keyword": "tấm trần thả", "searchTerms": ["tấm trần thả", "tấm 605", "605x1210", "tấm ánh kim", "thạch cao in hoa văn"], "unit": "tấm", "isPanel": true, "defaultArea": 0.732, "label": "Tấm trần trang trí" },
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

      let theoreticalQty = 0;
      if (req.isPanel) {
        const panelArea = extractAreaFromSpecs(bestMatch?.specs || bestMatch?.name) || req.defaultArea;
        theoreticalQty = (area * (req.multiplier || 1)) / panelArea;
      } else {
        theoreticalQty = area * req.norm;
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
        price: formatCurrency(unitPrice),
        total: formatCurrency(lineTotal),
        weight: lineWeight > 0 ? `${Math.round(lineWeight * 100)/100} kg` : "-",
        status: bestMatch ? (bestMatch.stock > 0 || bestMatch.stock === undefined ? "Sẵn hàng" : "Hết hàng") : "Chưa có trên hệ thống",
      });

      totalAmount += lineTotal;
      totalWeight += lineWeight;
    });

    let responseText = `### Bảng Dự Toán Vật Tư ${projectType} ${area}m²\n\n`;
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
