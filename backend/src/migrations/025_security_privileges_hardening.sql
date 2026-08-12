-- 025_security_privileges_hardening.sql
-- Additive production hardening. Run after migrations 001-024.
--
-- The API talks to Supabase through the service role. Client-facing roles must
-- not be able to execute security-definer mutation/report functions directly.
-- This migration is intentionally idempotent and does not rewrite old files.

BEGIN;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  function_record RECORD;
  protected_names CONSTANT text[] := ARRAY[
    'record_cash_in_atomic',
    'record_cash_out_atomic',
    'generate_weekly_cash_billing',
    'record_grades_bulk_atomic',
    'get_cash_report',
    'get_cash_summary',
    'write_audit_log',
    'notify_borrowing_recipients',
    'create_borrowing_atomic',
    'approve_borrowing_atomic',
    'handover_borrowing_atomic',
    'return_borrowing_atomic',
    'record_cash_in_on_date_atomic',
    'record_cash_in_with_status_atomic',
    'change_password_atomic',
    'record_cash_in_on_date_with_method_atomic',
    'record_cash_out_with_method_atomic',
    'get_cash_report_with_method',
    'resolve_cash_payment_method_id',
    'default_cash_payment_method',
    'create_student_with_account_atomic',
    'provision_student_account_atomic',
    'set_student_account_status_atomic',
    'update_student_profile_atomic'
  ];
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (protected_names)
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      function_record.signature
    );
  END LOOP;
END;
$do$;

-- Class options are intentionally readable by the unauthenticated dropdown
-- endpoint, but mutations are service-role only. The previous authenticated
-- FOR ALL policy allowed any authenticated client to alter the master list.
DROP POLICY IF EXISTS "Allow manage classes for authenticated users" ON public.classes;
DROP POLICY IF EXISTS "classes_service_role_manage" ON public.classes;
CREATE POLICY "classes_service_role_manage"
  ON public.classes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_classes_active_tingkat_name
  ON public.classes (is_active, tingkat, nama_kelas);

CREATE INDEX IF NOT EXISTS idx_attendance_date_id_student
  ON public.attendance (tanggal DESC, id DESC, student_id);

CREATE INDEX IF NOT EXISTS idx_students_kelas_id
  ON public.students (kelas, id);

COMMIT;
