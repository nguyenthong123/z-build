import React, { useState } from 'react';
import './StorefrontChatBot.css';
const StorefrontChatBot = ({ isOpen, setIsOpen, isLoggedIn, onLoginRequired }) => {

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
        {isLoggedIn && (
          <iframe 
            src="https://script.google.com/macros/s/AKfycbziFF8dRd2heOGZ-WnZ90d3u6fcJy7o4cExHhbC1ad_VYWqH0g8b8g0VILFZY3Wxdly/exec" 
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Z-BUILD Assistant"
          />
        )}
      </div>
    </>
  );
};

export default StorefrontChatBot;
