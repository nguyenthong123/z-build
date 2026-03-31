import React, { useState } from 'react';
import './StorefrontChatBot.css';
const StorefrontChatBot = ({ isOpen, setIsOpen, isLoggedIn, onLoginRequired }) => {

  const [hasOpened, setHasOpened] = useState(false);

  React.useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
    }
  }, [isOpen, hasOpened]);

  const handleToggle = () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Button */}
      <button className={`sfcb-toggle ${isOpen ? 'open' : ''}`} onClick={handleToggle} aria-label="Chat với Z-BUILD">
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
        {!isOpen && <span className="sfcb-badge">💬</span>}
      </button>

      {/* Chat Panel */}
      <div 
        className="sfcb-panel" 
        style={{ 
          padding: 0, 
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          visibility: isOpen ? 'visible' : 'hidden'
        }}
      >
        {/* Dedicated mobile close button inside panel wrapper */}
        <button 
          className="sfcb-mobile-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
          }}
          onTouchStart={(e) => {
            // Support for Safari mobile
            e.stopPropagation();
            setIsOpen(false);
          }}
          aria-label="Đóng Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        {isLoggedIn && hasOpened && (
          <div className="sfcb-iframe-wrapper">
            <iframe 
              src="https://script.google.com/macros/s/AKfycbyRWdR_2xyMRAtnm8FPNUPep2mLCGviANSrwqZsxOXZVvoQO9BPgISYHLb5GnfveOks/exec" 
              className="sfcb-iframe"
              title="Z-BUILD Assistant"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default StorefrontChatBot;
