import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TamAnChatWidget = ({ user }) => {
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
          console.log("🤖 TamAnBot: Using Remote API URL from Firestore:", remoteUrl);
          setApiUrl(remoteUrl);
        } else {
          console.log("🤖 TamAnBot: No remote config found, using VITE_OPENCLAW_API_URL:", import.meta.env.VITE_OPENCLAW_API_URL);
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

    // Hàm rút gọn lịch sử để không quá dài URL
    const pruneHistory = (historyArr) => {
      return historyArr.slice(-6).map(item => {
        let content = item.content;
        // Loại bỏ các bảng Markdown dài khỏi lịch sử để tiết kiệm dung lượng
        if (content.includes('|')) {
          content = content.split('\n').filter(line => !line.includes('|')).join('\n') + "\n[Bảng dữ liệu đã lược bỏ]";
        }
        // Giới hạn độ dài mỗi tin nhắn trong lịch sử
        if (content.length > 300) {
          content = content.substring(0, 300) + "...";
        }
        return { role: item.role, content: content };
      });
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const limitedHistory = pruneHistory(history);

      const makeRequest = async (attempt = 1) => {
        return new Promise((resolve, reject) => {
          const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
          const timeoutId = setTimeout(() => {
            delete window[callbackName];
            const script = document.getElementById(callbackName);
            if (script) script.remove();
            reject(new Error("Yêu cầu quá lâu, vui lòng thử lại."));
          }, 60000);

          window[callbackName] = (data) => {
            clearTimeout(timeoutId);
            const script = document.getElementById(callbackName);
            if (script) script.remove();
            delete window[callbackName];
            
            if (data && (data.status === "success" || data.reply)) {
              resolve(data.reply || data.response);
            } else {
              reject(new Error(data?.message || "Lỗi phản hồi từ AI."));
            }
          };

          const params = {
            callback: callbackName,
            userId: user?.uid || "zbuild_web_user",
            userName: user?.name || "Khách hàng",
            message: text,
            history: JSON.stringify(limitedHistory)
          };

          const queryString = Object.keys(params)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
            .join('&');

          const script = document.createElement('script');
          script.id = callbackName;
          script.src = `${apiUrl.trim()}${apiUrl.includes('?') ? '&' : '?'}${queryString}`;
          script.onerror = () => {
            clearTimeout(timeoutId);
            delete window[callbackName];
            script.remove();
            reject(new Error("Không thể kết nối đến máy chủ AI."));
          };
          document.body.appendChild(script);
        }).catch(async (err) => {
          if (attempt < 2) {
            console.log(`🤖 TamAnBot: Thử lại lần ${attempt + 1}...`, err);
            await new Promise(r => setTimeout(r, 2000));
            return makeRequest(attempt + 1);
          }
          throw err;
        });
      };

      const botReply = await makeRequest();

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: botReply,
        isBot: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

    } catch (err) {
      console.error("🤖 TamAnBot Error:", err);
      let errorMsg = "⚠️ Hệ thống trợ lý AI đang tạm bận.";
      
      if (apiUrl.startsWith('http://') && window.location.protocol === 'https:') {
        errorMsg += " Lỗi kỹ thuật: Mixed Content (HTTP/HTTPS). Vui lòng liên hệ quản trị viên.";
      } else {
        errorMsg += ` Chi tiết: ${err.message || "Lỗi mạng hoặc hệ thống"}.`;
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

export default TamAnChatWidget;
