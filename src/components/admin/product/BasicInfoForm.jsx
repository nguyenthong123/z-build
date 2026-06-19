import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const BasicInfoForm = ({ title, slug, shortDescription, description, onChange, onDescriptionChange }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiContext, setAiContext] = useState("");

  const handleGenerateDescription = async () => {
    if (!title) {
      alert("Vui lòng nhập tên sản phẩm trước khi tạo mô tả bằng AI!");
      return;
    }
    
    setIsGenerating(true);
    try {
      const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!geminiApiKey) {
        alert("Vui lòng cấu hình NEXT_PUBLIC_GEMINI_API_KEY trong Vercel Environment Variables!");
        setIsGenerating(false);
        return;
      }

      const contextPrompt = aiContext.trim() ? `\n\nThông tin chi tiết về sản phẩm:\n"${aiContext.trim()}"\n\nHãy dựa vào các thông tin chi tiết trên để phân tích sâu, viết thật hay và đúng thực tế.` : '';

      const prompt = `Viết một bài mô tả sản phẩm chuyên nghiệp, hấp dẫn, chuẩn SEO cho sản phẩm vật liệu xây dựng/nội thất có tên là "${title}".${contextPrompt}
Yêu cầu:
- Trình bày bố cục rõ ràng, chia thành các phần: Giới thiệu chung, Ưu điểm nổi bật, Ứng dụng.
- Dùng định dạng HTML cơ bản (các thẻ h3, p, ul, li, strong).
- Chỉ trả về đoạn mã HTML thuần, KHÔNG BỌC TRONG markdown block \`\`\`html.`;

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${geminiApiKey}`
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.choices[0]?.message?.content || "";
        // Clean up any remaining markdown backticks just in case
        content = content.replace(/```html/g, '').replace(/```/g, '').trim();
        onDescriptionChange(content);
        setShowAiInput(false);
      } else {
        const err = await response.json();
        console.error("AI Error:", err);
        alert("Có lỗi xảy ra khi kết nối tới AI API.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi mạng khi gọi AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="form-section card">
      <div className="section-header">
        <div className="section-icon info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <h3>Thông tin cơ bản</h3>
      </div>
      <div className="form-group">
        <label>Tên sản phẩm <span style={{color:'#f59e0b',fontSize:'11px'}}>← AI: title</span></label>
        <input 
          type="text" 
          name="title"
          placeholder="Ví dụ: Sơn Dulux màu trắng, Đèn LED Panel 60x60..." 
          value={title}
          onChange={onChange}
        />
      </div>
      <div className="form-group">
        <label>Mô tả ngắn <span style={{color:'#f59e0b',fontSize:'11px'}}>← AI: shortDesc</span></label>
        <input 
          type="text" 
          name="shortDescription"
          placeholder="VD: Sơn nội thất cao cấp, không mùi, độ phủ cao..." 
          value={shortDescription || ''}
          onChange={onChange}
        />
        <small style={{ color: '#666', fontSize: '11px', marginTop: '2px', display: 'block' }}>
          * Hiển thị dưới tên sản phẩm trong danh sách và kết quả tìm kiếm
        </small>
      </div>
      <div className="form-group">
        <label>Slug (URL thân thiện)</label>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            name="slug"
            value={slug}
            onChange={onChange}
            style={{ background: '#f5f5f5', color: '#666' }}
          />
        </div>
      </div>
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ marginBottom: 0 }}>Mô tả sản phẩm</label>
          {!showAiInput && (
            <button 
              type="button" 
              onClick={() => setShowAiInput(true)} 
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ✨ Viết bằng AI
            </button>
          )}
        </div>

        {showAiInput && (
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px', display: 'block' }}>
              Cung cấp thêm thông tin cho AI (Tùy chọn)
            </label>
            <textarea
              placeholder="Ví dụ: Hàng nhập khẩu Nhật Bản, chất liệu inox 304 không gỉ, bảo hành 10 năm..."
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              style={{ 
                width: '100%', minHeight: '80px', padding: '10px', 
                border: '1px solid #cbd5e1', borderRadius: '6px', 
                fontSize: '14px', marginBottom: '12px', fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => setShowAiInput(false)}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGenerating}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isGenerating ? (
                  <>
                    <svg className="spinner" viewBox="0 0 50 50" style={{width: '14px', height: '14px', animation: 'spin 1s linear infinite'}}><circle className="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" style={{strokeLinecap: 'round', animation: 'dash 1.5s ease-in-out infinite'}}></circle></svg>
                    Đang viết...
                  </>
                ) : 'Bắt đầu viết'}
              </button>
            </div>
          </div>
        )}

        <div className="rich-editor-container">
          <ReactQuill 
            theme="snow"
            value={description}
            onChange={onDescriptionChange}
            modules={{
              toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'clean']
              ],
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes dash { 0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; } 50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; } 100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; } }
      `}</style>
    </section>
  );
};

export default BasicInfoForm;
