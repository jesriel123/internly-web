-- ============================================================
-- STEP 1: Check if you have any notifications
-- ============================================================
SELECT COUNT(*) as total_notifications FROM notifications;

-- ============================================================
-- STEP 2: Check if you have any notification logs
-- ============================================================
SELECT COUNT(*) as total_logs FROM notification_logs;

-- ============================================================
-- STEP 3: Get your user ID (copy the 'id' value from results)
-- ============================================================
SELECT id, email, name, role FROM users ORDER BY created_at DESC LIMIT 10;

-- ============================================================
-- STEP 4: Check notifications for ALL users (to see if any exist)
-- ============================================================
SELECT 
  nl.id,
  nl.recipient_id,
  nl.status,
  nl.attempted_at,
  n.title,
  n.message,
  n.notification_type,
  u.email as recipient_email
FROM notification_logs nl
JOIN notifications n ON n.id = nl.notification_id
JOIN users u ON u.id = nl.recipient_id
ORDER BY nl.attempted_at DESC
LIMIT 20;

-- ============================================================
-- STEP 5: Check if realtime is enabled
-- ============================================================
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('notifications', 'notification_logs');
