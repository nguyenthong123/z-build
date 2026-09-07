/**
 * HTML Sanitizer & Formatter for Product Descriptions
 * Cleans unwanted outer wrappers (DOCTYPE, <html>, <head>, <style>, <body>)
 * and structures Markdown/HTML elements into beautiful UI components.
 */

export function cleanProductHtml(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();
  
  // 1. Remove leading '=' or single/double quotes
  text = text.replace(/^[=\s'"`]+/, '').replace(/['"`\s]+$/, '');
  
  // 2. Strip markdown code block wrappers (```html ... ```)
  text = text.replace(/^```(?:html|markdown|xml)?\s*/i, '').replace(/\s*```$/, '');
  
  // 3. Remove zero-width spaces and abnormal control characters
  text = text.replace(/&nbsp;/g, ' ').replace(/[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff\u200b\r]/g, ' ');
  
  // 4. Remove DOCTYPE declaration
  text = text.replace(/<!DOCTYPE[^>]*>/gi, '');
  
  // 5. Extract body content if <body> exists, otherwise strip <head>...</head>, <html>, </html>, <body>, </body>
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    text = bodyMatch[1];
  } else {
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    text = text.replace(/<\/?html[^>]*>/gi, '');
    text = text.replace(/<\/?body[^>]*>/gi, '');
  }

  // 6. Strip any embedded <style>...</style>, <script>...</script>, <title>, <meta>
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  text = text.replace(/<meta[^>]*>/gi, '');
  
  // 7. Unwrap <header> and <section> tags
  text = text.replace(/<\/?header[^>]*>/gi, '');
  text = text.replace(/<\/?section[^>]*>/gi, '');
  
  // 8. Convert <dl><dt>...</dt><dd>...</dd></dl> to FAQ cards
  text = text.replace(/<dl[^>]*>([\s\S]*?)<\/dl>/gi, (match, inner) => {
    return inner.replace(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi, (m, dt, dd) => {
      const cleanDt = dt.replace(/^\d+[\.\)]\s*/, '').trim();
      return `<div class="faq-card"><div class="faq-q"><span class="faq-badge q">Hỏi</span>${cleanDt}</div><div class="faq-a"><span class="faq-badge a">Đáp</span>${dd.trim()}</div></div>`;
    });
  });

  // 9. Convert markdown tables if markdown formatting was used
  text = text.replace(/((?:\|[^\n]+\|\n?)+)/g, (match) => {
    const rows = match.trim().split('\n').filter(r => r.includes('|') && !r.match(/^\|?\s*[-:]+[-| :]*\|?$/));
    if (rows.length === 0) return '';
    let html = '<div class="table-responsive"><table class="product-specs-table"><thead><tr>';
    const headers = rows[0].split('|').map(c => c.trim()).filter(c => c);
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split('|').map(c => c.trim()).filter(c => c);
      if (cols.length > 0) {
        html += '<tr>';
        cols.forEach((c, idx) => {
          html += idx === 0 ? `<td class="spec-label">${c}</td>` : `<td>${c}</td>`;
        });
        html += '</tr>';
      }
    }
    html += '</tbody></table></div>';
    return html;
  });

  // 10. Convert markdown headings
  text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
  
  // 11. Convert inline markdown bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 12. Convert bullet lists
  text = text.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="feature-item">$1</li>');
  text = text.replace(/(<li class="feature-item">.*?<\/li>(\s*<li class="feature-item">.*?<\/li>)*)/gs, '<ul class="feature-list">$1</ul>');

  // 13. Convert numbered lists
  text = text.replace(/^\s*(\d+)[\.\)]\s+(.+)$/gm, '<li class="step-item"><span class="step-badge">$1</span><div class="step-content">$2</div></li>');
  text = text.replace(/(<li class="step-item">.*?<\/li>(\s*<li class="step-item">.*?<\/li>)*)/gs, '<ol class="step-list">$1</ol>');
  
  // 14. Convert standard FAQ format
  text = text.replace(/<p>\s*<strong>(?:Hỏi|Câu hỏi):\s*<\/strong>\s*(.+?)<\/p>\s*<p>\s*<strong>(?:Đáp|Trả lời):\s*<\/strong>\s*(.+?)<\/p>/gi, 
    '<div class="faq-card"><div class="faq-q"><span class="faq-badge q">Hỏi</span>$1</div><div class="faq-a"><span class="faq-badge a">Đáp</span>$2</div></div>'
  );

  // 15. Ensure tables have the responsive wrapper and styling class
  text = text.replace(/<table(?!\s+class=)([^>]*)>/gi, '<div class="table-responsive"><table class="product-specs-table"$1>');
  text = text.replace(/<\/table>(?!\s*<\/div>)/gi, '</table></div>');

  // 16. Wrap remaining loose text blocks in <p>
  const blocks = text.split(/\n\n+/);
  text = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('<h') || b.startsWith('<table') || b.startsWith('<div') || b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<li')) {
      return b;
    }
    return `<p>${b.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return text.trim();
}
