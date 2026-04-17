import { supabase } from '../supabaseConfig';

/**
 * Create test notifications for debugging
 */
export async function createTestNotifications() {
  try {
    console.log('[testNotifications] Creating test notifications...');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[testNotifications] No authenticated user');
      return;
    }

    // Get all users to find admins
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, name, email')
      .in('role', ['admin', 'super_admin']);

    if (usersError) {
      console.error('[testNotifications] Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('[testNotifications] No admin users found');
      return;
    }

    console.log('[testNotifications] Found admin users:', users.length);

    // Create test notifications
    const testNotifications = [
      {
        id: crypto.randomUUID(),
        sender_id: user.id,
        sender_role: 'user',
        target_company: 'Test Company',
        target_role: 'admin',
        title: 'Student Clocked In',
        message: 'Test Student clocked in at 9:00 AM on 2024-04-13',
        is_global: false,
        notification_type: 'clock_in',
        related_log_date: '2024-04-13',
      },
      {
        id: crypto.randomUUID(),
        sender_id: user.id,
        sender_role: 'user',
        target_company: 'Test Company',
        target_role: 'admin',
        title: 'Student Clocked Out',
        message: 'Test Student clocked out at 5:00 PM on 2024-04-13 (8.0h logged)',
        is_global: false,
        notification_type: 'clock_out',
        related_log_date: '2024-04-13',
      },
      {
        id: crypto.randomUUID(),
        sender_id: user.id,
        sender_role: 'admin',
        target_company: 'Test Company',
        target_role: 'super_admin',
        title: 'Time Log Approved',
        message: 'Admin approved Test Student\'s time log for 2024-04-13 (8.0h) as PRESENT',
        is_global: false,
        notification_type: 'approval',
        related_log_date: '2024-04-13',
      }
    ];

    // Insert notifications
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(testNotifications);

    if (notifError) {
      console.error('[testNotifications] Error creating notifications:', notifError);
      return;
    }

    console.log('[testNotifications] Test notifications created successfully');

    // Create notification logs for each admin
    for (const notification of testNotifications) {
      const recipientIds = users.map(u => u.id);
      
      const { error: logsError } = await supabase.rpc('create_notification_logs', {
        _notification_id: notification.id,
        _recipient_ids: recipientIds,
        _default_status: 'sent',
      });

      if (logsError) {
        console.warn('[testNotifications] Failed to create logs for:', notification.id, logsError);
      } else {
        console.log('[testNotifications] Created logs for:', notification.title);
      }
    }

    console.log('[testNotifications] ✅ All test notifications created!');
    return testNotifications.length;
  } catch (error) {
    console.error('[testNotifications] ❌ Error:', error);
  }
}