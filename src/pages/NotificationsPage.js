import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { logButtonClick, logRequestStart, logRequestSuccess, logRequestFailure } from '../utils/debugLogger';
import { writeAuditLog } from '../utils/auditLogger';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const { user: me } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'manual', 'clock_in', 'clock_out', 'approval', 'rejected'
  const [form, setForm] = useState({
    title: '',
    message: '',
    targetScope: me?.role === 'super_admin' ? 'all' : 'my-company',
    targetCompany: me?.company || '',
    targetRole: 'user',
  });

  const fetchData = useCallback(async () => {
    const start = logRequestStart('NOTIF_FETCH');
    setLoading(true);
    try {
      const isSuperAdmin = me?.role === 'super_admin';
      const adminCompany = String(me?.company || '').trim();

      let companiesQuery = supabase.from('companies').select('name').limit(100);
      let usersQuery = supabase.from('users').select('*').limit(200);
      let notificationsQuery = supabase
        .from('notifications')
        .select('*, sender:sender_id(name, email, company)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isSuperAdmin) {
        if (!adminCompany) {
          setCompanies([]);
          setUsers([]);
          setNotifications([]);
          setLoading(false);
          return;
        }
        companiesQuery = companiesQuery.eq('name', adminCompany);
        usersQuery = usersQuery.eq('company', adminCompany);
        notificationsQuery = notificationsQuery.or(`target_company.eq.${adminCompany},is_global.eq.true,sender_id.eq.${me.uid}`);
      }

      const [{ data: companyList }, { data: userList }, { data: notifList }] = await Promise.all([
        companiesQuery,
        usersQuery,
        notificationsQuery,
      ]);

      setCompanies(companyList || []);
      setUsers(userList || []);
      setNotifications(notifList || []);
      logRequestSuccess('NOTIF_FETCH', start);
    } catch (err) {
      logRequestFailure('NOTIF_FETCH', start, err);
    } finally {
      setLoading(false);
    }
  }, [me?.role, me?.company, me?.uid]);

  useEffect(() => {
    if (!me?.role) return;
    fetchData();
    setForm(prev => ({
      ...prev,
      targetScope: me?.role === 'super_admin' ? 'all' : 'my-company',
      targetCompany: me?.company || '',
    }));
  }, [fetchData, me?.role, me?.company]);

  const getTargetUsers = () => {
    let targets = users;

    // Filter by role: super_admin sees all, admin shows only users (not admins)
    if (me?.role === 'admin') {
      targets = targets.filter(u => (u.role || 'user') === 'user');
    }

    // Filter by company scope
    if (form.targetScope === 'my-company') {
      targets = targets.filter(u => u.company === me?.company);
    } else if (form.targetScope === 'specific-company') {
      targets = targets.filter(u => u.company === form.targetCompany);
    }

    // Filter by role if specified
    if (form.targetRole && form.targetRole !== 'all') {
      targets = targets.filter(u => (u.role || 'user') === form.targetRole);
    }

    return targets;
  };

  const sendNotification = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      alert('Title and message are required');
      return;
    }

    const targetUsers = getTargetUsers();
    if (targetUsers.length === 0) {
      alert('No users match the target criteria');
      return;
    }

    logButtonClick(`SEND_NOTIFICATION_${me?.role}`);
    setSending(true);
    const start = logRequestStart('SEND_NOTIFICATION');

    try {
      const notificationId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

      const notificationPayload = {
        id: notificationId,
        sender_id: me.uid,
        sender_role: me.role,
        target_company: form.targetScope === 'my-company' ? me?.company : form.targetCompany || null,
        target_role: form.targetRole && form.targetRole !== 'all' ? form.targetRole : null,
        title: form.title.trim(),
        message: form.message.trim(),
        is_global: form.targetScope === 'all',
        notification_type: 'manual',
      };

      // Insert notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationPayload);

      if (notifError) throw notifError;

      // Insert notification logs for each target user
      const recipientIds = targetUsers
        .map(user => user.id)
        .filter(Boolean);

      const { error: logsError } = await supabase.rpc('create_notification_logs', {
        _notification_id: notificationId,
        _recipient_ids: recipientIds,
        _default_status: 'sent',
      });

      if (logsError) throw logsError;

      // Trigger Supabase Edge Function to send push notifications
      try {
        const fnResponse = await supabase.functions.invoke('send-notification', {
          body: { notification_id: notificationId },
        });
        console.log('[NotificationsPage] Edge Function response:', fnResponse);
      } catch (fnError) {
        console.warn('[NotificationsPage] Edge Function call failed (non-blocking):', fnError);
      }

      logRequestSuccess('SEND_NOTIFICATION', start);
      await writeAuditLog(
        me,
        'SEND_NOTIFICATION',
        `Sent notification "${form.title}" to ${targetUsers.length} user(s)`
      );

      // Reset form
      setForm({
        title: '',
        message: '',
        targetScope: me?.role === 'super_admin' ? 'all' : 'my-company',
        targetCompany: me?.company || '',
        targetRole: 'user',
      });

      alert(`Notification sent to ${targetUsers.length} user(s)`);
      fetchData();
    } catch (err) {
      logRequestFailure('SEND_NOTIFICATION', start, err);
      alert('Failed to send notification: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const targetUsers = getTargetUsers();
  const companyOptions = companies.map(c => c.name).filter(Boolean);
  const scopeLabel =
    form.targetScope === 'all'
      ? 'Global audience'
      : form.targetScope === 'specific-company'
      ? form.targetCompany
        ? `Company: ${form.targetCompany}`
        : 'Specific company'
      : `My company: ${me?.company || 'Not set'}`;
  const roleLabel =
    form.targetRole === 'all' ? 'All roles' : form.targetRole === 'admin' ? 'Admins only' : 'Interns only';

  return (
    <div className="notifications-page">
      <div className="page-head">
        <div>
          <h1>Send Notifications</h1>
          <p>Send messages to interns and staff</p>
        </div>
        <div className="notifications-actions">
          <button className="btn-primary notif-refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Send Form */}
      <div className="form-card">
        <div className="compose-head">
          <div className="compose-title-block">
            <h3>Compose Message</h3>
            <p>Write a clear update and choose exactly who should receive it.</p>
          </div>
          <div className="compose-meta" aria-live="polite">
            <span className="meta-pill recipients-pill">{targetUsers.length} recipients</span>
            <span className="meta-pill">{scopeLabel}</span>
            <span className="meta-pill">{roleLabel}</span>
          </div>
        </div>
        <form onSubmit={sendNotification}>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Shift Change Notice"
                maxLength="100"
              />
              <small className={`char-counter ${form.title.length > 80 ? 'near-limit' : ''}`}>{form.title.length}/100</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Write your message here..."
                rows={4}
                maxLength="500"
              />
              <small className={`char-counter ${form.message.length > 420 ? 'near-limit' : ''}`}>{form.message.length}/500</small>
            </div>
          </div>

          {/* Targeting Options */}
          <div className="form-section">
            <h4>Target Recipients</h4>

            <div className="form-row-grid">
              {me?.role === 'super_admin' && (
                <div className="form-group">
                  <label>Scope *</label>
                  <select
                    value={form.targetScope}
                    onChange={e => setForm(f => ({ ...f, targetScope: e.target.value }))}
                  >
                    <option value="all">All Users (Global)</option>
                    <option value="specific-company">Specific Company/Department</option>
                  </select>
                </div>
              )}

              {form.targetScope === 'specific-company' && (
                <div className="form-group">
                  <label>Select Company/Department *</label>
                  <select
                    value={form.targetCompany}
                    onChange={e => setForm(f => ({ ...f, targetCompany: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {companyOptions.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {me?.role !== 'admin' && (
                <div className="form-group">
                  <label>Target Role *</label>
                  <select
                    value={form.targetRole}
                    onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                  >
                    <option value="user">Interns Only</option>
                    <option value="admin">Admins Only</option>
                    <option value="all">All Roles</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary btn-send" disabled={sending || targetUsers.length === 0}>
              {sending ? 'Sending…' : `Send Notification (${targetUsers.length} recipients)`}
            </button>
          </div>
        </form>
      </div>

      {/* Notification History */}
      <div className="history-card">
        <div className="history-head">
          <h3>Recent Notifications</h3>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="history-filter-select"
          >
            <option value="all">All Notifications</option>
            <option value="manual">Manual (Admin Sent)</option>
            <option value="clock_in">Clock In</option>
            <option value="clock_out">Clock Out</option>
            <option value="approval">Approvals</option>
            <option value="rejected">Rejections</option>
          </select>
        </div>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Sent By</th>
                <th>Title</th>
                <th>Message</th>
                <th>Scope</th>
                <th>Recipients</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications
                .filter(notif => filterType === 'all' || notif.notification_type === filterType)
                .map(notif => {
                const recipientCount = (notif.notification_logs || []).length;
                const scopeLabel = notif.is_global
                  ? 'Global'
                  : notif.target_company
                  ? `${notif.target_company} ${notif.target_role ? `(${notif.target_role}s)` : ''}`
                  : 'Custom';
                
                const typeLabels = {
                  clock_in: { label: 'Clock In', color: '#10B981', bg: '#D1FAE5' },
                  clock_out: { label: 'Clock Out', color: '#F59E0B', bg: '#FEF3C7' },
                  approval: { label: 'Approved', color: '#7C3AED', bg: '#EDE9FE' },
                  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2' },
                  manual: { label: 'Manual', color: '#3B82F6', bg: '#DBEAFE' },
                };
                const typeInfo = typeLabels[notif.notification_type] || typeLabels.manual;

                return (
                  <tr key={notif.id}>
                    <td>
                      <span className={`notif-type-badge notif-type-${notif.notification_type || 'manual'}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td>{notif.sender?.name || 'System'}</td>
                    <td><strong>{notif.title}</strong></td>
                    <td className="td-message">{notif.message}</td>
                    <td>{scopeLabel}</td>
                    <td>{recipientCount}</td>
                    <td>{new Date(notif.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {notifications.filter(notif => filterType === 'all' || notif.notification_type === filterType).length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="notifications-empty-row">
                    No notifications found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
