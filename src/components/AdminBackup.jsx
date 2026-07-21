import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, writeBatch, doc } from 'firebase/firestore';
import './AdminBackup.css';

// ============================================================
// 🔧 Cấu hình Collections cần backup
// ============================================================
const BACKUP_COLLECTIONS = [
  { id: 'products', label: '📦 Sản phẩm', dateField: 'createdAt', critical: true },
  { id: 'orders', label: '📋 Đơn hàng', dateField: 'createdAt', critical: true },
  { id: 'customers', label: '👥 Khách hàng', dateField: 'createdAt', critical: true },
  { id: 'users', label: '🔐 Người dùng', dateField: 'createdAt', critical: false },
  { id: 'coupons', label: '🎟️ Mã giảm giá', dateField: null, critical: false },
  { id: 'notifications', label: '🔔 Thông báo', dateField: 'createdAt', critical: false },
  { id: 'reviews', label: '⭐ Đánh giá', dateField: 'createdAt', critical: false },
  { id: 'affiliates', label: '🤝 Đại lý', dateField: null, critical: false },
  { id: 'affiliate_revenue', label: '💰 Doanh thu đại lý', dateField: 'createdAt', critical: false },
  { id: 'affiliate_promotions', label: '📢 KM đại lý', dateField: null, critical: false },
  { id: 'ai_consultations', label: '🤖 Tư vấn AI', dateField: 'createdAt', critical: false },
  { id: 'ai_knowledge_units', label: '🧠 Kiến thức AI', dateField: null, critical: false },
  { id: 'ai_knowledge_base', label: '📚 CS kiến thức AI', dateField: null, critical: false },
  { id: 'ai_feedback', label: '💬 Phản hồi AI', dateField: null, critical: false },
  { id: 'agency_performance', label: '📊 Hiệu suất đại lý', dateField: null, critical: false },
  { id: 'storeSettings', label: '⚙️ Cài đặt cửa hàng', dateField: null, critical: true },
  { id: 'settings', label: '🔧 Cài đặt hệ thống', dateField: null, critical: true },
];

const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + 
    ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};



// ============================================================
// 🗜️ Export: Tải toàn bộ data từ Firestore → JSON file
// ============================================================
async function exportData(selectedCollections, dateFrom, dateTo, progressCallback) {
  const backup = {
    metadata: {
      exportedAt: new Date().toISOString(),
      projectId: 'z-build-dunvex',
      source: 'Nexus Control Backup',
      totalCollections: selectedCollections.length,
      dateFilter: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null
    },
    collections: {}
  };

  let totalDocs = 0;

  for (let i = 0; i < selectedCollections.length; i++) {
    const col = selectedCollections[i];
    progressCallback({ phase: 'fetching', collection: col.label, progress: i, total: selectedCollections.length });

    try {
      let q;
      if (col.dateField && (dateFrom || dateTo)) {
        const constraints = [];
        if (col.dateField) {
          if (dateFrom) constraints.push(where(col.dateField, '>=', new Date(dateFrom)));
          if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            constraints.push(where(col.dateField, '<=', toDate));
          }
        }
        if (constraints.length > 0) {
          constraints.push(orderBy(col.dateField, 'desc'));
          q = query(collection(db, col.id), ...constraints);
        } else {
          q = collection(db, col.id);
        }
      } else {
        q = collection(db, col.id);
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => {
        const data = {};
        for (const [key, value] of Object.entries(doc.data())) {
          if (value && typeof value.toDate === 'function') {
            data[key] = value.toDate().toISOString();
          } else {
            data[key] = value;
          }
        }
        return { id: doc.id, ...data };
      });

      backup.collections[col.id] = {
        count: docs.length,
        documents: docs
      };
      totalDocs += docs.length;
    } catch (err) {
      console.error(`Lỗi export collection ${col.id}:`, err);
      backup.collections[col.id] = { count: 0, documents: [], error: err.message };
    }
  }

  backup.metadata.totalDocuments = totalDocs;
  return backup;
}

