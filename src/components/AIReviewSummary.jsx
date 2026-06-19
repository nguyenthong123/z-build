import React, { useState, useEffect } from 'react';
import './AIReviewSummary.css';

const AI_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
const AI_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

const AIReviewSummary = ({ reviews, loading: reviewsLoading }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset when reviews change
    setSummary(null);
    setError(null);
    
    if (reviewsLoading || reviews.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchSummary = async () => {
      if (!AI_API_KEY) {
        if (!cancelled) setError('API AI chưa được cấu hình.');
        return;
      }

      setLoading(true);
      try {
        const reviewTexts = reviews
          .map((r, i) => `Đánh giá ${i + 1}: ${r.rating}/5 sao — "${r.comment}"`)
          .join('\n');

        const prompt = `Tổng hợp các đánh giá sau thành 2-3 câu ngắn gọn bằng tiếng Việt, nêu bật ý kiến chung của khách hàng:\n\n${reviewTexts}`;

        const res = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'Bạn là trợ lý tổng hợp đánh giá sản phẩm. Trả lời ngắn gọn, súc tích bằng tiếng Việt. Không thêm lời dẫn, chỉ đưa ra phần tổng hợp.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 300
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Lỗi API: ${res.status}`);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text && !cancelled) {
          throw new Error('AI không trả về kết quả.');
        }

        if (!cancelled) {
          setSummary(text);
          setLoading(false);
        }
      } catch (err) {
        console.error('AIReviewSummary error:', err);
        if (!cancelled) {
          setError(err.message || 'Không thể tạo tổng hợp.');
          setLoading(false);
        }
      }
    };

    fetchSummary();
    return () => { cancelled = true; };
  }, [reviews, reviewsLoading]);

  // Don't render anything if still loading reviews or no reviews
  if (reviewsLoading || reviews.length === 0) {
    return null;
  }

  return (
    <div className="ai-review-summary">
      <div className="ai-summary-header">
        <div className="ai-summary-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z"/>
          </svg>
        </div>
        <span className="ai-summary-title">AI Tổng hợp đánh giá</span>
        <span className="ai-summary-badge">AI</span>
      </div>

      <div className="ai-summary-body">
        {loading ? (
          <div className="ai-summary-loading">
            <div className="ai-summary-skeleton ai-summary-skeleton-1" />
            <div className="ai-summary-skeleton ai-summary-skeleton-2" />
            <div className="ai-summary-skeleton ai-summary-skeleton-3" />
          </div>
        ) : error ? (
          <div className="ai-summary-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        ) : summary ? (
          <p className="ai-summary-text">{summary}</p>
        ) : null}
      </div>
    </div>
  );
};

export default AIReviewSummary;
