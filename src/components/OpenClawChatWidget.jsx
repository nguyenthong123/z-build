import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const OpenClawChatWidget = ({ user }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Chào bạn! Tôi là trợ lý AI tại **Cơ sở thạch cao Tâm An**. Tôi có thể giúp bạn báo giá, tính toán vật tư hoặc hướng dẫn kỹ thuật thi công. Bạn cần hỗ trợ gì ạ?", isBot: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_OPENCLAW_API_URL || '');
  const chatEndRef = useRef(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const docRef = doc(db, 'storeSettings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().openClawConfig?.apiUrl) {
          const remoteUrl = docSnap.data().openClawConfig.apiUrl;
          console.log("🤖 OpenClaw: Using Remote API URL from Firestore:", remoteUrl);
          setApiUrl(remoteUrl);
        } else {
          console.log("🤖 OpenClaw: No remote config found, using VITE_OPENCLAW_API_URL:", import.meta.env.VITE_OPENCLAW_API_URL);
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
    
    // Prepare history for GAS bot (convert to simple role/content format)
    const history = messages.map(m => ({
      role: m.isBot ? "assistant" : "user",
      content: m.text
    }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // JSONP Implementation to bypass all CORS/Redirect issues
      const callbackName = 'openclaw_callback_' + Math.round(100000 * Math.random());
      
      // Prepare history for GAS bot (Limit to last 3 messages to avoid URL length issues in JSONP)
      const limitedHistory = history.slice(-3);

      const queryParams = new URLSearchParams();
      queryParams.append('userId', user?.uid || "zbuild_web_user");
      queryParams.append('userName', user?.name || "Khách hàng");
      queryParams.append('message', text);
      queryParams.append('history', JSON.stringify(limitedHistory));
      queryParams.append('callback', callbackName);

      const cleanApiUrl = apiUrl.trim();
      const finalUrl = `${cleanApiUrl}${cleanApiUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;
      console.log("🤖 OpenClaw calling via JSONP:", finalUrl);

      // Create a promise to handle the JSONP response
      const botReply = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Kết nối quá hạn (Timeout). Vui lòng thử lại."));
        }, 30000);

        const cleanup = () => {
          clearTimeout(timeout);
          delete window[callbackName];
          const script = document.getElementById(callbackName);
          if (script) script.remove();
        };

        window[callbackName] = (data) => {
          console.log("🤖 OpenClaw JSONP Data:", data);
          cleanup();
          if (data.status === "success" || data.reply) {
            resolve(data.reply || data.response);
          } else {
            reject(new Error(data.message || "Lỗi phản hồi từ AI"));
          }
        };

        const script = document.createElement('script');
        script.id = callbackName;
        script.src = finalUrl;
        script.onerror = () => {
          cleanup();
          reject(new Error("Lỗi tải Script (CORS hoặc Network)."));
        };
        document.body.appendChild(script);
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: botReply,
        isBot: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

    } catch (err) {
      console.error("🤖 OpenClaw Chat Error Details:", err);
      let errorMsg = "⚠️ Kết nối với OpenClaw thất bại.";
      
      if (apiUrl.startsWith('http://') && window.location.protocol === 'https:') {
        errorMsg += " Lỗi: Không thể kết nối từ trang HTTPS sang API HTTP (Mixed Content). Vui lòng cấu hình HTTPS cho API trong phần Cài đặt.";
      } else {
        errorMsg += ` Chi tiết: ${err.message || "Lỗi mạng hoặc CORS"}. URL đang gọi: ${apiUrl || "Trống"}.`;
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
      {/* Custom Header */}
      <div className="sfcb-header">
        <div className="sfcb-header-left">
          <div className="sfcb-avatar" style={{ background: '#FFD700', color: '#000', fontWeight: 'bold' }}>TA</div>
          <div>
            <strong>Trợ lý Thạch cao Tâm An</strong>
            <span className="sfcb-online" style={{ color: '#10B981' }}>Tư vấn kỹ thuật & Báo giá 24/7</span>
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
          placeholder="Hỏi về sản phẩm hoặc cách thi công..." 
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
