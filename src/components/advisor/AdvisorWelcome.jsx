import React, { useState } from 'react';

const AdvisorWelcome = ({ userName, productSuggestions, onSend, isMobile }) => {
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  return (
    <div className="welcome-banner" style={{ marginTop: isMobile ? '40px' : '60px', textAlign: 'center' }}>
      <h1 style={{ fontSize: isMobile ? '2.2rem' : '2.8rem', fontWeight: 900, color: '#1A2130' }}>
        Chào {userName?.split(' ')[0]}, tôi có thể giúp gì?
      </h1>
      <p style={{ color: '#64748B', fontSize: '1.1rem', maxWidth: '600px', margin: '15px auto', lineHeight: '1.6' }}>
        Hãy mô tả nhu cầu của khách hàng, hoặc hỏi tôi về giá cả, cấu tạo sản phẩm, so sánh lợi nhuận giữa các loại kiện hàng.
      </p>
      
      {productSuggestions.length > 0 && (
        <div className="quick-suggestions-container" style={{ maxWidth: '700px', margin: '35px auto 0', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gợi ý nhanh</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(suggestionsExpanded ? productSuggestions : productSuggestions.slice(0, 3)).map((product) => (
              <button
                key={product.id}
                className="suggestion-chip"
                onClick={() => onSend(`Tư vấn cho tôi về sản phẩm "${product.title}"`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: 'white',
                  border: '1px solid #E2E8F0', borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.25s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%', fontSize: '1rem'
                }}
              >
                {product.image ? (
                  <img src={product.image} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid #F1F5F9' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #FFFBEB, #FEF08A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2"><path d="M21 8l-9-4-9 4v8l9 4 9-4V8z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></svg>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1A2130', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Tư vấn về: {product.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>{product.category}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>

          {productSuggestions.length > 3 && (
            <button
              onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '12px auto 0',
                padding: '10px 24px', background: 'transparent', border: '1px dashed #CBD5E1', borderRadius: '100px',
                cursor: 'pointer', color: '#64748B', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.25s ease'
              }}
            >
              {suggestionsExpanded ? 'Thu gọn' : `Xem thêm ${productSuggestions.length - 3} sản phẩm`}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: suggestionsExpanded ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvisorWelcome;
