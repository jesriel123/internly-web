import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './ReportsPage.css';

export default function ReportsPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'super_admin';
  const hasRole = Boolean(me?.role);
  const [internData, setInternData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const adminCompany = String(me?.company || '').trim();
      let usersQuery = supabase.from('users').select('*').limit(200);
      if (!isSuperAdmin) {
        if (!adminCompany) {
          setInternData([]);
          setLoading(false);
          return;
        }
        usersQuery = usersQuery.eq('company', adminCompany);
      }

      const { data: users, error: usersError } = await usersQuery;
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
  }, [me?.company, isSuperAdmin]);

  useEffect(() => {
    if (!hasRole) return;
    fetchData();
  }, [fetchData, hasRole]);

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
    if (filteredData.length === 0) {
      alert('No data to export.');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const generatedAt = new Date().toLocaleString();
      const periodText = `${dateFrom || 'Start'} to ${dateTo || 'End'}`;

      doc.setFontSize(16);
      doc.text('Internly OJT Hours Report', 40, 36);
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Generated: ${generatedAt}`, 40, 54);
      doc.text(`Period: ${periodText}`, 40, 68);
      doc.text(`Interns: ${filteredData.length} | Companies: ${companies.length} | Total Rendered: ${totalRendered.toFixed(1)} hrs`, 40, 82);

      const tableBody = filteredData.map((u, i) => [
        i + 1,
        u.name || '—',
        u.email || '—',
        u.company || '—',
        u.required,
        u.rendered.toFixed(2),
        u.remaining.toFixed(2),
        `${u.progress.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: 96,
        head: [['#', 'Name', 'Email', 'Company', 'Required', 'Rendered', 'Remaining', 'Progress']],
        body: tableBody,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      });

      doc.save(`internly-ojt-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  return (
    <div className="reports-page">
      <div className="page-head">
        <div>
          <h1>Reports & Exports</h1>
          <p>OJT hours reports with date filtering</p>
        </div>
        <div className="report-actions">
          <button className="btn-primary" onClick={fetchData} disabled={loading}>Refresh</button>
          <button className="btn-export" onClick={exportCSV}>📥 CSV</button>
          <button className="btn-export" onClick={exportPDF}>🖨 PDF</button>
        </div>
      </div>

      {/* Date filters */}
      <div className="toolbar report-toolbar">
        <label className="report-filter-label">From:</label>
        <input type="date" className="search-input report-date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <label className="report-filter-label">To:</label>
        <input type="date" className="search-input report-date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && <button className="chip active report-clear-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear Filter</button>}
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
      <div className="table-card report-card">
        <h3 className="report-card-title">OJT Hours Report</h3>
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
              <tr><td colSpan="8" className="report-empty">No interns found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per-Company Breakdown */}
      {companies.length > 0 && (
        <div className="table-card report-card report-breakdown-card">
          <h3 className="report-card-title">Per-Company Breakdown</h3>
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
