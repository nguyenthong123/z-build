import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Sub-components
import AdvisorSidebar from './advisor/AdvisorSidebar';
import AdvisorWelcome from './advisor/AdvisorWelcome';
import ChatHistory from './advisor/ChatHistory';

import './AIAdvisor.css';

const AIAdvisor = ({ onNavigate, advisorState }) => {
  const location = useLocation();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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
  };

  const {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  } = advisorState;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.add('advisor-active-body');
    return () => document.body.classList.remove('advisor-active-body');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const isMobile = windowWidth < 768;

  return (
    <div id="ai-advisor-root" className={`ai-advisor-dashboard ${isMobile ? 'mobile' : ''} ${isSidebarHidden ? 'sidebar-hidden' : ''}`} style={{ width: '100%', height: '100vh', display: 'flex', background: '#F8FAFC', paddingBottom: isMobile ? '65px' : '0' }}>
      {!isMobile && (
        <AdvisorSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onNavigate={onNavigate} 
          userName={userName} 
        />
      )}

      <main className="advisor-main-content">
        <header className="content-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {!isMobile && (
              <button onClick={() => setIsSidebarHidden(!isSidebarHidden)} style={{ background: '#F1F5F9', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A2130" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
            )}
            <div className="search-box" style={{ background: '#F1F5F9', padding: '8px 16px', borderRadius: '100px', display: 'flex', gap: '10px', width: '300px' }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
               <input type="text" placeholder="Tìm kiếm dữ liệu..." style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
            </div>
          </div>
          <div className="top-bar-right" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button onClick={() => onNavigate && onNavigate('home')} style={{ background: 'white', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2130" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {!isMobile && <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A2130' }}>Trang Chủ</span>}
            </button>
          </div>
        </header>

        <div className="scroll-area" style={{ padding: isMobile ? '0 15px' : '0 40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', paddingBottom: '200px' }}>
          {messages.length === 0 ? (
            <AdvisorWelcome 
              userName={userName} 
              productSuggestions={productSuggestions} 
              onSend={handleSend} 
              isMobile={isMobile} 
            />
          ) : (
            <ChatHistory 
              messages={messages} 
              isTyping={isTyping} 
              chatEndRef={chatEndRef} 
              isMobile={isMobile} 
            />
          )}
        </div>

        <div className="chat-input-container" style={{ position: 'fixed', bottom: '0', left: isSidebarHidden || isMobile ? '0' : '260px', right: '0', background: 'white', padding: isMobile ? '10px 15px 15px' : '10px 40px 20px', borderTop: '1px solid #E2E8F0', zIndex: 10, transition: 'left 0.3s ease' }}>
           {imagePreview && (
             <div style={{ maxWidth: '1000px', margin: '0 auto 10px', display: 'flex', position: 'relative', width: 'max-content' }}>
               <img src={imagePreview} alt="Preview" style={{ height: '80px', borderRadius: '10px', objectFit: 'cover' }} />
               <button onClick={clearImage} style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'white', border: '1px solid #ccc', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
               </button>
             </div>
           )}
           <div className="input-wrapper" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '15px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '100px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                ref={fileInputRef} 
                onChange={handleImageSelect} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', padding: '10px' }}
                title="Đính kèm hình ảnh"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <input 
                type="text" 
                placeholder="Nhập yêu cầu phân tích, dán (Ctrl+V) ảnh..." 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isTyping) {
                     onSendClick();
                  }
                }}
                onPaste={handlePaste}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1.05rem', color: '#1A2130', padding: '10px 5px' }}
                disabled={isTyping}
              />
              <button 
                onClick={onSendClick}
                disabled={isTyping || (!input.trim() && !selectedImage)}
                style={{ background: (isTyping || (!input.trim() && !selectedImage)) ? '#CBD5E1' : '#DAA520', color: 'white', border: 'none', width: '46px', height: '46px', borderRadius: '50%', fontWeight: 'bold', cursor: (isTyping || (!input.trim() && !selectedImage)) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (isTyping || (!input.trim() && !selectedImage)) ? 'none' : '0 5px 15px rgba(218,165,32,0.4)', flexShrink: 0 }}
              >
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
           </div>
           
           <div style={{ maxWidth: '1000px', margin: '10px auto 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
             <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '4px 10px', borderRadius: '15px', border: '1px solid #E2E8F0' }}>
               <span className={isTyping ? "dot-pulse" : ""} style={{ width: '6px', height: '6px', background: activeModel.includes('Groq') ? '#F59E0B' : '#10B981', borderRadius: '50%' }}></span>
               <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Cốt lõi AI: {activeModel}</span>
             </div>
             {!isMobile && <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>- AI Supervisor Z-BUILD. Bảng dữ liệu tự động thay thế bằng nội dung thực tế.</p>}
           </div>
        </div>
      </main>
    </div>
  );
};

export default AIAdvisor;
