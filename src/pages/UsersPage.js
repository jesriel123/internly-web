import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { logButtonClick, logRequestStart, logRequestSuccess, logRequestFailure } from '../utils/debugLogger';
import { writeAuditLog } from '../utils/auditLogger';
import './UsersPage.css';

const EMPTY_FORM = { name: '', studentId: '', program: '', yearLevel: '', section: '', company: '', companyAddress: '', supervisor: '', startDate: '' };

function normalizeUserForUI(u) {
  const requiredHours = Number(
    u?.required_hours ?? u?.requiredHours ?? u?.setup?.requiredHours ?? u?.setup?.required_hours ?? 486
  );
  const dailyMaxHours = Number(
    u?.daily_max_hours ?? u?.dailyMaxHours ?? u?.setup?.dailyMaxHours ?? u?.setup?.daily_max_hours ?? 8
  );
  const normalizedRequiredHours = Number.isFinite(requiredHours) && requiredHours >= 100 ? requiredHours : 486;
  const normalizedDailyMaxHours = Number.isFinite(dailyMaxHours) && dailyMaxHours > 0 ? dailyMaxHours : 8;

  return {
    ...u,
    studentId: u?.studentId ?? u?.student_id ?? '',
    yearLevel: u?.yearLevel ?? u?.year_level ?? '',
    companyAddress: u?.companyAddress ?? u?.company_address ?? '',
    startDate: u?.startDate ?? u?.start_date ?? '',
    endDate: u?.endDate ?? u?.end_date ?? '',
    setup: {
      requiredHours: normalizedRequiredHours,
      dailyMaxHours: normalizedDailyMaxHours,
    },
  };
}

