import { supabase } from '../supabaseConfig';

/**
 * Write an entry to Supabase `audit_logs` table.
 * @param {object} actor  - The current user { uid, name, email, role }
 * @param {string} action - Short action key e.g. 'APPROVE_TIME_LOG'
 * @param {string} details - Human-readable description
 */
export const writeAuditLog = async (actor, action, details) => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: actor?.uid || 'unknown',
          user_name: actor?.name || actor?.email || 'Unknown',
          user_role: actor?.role || 'unknown',
          action,
          details,
        },
      ]);

    if (error) {
      console.error('[AuditLog] Insert failed:', error.message, error);
    } else {
      console.log('[AuditLog] Logged:', action);
    }
  } catch (err) {
    console.error('[AuditLog] Failed to write:', err.message, err);
  }
};
