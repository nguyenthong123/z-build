import React from 'react';

/**
 * AdminHeader — unified card header for all admin pages.
 * Renders as a white card header that connects seamlessly to content below.
 * Props:
 *   title       - page title (string)
 *   actions     - right-side buttons (ReactNode)
 *   extra       - optional collapsible panel below title row (ReactNode)
 *   toolbar     - optional bottom toolbar (search, filter, etc.)
 */
export default function AdminHeader({ title, actions, extra, toolbar }) {
  return (
    <header 
      style={{ 
        position: 'sticky',
        top: '32px',
        zIndex: 40,
        background: '#fff',
        borderRadius: '14px 14px 0 0',
        padding: '24px 28px 20px 28px',
        borderBottom: '1px solid #e2e8f0'
      }}
    >
      {/* Row 1: Title + Actions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px', 
        marginBottom: extra || toolbar ? '14px' : '0',
        minHeight: '40px'
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.35rem', 
            fontWeight: 700, 
            color: '#0F172A', 
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em'
          }}>
            {title}
          </h1>
        </div>
        
        {actions && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginLeft: 'auto', 
            flexShrink: 0 
          }}>
            {actions}
          </div>
        )}
      </div>

      {/* Row 1b: Extra panel (sync) */}
      {extra}

      {/* Row 2: Toolbar */}
      {toolbar && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center', 
          minHeight: '40px' 
        }}>
          {toolbar}
        </div>
      )}
    </header>
  );
}
