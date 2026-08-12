-- 031_notifications_query_hardening.sql
-- Additive indexes for the authenticated notifications list and unread count.
-- Apply after 015_borrowing_notifications_hardening.sql.

-- User equality + unread filter + newest-first ordering. The partial index keeps
-- the high-frequency unread-count query small as read history grows.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_id
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE is_read = FALSE;

-- The list endpoint supports both all/read-only and unread-only views and uses
-- a deterministic created_at/id order for stable range pagination.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_id
  ON public.notifications (user_id, created_at DESC, id DESC);

NOTIFY pgrst, 'reload schema';
