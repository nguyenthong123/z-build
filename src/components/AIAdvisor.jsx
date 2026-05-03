import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAIAdvisor } from '../hooks/useAIAdvisor';

// Sub-components
import AdvisorSidebar from './advisor/AdvisorSidebar';
import AdvisorWelcome from './advisor/AdvisorWelcome';
import ChatHistory from './advisor/ChatHistory';

import './AIAdvisor.css';

const AIAdvisor = ({ onNavigate }) => {
  const location = useLocation();
  const productContext = location.state?.productContext || null;
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const chatEndRef = useRef(null);

  const {
    messages, input, setInput, isTyping, activeModel, productSuggestions, userName,
    handleSend
  } = useAIAdvisor(productContext);

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

        <div className="scroll-area" style={{ padding: isMobile ? '0 15px' : '0 40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', paddingBottom: '120px' }}>
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
           <div className="input-wrapper" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '15px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '100px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Nhập yêu cầu phân tích..." 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isTyping) {
                     handleSend(input);
                  }
                }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1.05rem', color: '#1A2130', padding: '10px 15px' }}
                disabled={isTyping}
              />
              <button 
                onClick={() => handleSend(input)}
                disabled={isTyping || !input.trim()}
                style={{ background: (isTyping || !input.trim()) ? '#CBD5E1' : '#DAA520', color: 'white', border: 'none', width: '46px', height: '46px', borderRadius: '50%', fontWeight: 'bold', cursor: (isTyping || !input.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (isTyping || !input.trim()) ? 'none' : '0 5px 15px rgba(218,165,32,0.4)', flexShrink: 0 }}
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
