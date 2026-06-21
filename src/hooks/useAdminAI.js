import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { ADMIN_AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';

const deleteCloudinaryImage = async (secureUrl) => {
  try {
    const match = secureUrl.match(/\/v\d+\/(.+)\.[a-zA-Z]+$/);
    if (!match) return;
    const publicId = match[1];
    
    const apiSecret = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    
    if (!apiSecret || !apiKey || !cloudName) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    console.error("Failed to delete from Cloudinary:", err);
  }
};

/**
 * Custom hook to manage AI Advisor state and logic.
 */
export const useAdminAI = () => {
  const storageKey = `zbuild_ai_messages_admin`;
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        let parsed = JSON.parse(saved);
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        const validMessages = [];
        
        for (const msg of parsed) {
          if (msg.id < threeDaysAgo) {
            if (msg.image) deleteCloudinaryImage(msg.image);
          } else {
            validMessages.push(msg);
          }
        }
        
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


  // Load Knowledge Base & Products
  useEffect(() => {
    const loadKB = async () => {
      try {
        const [unitsSnap, baseSnap, consultationsSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, "ai_knowledge_units")),
          getDocs(collection(db, "ai_knowledge_base")),
          getDocs(query(collection(db, "ai_consultations"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(query(collection(db, "products"), orderBy("title", "asc"), limit(200)))
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
      } catch (err) {
        console.warn('Error loading AI data:', err);
      }
    };
    loadKB();
  }, []);

  const getKnowledgeContext = useCallback((msgText) => {
    const recentUserMessages = messages.filter(m => !m.isBot).slice(-2).map(m => m.text).join(" ");
    const searchContext = `${recentUserMessages} ${msgText}`;
    const units = knowledgeBase.all_units || [];
    if (!units.length) return "";
    
    const fuse = new Fuse(units, { keys: ['content', 'keywords', 'summary', 'category'], threshold: 0.45, ignoreLocation: true });
    const results = fuse.search(searchContext);
    if (!results.length) return "==== TÀI LIỆU NỘI BỘ ====\n[TRỐNG - CHƯA CÓ TRONG CƠ SỞ DỮ LIỆU]\n==========================\n";
    
    let contextText = "==== TÀI LIỆU NỘI BỘ ====\n";
    results.slice(0, 20).forEach(r => contextText += `- [Chuyên mục: ${r.item.category || 'Chung'}] Nội dung: ${r.item.content}\n---\n`);
    return contextText + "==========================\n";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const callAI = useCallback(async (msgText, systemPrompt, imageUrls = [], allowedTools = ADMIN_AI_FUNCTIONS) => {
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
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: currentUserContent }];

    // Gemini with Function Calling
    try {
      let res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, tools: allowedTools, tool_choice: "auto", temperature: 0.3 })
      });
      if (res.ok) {
        let d = await res.json();
        setActiveModel('DeepSeek-V3');
        let responseMsg = d.choices[0]?.message;
        
        let rounds = 0;
        while (responseMsg?.tool_calls && rounds < 3) {
          rounds++;
          apiMessages.push(responseMsg);
          const toolResults = await Promise.all(responseMsg.tool_calls.map(async (tc) => {
            const result = await executeFunction(tc.function.name, tc.function.arguments);
            return { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) };
          }));
          apiMessages.push(...toolResults);
          const followUp = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
            body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, tools: allowedTools, tool_choice: "auto", temperature: 0.3 })
          });
          if (!followUp.ok) break;
          d = await followUp.json();
          responseMsg = d.choices[0]?.message;
        }
        return responseMsg?.content || "Bot không phản hồi.";
      } else {
        const errorData = await res.json();
        console.error("Gemini Error:", errorData);
        return `⚠️ Lỗi từ API: ${errorData.error?.message || "Không xác định"}`;
      }
    } catch (err) { 
      console.warn("Gemini network error", err); 
      return "⚠️ Lỗi mạng: Không thể kết nối tới Google AI.";
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

    let imageUrls = [];
    if (hasImages) {
      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtdgrcznj';
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'zbuild';
        
        const uploadPromises = files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);
          const res = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          return data.secure_url || null;
        });
        imageUrls = (await Promise.all(uploadPromises)).filter(Boolean);
        
        setMessages(prev => prev.map(m => m.id === tempId ? { 
          ...m, 
          images: imageUrls,
          image: imageUrls[0] || undefined
        } : m));
      } catch (err) {
        console.error("Upload images failed:", err);
      }
    }

    try {
      const systemPrompt = `Bạn là Trợ lý AI Quản trị của Z-BUILD, hỗ trợ Admin quản lý toàn bộ hệ thống. Bạn CÓ QUYỀN và BẮT BUỘC PHẢI SỬ DỤNG function calling.

📋 SƠ ĐỒ FORM TẠO SẢN PHẨM (create_product):
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

🎯 QUY TẮC QUAN TRỌNG KHI GỌI create_product HOẶC update_product:
1. LUÔN tự sinh description (mô tả HTML SEO) bằng AI — KHÔNG bắt admin nhập
2. Ảnh admin gửi → truyền vào imageUrl (nếu tạo) hoặc update_product (để đổi ảnh)
3. Cập nhật sản phẩm: gọi update_product cho phép sửa tên, danh mục, giá, tồn kho, mô tả, hình ảnh...
4. Link YouTube → gọi analyze_youtube_link TRƯỚC, rồi dùng kết quả
5. KHÔNG tự bịa category — chọn từ danh sách có sẵn hoặc hỏi admin
6. specs là QUY CÁCH (vd: "10x20cm, dày 2mm"), KHÔNG phải mô tả dài
7. packaging là ĐÓNG GÓI (vd: "Thùng 10 tấm", "Bao 25kg")

📸 KHI ADMIN GỬI ẢNH KÈM TEXT:
Ví dụ: [3 ảnh] "Tạo SP Sơn Dulux màu trắng, giá 450k, danh mục Sơn"
→ Gọi create_product({ title: "Sơn Dulux trắng", category: "Sơn & Chất phủ", basePrice: 450000, imageUrl: "url_anh_1", specs: "Màu trắng", packaging: "Thùng 5L", status: "Draft" })

✏️ KHI ADMIN YÊU CẦU CHỈNH SỬA SẢN PHẨM:
Ví dụ: [1 ảnh] "Đổi ảnh sản phẩm Sơn Dulux này và đổi tên thành Sơn Dulux Cao Cấp"
→ Gọi update_product({ product_name: "Sơn Dulux", new_title: "Sơn Dulux Cao Cấp", imageUrl: "url_anh_1" })

Danh mục hiện có: ${dbCategories.length > 0 ? dbCategories.join(', ') : 'Vật liệu xây dựng, Nội thất, Sơn & Chất phủ, Thiết bị điện, Hệ thống nước, Cửa & Phụ kiện'}.

⚡ 19 FUNCTIONS: create_product | update_product | update_product_price | update_product_status | update_product_stock | update_product_details | delete_product | update_order_status | get_customer_info | manage_coupon | analyze_youtube_link | export_products_excel | sync_prices_from_sheet | get_draft_products | get_store_stats | search_products | get_product_detail | count_products | check_order_status | get_order_history

GHI NHỚ NGỮ CẢNH: Nếu admin bổ sung thông tin → tự động ghép với thông tin cũ → gọi lại function với đầy đủ.
Phản hồi NGẮN GỌN, tiếng Việt, xác nhận từng field đã điền.`;

      // Try Gemini API
      const allowedTools = ADMIN_AI_FUNCTIONS;

      const botResult = await callAI(msgText, systemPrompt, imageUrls, allowedTools);
      
      let cleanResponse = botResult;
      let boardData = null;
      const dataMatch = botResult.match(/\[\[RENDER_DATA_BOARD:\s*(\{[\s\S]*?\})\s*\]\]/);
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
