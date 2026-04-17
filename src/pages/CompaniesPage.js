import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { logButtonClick, logRequestStart, logRequestSuccess, logRequestFailure } from '../utils/debugLogger';
import { writeAuditLog } from '../utils/auditLogger';
import './CompaniesPage.css';

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 22V12h6v10"/>
    <path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01"/>
  </svg>
);

const getEmptyAdminForm = () => ({ name: '', email: '', password: '', confirmPassword: '' });

export default function CompaniesPage() {
  const { user: me } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', requiredHours: 500, address: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', requiredHours: 500, address: '' });
  const [savingCompany, setSavingCompany] = useState(false);
  const [adminModalCompany, setAdminModalCompany] = useState(null);
  const [adminForm, setAdminForm] = useState(getEmptyAdminForm());
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const start = logRequestStart('COMPANIES_FETCH');
    setLoading(true);
    try {
      const [{ data: companies, error: compError }, { data: users, error: usersError }] = await Promise.all([
        supabase.from('companies').select('*').limit(100),
        supabase.from('users').select('*').limit(200),
      ]);
      if (compError) throw compError;
      if (usersError) throw usersError;
      setCompanies(companies || []);
      setUsers(users || []);
      logRequestSuccess('COMPANIES_FETCH', start);
    } catch (err) {
      logRequestFailure('COMPANIES_FETCH', start, err);
    } finally { setLoading(false); }
  };

  const addCompany = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    logButtonClick('ADD_COMPANY');
    const start = logRequestStart('ADD_COMPANY');
    try {
      const { error } = await supabase.from('companies').insert({
        name: form.name.trim(),
        required_hours: Number(form.requiredHours) || 500,
        address: form.address.trim(),
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      logRequestSuccess('ADD_COMPANY', start);
      setForm({ name: '', requiredHours: 500, address: '' });
      setShowAdd(false);
      fetchAll();
    } catch (err) {
      logRequestFailure('ADD_COMPANY', start, err);
      alert('Error: ' + err.message);
    }
  };

  const removeCompany = async (id) => {
    if (!window.confirm('Delete this company record?')) return;
    logButtonClick(`DELETE_COMPANY_${id}`);
    const start = logRequestStart('DELETE_COMPANY');
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      logRequestSuccess('DELETE_COMPANY', start);
      setCompanies(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      logRequestFailure('DELETE_COMPANY', start, err);
    }
  };

  const openEditCompany = (company) => {
    setEditingCompany(company);
    setEditForm({
      name: company?.name || '',
      requiredHours: Number(company?.required_hours ?? company?.requiredHours ?? 500),
      address: company?.address || '',
    });
  };

  const saveCompanyEdit = async () => {
    if (!editingCompany) return;
    if (!editForm.name.trim()) return alert('Company name is required.');

    setSavingCompany(true);
    try {
      const oldName = String(editingCompany?.name || '').trim();
      const newName = editForm.name.trim();
      const payload = {
        name: newName,
        required_hours: Number(editForm.requiredHours) || 500,
        address: editForm.address.trim() || null,
      };

      const { error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', editingCompany.id);
      if (error) throw error;

      // Keep user-company references aligned when company name changes.
      if (oldName && oldName !== newName) {
        const { error: usersError } = await supabase
          .from('users')
          .update({ company: newName })
          .eq('company', oldName);
        if (usersError) throw usersError;
      }

      await writeAuditLog(me, 'EDIT_COMPANY', `Updated company ${oldName || editingCompany.id} to ${newName}`);
      setEditingCompany(null);
      fetchAll();
    } catch (err) {
      alert('Failed to update company: ' + err.message);
    } finally {
      setSavingCompany(false);
    }
  };

  const openAdminModal = (companyName) => {
    setAdminModalCompany(companyName);
    setAdminForm(getEmptyAdminForm());
  };

  const createCompanyAdmin = async () => {
    if (!adminModalCompany) return;

    const companyName = String(adminModalCompany || '').trim();
    const name = String(adminForm.name || '').trim();
    const email = String(adminForm.email || '').trim().toLowerCase();
    const password = String(adminForm.password || '');
    const confirmPassword = String(adminForm.confirmPassword || '');

    if (!name || !email || !password || !confirmPassword) {
      return alert('Complete all required fields first.');
    }
    if (password.length < 6) {
      return alert('Password must be at least 6 characters.');
    }
    if (password !== confirmPassword) {
      return alert('Passwords do not match.');
    }

    const hasExistingEmail = users.some(
      (u) => String(u?.email || '').trim().toLowerCase() === email
    );
    if (hasExistingEmail) {
      return alert('Email is already used by another account.');
    }

    setAssigningAdmin(true);
    const isolatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    try {
      const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;

      let createdUserId = signUpData?.user?.id || null;
      let authSession = signUpData?.session || null;

      // Email confirmation can return a user without a session.
      if (!authSession) {
        const { data: signInData, error: signInError } = await isolatedClient.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw new Error('Auth user created but no active session for profile insert. Disable email confirmation or create via server function.');
        }
        createdUserId = signInData?.user?.id || createdUserId;
        authSession = signInData?.session || null;
      }

      if (!createdUserId || !authSession) {
        throw new Error('Unable to initialize a session for the new admin account.');
      }

      const companyRecord = companies.find(
        (c) => String(c?.name || '').trim() === companyName
      );
      const profilePayload = {
        id: createdUserId,
        email,
        name,
        role: 'admin',
        company: companyName,
        required_hours: Number(companyRecord?.required_hours ?? companyRecord?.requiredHours ?? 500),
        daily_max_hours: 8,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await isolatedClient
        .from('users')
        .insert(profilePayload);
      if (insertError) throw insertError;

      await writeAuditLog(
        me,
        'CREATE_COMPANY_ADMIN',
        `Created admin account ${email} for ${companyName}`
      );

      setAdminModalCompany(null);
      setAdminForm(getEmptyAdminForm());
      await fetchAll();
      alert('Admin account created successfully.');
    } catch (err) {
      alert('Failed to create admin account: ' + err.message);
    } finally {
      isolatedClient.auth.signOut().catch(() => {});
      setAssigningAdmin(false);
    }
  };

  // Build inline stats: include all company records first, then merge intern assignments.
  const companyStats = {};

  (companies || []).forEach((c) => {
    const name = String(c?.name || '').trim();
    if (!name) return;
    companyStats[name] = { count: 0, totalHours: 0 };
  });

  users.filter(u => (u.role || 'user') === 'user').forEach(u => {
    const c = String(u.company || 'Unassigned').trim() || 'Unassigned';
    if (!companyStats[c]) companyStats[c] = { count: 0, totalHours: 0 };
    companyStats[c].count++;
    companyStats[c].totalHours += Number(u.totalHours ?? u.total_hours ?? 0);
  });

  const companyStatsEntries = Object.entries(companyStats)
    .sort(([a], [b]) => a.localeCompare(b));

  const usersInAdminCompany = adminModalCompany
    ? users.filter(u => String(u.company || '').trim() === adminModalCompany)
    : [];
  const existingAdmins = usersInAdminCompany.filter(u => {
    const role = u.role || 'user';
    return role === 'admin' || role === 'super_admin';
  });

  return (
    <div className="companies-page">
      <div className="page-head">
        <div>
          <h1>Companies & OJT Hours</h1>
          <p>Manage company records and intern placements</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={() => { logButtonClick('REFRESH_COMPANIES'); fetchAll(); }} disabled={loading}>Refresh</button>
          {me?.role === 'super_admin' && (
            <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? '✕ Cancel' : '＋ Add Company'}
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <form className="add-form" onSubmit={addCompany}>
          <input placeholder="Company Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Required Hours" type="number" value={form.requiredHours} onChange={e => setForm(f => ({ ...f, requiredHours: e.target.value }))} />
          <input placeholder="Address (optional)" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <button type="submit" className="btn-primary">Save Company</button>
        </form>
      )}

      {/* Live stats from users */}
      <div className="stats-grid">
        {companyStatsEntries.map(([name, s]) => (
          <div key={name} className="stat-card" onClick={() => setSelectedCompany(name)} style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            <div className="stat-icon"><IconBuilding /></div>
            <div>
              <strong>{name}</strong>
              <p>{s.count} intern{s.count !== 1 ? 's' : ''} · {s.totalHours} total hours</p>
            </div>
          </div>
        ))}
        {companyStatsEntries.length === 0 && !loading && (
          <p className="empty-msg">No intern data yet.</p>
        )}
      </div>

      {/* Firestore companies collection */}
      <div className="table-card">
        <h3>Company Records</h3>
        <table>
          <thead><tr><th>Name</th><th>Required Hours</th><th>Address</th><th>Actions</th></tr></thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id}>
                <td className="td-name">{c.name}</td>
                <td>{c.required_hours ?? c.requiredHours ?? 500}</td>
                <td>{c.address || '—'}</td>
                <td>
                  {me?.role === 'super_admin' && (
                    <div className="company-actions">
                      <button className="action-btn edit" onClick={() => openEditCompany(c)}>Edit</button>
                      <button className="action-btn info" onClick={() => openAdminModal(String(c.name || '').trim())}>Create Admin</button>
                      <button className="action-btn danger" onClick={() => removeCompany(c.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {companies.length === 0 && !loading && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>No companies added yet. Click "+ Add Company" above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingCompany && (
        <div className="company-modal-overlay" onClick={() => setEditingCompany(null)}>
          <div className="company-modal-card" onClick={e => e.stopPropagation()}>
            <div className="company-modal-header">
              <h2>Edit Company</h2>
              <button className="company-modal-close" onClick={() => setEditingCompany(null)}>✕</button>
            </div>
            <div className="company-modal-body">
              <div className="company-field">
                <label>Company Name</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Company Name"
                />
              </div>
              <div className="company-field">
                <label>Required Hours</label>
                <input
                  type="number"
                  value={editForm.requiredHours}
                  onChange={e => setEditForm(f => ({ ...f, requiredHours: e.target.value }))}
                  placeholder="Required Hours"
                />
              </div>
              <div className="company-field">
                <label>Address</label>
                <input
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Address"
                />
              </div>
            </div>
            <div className="company-modal-footer">
              <button className="company-btn-ghost" onClick={() => setEditingCompany(null)} disabled={savingCompany}>Cancel</button>
              <button className="company-btn-primary" onClick={saveCompanyEdit} disabled={savingCompany}>
                {savingCompany ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {adminModalCompany && (
        <div className="company-modal-overlay" onClick={() => setAdminModalCompany(null)}>
          <div className="company-modal-card small" onClick={e => e.stopPropagation()}>
            <div className="company-modal-header">
              <h2>Create Admin — {adminModalCompany}</h2>
              <button className="company-modal-close" onClick={() => setAdminModalCompany(null)}>✕</button>
            </div>
            <div className="company-modal-body">
              <p className="hint-text">Super Admin will create a new admin account and assign it to this company.</p>

              <div className="company-field">
                <label>Full Name</label>
                <input
                  value={adminForm.name}
                  onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Admin full name"
                />
              </div>

              <div className="company-field">
                <label>Email</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@company.com"
                />
              </div>

              <div className="company-field">
                <label>Password</label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="At least 6 characters"
                />
              </div>

              <div className="company-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={adminForm.confirmPassword}
                  onChange={e => setAdminForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                />
              </div>

              {existingAdmins.length > 0 && (
                <p className="hint-text">
                  Current admins: {existingAdmins.map(u => u.name || u.email).join(', ')}
                </p>
              )}
            </div>
            <div className="company-modal-footer">
              <button className="company-btn-ghost" onClick={() => setAdminModalCompany(null)} disabled={assigningAdmin}>Cancel</button>
              <button
                className="company-btn-primary"
                onClick={createCompanyAdmin}
                disabled={
                  assigningAdmin ||
                  !String(adminForm.name || '').trim() ||
                  !String(adminForm.email || '').trim() ||
                  !adminForm.password ||
                  !adminForm.confirmPassword
                }
              >
                {assigningAdmin ? 'Saving…' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interns Modal */}
      {selectedCompany && (
        <div className="modal-overlay" onClick={() => setSelectedCompany(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedCompany} — Interns</h2>
              <button className="modal-close" onClick={() => setSelectedCompany(null)}>✕</button>
            </div>
            <div className="modal-body">
              {users.filter(u => {
                const userRole = u.role || 'user';
                const userCompany = String(u.company || 'Unassigned').trim();
                return userRole === 'user' && userCompany === selectedCompany;
              }).length === 0 ? (
                <p className="empty-msg">No interns assigned to this company yet.</p>
              ) : (
                <table className="interns-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Total Hours</th>
                      <th>Year Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => {
                        const userRole = u.role || 'user';
                        const userCompany = String(u.company || 'Unassigned').trim();
                        return userRole === 'user' && userCompany === selectedCompany;
                      })
                      .map(u => (
                        <tr key={u.id}>
                          <td><strong>{u.name || 'N/A'}</strong></td>
                          <td>{u.email || '—'}</td>
                          <td>{u.totalHours ?? u.total_hours ?? 0} hrs</td>
                          <td>{u.yearLevel ?? u.year_level ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
