import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const OpenClawChatWidget = ({ user }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Chào bạn! Tôi là **Dunvex Market Advisor** (Powered by OpenClaw). Tôi đã sẵn sàng phân tích dữ liệu thị trường mới nhất. Bạn muốn biết thông tin gì hôm nay?", isBot: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_OPENCLAW_API_URL || 'http://localhost:8000/chat');
  const chatEndRef = useRef(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().openClawConfig?.apiUrl) {
          setApiUrl(docSnap.data().openClawConfig.apiUrl);
        }
      } catch (err) {
        console.error("Error fetching bot config:", err);
      }
    };
    fetchConfig();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (msgText) => {
    const text = msgText || input;
    if (!text.trim() || isTyping) return;

    const userMsg = { 
      id: Date.now(), 
      text, 
      isBot: false, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.uid || "zbuild_web_user",
          message: text
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: data.response,
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (err) {
      console.error("OpenClaw Chat Error:", err);
      let errorMsg = "⚠️ Kết nối với OpenClaw thất bại.";
      
      if (window.location.protocol === 'https:' && apiUrl.startsWith('http:')) {
        errorMsg += " Lỗi: Không thể kết nối từ trang HTTPS sang API HTTP (Mixed Content). Vui lòng cấu hình HTTPS cho API trong phần Cài đặt.";
      } else {
        errorMsg += " Vui lòng kiểm tra xem bot đã được bật trên điện thoại chưa và URL API có chính xác không.";
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: errorMsg,
        isBot: true,
        time: "Vừa xong"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="sfcb-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Custom Header to match screenshot */}
      <div className="sfcb-header">
        <div className="sfcb-header-left">
          <div className="sfcb-avatar">OC</div>
          <div>
            <strong>Dunvex Market Advisor</strong>
            <span className="sfcb-online">AI-Powered Market Intelligence</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="sfcb-messages">
        {messages.map((m) => (
          <div key={m.id} className={`sfcb-msg ${m.isBot ? 'assistant' : 'user'}`}>
            <div className="sfcb-msg-content">
              <div className="sfcb-msg-bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.text}
                </ReactMarkdown>
              </div>
              <span className="sfcb-msg-time">{m.time}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="sfcb-msg assistant">
            <div className="sfcb-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="sfcb-input-area">
        <input 
          type="text" 
          placeholder="Hỏi tôi bất cứ điều gì..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isTyping}
        />
        <button 
          className="sfcb-send" 
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default OpenClawChatWidget;
