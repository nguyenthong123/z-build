import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit, doc, onSnapshot, setDoc } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { STOREFRONT_AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';

/**
 * Custom hook to manage AI Advisor state and logic.
 * 
 * Ảnh chat không còn upload lên Cloudinary — dùng blob URL local.
 * Cleanup ảnh rác Cloudinary nên làm bằng script server-side:
 *   scripts/cleanup_cloudinary.js
 */
export const useStorefrontAI = (productContext) => {
  const storageKey = `zbuild_ai_messages_storefront`;
  const [liveChatConfig, setLiveChatConfig] = useState({ enabled: false });
  const [liveChatMessages, setLiveChatMessages] = useState([]);

  // 1. Listen to storeSettings/main for Telegram Live Chat enabled status
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'storeSettings', 'main'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().telegramChatConfig) {
        setLiveChatConfig(docSnap.data().telegramChatConfig);
      }
    }, (err) => {
      console.warn("useStorefrontAI: onSnapshot storeSettings/main failed:", err);
    });
    return unsub;
  }, []);

  // 2. Real-time listener for Firestore live chat messages
  useEffect(() => {
    if (!liveChatConfig.enabled || !auth.currentUser) return;

    const messagesRef = collection(db, 'conversations', auth.currentUser.uid, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          text: data.text,
          isBot: data.sender === 'staff', // Display staff messages on the left like bot responses
          image: data.image,
          time: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      setLiveChatMessages(msgs);
    }, (err) => {
      console.warn("useStorefrontAI: onSnapshot conversations messages failed:", err);
    });

    return unsub;
  }, [liveChatConfig.enabled, auth.currentUser]);

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
      } catch {
        // Silenced permission error
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

  const callAI = useCallback(async (msgText, systemPrompt, imageUrl = null, allowedTools = STOREFRONT_AI_FUNCTIONS) => {
    const aiApiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    
    if (!aiApiKey) {
      return "⚠️ Hệ thống AI đang bảo trì: Chưa cấu hình NEXT_PUBLIC_DEEPSEEK_API_KEY trên Vercel.";
    }

    // DeepSeek không hỗ trợ ảnh → chỉ giữ text
    const history = messages.map(m => {
      let content = m.text;
      if (!m.isBot && m.image && !m.image.startsWith('blob:')) {
        content = m.text
          ? `[Người dùng gửi ảnh] ${m.text}`
          : "[Người dùng gửi 1 ảnh — hãy hỏi lại nếu cần mô tả]";
      }
      return { role: m.isBot ? "assistant" : "user", content };
    });
    
    let currentUserContent = msgText;
    if (imageUrl) {
      currentUserContent = msgText
        ? `[Người dùng gửi ảnh] ${msgText}`
        : "[Người dùng gửi 1 ảnh — hãy hỏi lại nếu cần mô tả chi tiết]";
    }
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: currentUserContent }];

    // DeepSeek with Function Calling
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
        console.error("DeepSeek API Error:", errorData);
        return `⚠️ Lỗi từ API: ${errorData.error?.message || "Không xác định"}`;
      }
    } catch (err) { 
      console.warn("DeepSeek network error", err); 
      return "⚠️ Lỗi mạng: Không thể kết nối tới máy chủ AI (DeepSeek).";
    }
  }, [messages]);

  const handleSend = useCallback(async (msgText, imageFile = null) => {
    if (!msgText?.trim() && !imageFile) return;
    
    if (liveChatConfig.enabled && auth.currentUser) {
      setInput("");
      setIsTyping(true);

      let imageUrl = null;

      if (imageFile) {
        try {
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtdgrcznj';
          const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'zbuild';
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('upload_preset', uploadPreset);
          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (response.ok && data.secure_url) {
            imageUrl = data.secure_url;
          } else {
            console.error("Cloudinary upload failed", data);
          }
        } catch (err) {
          console.error("Error uploading to Cloudinary", err);
        }
      }

      try {
        const convoRef = doc(db, 'conversations', auth.currentUser.uid);
        const messagesRef = collection(db, 'conversations', auth.currentUser.uid, 'messages');

        await setDoc(convoRef, {
          userId: auth.currentUser.uid,
          userName: auth.currentUser.displayName || userName || "Khách hàng",
          userEmail: auth.currentUser.email || "",
          lastMessageText: msgText || "[Hình ảnh]",
          updatedAt: serverTimestamp()
        }, { merge: true });

        await addDoc(messagesRef, {
          text: msgText || "",
          image: imageUrl || "",
          sender: 'user',
          createdAt: serverTimestamp()
        });

      } catch (err) {
        console.error("Error sending message to Firestore", err);
      } finally {
        setIsTyping(false);
      }
      return;
    }

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

    // Ảnh chat KHÔNG upload lên Cloudinary nữa — chỉ dùng blob URL local
    // để tiết kiệm dung lượng storage. Ảnh hết phiên (F5/tắt tab) sẽ tự mất.
    let imageUrl = localPreviewUrl;
    if (imageFile) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, image: localPreviewUrl } : m));
    }

    try {
      const systemPrompt = `# VAI TRÒ
Bạn là Chuyên gia Tư vấn Vật liệu Xây dựng của Z-BUILD, tư vấn cho ĐẠI LÝ: ${userName}.

# NGUYÊN TẮC CỐT LÕI

## 1. LUÔN ĐỌC DỮ LIỆU SẢN PHẨM TRƯỚC KHI TƯ VẤN
Mỗi khi khách hỏi về sản phẩm hoặc hạng mục, việc ĐẦU TIÊN là gọi search_products hoặc get_product_detail để lấy thông tin THẬT từ hệ thống. KHÔNG tự suy đoán.

## 2. PHÂN TÍCH QUY CÁCH — TỰ SUY LUẬN TỪ SỐ LIỆU
Khi có specs sản phẩm (vd: "605x1210mm", "1220x2440mm"), hãy TỰ PHÂN TÍCH:
- Kích thước dài x rộng là bao nhiêu?
- 1 tấm = bao nhiêu m²?
- Có thể chia/cắt thành tấm nhỏ hơn không? (vd: 1210/2=605 → cắt đôi được)
- Ứng dụng phù hợp dựa trên kích thước? (tấm nhỏ ~0.7m² → trần thả; tấm lớn ~3m² → trần chìm/vách/sàn)

## 3. KHI NÀO CẦN HỎI LẠI KHÁCH
CHỈ hỏi lại khi specs sản phẩm CHO THẤY có nhiều hơn 1 cách sử dụng:
- VD: Tấm 605x1210 → CÓ THỂ cắt đôi (60x60) hoặc dùng nguyên (60x120) → HỎI khách chọn kiểu nào
- VD: Tấm nano ốp tường 600x1200mm → CHỈ 1 cách dùng (ốp nguyên tấm) → KHÔNG cần hỏi, tính luôn
- VD: Sơn, keo, bột → đơn vị kg/lít → không có "kiểu thi công" → KHÔNG hỏi

Quy tắc: CHỈ hỏi khi specs thực tế cho thấy >1 phương án. Nếu specs không rõ ràng → hỏi khách cung cấp thêm.

## 4. QUY TRÌNH TƯ VẤN ĐỘNG BẮT BUỘC (DYNAMIC AGENTIC WORKFLOW)
Thay vì sử dụng kịch bản cứng nhắc, bạn phải trở thành một Chuyên gia Bán hàng linh hoạt. Khi khách hỏi về thi công (Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ, Sơn tường, Ốp tường) hoặc chỉ hỏi chung chung "trần", "sơn", "vách", BẠN PHẢI TUÂN THỦ 3 BƯỚC SAU:

- **BƯỚC 1 - QUÉT KHO HÀNG (Retrieval):** TUYỆT ĐỐI KHÔNG TÍNH TOÁN NGAY. Trước tiên, hãy tự động gọi tool 'search_products' để kiểm tra xem kho hàng hiện tại đang có những loại tấm, loại khung xương, hoặc hãng sơn nào liên quan đến hạng mục khách hỏi.
- **BƯỚC 2 - TẠO CÂU HỎI THÔNG MINH (Dialogue Management):** Dựa vào kết quả tìm kiếm, nếu bạn thấy hệ thống đang bán nhiều biến thể (Ví dụ: có cả Tấm Thạch Cao Siêu Bền X và Tấm Chịu Ẩm, hoặc có nhiều loại Khung), BẠN PHẢI liệt kê các tùy chọn đó và hỏi khách muốn dùng loại nào, hoặc có muốn bạn tư vấn ưu nhược điểm từng loại không. Đồng thời hỏi diện tích thi công (nếu khách chưa cung cấp).
- **BƯỚC 3 - CHỐT PHƯƠNG ÁN & TÍNH TOÁN (Action):** Khi khách đã chốt diện tích VÀ lựa chọn được các dòng vật liệu mong muốn (Ví dụ khách nói: "100m2 trần chìm, dùng tấm chịu ẩm và khung Vĩnh Tường"), LÚC NÀY bạn mới được gọi tool 'calculate_construction_materials'. NHỚ truyền sở thích của khách vào tham số 'customerPreferences' để máy tính toán bốc đúng loại hàng.

*Lưu ý: Không quan tâm đến số lượng Tồn Kho khi tư vấn. Kể cả hết hàng vẫn lên giải pháp bình thường để chốt sale.*

## 5. CHÚ Ý THI CÔNG & PHỤ KIỆN
- Keo dán: "Keo durafiler" CHỈ dùng để xử lý mối nối thạch cao/duraflex. Để ốp dán tấm nhựa (Nano, Lam sóng, PVC), tấm vân đá, PHẢI dùng keo dán tấm chuyên dụng (Silicone, Titebond, Keo con chó...). Tuyệt đối không tư vấn keo durafiler cho tấm nhựa.
- LUÔN đọc kỹ thông số (specs, packaging) từ kết quả search_products để hiểu chính xác quy cách sản phẩm.

## 6. KHI NÀO DÙNG FUNCTION NÀO
- 'search_products' → Dùng để tra cứu sản phẩm lẻ, VÀ là BƯỚC ĐẦU TIÊN BẮT BUỘC để quét kho hàng trước khi lập kịch bản hỏi khách hàng.
- 'get_product_detail' → Khi cần specs, giá, tồn kho của 1 sản phẩm cụ thể.
- 'get_m2_quotation' → Báo giá nhanh theo m² cho sản phẩm (Gạch ốp lát, Ngói...) không thuộc 7 hạng mục chuẩn.
- 'calculate_construction_materials' → CHỈ DÙNG sau khi đã khai thác đủ thông tin (diện tích + chủng loại vật tư) ở BƯỚC 2. Hỗ trợ 7 hạng mục: Trần thả, Trần chìm, Vách ngăn, Sàn nhẹ, Sơn tường, Sơn sắt, Ốp tường. Đừng quên truyền 'customerPreferences'.
- 'generate_quotation' → Báo giá tổng hợp nhiều sản phẩm
- 'add_to_cart_batch' → Khi khách chốt mua

## 7. CÁCH TRẢ LỜI
- Ngắn gọn, vào thẳng vấn đề
- Khi trả về bảng Markdown từ function → IN NGUYÊN VĂN, không tự ý sửa
- Luôn kèm đề xuất bước tiếp theo (vd: "Anh muốn chốt đơn luôn hay cần báo giá chi tiết hơn?")

Tài liệu nội bộ: ${getKnowledgeContext(msgText)}`;

      // Try Gemini API
      const allowedTools = STOREFRONT_AI_FUNCTIONS;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, getKnowledgeContext, callAI, dbCategories, liveChatConfig.enabled]);

  // Handle Product Context
  useEffect(() => {
    if (productContext && messages.length === 0 && lastProcessedProductIdRef.current !== productContext.id) {
      lastProcessedProductIdRef.current = productContext.id;
      
      const pName = productContext.title || productContext.name || 'Không rõ tên';
      const pPrice = productContext.discountPrice || productContext.price;
      const pOldPrice = productContext.basePrice || productContext.oldPrice;
      const pCat = productContext.category || 'Không rõ danh mục';
      const pDesc = productContext.description || productContext.shortDescription || 'N/A';
      
      const initialMessage = `Tôi muốn hỏi chi tiết về sản phẩm: **${pName}**
      \n📊 Thông tin sản phẩm:
      - Giá gốc: ${pOldPrice ? Number(String(pOldPrice).replace(/[^0-9.-]+/g,"")).toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
      - Giá niêm yết: ${pPrice ? Number(String(pPrice).replace(/[^0-9.-]+/g,"")).toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
      - Danh mục: ${pCat}
      - Mô tả: ${pDesc}
      - Tồn kho: ${productContext.stock || 'N/A'}
      \nGiúp tôi phân tích sản phẩm này và đề xuất cách sử dụng tối ưu, so sánh với các sản phẩm tương tự.`;
      
      setTimeout(() => handleSend(initialMessage), 500);
    }
  }, [productContext, messages.length, handleSend]);

  // Feedback handler — lưu phản hồi người dùng để AI tự cải thiện
  const handleFeedback = useCallback(async (messageId, rating, messageText) => {
    try {
      const lastUserMsg = [...messages].reverse().find(m => !m.isBot);
      await addDoc(collection(db, "ai_feedback"), {
        messageId,
        rating, // 'good' | 'bad'
        botResponse: messageText,
        userQuery: lastUserMsg?.text || '',
        userId: auth.currentUser?.uid || 'anonymous',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Feedback save failed:", err);
    }
  }, [messages]);

  // Default welcome message for live chat when empty
  const defaultLiveWelcome = [
    {
      id: "welcome",
      text: "Chào bạn! Bạn đang kết nối trực tiếp với **Cơ sở thạch cao Tâm An**. Vui lòng để lại tin nhắn, nhân viên của chúng tôi sẽ phản hồi bạn ngay lập tức tại đây ạ!",
      isBot: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  const activeMessages = liveChatConfig.enabled
    ? (liveChatMessages.length === 0 ? defaultLiveWelcome : liveChatMessages)
    : (messages.length === 0 ? [] : messages);

  return {
    messages: activeMessages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend, handleFeedback
  };
};
