import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';

/**
 * Custom hook to manage AI Advisor state and logic.
 */
export const useAIAdvisor = (productContext, role = 'storefront') => {
  const storageKey = `zbuild_ai_messages_${role}`;
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
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
        const querySnapshot = await getDocs(collection(db, "products"));
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
    if (role === 'admin') fetchCats();
  }, [role]);

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
          getDocs(query(collection(db, "products"), orderBy("title", "asc")))
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
  }, [messages, role]);

  const callAI = useCallback(async (msgText, systemPrompt) => {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return "⚠️ Hệ thống AI đang bảo trì: Chưa cấu hình VITE_GEMINI_API_KEY trên môi trường chạy.";
    }

    const history = messages.map(m => ({ role: m.isBot ? "assistant" : "user", content: m.text }));
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: msgText }];

    // Gemini with Function Calling
    try {
      let res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiApiKey}` },
        body: JSON.stringify({ model: "gemini-2.5-flash", messages: apiMessages, tools: AI_FUNCTIONS, tool_choice: "auto", temperature: 0.3 })
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
            body: JSON.stringify({ model: "gemini-2.5-flash", messages: apiMessages, tools: AI_FUNCTIONS, tool_choice: "auto", temperature: 0.3 })
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

  const handleSend = useCallback(async (msgText) => {
    if (!msgText?.trim()) return;
    const userMsg = { role: 'user', text: msgText, id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const systemPrompt = role === 'admin'
        ? `Bạn là Trợ lý AI Quản trị của Z-BUILD, hỗ trợ Admin quản lý hệ thống.
        🔧 NĂNG LỰC ĐẶC BIỆT: Bạn CÓ QUYỀN TRUY CẬP VÀ BẮT BUỘC PHẢI SỬ DỤNG tools (function calling) để thực hiện các tác vụ.
        - Khi người dùng yêu cầu tạo sản phẩm, BẠN PHẢI GỌI function 'create_product'. Tuyệt đối KHÔNG ĐƯỢC tự ý trả lời "đã tạo" mà không gọi function.
        - Khi tạo sản phẩm, nó sẽ tự động được lưu dưới dạng NHÁP để Admin duyệt sau.
        - Danh mục hiện có trong hệ thống: ${dbCategories.length > 0 ? dbCategories.join(', ') : 'Vật liệu xây dựng, Nội thất...'}. Nếu khách quên nhập danh mục, hãy nhắc họ chọn trong danh sách này.
        - LƯU Ý QUAN TRỌNG VỀ NGỮ CẢNH: NẾU người dùng đang trả lời bổ sung thông tin còn thiếu (ví dụ: bổ sung danh mục, giá cả) cho một yêu cầu tạo sản phẩm ở câu trước, bạn HÃY TỰ ĐỘNG nhớ và ghép thông tin mới này vào các thông tin cũ (tên, quy cách, giá) ở câu trước, sau đó GỌI LẠI function 'create_product' với đầy đủ thông tin.
        - KHI NGƯỜI DÙNG YÊU CẦU KIỂM TRA/CẬP NHẬT SẢN PHẨM MỚI TỪ SHEET (SẢN PHẨM NHÁP): BƯỚC 1: Gọi 'get_draft_products' để lấy danh sách. BƯỚC 2: Duyệt qua từng sản phẩm, tự động suy luận và sinh đoạn mã HTML mô tả chuẩn SEO (dựa vào tên, quy cách, danh mục). BƯỚC 3: Gọi tool 'update_product_details' để cập nhật mô tả đó vào hệ thống cho từng sản phẩm và kích hoạt chúng.
        Hãy phản hồi ngắn gọn, chuyên nghiệp và đi thẳng vào vấn đề.
        Tài liệu nội bộ: ${getKnowledgeContext(msgText)}`
        : `Bạn là Giám Đốc Kinh Doanh B2B của Z-BUILD, tư vấn cho ĐẠI LÝ: ${userName}.
        🔧 NĂNG LỰC ĐẶC BIỆT - FUNCTION CALLING: Sử dụng tools khi cần thông tin real-time về sản phẩm, đơn hàng, thống kê.
        Tài liệu nội bộ: ${getKnowledgeContext(msgText)}`;

      // Try Gemini API
      const botResult = await callAI(msgText, systemPrompt);
      
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
  }, [userName, getKnowledgeContext, callAI, role]);

  // Handle Product Context
  useEffect(() => {
    if (productContext && messages.length === 0 && lastProcessedProductIdRef.current !== productContext.id) {
      lastProcessedProductIdRef.current = productContext.id;
      const initialMessage = `Tôi muốn hỏi chi tiết về sản phẩm: **${productContext.title}**
      \n📊 Thông tin sản phẩm:
      - Giá gốc: ${productContext.basePrice ? productContext.basePrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
      - Giá niêm yết: ${productContext.discountPrice ? productContext.discountPrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
      - Danh mục: ${productContext.category}
      - Mô tả: ${productContext.description || 'N/A'}
      - Tồn kho: ${productContext.stock || 'N/A'}
      \nGiúp tôi phân tích sản phẩm này và đề xuất cách sử dụng tối ưu, so sánh với các sản phẩm tương tự.`;
      
      setTimeout(() => handleSend(initialMessage), 500);
    }
  }, [productContext, messages.length, handleSend]);

  return {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  };
};
