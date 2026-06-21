import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAdminAI } from '../context/AdminAIContext';
import './AdminAIAssistant.css';

const AdminAIAssistant = () => {
  const { messages, input, setInput, isTyping, handleSend } = useAdminAI();
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedImages, setSelectedImages] = useState([]);

  const displayMessages = React.useMemo(() => messages.length === 0 ? [
    { 
      id: 1, 
      text: "Xin chào sếp! Tôi là trợ lý AI quản trị toàn diện. Tôi có thể:\n\n📸 **Tạo sản phẩm nhanh** — gửi ảnh + mô tả, tôi tự động tạo SP hoàn chỉnh\n🎬 **Tạo SP từ YouTube** — gửi link, tôi phân tích và tạo sản phẩm luôn\n💰 **Quản lý giá & tồn kho** — sửa giá, cập nhật stock\n📦 **Xử lý đơn hàng** — xác nhận, huỷ, đổi trạng thái\n🎫 **Quản lý mã giảm giá** — tạo mới, vô hiệu hoá\n👤 **Tra cứu khách hàng** — lịch sử mua, tổng chi tiêu\n📥 **Xuất Excel** — tải toàn bộ sản phẩm ra file .xlsx\n🔄 **Đồng bộ giá từ Sheet** — gửi link Google Sheet, tự động cập nhật giá\n🗑️ **Xoá sản phẩm** — dọn dẹp catalogue\n📊 **Thống kê & báo cáo** — doanh thu, đơn hàng, tồn kho\n\nSếp cần em làm gì ạ?", 
      isBot: true, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ] : messages, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, isTyping]);

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem('ai-prompt');
    if (savedPrompt) {
      sessionStorage.removeItem('ai-prompt');
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

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedImages(prev => [...prev, ...files]);
    // Reset input so same file can be re-selected
    fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSendClick = () => {
    if ((!input.trim() && selectedImages.length === 0) || isTyping) return;
    handleSend(input, selectedImages.length > 0 ? selectedImages : undefined);
    setSelectedImages([]);
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
                  {m.images && m.images.length > 0 && (
                    <div className="admin-msg-images">
                      {m.images.map((img, i) => (
                        <img key={i} src={img} alt={`Upload ${i+1}`} className="admin-msg-img" />
                      ))}
                    </div>
                  )}
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

          {/* Image preview strip */}
          {selectedImages.length > 0 && (
            <div className="admin-ai-image-preview">
              {selectedImages.map((file, i) => (
                <div key={i} className="admin-ai-preview-item">
                  <img src={URL.createObjectURL(file)} alt={`Preview ${i+1}`} />
                  <button 
                    className="admin-ai-preview-remove"
                    onClick={() => removeImage(i)}
                    title="Xóa ảnh"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
              <button 
                className="admin-ai-preview-add"
                onClick={() => fileInputRef.current?.click()}
                title="Thêm ảnh"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          )}

          <div className="admin-ai-input-area">
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button 
              className="admin-ai-image-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping}
              title="Tải ảnh lên"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {selectedImages.length > 0 && (
                <span className="admin-ai-image-count">{selectedImages.length}</span>
              )}
            </button>
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
              disabled={(!input.trim() && selectedImages.length === 0) || isTyping}
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
