import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const renderBoardContent = (board, isMobile) => {
  if (!board) return null;

  switch (board.type) {
    case 'table':
      return (
        <div className="table-display-container" style={{ width: '100%' }}>
          {isMobile ? (
            <div className="mobile-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {board.content.rows?.map((row, i) => (
                <div key={i} style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  {row.map((cell, j) => {
                    const headerName = board.content.headers?.[j] || '';
                    if (j === 0) {
                      return (
                        <div key={j} style={{ fontWeight: 800, fontSize: '1.1rem', color: '#DAA520', borderBottom: '2px dashed #E2E8F0', paddingBottom: '10px', marginBottom: '15px', textAlign: 'center' }}>
                          {headerName ? `${headerName}: ${cell}` : cell}
                        </div>
                      )
                    }
                    return (
                      <div key={j} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: j === row.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                        {headerName && <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{headerName}</span>}
                        <span style={{ fontSize: '1rem', color: '#1A2130', lineHeight: '1.5', whiteSpace: 'normal', wordBreak: 'break-word' }}>{cell}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table className="premium-table" style={{ minWidth: '500px' }}>
                <thead><tr>{board.content.headers?.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{board.content.rows?.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      );
    case 'chart':
      return (
        <div className="chart-wrapper" style={{ height: '400px', width: '100%', marginTop: '20px' }}>
           <ResponsiveContainer width="100%" height="100%">
              {board.chartType === 'line' ? (
                <LineChart data={board.content} margin={{ top: 20, right: isMobile ? 0 : 30, left: isMobile ? -20 : 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="value" stroke="#DAA520" strokeWidth={4} dot={{ r: 6, fill: '#DAA520' }} activeDot={{ r: 8 }} />
                </LineChart>
              ) : board.chartType === 'pie' ? (
                <PieChart>
                   <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                   <Pie data={board.content} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={120} fill="#DAA520" label>
                      {board.content?.map((entry, index) => <Cell key={`cell-${index}`} fill={['#DAA520', '#1A2130', '#64748B', '#cbd5e1'][index % 4]} />)}
                   </Pie>
                   <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              ) : (
                <BarChart data={board.content} margin={{ top: 20, right: isMobile ? 0 : 30, left: isMobile ? -20 : 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" fill="#DAA520" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              )}
           </ResponsiveContainer>
        </div>
      );
    default: return null;
  }
};

const DataBoard = ({ board, isMobile }) => {
  return (
    <div className="inline-board-container" style={{ width: '100%', maxWidth: '1000px', background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', padding: isMobile ? '16px' : '30px', marginTop: '15px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: '#FFFBEB', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DAA520" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', color: '#1A2130', margin: 0, fontWeight: 800, flex: 1, lineHeight: '1.3' }}>{board.title}</h3>
       </div>
       <p style={{ color: '#64748B', marginBottom: '25px', paddingLeft: isMobile ? '0' : '55px', fontSize: '1rem', lineHeight: '1.5' }}>{board.description}</p>
       
       {board.stats && (
         <div className="stats-grid" style={{ marginBottom: '30px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
           {board.stats.map(s => (
             <div key={s.id} className="stat-card" style={{ background: '#F8FAFC', padding: isMobile ? '12px' : '20px', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: 900, margin: '6px 0', color: '#1A2130', wordBreak: 'break-word' }}>{s.value}</h2>
                {s.change && <span style={{ fontSize: '0.75rem', color: s.trend === 'up' ? '#10B981' : (s.trend === 'down' ? '#E11D48' : '#64748B'), fontWeight: 700, background: s.trend === 'up' ? '#DCFCE7' : (s.trend === 'down' ? '#FEE2E2' : '#F1F5F9'), padding: '4px 8px', borderRadius: '100px', display: 'inline-block' }}>
                  {s.trend === 'up' ? '↗ ' : (s.trend === 'down' ? '↘ ' : '• ')}{s.change}
                </span>}
             </div>
           ))}
         </div>
       )}

       <div className="boards-list">
          {board.boards?.map((b, idx) => (
             <div key={idx} style={{ marginBottom: '35px' }}>
                <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: '#1A2130', fontWeight: 700 }}>{b.name}</h4>
                <div style={{ background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', padding: b.type === 'chart' ? (isMobile ? '10px' : '20px') : '0' }}>
                  {renderBoardContent(b, isMobile)}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export default DataBoard;
