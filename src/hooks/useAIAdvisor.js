import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';

/**
 * Custom hook to manage AI Advisor state and logic.
 */
export const useAIAdvisor = (productContext) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeModel, setActiveModel] = useState('DeepSeek-V3');
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
  }, [messages, knowledgeBase]);

  const handleSend = useCallback(async (msgText) => {
    if (!msgText?.trim()) return;
    const userMsg = { role: 'user', text: msgText, id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const systemPrompt = `Bạn là Giám Đốc Kinh Doanh B2B của Z-BUILD, tư vấn cho ĐẠI LÝ: ${userName}.
      🔧 NĂNG LỰC ĐẶC BIỆT - FUNCTION CALLING: Sử dụng tools khi cần thông tin real-time về sản phẩm, đơn hàng, thống kê.
      Tài liệu nội bộ: ${getKnowledgeContext(msgText)}`;

      // Try OpenClaw API, then DeepSeek, then Groq
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
  }, [userName, getKnowledgeContext, callAI]);

  const callAI = useCallback(async (msgText, systemPrompt) => {
    const openClawUrl = import.meta.env.VITE_OPENCLAW_API_URL;
    if (openClawUrl) {
      try {
        const res = await fetch(openClawUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: auth.currentUser?.uid || "zbuild_web_user", message: msgText })
        });
        if (res.ok) {
          const data = await res.json();
          setActiveModel('OpenClaw Intelligence');
          return data.response;
        }
      } catch (err) { console.warn("OpenClaw failed", err); }
    }

    const dsApiKey = import.meta.env.VITE_DEEPSEEK_ADVISOR_KEY;
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    const history = messages.map(m => ({ role: m.isBot ? "assistant" : "user", content: m.text }));
    const apiMessages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: msgText }];

    // DeepSeek with Function Calling
    if (dsApiKey) {
      try {
        let res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
          body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, tools: AI_FUNCTIONS, tool_choice: "auto", temperature: 0.3 })
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
              return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
            }));
            apiMessages.push(...toolResults);
            const followUp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
              body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, tools: AI_FUNCTIONS, tool_choice: "auto", temperature: 0.3 })
            });
            if (!followUp.ok) break;
            d = await followUp.json();
            responseMsg = d.choices[0]?.message;
          }
          return responseMsg?.content || "Bot không phản hồi.";
        }
      } catch (err) { console.warn("DeepSeek failed", err); }
    }

    // Groq Fallback
    if (groqApiKey) {
      try {
        setActiveModel('Groq Llama-3.3');
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
          body: JSON.stringify({ messages: apiMessages, model: "llama-3.3-70b-versatile", temperature: 0.3 })
        });
        const d = await res.json();
        return d.choices[0]?.message?.content || "Groq không phản hồi.";
      } catch (err) { console.error("Groq failed", err); }
    }

    return "Lỗi toàn hệ thống cả 2 luồng AI.";
  }, [messages]);

  return {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  };
};
