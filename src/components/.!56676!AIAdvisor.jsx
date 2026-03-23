import React, { useState, useEffect, useRef } from 'react';
import './AIAdvisor.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, orderBy } from 'firebase/firestore';

const AIAdvisor = ({ onNavigate }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Chào mừng bạn trở lại! Tôi là Chuyên gia Tư vấn ZBUILD. Tôi đã sẵn sàng phân tích dữ liệu sản phẩm, doanh thu và các chính sách chiết khấu năm 2026 cho đại lý của bạn. Bạn muốn xem báo cáo gì?", isBot: true }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isChatHidden, setIsChatHidden] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState({
    products: [],
    commercial: {},
    performance: [],
    memories: []
  });
  const [presentationData, setPresentationData] = useState({
    title: "Trung tâm Phân tích ZBUILD",
    type: "welcome",
    content: null
  });
  const chatEndRef = useRef(null);
  const [userName, setUserName] = useState('Khách hàng');

  // Load Knowledge Base from Firestore
  useEffect(() => {
    const loadKB = async () => {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) return;

      try {
        // Lấy tri thức nền (tối đa mẩu tin mới nhất)
        const knSnap = await getDocs(query(collection(db, "ai_knowledge_base"), orderBy("timestamp", "desc"), limit(20)));
        const knowledgeChunks = knSnap.docs.map(d => d.data());

        // Lấy doanh thu của người đăng nhập HIỆN TẠI
        const perfSnap = await getDocs(query(collection(db, "agency_performance"), where("email", "==", userEmail), limit(1)));
        const performanceData = perfSnap.docs.length > 0 ? perfSnap.docs[0].data() : null;

        // Tự động nhận diện tên xưng hô
        const dynamicName = performanceData?.name || auth.currentUser?.displayName || userEmail.split('@')[0];
        setUserName(dynamicName);

        setKnowledgeBase({ 
          products: knowledgeChunks.filter(c => c.category === 'Sản Phẩm'),
          commercial: knowledgeChunks.filter(c => c.category === 'Chính Sách'),
          technical: knowledgeChunks.filter(c => c.category === 'Kỹ Thuật' || c.category === 'Lắp Đặt'),
          performance: performanceData ? [performanceData] : []
        });
      } catch (err) {
        console.error("Failed to load Knowledge from Firestore:", err);
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

  const callDeepSeek = async (userPrompt, chatHistory) => {
    const apiKey = import.meta.env.VITE_DEEPSEEK_ADVISOR_KEY;
    const apiUrl = "https://api.deepseek.com/v1/chat/completions";

    const systemPrompt = `
      Bạn là một Chuyên gia Tư vấn Cao cấp của ZBUILD (Hệ thống cung cấp vật liệu xây dựng DuraFlex).
      Nhiệm vụ: Tư vấn chiến lược kinh doanh, kỹ thuật sản phẩm và chính sách chiết khấu.

      Dữ liệu tri thức Markdown (Knowledge Fragments):
      ${knowledgeBase.products.map(p => p.content_markdown).join('\n---\n')}
      ${knowledgeBase.technical?.map(t => t.content_markdown).join('\n---\n')}
      ${knowledgeBase.commercial.map(c => c.content_markdown).join('\n---\n')}

      Doanh thu của người dùng (${auth.currentUser?.email || 'Guest'}): 
      ${JSON.stringify(knowledgeBase.performance[0] || "Chưa có dữ liệu")}

      Hướng dẫn phản hồi:
      1. Luôn lịch sử, chuyên nghiệp, xưng hô là "Tôi" và gọi người dùng là "${userName === 'Khách hàng' ? 'Anh/Chị' : userName}".
      2. TRÌNH BÀY BẰNG MARKDOWN: Sử dụng danh sách (bullet points), in đậm (bold) và xuống dòng để câu trả lời dễ đọc. Tránh viết liền một khối văn bản quá dài.
      3. GIAO DIỆN TRỰC QUAN (Presentation Board): Nếu người dùng yêu cầu so sánh, xem báo cáo, hoặc tính toán, hãy tự tạo một bảng dữ liệu và gửi kèm lệnh:
         [[RENDER_DATA_BOARD: { "title": "...", "description": "...", "headers": ["...", "..."], "rows": [["...", "..."], ["...", "..."]] }]]
         (Lệnh này phải đặt ở cuối cùng câu trả lời).
      4. Phản hồi bằng Tiếng Việt.
    `;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory.map(m => ({ role: m.isBot ? "assistant" : "user", content: m.text })),
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("DeepSeek API Error:", error);
      return "Xin lỗi, tôi gặp chút vấn đề khi kết nối với hệ thống phân     const botResult = await callDeepSeek(userMsg.text, messages);
    
    let cleanResponse = botResult;
    let newPresentation = null;

    // Phân tích các lệnh UI từ bot
    if (botResult.includes('[[RENDER_DATA_BOARD:')) {
      try {
        const jsonMatch = botResult.match(/\[\[RENDER_DATA_BOARD:\s*({.*?})\s*\]\]/s);
        if (jsonMatch) {
          const boardData = JSON.parse(jsonMatch[1]);
          cleanResponse = botResult.replace(jsonMatch[0], '').trim();
          newPresentation = {
            title: boardData.title,
            type: "table",
            description: boardData.description,
            content: {
              headers: boardData.headers,
              rows: boardData.rows
            }
          };
        }
      } catch (err) {
        console.error("Parse Board Data Error:", err);
      }
    } else if (botResult.includes('[[SHOW_REVENUE_TABLE]]')) {
      cleanResponse = botResult.replace('[[SHOW_REVENUE_TABLE]]', '').trim();
      const myAgency = knowledgeBase.performance[0];
      if (myAgency) {
        newPresentation = {
          title: "Phân Tích Doanh Thu Chi Tiết",
          type: "table",
          description: `Đại lý: ${myAgency.name}`,
          content: {
            headers: ["Mã Đơn", "Ngày", "Giá Trị", "Trạng Thái"],
            rows: myAgency.recent_orders?.map(o => [o.id, o.date, o.value.toLocaleString(), o.status]) || [],
            footer: `Doanh thu năm nay: ${myAgency.stats?.current_revenue?.toLocaleString()} VNĐ`
          }
        };
      }
    }

    // Hiệu ứng stream chữ cho cảm giác nhanh hơn
    const botMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: botMsgId, text: '', isBot: true }]);
    
    let currentText = '';
    const textToStream = cleanResponse;
    const speed = 10; // ms per char

    for (let i = 0; i < textToStream.length; i++) {
       currentText += textToStream[i];
       setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: currentText } : m));
       if (i % 5 === 0) await new Promise(r => setTimeout(r, speed));
    }

    if (newPresentation) setPresentationData(newPresentation);
    setIsTyping(false);
