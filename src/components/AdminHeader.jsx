import React from 'react';
import './AdminHeader.css';

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
    <header className="admin-header">
      {/* Row 1: Title + Actions */}
      <div 
        className="admin-header-row"
        style={{ marginBottom: extra || toolbar ? '14px' : '0' }}
      >
        <div className="admin-header-title">
          <h1>{title}</h1>
        </div>
        
        {actions && (
          <div className="admin-header-actions">
            {actions}
          </div>
        )}
      </div>

      {/* Row 1b: Extra panel (sync) */}
      {extra}

      {/* Row 2: Toolbar */}
      {toolbar && (
        <div className="admin-header-toolbar">
          {toolbar}
        </div>
      )}
    </header>
  );
}
