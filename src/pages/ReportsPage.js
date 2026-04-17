import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';
import './ReportsPage.css';

export default function ReportsPage() {
  const [internData, setInternData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: users, error: usersError } = await supabase.from('users').select('*').limit(200);
      if (usersError) throw usersError;
      const interns = (users || []).filter(u => u.role === 'user' || !u.role);

      const data = await Promise.all(interns.map(async (u) => {
        try {
          const { data: logs, error: logsError } = await supabase
            .from('time_logs')
            .select('*')
            .eq('user_id', u.id);
          if (logsError) throw logsError;
          let rendered = 0;
          (logs || []).forEach(l => { if (l.status === 'approved' && l.hours != null) rendered += Number(l.hours); });
          const required = u.setup?.requiredHours || 486;
          const remaining = Math.max(0, required - rendered);
          const progress = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
          return { ...u, logs: logs || [], rendered, remaining, progress, required };
        } catch (err) {
          console.error('Error fetching logs:', err);
          return { ...u, logs: [], rendered: 0, remaining: u.setup?.requiredHours || 486, progress: 0, required: u.setup?.requiredHours || 486 };
        }
      }));
      setInternData(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Filter by date range
  const filteredData = internData.map(u => {
    if (!dateFrom && !dateTo) return u;
    const filteredLogs = u.logs.filter(l => {
      if (!l.date) return false;
      if (dateFrom && l.date < dateFrom) return false;
      if (dateTo && l.date > dateTo) return false;
      return true;
    });
    let rendered = 0;
    filteredLogs.forEach(l => { if (l.status === 'approved' && l.hours != null) rendered += Number(l.hours); });
    return { ...u, rendered, filteredLogs };
  });

  const totalRendered = filteredData.reduce((s, u) => s + u.rendered, 0);
  const companies = [...new Set(filteredData.map(u => u.company).filter(Boolean))];

  const exportCSV = () => {
    if (filteredData.length === 0) { alert('No data to export.'); return; }
    const headers = ['Name', 'Email', 'Company', 'Required Hours', 'Rendered Hours', 'Remaining Hours', 'Progress %'];
    const rows = filteredData.map(u => [
      u.name || '', u.email || '', u.company || '', u.required,
      u.rendered.toFixed(2), u.remaining.toFixed(2), u.progress.toFixed(1)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `internly-ojt-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Simple printable HTML report
    const rows = filteredData.map(u =>
      `<tr><td>${u.name || '—'}</td><td>${u.email}</td><td>${u.company || '—'}</td><td>${u.required}</td><td>${u.rendered.toFixed(2)}</td><td>${u.remaining.toFixed(2)}</td><td>${u.progress.toFixed(1)}%</td></tr>`
    ).join('');
    const html = `<html><head><title>Internly OJT Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#7B68EE;color:white;font-size:12px}</style></head><body><h1>Internly OJT Hours Report</h1><p>Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Required</th><th>Rendered</th><th>Remaining</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="reports-page">
      <div className="page-head">
        <div>
          <h1>Reports & Exports</h1>
          <p>OJT hours reports with date filtering</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={fetchData} disabled={loading}>Refresh</button>
          <button className="btn-export" onClick={exportCSV}>📥 CSV</button>
          <button className="btn-export" onClick={exportPDF}>🖨 PDF</button>
        </div>
      </div>

      {/* Date filters */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
        <input type="date" className="search-input" style={{ width: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
        <input type="date" className="search-input" style={{ width: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && <button className="chip active" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear Filter</button>}
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="sum-card"><span className="sum-val">{filteredData.length}</span><span className="sum-lab">Total Interns</span></div>
        <div className="sum-card"><span className="sum-val">{companies.length}</span><span className="sum-lab">Companies</span></div>
        <div className="sum-card"><span className="sum-val">{totalRendered.toFixed(1)}</span><span className="sum-lab">Total Rendered Hrs</span></div>
        <div className="sum-card">
          <span className="sum-val">{filteredData.length > 0 ? (totalRendered / filteredData.length).toFixed(1) : 0}</span>
          <span className="sum-lab">Avg Rendered / Intern</span>
        </div>
      </div>

      {/* Intern Table */}
      <div className="table-card">
        <h3>OJT Hours Report</h3>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Company</th><th>Required</th><th>Rendered</th><th>Remaining</th><th>Progress</th></tr></thead>
          <tbody>
            {filteredData.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td className="td-name">{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{u.company || '—'}</td>
                <td>{u.required}</td>
                <td><strong>{u.rendered.toFixed(2)}</strong></td>
                <td>{u.remaining.toFixed(2)}</td>
                <td>
                  <div className="progress-cell">
                    <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${u.progress}%` }} /></div>
                    <span>{u.progress.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && !loading && (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>No interns found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per-Company Breakdown */}
      {companies.length > 0 && (
        <div className="table-card" style={{ marginTop: 20 }}>
          <h3>Per-Company Breakdown</h3>
          <table>
            <thead><tr><th>Company</th><th>Interns</th><th>Total Rendered</th><th>Avg Rendered</th></tr></thead>
            <tbody>
              {companies.map(c => {
                const group = filteredData.filter(u => u.company === c);
                const hrs = group.reduce((s, u) => s + u.rendered, 0);
                return (
                  <tr key={c}>
                    <td className="td-name">{c}</td>
                    <td>{group.length}</td>
                    <td>{hrs.toFixed(1)}</td>
                    <td>{(hrs / group.length).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