function computeEndDate(startDateStr, requiredHours, dailyMaxHours) {
  if (!startDateStr) return '';
  const workdaysNeeded = Math.ceil(requiredHours / dailyMaxHours);
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return '';
  let count = 0;
  while (count < workdaysNeeded) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isStaffRole(role) {
  return role === 'admin' || role === 'super_admin';
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [setupDrafts, setSetupDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const presetIntentRef = useRef({});

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const start = logRequestStart('FETCH_ALL_USERS');
    setLoading(true);
    try {
      const [{ data: usersData, error: usersError }, { data: companiesData, error: companiesError }] = await Promise.all([
        supabase.from('users').select('*').limit(200),
        supabase.from('companies').select('name,address').limit(200),
      ]);
      if (usersError) throw usersError;
      if (companiesError) throw companiesError;

      setUsers((usersData || []).map(normalizeUserForUI));
      setCompanies((companiesData || []).map(c => ({
        name: String(c?.name || '').trim(),
        address: String(c?.address || '').trim(),
      })).filter(c => c.name));
      setSetupDrafts({});
      logRequestSuccess('FETCH_ALL_USERS', start);
    } catch (err) {
      logRequestFailure('FETCH_ALL_USERS', start, err);
    } finally { setLoading(false); }
  };

  const changeRole = async (uid, newRole) => {
    logButtonClick(`CHANGE_ROLE_${newRole}_${uid}`);
    const start = logRequestStart('UPDATE_ROLE');
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', uid);
      if (error) throw error;
      logRequestSuccess('UPDATE_ROLE', start);
      const target = users.find(u => u.id === uid);
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
      await writeAuditLog(me, 'CHANGE_ROLE', `Changed role of ${target?.name || target?.email || uid} to ${newRole}`);
    } catch (err) {
      logRequestFailure('UPDATE_ROLE', start, err);
      alert('Failed to update role: ' + err.message);
    }
  };

  const removeUser = async (uid) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    logButtonClick(`DELETE_USER_${uid}`);
    const start = logRequestStart('DELETE_USER');
    try {
      const target = users.find(u => u.id === uid);
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', uid);
      if (error) throw error;
      logRequestSuccess('DELETE_USER', start);
      setUsers(prev => prev.filter(u => u.id !== uid));
      await writeAuditLog(me, 'DELETE_USER', `Deleted user ${target?.name || target?.email || uid}`);
    } catch (err) {
      logRequestFailure('DELETE_USER', start, err);
      alert('Failed to delete: ' + err.message);
    }
  };

  const openEdit = (u) => {
    setEditForm({
      name: u.name || '',
      studentId: u.studentId || u.student_id || '',
      program: u.program || '',
      yearLevel: u.yearLevel || u.year_level || '',
      section: u.section || '',
      company: u.company || '',
      companyAddress: u.companyAddress || u.company_address || '',
      supervisor: u.supervisor || '',
      startDate: u.startDate || u.start_date || ''
    });
    setEditingUser(u);
  };

  const saveEdit = async () => {
    if (!editingUser || !editForm.name.trim()) return alert('Name is required');
    const selectedCompany = companies.find(c => c.name === editForm.company);
    if (!selectedCompany) return alert('Please select a valid company.');

    setSaving(true);
    try {
      const editingStaff = isStaffRole(editingUser.role || 'user');
      const updatePayload = {
        name: editForm.name.trim(),
        company: selectedCompany.name,
        company_address: editForm.companyAddress.trim(),
      };

      if (!editingStaff) {
        const requiredHours = editingUser.setup?.requiredHours || 486;
        const dailyMaxHours = editingUser.setup?.dailyMaxHours || 8;
        const endDate = computeEndDate(editForm.startDate.trim(), requiredHours, dailyMaxHours);

        Object.assign(updatePayload, {
          student_id: editForm.studentId.trim(),
          program: editForm.program.trim(),
          year_level: editForm.yearLevel.trim(),
          section: editForm.section.trim(),
          supervisor: editForm.supervisor.trim(),
          start_date: editForm.startDate.trim(),
          end_date: endDate || null,
        });
      }

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', editingUser.id);
      if (error) throw error;
      setUsers(prev => prev.map(u => (
        u.id === editingUser.id
          ? normalizeUserForUI({ ...u, ...updatePayload })
          : u
      )));
      await writeAuditLog(me, 'EDIT_USER', `Updated profile of ${editForm.name.trim()} (${editingUser.email})`);
      setEditingUser(null);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const setSetupDraft = (uid, field, value) => {
    setSetupDrafts(prev => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [field]: value,
      },
    }));
  };

  const clearSetupDraftField = (uid, field) => {
    setSetupDrafts(prev => {
      const rowDraft = { ...(prev[uid] || {}) };
      delete rowDraft[field];
      const next = { ...prev };
      if (Object.keys(rowDraft).length === 0) {
        delete next[uid];
      } else {
        next[uid] = rowDraft;
      }
      return next;
    });
  };

  const handleSetupInputChange = (uid, field, rawValue) => {
    const numericOnly = String(rawValue).replace(/\D/g, '').slice(0, 4);
    setSetupDraft(uid, field, numericOnly);
  };

  const setupKey = (uid, field) => `${uid}:${field}`;

  const markPresetIntent = (uid, field) => {
    presetIntentRef.current[setupKey(uid, field)] = true;
  };

  const clearPresetIntent = (uid, field) => {
    delete presetIntentRef.current[setupKey(uid, field)];
  };

  const consumePresetIntent = (uid, field) => {
    const key = setupKey(uid, field);
    const hasIntent = Boolean(presetIntentRef.current[key]);
    if (hasIntent) delete presetIntentRef.current[key];
    return hasIntent;
  };

  const applySetupPreset = (uid, field, presetValue) => {
    const value = String(presetValue || '');
    if (!value) return;
    clearPresetIntent(uid, field);
    setSetupDraft(uid, field, value);
    updateSetup(uid, field, value);
  };

  const updateSetup = async (uid, field, rawValue) => {
    try {
      const user = users.find(u => u.id === uid);
      if (!user) return;

      if (String(rawValue).trim() === '') {
        clearSetupDraftField(uid, field);
        return;
      }

      const currentRequiredHours = Number(user?.required_hours ?? user?.setup?.requiredHours ?? 486);
      const currentDailyMaxHours = Number(user?.daily_max_hours ?? user?.setup?.dailyMaxHours ?? 8);
      const safeCurrentRequiredHours = Number.isFinite(currentRequiredHours) && currentRequiredHours >= 100 ? currentRequiredHours : 486;
      const safeCurrentDailyMaxHours = Number.isFinite(currentDailyMaxHours) && currentDailyMaxHours > 0 ? currentDailyMaxHours : 8;
      const parsedValue = Number(rawValue);

      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        alert('Please enter a valid hours value.');
        clearSetupDraftField(uid, field);
        return;
      }

      if (field === 'requiredHours' && parsedValue < 100) {
        alert('Required hours must be at least 100.');
        clearSetupDraftField(uid, field);
        return;
      }

      const currentValue = field === 'requiredHours' ? safeCurrentRequiredHours : safeCurrentDailyMaxHours;
      if (parsedValue === currentValue) {
        clearSetupDraftField(uid, field);
        return;
      }

      const currentSetup = {
        requiredHours: safeCurrentRequiredHours,
        dailyMaxHours: safeCurrentDailyMaxHours,
      };
      const newSetup = { ...currentSetup, [field]: parsedValue };
      const startDate = user?.startDate || user?.start_date || '';
      const endDate = computeEndDate(startDate, newSetup.requiredHours, newSetup.dailyMaxHours);

      const updatePayload = {
        required_hours: newSetup.requiredHours,
        daily_max_hours: newSetup.dailyMaxHours,
        ...(endDate ? { end_date: endDate } : {}),
      };

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', uid);
      if (error) throw error;
      setUsers(prev => prev.map(u => (
        u.id === uid
          ? normalizeUserForUI({
              ...u,
              ...updatePayload,
              setup: {
                ...(u.setup || {}),
                requiredHours: newSetup.requiredHours,
                dailyMaxHours: newSetup.dailyMaxHours,
              },
            })
          : u
      )));
      clearSetupDraftField(uid, field);
    } catch (err) {
      alert('Failed to update setup: ' + err.message);
    }
  };

  const filtered = users
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => {
      const q = search.toLowerCase();
      return !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  const handleCompanySelection = (companyName) => {
    const selectedCompany = companies.find(c => c.name === companyName);
    setEditForm(prev => ({
      ...prev,
      company: companyName,
      companyAddress: selectedCompany?.address || '',
    }));
  };

  return (
    <div className="users-page">
      <div className="page-head">
        <div>
          <h1>Manage Users</h1>
          <p>{users.length} total accounts</p>
        </div>
        <button className="btn-primary" onClick={() => { logButtonClick('REFRESH_USERS'); fetchUsers(); }} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div className="toolbar">
        <input className="search-input" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-chips">
          {['all', 'user', 'admin', 'super_admin'].map(r => (
            <button
              key={r}
              className={`chip ${filter === r ? 'active' : ''}`}
              onClick={() => { logButtonClick(`FILTER_${r.toUpperCase()}`); setFilter(r); }}
            >
              {r === 'all' ? 'All' : r === 'super_admin' ? 'Super Admin' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Required Hrs</th><th>Daily Max</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td className="td-name">{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{u.company || '—'}</td>
                <td><span className={`badge role-${u.role || 'user'}`}>{u.role || 'user'}</span></td>
                <td>
                  {(u.role === 'user' || !u.role) ? (
                    <div className="setup-field">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={setupDrafts[u.id]?.requiredHours ?? String(u.setup?.requiredHours || 486)}
                        onChange={e => handleSetupInputChange(u.id, 'requiredHours', e.target.value)}
                        onBlur={e => {
                          if (consumePresetIntent(u.id, 'requiredHours')) return;
                          updateSetup(u.id, 'requiredHours', e.target.value);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="setup-input"
                      />
                      <select
                        className="setup-preset"
                        defaultValue=""
                        onMouseDown={() => markPresetIntent(u.id, 'requiredHours')}
                        onChange={e => {
                          applySetupPreset(u.id, 'requiredHours', e.target.value);
                          e.target.value = '';
                        }}
                      >
                        <option value="">▼</option>
                        <option value="486">486</option>
                        <option value="600">600</option>
                      </select>
                    </div>
                  ) : '—'}
                </td>
                <td>
                  {(u.role === 'user' || !u.role) ? (
                    <div className="setup-field">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={setupDrafts[u.id]?.dailyMaxHours ?? String(u.setup?.dailyMaxHours || 8)}
                        onChange={e => handleSetupInputChange(u.id, 'dailyMaxHours', e.target.value)}
                        onBlur={e => {
                          if (consumePresetIntent(u.id, 'dailyMaxHours')) return;
                          updateSetup(u.id, 'dailyMaxHours', e.target.value);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="setup-input"
                      />
                      <select
                        className="setup-preset"
                        defaultValue=""
                        onMouseDown={() => markPresetIntent(u.id, 'dailyMaxHours')}
                        onChange={e => {
                          applySetupPreset(u.id, 'dailyMaxHours', e.target.value);
                          e.target.value = '';
                        }}
                      >
                        <option value="">▼</option>
                        <option value="8">8</option>
                        <option value="9">9</option>
                      </select>
                    </div>
                  ) : '—'}
                </td>
                <td className="td-actions">
                  <button className="action-btn edit" onClick={() => openEdit(u)}>Edit</button>
                  {me?.role === 'super_admin' && u.id !== me.uid && (
                    <>
                      {u.role !== 'admin' && (
                        <button className="action-btn warn" onClick={() => changeRole(u.id, 'admin')}>Make Admin</button>
                      )}
                      {u.role !== 'user' && (
                        <button className="action-btn info" onClick={() => changeRole(u.id, 'user')}>Set User</button>
                      )}
                      <button className="action-btn danger" onClick={() => removeUser(u.id)}>Delete</button>
                    </>
                  )}
                  {me?.role === 'admin' && <span className="muted">View only</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>No users match your filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditingUser(null)}
                aria-label="Close dialog"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-email">{editingUser.email}</p>

              {isStaffRole(editingUser.role || 'user') ? (
                <>
                  <p className="modal-section-label">ACCOUNT</p>
                  <div className="modal-field">
                    <label>Full Name *</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Juan dela Cruz" />
                  </div>

                  <p className="modal-section-label">COMPANY ASSIGNMENT</p>
                  <div className="modal-field">
                    <label>Company Name</label>
                    <select
                      value={editForm.company}
                      onChange={e => handleCompanySelection(e.target.value)}
                      disabled={companies.length === 0}
                    >
                      <option value="">{companies.length === 0 ? 'No companies available' : 'Select company'}</option>
                      {companies.map((company) => (
                        <option key={company.name} value={company.name}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label>Company Address</label>
                    <input value={editForm.companyAddress} onChange={e => setEditForm(f => ({...f, companyAddress: e.target.value}))} placeholder="Full address" />
                  </div>
                  <p className="modal-helper">Admin and Super Admin accounts do not need student academic or OJT intern fields.</p>
                </>
              ) : (
                <>
                  <p className="modal-section-label">PERSONAL</p>
                  <div className="modal-field">
                    <label>Full Name *</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Juan dela Cruz" />
                  </div>
                  <div className="modal-field">
                    <label>Student ID</label>
                    <input value={editForm.studentId} onChange={e => setEditForm(f => ({...f, studentId: e.target.value}))} placeholder="e.g. 20-12345" />
                  </div>

                  <p className="modal-section-label">ACADEMIC</p>
                  <div className="modal-row">
                    <div className="modal-field">
                      <label>Program</label>
                      <input value={editForm.program} onChange={e => setEditForm(f => ({...f, program: e.target.value}))} placeholder="e.g. BSIT" />
                    </div>
                    <div className="modal-field">
                      <label>Year Level</label>
                      <input value={editForm.yearLevel} onChange={e => setEditForm(f => ({...f, yearLevel: e.target.value}))} placeholder="e.g. 4th" />
                    </div>
                    <div className="modal-field">
                      <label>Section</label>
                      <input value={editForm.section} onChange={e => setEditForm(f => ({...f, section: e.target.value}))} placeholder="e.g. 4A" />
                    </div>
                  </div>

                  <p className="modal-section-label">OJT INFO</p>
                  <div className="modal-field">
                    <label>Company Name</label>
                    <select
                      value={editForm.company}
                      onChange={e => handleCompanySelection(e.target.value)}
                      disabled={companies.length === 0}
                    >
                      <option value="">{companies.length === 0 ? 'No companies available' : 'Select company'}</option>
                      {companies.map((company) => (
                        <option key={company.name} value={company.name}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label>Company Address</label>
                    <input value={editForm.companyAddress} onChange={e => setEditForm(f => ({...f, companyAddress: e.target.value}))} placeholder="Full address" />
                  </div>
                  <div className="modal-row">
                    <div className="modal-field">
                      <label>Supervisor</label>
                      <input value={editForm.supervisor} onChange={e => setEditForm(f => ({...f, supervisor: e.target.value}))} placeholder="Supervisor name" />
                    </div>
                    <div className="modal-field">
                      <label>Start Date</label>
                      <input value={editForm.startDate} onChange={e => setEditForm(f => ({...f, startDate: e.target.value}))} placeholder="MM/DD/YYYY" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditingUser(null)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
