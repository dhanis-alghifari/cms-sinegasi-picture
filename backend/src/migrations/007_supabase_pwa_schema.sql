-- ==========================================
-- 007_supabase_pwa_schema.sql
-- Supabase final schema summary & PWA offline support config
-- ==========================================

-- =====================
-- FULL SCHEMA INDEX
-- =====================
-- 001_student_dashboard_tables.sql → users, students, attendance, assignments, grades, equipment, borrowings
-- 002_seed_data_development.sql    → seed users, students, attendance, grades, equipment, borrowings
-- 003_notifications_table.sql      → notifications + auto-triggers
-- 004_grade_distribution_tables.sql → debt_records, cash_transactions, cash_disputes, activity_logs, contests, contest_members + views
-- 005_enable_supabase_realtime.sql → ALTER PUBLICATION + RLS policies
-- 006_contest_film_works_tables.sql → film_works, film_crew, contest_films, v_contest_win_rate view
-- 007_supabase_pwa_schema.sql      → offline sync table, PWA session registry

-- =====================
-- PWA Offline Sync Queue
-- Stores pending actions created while offline (to replay when online)
-- =====================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                -- e.g. 'SUBMIT_ATTENDANCE', 'SUBMIT_GRADE'
  payload JSONB NOT NULL,              -- action data to replay
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_offline_queue_user_status ON offline_sync_queue(user_id, status);

-- =====================
-- PWA Push Notification Subscriptions
-- Stores Web Push subscription objects per user device
-- =====================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',     -- optional: browser, OS info
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- =====================
-- Enable RLS on PWA tables
-- =====================
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_offline_queue" ON offline_sync_queue
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users
      WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
    )
  );

CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users
      WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
    )
  );

-- Grant teacher access to read all offline queues (for sync monitoring)
CREATE POLICY "teacher_read_all_offline_queue" ON offline_sync_queue
  FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::json->>'role') IN ('teacher', 'leader')
  );
