import React, { useState, useEffect, useRef } from 'react';
import './ChatBot.css';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

const ChatBot = ({ view, isLoggedIn, onLoginRequired, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Xin chào! Tôi là trợ lý ảo của ZBUILD. Tôi có thể giúp gì cho bạn?", isBot: true }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(7)}`);
  const chatMessagesRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const saveToLog = async (msgText, isBot) => {
    if (!isLoggedIn) return;
    
    try {
      const logRef = doc(db, "consultations", sessionId);
      const sessionDoc = {
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName,
        lastUpdated: serverTimestamp(),
        status: 'active'
      };

      await setDoc(logRef, sessionDoc, { merge: true });
      
      const messagesRef = collection(db, "consultations", sessionId, "messages");
      await addDoc(messagesRef, {
        text: msgText,
        isBot: isBot,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving chat log:", error);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const userMsg = { id: Date.now(), text: inputValue, isBot: false };
    setMessages([...messages, userMsg]);
    setInputValue('');
    saveToLog(inputValue, false);

    // Mock bot response
    setTimeout(() => {
      const botResponse = "Cảm ơn bạn đã quan tâm. Sản phẩm này đang có sẵn và có thể giao hàng trong 2-3 ngày tới. Tôi đã ghi nhận yêu cầu tư vấn của bạn vào hệ thống Knowledge Base.";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: botResponse,
        isBot: true
      }]);
      saveToLog(botResponse, true);
    }, 1000);
  };

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''} ${view === 'product-detail' ? 'shifted' : ''}`}>
      {!isOpen && (
        <button className="chat-toggle" onClick={() => {
          if (!isLoggedIn) {
            onLoginRequired();
          } else {
            onNavigate('ai-advisor');
          }
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="chat-window animate-fade-in">
          <div className="chat-header">
            <div className="bot-info">
              <div className="bot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8"/><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="7" cy="13" r="1"/><circle cx="17" cy="13" r="1"/>
                </svg>
              </div>
              <div>
                <h4>ZBUILD Assistant</h4>
                <span className="status">Trực tuyến</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
          </div>

          <div className="chat-messages" ref={chatMessagesRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isBot ? 'bot' : 'user'}`}>
                <div className="message-content">{msg.text}</div>
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input 
              type="text" 
              placeholder="Nhập tin nhắn..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
