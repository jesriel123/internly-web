-- Check if coligadojesriel343@gmail.com exists and has notifications

SELECT 
  u.id as user_id,
  u.email,
  u.name,
  u.role,
  COUNT(nl.id) as total_notifications,
  COUNT(CASE WHEN nl.status = 'sent' THEN 1 END) as unread_count,
  COUNT(CASE WHEN nl.status = 'read' THEN 1 END) as read_count
FROM users u
LEFT JOIN notification_logs nl ON nl.recipient_id = u.id
WHERE u.email = 'coligadojesriel343@gmail.com'
GROUP BY u.id, u.email, u.name, u.role;
