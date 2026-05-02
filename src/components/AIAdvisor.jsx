import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Fuse from 'fuse.js';
import { AI_FUNCTIONS, executeFunction } from '../services/aiFunctions';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import './AIAdvisor.css';

const AIAdvisor = ({ onNavigate }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isChatHidden, setIsChatHidden] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeModel, setActiveModel] = useState('DeepSeek-V3');
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [productContext, setProductContext] = useState(location.state?.productContext || null);

  const [presentationData, setPresentationData] = useState({
    title: "Trung Tâm Phân Tích Dữ Liệu",
    description: "Hệ thống đang theo dõi và tối ưu hiệu suất kinh doanh thời gian thực.",
    boards: [],
    activeBoardIndex: 0,
    type: 'welcome',
    stats: [
      { id: 1, label: "Tổng doanh số", value: "124,592,000đ", change: "+12.5%", trend: 'up' },
      { id: 2, label: "Tỷ lệ chuyển đổi", value: "3.84%", change: "+2.1%", trend: 'up' },
      { id: 3, label: "Khách hàng mới", value: "18,245", change: "+852", trend: 'up' },
      { id: 4, label: "Giá trị đơn TB", value: "68,400đ", change: "-1.2%", trend: 'down' }
    ]
  });

  const [knowledgeBase, setKnowledgeBase] = useState({ all_units: [], raw_docs: [], performance: [] });
  const [userName, setUserName] = useState("Thong Nguyen");
  const chatEndRef = useRef(null);
  const lastProcessedProductIdRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.add('advisor-active-body');
    return () => document.body.classList.remove('advisor-active-body');
  }, []);

  useEffect(() => {
    // Only process product context once per unique product, and only when messages are empty
    if (
      productContext && 
      messages.length === 0 && 
      lastProcessedProductIdRef.current !== productContext.id
    ) {
      lastProcessedProductIdRef.current = productContext.id;
      
      const initialMessage = `Tôi muốn hỏi chi tiết về sản phẩm: **${productContext.title}**

📊 Thông tin sản phẩm:
- Giá gốc: ${productContext.basePrice ? productContext.basePrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
- Giá niêm yết: ${productContext.discountPrice ? productContext.discountPrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}
- Danh mục: ${productContext.category}
- Mô tả: ${productContext.description || 'N/A'}
- Tồn kho: ${productContext.stock || 'N/A'}

Giúp tôi phân tích sản phẩm này và đề xuất cách sử dụng tối ưu, so sánh với các sản phẩm tương tự.`;

      setInput('');
      // Only call handleSend - it will add user message and handle AI response
      setTimeout(() => {
        handleSend(initialMessage);
      }, 500);
    }
  }, [productContext]);

  useEffect(() => {
    const loadKB = async () => {
      try {
        const unitsSnap = await getDocs(collection(db, "ai_knowledge_units"));
        const knowledgeUnits = unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const baseSnap = await getDocs(collection(db, "ai_knowledge_base"));
        const knowledgeBaseRaw = baseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Load past consultations to improve intelligence
        const consultationsSnap = await getDocs(query(collection(db, "ai_consultations"), orderBy("createdAt", "desc"), limit(50)));
        const pastConsultations = consultationsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                category: "Lịch sử tư vấn thông minh (Nên tham khảo)",
                content: `Khách hỏi: ${data.userQuery} \n=> Bot Đã Trả Lời: ${data.botResponse}`,
                keywords: data.userQuery ? data.userQuery.split(" ") : [],
                summary: "Dữ liệu học từ các cuộc tư vấn thực tế trong quá khứ"
            };
        });

        // Load products for quick suggestions
        const productsSnap = await getDocs(query(collection(db, "products"), orderBy("title", "asc")));
        const products = productsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            category: data.category || 'Chung',
            image: data.image || null
          };
        }).filter(p => p.title); // Only include products with a title
        setProductSuggestions(products);

        const userEmail = auth.currentUser?.email || "";
        const perfQuery = query(collection(db, "agency_performance"), where("email", "==", userEmail), limit(1));
        const perfSnap = await getDocs(perfQuery);
        const performanceData = perfSnap.docs.length > 0 ? perfSnap.docs[0].data() : null;

        if (performanceData?.name || auth.currentUser?.displayName) {
          setUserName(performanceData?.name || auth.currentUser?.displayName || "Thong Nguyen");
        }

        setKnowledgeBase({ 
          all_units: [...knowledgeUnits, ...pastConsultations], 
          raw_docs: knowledgeBaseRaw,
          performance: performanceData ? [performanceData] : []
        });
      } catch (err) {
        console.error("Knowledge Loading Error:", err);
      }
    };
    loadKB();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderBoard = (board) => {
    if (!board) return null;

    switch (board.type) {
      case 'table':
        return (
          <div className="table-display-container" style={{ width: '100%' }}>
            {isMobile ? (
              <div className="mobile-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {board.content.rows?.map((row, i) => (
                  <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    {row.map((cell, j) => {
                      const headerName = board.content.headers?.[j] || '';
                      if (j === 0) {
                        return (
                          <div key={j} style={{ fontWeight: 800, fontSize: '1.1rem', color: '#DAA520', borderBottom: '2px dashed #E2E8F0', paddingBottom: '10px', marginBottom: '15px', textAlign: 'center' }}>
                            {headerName ? `${headerName}: ${cell}` : cell}
                          </div>
                        )
                      }
                      return (
                        <div key={j} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: j === row.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                          {headerName && <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{headerName}</span>}
                          <span style={{ fontSize: '1rem', color: '#1A2130', lineHeight: '1.5', whiteSpace: 'normal', wordBreak: 'break-word' }}>{cell}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                <table className="premium-table" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr>
                      {board.content.headers?.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {board.content.rows?.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => <td key={j}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case 'chart':
        return (
          <div className="chart-wrapper" style={{ height: '400px', width: '100%', marginTop: '20px' }}>
             <ResponsiveContainer width="100%" height="100%">
                {board.chartType === 'line' ? (
                  <LineChart data={board.content} margin={{ top: 20, right: isMobile ? 0 : 30, left: isMobile ? -20 : 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="value" stroke="#DAA520" strokeWidth={4} dot={{ r: 6, fill: '#DAA520' }} activeDot={{ r: 8 }} />
                  </LineChart>
                ) : board.chartType === 'pie' ? (
                  <PieChart>
                     <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                     <Pie data={board.content} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={120} fill="#DAA520" label>
                        {board.content?.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={['#DAA520', '#1A2130', '#64748B', '#cbd5e1'][index % 4]} />
                        ))}
                     </Pie>
                     <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                ) : (
                  <BarChart data={board.content} margin={{ top: 20, right: isMobile ? 0 : 30, left: isMobile ? -20 : 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#DAA520" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                )}
             </ResponsiveContainer>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSend = async (msgText) => {
    if (!msgText?.trim()) return;
    const userMsg = { role: 'user', text: msgText, id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Lấy thêm bối cảnh 2 câu gần nhất của user để nối vào search query (tránh việc khách chat "đúng rồi tư vấn đi" thì search bị rỗng)
      const recentUserMessages = messages.filter(m => !m.isBot).slice(-2).map(m => m.text).join(" ");
      const searchContext = `${recentUserMessages} ${msgText}`;

      const getKnowledgeContext = () => {
        const units = knowledgeBase.all_units || [];
        if (!units.length) return "";
        const fuse = new Fuse(units, { keys: ['content', 'keywords', 'summary', 'category'], threshold: 0.45, ignoreLocation: true });
        // Lấy top 20 kết quả (Mở rộng tầm nhìn của bot) với searchContext thay vì chỉ msgText
        const results = fuse.search(searchContext);
        let docsToUse = results.slice(0, 20);
        
        // Cải tiến: KHÔNG nạp bậy bạ 15 bài ngẫu nhiên nếu search không ra, để tránh Bot liên tưởng sai ngữ cảnh.
        if (!results.length) {
          docsToUse = []; 
        }
        
        let contextText = "==== TÀI LIỆU NỘI BỘ ====\n";
        if (docsToUse.length === 0) {
            contextText += "[TRỐNG - CHƯA CÓ TRONG CƠ SỞ DỮ LIỆU]\n";
        } else {
            docsToUse.forEach(r => contextText += `- [Chuyên mục: ${r.item.category || 'Chung'}] Nội dung: ${r.item.content}\n---\n`);
        }
        return contextText + "==========================\n";
      };

      const systemPrompt = `Bạn là Giám Đốc Kinh Doanh B2B của Z-BUILD, tư vấn bán CÁC Giải pháp khác nhau (Từ Vật liệu xây dựng, Tấm sàn, đến Phần mềm App Bán Hàng, Công nghệ). Người dùng hiện tại là ĐẠI LÝ: ${userName}.
Tuyệt đối không luyên thuyên lan man. NGUYÊN TẮC TỐI THƯỢNG: Đại lý hỏi về SẢN PHẨM NÀO thì PHẢI TẬP TRUNG 100% phân tích SẢN PHẨM ĐÓ.

🔧 NĂNG LỰC ĐẶC BIỆT - FUNCTION CALLING:
Bạn có quyền truy cập TRỰC TIẾP vào cơ sở dữ liệu cửa hàng Zbuild thông qua các tools. Khi người dùng hỏi về:
- Giá sản phẩm, tồn kho → gọi search_products hoặc get_product_detail
- Đếm sản phẩm, danh mục → gọi count_products
- Trạng thái đơn hàng → gọi check_order_status
- Lịch sử đơn hàng → gọi get_order_history
- Lập báo giá → gọi generate_quotation
- Thống kê cửa hàng → gọi get_store_stats
HÃY CHỦ ĐỘNG SỬ DỤNG TOOLS để lấy dữ liệu THỰC TẾ thay vì trả lời chung chung.

Đây là dữ liệu kiến thức nội bộ BỔ SUNG (chứa thông tin tính năng, giá net, hệ số lời, công dụng...) liên quan đến câu hỏi:
${getKnowledgeContext()}

Quan trọng: CƠ CHẾ ĐÁP ỨNG THÔNG TIN
1. ƯU TIÊN SỬ DỤNG TOOLS: Khi khách hỏi về sản phẩm, giá, tồn kho, đơn hàng → GỌI FUNCTION trước để lấy dữ liệu REAL-TIME. Kết hợp với kiến thức nội bộ để trả lời chính xác nhất.
2. Nếu tools không trả về kết quả VÀ tài liệu nội bộ TRỐNG → trả lời: "Dạ hiện tại trên hệ thống dữ liệu em chưa cập nhật thông tin về vấn đề này".
3. TUYỆT ĐỐI KHÔNG TỰ BỊA DATA. Chỉ dùng data từ tools hoặc tài liệu nội bộ.
4. CHỈ KHI NÀO có THỐNG KÊ RÕ RÀNG (từ tools hoặc tài liệu) thì mới dùng cú pháp JSON RENDER_DATA_BOARD.
5. Không tự tạo biểu đồ (chart) nếu số liệu không rõ ràng.

Cú pháp JSON (ĐÂY CHỈ LÀ CẤU TRÚC MẪU. KHÔNG ĐƯỢC COPY. TUYỆT ĐỐI KHÔNG TỰ BỊA DATA):
[[RENDER_DATA_BOARD: {
  "title": "So Sánh Ngắn",
  "description": "Phân tích số liệu thật từ Tài Liệu",
  "type": "multi",
  "stats": [
     {"id":1, "label":"Số lượng", "value":"X Kiện", "change":"= Y Tấm", "trend":"up"}
  ],
  "boards": [
    {
      "name": "Bảng Báo Giá",
      "type": "table",
      "content": {
        "headers": ["Lựa chọn", "Giá"],
        "rows": [ ["Mẫu A", "100.000 đ"] ]
      }
    }
  ]
}]]`;

      const botResult = await (async () => {
        const openClawUrl = import.meta.env.VITE_OPENCLAW_API_URL;
        
        // Try OpenClaw API first
        if (openClawUrl) {
          try {
            console.log("🚀 Calling OpenClaw API:", openClawUrl);
            const ocRes = await fetch(openClawUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: auth.currentUser?.uid || "zbuild_web_user",
                message: msgText
              })
            });
            
            if (ocRes.ok) {
              const data = await ocRes.json();
              setActiveModel('OpenClaw Intelligence');
              return data.response;
            }
            console.warn("OpenClaw API unreachable or error, falling back to legacy...");
          } catch (err) {
            console.warn("OpenClaw Connection Failed:", err);
          }
        }

        const dsApiKey = import.meta.env.VITE_DEEPSEEK_ADVISOR_KEY;
        const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
        
        if (!dsApiKey) {
          throw new Error("DeepSeek API key not configured. Please add VITE_DEEPSEEK_ADVISOR_KEY to .env.local");
        }
        
        // Setup text history memory
        const messageHistory = messages.map(m => ({
           role: m.isBot ? "assistant" : "user",
           content: m.text
        }));

        const apiMessages = [
           { role: "system", content: systemPrompt }, 
           ...messageHistory,
           { role: "user", content: msgText }
        ];

        // ======== DeepSeek với Function Calling ========
        try {
          const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: apiMessages,
              tools: AI_FUNCTIONS,
              tool_choice: "auto",
              temperature: 0.3
            })
          });
          
          if (!dsRes.ok) throw new Error("DeepSeek Error or Out of Balance");
          let d = await dsRes.json();
          setActiveModel('DeepSeek-V3');
          
          let responseMsg = d.choices[0]?.message;
          
          // Function calling loop (max 3 rounds)
          let rounds = 0;
          while (responseMsg?.tool_calls && responseMsg.tool_calls.length > 0 && rounds < 3) {
            rounds++;
            console.log(`🔧 AI Function Call [Round ${rounds}]:`, responseMsg.tool_calls.map(tc => tc.function.name));
            
            // Add assistant message with tool_calls
            apiMessages.push(responseMsg);
            
            // Execute all tool calls in parallel
            const toolResults = await Promise.all(
              responseMsg.tool_calls.map(async (tc) => {
                try {
                  const result = await executeFunction(tc.function.name, tc.function.arguments);
                  console.log(`✅ ${tc.function.name} result:`, result);
                  return {
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify(result, null, 2)
                  };
                } catch (err) {
                  return {
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ error: err.message })
                  };
                }
              })
            );
            
            // Add tool results to messages
            apiMessages.push(...toolResults);
            
            // Call API again with tool results
            const followUp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages: apiMessages,
                tools: AI_FUNCTIONS,
                tool_choice: "auto",
                temperature: 0.3
              })
            });
            
            if (!followUp.ok) break;
            d = await followUp.json();
            responseMsg = d.choices[0]?.message;
          }
          
          return responseMsg?.content || "Hệ thống đang bận, bạn thử lại sau nhe.";
        } catch(e) {
          console.warn("DeepSeek Failed: Triển khai Groq dự phòng...", e);
          
          if (!groqApiKey) {
            return "⚠️ Lỗi: DeepSeek API không hoạt động và Groq key chưa được cấu hình. Vui lòng kiểm tra .env.local";
          }
          
          setActiveModel('Groq Llama-3.3');
          
          // Groq Fallback (không hỗ trợ function calling)
          try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
              body: JSON.stringify({ messages: apiMessages, model: "llama-3.3-70b-versatile", temperature: 0.3 })
            });
            const d = await groqRes.json();
            return d.choices[0]?.message?.content || "Groq AI cũng đang bảo trì, bạn thử lại sau nhe.";
          } catch(err2) {
             return "Lỗi toàn hệ thống cả 2 luồng AI. Xin liên hệ kĩ thuật!";
          }
        }
      })();

      let cleanResponse = botResult;
      let boardData = null;
      const dataMatch = botResult.match(/\[\[RENDER_DATA_BOARD:\s*(\{[\s\S]*?\})\s*\]\]/);
      if (dataMatch) {
         try {
           boardData = JSON.parse(dataMatch[1]);
           cleanResponse = botResult.replace(dataMatch[0], '').trim();
         } catch(e) {}
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, text: cleanResponse, board: boardData, isBot: true, time: "Vừa xong" }]);
      setIsTyping(false);

      // Tự động học & ghi nhớ cuộc hội thoại vào Firestore để làm kiến thức cho tương lai
      if (cleanResponse && !cleanResponse.includes("Dạ hiện tại trên hệ thống dữ liệu")) {
        try {
          await addDoc(collection(db, "ai_consultations"), {
            userQuery: msgText,
            botResponse: cleanResponse,
            createdAt: serverTimestamp(),
            userId: auth.currentUser?.uid || "anonymous_agency"
          });
        } catch(err) {
          console.warn("Lỗi lưu lịch sử tư vấn:", err);
        }
      }
    } catch (error) {
      console.error("handleSend Error:", error);
      setIsTyping(false);
    }
  };

  const isMobile = windowWidth < 768;

  return (
    <div id="ai-advisor-root" className={`ai-advisor-dashboard ${isMobile ? 'mobile' : ''} ${isSidebarHidden ? 'sidebar-hidden' : ''}`} style={{ width: '100%', height: '100vh', display: 'flex', background: '#F8FAFC', paddingBottom: isMobile ? '65px' : '0' }}>
      {/* Sidebar */}
      {!isMobile && (
        <aside className="advisor-side-nav">
          <div className="nav-brand">
            <div className="avatar-gold">ZB</div>
            <span className="brand-name">Z-BUILD</span>
          </div>
          
          <nav className="nav-links">
            <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
               <span>Bảng điều khiển</span>
            </button>
            <button className={`nav-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></svg>
               <span>Sản phẩm</span>
            </button>
            <button className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
               <span>Đơn hàng</span>
            </button>
            <button className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
               <span>Phân tích</span>
            </button>
            <div style={{ padding: '0 20px', margin: '15px 0' }}><hr style={{ border: 'none', borderTop: '1px solid #E2E8F0' }} /></div>
            <button className="nav-btn" onClick={() => onNavigate('home')} style={{ color: '#E11D48' }}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ stroke: '#E11D48' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
               <span>Thoát AI Advisor</span>
            </button>
          </nav>

          <footer className="nav-footer">
            <div className="user-avatar">{userName.charAt(0)}</div>
            <div className="user-details">
              <h4>{userName}</h4>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Đại lý Gold</span>
            </div>
          </footer>
        </aside>
      )}

      {/* Main Content */}
      <main className="advisor-main-content">
        <header className="content-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {!isMobile && (
              <button 
                onClick={() => setIsSidebarHidden(!isSidebarHidden)} 
                style={{ background: '#F1F5F9', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A2130" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
            )}
            <div className="search-box" style={{ background: '#F1F5F9', padding: '8px 16px', borderRadius: '100px', display: 'flex', gap: '10px', width: '300px' }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
               <input type="text" placeholder="Tìm kiếm dữ liệu..." style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
            </div>
          </div>
          <div className="top-bar-right" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button 
              onClick={() => onNavigate && onNavigate('home')}
              style={{ background: 'white', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2130" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {!isMobile && <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A2130' }}>Trang Chủ</span>}
            </button>
          </div>
        </header>

        <div className="scroll-area" style={{ padding: isMobile ? '0 15px' : '0 40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', paddingBottom: '120px' }}>
          {messages.length === 0 ? (
            <div className="welcome-banner" style={{ marginTop: isMobile ? '40px' : '60px', textAlign: 'center' }}>
               <h1 style={{ fontSize: isMobile ? '2.2rem' : '2.8rem', fontWeight: 900, color: '#1A2130' }}>Chào {userName.split(' ')[0]}, tôi có thể giúp gì?</h1>
               <p style={{ color: '#64748B', fontSize: '1.1rem', maxWidth: '600px', margin: '15px auto', lineHeight: '1.6' }}>Hãy mô tả nhu cầu của khách hàng, hoặc hỏi tôi về giá cả, cấu tạo sản phẩm, so sánh lợi nhuận giữa các loại kiện hàng.</p>
               
               {/* Quick Suggestions */}
               {productSuggestions.length > 0 && (
                 <div className="quick-suggestions-container" style={{ maxWidth: '700px', margin: '35px auto 0', textAlign: 'left' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                     <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gợi ý nhanh</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     {(suggestionsExpanded ? productSuggestions : productSuggestions.slice(0, 3)).map((product, idx) => (
                       <button
                         key={product.id}
                         className="suggestion-chip"
                         onClick={() => {
                           handleSend(`Tư vấn cho tôi về sản phẩm "${product.title}"`);
                         }}
                         style={{
                           display: 'flex',
                           alignItems: 'center',
                           gap: '14px',
                           padding: '14px 20px',
                           background: 'white',
                           border: '1px solid #E2E8F0',
                           borderRadius: '16px',
                           cursor: 'pointer',
                           textAlign: 'left',
                           transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                           boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                           animation: `suggestionSlideIn 0.4s ease ${idx * 0.08}s both`,
                           width: '100%',
                           fontSize: '1rem',
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.borderColor = '#DAA520';
                           e.currentTarget.style.boxShadow = '0 4px 20px rgba(218,165,32,0.15)';
                           e.currentTarget.style.transform = 'translateY(-2px)';
                           e.currentTarget.style.background = '#FFFBEB';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.borderColor = '#E2E8F0';
                           e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                           e.currentTarget.style.transform = 'translateY(0)';
                           e.currentTarget.style.background = 'white';
                         }}
                       >
                         {product.image ? (
                           <img src={product.image} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid #F1F5F9' }} />
                         ) : (
                           <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #FFFBEB, #FEF08A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2"><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></svg>
                           </div>
                         )}
                         <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ fontWeight: 700, color: '#1A2130', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             Tư vấn về: {product.title}
                           </div>
                           <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>{product.category}</div>
                         </div>
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                       </button>
                     ))}
                   </div>

                   {/* Expand/Collapse Arrow */}
                   {productSuggestions.length > 3 && (
                     <button
                       onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                       style={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         gap: '8px',
                         margin: '12px auto 0',
                         padding: '10px 24px',
                         background: 'transparent',
                         border: '1px dashed #CBD5E1',
                         borderRadius: '100px',
                         cursor: 'pointer',
                         color: '#64748B',
                         fontSize: '0.85rem',
                         fontWeight: 600,
                         transition: 'all 0.25s ease',
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.borderColor = '#DAA520';
                         e.currentTarget.style.color = '#DAA520';
                         e.currentTarget.style.background = '#FFFBEB';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.borderColor = '#CBD5E1';
                         e.currentTarget.style.color = '#64748B';
                         e.currentTarget.style.background = 'transparent';
                       }}
                     >
                       {suggestionsExpanded ? (
                         <>
                           Thu gọn
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.3s ease' }}><path d="M18 15l-6-6-6 6"/></svg>
                         </>
                       ) : (
                         <>
                           Xem thêm {productSuggestions.length - 3} sản phẩm
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.3s ease' }}><path d="M6 9l6 6 6-6"/></svg>
                         </>
                       )}
                     </button>
                   )}
                 </div>
               )}
            </div>
          ) : (
            <div className="chat-history" style={{ padding: '20px 0' }}>
               {messages.map((m, i) => (
                 <div key={i} style={{ marginBottom: isMobile ? '25px' : '40px', display: 'flex', flexDirection: 'column', alignItems: m.isBot ? 'flex-start' : 'flex-end', width: '100%' }}>
                    
                    {/* KHUNG TIN NHẮN TEXT CỦA BÊN NÀO TỰ LỆCH BÊN ĐÓ */}
                    {m.text && (
                      <div className="chat-msg-bubble" style={{ 
                        maxWidth: m.isBot ? '100%' : (isMobile ? '90%' : '80%'), 
                        padding: isMobile ? '12px 18px' : '16px 24px', 
                        borderRadius: '20px', 
                        background: m.isBot ? 'transparent' : 'linear-gradient(135deg, #DAA520, #E4B341)', 
                        color: m.isBot ? '#1A2130' : 'white',
                        boxShadow: m.isBot ? 'none' : '0 10px 25px rgba(218,165,32,0.3)',
                        fontSize: isMobile ? '1rem' : '1.05rem',
                        lineHeight: '1.7',
                        width: m.isBot ? '100%' : 'auto',
                        overflowX: 'auto'
                      }}>
                         <ReactMarkdown 
                           remarkPlugins={[remarkGfm]}
                           components={{
                             table: ({node, ...props}) => (
                               <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                                 <table {...props} style={{ minWidth: isMobile ? 'auto' : '600px', width: '100%' }} />
                               </div>
                             )
                           }}
                         >
                           {m.text}
                         </ReactMarkdown>
                      </div>
                    )}

                    {/* HIỂN THỊ BẢNG TRỰC TIẾP TRONG CHAT (Chỉ hiện khi là Bot) */}
                    {m.board && (
                      <div className="inline-board-container" style={{ width: '100%', maxWidth: '1000px', background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', padding: isMobile ? '16px' : '30px', marginTop: '15px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ width: '36px', height: '36px', background: '#FFFBEB', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            </div>
                            <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', color: '#1A2130', margin: 0, fontWeight: 800, flex: 1, lineHeight: '1.3' }}>{m.board.title}</h3>
                         </div>
                         <p style={{ color: '#64748B', marginBottom: '25px', paddingLeft: isMobile ? '0' : '55px', fontSize: '1rem', lineHeight: '1.5' }}>{m.board.description}</p>
                         
                         {m.board.stats && (
                           <div className="stats-grid" style={{ marginBottom: '30px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                             {m.board.stats.map(s => (
                               <div key={s.id} className="stat-card" style={{ background: '#F8FAFC', padding: isMobile ? '12px' : '20px', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                                  <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: 900, margin: '6px 0', color: '#1A2130', wordBreak: 'break-word' }}>{s.value}</h2>
                                  {s.change && <span style={{ fontSize: '0.75rem', color: s.trend === 'up' ? '#10B981' : (s.trend === 'down' ? '#E11D48' : '#64748B'), fontWeight: 700, background: s.trend === 'up' ? '#DCFCE7' : (s.trend === 'down' ? '#FEE2E2' : '#F1F5F9'), padding: '4px 8px', borderRadius: '100px', display: 'inline-block' }}>
                                    {s.trend === 'up' ? '↗ ' : (s.trend === 'down' ? '↘ ' : '• ')}{s.change}
                                  </span>}
                               </div>
                             ))}
                           </div>
                         )}

                         <div className="boards-list">
                            {m.board.boards?.map((b, idx) => (
                               <div key={idx} style={{ marginBottom: '35px' }}>
                                  <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: '#1A2130', fontWeight: 700 }}>{b.name}</h4>
                                  <div style={{ background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', padding: b.type === 'chart' ? (isMobile ? '10px' : '20px') : '0' }}>
                                    {renderBoard({ ...b, type: b.type })}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
               ))}
               <div ref={chatEndRef} />
               
               {/* LOADING DOTS */}
               {isTyping && (
                 <div style={{ alignSelf: 'flex-start', background: '#FFFBEB', padding: '12px 20px', borderRadius: '15px', color: '#DAA520', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #FEF08A', boxShadow: '0 4px 15px rgba(218,165,32,0.1)' }}>
                    <div className="dot-pulse" style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'monospace' }}>Z</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520'}}></span>
                      <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520', animationDelay: '0.2s'}}></span>
                      <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520', animationDelay: '0.4s'}}></span>
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>

        {/* CỤM THANH CHAT CỐ ĐỊNH Ở ĐÁY KIỂU MỞ RỘNG TỐI ĐA */}
        <div className="chat-input-container" style={{ position: 'fixed', bottom: '0', left: isSidebarHidden || isMobile ? '0' : '260px', right: '0', background: 'white', padding: isMobile ? '10px 15px 15px' : '10px 40px 20px', borderTop: '1px solid #E2E8F0', zIndex: 10, transition: 'left 0.3s ease' }}>
           <div className="input-wrapper" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '15px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '100px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Nhập yêu cầu phân tích, cấu tạo sản phẩm, gửi bảng báo giá mảng chênh lệnh..." 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isTyping) {
                     handleSend(input);
                  }
                }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1.05rem', color: '#1A2130', padding: '10px 15px' }}
                disabled={isTyping}
              />
              <button 
                onClick={() => handleSend(input)}
                disabled={isTyping || !input.trim()}
                style={{ background: (isTyping || !input.trim()) ? '#CBD5E1' : '#DAA520', color: 'white', border: 'none', width: '46px', height: '46px', borderRadius: '50%', fontWeight: 'bold', cursor: (isTyping || !input.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (isTyping || !input.trim()) ? 'none' : '0 5px 15px rgba(218,165,32,0.4)', flexShrink: 0 }}
              >
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
           </div>
           
           {/* THÔNG TIN AI VÀ MODEL Ở DƯỚI CÙNG */}
           <div style={{ maxWidth: '1000px', margin: '10px auto 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
             <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '4px 10px', borderRadius: '15px', border: '1px solid #E2E8F0' }}>
               <span className={isTyping ? "dot-pulse" : ""} style={{ width: '6px', height: '6px', background: activeModel.includes('Groq') ? '#F59E0B' : '#10B981', borderRadius: '50%' }}></span>
               <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Cốt lõi AI: {activeModel}</span>
             </div>
             {!isMobile && (
               <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>
                 - AI Supervisor Z-BUILD. Bảng dữ liệu tự động thay thế bằng nội dung thực tế.
               </p>
             )}
           </div>
        </div>
      </main>
    </div>
  );
};

export default AIAdvisor;
