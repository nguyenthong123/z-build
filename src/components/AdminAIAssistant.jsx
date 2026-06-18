import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAdminAI } from '../context/AdminAIContext';
import './AdminAIAssistant.css';

const AdminAIAssistant = () => {
  // Use 'admin' role to get admin capabilities and prompts from context
  const { messages, input, setInput, isTyping, handleSend } = useAdminAI();
  const chatEndRef = useRef(null);

  const displayMessages = messages.length === 0 ? [
    { 
      id: 1, 
      text: "Xin chào sếp! Tôi là trợ lý AI quản trị toàn diện. Tôi có thể:\n\n📸 **Tạo sản phẩm nhanh** — gửi ảnh + mô tả, tôi tự động tạo SP hoàn chỉnh\n🎬 **Tạo SP từ YouTube** — gửi link, tôi phân tích và tạo sản phẩm luôn\n💰 **Quản lý giá & tồn kho** — sửa giá, cập nhật stock\n📦 **Xử lý đơn hàng** — xác nhận, huỷ, đổi trạng thái\n🎫 **Quản lý mã giảm giá** — tạo mới, vô hiệu hoá\n👤 **Tra cứu khách hàng** — lịch sử mua, tổng chi tiêu\n📥 **Xuất Excel** — tải toàn bộ sản phẩm ra file .xlsx\n🔄 **Đồng bộ giá từ Sheet** — gửi link Google Sheet, tự động cập nhật giá\n🗑️ **Xoá sản phẩm** — dọn dẹp catalogue\n📊 **Thống kê & báo cáo** — doanh thu, đơn hàng, tồn kho\n\nSếp cần em làm gì ạ?", 
      isBot: true, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ] : messages;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMessages, isTyping]);

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem('ai-prompt');
    if (savedPrompt) {
      sessionStorage.removeItem('ai-prompt');
      // Delay slightly to ensure component is fully mounted
      setTimeout(() => {
        handleSend(savedPrompt);
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textareaRef = useRef(null);

  const handleInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendClick();
    }
  };

  const onSendClick = () => {
    if (!input.trim() || isTyping) return;
    handleSend(input);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="admin-ai-assistant-page">
      
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
            <textarea 
              ref={textareaRef}
              placeholder="VD: Tạo cho tôi 1 sản phẩm tên là 'Đèn LED âm trần', giá 120000..." 
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              rows={1}
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
