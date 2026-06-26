import React from 'react';

/**
 * AdminHeader — unified sticky header for all admin pages.
 * Props:
 *   title       - page title (string)
 *   actions     - right-side buttons (ReactNode)
 *   extra       - optional collapsible panel below title row (ReactNode)
 *   toolbar     - optional bottom toolbar (search, filter, etc.)
 *   sticky      - whether to stick on scroll (default true)
 */
export default function AdminHeader({ title, actions, extra, toolbar, sticky = true }) {
  return (
    <header 
      style={{ 
        position: sticky ? 'sticky' : 'relative', 
        top: 0, 
        zIndex: 40, 
        background: '#f1f5f9', 
        paddingTop: '16px', 
        paddingBottom: '12px', 
        marginBottom: 0,
        minHeight: extra ? 'auto' : '56px'
      }}
    >
      {/* Row 1: Title + Actions — fixed height, no-wrap */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        marginBottom: extra || toolbar ? '10px' : '0',
        minHeight: '36px'
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.25rem', 
            fontWeight: 700, 
            color: '#0F172A', 
            whiteSpace: 'nowrap' 
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

      {/* Row 1b: Extra panel (e.g. sync panel) — collapsible */}
      {extra}

      {/* Row 2: Toolbar — fixed height */}
      {toolbar && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center', 
          minHeight: '38px' 
        }}>
          {toolbar}
        </div>
      )}
    </header>
  );
}
