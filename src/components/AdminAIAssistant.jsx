import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useAdminAI } from '../context/AdminAIContext';
import './AdminAIAssistant.css';

const AdminAIAssistant = () => {
  const { messages, input, setInput, isTyping, handleSend, clearMessages } = useAdminAI();
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedImages, setSelectedImages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const displayMessages = React.useMemo(() => messages.length === 0 ? [
    { 
      id: 1, 
      text: "Xin chào sếp! Tôi là trợ lý AI quản trị toàn diện. Tôi có thể:\n\n📸 **Tạo sản phẩm nhanh** — gửi ảnh + mô tả, tôi tự động tạo SP hoàn chỉnh\n🎬 **Tạo SP từ YouTube** — gửi link, tôi phân tích và tạo sản phẩm luôn\n💰 **Quản lý giá & tồn kho** — sửa giá, cập nhật stock\n📦 **Xử lý đơn hàng** — xác nhận, huỷ, đổi trạng thái\n👤 **Tra cứu khách hàng** — lịch sử mua, tổng chi tiêu\n📥 **Xuất Excel** — tải toàn bộ sản phẩm ra file .xlsx\n🔄 **Đồng bộ giá từ Sheet** — gửi link Google Sheet, tự động cập nhật giá\n🗑️ **Xoá sản phẩm** — dọn dẹp catalogue\n📊 **Thống kê & báo cáo** — doanh thu, đơn hàng, tồn kho\n\nSếp cần em làm gì ạ?", 
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

  // Handle ESC key to exit maximized mode or close chat
  useEffect(() => {
    const handleKeyDownGlobal = (e) => {
      if (e.key === 'Escape') {
        if (isMaximized) {
          setIsMaximized(false);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isMaximized, isOpen]);

  useEffect(() => {
    const handleCheckPrompt = () => {
      const savedPrompt = sessionStorage.getItem('ai-prompt');
      if (savedPrompt) {
        sessionStorage.removeItem('ai-prompt');
        setIsOpen(true);
        setInput(savedPrompt);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
            const textLen = savedPrompt.length;
            textareaRef.current.setSelectionRange(textLen, textLen);
          }
        }, 200);
      }
    };

    const handleToggleChat = () => {
      setIsOpen(prev => !prev);
    };

    // Check on mount
    handleCheckPrompt();

    // Listen to custom events
    window.addEventListener('trigger-admin-ai-prompt', handleCheckPrompt);
    window.addEventListener('toggle-admin-ai-chat', handleToggleChat);
    
    return () => {
      window.removeEventListener('trigger-admin-ai-prompt', handleCheckPrompt);
      window.removeEventListener('toggle-admin-ai-chat', handleToggleChat);
    };
  }, [handleSend]);

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
    <>
      {/* Backdrop overlay when maximized */}
      {isOpen && isMaximized && (
        <div 
          className="admin-ai-backdrop" 
          onClick={() => setIsMaximized(false)}
          title="Nhấn để thu nhỏ khung chat"
        />
      )}

      {/* Floating Toggle Button */}
      <button 
        className={`admin-ai-toggle-btn ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Đóng Trợ lý AI" : "Mở Trợ lý AI Quản Trị"}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        )}
      </button>

      {/* Floating Chat Panel */}
      <div 
        className={`admin-ai-floating-panel ${isMaximized ? 'maximized' : ''}`}
        style={{
          display: isOpen ? 'flex' : 'none'
        }}
      >
        <header className="admin-ai-header">
          <div className="admin-ai-header-left">
            <h3>
              <span className="admin-ai-sparkle-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </span>
              Trợ lý AI Quản Trị
              {isMaximized && <span className="admin-ai-badge-max">Toàn màn hình</span>}
            </h3>
            <p>Hỗ trợ tạo sản phẩm, viết bài mô tả SEO nhanh.</p>
          </div>

          <div className="admin-ai-header-actions">
            <button 
              className="admin-ai-btn-action" 
              onClick={clearMessages} 
              title="Xoá lịch sử chat"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button 
              className="admin-ai-btn-action" 
              onClick={() => setIsMaximized(!isMaximized)} 
              title={isMaximized ? "Thu nhỏ về góc" : "Phóng to ra giữa màn hình"}
            >
              {isMaximized ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              )}
            </button>
            <button 
              className="admin-ai-btn-action close" 
              onClick={() => { setIsOpen(false); setIsMaximized(false); }} 
              title="Đóng khung chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
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
    </>
  );
};

export default AdminAIAssistant;