// ============================================================
// 📥 Import: Đọc JSON file → đẩy lên Firestore
// ============================================================
async function importData(backupData, collectionsToRestore, progressCallback) {
  const allCollections = Object.keys(backupData.collections);
  const targetCollections = collectionsToRestore.length > 0 
    ? allCollections.filter(c => collectionsToRestore.includes(c))
    : allCollections;

  let totalDocs = 0;
  let restoredDocs = 0;

  for (const colName of targetCollections) {
    const colData = backupData.collections[colName];
    if (!colData || !colData.documents) continue;
    totalDocs += colData.documents.length;
  }

  for (const colName of targetCollections) {
    const colData = backupData.collections[colName];
    if (!colData || !colData.documents) continue;

    progressCallback({ phase: 'restoring', collection: colName, restored: restoredDocs, total: totalDocs });

    const docs = colData.documents;
    // Batch write: max 500 per batch
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 400);
      
      chunk.forEach(docData => {
        const { id, ...fields } = docData;
        // Convert ISO strings back to Firestore Timestamps
        const parsedFields = {};
        for (const [key, value] of Object.entries(fields)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            parsedFields[key] = new Date(value);
          } else {
            parsedFields[key] = value;
          }
        }
        const docRef = doc(db, colName, id);
        batch.set(docRef, parsedFields, { merge: true });
      });

      await batch.commit();
      restoredDocs += chunk.length;
      progressCallback({ phase: 'restoring', collection: colName, restored: restoredDocs, total: totalDocs });
    }
  }

  return restoredDocs;
}

