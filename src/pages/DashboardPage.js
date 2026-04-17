import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css';

// SVG Icon components
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconGraduate = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconHalfDay = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M12 2v20M2 12h10"/><circle cx="12" cy="12" r="10"/>
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ATTEND_CONFIG = [
  { key: 'present',  label: 'Present Days',   Icon: IconCheck,   color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'absent',   label: 'Absent Days',    Icon: IconX,       color: '#EF4444', bg: '#FEE2E2' },
  { key: 'halfDay',  label: 'Half Day',       Icon: IconHalfDay, color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'earlyOut', label: 'Early Out',      Icon: IconClock,   color: '#3B82F6', bg: '#DBEAFE' },
];

function getECD(remainingHours, dailyMax) {
  if (remainingHours <= 0) return 'Completed';
  const workdays = Math.ceil(remainingHours / dailyMax);
  const d = new Date();
  let ct = 0;
  while (ct < workdays) { d.setDate(d.getDate() + 1); const day = d.getDay(); if (day !== 0 && day !== 6) ct++; }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function classifyLog(hours, dailyMax) {
  if (hours == null) return 'absent';
  const h = Number(hours);
  if (h >= dailyMax) return 'present';
  if (h >= dailyMax / 2) return 'earlyOut';
  return 'halfDay';
}

function computeAttendance(logs, startDate, dailyMax) {
  const logMap = {};
  logs.forEach(l => { logMap[l.date] = l; });
  let present = 0, absent = 0, halfDay = 0, earlyOut = 0;
  if (startDate) {
    const start = new Date(startDate + (startDate.includes('T') ? '' : 'T00:00:00'));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    const d = new Date(start);
    while (d <= yesterday) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const log = logMap[key];
        if (!log || log.status === 'rejected') { absent++; }
        else {
          const type = classifyLog(log.status === 'approved' ? log.hours : null, dailyMax);
          if (type === 'present') present++;
          else if (type === 'halfDay') halfDay++;
          else if (type === 'earlyOut') earlyOut++;
          else absent++;
        }
      }
      d.setDate(d.getDate() + 1);
    }
  } else {
    logs.forEach(l => {
      if (l.status === 'approved') {
        const t = classifyLog(l.hours, dailyMax);
        if (t === 'present') present++;
        else if (t === 'halfDay') halfDay++;
        else if (t === 'earlyOut') earlyOut++;
      }
    });
  }
  return { present, absent, halfDay, earlyOut };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [stats, setStats] = useState({ totalUsers: 0, admins: 0, companies: 0, activeInterns: 0 });
  const [internStats, setInternStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyRecords, setCompanyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendSearch, setAttendSearch] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: list, error: usersError }, { data: companyList, error: companiesError }] = await Promise.all([
        supabase.from('users').select('*').limit(200),
        supabase.from('companies').select('name').limit(200),
      ]);
      if (usersError) throw usersError;
      if (companiesError) throw companiesError;

      setUsers(list || []);
      setCompanyRecords(companyList || []);

      const admins = (list || []).filter(u => u.role === 'admin' || u.role === 'super_admin').length;
      const assignedCompanyNames = [...new Set((list || []).map(u => String(u.company || '').trim()).filter(Boolean))];
      const recordCompanyNames = [...new Set((companyList || []).map(c => String(c?.name || '').trim()).filter(Boolean))];
      const companies = recordCompanyNames.length > 0
        ? recordCompanyNames.length
        : assignedCompanyNames.length;

      let interns = (list || []).filter(u => u.role === 'user' || !u.role);
      if (!isSuperAdmin && user?.company) interns = interns.filter(u => u.company === user.company);
      setStats({ totalUsers: (list || []).length, admins, companies, activeInterns: interns.length });

      const internData = await Promise.all(interns.map(async (intern) => {
        try {
          const { data: logs, error: logsError } = await supabase
            .from('time_logs')
            .select('*')
            .eq('user_id', intern.id);
          if (logsError) throw logsError;
          let rendered = 0;
          (logs || []).forEach(d => { if (d.status === 'approved' && d.hours != null) rendered += Number(d.hours); });
          const required = intern.setup?.requiredHours || 486;
          const dailyMax = intern.setup?.dailyMaxHours || 8;
          const remaining = Math.max(0, required - rendered);
          const progress = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
          const attendance = computeAttendance(logs || [], intern.startDate, dailyMax);
          return { ...intern, rendered, remaining, progress, required, dailyMax, ecd: getECD(remaining, dailyMax), attendance };
        } catch (err) {
          console.error('Error fetching logs for intern:', err);
          return { ...intern, rendered: 0, remaining: intern.setup?.requiredHours || 486, progress: 0, required: intern.setup?.requiredHours || 486, dailyMax: 8, ecd: '—', attendance: { present: 0, absent: 0, halfDay: 0, earlyOut: 0 } };
        }
      }));
      setInternStats(internData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally { setLoading(false); }
  };

  const companyMap = {};
  companyRecords.forEach((c) => {
    const name = String(c?.name || '').trim();
    if (!name) return;
    companyMap[name] = 0;
  });
  users.forEach(u => {
    const c = String(u.company || 'Unassigned').trim() || 'Unassigned';
    if (!Object.prototype.hasOwnProperty.call(companyMap, c)) companyMap[c] = 0;
    companyMap[c] += 1;
  });
  const companyData = Object.entries(companyMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const attendTotals = internStats.reduce((acc, u) => {
    acc.present  += u.attendance?.present  || 0;
    acc.absent   += u.attendance?.absent   || 0;
    acc.halfDay  += u.attendance?.halfDay  || 0;
    acc.earlyOut += u.attendance?.earlyOut || 0;
    return acc;
  }, { present: 0, absent: 0, halfDay: 0, earlyOut: 0 });

  const filteredInterns = internStats.filter(u => {
    if (!attendSearch.trim()) return true;
    const q = attendSearch.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.company || '').toLowerCase().includes(q);
  });

  const KPI_CARDS = [
    { label: 'Total Users',    value: stats.totalUsers,    Icon: IconUsers,    color: '#7B68EE' },
    { label: isSuperAdmin ? 'Active Interns' : 'My Company Interns', value: stats.activeInterns, Icon: IconGraduate, color: '#10B981' },
    { label: 'Companies',      value: stats.companies,     Icon: IconBuilding, color: '#F59E0B' },
    { label: 'Admin Staff',    value: stats.admins,        Icon: IconShield,   color: '#3B82F6' },
  ];

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, <strong>{user?.name || 'Admin'}</strong>{!isSuperAdmin && user?.company ? ` — ${user.company}` : ''}</p>
        </div>
        <button className="btn-primary" onClick={fetchData} disabled={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{marginRight:6,verticalAlign:'middle'}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {KPI_CARDS.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: k.color + '15', color: k.color }}><k.Icon /></div>
            <div className="kpi-body">
              <span className="kpi-val">{loading ? '—' : k.value}</span>
              <span className="kpi-lab">{k.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance KPI Strip */}
      <div className="attend-kpi-grid">
        {ATTEND_CONFIG.map(cfg => (
          <div key={cfg.key} className="attend-kpi-card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
            <div className="attend-kpi-icon" style={{ background: cfg.bg, color: cfg.color }}><cfg.Icon /></div>
            <div>
              <span className="attend-kpi-val" style={{ color: cfg.color }}>{loading ? '—' : attendTotals[cfg.key]}</span>
              <span className="attend-kpi-lab">{cfg.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Users per Company</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={companyData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#7B68EE" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Attendance Overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ATTEND_CONFIG.map(c => ({ name: c.label, value: attendTotals[c.key], color: c.color }))} barSize={36} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {ATTEND_CONFIG.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-card">
        <div className="table-head-row">
          <h3>Intern Attendance Summary{!isSuperAdmin && user?.company ? ` — ${user.company}` : ''}</h3>
          <input className="search-input" placeholder="Search name or company…" value={attendSearch} onChange={e => setAttendSearch(e.target.value)} style={{ maxWidth: 220 }} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Progress</th>
              <th>Est. End Date</th>
              <th><span style={{ color: '#7C3AED' }}>Present</span></th>
              <th><span style={{ color: '#EF4444' }}>Absent</span></th>
              <th><span style={{ color: '#F59E0B' }}>Half Day</span></th>
              <th><span style={{ color: '#3B82F6' }}>Early Out</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredInterns.map(u => (
              <tr key={u.id}>
                <td className="td-name">{u.name || '—'}</td>
                <td>{u.company || '—'}</td>
                <td>
                  <div className="progress-cell">
                    <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${u.progress}%` }} /></div>
                    <span>{u.progress.toFixed(1)}%</span>
                  </div>
                </td>
                <td>{u.ecd}</td>
                <td><span className="attend-badge" style={{ color: '#7C3AED', background: '#EDE9FE' }}>{u.attendance?.present ?? 0}</span></td>
                <td><span className="attend-badge" style={{ color: '#EF4444', background: '#FEE2E2' }}>{u.attendance?.absent ?? 0}</span></td>
                <td><span className="attend-badge" style={{ color: '#F59E0B', background: '#FEF3C7' }}>{u.attendance?.halfDay ?? 0}</span></td>
                <td><span className="attend-badge" style={{ color: '#3B82F6', background: '#DBEAFE' }}>{u.attendance?.earlyOut ?? 0}</span></td>
              </tr>
            ))}
            {filteredInterns.length === 0 && !loading && (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>No interns found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

