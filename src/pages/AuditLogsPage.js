import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import './AuditLogsPage.css';

const ITEMS_PER_PAGE = 15;

export default function AuditLogsPage() {
  const { user: me } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Get total count
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });
      setTotalCount(count || 0);

      // Get paginated logs
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(start, start + ITEMS_PER_PAGE - 1);

      if (error) {
        console.error('Fetch error:', error);
        setLogs([]);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  // Fetch logs on mount and page change
  useEffect(() => {
    if (me?.role !== 'super_admin') return;
    fetchLogs();
  }, [me, fetchLogs]);

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const logTime = (log) => log?.created_at || log?.timestamp;

  if (me?.role !== 'super_admin') {
    return (
      <div className="audit-page">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>Only Super Admins can view audit logs.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const goToPrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const openActionModal = (log) => setSelectedLog(log);
  const closeActionModal = () => setSelectedLog(null);
  const openUserProfile = (userName) => setSelectedUserName(userName);
  const closeUserProfile = () => setSelectedUserName(null);

  return (
    <div className="audit-page">
      <div className="page-head">
        <div>
          <h1>Audit Logs</h1>
          <p>Track all student activity and admin actions in real-time</p>
        </div>
        <div>
          {loading ? (
            <div className="live-status live-blue">
              <span className="live-dot" style={{ animation: 'none' }}></span> Loading...
            </div>
          ) : (
            <div className="live-status live-green">
              <span className="live-dot"></span> Ready
            </div>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Role</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              const displayAction = (l.action || '—')
                  .split('_')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
              
              return (
              <tr key={l.id}>
                <td className="ts-cell">{fmt(logTime(l))}</td>
                <td>
                  <button className="username-link" onClick={() => openUserProfile(l.user_name || l.user_id)}>
                    {l.user_name || l.user_id || '—'}
                  </button>
                </td>
                <td><span className={`badge role-${l.user_role}`}>{l.user_role || '—'}</span></td>
                <td>
                  <button className="action-link" onClick={() => openActionModal(l)}>
                    <span className={`action-label action-${(l.action||'').toLowerCase().split('_')[0]}`}>
                      {displayAction}
                    </span>
                  </button>
                </td>
                <td className="details-cell">{l.details || '—'}</td>
              </tr>
              );
            })}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={5} className="empty-msg">No audit logs recorded yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={5} className="empty-msg">Loading...</td></tr>
            )}
          </tbody>
        </table>

        {/* --- Pagination Controls --- */}
        {!loading && totalCount > 0 && (
          <div className="pagination">
            <span className="page-info">
              Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
            </span>
            <div className="page-controls">
              <button onClick={goToPrev} disabled={currentPage === 1}>Previous</button>
              <span className="page-num">Page {currentPage} of {totalPages}</span>
              <button onClick={goToNext} disabled={currentPage === totalPages}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* === ACTION DETAILS MODAL === */}
      {selectedLog && (
        <div className="modal-overlay" onClick={closeActionModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Action Details</h2>
              <button className="modal-close" onClick={closeActionModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Action:</span>
                <span className="detail-value">
                  {(selectedLog.action || '—')
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">User:</span>
                <span className="detail-value">{selectedLog.user_name || selectedLog.user_id || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Role:</span>
                <span className={`badge role-${selectedLog.user_role}`}>{selectedLog.user_role || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp:</span>
                <span className="detail-value">{fmt(logTime(selectedLog))}</span>
              </div>
              <div className="detail-row full-width">
                <span className="detail-label">Details:</span>
                <span className="detail-value">{selectedLog.details || 'No additional details'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeActionModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* === USER PROFILE MODAL === */}
      {selectedUserName && (
        <div className="modal-overlay" onClick={closeUserProfile}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Profile</h2>
              <button className="modal-close" onClick={closeUserProfile}>✕</button>
            </div>
            <div className="modal-body">
              <div className="profile-avatar">
                {selectedUserName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="detail-row">
                <span className="detail-label">Username:</span>
                <span className="detail-value">{selectedUserName || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Recent Activity:</span>
                <span className="detail-value">
                  {logs.filter(l => l.user_name === selectedUserName || l.user_id === selectedUserName).length} actions logged
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Action:</span>
                <span className="detail-value">
                  {fmt(logTime(logs.find(l => l.user_name === selectedUserName || l.user_id === selectedUserName)))}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeUserProfile}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
