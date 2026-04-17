import { supabase } from '../supabaseConfig';

/**
 * Create a notification for admins/super_admins
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Type: 'clock_in', 'clock_out', 'approval', 'rejection'
 * @param {string} params.userId - User ID who triggered the action
 * @param {string} params.userName - User name
 * @param {string} params.userCompany - User company
 * @param {string} params.logDate - Log date (YYYY-MM-DD)
 * @param {string} params.logId - Time log ID
 */
export async function createAdminNotification({
  title,
  message,
  type,
  userId,
  userName,
  userCompany,
  logDate,
  logId,
}) {
  try {
    // Generate notification ID
    const notificationId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    // Get all admins and super_admins for the company
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, role, company')
      .in('role', ['admin', 'super_admin']);

    if (adminError) throw adminError;

    // Filter recipients based on notification type
    let recipients = [];
    
    if (type === 'clock_in' || type === 'clock_out') {
      // Clock in/out notifications go to admins of same company + all super_admins
      recipients = adminUsers.filter(
        u => u.role === 'super_admin' || (u.role === 'admin' && u.company === userCompany)
      );
    } else if (type === 'approval' || type === 'rejection') {
      // Approval/rejection notifications go to super_admins only
      recipients = adminUsers.filter(u => u.role === 'super_admin');
    }

    if (recipients.length === 0) {
      console.log('[notificationHelper] No recipients found for notification');
      return;
    }

    // Create notification record
    const notificationPayload = {
      id: notificationId,
      sender_id: userId,
      sender_role: 'user',
      target_company: userCompany,
      target_role: type === 'approval' || type === 'rejection' ? 'super_admin' : 'admin',
      title,
      message,
      is_global: false,
      notification_type: type,
      related_log_id: logId,
      related_log_date: logDate,
    };

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationPayload);

    if (notifError) throw notifError;

    // Create notification logs for each recipient
    const recipientIds = recipients.map(u => u.id).filter(Boolean);

    const { error: logsError } = await supabase.rpc('create_notification_logs', {
      _notification_id: notificationId,
      _recipient_ids: recipientIds,
      _default_status: 'sent',
    });

    if (logsError) {
      console.warn('[notificationHelper] Failed to create notification logs:', logsError);
    }

    console.log(`[notificationHelper] Created ${type} notification for ${recipients.length} recipients`);
  } catch (error) {
    console.error('[notificationHelper] Error creating notification:', error);
  }
}

/**
 * Create notification when admin approves/rejects a time log
 * @param {Object} params
 * @param {string} params.adminId - Admin user ID
 * @param {string} params.adminName - Admin name
 * @param {string} params.adminRole - Admin role
 * @param {string} params.action - 'approved' or 'rejected'
 * @param {string} params.studentId - Student user ID
 * @param {string} params.studentName - Student name
 * @param {string} params.studentCompany - Student company
 * @param {string} params.logDate - Log date
 * @param {string} params.logId - Time log ID
 * @param {string} params.hours - Hours logged
 * @param {string} params.logType - Log type (present, overtime, etc.)
 */
export async function createApprovalNotification({
  adminId,
  adminName,
  adminRole,
  action,
  studentId,
  studentName,
  studentCompany,
  logDate,
  logId,
  hours,
  logType,
}) {
  try {
    const actionText = action === 'approved' ? 'approved' : 'rejected';
    const notificationType = action === 'approved' ? 'approval' : 'rejected';
    const title = `Time Log ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`;
    const typeLabel = logType ? ` as ${logType.toUpperCase()}` : '';
    const message = `${adminName} ${actionText} ${studentName}'s time log for ${logDate} (${hours}h)${typeLabel}`;

    // Generate notification ID
    const notificationId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    // Get all super_admins
    const { data: superAdmins, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'super_admin');

    if (adminError) throw adminError;

    const superAdminIds = (superAdmins || []).map(u => u.id).filter(Boolean);

    // Recipients include all super_admins plus the affected student (if provided)
    const recipientIds = [...superAdminIds];
    if (studentId) {
      recipientIds.push(studentId);
    }

    if (recipientIds.length === 0) {
      console.log('[notificationHelper] No recipients found for approval notification');
      return;
    }

    // Create notification record
    const notificationPayload = {
      id: notificationId,
      sender_id: adminId,
      sender_role: adminRole,
      target_company: studentCompany,
      target_role: 'super_admin',
      title,
      message,
      is_global: false,
      notification_type: notificationType,
      related_log_id: logId,
      related_log_date: logDate,
    };

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationPayload);

    if (notifError) throw notifError;

    const { error: logsError } = await supabase.rpc('create_notification_logs', {
      _notification_id: notificationId,
      _recipient_ids: recipientIds,
      _default_status: 'sent',
    });

    if (logsError) {
      console.warn('[notificationHelper] Failed to create notification logs:', logsError);
    }

    console.log(`[notificationHelper] Created approval notification for ${recipientIds.length} recipients`);
  } catch (error) {
    console.error('[notificationHelper] Error creating approval notification:', error);
  }
}
