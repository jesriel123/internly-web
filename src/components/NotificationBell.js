import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './NotificationBell.css';

const PH_TIMEZONE = 'Asia/Manila';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      // Get notification logs for current user
      const { data: logs, error } = await supabase
        .from('notification_logs')
        .select(`
          id,
          status,
          attempted_at,
          read_at,
          notification:notification_id (
            id,
            title,
            message,
            notification_type,
            created_at,
            sender:sender_id (
              name,
              email
            )
          )
        `)
        .eq('recipient_id', user.uid)
        .order('attempted_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const notifs = (logs || []).map(log => ({
        id: log.id,
        notificationId: log.notification?.id,
        title: log.notification?.title || 'Notification',
        message: log.notification?.message || '',
        type: log.notification?.notification_type || 'manual',
        senderName: log.notification?.sender?.name || 'System',
        createdAt: log.notification?.created_at || log.attempted_at,
        isRead: log.status === 'read',
        readAt: log.read_at,
      }));

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchNotifications();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('notification-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification_logs',
            filter: `recipient_id=eq.${user.uid}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.uid, fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowPanel(false);
      }
    }

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPanel]);

  const markAsRead = async (notificationLogId) => {
    try {
      const { error } = await supabase
        .from('notification_logs')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', notificationLogId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationLogId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notification_logs')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setShowPanel(false);
    setSelectedNotification(notification);
  };

  const closeNotificationDetails = () => {
    setSelectedNotification(null);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'clock_in':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        );
      case 'clock_out':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5" />
            <path d="M12 12l-3 2" />
          </svg>
        );
      case 'approval':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l2.5 2.5L16 9" />
          </svg>
        );
      case 'rejected':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6" />
            <path d="M15 9l-6 6" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r="0.5" />
          </svg>
        );
    }
  };

  const getNotificationIconClass = (type) => {
    switch (type) {
      case 'clock_in':
        return 'icon-clock-in';
      case 'clock_out':
        return 'icon-clock-out';
      case 'approval':
        return 'icon-approval';
      case 'rejected':
        return 'icon-rejected';
      default:
        return 'icon-default';
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return `${Math.floor(seconds / 604800)}w`;
  };

  const formatPHClockStamp = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const time = date.toLocaleTimeString('en-US', {
      timeZone: PH_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const dateOnly = new Intl.DateTimeFormat('en-CA', {
      timeZone: PH_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    return { time, dateOnly };
  };

  const formatNotificationMessage = (notif) => {
    if (!(notif.type === 'clock_in' || notif.type === 'clock_out')) {
      return notif.message;
    }

    const stamp = formatPHClockStamp(notif.createdAt);
    if (!stamp) {
      return notif.message;
    }

    const actorFromMessage = String(notif.message || '').split(/\s+clocked\s+/i)[0]?.trim();
    const actor = actorFromMessage || notif.senderName || 'Student';

    if (notif.type === 'clock_in') {
      return `${actor} clocked in at ${stamp.time} on ${stamp.dateOnly}`;
    }

    const loggedSuffix = String(notif.message || '').match(/\([^)]*logged\)/i)?.[0] || '';
    return `${actor} clocked out at ${stamp.time} on ${stamp.dateOnly}${loggedSuffix ? ` ${loggedSuffix}` : ''}`;
  };

  const formatDetailedTimestamp = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('en-US', {
      timeZone: PH_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const visibleNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="notification-bell-container" ref={panelRef}>
      <button
        className="notification-bell-button"
        onClick={() => setShowPanel(!showPanel)}
        aria-label="Notifications"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {showPanel && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div>
              <h3>Notifications</h3>
              <div className="notification-tabs">
                <button
                  className={activeTab === 'all' ? 'tab-active' : ''}
                  onClick={() => setActiveTab('all')}
                  type="button"
                  aria-pressed={activeTab === 'all'}
                >
                  All
                </button>
                <button
                  className={activeTab === 'unread' ? 'tab-active' : ''}
                  onClick={() => setActiveTab('unread')}
                  type="button"
                  aria-pressed={activeTab === 'unread'}
                >
                  Unread
                </button>
              </div>
            </div>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>{activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
              </div>
            ) : (
              visibleNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className={`notification-icon ${getNotificationIconClass(notif.type)}`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notif.title}</div>
                    <div className="notification-message">{formatNotificationMessage(notif)}</div>
                    <div className="notification-time">{getTimeAgo(notif.createdAt)}</div>
                  </div>
                  {!notif.isRead && <div className="notification-dot"></div>}
                </div>
              ))
            )}
          </div>

          <div className="notification-panel-footer">
            <button onClick={() => { setShowPanel(false); navigate('/notifications'); }}>
              See all notifications
            </button>
          </div>
        </div>
      )}

      {selectedNotification && createPortal(
        <div className="notification-details-overlay" onClick={closeNotificationDetails}>
          <div className="notification-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="notification-details-header">
              <div className={`notification-icon-large ${getNotificationIconClass(selectedNotification.type)}`}>
                {getNotificationIcon(selectedNotification.type)}
              </div>
              <div className="notification-header-text">
                <h4>{selectedNotification.title || 'Notification'}</h4>
                <span className="notification-date">{formatDetailedTimestamp(selectedNotification.createdAt)}</span>
              </div>
            </div>

            <div className="notification-details-body">
              <p className="notification-message-large">{formatNotificationMessage(selectedNotification)}</p>
            </div>

            <div className="notification-details-footer">
              <button type="button" className="btn-close" onClick={closeNotificationDetails}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
