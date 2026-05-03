import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DataBoard from './DataBoard';

const ChatHistory = ({ messages, isTyping, chatEndRef, isMobile }) => {
  return (
    <div className="chat-history" style={{ padding: '20px 0' }}>
      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: isMobile ? '25px' : '40px', display: 'flex', flexDirection: 'column', alignItems: m.isBot ? 'flex-start' : 'flex-end', width: '100%' }}>
          {m.text && (
            <div className="chat-msg-bubble" style={{ 
              maxWidth: m.isBot ? '100%' : (isMobile ? '90%' : '80%'), 
              padding: isMobile ? '12px 18px' : '16px 24px', 
              borderRadius: '20px', 
              background: m.isBot ? 'transparent' : 'linear-gradient(135deg, #DAA520, #E4B341)', 
              color: m.isBot ? '#1A2130' : 'white',
              boxShadow: m.isBot ? 'none' : '0 10px 25px rgba(218,165,32,0.3)',
              fontSize: isMobile ? '1rem' : '1.05rem',
              lineHeight: '1.7', width: m.isBot ? '100%' : 'auto', overflowX: 'auto'
            }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({...props}) => (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                      <table {...props} style={{ minWidth: isMobile ? 'auto' : '600px', width: '100%' }} />
                    </div>
                  )
                }}
              >
                {m.text}
              </ReactMarkdown>
            </div>
          )}

          {m.board && <DataBoard board={m.board} isMobile={isMobile} />}
        </div>
      ))}
      <div ref={chatEndRef} />
      
      {isTyping && (
        <div style={{ alignSelf: 'flex-start', background: '#FFFBEB', padding: '12px 20px', borderRadius: '15px', color: '#DAA520', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #FEF08A', boxShadow: '0 4px 15px rgba(218,165,32,0.1)' }}>
          <div className="dot-pulse" style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'monospace' }}>Z</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520'}}></span>
            <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520', animationDelay: '0.2s'}}></span>
            <span className="dot-pulse" style={{width: '6px', height: '6px', borderRadius: '50%', background: '#DAA520', animationDelay: '0.4s'}}></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
