import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { ADMIN_AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';
import { apiTriggerAiBulkEnrich, apiSendAdminAiMessage } from '../services/sqliteApi';

/**
 * Custom hook to manage AI Advisor state and logic (Admin).
 * 
 * Ảnh chat không còn upload lên Cloudinary — dùng blob URL local.
 * Cleanup ảnh rác Cloudinary nên làm bằng script server-side:
 *   scripts/cleanup_cloudinary.js
 */
export const useAdminAI = () => {
  const storageKey = `zbuild_ai_messages_admin`;
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        let parsed = JSON.parse(saved);
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        // Chỉ giữ message < 3 ngày, xóa message cũ (ảnh blob tự hết hạn)
        const validMessages = parsed.filter(msg => msg.id >= threeDaysAgo);
        
        if (validMessages.length !== parsed.length) {
          localStorage.setItem(storageKey, JSON.stringify(validMessages));
        }
        return validMessages;
      }
    } catch (e) {
      console.error("Error loading AI messages", e);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeModel, setActiveModel] = useState('Gemini-2.5-Flash');
  const [dbCategories, setDbCategories] = useState([]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const querySnapshot = await getDocs(query(collection(db, "products"), limit(200)));
        // Khởi tạo các danh mục mặc định cơ bản
        const cats = new Set(["Giải pháp AI", "Vật liệu xây dựng", "Phần mềm & Dịch vụ", "Thiết bị vệ sinh", "Trang trí nội thất", "Công cụ & Dụng cụ", "Điện tử", "Laptop", "Âm thanh"]);
        querySnapshot.forEach((doc) => {
          if (doc.data().category) cats.add(doc.data().category);
        });
        setDbCategories(Array.from(cats).sort());
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCats();
  }, []);

  const [productSuggestions, setProductSuggestions] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState({ all_units: [], raw_docs: [], performance: [] });
  const [userName, setUserName] = useState("Thong Nguyen");


  // Load Knowledge Base & Products — tăng limit + lazy search
  useEffect(() => {
    const loadKB = async () => {
      try {
        const [unitsSnap, baseSnap, consultationsSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, "ai_knowledge_units")),
          getDocs(collection(db, "ai_knowledge_base")),
          getDocs(query(collection(db, "ai_consultations"), orderBy("createdAt", "desc"), limit(100))),
          getDocs(query(collection(db, "products"), orderBy("title", "asc"), limit(500)))
        ]);

        const knowledgeUnits = unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const knowledgeBaseRaw = baseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pastConsultations = consultationsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            category: "Lịch sử tư vấn thông minh (Nên tham khảo)",
            content: `Khách hỏi: ${data.userQuery} \n=> Bot Đã Trả Lời: ${data.botResponse}`,
            keywords: data.userQuery?.split(" ") || [],
            summary: "Dữ liệu học từ các cuộc tư vấn thực tế trong quá khứ"
          };
        });

        const products = productsSnap.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, title: data.title, category: data.category || 'Chung', image: data.image || null };
        }).filter(p => p.title);

        setProductSuggestions(products);

        // Load performance data
        const userEmail = auth.currentUser?.email || "";
        let performanceData = null;
        if (userEmail) {
          const perfSnap = await getDocs(query(collection(db, "agency_performance"), where("email", "==", userEmail), limit(1)));
          performanceData = perfSnap.docs.length > 0 ? perfSnap.docs[0].data() : null;
        }

        if (performanceData?.name || auth.currentUser?.displayName) {
          setUserName(performanceData?.name || auth.currentUser?.displayName || "Thong Nguyen");
        }

        setKnowledgeBase({ 
          all_units: [...knowledgeUnits, ...pastConsultations], 
          raw_docs: knowledgeBaseRaw,
          performance: performanceData ? [performanceData] : []
        });
      } catch {
        // console.warn('Error loading AI data:', err); // Silenced permission error
      }
    };
    loadKB();
  }, []);

  const getKnowledgeContext = useCallback((msgText) => {
    const units = knowledgeBase.all_units || [];
    if (!units.length) return "==== TÀI LIỆU NỘI BỘ ====\n[TRỐNG - CHƯA CÓ TRONG CƠ SỞ DỮ LIỆU]\n==========================\n";
    
    // Dùng Fuse tìm kiếm với threshold thấp hơn cho kết quả chính xác hơn
    const fuse = new Fuse(units, { 
      keys: ['content', 'keywords', 'summary', 'category'], 
      threshold: 0.5, 
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true
    });
    const results = fuse.search(msgText);
    if (!results.length) return "==== TÀI LIỆU NỘI BỘ ====\n[TRỐNG - CHƯA CÓ TRONG CƠ SỞ DỮ LIỆU]\n==========================\n";
    
    let contextText = "==== TÀI LIỆU NỘI BỘ ====\n";
    results.slice(0, 15).forEach(r => contextText += `- [Chuyên mục: ${r.item.category || 'Chung'}] Nội dung: ${r.item.content?.slice(0, 500)}\n---\n`);
    return contextText + "==========================\n";
   
  }, [knowledgeBase.all_units]);

  const callAI = useCallback(async (msgText, systemPrompt, imageUrls = [], allowedTools = ADMIN_AI_FUNCTIONS) => {
    // 1. Ưu tiên điều phối qua n8n Webhook & AI Agent VPS
    try {
      const chatHistory = messages.map(m => ({
        role: m.isBot ? "assistant" : "user",
        content: m.text
      }));
      
      const n8nRes = await apiSendAdminAiMessage({
        message: msgText,
        history: chatHistory.slice(-10),
        instructions: systemPrompt
      });

      if (n8nRes && (n8nRes.reply || n8nRes.message)) {
        setActiveModel('n8n-Orchestrator-DeepSeek');
        return n8nRes.reply || n8nRes.message;
      }
    } catch (n8nErr) {
      console.warn('[AdminAI] n8n Webhook notice, attempting direct fallback:', n8nErr.message);
    }

    const aiApiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    console.log('[AdminAI] API Key exists:', !!aiApiKey, 'length:', aiApiKey?.length || 0);
    
    if (!aiApiKey) {
      return "⚠️ Hệ thống AI đang bảo trì: Chưa cấu hình NEXT_PUBLIC_DEEPSEEK_API_KEY trên Vercel.";
    }

    // DeepSeek không hỗ trợ ảnh → chỉ giữ text, thêm ghi chú nếu có ảnh
    const history = messages.map(m => {
      let content = m.text;
      if (!m.isBot && m.image && !m.image.startsWith('blob:')) {
        content = m.text
          ? `[Người dùng gửi ảnh] ${m.text}`
          : "[Người dùng gửi 1 ảnh — hãy hỏi lại nếu cần mô tả]";
      }
      return { role: m.isBot ? "assistant" : "user", content };
    });
    
    const urls = Array.isArray(imageUrls) ? imageUrls : (imageUrls ? [imageUrls] : []);
    let currentUserContent = msgText;
    if (urls.length > 0) {
      currentUserContent = msgText
        ? `[Người dùng gửi ${urls.length} ảnh] ${msgText}`
        : `[Người dùng gửi ${urls.length} ảnh — hãy hỏi lại nếu cần mô tả chi tiết]`;
    }
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history.slice(-20), { role: "user", content: currentUserContent }];

    // DeepSeek API call với timeout & JSON parse an toàn
    const TIMEOUT_MS = 45000;
    const callDeepSeek = async (messages, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        
        try {
          const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
            body: JSON.stringify({ model: "deepseek-chat", messages, tools: allowedTools, tool_choice: "auto", temperature: 0.3, max_tokens: 4096 }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.error(`DeepSeek API error ${res.status}:`, errText.slice(0, 200));
            if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
            return { error: `⚠️ Lỗi API (${res.status}): ${errText.slice(0, 100) || 'Không xác định'}` };
          }
          
          // Parse JSON an toàn — tránh crash khi response bị cắt ngang
          const raw = await res.text();
          let d;
          try {
            d = JSON.parse(raw);
          } catch (parseErr) {
            console.warn('JSON parse error — response may be truncated:', parseErr.message);
            if (attempt < retries) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
            return { error: '⚠️ Phản hồi AI bị lỗi định dạng — vui lòng thử lại.' };
          }
          return d;
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            console.warn(`DeepSeek timeout after ${TIMEOUT_MS}ms`);
            if (attempt < retries) continue;
            return { error: '⚠️ AI phản hồi quá chậm (timeout). Hãy thử câu hỏi ngắn hơn.' };
          }
          console.warn('DeepSeek network error:', fetchErr.message);
          if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
          return { error: '⚠️ Lỗi mạng: Không thể kết nối tới AI. Kiểm tra kết nối internet.' };
        }
      }
      return { error: '⚠️ AI không phản hồi sau nhiều lần thử.' };
    };

    try {
      let d = await callDeepSeek(apiMessages);
      if (d.error) return d.error;
      
      setActiveModel('DeepSeek-V3');
      let responseMsg = d.choices?.[0]?.message;
      if (!responseMsg) return "⚠️ Bot không phản hồi — định dạng response không đúng.";
      
      let rounds = 0;
      while (responseMsg?.tool_calls && rounds < 5) {
        rounds++;
        apiMessages.push(responseMsg);
        let toolErrors = [];
        const toolResults = await Promise.all(responseMsg.tool_calls.map(async (tc) => {
          try {
            const result = await executeFunction(tc.function.name, tc.function.arguments);
            if (result && result.error) toolErrors.push(`[${tc.function.name}] ${result.error}`);
            return { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) };
          } catch (toolErr) {
            console.warn(`Tool ${tc.function.name} error:`, toolErr);
            toolErrors.push(`[${tc.function.name}] ${toolErr.message}`);
            return { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify({ error: toolErr.message }) };
          }
        }));
        apiMessages.push(...toolResults);
        
        d = await callDeepSeek(apiMessages, 0); // tool follow-up: không retry
        if (d.error) return d.error;
        responseMsg = d.choices?.[0]?.message;
        if (toolErrors.length > 0) {
          responseMsg.content = (responseMsg.content || "") + `\n\n⚠️ LƯU Ý TỪ HỆ THỐNG: Quá trình thực thi lệnh gặp lỗi:\n- ${toolErrors.join('\n- ')}`;
        }
      }
      return responseMsg?.content || "Bot không phản hồi.";
    } catch (err) { 
      console.error("AdminAI critical error:", err); 
      return "⚠️ Lỗi hệ thống: Vui lòng thử lại hoặc refresh trang.";
    }
  }, [messages]);

  const handleSend = useCallback(async (msgText, imageFiles = []) => {
    if (!msgText?.trim() && (!imageFiles || imageFiles.length === 0)) return;
    
    setInput("");
    setIsTyping(true);

    const files = Array.isArray(imageFiles) ? imageFiles : (imageFiles ? [imageFiles] : []);
    const hasImages = files.length > 0;
    
    const localPreviews = hasImages ? files.map(f => URL.createObjectURL(f)) : [];
    const tempId = Date.now();
    const userMsg = { 
      role: 'user', 
      text: msgText || (hasImages ? 'Da gui ' + files.length + ' hinh anh' : ""), 
      images: localPreviews.length > 0 ? localPreviews : undefined,
      id: tempId, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, userMsg]);

    // Ảnh chat KHÔNG upload lên Cloudinary nữa — chỉ dùng blob URL local
    // để tiết kiệm dung lượng storage. Ảnh hết phiên (F5/tắt tab) sẽ tự mất.
    if (hasImages) {
      setMessages(prev => prev.map(m => m.id === tempId ? { 
        ...m, 
        images: localPreviews,
        image: localPreviews[0] || undefined
      } : m));
    }

    // Intercept and execute AI bulk/selected enrich directly via VPS & SQLite API
    const lowerMsg = (msgText || "").toLowerCase();
    
    // Lấy danh sách ID sản phẩm đã chọn từ sessionStorage (do AdminProductList lưu)
    let selectedIds = [];
    try {
      selectedIds = JSON.parse(sessionStorage.getItem('ai-product-ids') || '[]');
      sessionStorage.removeItem('ai-product-ids');
    } catch {
      selectedIds = [];
    }

    const isBulkDraftRequest = (lowerMsg.includes("quét") || lowerMsg.includes("quet") || lowerMsg.includes("n8n")) && 
                               (lowerMsg.includes("draft") || lowerMsg.includes("nháp") || lowerMsg.includes("nhap") || lowerMsg.includes("sản phẩm"));
    
    const isSelectedProductsRequest = (selectedIds.length > 0) ||
                                      (lowerMsg.includes("danh sách") && (lowerMsg.includes("sản phẩm") || lowerMsg.includes("sp")) && (lowerMsg.includes("viết") || lowerMsg.includes("mô tả") || lowerMsg.includes("seo"))) ||
                                      (lowerMsg.includes("viết bài") && lowerMsg.includes("chuẩn seo")) ||
                                      (lowerMsg.includes("thông số kỹ thuật & ưu điểm bổ sung"));

    if (isBulkDraftRequest || isSelectedProductsRequest) {
      try {
        // Trích xuất danh sách tên sản phẩm nếu người dùng chọn cụ thể
        const lines = (msgText || "").split("\n");
        const selectedTitles = lines
          .filter(l => l.trim().startsWith("- ") || /^\d+[\.\)]\s*/.test(l.trim()))
          .map(l => l.replace(/^(-\s*|\d+[\.\)]\s*)/, "").trim());

        const bulkResult = await apiTriggerAiBulkEnrich({
          status: isBulkDraftRequest && selectedIds.length === 0 ? 'Draft' : undefined,
          limit: selectedIds.length > 0 ? selectedIds.length : (selectedTitles.length > 0 ? selectedTitles.length : 10),
          productIds: selectedIds,
          instructions: msgText
        });

        if (bulkResult && bulkResult.success) {
          const prods = bulkResult.products || [];
          const listText = prods.map((p, idx) => `${idx + 1}. **${p.title}** (${p.category}) - ${p.aiGenerated ? '⚡ DeepSeek AI đã viết bài HTML chuẩn SEO (' + p.descLength + ' ký tự)' : 'Đã cập nhật bài viết'}`).join('\n');
          const reply = `✅ **Thực thi AI Agent thành công!**\n\n${bulkResult.message}\n\n**Danh sách sản phẩm vừa được tạo bài viết HTML chuẩn SEO & lưu vào SQLite:**\n${listText}\n\n💡 Bạn có thể làm mới bảng sản phẩm hoặc click vào từng sản phẩm để xem bài viết hoàn chỉnh.`;
          setMessages(prev => [...prev, { id: Date.now() + 1, text: reply, isBot: true, time: "Vừa xong" }]);
          setIsTyping(false);
          // Phát sự kiện reload sản phẩm
          window.dispatchEvent(new CustomEvent('AI_PRODUCTS_UPDATED'));
          window.dispatchEvent(new CustomEvent('PRODUCTS_CHANGED'));
          return;
        } else {
          const errMsg = bulkResult?.error || "Không thể xử lý yêu cầu viết bài tự động.";
          setMessages(prev => [...prev, { id: Date.now() + 1, text: `⚠️ Hệ thống AI báo lỗi: ${errMsg}`, isBot: true, time: "Vừa xong" }]);
          setIsTyping(false);
          return;
        }
      } catch (err) {
        console.warn("Failed to connect to AI Bulk Enrich API:", err.message);
        setMessages(prev => [...prev, { id: Date.now() + 1, text: `⚠️ Lỗi kết nối tới hệ thống AI Zbuild VPS: ${err.message}. Vui lòng kiểm tra lại dịch vụ zbuild-api trên VPS.`, isBot: true, time: "Vừa xong" }]);
        setIsTyping(false);
        return;
      }
    }

    try {
      const systemPrompt = `Bạn là Trợ lý AI Quản trị của Z-BUILD, hỗ trợ Admin quản lý toàn bộ hệ thống. Bạn CÓ QUYỀN và BẮT BUỘC PHẢI SỬ DỤNG function calling.

# ⚠️ NGUYÊN TẮC SỐNG CÒN
1. MỖI KHI ADMIN YÊU CẦU THAY ĐỔI DỮ LIỆU (tạo, sửa, xóa sản phẩm, đơn hàng...) → PHẢI GỌI FUNCTION tương ứng.
2. TUYỆT ĐỐI KHÔNG nói "đã cập nhật", "đã tạo", "đã xóa" nếu CHƯA thực sự gọi function và function trả về success.
3. Nếu function trả về error → báo lỗi cho admin, KHÔNG tự bịa kết quả thành công.
4. CHỈ trả lời dựa trên KẾT QUẢ THẬT TỪ FUNCTION. Không tự suy diễn.

# ✍️ VIẾT BÀI / VIẾT MÔ TẢ SẢN PHẨM (QUAN TRỌNG NHẤT)
- Khi admin yêu cầu "viết bài", "viết mô tả", "tạo content", "viết content SEO" cho sản phẩm → LUÔN dùng function **generate_product_description**.
- generate_product_description sẽ TỰ ĐỘNG gọi AI backend để sinh bài viết HTML chuyên nghiệp, lưu thẳng vào sản phẩm.
- Tham số product_name: tên sản phẩm cần viết bài (bắt buộc).
- Tham số instructions: hướng dẫn thêm (ví dụ: "nhấn mạnh tính thân thiện môi trường", "viết cho đối tượng nhà thầu chuyên nghiệp").
- Tham số product_info: bổ sung thông tin sản phẩm nếu admin có nói thêm.
- KHÔNG BAO GIỜ dùng update_product với tham số description để viết bài — cách đó dễ gây lỗi JSON.

# 📋 SƠ ĐỒ FORM TẠO SẢN PHẨM (create_product):
┌─────────────────────────────────────────────────────┐
│ THÔNG TIN CƠ BẢN:                                   │
│  title      → Tên sản phẩm (bắt buộc)               │
│  shortDesc  → Mô tả ngắn 1-2 câu (tùy chọn)        │
│  category   → Danh mục (chọn từ danh sách có sẵn)   │
│  status     → Draft (nháp) hoặc Active (đăng luôn)  │
├─────────────────────────────────────────────────────┤
│ HÌNH ẢNH & VIDEO:                                   │
│  imageUrl   → Ảnh đại diện chính (từ ảnh admin gửi) │
│  videoUrl   → Link YouTube nếu có                   │
├─────────────────────────────────────────────────────┤
│ GIÁ CẢ:                                             │
│  basePrice      → Giá gốc / giá niêm yết            │
│  discountPrice  → Giá khuyến mãi (nếu có, tùy chọn) │
│  stock          → Số lượng tồn kho (mặc định 100)   │
├─────────────────────────────────────────────────────┤
│ THÔNG SỐ KỸ THUẬT:                                  │
│  specs       → Quy cách, kích thước, màu sắc...     │
│  packaging   → Đóng gói (thùng, bao, cuộn...)       │
│  weight      → Trọng lượng (kg, tùy chọn)           │
└─────────────────────────────────────────────────────┘

🔍 QUY TẮC ĐẶT TÊN SẢN PHẨM CHUẨN SEO:
- Cấu trúc: [Loại SP] [Thương hiệu] [Đặc điểm chính] [Kích thước/Quy cách]
- VD tốt: "Tấm Xi Măng Sợi DURAflex 18mm Chịu Lực Siêu Bền"
- VD tốt: "Tấm Nhựa Nano Pima Vân Gỗ 1220x2440mm Chống Ẩm"
- VD tốt: "Trần Thả Vĩnh Tường DECO Ánh Kim 26 Hừng Đông 600x600mm"
- LUÔN bao gồm: loại sản phẩm + thương hiệu + thông số kỹ thuật chính + lợi ích
- TỰ ĐỘNG gợi ý tên SEO khi admin nói "tạo sản phẩm X" mà chưa có tên rõ ràng
- Độ dài tên: 40-80 ký tự (tối ưu cho Google hiển thị)

🎯 QUY TẮC QUAN TRỌNG KHI GỌI create_product HOẶC update_product:
1. LUÔN tự sinh description (mô tả HTML SEO) bằng AI — KHÔNG bắt admin nhập
2. Ảnh admin gửi → truyền vào imageUrl (nếu tạo) hoặc update_product (để đổi ảnh)
3. Cập nhật sản phẩm: gọi update_product cho phép sửa tên, danh mục, giá, tồn kho, mô tả, hình ảnh...
4. Link YouTube → gọi analyze_youtube_link TRƯỚC, rồi dùng kết quả
5. KHÔNG tự bịa category — chọn từ danh sách có sẵn hoặc hỏi admin
6. specs là QUY CÁCH (vd: "10x20cm, dày 2mm"), KHÔNG phải mô tả dài
7. packaging là ĐÓNG GÓI (vd: "Thùng 10 tấm", "Bao 25kg")
8. QUAN TRỌNG: Khi viết mã HTML vào tham số "description" của create_product, KHÔNG sử dụng dấu nháy kép (") bên trong HTML để tránh lỗi JSON. Hãy sử dụng dấu nháy đơn (') hoặc không dùng dấu nháy cho các thuộc tính HTML.
9. ĐỂ VIẾT BÀI MÔ TẢ: Dùng generate_product_description — backend sẽ tự sinh HTML, không cần truyền HTML qua tham số.

📸 KHI ADMIN GỬI ẢNH KÈM TEXT:
Ví dụ: [3 ảnh] "Tạo SP Sơn Dulux màu trắng, giá 450k, danh mục Sơn"
→ Gọi create_product({ title: "Sơn Dulux trắng", category: "Sơn & Chất phủ", basePrice: 450000, imageUrl: "url_anh_1", specs: "Màu trắng", packaging: "Thùng 5L", status: "Draft" })

✏️ KHI ADMIN YÊU CẦU CHỈNH SỬA SẢN PHẨM:
Ví dụ: [1 ảnh] "Đổi ảnh sản phẩm Sơn Dulux này và đổi tên thành Sơn Dulux Cao Cấp"
→ Gọi update_product({ product_name: "Sơn Dulux", new_title: "Sơn Dulux Cao Cấp", imageUrl: "url_anh_1" })

Danh mục hiện có: ${dbCategories.length > 0 ? dbCategories.join(', ') : 'Vật liệu xây dựng, Nội thất, Sơn & Chất phủ, Thiết bị điện, Hệ thống nước, Cửa & Phụ kiện'}.

⚡ 20 FUNCTIONS: generate_product_description | create_product | update_product | update_product_price | update_product_status | update_product_stock | update_product_details | delete_product | update_order_status | get_customer_info | manage_coupon | analyze_youtube_link | export_products_excel | sync_prices_from_sheet | get_draft_products | get_store_stats | search_products | get_product_detail | count_products | check_order_status | get_order_history

GHI NHỚ NGỮ CẢNH: Nếu admin bổ sung thông tin → tự động ghép với thông tin cũ → gọi lại function với đầy đủ.
Phản hồi bằng tiếng Việt. TÓM TẮT kết quả function đã gọi (thành công hay thất bại, giá trị cụ thể). KHÔNG tự sinh mô tả dài nếu chưa gọi function.`;

      // Try Gemini API
      const allowedTools = ADMIN_AI_FUNCTIONS;

      const botResult = await callAI(msgText, systemPrompt, localPreviews, allowedTools);
      
      let cleanResponse = typeof botResult === 'string' ? botResult : (JSON.stringify(botResult) || "");
      let boardData = null;
      const dataMatch = cleanResponse.match(/\[\[RENDER_DATA_BOARD:\s*(\{[\s\S]*?\})\s*\]\]/);
      if (dataMatch) {
         try {
           boardData = JSON.parse(dataMatch[1]);
           cleanResponse = botResult.replace(dataMatch[0], '').trim();
         } catch(err) { console.warn("Board data parse error:", err); }
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, text: cleanResponse, board: boardData, isBot: true, time: "Vừa xong" }]);
      
      if (cleanResponse && !cleanResponse.includes("Dạ hiện tại trên hệ thống dữ liệu")) {
        addDoc(collection(db, "ai_consultations"), {
          userQuery: msgText, botResponse: cleanResponse, createdAt: serverTimestamp(), userId: auth.currentUser?.uid || "anonymous"
        }).catch(err => console.warn("Log failed:", err));
      }
    } catch (error) {
      console.error("handleSend Error:", error);
    } finally {
      setIsTyping(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, getKnowledgeContext, callAI, dbCategories]);

  return {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  };
};
