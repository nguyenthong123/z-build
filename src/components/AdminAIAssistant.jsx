import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AdminSidebar from './AdminSidebar';
import { useAIAdvisor } from '../hooks/useAIAdvisor';
import './AdminAIAssistant.css';

const AdminAIAssistant = ({ onBack }) => {
  // Use 'admin' role to get admin capabilities and prompts
  const { messages, input, setInput, isTyping, handleSend } = useAIAdvisor(null, 'admin');
  const chatEndRef = useRef(null);

  const displayMessages = messages.length === 0 ? [
    { 
      id: 1, 
      text: "Xin chào sếp! Tôi là trợ lý AI quản trị. Tôi có thể giúp sếp **tạo nhanh sản phẩm**, kiểm tra đơn hàng hoặc phân tích doanh thu. Sếp cần hỗ trợ việc gì ạ?", 
      isBot: true, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ] : messages;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, isTyping]);

  const onSendClick = () => {
    if (!input.trim() || isTyping) return;
    handleSend(input);
  };

  return (
    <div className="admin-ai-assistant-page">
      <AdminSidebar activePage="ai-assistant" />
      
      <div className="admin-ai-content">
        <header className="admin-ai-header">
          <h1>Trợ lý AI Quản Trị</h1>
          <p>Trò chuyện với AI để thực hiện nhanh các tác vụ quản trị, đặc biệt là tạo hàng loạt sản phẩm.</p>
        </header>

        <div className="admin-ai-chat-container">
          <div className="admin-ai-messages">
            {displayMessages.map((m) => (
              <div key={m.id} className={`admin-msg ${m.isBot ? 'assistant' : 'user'}`}>
                <div className="admin-msg-bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
                <span className="admin-msg-time">{m.time}</span>
              </div>
            ))}
            {isTyping && (
              <div className="admin-msg assistant">
                <div className="admin-msg-bubble">
                  Đang xử lý yêu cầu...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="admin-ai-input-area">
            <input 
              type="text" 
              placeholder="VD: Tạo cho tôi 1 sản phẩm tên là 'Đèn LED âm trần', giá 120000..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendClick()}
              disabled={isTyping}
            />
            <button 
              className="admin-ai-send" 
              onClick={onSendClick}
              disabled={!input.trim() || isTyping}
              title="Gửi"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIAssistant;