// ============================================================
// 🎨 Component: AdminBackup
// ============================================================
const AdminBackup = () => {
  const [activeTab, setActiveTab] = useState('backup');
  
  // Backup state
  const [selectedCollections, setSelectedCollections] = useState(
    BACKUP_COLLECTIONS.filter(c => c.critical).map(c => c.id)
  );
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'date', 'month'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [backupProgress, setBackupProgress] = useState(null);
  const [backupResult, setBackupResult] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef(null);

  // ========== BACKUP HANDLERS ==========
  const toggleCollection = (colId) => {
    setSelectedCollections(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    );
  };

  const selectAll = () => setSelectedCollections(BACKUP_COLLECTIONS.map(c => c.id));
  const selectCritical = () => setSelectedCollections(BACKUP_COLLECTIONS.filter(c => c.critical).map(c => c.id));
  const deselectAll = () => setSelectedCollections([]);

  const handleMonthChange = (e) => {
    const val = e.target.value; // format: YYYY-MM
    setMonthFilter(val);
    if (val) {
      const [year, month] = val.split('-');
      const lastDay = new Date(year, month, 0).getDate();
      setDateFrom(`${val}-01`);
      setDateTo(`${val}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  const handleExport = async () => {
    if (selectedCollections.length === 0) {
      alert('Vui lòng chọn ít nhất 1 collection để backup!');
      return;
    }

    setIsExporting(true);
    setBackupProgress(null);
    setBackupResult(null);

    try {
      const selected = BACKUP_COLLECTIONS.filter(c => selectedCollections.includes(c.id));
      const from = filterMode === 'all' ? null : dateFrom;
      const to = filterMode === 'all' ? null : dateTo;

      const backup = await exportData(selected, from, to, (p) => {
        setBackupProgress(p);
      });

      // Create downloadable file
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `nexus-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupResult({
        success: true,
        fileName: `nexus-backup-${timestamp}.json`,
        size: blob.size,
        collections: Object.entries(backup.collections).map(([id, data]) => ({
          id,
          label: BACKUP_COLLECTIONS.find(c => c.id === id)?.label || id,
          count: data.count,
          error: data.error
        }))
      });
    } catch (err) {
      console.error('Export error:', err);
      setBackupResult({ success: false, error: err.message });
    } finally {
      setIsExporting(false);
      setBackupProgress(null);
    }
  };

  // ========== RESTORE HANDLERS ==========
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setRestorePreview({
          metadata: data.metadata,
          collections: Object.entries(data.collections || {}).map(([id, col]) => ({
            id,
            label: BACKUP_COLLECTIONS.find(c => c.id === id)?.label || id,
            count: col.count || 0,
            error: col.error
          }))
        });
      } catch (err) {
        setRestorePreview({ error: 'File JSON không hợp lệ: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePreview || restorePreview.error) {
      alert('Vui lòng chọn file backup hợp lệ!');
      return;
    }

    const confirmMsg = `⚠️ XÁC NHẬN PHỤC HỒI DỮ LIỆU\n\n` +
      `File: ${restoreFile.name}\n` +
      `Export lúc: ${restorePreview.metadata?.exportedAt || 'Không rõ'}\n` +
      `Số collections: ${restorePreview.collections?.length || 0}\n\n` +
      `❗ Dữ liệu sẽ được MERGE vào Firestore (ghi đè document cùng ID).\n` +
      `❗ Hành động này KHÔNG THỂ HOÀN TÁC.\n\n` +
      `Bạn có chắc chắn muốn tiếp tục?`;

    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const reader = new FileReader();
      const data = await new Promise((resolve, reject) => {
        reader.onload = (e) => {
          try { resolve(JSON.parse(e.target.result)); } 
          catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(restoreFile);
      });

      const count = await importData(data, [], (p) => {
        setRestoreProgress(p);
      });

      setRestoreResult({ success: true, restoredCount: count });
    } catch (err) {
      console.error('Restore error:', err);
      setRestoreResult({ success: false, error: err.message });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="admin-product-page">
      <div className="admin-main-content">
        <header className="admin-content-header">
          <nav className="breadcrumb desktop-only">Quản trị / <span className="active">Sao lưu & Phục hồi</span></nav>
          <div className="header-main-row">
            <div className="title-group">
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2em' }}>💾</span> Sao lưu & Phục hồi Dữ liệu
              </h1>
              <p className="description">Xuất dữ liệu ra file JSON để lưu vào USB, hoặc phục hồi từ file backup có sẵn.</p>
            </div>
          </div>
        </header>

        {/* ===== TABS ===== */}
        <div className="backup-tabs">
          <button 
            className={`backup-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            📤 Sao lưu (Export)
          </button>
          <button 
            className={`backup-tab ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => setActiveTab('restore')}
          >
            📥 Phục hồi (Restore)
          </button>
        </div>

        <div className="admin-content-body">
          {/* ===================== BACKUP TAB ===================== */}
          {activeTab === 'backup' && (
            <div className="backup-panel">
              {/* Step 1: Chọn collections */}
              <div className="backup-section">
                <div className="backup-section-header">
                  <h3>📂 Chọn dữ liệu cần sao lưu</h3>
                  <div className="backup-select-actions">
                    <button className="backup-btn-sm" onClick={selectAll}>Chọn tất cả</button>
                    <button className="backup-btn-sm backup-btn-primary" onClick={selectCritical}>Chỉ quan trọng</button>
                    <button className="backup-btn-sm backup-btn-ghost" onClick={deselectAll}>Bỏ chọn</button>
                  </div>
                </div>
                <div className="backup-collections-grid">
                  {BACKUP_COLLECTIONS.map(col => (
                    <label 
                      key={col.id} 
                      className={`backup-collection-card ${selectedCollections.includes(col.id) ? 'selected' : ''} ${col.critical ? 'critical' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedCollections.includes(col.id)}
                        onChange={() => toggleCollection(col.id)}
                      />
                      <span className="collection-label">{col.label}</span>
                      {col.critical && <span className="critical-badge">Quan trọng</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 2: Lọc thời gian */}
              <div className="backup-section">
                <div className="backup-section-header">
                  <h3>📅 Lọc theo thời gian (tùy chọn)</h3>
                </div>
                <div className="backup-filter-options">
                  <label className={`backup-filter-option ${filterMode === 'all' ? 'active' : ''}`}>
                    <input type="radio" name="filterMode" checked={filterMode === 'all'} onChange={() => setFilterMode('all')} />
                    <span>Tất cả dữ liệu</span>
                  </label>
                  <label className={`backup-filter-option ${filterMode === 'date' ? 'active' : ''}`}>
                    <input type="radio" name="filterMode" checked={filterMode === 'date'} onChange={() => setFilterMode('date')} />
                    <span>Theo khoảng ngày</span>
                  </label>
                  <label className={`backup-filter-option ${filterMode === 'month' ? 'active' : ''}`}>
                    <input type="radio" name="filterMode" checked={filterMode === 'month'} onChange={() => setFilterMode('month')} />
                    <span>Theo tháng</span>
                  </label>
                </div>

                {filterMode === 'date' && (
                  <div className="backup-date-range">
                    <div className="backup-date-field">
                      <label>Từ ngày</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <span className="date-separator">→</span>
                    <div className="backup-date-field">
                      <label>Đến ngày</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                  </div>
                )}

                {filterMode === 'month' && (
                  <div className="backup-month-picker">
                    <div className="backup-date-field">
                      <label>Chọn tháng</label>
                      <input type="month" value={monthFilter} onChange={handleMonthChange} />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Progress & Result */}
              {backupProgress && (
                <div className="backup-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${((backupProgress.progress + 1) / backupProgress.total) * 100}%` }} />
                  </div>
                  <p>🔄 Đang tải: {backupProgress.collection}...</p>
                </div>
              )}

              {backupResult && backupResult.success && (
                <div className="backup-result success">
                  <div className="result-icon">✅</div>
                  <div className="result-info">
                    <h4>Xuất dữ liệu thành công!</h4>
                    <p>File: <code>{backupResult.fileName}</code></p>
                    <p>Dung lượng: {formatBytes(backupResult.size)}</p>
                    <div className="result-collections">
                      {backupResult.collections.map(c => (
                        <span key={c.id} className={`result-col-badge ${c.error ? 'error' : ''}`}>
                          {c.label}: {c.error ? '❌ Lỗi' : `${c.count} docs`}
                        </span>
                      ))}
                    </div>
                    <div className="result-actions">
                      <p className="usb-hint">
                        💡 <strong>Lưu vào USB:</strong> File đã được tải về thư mục Downloads. 
                        Hãy copy file này vào USB <code>BACKUP_USB</code> để lưu trữ an toàn.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {backupResult && !backupResult.success && (
                <div className="backup-result error">
                  <div className="result-icon">❌</div>
                  <div className="result-info">
                    <h4>Lỗi khi xuất dữ liệu</h4>
                    <p>{backupResult.error}</p>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="backup-actions">
                <button 
                  className="backup-btn-export" 
                  onClick={handleExport} 
                  disabled={isExporting || selectedCollections.length === 0}
                >
                  {isExporting ? (
                    <>🔄 Đang xuất dữ liệu...</>
                  ) : (
                    <>📤 Xuất file Backup ({selectedCollections.length} collections)</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ===================== RESTORE TAB ===================== */}
          {activeTab === 'restore' && (
            <div className="backup-panel">
              {/* Step 1: Chọn file */}
              <div className="backup-section">
                <div className="backup-section-header">
                  <h3>📂 Chọn file backup để phục hồi</h3>
                </div>
                <div className="restore-file-upload" onClick={() => fileInputRef.current?.click()}>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".json" 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }}
                  />
                  {restoreFile ? (
                    <div className="file-selected">
                      <span className="file-icon">📄</span>
                      <div>
                        <strong>{restoreFile.name}</strong>
                        <span>{formatBytes(restoreFile.size)}</span>
                      </div>
                      <button className="backup-btn-sm" onClick={(e) => { e.stopPropagation(); setRestoreFile(null); setRestorePreview(null); }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span className="file-icon">📁</span>
                      <p>Click để chọn file backup (.json)</p>
                      <span className="file-hint">Chọn file đã xuất từ Nexus Control hoặc từ USB</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Preview */}
              {restorePreview && !restorePreview.error && (
                <div className="backup-section">
                  <div className="backup-section-header">
                    <h3>📋 Xem trước dữ liệu backup</h3>
                  </div>
                  <div className="restore-preview">
                    <div className="preview-meta">
                      <div className="preview-meta-item">
                        <span className="meta-label">⏰ Export lúc</span>
                        <span className="meta-value">{formatDateTime(restorePreview.metadata?.exportedAt)}</span>
                      </div>
                      <div className="preview-meta-item">
                        <span className="meta-label">📊 Tổng documents</span>
                        <span className="meta-value">{restorePreview.metadata?.totalDocuments || 0}</span>
                      </div>
                      <div className="preview-meta-item">
                        <span className="meta-label">📂 Collections</span>
                        <span className="meta-value">{restorePreview.collections?.length || 0}</span>
                      </div>
                    </div>
                    <div className="preview-collections">
                      {restorePreview.collections?.map(c => (
                        <div key={c.id} className={`preview-col-item ${c.error ? 'has-error' : ''}`}>
                          <span>{BACKUP_COLLECTIONS.find(bc => bc.id === c.id)?.label || c.id}</span>
                          <span className={`preview-col-count ${c.error ? 'error' : ''}`}>
                            {c.error ? 'Lỗi' : `${c.count} docs`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {restorePreview?.error && (
                <div className="backup-result error">
                  <div className="result-icon">❌</div>
                  <div className="result-info">
                    <h4>File không hợp lệ</h4>
                    <p>{restorePreview.error}</p>
                  </div>
                </div>
              )}

              {/* Step 3: Progress & Result */}
              {restoreProgress && (
                <div className="backup-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${restoreProgress.total > 0 ? (restoreProgress.restored / restoreProgress.total) * 100 : 0}%` }} />
                  </div>
                  <p>🔄 Đang phục hồi: {restoreProgress.collection} ({restoreProgress.restored}/{restoreProgress.total} docs)</p>
                </div>
              )}

              {restoreResult && restoreResult.success && (
                <div className="backup-result success">
                  <div className="result-icon">✅</div>
                  <div className="result-info">
                    <h4>Phục hồi dữ liệu thành công!</h4>
                    <p>Đã khôi phục <strong>{restoreResult.restoredCount}</strong> documents vào Firestore.</p>
                  </div>
                </div>
              )}

              {restoreResult && !restoreResult.success && (
                <div className="backup-result error">
                  <div className="result-icon">❌</div>
                  <div className="result-info">
                    <h4>Lỗi khi phục hồi dữ liệu</h4>
                    <p>{restoreResult.error}</p>
                  </div>
                </div>
              )}

              {/* Restore Button */}
              <div className="backup-actions">
                <button 
                  className="backup-btn-restore" 
                  onClick={handleRestore} 
                  disabled={isRestoring || !restorePreview || restorePreview.error}
                >
                  {isRestoring ? (
                    <>🔄 Đang phục hồi dữ liệu...</>
                  ) : (
                    <>📥 Phục hồi dữ liệu vào Firestore</>
                  )}
                </button>
              </div>

              {/* Warning */}
              <div className="restore-warning">
                <span>⚠️</span>
                <div>
                  <strong>Lưu ý quan trọng:</strong>
                  <ul>
                    <li>Phục hồi sẽ <strong>MERGE</strong> dữ liệu (ghi đè document có cùng ID, thêm mới nếu chưa có)</li>
                    <li>Dữ liệu cũ <strong>KHÔNG bị xóa</strong> — chỉ bị ghi đè nếu trùng ID</li>
                    <li>Hãy <strong>backup trước</strong> khi phục hồi để tránh mất dữ liệu</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBackup;
