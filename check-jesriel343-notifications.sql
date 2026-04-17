-- Check notifications for coligadojesriel343@gmail.com

SELECT 
  nl.id,
  nl.status,
  nl.attempted_at,
  nl.read_at,
  n.title,
  n.message,
  n.notification_type
FROM notification_logs nl
JOIN notifications n ON n.id = nl.notification_id
JOIN users u ON u.id = nl.recipient_id
WHERE u.email = 'coligadojesriel343@gmail.com'
ORDER BY nl.attempted_at DESC
LIMIT 20;
