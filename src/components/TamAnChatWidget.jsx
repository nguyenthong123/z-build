import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


const TamAnChatWidget = ({ onMaximize, advisorState }) => {
  const { messages, input, setInput, isTyping, handleSend, handleFeedback } = advisorState;
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState({}); // Track feedback per message

  const displayMessages = React.useMemo(() => messages.length === 0 ? [
    { id: 1, text: "Chào bạn! Tôi là trợ lý AI tại **Cơ sở thạch cao Tâm An**. Tôi có thể giúp bạn báo giá, tính toán vật tư, lên đơn tự động hoặc hướng dẫn kỹ thuật thi công. Bạn cần hỗ trợ gì ạ?", isBot: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ] : messages, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
   
  }, [displayMessages, isTyping]);

  const textareaRef = useRef(null);

  const handleInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendClick();
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        const file = item.getAsFile();
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        e.preventDefault();
        break;
      }
    }
  };

  const handleImageSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSendClick = () => {
    if ((!input.trim() && !selectedImage) || isTyping) return;
    handleSend(input, selectedImage);
    clearImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
        {onMaximize && (
          <button 
            className="sfcb-maximize-btn"
            onClick={onMaximize} 
            title="Phóng to toàn màn hình"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="sfcb-messages">
        {displayMessages.map((m) => (
          <div key={m.id} className={`sfcb-msg ${m.isBot ? 'assistant' : 'user'}`}>
            <div className="sfcb-msg-content">
              {m.image && (
                <div style={{ marginBottom: '8px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                  <img src={m.image} alt="Attachment" style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', objectFit: 'cover' }} />
                </div>
              )}
              {m.text && (
                <div className="sfcb-msg-bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
              )}
              <span className="sfcb-msg-time">{m.time}</span>
              {m.isBot && m.id > 1000000 && (
                <div className="sfcb-feedback">
                  {feedbackSent[m.id] ? (
                    <span className="sfcb-feedback-done">
                      {feedbackSent[m.id] === 'good' ? '👍' : '👎'} Cảm ơn phản hồi!
                    </span>
                  ) : (
                    <>
                      <button 
                        className="sfcb-feedback-btn" 
                        onClick={() => { 
                          setFeedbackSent(prev => ({ ...prev, [m.id]: 'good' }));
                          handleFeedback(m.id, 'good', m.text);
                        }}
                        title="Hữu ích"
                      >👍</button>
                      <button 
                        className="sfcb-feedback-btn" 
                        onClick={() => { 
                          setFeedbackSent(prev => ({ ...prev, [m.id]: 'bad' }));
                          handleFeedback(m.id, 'bad', m.text);
                        }}
                        title="Chưa tốt"
                      >👎</button>
                    </>
                  )}
                </div>
              )}
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
      <div className="sfcb-input-container">
        {imagePreview && (
          <div className="sfcb-image-preview">
            <img src={imagePreview} alt="Preview" />
            <button className="sfcb-remove-image" onClick={clearImage}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <div className="sfcb-input-area">
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
          />
          <button 
            className="sfcb-attach-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm hình ảnh"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea 
            ref={textareaRef}
            placeholder="Hỏi về sản phẩm, dán (Ctrl+V) ảnh..." 
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isTyping}
            rows={1}
          />
          <button 
            className="sfcb-send" 
            onClick={onSendClick} 
            disabled={isTyping || (!input.trim() && !selectedImage)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TamAnChatWidget;
