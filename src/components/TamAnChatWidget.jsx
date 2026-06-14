import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAIAdvisor } from '../hooks/useAIAdvisor';

const TamAnChatWidget = () => {
  const { messages, input, setInput, isTyping, handleSend } = useAIAdvisor(null);
  const chatEndRef = useRef(null);

  const displayMessages = messages.length === 0 ? [
    { id: 1, text: "Chào bạn! Tôi là trợ lý AI tại **Cơ sở thạch cao Tâm An**. Tôi có thể giúp bạn báo giá, tính toán vật tư, lên đơn tự động hoặc hướng dẫn kỹ thuật thi công. Bạn cần hỗ trợ gì ạ?", isBot: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ] : messages;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMessages, isTyping]);

  const onSendClick = () => {
    if (!input.trim() || isTyping) return;
    handleSend(input);
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
        {displayMessages.map((m) => (
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
          onKeyDown={(e) => e.key === 'Enter' && onSendClick()}
          disabled={isTyping}
        />
        <button 
          className="sfcb-send" 
          onClick={onSendClick}
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
