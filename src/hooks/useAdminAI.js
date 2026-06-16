import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';

const deleteCloudinaryImage = async (secureUrl) => {
  try {
    const match = secureUrl.match(/\/v\d+\/(.+)\.[a-zA-Z]+$/);
    if (!match) return;
    const publicId = match[1];
    
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    
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
  const lastProcessedProductIdRef = useRef(null);

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

  const callAI = useCallback(async (msgText, systemPrompt, imageUrl = null, allowedTools = AI_FUNCTIONS) => {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return "⚠️ Hệ thống AI đang bảo trì: Chưa cấu hình VITE_GEMINI_API_KEY trên môi trường chạy.";
    }

    const history = messages.map(m => {
      let content = m.text;
      if (!m.isBot && m.image && !m.image.startsWith('blob:')) {
        content = [
          { type: "text", text: m.text || "Phân tích hình ảnh này" },
          { type: "image_url", image_url: { url: m.image } }
        ];
      }
      return { role: m.isBot ? "assistant" : "user", content };
    });
    
    let currentUserContent = msgText;
    if (imageUrl) {
      currentUserContent = [
        { type: "text", text: msgText || "Tôi gửi bạn một hình ảnh." },
        { type: "image_url", image_url: { url: imageUrl } }
      ];
    }
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: currentUserContent }];

    // Gemini with Function Calling
    try {
      let res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiApiKey}` },
        body: JSON.stringify({ model: "gemini-2.5-flash", messages: apiMessages, tools: allowedTools, tool_choice: "auto", temperature: 0.3 })
      });
      if (res.ok) {
        let d = await res.json();
        setActiveModel('Gemini-2.5-Flash');
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
          const followUp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiApiKey}` },
            body: JSON.stringify({ model: "gemini-2.5-flash", messages: apiMessages, tools: allowedTools, tool_choice: "auto", temperature: 0.3 })
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

  const handleSend = useCallback(async (msgText, imageFile = null) => {
    if (!msgText?.trim() && !imageFile) return;
    
    setInput("");
    setIsTyping(true);

    const localPreviewUrl = imageFile ? URL.createObjectURL(imageFile) : null;
    const tempId = Date.now();
    const userMsg = { 
      role: 'user', 
      text: msgText || "Đã gửi hình ảnh", 
      image: localPreviewUrl,
      id: tempId, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, userMsg]);

    let imageUrl = null;
    if (imageFile) {
      try {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dtdgrcznj';
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'zbuild';
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', uploadPreset);
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.secure_url) {
          imageUrl = data.secure_url;
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, image: imageUrl } : m));
        } else {
          console.error("Cloudinary error:", data);
        }
      } catch (err) {
        console.error("Upload image failed:", err);
      }
    }

    try {
      const systemPrompt = `Bạn là Trợ lý AI Quản trị của Z-BUILD, hỗ trợ Admin quản lý hệ thống.
        🔧 NĂNG LỰC ĐẶC BIỆT: Bạn CÓ QUYỀN TRUY CẬP VÀ BẮT BUỘC PHẢI SỬ DỤNG tools (function calling) để thực hiện các tác vụ.
        - Khi người dùng yêu cầu tạo sản phẩm, BẠN PHẢI GỌI function 'create_product'. Tuyệt đối KHÔNG ĐƯỢC tự ý trả lời "đã tạo" mà không gọi function.
        - Khi người dùng yêu cầu sửa/cập nhật số lượng tồn kho của sản phẩm, BẠN PHẢI GỌI function 'update_product_stock'.
        - Khi tạo sản phẩm, nó sẽ tự động được lưu dưới dạng NHÁP để Admin duyệt sau.
        - Danh mục hiện có trong hệ thống: ${dbCategories.length > 0 ? dbCategories.join(', ') : 'Vật liệu xây dựng, Nội thất...'}. Nếu khách quên nhập danh mục, hãy nhắc họ chọn trong danh sách này.
        - LƯU Ý QUAN TRỌNG VỀ NGỮ CẢNH: NẾU người dùng đang trả lời bổ sung thông tin còn thiếu (ví dụ: bổ sung danh mục, giá cả) cho một yêu cầu tạo sản phẩm ở câu trước, bạn HÃY TỰ ĐỘNG nhớ và ghép thông tin mới này vào các thông tin cũ (tên, quy cách, giá) ở câu trước, sau đó GỌI LẠI function 'create_product' với đầy đủ thông tin.
        - KHI NGƯỜI DÙNG YÊU CẦU KIỂM TRA/CẬP NHẬT SẢN PHẨM MỚI TỪ SHEET (SẢN PHẨM NHÁP): BƯỚC 1: Bắt buộc DỪNG LẠI và hỏi người dùng: "Tôi chuẩn bị tạo bài viết cho các sản phẩm nháp. Bạn có muốn cung cấp thêm thông tin chung (ví dụ: xuất xứ, chất liệu, bảo hành, công dụng nổi bật...) để tôi viết hay hơn không? Hay bạn muốn tôi tạo luôn?". KHÔNG ĐƯỢC làm tiếp bước sau nếu người dùng chưa trả lời câu hỏi này. BƯỚC 2: Khi người dùng trả lời (đưa thêm thông tin hoặc bảo tạo luôn), hãy gọi 'get_draft_products' để lấy danh sách. BƯỚC 3: Tự động suy luận và sinh đoạn mã HTML mô tả chuẩn SEO (kết hợp thông tin người dùng vừa cấp). BƯỚC 4: Gọi 'update_product_details' để cập nhật (GIỮ NGUYÊN trạng thái Nháp, tuyệt đối không kích hoạt để Admin tự thêm ảnh).
        Hãy phản hồi ngắn gọn, chuyên nghiệp và đi thẳng vào vấn đề.
        Tài liệu nội bộ: ${getKnowledgeContext(msgText)}`;

      // Try Gemini API
      const allowedTools = AI_FUNCTIONS;

      const botResult = await callAI(msgText, systemPrompt, imageUrl, allowedTools);
      
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
  }, [userName, getKnowledgeContext, callAI, dbCategories]);

  return {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  };
};
