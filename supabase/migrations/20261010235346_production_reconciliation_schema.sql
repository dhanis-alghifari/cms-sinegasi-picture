-- REHEARSAL-ONLY CANDIDATE. No dev data, accounts or historical migration receipts.

DO $guard$ BEGIN
  IF current_database() NOT IN ('sinegasi_backup_restore', 'sinegasi_schema_fresh') THEN
    RAISE EXCEPTION 'ISOLATED_REHEARSAL_DATABASE_REQUIRED';
  END IF;
END $guard$;
SET LOCAL search_path = pg_catalog, public, extensions;
SET LOCAL check_function_bodies = off;
DO $empty$ DECLARE t record; occupied boolean; BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('access_control_audit_logs','access_permissions','access_role_permissions','access_roles','activity_logs','agenda_activities','agenda_activity_operations','agenda_activity_photos','agenda_migration_history','api_idempotency_responses','api_login_rate_limits','api_rate_limit_windows','assignments','attendance','billing_rules','borrowing_items','borrowing_migration_history','borrowing_return_assessment_items','borrowing_return_assessments','borrowing_return_evidence','borrowing_return_operations','borrowing_return_reports','borrowings','cash_billing_runs','cash_disputes','cash_migration_history','cash_payment_methods','cash_settings','cash_transactions','classes','contest_entries','contest_entry_evidence','contest_entry_members','contest_entry_pipeline_operations','contest_entry_result_history','contest_entry_result_operations','contest_entry_results','contest_entry_status_history','contest_films','contest_members','contest_migration_history','contest_submissions','contest_task_assignees','contest_tasks','contests','debt_records','equipment','equipment_charge_payments','equipment_charge_settlements','equipment_evidence','equipment_recovery_cases','equipment_valuations','film_crew','film_works','grade_report_periods','grade_reports','grades','media_works','notifications','offline_sync_queue','password_reset_operations','push_subscriptions','schema_migrations','social_account_snapshots','social_accounts','social_insight_periods','social_media_evidence','social_publications','student_account_operations','student_pkl_periods','students','users','work_types')) THEN
    RAISE EXCEPTION 'UNKNOWN_TABLE_REFUSED';
  END IF;
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t.relname);
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t.relname) INTO occupied;
    IF occupied THEN RAISE EXCEPTION 'NONEMPTY_DATABASE_REFUSED'; END IF;
  END LOOP;
END $empty$;
DO $constraints$ DECLARE c record; BEGIN
  FOR c IN SELECT r.relname,co.conname FROM pg_constraint co JOIN pg_class r ON r.oid=co.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'
    ORDER BY CASE WHEN co.contype='f' THEN 0 ELSE 1 END LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',c.relname,c.conname);
  END LOOP;
END $constraints$;
CREATE TABLE IF NOT EXISTS public."access_control_audit_logs" ();
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "actor_user_id" uuid;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_user_id" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_user_id" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "role_key" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "role_key" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "role_key" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "previous_capabilities" text[];
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "previous_capabilities" SET DEFAULT '{}'::text[];
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "previous_capabilities" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "next_capabilities" text[];
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "next_capabilities" SET DEFAULT '{}'::text[];
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "next_capabilities" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "change_reason" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "change_reason" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "change_reason" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "actor_name_snapshot" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_name_snapshot" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_name_snapshot" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "actor_username_snapshot" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_username_snapshot" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_username_snapshot" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "actor_role_snapshot" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_role_snapshot" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "actor_role_snapshot" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "request_id" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "request_id" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "request_id" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ADD COLUMN IF NOT EXISTS "operation_id" text;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "operation_id" DROP DEFAULT;
ALTER TABLE public."access_control_audit_logs" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE public."access_control_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."access_permissions" ();
ALTER TABLE public."access_permissions" ADD COLUMN IF NOT EXISTS "permission_key" text;
ALTER TABLE public."access_permissions" ALTER COLUMN "permission_key" DROP DEFAULT;
ALTER TABLE public."access_permissions" ALTER COLUMN "permission_key" SET NOT NULL;
ALTER TABLE public."access_permissions" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public."access_permissions" ALTER COLUMN "label" DROP DEFAULT;
ALTER TABLE public."access_permissions" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE public."access_permissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."access_permissions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."access_permissions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."access_permissions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."access_role_permissions" ();
ALTER TABLE public."access_role_permissions" ADD COLUMN IF NOT EXISTS "role_key" text;
ALTER TABLE public."access_role_permissions" ALTER COLUMN "role_key" DROP DEFAULT;
ALTER TABLE public."access_role_permissions" ALTER COLUMN "role_key" SET NOT NULL;
ALTER TABLE public."access_role_permissions" ADD COLUMN IF NOT EXISTS "permission_key" text;
ALTER TABLE public."access_role_permissions" ALTER COLUMN "permission_key" DROP DEFAULT;
ALTER TABLE public."access_role_permissions" ALTER COLUMN "permission_key" SET NOT NULL;
ALTER TABLE public."access_role_permissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."access_role_permissions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."access_role_permissions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."access_role_permissions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."access_roles" ();
ALTER TABLE public."access_roles" ADD COLUMN IF NOT EXISTS "role_key" text;
ALTER TABLE public."access_roles" ALTER COLUMN "role_key" DROP DEFAULT;
ALTER TABLE public."access_roles" ALTER COLUMN "role_key" SET NOT NULL;
ALTER TABLE public."access_roles" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public."access_roles" ALTER COLUMN "label" DROP DEFAULT;
ALTER TABLE public."access_roles" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE public."access_roles" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."access_roles" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."access_roles" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."access_roles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."activity_logs" ();
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."activity_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."activity_logs" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."activity_logs" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "aksi" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "aksi" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "aksi" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "tabel" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "tabel" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "tabel" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "record_id" uuid;
ALTER TABLE public."activity_logs" ALTER COLUMN "record_id" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "record_id" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "data_lama" jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "data_lama" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "data_lama" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "data_baru" jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "data_baru" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "data_baru" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "change_reason" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "change_reason" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "change_reason" SET NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."activity_logs" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."activity_logs" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "action" SET NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "table_name" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "table_name" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "table_name" SET NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "old_values" jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "old_values" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "old_values" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "new_values" jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "new_values" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "new_values" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "actor_name_snapshot" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_name_snapshot" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_name_snapshot" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "actor_username_snapshot" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_username_snapshot" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_username_snapshot" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "actor_role_snapshot" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_role_snapshot" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "actor_role_snapshot" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "request_id" uuid;
ALTER TABLE public."activity_logs" ALTER COLUMN "request_id" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "request_id" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "operation_id" uuid;
ALTER TABLE public."activity_logs" ALTER COLUMN "operation_id" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "source" SET DEFAULT 'api'::text;
ALTER TABLE public."activity_logs" ALTER COLUMN "source" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE public."activity_logs" ALTER COLUMN "user_agent" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "user_agent" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "changed_fields" text[];
ALTER TABLE public."activity_logs" ALTER COLUMN "changed_fields" SET DEFAULT ARRAY[]::text[];
ALTER TABLE public."activity_logs" ALTER COLUMN "changed_fields" DROP NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE public."activity_logs" ALTER COLUMN "metadata" SET NOT NULL;
ALTER TABLE public."activity_logs" ADD COLUMN IF NOT EXISTS "ip_address" inet;
ALTER TABLE public."activity_logs" ALTER COLUMN "ip_address" DROP DEFAULT;
ALTER TABLE public."activity_logs" ALTER COLUMN "ip_address" DROP NOT NULL;
ALTER TABLE public."activity_logs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."agenda_activities" ();
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."agenda_activities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."agenda_activities" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "activity_date" date;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_date" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_date" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "activity_name" text;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_name" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_name" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "activity_description" text;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_description" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "activity_description" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "instructor_name" text;
ALTER TABLE public."agenda_activities" ALTER COLUMN "instructor_name" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "instructor_name" DROP NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "pic_names" text[];
ALTER TABLE public."agenda_activities" ALTER COLUMN "pic_names" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "pic_names" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "pic_names_search" text;
ALTER TABLE public."agenda_activities" ALTER COLUMN "pic_names_search" SET DEFAULT ''::text;
ALTER TABLE public."agenda_activities" ALTER COLUMN "pic_names_search" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "version" integer;
ALTER TABLE public."agenda_activities" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE public."agenda_activities" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."agenda_activities" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."agenda_activities" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."agenda_activities" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."agenda_activities" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."agenda_activities" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."agenda_activities" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "archived_by" uuid;
ALTER TABLE public."agenda_activities" ALTER COLUMN "archived_by" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "archived_by" DROP NOT NULL;
ALTER TABLE public."agenda_activities" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE public."agenda_activities" ALTER COLUMN "archived_at" DROP DEFAULT;
ALTER TABLE public."agenda_activities" ALTER COLUMN "archived_at" DROP NOT NULL;
ALTER TABLE public."agenda_activities" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."agenda_activity_operations" ();
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "activity_id" uuid;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "activity_id" DROP DEFAULT;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "activity_id" DROP NOT NULL;
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "operation_kind" text;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "operation_kind" DROP DEFAULT;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "operation_kind" SET NOT NULL;
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "actor_id" DROP DEFAULT;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "actor_id" SET NOT NULL;
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "response_payload" jsonb;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "response_payload" DROP DEFAULT;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "response_payload" DROP NOT NULL;
ALTER TABLE public."agenda_activity_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."agenda_activity_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."agenda_activity_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."agenda_activity_photos" ();
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "activity_id" uuid;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "activity_id" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "activity_id" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "object_key" text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "object_key" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "object_key" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "storage_provider" text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "storage_provider" SET DEFAULT 'r2'::text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "storage_provider" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "mime_type" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "file_size_bytes" bigint;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "file_size_bytes" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "file_size_bytes" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "original_filename" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "original_filename" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "upload_status" text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::text;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "upload_status" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."agenda_activity_photos" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "expires_at" DROP DEFAULT;
ALTER TABLE public."agenda_activity_photos" ALTER COLUMN "expires_at" DROP NOT NULL;
ALTER TABLE public."agenda_activity_photos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."agenda_migration_history" ();
ALTER TABLE public."agenda_migration_history" ADD COLUMN IF NOT EXISTS "migration_name" text;
ALTER TABLE public."agenda_migration_history" ALTER COLUMN "migration_name" DROP DEFAULT;
ALTER TABLE public."agenda_migration_history" ALTER COLUMN "migration_name" SET NOT NULL;
ALTER TABLE public."agenda_migration_history" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone;
ALTER TABLE public."agenda_migration_history" ALTER COLUMN "applied_at" SET DEFAULT now();
ALTER TABLE public."agenda_migration_history" ALTER COLUMN "applied_at" SET NOT NULL;
ALTER TABLE public."agenda_migration_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."api_idempotency_responses" ();
ALTER TABLE public."api_idempotency_responses" ADD COLUMN IF NOT EXISTS "cache_key" text;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "cache_key" DROP DEFAULT;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "cache_key" SET NOT NULL;
ALTER TABLE public."api_idempotency_responses" ADD COLUMN IF NOT EXISTS "status_code" integer;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "status_code" DROP DEFAULT;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "status_code" SET NOT NULL;
ALTER TABLE public."api_idempotency_responses" ADD COLUMN IF NOT EXISTS "payload" text;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "payload" DROP DEFAULT;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "payload" SET NOT NULL;
ALTER TABLE public."api_idempotency_responses" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "expires_at" DROP DEFAULT;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "expires_at" SET NOT NULL;
ALTER TABLE public."api_idempotency_responses" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."api_idempotency_responses" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."api_idempotency_responses" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."api_login_rate_limits" ();
ALTER TABLE public."api_login_rate_limits" ADD COLUMN IF NOT EXISTS "rate_key" text;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "rate_key" DROP DEFAULT;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "rate_key" SET NOT NULL;
ALTER TABLE public."api_login_rate_limits" ADD COLUMN IF NOT EXISTS "failure_count" integer;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "failure_count" DROP DEFAULT;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "failure_count" SET NOT NULL;
ALTER TABLE public."api_login_rate_limits" ADD COLUMN IF NOT EXISTS "window_started_at" timestamp with time zone;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "window_started_at" DROP DEFAULT;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "window_started_at" SET NOT NULL;
ALTER TABLE public."api_login_rate_limits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."api_login_rate_limits" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."api_login_rate_limits" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."api_rate_limit_windows" ();
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "rate_key" text;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "rate_key" DROP DEFAULT;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "rate_key" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "request_count" integer;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "request_count" DROP DEFAULT;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "request_count" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "window_started_at" timestamp with time zone;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "window_started_at" DROP DEFAULT;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "window_started_at" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "window_seconds" integer;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "window_seconds" DROP DEFAULT;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "window_seconds" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "max_requests" integer;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "max_requests" DROP DEFAULT;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "max_requests" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."api_rate_limit_windows" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."api_rate_limit_windows" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."assignments" ();
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."assignments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."assignments" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."assignments" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "category" assignment_category;
ALTER TABLE public."assignments" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "keterangan_kategori" text;
ALTER TABLE public."assignments" ALTER COLUMN "keterangan_kategori" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "keterangan_kategori" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "due_date" date;
ALTER TABLE public."assignments" ALTER COLUMN "due_date" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "due_date" SET NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."assignments" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."assignments" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "deskripsi" text;
ALTER TABLE public."assignments" ALTER COLUMN "deskripsi" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "deskripsi" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "kelas" text;
ALTER TABLE public."assignments" ALTER COLUMN "kelas" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "kelas" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."assignments" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."assignments" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."assignments" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."assignments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."assignments" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."assignments" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."assignments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."attendance" ();
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."attendance" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."attendance" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."attendance" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "tanggal" date;
ALTER TABLE public."attendance" ALTER COLUMN "tanggal" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "tanggal" SET NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."attendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "keterangan" text;
ALTER TABLE public."attendance" ALTER COLUMN "keterangan" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "keterangan" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "is_locked" boolean;
ALTER TABLE public."attendance" ALTER COLUMN "is_locked" SET DEFAULT false;
ALTER TABLE public."attendance" ALTER COLUMN "is_locked" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."attendance" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."attendance" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."attendance" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."attendance" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."attendance" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."attendance" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."attendance" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."attendance" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."attendance" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."attendance" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."billing_rules" ();
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."billing_rules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."billing_rules" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "nominal_iuran_wajib" integer;
ALTER TABLE public."billing_rules" ALTER COLUMN "nominal_iuran_wajib" DROP DEFAULT;
ALTER TABLE public."billing_rules" ALTER COLUMN "nominal_iuran_wajib" SET NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "holiday_start_date" date;
ALTER TABLE public."billing_rules" ALTER COLUMN "holiday_start_date" DROP DEFAULT;
ALTER TABLE public."billing_rules" ALTER COLUMN "holiday_start_date" DROP NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "holiday_end_date" date;
ALTER TABLE public."billing_rules" ALTER COLUMN "holiday_end_date" DROP DEFAULT;
ALTER TABLE public."billing_rules" ALTER COLUMN "holiday_end_date" DROP NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "skip_week" boolean;
ALTER TABLE public."billing_rules" ALTER COLUMN "skip_week" SET DEFAULT false;
ALTER TABLE public."billing_rules" ALTER COLUMN "skip_week" DROP NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."billing_rules" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."billing_rules" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."billing_rules" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."billing_rules" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."billing_rules" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."billing_rules" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_items" ();
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowing_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowing_items" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "borrowing_id" uuid;
ALTER TABLE public."borrowing_items" ALTER COLUMN "borrowing_id" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "borrowing_id" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "equipment_id" uuid;
ALTER TABLE public."borrowing_items" ALTER COLUMN "equipment_id" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "equipment_id" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "returned_condition" text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "returned_condition" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "returned_condition" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone;
ALTER TABLE public."borrowing_items" ALTER COLUMN "returned_at" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "returned_at" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_items" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_items" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "kondisi_awal" text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "kondisi_awal" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "kondisi_awal" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "kondisi_kembali" text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "kondisi_kembali" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "kondisi_kembali" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "denda" numeric(14,2);
ALTER TABLE public."borrowing_items" ALTER COLUMN "denda" SET DEFAULT 0;
ALTER TABLE public."borrowing_items" ALTER COLUMN "denda" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "tanggal_diserahkan" timestamp with time zone;
ALTER TABLE public."borrowing_items" ALTER COLUMN "tanggal_diserahkan" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "tanggal_diserahkan" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "tanggal_dikembalikan" timestamp with time zone;
ALTER TABLE public."borrowing_items" ALTER COLUMN "tanggal_dikembalikan" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "tanggal_dikembalikan" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "catatan" text;
ALTER TABLE public."borrowing_items" ALTER COLUMN "catatan" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "catatan" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."borrowing_items" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."borrowing_items" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."borrowing_items" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."borrowing_items" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."borrowing_items" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."borrowing_items" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_migration_history" ();
ALTER TABLE public."borrowing_migration_history" ADD COLUMN IF NOT EXISTS "migration_name" text;
ALTER TABLE public."borrowing_migration_history" ALTER COLUMN "migration_name" DROP DEFAULT;
ALTER TABLE public."borrowing_migration_history" ALTER COLUMN "migration_name" SET NOT NULL;
ALTER TABLE public."borrowing_migration_history" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone;
ALTER TABLE public."borrowing_migration_history" ALTER COLUMN "applied_at" SET DEFAULT now();
ALTER TABLE public."borrowing_migration_history" ALTER COLUMN "applied_at" SET NOT NULL;
ALTER TABLE public."borrowing_migration_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_return_assessment_items" ();
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "assessment_id" uuid;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "assessment_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "assessment_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "borrowing_item_id" uuid;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "borrowing_item_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "borrowing_item_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "equipment_id" uuid;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "equipment_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "equipment_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "condition" text;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "condition" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "settlement_method" text;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "settlement_method" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "settlement_method" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "valuation_id" uuid;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "valuation_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "valuation_id" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "replacement_value_snapshot" numeric(14,2);
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "replacement_value_snapshot" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "replacement_value_snapshot" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "repair_cost" numeric(14,2);
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "repair_cost" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "repair_cost" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "charged_amount" numeric(14,2);
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "charged_amount" SET DEFAULT 0;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "charged_amount" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "evidence_urls" jsonb;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "evidence_urls" SET DEFAULT '[]'::jsonb;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "evidence_urls" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_assessment_items" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessment_items" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_return_assessments" ();
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "borrowing_id" uuid;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "borrowing_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "borrowing_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "status" SET DEFAULT 'finalized'::text;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "return_date" date;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "return_date" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "return_date" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "damage_charge" numeric(14,2);
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "damage_charge" SET DEFAULT 0;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "damage_charge" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "late_charge" numeric(14,2);
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "late_charge" SET DEFAULT 0;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "late_charge" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "total_charge" numeric(14,2);
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "total_charge" SET DEFAULT 0;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "total_charge" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "finalized_by" uuid;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "finalized_by" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "finalized_by" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ADD COLUMN IF NOT EXISTS "finalized_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "finalized_at" DROP DEFAULT;
ALTER TABLE public."borrowing_return_assessments" ALTER COLUMN "finalized_at" DROP NOT NULL;
ALTER TABLE public."borrowing_return_assessments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_return_evidence" ();
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "borrowing_id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "borrowing_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "borrowing_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "borrowing_item_id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "borrowing_item_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "borrowing_item_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "equipment_id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "equipment_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "equipment_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "assessment_item_id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "assessment_item_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "assessment_item_id" DROP NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "object_key" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "object_key" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "object_key" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "storage_provider" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "storage_provider" SET DEFAULT 'r2'::text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "storage_provider" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "mime_type" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "file_size_bytes" bigint;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "file_size_bytes" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "file_size_bytes" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "original_filename" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "original_filename" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "upload_status" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "upload_status" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "attached_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "attached_at" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "attached_at" DROP NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "return_report_id" uuid;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "return_report_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "return_report_id" DROP NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "source" SET DEFAULT 'teacher_return'::text;
ALTER TABLE public."borrowing_return_evidence" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE public."borrowing_return_evidence" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_return_operations" ();
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "report_id" uuid;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "report_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "report_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "operation_kind" text;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "operation_kind" DROP DEFAULT;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "operation_kind" SET NOT NULL;
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "actor_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "actor_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "response_payload" jsonb;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "response_payload" DROP DEFAULT;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "response_payload" DROP NOT NULL;
ALTER TABLE public."borrowing_return_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowing_return_reports" ();
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "borrowing_id" uuid;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "borrowing_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "borrowing_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "reporter_id" uuid;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "reporter_id" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "reporter_id" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "rejection_reason" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "rejection_reason" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "verification_method" text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verification_method" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verification_method" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "verified_by" uuid;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verified_by" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verified_by" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "reported_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "reported_at" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "reported_at" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verified_at" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "verified_at" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "idempotency_key" DROP NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."borrowing_return_reports" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."borrowing_return_reports" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."borrowings" ();
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."borrowings" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."borrowings" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE public."borrowings" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "borrowed_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "borrowed_at" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "borrowed_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "due_at" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "due_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "returned_at" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "returned_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "approved_by" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "approved_by" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."borrowings" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "tanggal_pinjam" date;
ALTER TABLE public."borrowings" ALTER COLUMN "tanggal_pinjam" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "tanggal_pinjam" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "rencana_kembali" date;
ALTER TABLE public."borrowings" ALTER COLUMN "rencana_kembali" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "rencana_kembali" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "keperluan" text;
ALTER TABLE public."borrowings" ALTER COLUMN "keperluan" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "keperluan" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "catatan_persetujuan" text;
ALTER TABLE public."borrowings" ALTER COLUMN "catatan_persetujuan" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "catatan_persetujuan" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "catatan_pengembalian" text;
ALTER TABLE public."borrowings" ALTER COLUMN "catatan_pengembalian" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "catatan_pengembalian" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "total_denda" numeric(14,2);
ALTER TABLE public."borrowings" ALTER COLUMN "total_denda" SET DEFAULT 0;
ALTER TABLE public."borrowings" ALTER COLUMN "total_denda" SET NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "processed_return_by" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "processed_return_by" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "processed_return_by" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."borrowings" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "idempotency_key" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."borrowings" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "return_reported_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "return_reported_at" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "return_reported_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "return_notes" text;
ALTER TABLE public."borrowings" ALTER COLUMN "return_notes" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "return_notes" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "return_verified_at" timestamp with time zone;
ALTER TABLE public."borrowings" ALTER COLUMN "return_verified_at" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "return_verified_at" DROP NOT NULL;
ALTER TABLE public."borrowings" ADD COLUMN IF NOT EXISTS "return_verified_by" uuid;
ALTER TABLE public."borrowings" ALTER COLUMN "return_verified_by" DROP DEFAULT;
ALTER TABLE public."borrowings" ALTER COLUMN "return_verified_by" DROP NOT NULL;
ALTER TABLE public."borrowings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_billing_runs" ();
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "billing_week" date;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "billing_week" DROP DEFAULT;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "billing_week" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "nominal_iuran_wajib" numeric(12,2);
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "nominal_iuran_wajib" DROP DEFAULT;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "nominal_iuran_wajib" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "students_billed" integer;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "students_billed" SET DEFAULT 0;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "students_billed" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "total_nominal" numeric(14,2);
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "total_nominal" SET DEFAULT 0;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "total_nominal" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."cash_billing_runs" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."cash_billing_runs" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."cash_billing_runs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_disputes" ();
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."cash_disputes" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "transaction_id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "transaction_id" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "transaction_id" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "reason" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "reason" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."cash_disputes" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."cash_disputes" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "bukti_sanggahan_url" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "bukti_sanggahan_url" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "bukti_sanggahan_url" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "resolved_by" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolved_by" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolved_by" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolved_at" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolved_at" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "alasan_sanggahan" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "alasan_sanggahan" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "alasan_sanggahan" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."cash_disputes" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."cash_disputes" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "debt_record_id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "debt_record_id" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "debt_record_id" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "quota_period_start" date;
ALTER TABLE public."cash_disputes" ALTER COLUMN "quota_period_start" SET DEFAULT (date_trunc('month'::text, (now() AT TIME ZONE 'Asia/Jakarta'::text)))::date;
ALTER TABLE public."cash_disputes" ALTER COLUMN "quota_period_start" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "attempt_number" smallint;
ALTER TABLE public."cash_disputes" ALTER COLUMN "attempt_number" SET DEFAULT 1;
ALTER TABLE public."cash_disputes" ALTER COLUMN "attempt_number" SET NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "previous_dispute_id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "previous_dispute_id" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "previous_dispute_id" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "idempotency_key" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "review_note" text;
ALTER TABLE public."cash_disputes" ALTER COLUMN "review_note" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "review_note" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ADD COLUMN IF NOT EXISTS "resolution_transaction_id" uuid;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolution_transaction_id" DROP DEFAULT;
ALTER TABLE public."cash_disputes" ALTER COLUMN "resolution_transaction_id" DROP NOT NULL;
ALTER TABLE public."cash_disputes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_migration_history" ();
ALTER TABLE public."cash_migration_history" ADD COLUMN IF NOT EXISTS "migration_name" text;
ALTER TABLE public."cash_migration_history" ALTER COLUMN "migration_name" DROP DEFAULT;
ALTER TABLE public."cash_migration_history" ALTER COLUMN "migration_name" SET NOT NULL;
ALTER TABLE public."cash_migration_history" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone;
ALTER TABLE public."cash_migration_history" ALTER COLUMN "applied_at" SET DEFAULT now();
ALTER TABLE public."cash_migration_history" ALTER COLUMN "applied_at" SET NOT NULL;
ALTER TABLE public."cash_migration_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_payment_methods" ();
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "label" DROP DEFAULT;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "sort_order" integer;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "sort_order" SET DEFAULT 0;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "sort_order" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."cash_payment_methods" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."cash_payment_methods" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_settings" ();
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "id" boolean;
ALTER TABLE public."cash_settings" ALTER COLUMN "id" SET DEFAULT true;
ALTER TABLE public."cash_settings" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "nominal_iuran_wajib" numeric(12,2);
ALTER TABLE public."cash_settings" ALTER COLUMN "nominal_iuran_wajib" SET DEFAULT 5000;
ALTER TABLE public."cash_settings" ALTER COLUMN "nominal_iuran_wajib" SET NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "holiday_start_date" date;
ALTER TABLE public."cash_settings" ALTER COLUMN "holiday_start_date" DROP DEFAULT;
ALTER TABLE public."cash_settings" ALTER COLUMN "holiday_start_date" DROP NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "holiday_end_date" date;
ALTER TABLE public."cash_settings" ALTER COLUMN "holiday_end_date" DROP DEFAULT;
ALTER TABLE public."cash_settings" ALTER COLUMN "holiday_end_date" DROP NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "skip_week" boolean;
ALTER TABLE public."cash_settings" ALTER COLUMN "skip_week" SET DEFAULT false;
ALTER TABLE public."cash_settings" ALTER COLUMN "skip_week" SET NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."cash_settings" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."cash_settings" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."cash_settings" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."cash_settings" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."cash_settings" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."cash_settings" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."cash_settings" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."cash_settings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."cash_transactions" ();
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."cash_transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."cash_transactions" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."cash_transactions" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "tipe" text;
ALTER TABLE public."cash_transactions" ALTER COLUMN "tipe" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "tipe" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "jumlah" integer;
ALTER TABLE public."cash_transactions" ALTER COLUMN "jumlah" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "jumlah" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "keterangan" text;
ALTER TABLE public."cash_transactions" ALTER COLUMN "keterangan" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "keterangan" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "tanggal" date;
ALTER TABLE public."cash_transactions" ALTER COLUMN "tanggal" SET DEFAULT CURRENT_DATE;
ALTER TABLE public."cash_transactions" ALTER COLUMN "tanggal" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."cash_transactions" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."cash_transactions" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."cash_transactions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."cash_transactions" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "foto_bukti_url" text;
ALTER TABLE public."cash_transactions" ALTER COLUMN "foto_bukti_url" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "foto_bukti_url" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "is_billing" boolean;
ALTER TABLE public."cash_transactions" ALTER COLUMN "is_billing" SET DEFAULT false;
ALTER TABLE public."cash_transactions" ALTER COLUMN "is_billing" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "type" transaction_type;
ALTER TABLE public."cash_transactions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "nominal" numeric(12,2);
ALTER TABLE public."cash_transactions" ALTER COLUMN "nominal" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "nominal" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "saldo_sebelum" numeric(12,2);
ALTER TABLE public."cash_transactions" ALTER COLUMN "saldo_sebelum" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "saldo_sebelum" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "saldo_sesudah" numeric(12,2);
ALTER TABLE public."cash_transactions" ALTER COLUMN "saldo_sesudah" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "saldo_sesudah" SET NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."cash_transactions" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."cash_transactions" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."cash_transactions" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;
ALTER TABLE public."cash_transactions" ALTER COLUMN "payment_method_id" DROP DEFAULT;
ALTER TABLE public."cash_transactions" ALTER COLUMN "payment_method_id" DROP NOT NULL;
ALTER TABLE public."cash_transactions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."classes" ();
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."classes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."classes" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "nama_kelas" text;
ALTER TABLE public."classes" ALTER COLUMN "nama_kelas" DROP DEFAULT;
ALTER TABLE public."classes" ALTER COLUMN "nama_kelas" SET NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "tingkat" text;
ALTER TABLE public."classes" ALTER COLUMN "tingkat" DROP DEFAULT;
ALTER TABLE public."classes" ALTER COLUMN "tingkat" SET NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."classes" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."classes" ALTER COLUMN "is_active" DROP NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."classes" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."classes" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."classes" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."classes" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."classes" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."classes" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."classes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."classes" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."classes" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."classes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entries" ();
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entries" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "contest_id" uuid;
ALTER TABLE public."contest_entries" ALTER COLUMN "contest_id" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "contest_id" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "work_id" uuid;
ALTER TABLE public."contest_entries" ALTER COLUMN "work_id" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "work_id" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "pipeline_status" text;
ALTER TABLE public."contest_entries" ALTER COLUMN "pipeline_status" SET DEFAULT 'proses_submit'::text;
ALTER TABLE public."contest_entries" ALTER COLUMN "pipeline_status" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "result_label" text;
ALTER TABLE public."contest_entries" ALTER COLUMN "result_label" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "result_label" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "result_note" text;
ALTER TABLE public."contest_entries" ALTER COLUMN "result_note" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "result_note" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
ALTER TABLE public."contest_entries" ALTER COLUMN "submitted_at" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "submitted_at" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."contest_entries" ALTER COLUMN "completed_at" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "completed_at" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_entries" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."contest_entries" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."contest_entries" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "version" integer;
ALTER TABLE public."contest_entries" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE public."contest_entries" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entries" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entries" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."contest_entries" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."contest_entries" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."contest_entries" ADD COLUMN IF NOT EXISTS "outcome_status" text;
ALTER TABLE public."contest_entries" ALTER COLUMN "outcome_status" SET DEFAULT 'pending'::text;
ALTER TABLE public."contest_entries" ALTER COLUMN "outcome_status" SET NOT NULL;
ALTER TABLE public."contest_entries" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_evidence" ();
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "evidence_type" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "evidence_type" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "evidence_type" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "object_key" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "object_key" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "object_key" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "public_url" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "public_url" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "public_url" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "storage_provider" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "storage_provider" SET DEFAULT 'legacy_url'::text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "storage_provider" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "target_status" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "target_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "target_status" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "mime_type" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "file_size_bytes" bigint;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "file_size_bytes" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "file_size_bytes" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "original_filename" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "original_filename" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "upload_status" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "upload_status" SET DEFAULT 'attached'::text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "upload_status" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "attached_status" text;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "attached_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "attached_status" DROP NOT NULL;
ALTER TABLE public."contest_entry_evidence" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_evidence" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."contest_entry_evidence" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_members" ();
ALTER TABLE public."contest_entry_members" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entry_members" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entry_members" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_members" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."contest_entry_members" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE public."contest_entry_members" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_members" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_members" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_members" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_pipeline_operations" ();
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "operation_kind" text;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "operation_kind" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "operation_kind" SET NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "target_status" text;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "target_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "target_status" SET NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "actor_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "response_payload" jsonb;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "response_payload" DROP DEFAULT;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "response_payload" DROP NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_pipeline_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_result_history" ();
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "from_outcome_status" text;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "from_outcome_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "from_outcome_status" DROP NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "to_outcome_status" text;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "to_outcome_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "to_outcome_status" SET NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "change_reason" text;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "change_reason" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "change_reason" SET NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "changed_by" uuid;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "changed_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "changed_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_result_history" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_result_history" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_result_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_result_operations" ();
ALTER TABLE public."contest_entry_result_operations" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."contest_entry_result_operations" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_result_operations" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "actor_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE public."contest_entry_result_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_result_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_result_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_results" ();
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entry_results" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "result_kind" text;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "result_kind" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "result_kind" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "result_title" text;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "result_title" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "result_title" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "position" integer;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "position" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "position" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "category_name" text;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "category_name" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "category_name" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "voided_at" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "voided_at" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "voided_by" uuid;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "voided_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "voided_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_results" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."contest_entry_results" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_results" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."contest_entry_results" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_entry_status_history" ();
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "from_status" text;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "from_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "from_status" DROP NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "to_status" text;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "to_status" DROP DEFAULT;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "to_status" SET NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "change_reason" text;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "change_reason" DROP DEFAULT;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "change_reason" SET NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "changed_by" uuid;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "changed_by" DROP DEFAULT;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "changed_by" DROP NOT NULL;
ALTER TABLE public."contest_entry_status_history" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_entry_status_history" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_entry_status_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_films" ();
ALTER TABLE public."contest_films" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_films" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_films" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_films" ADD COLUMN IF NOT EXISTS "contest_id" uuid;
ALTER TABLE public."contest_films" ALTER COLUMN "contest_id" DROP DEFAULT;
ALTER TABLE public."contest_films" ALTER COLUMN "contest_id" SET NOT NULL;
ALTER TABLE public."contest_films" ADD COLUMN IF NOT EXISTS "film_id" uuid;
ALTER TABLE public."contest_films" ALTER COLUMN "film_id" DROP DEFAULT;
ALTER TABLE public."contest_films" ALTER COLUMN "film_id" SET NOT NULL;
ALTER TABLE public."contest_films" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_members" ();
ALTER TABLE public."contest_members" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_members" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_members" ADD COLUMN IF NOT EXISTS "contest_id" uuid;
ALTER TABLE public."contest_members" ALTER COLUMN "contest_id" DROP DEFAULT;
ALTER TABLE public."contest_members" ALTER COLUMN "contest_id" SET NOT NULL;
ALTER TABLE public."contest_members" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."contest_members" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."contest_members" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."contest_members" ADD COLUMN IF NOT EXISTS "role_in_contest" text;
ALTER TABLE public."contest_members" ALTER COLUMN "role_in_contest" DROP DEFAULT;
ALTER TABLE public."contest_members" ALTER COLUMN "role_in_contest" SET NOT NULL;
ALTER TABLE public."contest_members" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_members" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_members" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_members" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_migration_history" ();
ALTER TABLE public."contest_migration_history" ADD COLUMN IF NOT EXISTS "migration_name" text;
ALTER TABLE public."contest_migration_history" ALTER COLUMN "migration_name" DROP DEFAULT;
ALTER TABLE public."contest_migration_history" ALTER COLUMN "migration_name" SET NOT NULL;
ALTER TABLE public."contest_migration_history" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone;
ALTER TABLE public."contest_migration_history" ALTER COLUMN "applied_at" SET DEFAULT now();
ALTER TABLE public."contest_migration_history" ALTER COLUMN "applied_at" SET NOT NULL;
ALTER TABLE public."contest_migration_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_submissions" ();
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_submissions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_submissions" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "contest_id" uuid;
ALTER TABLE public."contest_submissions" ALTER COLUMN "contest_id" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "contest_id" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "film_id" uuid;
ALTER TABLE public."contest_submissions" ALTER COLUMN "film_id" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "film_id" DROP NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "judul_film" text;
ALTER TABLE public."contest_submissions" ALTER COLUMN "judul_film" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "judul_film" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "sutradara_id" uuid;
ALTER TABLE public."contest_submissions" ALTER COLUMN "sutradara_id" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "sutradara_id" DROP NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "crew_members" jsonb;
ALTER TABLE public."contest_submissions" ALTER COLUMN "crew_members" SET DEFAULT '[]'::jsonb;
ALTER TABLE public."contest_submissions" ALTER COLUMN "crew_members" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "link_video" text;
ALTER TABLE public."contest_submissions" ALTER COLUMN "link_video" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "link_video" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "award_status" text;
ALTER TABLE public."contest_submissions" ALTER COLUMN "award_status" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "award_status" SET NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "sertifikat_url" text;
ALTER TABLE public."contest_submissions" ALTER COLUMN "sertifikat_url" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "sertifikat_url" DROP NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_submissions" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_submissions" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_submissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_submissions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_submissions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_submissions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_task_assignees" ();
ALTER TABLE public."contest_task_assignees" ADD COLUMN IF NOT EXISTS "task_id" uuid;
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "task_id" DROP DEFAULT;
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "task_id" SET NOT NULL;
ALTER TABLE public."contest_task_assignees" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."contest_task_assignees" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_task_assignees" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_task_assignees" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contest_tasks" ();
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contest_tasks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contest_tasks" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."contest_tasks" ALTER COLUMN "entry_id" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "entry_id" SET NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."contest_tasks" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."contest_tasks" ALTER COLUMN "description" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "due_date" date;
ALTER TABLE public."contest_tasks" ALTER COLUMN "due_date" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "due_date" DROP NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."contest_tasks" ALTER COLUMN "status" SET DEFAULT 'todo'::text;
ALTER TABLE public."contest_tasks" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contest_tasks" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."contest_tasks" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."contest_tasks" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contest_tasks" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contest_tasks" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."contest_tasks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."contest_tasks" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."contest_tasks" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."contest_tasks" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."contests" ();
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."contests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."contests" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "nama_festival" text;
ALTER TABLE public."contests" ALTER COLUMN "nama_festival" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "nama_festival" SET NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "tanggal_lomba" date;
ALTER TABLE public."contests" ALTER COLUMN "tanggal_lomba" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "tanggal_lomba" SET NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "status" contest_status;
ALTER TABLE public."contests" ALTER COLUMN "status" SET DEFAULT 'progres'::contest_status;
ALTER TABLE public."contests" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "bukti_foto_url" text;
ALTER TABLE public."contests" ALTER COLUMN "bukti_foto_url" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "bukti_foto_url" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "hasil_juara" text;
ALTER TABLE public."contests" ALTER COLUMN "hasil_juara" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "hasil_juara" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."contests" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."contests" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."contests" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."contests" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."contests" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."contests" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "nama" text;
ALTER TABLE public."contests" ALTER COLUMN "nama" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "nama" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "jenis" text;
ALTER TABLE public."contests" ALTER COLUMN "jenis" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "jenis" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "level" text;
ALTER TABLE public."contests" ALTER COLUMN "level" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "level" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "tanggal" date;
ALTER TABLE public."contests" ALTER COLUMN "tanggal" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "tanggal" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "hasil" text;
ALTER TABLE public."contests" ALTER COLUMN "hasil" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "hasil" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "juara" text;
ALTER TABLE public."contests" ALTER COLUMN "juara" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "juara" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "kategori_penghargaan" text;
ALTER TABLE public."contests" ALTER COLUMN "kategori_penghargaan" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "kategori_penghargaan" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "piala_url" text;
ALTER TABLE public."contests" ALTER COLUMN "piala_url" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "piala_url" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "catatan" text;
ALTER TABLE public."contests" ALTER COLUMN "catatan" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "catatan" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "nama_lomba" text;
ALTER TABLE public."contests" ALTER COLUMN "nama_lomba" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "nama_lomba" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "penyelenggara" text;
ALTER TABLE public."contests" ALTER COLUMN "penyelenggara" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "penyelenggara" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "tingkat" text;
ALTER TABLE public."contests" ALTER COLUMN "tingkat" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "tingkat" SET NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "deadline" date;
ALTER TABLE public."contests" ALTER COLUMN "deadline" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "deadline" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "status_public" text;
ALTER TABLE public."contests" ALTER COLUMN "status_public" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "status_public" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "website_url" text;
ALTER TABLE public."contests" ALTER COLUMN "website_url" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "website_url" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "deskripsi" text;
ALTER TABLE public."contests" ALTER COLUMN "deskripsi" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "deskripsi" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "planned_work_count" integer;
ALTER TABLE public."contests" ALTER COLUMN "planned_work_count" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "planned_work_count" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "academic_year" text;
ALTER TABLE public."contests" ALTER COLUMN "academic_year" SET DEFAULT to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text);
ALTER TABLE public."contests" ALTER COLUMN "academic_year" SET NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "kota" text;
ALTER TABLE public."contests" ALTER COLUMN "kota" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "kota" DROP NOT NULL;
ALTER TABLE public."contests" ADD COLUMN IF NOT EXISTS "tahun_event" integer;
ALTER TABLE public."contests" ALTER COLUMN "tahun_event" DROP DEFAULT;
ALTER TABLE public."contests" ALTER COLUMN "tahun_event" DROP NOT NULL;
ALTER TABLE public."contests" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."debt_records" ();
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."debt_records" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "amount" integer;
ALTER TABLE public."debt_records" ALTER COLUMN "amount" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "amount" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."debt_records" ALTER COLUMN "status" SET DEFAULT 'unpaid'::text;
ALTER TABLE public."debt_records" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "source_transaction_id" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "source_transaction_id" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "source_transaction_id" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "settled_transaction_id" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "settled_transaction_id" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "settled_transaction_id" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."debt_records" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."debt_records" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "keterangan" text;
ALTER TABLE public."debt_records" ALTER COLUMN "keterangan" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "keterangan" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "periode" text;
ALTER TABLE public."debt_records" ALTER COLUMN "periode" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "periode" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."debt_records" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."debt_records" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."debt_records" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."debt_records" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."debt_records" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."debt_records" ALTER COLUMN "paid_at" DROP DEFAULT;
ALTER TABLE public."debt_records" ALTER COLUMN "paid_at" DROP NOT NULL;
ALTER TABLE public."debt_records" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment" ();
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "nama_alat" text;
ALTER TABLE public."equipment" ALTER COLUMN "nama_alat" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "nama_alat" SET NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "kode_qr" text;
ALTER TABLE public."equipment" ALTER COLUMN "kode_qr" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "kode_qr" SET NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "physical_condition" physical_condition;
ALTER TABLE public."equipment" ALTER COLUMN "physical_condition" SET DEFAULT 'bagus'::physical_condition;
ALTER TABLE public."equipment" ALTER COLUMN "physical_condition" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "availability_status" availability_status;
ALTER TABLE public."equipment" ALTER COLUMN "availability_status" SET DEFAULT 'tersedia'::availability_status;
ALTER TABLE public."equipment" ALTER COLUMN "availability_status" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "fotos" text[];
ALTER TABLE public."equipment" ALTER COLUMN "fotos" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "fotos" SET NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "kode_alat" text;
ALTER TABLE public."equipment" ALTER COLUMN "kode_alat" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "kode_alat" SET NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "kategori" text;
ALTER TABLE public."equipment" ALTER COLUMN "kategori" SET DEFAULT 'Lainnya'::text;
ALTER TABLE public."equipment" ALTER COLUMN "kategori" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "kondisi" text;
ALTER TABLE public."equipment" ALTER COLUMN "kondisi" SET DEFAULT 'bagus'::text;
ALTER TABLE public."equipment" ALTER COLUMN "kondisi" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."equipment" ALTER COLUMN "status" SET DEFAULT 'tersedia'::text;
ALTER TABLE public."equipment" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "lokasi_penyimpanan" text;
ALTER TABLE public."equipment" ALTER COLUMN "lokasi_penyimpanan" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "lokasi_penyimpanan" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "serial_number" text;
ALTER TABLE public."equipment" ALTER COLUMN "serial_number" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "serial_number" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "foto_url" text;
ALTER TABLE public."equipment" ALTER COLUMN "foto_url" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "foto_url" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "deskripsi" text;
ALTER TABLE public."equipment" ALTER COLUMN "deskripsi" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "deskripsi" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."equipment" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."equipment" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."equipment" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."equipment" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "catatan_kerusakan" text;
ALTER TABLE public."equipment" ALTER COLUMN "catatan_kerusakan" DROP DEFAULT;
ALTER TABLE public."equipment" ALTER COLUMN "catatan_kerusakan" DROP NOT NULL;
ALTER TABLE public."equipment" ADD COLUMN IF NOT EXISTS "asset_state" text;
ALTER TABLE public."equipment" ALTER COLUMN "asset_state" SET DEFAULT 'active'::text;
ALTER TABLE public."equipment" ALTER COLUMN "asset_state" SET NOT NULL;
ALTER TABLE public."equipment" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment_charge_payments" ();
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "settlement_id" uuid;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "settlement_id" DROP DEFAULT;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "settlement_id" SET NOT NULL;
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "amount" numeric(14,2);
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "amount" DROP DEFAULT;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "amount" SET NOT NULL;
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "recorded_by" uuid;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "recorded_by" DROP DEFAULT;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "recorded_by" SET NOT NULL;
ALTER TABLE public."equipment_charge_payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment_charge_payments" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."equipment_charge_payments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment_charge_settlements" ();
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "assessment_item_id" uuid;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "assessment_item_id" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "assessment_item_id" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "borrowing_id" uuid;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "borrowing_id" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "borrowing_id" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "amount" numeric(14,2);
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "amount" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "amount" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(14,2);
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "paid_amount" SET DEFAULT 0;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "paid_amount" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "status" SET DEFAULT 'unpaid'::text;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "recorded_by" uuid;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "recorded_by" DROP DEFAULT;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "recorded_by" DROP NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."equipment_charge_settlements" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."equipment_charge_settlements" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment_evidence" ();
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment_evidence" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "settlement_id" uuid;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "settlement_id" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "settlement_id" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "payment_id" uuid;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "payment_id" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "payment_id" DROP NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "evidence_type" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "evidence_type" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "evidence_type" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "object_key" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "object_key" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "object_key" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "storage_provider" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "storage_provider" SET DEFAULT 'r2'::text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "storage_provider" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "mime_type" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "file_size_bytes" integer;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "file_size_bytes" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "file_size_bytes" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "original_filename" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "original_filename" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "upload_status" text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::text;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "upload_status" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "created_by" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment_evidence" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."equipment_evidence" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."equipment_evidence" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."equipment_evidence" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment_recovery_cases" ();
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "equipment_id" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "equipment_id" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "equipment_id" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "assessment_item_id" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "assessment_item_id" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "assessment_item_id" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "recovery_type" text;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "recovery_type" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "recovery_type" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "status" SET DEFAULT 'open'::text;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "reported_condition" text;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "reported_condition" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "reported_condition" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "inspection_photos" jsonb;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "inspection_photos" SET DEFAULT '[]'::jsonb;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "inspection_photos" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(14,2);
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "estimated_cost" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "estimated_cost" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "actual_cost" numeric(14,2);
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "actual_cost" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "actual_cost" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "inspection_passed" boolean;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "inspection_passed" SET DEFAULT false;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "inspection_passed" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "replacement_equipment_id" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "replacement_equipment_id" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "replacement_equipment_id" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "opened_by" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "opened_by" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "opened_by" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "verified_by" uuid;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "verified_by" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "verified_by" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "completed_at" DROP DEFAULT;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "completed_at" DROP NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."equipment_recovery_cases" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."equipment_recovery_cases" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."equipment_valuations" ();
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."equipment_valuations" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "equipment_id" uuid;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "equipment_id" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "equipment_id" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "replacement_value" numeric(14,2);
ALTER TABLE public."equipment_valuations" ALTER COLUMN "replacement_value" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "replacement_value" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "currency" character(3);
ALTER TABLE public."equipment_valuations" ALTER COLUMN "currency" SET DEFAULT 'IDR'::bpchar;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "effective_at" timestamp with time zone;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "effective_at" SET DEFAULT now();
ALTER TABLE public."equipment_valuations" ALTER COLUMN "effective_at" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "source_url" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "source_url" DROP NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "change_reason" text;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "change_reason" DROP DEFAULT;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "change_reason" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."equipment_valuations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."equipment_valuations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."equipment_valuations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."film_crew" ();
ALTER TABLE public."film_crew" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."film_crew" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."film_crew" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."film_crew" ADD COLUMN IF NOT EXISTS "film_id" uuid;
ALTER TABLE public."film_crew" ALTER COLUMN "film_id" DROP DEFAULT;
ALTER TABLE public."film_crew" ALTER COLUMN "film_id" SET NOT NULL;
ALTER TABLE public."film_crew" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."film_crew" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."film_crew" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."film_crew" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE public."film_crew" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE public."film_crew" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE public."film_crew" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."film_works" ();
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."film_works" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."film_works" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "judul" text;
ALTER TABLE public."film_works" ALTER COLUMN "judul" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "judul" SET NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "durasi_menit" numeric(5,1);
ALTER TABLE public."film_works" ALTER COLUMN "durasi_menit" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "durasi_menit" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "genre" text;
ALTER TABLE public."film_works" ALTER COLUMN "genre" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "genre" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "sinopsis" text;
ALTER TABLE public."film_works" ALTER COLUMN "sinopsis" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "sinopsis" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "tahun_produksi" integer;
ALTER TABLE public."film_works" ALTER COLUMN "tahun_produksi" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "tahun_produksi" SET NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE public."film_works" ALTER COLUMN "thumbnail_url" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "thumbnail_url" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."film_works" ALTER COLUMN "video_url" DROP DEFAULT;
ALTER TABLE public."film_works" ALTER COLUMN "video_url" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."film_works" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."film_works" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE public."film_works" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."film_works" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."film_works" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."film_works" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."grade_report_periods" ();
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."grade_report_periods" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "academic_year" text;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "academic_year" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "academic_year" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "semester" text;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "semester" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "semester" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "start_date" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "start_date" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "end_date" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "end_date" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "approved_by" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "approved_by" DROP NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "approved_at" DROP DEFAULT;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "approved_at" DROP NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."grade_report_periods" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."grade_report_periods" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."grade_report_periods" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."grade_report_periods" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."grade_reports" ();
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."grade_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."grade_reports" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "period_id" uuid;
ALTER TABLE public."grade_reports" ALTER COLUMN "period_id" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "period_id" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."grade_reports" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "predikat" grade_value;
ALTER TABLE public."grade_reports" ALTER COLUMN "predikat" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "predikat" DROP NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."grade_reports" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."grade_reports" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "deskripsi" text;
ALTER TABLE public."grade_reports" ALTER COLUMN "deskripsi" SET DEFAULT ''::text;
ALTER TABLE public."grade_reports" ALTER COLUMN "deskripsi" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "evidence_count" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "evidence_count" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "evidence_count" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "hadir_count" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "hadir_count" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "hadir_count" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "sakit_count" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "sakit_count" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "sakit_count" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "izin_count" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "izin_count" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "izin_count" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "alpha_count" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "alpha_count" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "alpha_count" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "pkl_days" integer;
ALTER TABLE public."grade_reports" ALTER COLUMN "pkl_days" SET DEFAULT 0;
ALTER TABLE public."grade_reports" ALTER COLUMN "pkl_days" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "attendance_percentage" numeric(5,2);
ALTER TABLE public."grade_reports" ALTER COLUMN "attendance_percentage" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "attendance_percentage" DROP NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "generated_at" timestamp with time zone;
ALTER TABLE public."grade_reports" ALTER COLUMN "generated_at" SET DEFAULT now();
ALTER TABLE public."grade_reports" ALTER COLUMN "generated_at" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
ALTER TABLE public."grade_reports" ALTER COLUMN "approved_by" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "approved_by" DROP NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
ALTER TABLE public."grade_reports" ALTER COLUMN "approved_at" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "approved_at" DROP NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."grade_reports" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."grade_reports" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."grade_reports" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."grade_reports" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."grade_reports" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."grade_reports" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."grade_reports" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."grade_reports" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."grades" ();
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."grades" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."grades" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."grades" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "assignment_id" uuid;
ALTER TABLE public."grades" ALTER COLUMN "assignment_id" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "assignment_id" SET NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "nilai" grade_value;
ALTER TABLE public."grades" ALTER COLUMN "nilai" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "nilai" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."grades" ALTER COLUMN "status" SET DEFAULT 'ungraded'::text;
ALTER TABLE public."grades" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "keterangan" text;
ALTER TABLE public."grades" ALTER COLUMN "keterangan" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "keterangan" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "graded_by" uuid;
ALTER TABLE public."grades" ALTER COLUMN "graded_by" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "graded_by" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."grades" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."grades" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."grades" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."grades" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."grades" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."grades" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."grades" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."grades" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."grades" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."media_works" ();
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."media_works" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."media_works" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."media_works" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "work_type_code" text;
ALTER TABLE public."media_works" ALTER COLUMN "work_type_code" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "work_type_code" SET NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."media_works" ALTER COLUMN "description" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "duration_minutes" numeric(6,2);
ALTER TABLE public."media_works" ALTER COLUMN "duration_minutes" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "duration_minutes" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "production_year" integer;
ALTER TABLE public."media_works" ALTER COLUMN "production_year" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "production_year" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "primary_asset_url" text;
ALTER TABLE public."media_works" ALTER COLUMN "primary_asset_url" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "primary_asset_url" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."media_works" ALTER COLUMN "video_url" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "video_url" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."media_works" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."media_works" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."media_works" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."media_works" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."media_works" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."media_works" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."media_works" ADD COLUMN IF NOT EXISTS "legacy_submission_id" uuid;
ALTER TABLE public."media_works" ALTER COLUMN "legacy_submission_id" DROP DEFAULT;
ALTER TABLE public."media_works" ALTER COLUMN "legacy_submission_id" DROP NOT NULL;
ALTER TABLE public."media_works" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."notifications" ();
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."notifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."notifications" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."notifications" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."notifications" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."notifications" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE public."notifications" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE public."notifications" ALTER COLUMN "message" SET DEFAULT ''::text;
ALTER TABLE public."notifications" ALTER COLUMN "message" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "is_read" boolean;
ALTER TABLE public."notifications" ALTER COLUMN "is_read" SET DEFAULT false;
ALTER TABLE public."notifications" ALTER COLUMN "is_read" DROP NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE public."notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE public."notifications" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."notifications" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."notifications" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE public."notifications" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE public."notifications" ALTER COLUMN "metadata" SET NOT NULL;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public."notifications" ALTER COLUMN "body" SET DEFAULT ''::text;
ALTER TABLE public."notifications" ALTER COLUMN "body" SET NOT NULL;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."offline_sync_queue" ();
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "action" SET NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "payload" jsonb;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "payload" DROP DEFAULT;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "payload" SET NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "error_message" DROP DEFAULT;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "error_message" DROP NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."offline_sync_queue" ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "processed_at" DROP DEFAULT;
ALTER TABLE public."offline_sync_queue" ALTER COLUMN "processed_at" DROP NOT NULL;
ALTER TABLE public."offline_sync_queue" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."password_reset_operations" ();
ALTER TABLE public."password_reset_operations" ADD COLUMN IF NOT EXISTS "operation_key" text;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "operation_key" DROP DEFAULT;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "operation_key" SET NOT NULL;
ALTER TABLE public."password_reset_operations" ADD COLUMN IF NOT EXISTS "target_user_id" uuid;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "target_user_id" DROP DEFAULT;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "target_user_id" SET NOT NULL;
ALTER TABLE public."password_reset_operations" ADD COLUMN IF NOT EXISTS "actor_user_id" uuid;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "actor_user_id" DROP DEFAULT;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "actor_user_id" SET NOT NULL;
ALTER TABLE public."password_reset_operations" ADD COLUMN IF NOT EXISTS "resulting_auth_version" integer;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "resulting_auth_version" DROP DEFAULT;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "resulting_auth_version" SET NOT NULL;
ALTER TABLE public."password_reset_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."password_reset_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."password_reset_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."password_reset_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."push_subscriptions" ();
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."push_subscriptions" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "endpoint" DROP DEFAULT;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "endpoint" SET NOT NULL;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" text;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "p256dh" DROP DEFAULT;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "p256dh" SET NOT NULL;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" text;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "auth" DROP DEFAULT;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "auth" SET NOT NULL;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."push_subscriptions" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."schema_migrations" ();
ALTER TABLE public."schema_migrations" ADD COLUMN IF NOT EXISTS "migration_name" text;
ALTER TABLE public."schema_migrations" ALTER COLUMN "migration_name" DROP DEFAULT;
ALTER TABLE public."schema_migrations" ALTER COLUMN "migration_name" SET NOT NULL;
ALTER TABLE public."schema_migrations" ADD COLUMN IF NOT EXISTS "checksum" text;
ALTER TABLE public."schema_migrations" ALTER COLUMN "checksum" DROP DEFAULT;
ALTER TABLE public."schema_migrations" ALTER COLUMN "checksum" SET NOT NULL;
ALTER TABLE public."schema_migrations" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone;
ALTER TABLE public."schema_migrations" ALTER COLUMN "applied_at" SET DEFAULT now();
ALTER TABLE public."schema_migrations" ALTER COLUMN "applied_at" SET NOT NULL;
ALTER TABLE public."schema_migrations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."social_account_snapshots" ();
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "social_account_id" uuid;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "social_account_id" DROP DEFAULT;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "social_account_id" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "as_of_date" date;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "as_of_date" DROP DEFAULT;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "as_of_date" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "audience_count" bigint;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "audience_count" DROP DEFAULT;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "audience_count" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."social_account_snapshots" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."social_account_snapshots" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."social_account_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."social_accounts" ();
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."social_accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."social_accounts" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "platform" text;
ALTER TABLE public."social_accounts" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "account_name" text;
ALTER TABLE public."social_accounts" ALTER COLUMN "account_name" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "account_name" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "account_url" text;
ALTER TABLE public."social_accounts" ALTER COLUMN "account_url" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "account_url" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."social_accounts" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."social_accounts" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "version" integer;
ALTER TABLE public."social_accounts" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE public."social_accounts" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."social_accounts" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "idempotency_key" DROP NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."social_accounts" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."social_accounts" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."social_accounts" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."social_accounts" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."social_accounts" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."social_accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."social_accounts" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."social_accounts" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."social_accounts" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."social_insight_periods" ();
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."social_insight_periods" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "social_account_id" uuid;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "social_account_id" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "social_account_id" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "period_start" date;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "period_start" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "period_start" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "period_end" date;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "period_end" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "period_end" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "views" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "views" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "views" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "reach" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "reach" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "reach" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "interactions" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "interactions" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "interactions" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "profile_visits" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "profile_visits" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "profile_visits" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "published_count" integer;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "published_count" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "published_count" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "notes" SET DEFAULT ''::text;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "notes" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "version" integer;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."social_insight_periods" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."social_insight_periods" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "archive_month" date;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "archive_month" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "archive_month" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "likes" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "likes" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "likes" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "comments" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "comments" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "comments" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "shares" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "shares" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "shares" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "saves" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "saves" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "saves" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "watch_time_minutes" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "watch_time_minutes" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "watch_time_minutes" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "subscribers_gained" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "subscribers_gained" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "subscribers_gained" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "subscribers_lost" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "subscribers_lost" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "subscribers_lost" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "impressions" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "impressions" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "impressions" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "followers_gained" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "followers_gained" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "followers_gained" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "followers_lost" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "followers_lost" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "followers_lost" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "reactions" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "reactions" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "reactions" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ADD COLUMN IF NOT EXISTS "poll_votes" bigint;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "poll_votes" DROP DEFAULT;
ALTER TABLE public."social_insight_periods" ALTER COLUMN "poll_votes" DROP NOT NULL;
ALTER TABLE public."social_insight_periods" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."social_media_evidence" ();
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."social_media_evidence" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "publication_id" uuid;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "publication_id" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "publication_id" DROP NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "insight_period_id" uuid;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "insight_period_id" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "insight_period_id" DROP NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "object_key" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "object_key" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "object_key" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "storage_provider" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "storage_provider" SET DEFAULT 'r2'::text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "storage_provider" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "mime_type" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "mime_type" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "file_size_bytes" bigint;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "file_size_bytes" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "file_size_bytes" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "original_filename" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "original_filename" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "upload_status" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "upload_status" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."social_media_evidence" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."social_media_evidence" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."social_media_evidence" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "expires_at" DROP DEFAULT;
ALTER TABLE public."social_media_evidence" ALTER COLUMN "expires_at" DROP NOT NULL;
ALTER TABLE public."social_media_evidence" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."social_publications" ();
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."social_publications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."social_publications" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "social_account_id" uuid;
ALTER TABLE public."social_publications" ALTER COLUMN "social_account_id" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "social_account_id" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "platform" text;
ALTER TABLE public."social_publications" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "content_type" text;
ALTER TABLE public."social_publications" ALTER COLUMN "content_type" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "content_type" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "caption" text;
ALTER TABLE public."social_publications" ALTER COLUMN "caption" SET DEFAULT ''::text;
ALTER TABLE public."social_publications" ALTER COLUMN "caption" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "published_at" date;
ALTER TABLE public."social_publications" ALTER COLUMN "published_at" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "published_at" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "platform_url" text;
ALTER TABLE public."social_publications" ALTER COLUMN "platform_url" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "platform_url" DROP NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "agenda_activity_id" uuid;
ALTER TABLE public."social_publications" ALTER COLUMN "agenda_activity_id" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "agenda_activity_id" DROP NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."social_publications" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
ALTER TABLE public."social_publications" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "version" integer;
ALTER TABLE public."social_publications" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE public."social_publications" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE public."social_publications" ALTER COLUMN "idempotency_key" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."social_publications" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."social_publications" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."social_publications" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."social_publications" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."social_publications" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."social_publications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."social_publications" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."social_publications" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."social_publications" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."student_account_operations" ();
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."student_account_operations" ALTER COLUMN "actor_id" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "actor_id" SET NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "operation_key" uuid;
ALTER TABLE public."student_account_operations" ALTER COLUMN "operation_key" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "operation_key" SET NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "operation_type" text;
ALTER TABLE public."student_account_operations" ALTER COLUMN "operation_type" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "operation_type" SET NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "request_fingerprint" text;
ALTER TABLE public."student_account_operations" ALTER COLUMN "request_fingerprint" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "request_fingerprint" SET NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."student_account_operations" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."student_account_operations" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."student_account_operations" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE public."student_account_operations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."student_account_operations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."student_account_operations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."student_account_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."student_pkl_periods" ();
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "student_id" uuid;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "student_id" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "student_id" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "start_date" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "start_date" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "end_date" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "end_date" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "institution" text;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "institution" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "institution" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "notes" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "notes" DROP NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "requested_by" uuid;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "requested_by" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "requested_by" DROP NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "reviewed_by" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "reviewed_by" DROP NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "reviewed_at" DROP DEFAULT;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "reviewed_at" DROP NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."student_pkl_periods" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE public."student_pkl_periods" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."students" ();
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."students" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."students" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."students" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "nis" text;
ALTER TABLE public."students" ALTER COLUMN "nis" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "nis" SET NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "nama" text;
ALTER TABLE public."students" ALTER COLUMN "nama" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "nama" SET NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "kelas" text;
ALTER TABLE public."students" ALTER COLUMN "kelas" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "kelas" SET NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "peminatan" text;
ALTER TABLE public."students" ALTER COLUMN "peminatan" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "peminatan" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "no_telepon" text;
ALTER TABLE public."students" ALTER COLUMN "no_telepon" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "no_telepon" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "foto_url" text;
ALTER TABLE public."students" ALTER COLUMN "foto_url" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "foto_url" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."students" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."students" ALTER COLUMN "is_active" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."students" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."students" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "class_id" uuid;
ALTER TABLE public."students" ALTER COLUMN "class_id" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "class_id" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."students" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."students" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."students" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."students" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."students" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."students" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."students" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."users" ();
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."users" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE public."users" ALTER COLUMN "username" DROP DEFAULT;
ALTER TABLE public."users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE public."users" ALTER COLUMN "password_hash" DROP DEFAULT;
ALTER TABLE public."users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "nama" text;
ALTER TABLE public."users" ALTER COLUMN "nama" DROP DEFAULT;
ALTER TABLE public."users" ALTER COLUMN "nama" SET NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "role" user_role;
ALTER TABLE public."users" ALTER COLUMN "role" SET DEFAULT 'member'::user_role;
ALTER TABLE public."users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "is_first_login" boolean;
ALTER TABLE public."users" ALTER COLUMN "is_first_login" SET DEFAULT true;
ALTER TABLE public."users" ALTER COLUMN "is_first_login" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."users" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."users" ALTER COLUMN "is_active" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."users" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."users" ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."users" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE public."users" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."users" ALTER COLUMN "created_by" DROP DEFAULT;
ALTER TABLE public."users" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public."users" ALTER COLUMN "updated_by" DROP DEFAULT;
ALTER TABLE public."users" ALTER COLUMN "updated_by" DROP NOT NULL;
ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "auth_version" integer;
ALTER TABLE public."users" ALTER COLUMN "auth_version" SET DEFAULT 1;
ALTER TABLE public."users" ALTER COLUMN "auth_version" SET NOT NULL;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public."work_types" ();
ALTER TABLE public."work_types" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE public."work_types" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE public."work_types" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE public."work_types" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public."work_types" ALTER COLUMN "label" DROP DEFAULT;
ALTER TABLE public."work_types" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE public."work_types" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE public."work_types" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE public."work_types" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE public."work_types" ADD COLUMN IF NOT EXISTS "sort_order" integer;
ALTER TABLE public."work_types" ALTER COLUMN "sort_order" SET DEFAULT 0;
ALTER TABLE public."work_types" ALTER COLUMN "sort_order" SET NOT NULL;
ALTER TABLE public."work_types" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public."work_types" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE public."work_types" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE public."work_types" ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.approve_borrowing_atomic(p_borrowing_id uuid, p_action text, p_catatan text, p_approved_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_next_status TEXT;
BEGIN
  -- Sinkronkan konteks dengan trigger Zero Silent Edits pada database lama.
  PERFORM set_config('app.current_user_id', COALESCE(p_approved_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan keputusan minimal 5 karakter.';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Aksi persetujuan tidak valid.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Pengajuan peminjaman tidak ditemukan.';
  END IF;
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan ini sudah diproses sebelumnya.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id) THEN
    RAISE EXCEPTION 'Detail alat belum tersedia pada pengajuan ini. Rekonsiliasi data lama terlebih dahulu.';
  END IF;

  v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  IF p_action = 'approve' AND EXISTS (
    SELECT 1
    FROM public.borrowing_items bi
    JOIN public.equipment e ON e.id = bi.equipment_id
    WHERE bi.borrowing_id = p_borrowing_id
      AND (bi.status <> 'pending' OR COALESCE(e.status, e.availability_status::TEXT) <> 'tersedia')
  ) THEN
    RAISE EXCEPTION 'Salah satu alat sudah tidak tersedia. Pengajuan tidak dapat disetujui.';
  END IF;

  UPDATE public.borrowings
  SET status = v_next_status,
      approved_by = p_approved_by,
      catatan_persetujuan = NULLIF(trim(p_catatan), ''),
      updated_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_borrowing_id;

  UPDATE public.borrowing_items
  SET status = v_next_status,
      updated_by = p_approved_by,
      updated_at = NOW()
  WHERE borrowing_id = p_borrowing_id;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values, change_reason
  ) VALUES (
    p_approved_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_next_status, 'catatan', p_catatan),
    trim(p_change_reason)
  );

  RETURN p_borrowing_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.archive_agenda_activity_atomic(p_activity_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.agenda_activities;
  v_updated public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_ARCHIVE_INPUT_INVALID';
  END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'archive', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'archive' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_current FROM public.agenda_activities WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_current.archived_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  UPDATE public.agenda_activities SET archived_at = NOW(), archived_by = p_actor_id, updated_at = NOW(), updated_by = p_actor_id, version = version + 1
  WHERE id = p_activity_id RETURNING * INTO v_updated;
  PERFORM public.write_audit_log(p_actor_id, 'UPDATE', 'agenda_activities', p_activity_id, public.redact_audit_json(to_jsonb(v_current)), public.redact_audit_json(to_jsonb(v_updated)), left(btrim(p_change_reason), 500), p_request_id, p_operation_id, 'api', p_user_agent, jsonb_build_object('audit_scope', 'agenda_activity_archive'));
  v_response := jsonb_build_object('activity', to_jsonb(v_updated), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.attach_agenda_photo_atomic(p_activity_id uuid, p_photo_id uuid, p_actor_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_photo public.agenda_activity_photos;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_photo_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INPUT_INVALID'; END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'photo_attach', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'photo_attach' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_photo FROM public.agenda_activity_photos WHERE id = p_photo_id AND activity_id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_photo.upload_status <> 'pending' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INVALID'; END IF;
  UPDATE public.agenda_activity_photos SET upload_status = 'abandoned', updated_at = NOW()
  WHERE activity_id = p_activity_id AND upload_status = 'attached';
  UPDATE public.agenda_activity_photos SET upload_status = 'attached', expires_at = NULL, updated_at = NOW() WHERE id = p_photo_id RETURNING * INTO v_photo;
  v_response := jsonb_build_object('photo', to_jsonb(v_photo), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.audit_cash_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor UUID;
  v_reason TEXT;
  v_system_operation BOOLEAN;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  v_reason := NULLIF(current_setting('app.change_reason', TRUE), '');
  v_system_operation := COALESCE(NULLIF(current_setting('app.system_operation', TRUE), '') = 'true', FALSE);

  IF v_reason IS NULL OR (v_actor IS NULL AND NOT v_system_operation) THEN
    RAISE EXCEPTION 'Aksi Ditolak: ID aktor dan alasan perubahan wajib tersedia.';
  END IF;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    change_reason
  ) VALUES (
    v_actor,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    LEFT(v_reason, 500)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.audit_changed_fields(p_old_values jsonb, p_new_values jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(p_old_values, '{}'::JSONB)) <> 'object'
      OR jsonb_typeof(COALESCE(p_new_values, '{}'::JSONB)) <> 'object'
    THEN ARRAY[]::TEXT[]
    ELSE COALESCE((
      SELECT array_agg(key ORDER BY key)
      FROM jsonb_object_keys(
        COALESCE(p_old_values, '{}'::JSONB) || COALESCE(p_new_values, '{}'::JSONB)
      ) AS key
      WHERE (COALESCE(p_old_values, '{}'::JSONB)->key)
        IS DISTINCT FROM (COALESCE(p_new_values, '{}'::JSONB)->key)
    ), ARRAY[]::TEXT[])
  END;
$function$;
CREATE OR REPLACE FUNCTION public.block_borrowing_approval_with_unpaid_charge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1 FROM public.equipment_charge_settlements ecs
    WHERE ecs.student_id = NEW.student_id AND ecs.status IN ('unpaid', 'partial')
  ) THEN
    RAISE EXCEPTION 'STUDENT_HAS_OUTSTANDING_EQUIPMENT_CHARGE';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.change_password_atomic(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_expected_auth_version integer)
 RETURNS TABLE(id uuid, nama text, is_active boolean, is_first_login boolean, auth_version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current public.users;
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL OR p_user_id <> p_updated_by THEN
    RAISE EXCEPTION 'Aktor perubahan password tidak valid.';
  END IF;

  IF COALESCE(length(trim(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Hash password tidak valid.';
  END IF;

  IF p_expected_auth_version IS NULL THEN
    RAISE EXCEPTION 'Versi sesi keamanan belum tersedia. Jalankan migration 021 terlebih dahulu.';
  END IF;

  SELECT *
  INTO v_current
  FROM public.users
  WHERE users.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_current.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Akun tidak ditemukan atau tidak aktif.';
  END IF;

  IF v_current.auth_version IS DISTINCT FROM p_expected_auth_version THEN
    RAISE EXCEPTION 'Sesi keamanan berubah. Silakan login kembali.';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  UPDATE public.users
  SET password_hash = p_password_hash,
      is_first_login = FALSE,
      updated_by = p_updated_by,
      updated_at = NOW(),
      auth_version = v_current.auth_version + 1
  WHERE users.id = p_user_id;

  -- Never persist the password hash. The rotated auth version is enough for
  -- an audit reader to prove that the credential state changed.
  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object('auth_version', v_current.auth_version),
    jsonb_build_object(
      'operation', 'change_password',
      'auth_version', v_current.auth_version + 1
    ),
    left(trim(p_change_reason), 500),
    NULL,
    NULL,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'credential_rotation')
  );

  RETURN QUERY
  SELECT users.id, users.nama, users.is_active, users.is_first_login, users.auth_version
  FROM public.users
  WHERE users.id = p_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(p_rate_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.api_login_rate_limits
  WHERE rate_key = p_rate_key;
END;
$function$;
CREATE OR REPLACE FUNCTION public.complete_equipment_repair_atomic(p_case_id uuid, p_inspection_photos jsonb, p_actual_cost numeric, p_notes text, p_inspection_passed boolean, p_verified_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipment_id UUID;
  v_type TEXT;
  v_status TEXT;
  v_photo_count INTEGER;
BEGIN
  IF p_case_id IS NULL OR p_verified_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;
  IF p_inspection_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'RECOVERY_INSPECTION_REQUIRED'; END IF;
  IF p_inspection_photos IS NULL OR jsonb_typeof(p_inspection_photos) <> 'array' THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_REQUIRED'; END IF;
  SELECT jsonb_array_length(p_inspection_photos) INTO v_photo_count;
  IF v_photo_count < 2 OR v_photo_count > 12 THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_inspection_photos) AS photo(value) WHERE value !~* '^(https?://[^[:space:]]+|data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$') THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_INVALID'; END IF;

  SELECT equipment_id, recovery_type, status INTO v_equipment_id, v_type, v_status
  FROM public.equipment_recovery_cases WHERE id = p_case_id FOR UPDATE;
  IF v_equipment_id IS NULL THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_FOUND'; END IF;
  IF v_type <> 'repair' THEN RAISE EXCEPTION 'RECOVERY_CASE_TYPE_INVALID'; END IF;
  IF v_status NOT IN ('open', 'in_progress', 'awaiting_verification') THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_OPEN'; END IF;

  UPDATE public.equipment_recovery_cases
  SET status = 'completed', inspection_photos = p_inspection_photos,
      actual_cost = NULLIF(p_actual_cost, 0), notes = COALESCE(NULLIF(trim(p_notes), ''), notes),
      inspection_passed = TRUE,
      verified_by = p_verified_by, completed_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;

  UPDATE public.equipment
  SET kondisi = 'bagus', physical_condition = 'bagus'::physical_condition,
      status = 'tersedia', availability_status = 'tersedia'::availability_status,
      asset_state = 'active', catatan_kerusakan = NULL, updated_at = NOW()
  WHERE id = v_equipment_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_verified_by, 'UPDATE', 'equipment_recovery_cases', p_case_id,
    jsonb_build_object('status', 'completed', 'equipment_id', v_equipment_id), trim(p_change_reason));
  RETURN v_equipment_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.consume_api_rate_limit_atomic(p_rate_key text, p_window_seconds integer, p_max_requests integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_started_at TIMESTAMPTZ;
  v_row public.api_rate_limit_windows%ROWTYPE;
BEGIN
  IF p_rate_key IS NULL OR p_rate_key !~ '^[a-f0-9]{64}$'
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400
    OR p_max_requests IS NULL OR p_max_requests NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'API_RATE_LIMIT_INVALID_INPUT';
  END IF;

  v_started_at := to_timestamp(floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.api_rate_limit_windows (
    rate_key, request_count, window_started_at, window_seconds, max_requests, updated_at
  ) VALUES (
    p_rate_key, 1, v_started_at, p_window_seconds, p_max_requests, v_now
  )
  ON CONFLICT (rate_key) DO UPDATE
  SET request_count = CASE
        WHEN api_rate_limit_windows.window_started_at < EXCLUDED.window_started_at THEN 1
        ELSE LEAST(api_rate_limit_windows.request_count + 1, p_max_requests + 1)
      END,
      window_started_at = GREATEST(api_rate_limit_windows.window_started_at, EXCLUDED.window_started_at),
      updated_at = EXCLUDED.updated_at
  WHERE api_rate_limit_windows.window_seconds = EXCLUDED.window_seconds
    AND api_rate_limit_windows.max_requests = EXCLUDED.max_requests
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'API_RATE_LIMIT_POLICY_MISMATCH'; END IF;

  RETURN jsonb_build_object(
    'allowed', v_row.request_count <= p_max_requests,
    'limit', p_max_requests,
    'remaining', GREATEST(0, p_max_requests - v_row.request_count),
    'reset_at', v_row.window_started_at + make_interval(secs => p_window_seconds)
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.contest_legacy_level_from_scope(p_scope text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- Jabodetabek/Jawa Barat share the legacy provinsi bucket, while Umum and
  -- Nasional share the legacy nasional bucket. New API filters use tingkat.
  SELECT CASE lower(btrim(p_scope))
    WHEN 'bekasi' THEN 'kota'
    WHEN 'jabodetabek' THEN 'provinsi'
    WHEN 'jawa_barat' THEN 'provinsi'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'umum' THEN 'nasional'
    ELSE NULL
  END;
$function$;
CREATE OR REPLACE FUNCTION public.contest_scope_from_legacy(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- Legacy values have no exact equivalent for every new product scope.
  -- Keep the canonical tingkat column authoritative; level is only a
  -- compatibility projection for old reports and writers. The retired
  -- internasional value is retained under the broad Umum bucket because the
  -- new contract intentionally has no international scope option.
  SELECT CASE lower(btrim(p_value))
    WHEN 'bekasi' THEN 'bekasi'
    WHEN 'jabodetabek' THEN 'jabodetabek'
    WHEN 'jawa_barat' THEN 'jawa_barat'
    WHEN 'provinsi_jawa_barat' THEN 'jawa_barat'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'umum' THEN 'umum'
    WHEN 'lokal' THEN 'bekasi'
    WHEN 'kabupaten' THEN 'bekasi'
    WHEN 'kota' THEN 'bekasi'
    WHEN 'regional' THEN 'jawa_barat'
    WHEN 'provinsi' THEN 'jawa_barat'
    WHEN 'internasional' THEN 'umum'
    ELSE NULL
  END;
$function$;
CREATE OR REPLACE FUNCTION public.correct_attendance_atomic(p_attendance_id uuid, p_status text, p_keterangan text, p_actor_id uuid, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status TEXT := LOWER(NULLIF(BTRIM(COALESCE(p_status, '')), ''));
  v_note TEXT := NULLIF(BTRIM(COALESCE(p_keterangan, '')), '');
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_change_reason, '')), '');
  v_current public.attendance;
  v_result JSONB;
BEGIN
  IF p_attendance_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_IDENTITY_INVALID';
  END IF;

  IF v_status NOT IN ('hadir', 'sakit', 'izin', 'alpha') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_STATUS_INVALID';
  END IF;

  IF v_status <> 'hadir' AND v_note IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_NOTE_REQUIRED';
  END IF;

  IF v_note IS NOT NULL AND LENGTH(v_note) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_NOTE_TOO_LONG';
  END IF;

  IF v_reason IS NULL OR LENGTH(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_REASON_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ATTENDANCE_CORRECTION_ACTOR_INVALID';
  END IF;

  SELECT *
  INTO v_current
  FROM public.attendance
  WHERE id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ATTENDANCE_NOT_FOUND';
  END IF;

  -- trg_audit_attendance -> log_activity() reads both values in this same
  -- transaction. The settings are transaction-local and cannot be supplied
  -- safely by a separate HTTP request or a later audit insert.
  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(v_reason, 500), TRUE);

  UPDATE public.attendance
  SET status = v_status,
      keterangan = v_note,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE id = p_attendance_id;

  -- Keep the database representation private while returning the same nested
  -- student projection consumed by the existing backend mapper.
  SELECT jsonb_build_object(
    'id', a.id,
    'student_id', a.student_id,
    'tanggal', a.tanggal,
    'status', a.status,
    'keterangan', a.keterangan,
    'is_locked', a.is_locked,
    'idempotency_key', a.idempotency_key,
    'created_by', a.created_by,
    'created_at', a.created_at,
    'updated_by', a.updated_by,
    'updated_at', a.updated_at,
    'students', jsonb_build_object(
      'id', s.id,
      'nis', s.nis,
      'nama', s.nama,
      'kelas', s.kelas,
      'peminatan', s.peminatan
    )
  )
  INTO v_result
  FROM public.attendance AS a
  JOIN public.students AS s ON s.id = a.student_id
  WHERE a.id = p_attendance_id;

  RETURN v_result;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_agenda_activity_atomic(p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_actor_id uuid, p_idempotency_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_activity public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_actor_id IS NULL OR p_activity_date IS NULL OR p_activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_activity_name, ''))) NOT BETWEEN 2 AND 120
     OR length(btrim(COALESCE(p_activity_description, ''))) NOT BETWEEN 2 AND 2000
     OR (NULLIF(btrim(COALESCE(p_instructor_name, '')), '') IS NOT NULL AND length(btrim(p_instructor_name)) NOT BETWEEN 2 AND 120)
     OR cardinality(p_pic_names) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_INPUT_INVALID';
  END IF;

  INSERT INTO public.agenda_activity_operations (idempotency_key, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), 'create', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.operation_kind <> 'create' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  INSERT INTO public.agenda_activities (
    activity_date, activity_name, activity_description, instructor_name, pic_names, created_by, updated_by
  ) VALUES (
    p_activity_date, btrim(p_activity_name), btrim(p_activity_description), NULLIF(btrim(p_instructor_name), ''), p_pic_names, p_actor_id, p_actor_id
  ) RETURNING * INTO v_activity;

  PERFORM public.write_audit_log(
    p_actor_id, 'INSERT', 'agenda_activities', v_activity.id, NULL, public.redact_audit_json(to_jsonb(v_activity)),
    'Membuat agenda kegiatan', p_request_id, p_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'agenda_activity_create')
  );

  v_response := jsonb_build_object('activity', to_jsonb(v_activity), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET activity_id = v_activity.id, response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_borrowing_atomic(p_student_id uuid, p_equipment_ids uuid[], p_tanggal_pinjam date, p_rencana_kembali date, p_keperluan text, p_created_by uuid, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrowing_id UUID;
  v_equipment_count INTEGER;
  v_distinct_equipment_count INTEGER;
BEGIN
  -- Legacy audit trigger membutuhkan konteks actor dan alasan di session.
  PERFORM set_config('app.current_user_id', COALESCE(p_created_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', 'Pengajuan peminjaman alat dibuat.', TRUE);

  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
  END IF;

  IF p_equipment_ids IS NULL OR COALESCE(array_length(p_equipment_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Minimal satu alat harus dipilih.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT equipment_id)
  INTO v_equipment_count, v_distinct_equipment_count
  FROM unnest(p_equipment_ids) AS requested(equipment_id);

  IF v_equipment_count <> v_distinct_equipment_count THEN
    RAISE EXCEPTION 'Daftar alat tidak boleh berisi duplikasi.';
  END IF;

  IF p_tanggal_pinjam IS NULL OR p_rencana_kembali IS NULL OR p_rencana_kembali < p_tanggal_pinjam THEN
    RAISE EXCEPTION 'Tanggal pengembalian harus sama atau setelah tanggal peminjaman.';
  END IF;

  IF p_keperluan IS NULL OR length(trim(p_keperluan)) < 5 THEN
    RAISE EXCEPTION 'Keperluan peminjaman minimal 5 karakter.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    -- Serialisasi request retry dengan key yang sama sebelum pengecekan unique key.
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT id INTO v_borrowing_id
    FROM public.borrowings
    WHERE idempotency_key = p_idempotency_key;
    IF v_borrowing_id IS NOT NULL THEN
      RETURN v_borrowing_id;
    END IF;
  END IF;

  -- Lock semua alat lebih dulu agar dua request bersamaan tidak bisa sama-sama lolos.
  PERFORM 1
  FROM public.equipment
  WHERE id = ANY(p_equipment_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_equipment_count
  FROM public.equipment
  WHERE id = ANY(p_equipment_ids);
  IF v_equipment_count <> v_distinct_equipment_count THEN
    RAISE EXCEPTION 'Salah satu alat tidak ditemukan.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment
    WHERE id = ANY(p_equipment_ids)
      AND COALESCE(status, availability_status::TEXT) <> 'tersedia'
  ) THEN
    RAISE EXCEPTION 'Salah satu alat tidak sedang tersedia.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrowing_items
    WHERE equipment_id = ANY(p_equipment_ids)
      AND status IN ('pending', 'approved', 'borrowed')
  ) THEN
    RAISE EXCEPTION 'Salah satu alat sedang dipesan atau dipinjam pengguna lain.';
  END IF;

  INSERT INTO public.borrowings (
    student_id, status, tanggal_pinjam, rencana_kembali, due_at,
    keperluan, idempotency_key, created_by, created_at
  ) VALUES (
    p_student_id, 'pending', p_tanggal_pinjam, p_rencana_kembali,
    p_rencana_kembali::TIMESTAMPTZ, trim(p_keperluan), p_idempotency_key, p_created_by, NOW()
  )
  RETURNING id INTO v_borrowing_id;

  INSERT INTO public.borrowing_items (borrowing_id, equipment_id, status, kondisi_awal, created_by)
  SELECT v_borrowing_id, e.id, 'pending', e.kondisi, p_created_by
  FROM public.equipment e
  WHERE e.id = ANY(p_equipment_ids);

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, new_values, change_reason
  ) VALUES (
    p_created_by, 'INSERT', 'borrowings', v_borrowing_id,
    jsonb_build_object('student_id', p_student_id, 'equipment_ids', to_jsonb(p_equipment_ids), 'status', 'pending'),
    'Pengajuan peminjaman alat dibuat.'
  );

  RETURN v_borrowing_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_cash_dispute_atomic(p_student_id uuid, p_transaction_id uuid, p_debt_record_id uuid, p_reason text, p_evidence_value text, p_actor_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period DATE := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_existing public.cash_disputes;
  v_created public.cash_disputes;
  v_previous_id UUID;
  v_attempt SMALLINT;
  v_used INTEGER;
  v_target_student_id UUID;
  v_transaction_type TEXT;
  v_debt_status TEXT;
BEGIN
  IF p_student_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_IDENTITY_INVALID';
  END IF;
  IF (p_transaction_id IS NULL) = (p_debt_record_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_INVALID';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REASON_INVALID';
  END IF;
  IF length(trim(COALESCE(p_evidence_value, ''))) NOT BETWEEN 1 AND 900000
    OR trim(p_evidence_value) !~* '^(data:image/|https?://)' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_EVIDENCE_INVALID';
  END IF;
  IF length(trim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_KEY_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ACTOR_INVALID';
  END IF;

  IF p_transaction_id IS NOT NULL THEN
    SELECT student_id, type::TEXT
    INTO v_target_student_id, v_transaction_type
    FROM public.cash_transactions
    WHERE id = p_transaction_id;
    IF NOT FOUND OR v_transaction_type NOT IN ('iuran_wajib', 'pemasukan') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_NOT_FOUND';
    END IF;
  ELSE
    SELECT student_id, status::TEXT
    INTO v_target_student_id, v_debt_status
    FROM public.debt_records
    WHERE id = p_debt_record_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_NOT_FOUND';
    END IF;
    IF v_debt_status <> 'unpaid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_SETTLED';
    END IF;
  END IF;

  IF v_target_student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_FORBIDDEN';
  END IF;

  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.transaction_id IS DISTINCT FROM p_transaction_id
      OR v_existing.debt_record_id IS DISTINCT FROM p_debt_record_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object(
      'dispute', (to_jsonb(v_existing) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
      'quota', public.get_cash_dispute_quota(p_student_id),
      'idempotent_replay', TRUE
    );
  END IF;

  -- Serialize quota counting and insertion for the student/month without
  -- preventing submissions for different ledger targets.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('cash-dispute:' || p_student_id::TEXT || ':' || v_period::TEXT, 0)
  );

  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'dispute', (to_jsonb(v_existing) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
      'quota', public.get_cash_dispute_quota(p_student_id),
      'idempotent_replay', TRUE
    );
  END IF;

  -- The active-target check is intentionally scoped to this exact target.
  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE (
    (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id)
    OR (p_debt_record_id IS NOT NULL AND debt_record_id = p_debt_record_id)
  )
    AND status IN ('pending', 'approved')
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = CASE WHEN v_existing.status = 'pending' THEN 'DISPUTE_PENDING' ELSE 'DISPUTE_ALREADY_APPROVED' END;
  END IF;

  SELECT count(*)::INTEGER
  INTO v_used
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND quota_period_start = v_period;
  IF v_used >= 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DISPUTE_MONTHLY_QUOTA_EXHAUSTED',
      DETAIL = public.get_cash_dispute_quota(p_student_id)::TEXT;
  END IF;

  SELECT id, (attempt_number + 1)::SMALLINT
  INTO v_previous_id, v_attempt
  FROM public.cash_disputes
  WHERE (
    (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id)
    OR (p_debt_record_id IS NOT NULL AND debt_record_id = p_debt_record_id)
  )
  ORDER BY attempt_number DESC, created_at DESC, id DESC
  LIMIT 1;
  v_attempt := COALESCE(v_attempt, 1);

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', 'Pengajuan sanggahan kas', TRUE);

  INSERT INTO public.cash_disputes (
    transaction_id, debt_record_id, student_id, reason, alasan_sanggahan,
    bukti_sanggahan_url, status, quota_period_start, attempt_number,
    previous_dispute_id, idempotency_key, created_by, updated_by, updated_at
  ) VALUES (
    p_transaction_id, p_debt_record_id, p_student_id, trim(p_reason), trim(p_reason),
    trim(p_evidence_value), 'pending', v_period, v_attempt,
    v_previous_id, trim(p_idempotency_key), p_actor_id, p_actor_id, NOW()
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object(
    'dispute', (to_jsonb(v_created) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
    'quota', public.get_cash_dispute_quota(p_student_id),
    'idempotent_replay', FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_contest_entry_atomic(p_contest_id uuid, p_work_id uuid, p_title text, p_work_type_code text, p_description text, p_primary_asset_url text, p_video_url text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_work_id UUID := p_work_id;
  v_entry public.contest_entries;
BEGIN
  IF p_contest_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_IDENTITY_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ACTOR_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_NOT_FOUND';
  END IF;
  IF p_work_id IS NULL THEN
    IF length(trim(COALESCE(p_title, ''))) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_TITLE_INVALID';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.work_types WHERE code = p_work_type_code AND is_active = TRUE) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_TYPE_INVALID';
    END IF;
    INSERT INTO public.media_works (title, work_type_code, description, primary_asset_url, video_url, created_by, updated_by)
    VALUES (trim(p_title), p_work_type_code, NULLIF(trim(p_description), ''), NULLIF(trim(p_primary_asset_url), ''), NULLIF(trim(p_video_url), ''), p_actor_id, p_actor_id)
    RETURNING id INTO v_work_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.media_works WHERE id = p_work_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO public.contest_entries (contest_id, work_id, created_by, updated_by)
  VALUES (p_contest_id, v_work_id, p_actor_id, p_actor_id)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'work', (SELECT to_jsonb(mw) FROM public.media_works mw WHERE mw.id = v_work_id)
  );
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ALREADY_EXISTS';
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_equipment_charge_settlement_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrowing_id UUID;
  v_student_id UUID;
BEGIN
  IF NEW.charged_amount IS NULL OR NEW.charged_amount <= 0 THEN RETURN NEW; END IF;
  SELECT borrowing_id INTO v_borrowing_id FROM public.borrowing_return_assessments WHERE id = NEW.assessment_id;
  SELECT student_id INTO v_student_id FROM public.borrowings WHERE id = v_borrowing_id;
  IF v_borrowing_id IS NULL OR v_student_id IS NULL THEN RAISE EXCEPTION 'CHARGE_BORROWING_LINK_INVALID'; END IF;
  INSERT INTO public.equipment_charge_settlements (assessment_item_id, borrowing_id, student_id, amount)
  VALUES (NEW.id, v_borrowing_id, v_student_id, NEW.charged_amount)
  ON CONFLICT (assessment_item_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_equipment_recovery_case_atomic(p_equipment_id uuid, p_recovery_type text, p_assessment_item_id uuid, p_reported_condition text, p_notes text, p_opened_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case_id UUID;
  v_condition TEXT;
  v_status TEXT;
BEGIN
  IF p_equipment_id IS NULL OR p_opened_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_recovery_type NOT IN ('repair', 'replacement') THEN RAISE EXCEPTION 'RECOVERY_TYPE_INVALID'; END IF;
  IF p_reported_condition NOT IN ('sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN
    RAISE EXCEPTION 'RECOVERY_CONDITION_INVALID';
  END IF;
  IF p_reported_condition = 'hilang' AND p_recovery_type <> 'replacement' THEN RAISE EXCEPTION 'RECOVERY_TYPE_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;

  SELECT kondisi, status INTO v_condition, v_status
  FROM public.equipment WHERE id = p_equipment_id FOR UPDATE;
  IF v_condition IS NULL THEN RAISE EXCEPTION 'EQUIPMENT_NOT_FOUND'; END IF;
  IF v_status = 'dipinjam' THEN RAISE EXCEPTION 'EQUIPMENT_STILL_BORROWED'; END IF;
  IF p_assessment_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.borrowing_return_assessment_items
    WHERE id = p_assessment_item_id AND equipment_id = p_equipment_id
  ) THEN RAISE EXCEPTION 'RECOVERY_ASSESSMENT_LINK_INVALID'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.equipment_recovery_cases
    WHERE equipment_id = p_equipment_id AND status IN ('open', 'in_progress', 'awaiting_verification')
  ) THEN RAISE EXCEPTION 'RECOVERY_CASE_ALREADY_OPEN'; END IF;

  INSERT INTO public.equipment_recovery_cases (
    equipment_id, assessment_item_id, recovery_type, reported_condition, notes, opened_by
  ) VALUES (
    p_equipment_id, p_assessment_item_id, p_recovery_type, p_reported_condition, NULLIF(trim(p_notes), ''), p_opened_by
  ) RETURNING id INTO v_case_id;

  UPDATE public.equipment
  SET status = 'maintenance', availability_status = 'maintenance'::availability_status,
      kondisi = CASE WHEN p_reported_condition = 'hilang' THEN 'hilang' ELSE p_reported_condition END,
      physical_condition = CASE WHEN p_reported_condition = 'hilang' THEN 'hilang' ELSE p_reported_condition END::physical_condition,
      asset_state = CASE WHEN p_reported_condition = 'hilang' THEN 'lost' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = p_equipment_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_opened_by, 'INSERT', 'equipment_recovery_cases', v_case_id,
    jsonb_build_object('equipment_id', p_equipment_id, 'recovery_type', p_recovery_type, 'status', 'open'), trim(p_change_reason));
  RETURN v_case_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_student_with_account_atomic(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
  v_username TEXT := NULLIF(BTRIM(p_username), '');
  v_role TEXT := COALESCE(NULLIF(BTRIM(p_role), ''), 'member');
BEGIN
  IF v_nis IS NULL OR LENGTH(v_nis) > 40 THEN
    RAISE EXCEPTION 'NIS wajib diisi dan maksimal 40 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_nama IS NULL OR LENGTH(v_nama) < 2 OR LENGTH(v_nama) > 120 THEN
    RAISE EXCEPTION 'Nama siswa wajib diisi dan maksimal 120 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_kelas IS NULL OR LENGTH(v_kelas) > 80 THEN
    RAISE EXCEPTION 'Kelas wajib diisi dan maksimal 80 karakter.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'Username akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR LENGTH(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Password hash akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member') THEN
    RAISE EXCEPTION 'Peran akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.users (
    username, password_hash, nama, role, is_first_login, is_active,
    created_by, updated_by, updated_at
  ) VALUES (
    v_username, p_password_hash, v_nama, v_role::public.user_role, TRUE, TRUE,
    p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    v_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    NULLIF(BTRIM(p_no_telepon), ''), NULLIF(BTRIM(p_foto_url), ''),
    TRUE, p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', v_role,
    'is_first_login', TRUE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_student_with_account_atomic(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
  v_username TEXT := NULLIF(BTRIM(p_username), '');
BEGIN
  IF v_nis IS NULL OR LENGTH(v_nis) > 40 THEN
    RAISE EXCEPTION 'NIS wajib diisi dan maksimal 40 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_nama IS NULL OR LENGTH(v_nama) < 2 OR LENGTH(v_nama) > 120 THEN
    RAISE EXCEPTION 'Nama siswa wajib diisi dan maksimal 120 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_kelas IS NULL OR LENGTH(v_kelas) > 80 THEN
    RAISE EXCEPTION 'Kelas wajib diisi dan maksimal 80 karakter.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'Username akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR LENGTH(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Password hash akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.users (
    username, password_hash, nama, role, is_first_login, is_active,
    created_by, updated_by, updated_at
  ) VALUES (
    v_username, p_password_hash, v_nama, 'member', TRUE, TRUE,
    p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    v_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    NULLIF(BTRIM(p_no_telepon), ''), NULLIF(BTRIM(p_foto_url), ''),
    TRUE, p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', 'member',
    'is_first_login', TRUE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_student_with_account_v2(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
  v_username TEXT := lower(NULLIF(BTRIM(p_username), ''));
  v_phone TEXT := NULLIF(BTRIM(p_no_telepon), '');
  v_role TEXT := COALESCE(NULLIF(BTRIM(p_role), ''), 'member');
  v_actor_active BOOLEAN;
  v_actor_role TEXT;
  v_inserted INTEGER;
  v_operation public.student_account_operations%ROWTYPE;
  v_operation_id UUID := COALESCE(p_operation_id, p_operation_key);
BEGIN
  IF p_created_by IS NULL OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_FINGERPRINT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_change_reason IS NULL OR length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_CHANGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active, u.role::TEXT
    INTO v_actor_active, v_actor_role
  FROM public.users AS u
  WHERE u.id = p_created_by;
  IF v_actor_active IS DISTINCT FROM TRUE OR NOT EXISTS (
    SELECT 1 FROM public.access_role_permissions AS rp
    WHERE rp.role_key = v_actor_role AND rp.permission_key = 'students.manage'
  ) THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_nis IS NULL OR length(v_nis) > 40
     OR v_nama IS NULL OR length(v_nama) NOT BETWEEN 2 AND 120
     OR v_kelas IS NULL OR length(v_kelas) > 80 THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'INVALID_PEMINATAN' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+628[1-9][0-9]{7,10}$' THEN
    RAISE EXCEPTION 'INVALID_WHATSAPP_NUMBER' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'INVALID_PASSWORD_HASH' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member') THEN
    RAISE EXCEPTION 'INVALID_STUDENT_ROLE' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_account_operations (
    actor_id, operation_key, operation_type, request_fingerprint
  ) VALUES (
    p_created_by, p_operation_key, 'create', p_request_fingerprint
  ) ON CONFLICT (actor_id, operation_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_operation
    FROM public.student_account_operations AS op
    WHERE op.actor_id = p_created_by AND op.operation_key = p_operation_key
    FOR UPDATE;
    IF v_operation.operation_type <> 'create'
       OR v_operation.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'STUDENT_OPERATION_KEY_REUSED' USING ERRCODE = '23505';
    END IF;
    SELECT s.id, s.user_id INTO v_student_id, v_user_id
    FROM public.students AS s
    WHERE s.id = v_operation.student_id;
    IF NOT FOUND OR v_user_id IS NULL THEN
      RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_RESULT_UNAVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    RETURN (
      SELECT jsonb_build_object(
        'student_id', v_student_id,
        'user_id', u.id,
        'username', u.username,
        'role', u.role::TEXT,
        'is_first_login', u.is_first_login,
        'operation_replayed', TRUE
      ) FROM public.users AS u WHERE u.id = v_user_id
    );
  END IF;

  BEGIN
    INSERT INTO public.users (
      username, password_hash, nama, role, is_first_login, is_active,
      created_by, updated_by, updated_at
    ) VALUES (
      v_username, p_password_hash, v_nama, v_role::public.user_role, TRUE, TRUE,
      p_created_by, p_created_by, NOW()
    ) RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.users AS u WHERE lower(btrim(u.username)) = v_username) THEN
      RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = '23505', CONSTRAINT = 'uq_users_username_normalized';
    END IF;
    RAISE;
  END;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    v_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    v_phone, NULLIF(BTRIM(p_foto_url), ''),
    TRUE, p_created_by, p_created_by, NOW()
  ) RETURNING id INTO v_student_id;

  UPDATE public.student_account_operations
  SET student_id = v_student_id, user_id = v_user_id
  WHERE actor_id = p_created_by AND operation_key = p_operation_key;

  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'students', v_student_id, NULL,
    jsonb_build_object('operation', 'student_created_with_account', 'user_id', v_user_id),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'student_account_onboarding')
  );
  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'users', v_user_id, NULL,
    jsonb_build_object('operation', 'student_account_issued', 'student_id', v_student_id, 'username', v_username, 'role', v_role, 'is_first_login', TRUE),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'credential_issuance')
  );

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', v_role,
    'is_first_login', TRUE,
    'operation_replayed', FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.default_cash_payment_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_method_id IS NULL THEN
    SELECT id INTO NEW.payment_method_id
    FROM public.cash_payment_methods
    WHERE code = 'cash'
    LIMIT 1;
  END IF;

  IF NEW.payment_method_id IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran Cash belum tersedia.';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.delete_equipment_atomic(p_equipment_id uuid, p_deleted_by uuid, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.equipment;
BEGIN
  IF p_equipment_id IS NULL OR p_deleted_by IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_DELETE_IDENTITY_INVALID';
  END IF;

  IF p_change_reason IS NULL
     OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_CHANGE_REASON_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_deleted_by
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_DELETE_ACTOR_FORBIDDEN';
  END IF;

  SELECT *
  INTO v_current
  FROM public.equipment
  WHERE id = p_equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_deleted_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  DELETE FROM public.equipment
  WHERE id = p_equipment_id;

  PERFORM public.write_audit_log(
    p_deleted_by,
    'DELETE',
    'equipment',
    p_equipment_id,
    public.redact_audit_json(to_jsonb(v_current)),
    NULL,
    LEFT(BTRIM(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object('audit_scope', 'equipment_delete_atomic')
  );

  RETURN p_equipment_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_cash_transaction_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expected NUMERIC;
  v_current_balance NUMERIC;
  v_actor UUID;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  IF NEW.nominal IS NULL OR NEW.nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal transaksi kas harus lebih besar dari nol.';
  END IF;

  IF COALESCE(NULLIF(TRIM(NEW.keterangan), ''), '') = '' THEN
    RAISE EXCEPTION 'Keterangan transaksi kas wajib diisi.';
  END IF;

  IF NEW.saldo_sebelum IS NULL OR NEW.saldo_sebelum < 0 THEN
    RAISE EXCEPTION 'Saldo sebelum transaksi tidak valid.';
  END IF;

  v_expected := CASE
    WHEN COALESCE(NEW.is_billing, FALSE) THEN NEW.saldo_sebelum
    WHEN NEW.type::TEXT = 'pengeluaran' THEN NEW.saldo_sebelum - NEW.nominal
    ELSE NEW.saldo_sebelum + NEW.nominal
  END;

  IF NEW.saldo_sesudah IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Saldo transaksi tidak konsisten. Saldo sesudah harus %.', v_expected;
  END IF;

  IF NEW.saldo_sesudah < 0 THEN
    RAISE EXCEPTION 'Saldo kas tidak boleh negatif.';
  END IF;

  -- Semua jalur INSERT, termasuk direct service-role writes, harus dimulai
  -- dari saldo ledger terakhir. RPC kas juga memakai lock yang sama.
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(4815162342::BIGINT);
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(is_billing, FALSE) THEN 0
        WHEN type::TEXT = 'pengeluaran' THEN -nominal
        ELSE nominal
      END
    ), 0)
    INTO v_current_balance
    FROM public.cash_transactions;

    IF NEW.saldo_sebelum IS DISTINCT FROM v_current_balance THEN
      RAISE EXCEPTION 'Saldo sebelum transaksi tidak sama dengan saldo ledger terakhir (%).', v_current_balance;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_equipment_state_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.kondisi IS NULL OR NEW.status IS NULL
    OR NEW.kondisi NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang')
    OR NEW.status NOT IN ('tersedia', 'dipinjam', 'maintenance') THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  IF NEW.kondisi = 'bagus' AND NEW.status NOT IN ('tersedia', 'dipinjam') THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  IF NEW.kondisi <> 'bagus' AND NEW.status <> 'maintenance' THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enforce_user_role_account_boundary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students AS s WHERE s.user_id = NEW.id
  ) THEN
    IF NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member') THEN
      RAISE EXCEPTION 'USER_LINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'social_media_team', 'member') THEN
      RAISE EXCEPTION 'USER_UNLINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
    IF NEW.role::TEXT NOT IN ('teacher', 'treasurer') THEN
      RAISE EXCEPTION 'USER_UNLINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enrich_activity_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name TEXT;
  v_actor_username TEXT;
  v_actor_role TEXT;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT u.nama, u.username, u.role::TEXT
    INTO v_actor_name, v_actor_username, v_actor_role
    FROM public.users u
    WHERE u.id = NEW.user_id;
  END IF;

  NEW.actor_name_snapshot := COALESCE(NEW.actor_name_snapshot, v_actor_name);
  NEW.actor_username_snapshot := COALESCE(NEW.actor_username_snapshot, v_actor_username);
  NEW.actor_role_snapshot := COALESCE(NEW.actor_role_snapshot, v_actor_role);
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'api');
  NEW.old_values := public.redact_audit_json(NEW.old_values);
  NEW.new_values := public.redact_audit_json(NEW.new_values);
  NEW.changed_fields := public.audit_changed_fields(NEW.old_values, NEW.new_values);

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enrich_debt_record_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor UUID;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    IF NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'paid'
       AND (to_jsonb(NEW) - 'updated_at' - 'updated_by')
         IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_by') THEN
      RAISE EXCEPTION 'Utang yang sudah lunas tidak dapat diubah kembali.';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    END IF;
    NEW.updated_by := COALESCE(v_actor, NEW.updated_by);
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.finalize_contest_entry_atomic(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.contest_entries;
  v_updated public.contest_entries;
  v_evidence public.contest_entry_evidence;
  v_item JSONB;
  v_first_title TEXT;
  v_inserted INTEGER;
  v_existing_operation public.contest_entry_pipeline_operations;
  v_response JSONB;
BEGIN
  IF p_entry_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_IDENTITY_INVALID';
  END IF;
  IF p_outcome_status IS NULL
     OR p_outcome_status NOT IN ('awarded', 'not_awarded') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_OUTCOME_INVALID';
  END IF;
  IF p_evidence_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_EVIDENCE_REQUIRED';
  END IF;
  IF length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHANGE_REASON_REQUIRED';
  END IF;
  IF length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_IDEMPOTENCY_INVALID';
  END IF;
  IF jsonb_typeof(COALESCE(p_results, '[]'::JSONB)) <> 'array'
     OR jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) > 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_RESULTS_INVALID';
  END IF;
  IF p_outcome_status = 'awarded'
     AND jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_RESULT_REQUIRED';
  END IF;
  IF p_outcome_status = 'not_awarded'
     AND jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_RESULT_NOT_ALLOWED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'secretary', 'contest_team')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_ACTOR_FORBIDDEN';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_results, '[]'::JSONB))
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(v_item) AS item_key(key_name)
         WHERE key_name NOT IN ('result_kind', 'result_title', 'position')
       )
       OR v_item->>'result_kind' IS NULL
       OR (v_item->>'result_kind') NOT IN ('rank', 'finalist', 'nominee', 'other')
       OR length(btrim(COALESCE(v_item->>'result_title', ''))) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_RESULT_ITEM_INVALID';
    END IF;
    IF v_item->>'position' IS NOT NULL
       AND (
         (v_item->>'position') !~ '^[0-9]+$'
         OR (v_item->>'position')::INTEGER NOT BETWEEN 1 AND 100000
       ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_POSITION_INVALID';
    END IF;
    IF v_item->>'result_kind' = 'rank' AND v_item->>'position' IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_POSITION_REQUIRED';
    END IF;
  END LOOP;

  INSERT INTO public.contest_entry_pipeline_operations (
    idempotency_key, entry_id, operation_kind, target_status, actor_id
  ) VALUES (
    btrim(p_idempotency_key), p_entry_id, 'finalize', 'selesai', p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
    INTO v_existing_operation
    FROM public.contest_entry_pipeline_operations
    WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing_operation.entry_id IS DISTINCT FROM p_entry_id
       OR v_existing_operation.operation_kind <> 'finalize'
       OR v_existing_operation.target_status <> 'selesai'
       OR v_existing_operation.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing_operation.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_existing_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  SELECT *
  INTO v_current
  FROM public.contest_entries
  WHERE id = p_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;
  IF v_current.pipeline_status <> 'menunggu_pengumuman' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_TRANSITION_INVALID';
  END IF;

  SELECT *
  INTO v_evidence
  FROM public.contest_entry_evidence
  WHERE id = p_evidence_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_evidence.entry_id IS DISTINCT FROM p_entry_id
     OR v_evidence.target_status IS DISTINCT FROM 'selesai'
     OR v_evidence.evidence_type IS DISTINCT FROM 'result'
     OR v_evidence.storage_provider IS DISTINCT FROM 'r2'
     OR v_evidence.upload_status IS DISTINCT FROM 'pending'
     OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_FINALIZE_EVIDENCE_INVALID';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.contest_entry_results
  SET is_active = FALSE,
      voided_at = NOW(),
      voided_by = p_actor_id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE entry_id = p_entry_id
    AND is_active = TRUE;

  IF p_outcome_status = 'awarded' THEN
    FOR v_item IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_results, '[]'::JSONB))
    LOOP
      INSERT INTO public.contest_entry_results (
        entry_id,
        result_kind,
        result_title,
        position,
        category_name,
        notes,
        created_by,
        updated_by
      ) VALUES (
        p_entry_id,
        v_item->>'result_kind',
        btrim(v_item->>'result_title'),
        CASE
          WHEN v_item->>'position' IS NULL THEN NULL
          ELSE (v_item->>'position')::INTEGER
        END,
        NULL,
        NULL,
        p_actor_id,
        p_actor_id
      );
      IF v_first_title IS NULL THEN
        v_first_title := btrim(v_item->>'result_title');
      END IF;
    END LOOP;
  ELSE
    v_first_title := 'Tidak mendapat penghargaan';
  END IF;

  UPDATE public.contest_entry_evidence
  SET upload_status = 'attached',
      attached_status = 'selesai',
      updated_at = NOW()
  WHERE id = p_evidence_id;

  UPDATE public.contest_entry_evidence
  SET upload_status = 'abandoned',
      updated_at = NOW()
  WHERE entry_id = p_entry_id
    AND target_status = 'selesai'
    AND upload_status = 'pending'
    AND id <> p_evidence_id;

  UPDATE public.contest_entries
  SET pipeline_status = 'selesai',
      outcome_status = p_outcome_status,
      result_label = v_first_title,
      result_note = NULL,
      submitted_at = COALESCE(submitted_at, NOW()),
      completed_at = NOW(),
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_entry_id
  RETURNING * INTO v_updated;

  INSERT INTO public.contest_entry_status_history (
    entry_id, from_status, to_status, change_reason, changed_by
  ) VALUES (
    p_entry_id, v_current.pipeline_status, 'selesai', btrim(p_change_reason), p_actor_id
  );

  INSERT INTO public.contest_entry_result_history (
    entry_id, from_outcome_status, to_outcome_status, change_reason, changed_by
  ) VALUES (
    p_entry_id, v_current.outcome_status, p_outcome_status, btrim(p_change_reason), p_actor_id
  );

  PERFORM public.write_audit_log(
    p_actor_id,
    'UPDATE',
    'contest_entries',
    p_entry_id,
    public.redact_audit_json(to_jsonb(v_current)),
    public.redact_audit_json(to_jsonb(v_updated)),
    left(btrim(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object(
      'audit_scope', 'contest_entry_finalize',
      'evidence_id', p_evidence_id,
      'result_count', jsonb_array_length(COALESCE(p_results, '[]'::JSONB))
    )
  );

  v_response := jsonb_build_object(
    'entry', to_jsonb(v_updated),
    'results', COALESCE((
      SELECT jsonb_agg(to_jsonb(result_row) ORDER BY result_row.created_at, result_row.id)
      FROM public.contest_entry_results AS result_row
      WHERE result_row.entry_id = p_entry_id
        AND result_row.is_active = TRUE
    ), '[]'::JSONB),
    'evidence_id', p_evidence_id,
    'idempotent_replay', FALSE
  );

  UPDATE public.contest_entry_pipeline_operations
  SET response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);

  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.finish_borrowing_after_recovery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_borrowing_id UUID;
  v_item_status TEXT;
  v_remaining_count INTEGER;
  v_final_borrowing_status TEXT;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.assessment_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT assessment.borrowing_id, borrowing_item.status
  INTO v_borrowing_id, v_item_status
  FROM public.borrowing_return_assessment_items AS assessment_item
  JOIN public.borrowing_return_assessments AS assessment
    ON assessment.id = assessment_item.assessment_id
  JOIN public.borrowing_items AS borrowing_item
    ON borrowing_item.id = assessment_item.borrowing_item_id
  WHERE assessment_item.id = NEW.assessment_item_id
  FOR UPDATE OF borrowing_item;

  IF v_borrowing_id IS NULL OR v_item_status <> 'pending_resolution' THEN
    RETURN NEW;
  END IF;

  UPDATE public.borrowing_items
  SET status = 'returned',
      tanggal_dikembalikan = COALESCE(tanggal_dikembalikan, NOW()),
      updated_by = NEW.verified_by,
      updated_at = NOW()
  WHERE id = (
    SELECT borrowing_item_id
    FROM public.borrowing_return_assessment_items
    WHERE id = NEW.assessment_item_id
  );

  SELECT COUNT(*) INTO v_remaining_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing_id
    AND status IN ('borrowed', 'pending_resolution');

  IF v_remaining_count = 0 THEN
    v_final_borrowing_status := 'returned';
  ELSIF EXISTS (
    SELECT 1 FROM public.borrowing_return_reports
    WHERE borrowing_id = v_borrowing_id AND status = 'pending_verification'
  ) THEN
    v_final_borrowing_status := 'pending_verification';
  ELSE
    v_final_borrowing_status := 'partial';
  END IF;

  UPDATE public.borrowings
  SET status = v_final_borrowing_status,
      returned_at = CASE WHEN v_final_borrowing_status = 'returned' THEN COALESCE(returned_at, NOW()) ELSE returned_at END,
      return_verified_at = CASE WHEN v_final_borrowing_status = 'returned' THEN NOW() ELSE return_verified_at END,
      return_verified_by = CASE WHEN v_final_borrowing_status = 'returned' THEN NEW.verified_by ELSE return_verified_by END,
      updated_by = NEW.verified_by,
      updated_at = NOW()
  WHERE id = v_borrowing_id;

  IF v_final_borrowing_status = 'returned' THEN
    UPDATE public.borrowing_return_reports AS report
    SET status = 'approved', verified_by = NEW.verified_by, verified_at = NOW(), updated_at = NOW()
    WHERE report.status = 'pending_verification'
      AND report.borrowing_id = v_borrowing_id;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (
    NEW.verified_by,
    'UPDATE',
    'borrowings',
    v_borrowing_id,
    jsonb_build_object('status', v_final_borrowing_status, 'recovery_case_id', NEW.id, 'remaining_item_count', v_remaining_count),
    'SYSTEM:RETURN_RECOVERY_COMPLETED'
  );

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fn_notify_cash_dispute()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_student_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
    SELECT u.id, 'cash_dispute_response'::notification_type,
      'Sanggahan kas baru',
      'Ada laporan sanggahan kas baru yang perlu diperiksa guru.',
      'Ada laporan sanggahan kas baru yang perlu diperiksa guru.',
      FALSE,
      jsonb_build_object('dispute_id', NEW.id, 'student_id', NEW.student_id, 'attempt_number', NEW.attempt_number)
    FROM public.users u
    WHERE u.is_active = TRUE AND u.role::TEXT = 'teacher';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT s.user_id INTO v_student_user_id FROM public.students s WHERE s.id = NEW.student_id;
    IF v_student_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
      VALUES (
        v_student_user_id,
        'cash_dispute_response'::notification_type,
        CASE WHEN NEW.status = 'approved' THEN 'Sanggahan kas disetujui' ELSE 'Sanggahan kas ditolak' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.' END,
        FALSE,
        jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status, 'attempt_number', NEW.attempt_number, 'review_note', NEW.review_note)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_weekly_cash_billing(p_run_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(students_billed integer, total_nominal numeric, status text, billing_week date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings cash_settings;
  v_week DATE := date_trunc('week', p_run_date)::DATE;
  v_run_id UUID;
  v_student RECORD;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
  v_status TEXT := 'generated';
BEGIN
  PERFORM pg_advisory_xact_lock(4815162342);
  PERFORM set_config('app.system_operation', 'true', TRUE);
  PERFORM set_config('app.current_user_id', '', TRUE);
  PERFORM set_config('app.change_reason', 'SYSTEM:WEEKLY_BILLING', TRUE);
  SELECT * INTO v_settings FROM cash_settings WHERE id = TRUE FOR UPDATE;

  IF v_settings.holiday_start_date IS NOT NULL
     AND v_week >= v_settings.holiday_start_date
     AND (v_settings.holiday_end_date IS NULL OR v_week <= v_settings.holiday_end_date) THEN
    v_status := 'skipped_holiday';
  END IF;
  IF v_settings.skip_week THEN
    IF v_status = 'generated' THEN
      v_status := 'skipped_manual';
    END IF;
    UPDATE cash_settings SET skip_week = FALSE, updated_at = NOW() WHERE id = TRUE;
  END IF;

  INSERT INTO cash_billing_runs (billing_week, nominal_iuran_wajib, status)
  VALUES (v_week, v_settings.nominal_iuran_wajib, v_status)
  ON CONFLICT (billing_week) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, 'already_processed'::TEXT, v_week;
    RETURN;
  END IF;

  IF v_status <> 'generated' THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, v_status, v_week;
    RETURN;
  END IF;

  FOR v_student IN SELECT id FROM students WHERE is_active = TRUE LOOP
    INSERT INTO debt_records (student_id, amount, status, keterangan, periode, idempotency_key)
    VALUES (
      v_student.id,
      v_settings.nominal_iuran_wajib,
      'unpaid',
      'Tagihan iuran mingguan',
      to_char(v_week, 'IYYY-IW'),
      'weekly-billing-' || to_char(v_week, 'IYYY-IW') || '-' || v_student.id::TEXT
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN
      v_count := v_count + 1;
      v_total := v_total + v_settings.nominal_iuran_wajib;
    END IF;

    -- Show the generated bill in cash history without inflating real cash.
    -- A bill is a receivable; cash balance changes only when the student pays.
    INSERT INTO cash_transactions (
      type, nominal, keterangan, student_id, saldo_sebelum, saldo_sesudah,
      idempotency_key, is_billing
    )
    SELECT
      'iuran_wajib',
      v_settings.nominal_iuran_wajib,
      'Tagihan iuran mingguan',
      v_student.id,
      COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0),
      COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0),
      'weekly-billing-tx-' || to_char(v_week, 'IYYY-IW') || '-' || v_student.id::TEXT,
      TRUE
    FROM cash_transactions
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  UPDATE cash_billing_runs
  SET students_billed = v_count, total_nominal = v_total
  WHERE id = v_run_id;

  INSERT INTO activity_logs (action, table_name, new_values, change_reason)
  VALUES (
    'SYSTEM_CHECK',
    'debt_records',
    jsonb_build_object('billing_week', v_week, 'students_billed', v_count, 'total_nominal', v_total),
    'SYSTEM:WEEKLY_BILLING'
  );

  RETURN QUERY SELECT v_count, v_total, v_status, v_week;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_attendance_summary_filtered(p_student_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_kelas text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(hadir bigint, sakit bigint, izin bigint, alpha bigint, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'hadir'),
    COUNT(*) FILTER (WHERE a.status = 'sakit'),
    COUNT(*) FILTER (WHERE a.status = 'izin'),
    COUNT(*) FILTER (WHERE a.status = 'alpha'),
    COUNT(*)
  FROM public.attendance AS a
  INNER JOIN public.students AS s ON s.id = a.student_id
  WHERE (p_student_id IS NULL OR a.student_id = p_student_id)
    AND (p_date_from IS NULL OR a.tanggal >= p_date_from)
    AND (p_date_to IS NULL OR a.tanggal <= p_date_to)
    AND (
      p_kelas IS NULL
      OR p_kelas = 'all'
      OR (
        p_kelas IN ('X', 'XI', 'XII')
        AND (s.kelas = p_kelas OR s.kelas ILIKE p_kelas || ' %')
      )
      OR s.kelas = p_kelas
    )
    AND (p_status IS NULL OR p_status = 'all' OR a.status = p_status)
    AND (
      p_search IS NULL
      OR s.nama ILIKE '%' || p_search || '%'
      OR s.nis ILIKE '%' || p_search || '%'
    );
$function$;
CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_tanggal date)
 RETURNS TABLE(hadir bigint, sakit bigint, izin bigint, alpha bigint, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'hadir'),
    COUNT(*) FILTER (WHERE a.status = 'sakit'),
    COUNT(*) FILTER (WHERE a.status = 'izin'),
    COUNT(*) FILTER (WHERE a.status = 'alpha'),
    COUNT(*)
  FROM public.attendance AS a
  WHERE a.tanggal = p_tanggal;
$function$;
CREATE OR REPLACE FUNCTION public.get_cash_dispute_quota(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period DATE := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_used INTEGER;
  v_limit CONSTANT INTEGER := 2;
  v_resets_at TIMESTAMPTZ;
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STUDENT_SCOPE_UNAVAILABLE';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_used
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND quota_period_start = v_period;

  v_resets_at := ((v_period + INTERVAL '1 month')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta');

  RETURN jsonb_build_object(
    'period', to_char(v_period, 'YYYY-MM'),
    'period_start', v_period,
    'limit', v_limit,
    'used', LEAST(v_used, v_limit),
    'remaining', GREATEST(v_limit - v_used, 0),
    'resets_at', v_resets_at
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_cash_report_with_method(p_start_date date, p_end_date date, p_payment_method_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days INTEGER;
  v_report JSONB;
  v_method_code TEXT := NULLIF(lower(trim(p_payment_method_code)), '');
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Rentang tanggal laporan tidak valid.';
  END IF;
  v_days := p_end_date - p_start_date + 1;
  IF v_days > 90 THEN
    RAISE EXCEPTION 'Rentang laporan maksimal 90 hari.';
  END IF;
  IF v_method_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cash_payment_methods WHERE code = v_method_code
  ) THEN
    RAISE EXCEPTION 'Metode pembayaran tidak ditemukan.';
  END IF;

  WITH period_transactions AS (
    SELECT
      ct.id,
      ct.student_id,
      ct.type::TEXT AS transaction_type,
      COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
      COALESCE(ct.is_billing, FALSE) AS is_billing,
      ct.created_at,
      COALESCE(ct.tanggal, ct.created_at::DATE) AS transaction_date,
      COALESCE(NULLIF(TRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan,
      COALESCE(cpm.code, CASE WHEN ct.payment_method_id IS NULL THEN 'cash' END) AS payment_method_code,
      COALESCE(cpm.label, CASE WHEN ct.payment_method_id IS NULL THEN 'Cash' END) AS payment_method_label,
      s.nama AS student_name,
      s.nis,
      s.kelas
    FROM public.cash_transactions ct
    LEFT JOIN public.cash_payment_methods cpm ON cpm.id = ct.payment_method_id
    LEFT JOIN public.students s ON s.id = ct.student_id
    WHERE ct.tanggal BETWEEN p_start_date AND p_end_date
      AND (
        v_method_code IS NULL
        OR COALESCE(cpm.code, CASE WHEN ct.payment_method_id IS NULL THEN 'cash' END) = v_method_code
      )
  ),
  period_debts AS (
    SELECT dr.student_id, SUM(dr.amount)::NUMERIC AS total_debt,
      COUNT(*)::INTEGER AS debt_record_count, MIN(dr.created_at)::DATE AS oldest_debt_date
    FROM public.debt_records dr
    WHERE dr.status = 'unpaid'
      AND dr.created_at >= p_start_date::TIMESTAMPTZ
      AND dr.created_at < (p_end_date + 1)::TIMESTAMPTZ
    GROUP BY dr.student_id
  ),
  summary AS (
    SELECT
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type <> 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_income,
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_expense,
      COUNT(*) FILTER (WHERE NOT is_billing)::INTEGER AS transaction_count
    FROM period_transactions
  ),
  control AS (
    SELECT
      COALESCE((SELECT SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END) FROM public.cash_transactions WHERE tanggal < p_start_date), 0)::NUMERIC AS opening_balance,
      COALESCE((SELECT SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END) FROM public.cash_transactions WHERE tanggal <= p_end_date), 0)::NUMERIC AS closing_balance
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', v_days),
    'summary', jsonb_build_object(
      'total_income', summary.total_income,
      'total_expense', summary.total_expense,
      'net_cash_flow', summary.total_income - summary.total_expense,
      'outstanding_debt', COALESCE((SELECT SUM(total_debt) FROM period_debts), 0)::NUMERIC,
      'delinquent_students', COALESCE((SELECT COUNT(*) FROM period_debts), 0)::INTEGER,
      'debt_record_count', COALESCE((SELECT SUM(debt_record_count) FROM period_debts), 0)::INTEGER,
      'transaction_count', summary.transaction_count
    ),
    'control', CASE WHEN v_method_code IS NULL THEN jsonb_build_object(
      'opening_balance', control.opening_balance,
      'period_net_cash_flow', summary.total_income - summary.total_expense,
      'expected_closing_balance', control.opening_balance + summary.total_income - summary.total_expense,
      'closing_balance', control.closing_balance,
      'difference', control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense),
      'is_balanced', ABS(control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense)) <= 0.005
    ) ELSE NULL END,
    'flow_breakdown', jsonb_build_array(
      jsonb_build_object('key', 'income', 'label', 'Pemasukan', 'total', summary.total_income),
      jsonb_build_object('key', 'expense', 'label', 'Pengeluaran', 'total', summary.total_expense)
    ),
    'payment_method_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', payment_method_code,
        'label', COALESCE(payment_method_label, 'Metode tidak diketahui'),
        'total', total,
        'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT payment_method_code, payment_method_label, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY payment_method_code, payment_method_label
      ) methods
    ), '[]'::JSONB),
    'income_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', transaction_type, 'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END, 'total', total, 'count', item_count) ORDER BY total DESC)
      FROM (
        SELECT transaction_type, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY transaction_type
      ) income_rows
    ), '[]'::JSONB),
    'expense_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', 'expense', 'label', keterangan, 'total', total, 'count', item_count) ORDER BY total DESC)
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions WHERE NOT is_billing AND transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) expense_rows
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', generated_date::DATE, 'income', income, 'expense', expense) ORDER BY generated_date::DATE)
      FROM (
        SELECT generated_date,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type <> 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS income,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type = 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS expense
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') generated_date
        LEFT JOIN period_transactions pt ON pt.transaction_date = generated_date::DATE
        GROUP BY generated_date
      ) daily_rows
    ), '[]'::JSONB),
    'income_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'date', transaction_date, 'type', transaction_type, 'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END, 'amount', nominal, 'note', keterangan, 'student_id', student_id, 'student_name', student_name, 'nis', nis, 'kelas', kelas, 'payment_method_code', payment_method_code, 'payment_method_label', payment_method_label) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
    ), '[]'::JSONB),
    'expense_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'date', transaction_date, 'amount', nominal, 'note', keterangan, 'payment_method_code', payment_method_code, 'payment_method_label', payment_method_label) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions WHERE NOT is_billing AND transaction_type = 'pengeluaran'
    ), '[]'::JSONB),
    'debts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('student_id', pd.student_id, 'student_nama', COALESCE(st.nama, 'Siswa'), 'nis', st.nis, 'kelas', st.kelas, 'total_debt', pd.total_debt, 'debt_record_count', pd.debt_record_count, 'oldest_debt_date', pd.oldest_debt_date) ORDER BY pd.total_debt DESC, st.nama ASC)
      FROM period_debts pd LEFT JOIN public.students st ON st.id = pd.student_id
    ), '[]'::JSONB)
  ) INTO v_report
  FROM summary, control;

  RETURN v_report;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_cash_report(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_end_exclusive TIMESTAMPTZ;
  v_days INTEGER;
  v_report JSONB;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai dan tanggal selesai wajib diisi.';
  END IF;

  v_days := p_end_date - p_start_date + 1;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  END IF;
  IF v_days > 90 THEN
    RAISE EXCEPTION 'Rentang laporan maksimal 90 hari.';
  END IF;

  v_end_exclusive := (p_end_date + 1)::TIMESTAMPTZ;

  WITH period_transactions AS (
    SELECT
      ct.id,
      ct.student_id,
      ct.type::TEXT AS transaction_type,
      COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
      COALESCE(ct.is_billing, FALSE) AS is_billing,
      ct.created_at,
      COALESCE(ct.tanggal, ct.created_at::DATE) AS transaction_date,
      COALESCE(NULLIF(TRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan,
      s.nama AS student_name,
      s.nis,
      s.kelas
    FROM public.cash_transactions ct
    LEFT JOIN public.students s ON s.id = ct.student_id
    WHERE ct.tanggal >= p_start_date
      AND ct.tanggal <= p_end_date
  ),
  period_debts AS (
    SELECT
      dr.student_id,
      COALESCE(SUM(dr.amount), 0)::NUMERIC AS total_debt,
      COUNT(*)::INTEGER AS debt_record_count,
      MIN(dr.created_at)::DATE AS oldest_debt_date
    FROM public.debt_records dr
    WHERE dr.status = 'unpaid'
      AND dr.created_at >= p_start_date::TIMESTAMPTZ
      AND dr.created_at < v_end_exclusive
    GROUP BY dr.student_id
  ),
  summary AS (
    SELECT
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type <> 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_income,
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_expense,
      COUNT(*) FILTER (WHERE NOT is_billing)::INTEGER AS transaction_count
    FROM period_transactions
  ),
  control AS (
    SELECT
      COALESCE((
        SELECT SUM(CASE
          WHEN COALESCE(ct.is_billing, FALSE) THEN 0
          WHEN ct.type::TEXT = 'pengeluaran' THEN -ct.nominal
          ELSE ct.nominal
        END)
        FROM public.cash_transactions ct
        WHERE ct.tanggal < p_start_date
      ), 0)::NUMERIC AS opening_balance,
      COALESCE((
        SELECT SUM(CASE
          WHEN COALESCE(ct.is_billing, FALSE) THEN 0
          WHEN ct.type::TEXT = 'pengeluaran' THEN -ct.nominal
          ELSE ct.nominal
        END)
        FROM public.cash_transactions ct
        WHERE ct.tanggal <= p_end_date
      ), 0)::NUMERIC AS closing_balance
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', v_days),
    'summary', jsonb_build_object(
      'total_income', summary.total_income,
      'total_expense', summary.total_expense,
      'net_cash_flow', summary.total_income - summary.total_expense,
      'outstanding_debt', COALESCE((SELECT SUM(total_debt) FROM period_debts), 0)::NUMERIC,
      'delinquent_students', COALESCE((SELECT COUNT(*) FROM period_debts), 0)::INTEGER,
      'debt_record_count', COALESCE((SELECT SUM(debt_record_count) FROM period_debts), 0)::INTEGER,
      'transaction_count', summary.transaction_count
    ),
    'control', jsonb_build_object(
      'opening_balance', control.opening_balance,
      'period_net_cash_flow', summary.total_income - summary.total_expense,
      'expected_closing_balance', control.opening_balance + summary.total_income - summary.total_expense,
      'closing_balance', control.closing_balance,
      'difference', control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense),
      'is_balanced', ABS(control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense)) <= 0.005
    ),
    'flow_breakdown', jsonb_build_array(
      jsonb_build_object('key', 'income', 'label', 'Pemasukan', 'total', summary.total_income),
      jsonb_build_object('key', 'expense', 'label', 'Pengeluaran', 'total', summary.total_expense)
    ),
    'income_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', transaction_type,
        'label', CASE transaction_type
          WHEN 'iuran_wajib' THEN 'Iuran wajib'
          WHEN 'pemasukan' THEN 'Pemasukan lain-lain'
          ELSE transaction_type
        END,
        'total', total,
        'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT transaction_type, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY transaction_type
      ) grouped_income
    ), '[]'::JSONB),
    'expense_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', 'expense', 'label', keterangan, 'total', total, 'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) grouped_expense
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', daily_date, 'income', income, 'expense', expense) ORDER BY daily_date)
      FROM (
        SELECT
          generated_date::DATE AS daily_date,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type <> 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS income,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type = 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS expense
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') generated_date
        LEFT JOIN period_transactions pt ON pt.transaction_date = generated_date::DATE
        GROUP BY generated_date::DATE
      ) daily_totals
    ), '[]'::JSONB),
    'income_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', transaction_date,
        'type', transaction_type,
        'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END,
        'amount', nominal,
        'note', keterangan,
        'student_id', student_id,
        'student_name', student_name,
        'nis', nis,
        'kelas', kelas
      ) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions
      WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
    ), '[]'::JSONB),
    'expense_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'date', transaction_date, 'amount', nominal, 'note', keterangan
      ) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions
      WHERE NOT is_billing AND transaction_type = 'pengeluaran'
    ), '[]'::JSONB),
    'debts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_id', period_debts.student_id,
        'student_nama', COALESCE(st.nama, 'Siswa'),
        'nis', st.nis,
        'kelas', st.kelas,
        'total_debt', period_debts.total_debt,
        'debt_record_count', period_debts.debt_record_count,
        'oldest_debt_date', period_debts.oldest_debt_date
      ) ORDER BY period_debts.total_debt DESC, st.nama ASC)
      FROM period_debts
      LEFT JOIN public.students st ON st.id = period_debts.student_id
    ), '[]'::JSONB)
  )
  INTO v_report
  FROM summary, control;

  RETURN v_report;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_cash_summary(p_student_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tx AS (
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END), 0)::NUMERIC AS balance,
      COALESCE(SUM(CASE WHEN NOT COALESCE(is_billing, FALSE) AND type::TEXT <> 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS income,
      COALESCE(SUM(CASE WHEN NOT COALESCE(is_billing, FALSE) AND type::TEXT = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS expense
    FROM public.cash_transactions
    WHERE p_student_id IS NULL OR student_id = p_student_id
  ),
  debts AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC AS outstanding
    FROM public.debt_records
    WHERE status = 'unpaid'
      AND (p_student_id IS NULL OR student_id = p_student_id)
  )
  SELECT jsonb_build_object(
    'saldoUtama', tx.balance,
    'totalPemasukan', tx.income,
    'totalPengeluaran', tx.expense,
    'totalTunggakanSiswa', debts.outstanding
  )
  FROM tx, debts;
$function$;
CREATE OR REPLACE FUNCTION public.get_contest_achievement_detail(p_entry_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'entry', jsonb_build_object(
      'id', e.id,
      'contest_id', e.contest_id,
      'work_id', e.work_id,
      'pipeline_status', e.pipeline_status,
      'outcome_status', e.outcome_status,
      'result_label', e.result_label,
      'result_note', e.result_note,
      'submitted_at', e.submitted_at,
      'completed_at', e.completed_at,
      'work', jsonb_build_object(
        'id', mw.id,
        'title', mw.title,
        'work_type_code', mw.work_type_code,
        'description', mw.description,
        'duration_minutes', mw.duration_minutes,
        'production_year', mw.production_year,
        'primary_asset_url', mw.primary_asset_url,
        'video_url', mw.video_url
      ),
      'contest', jsonb_build_object(
        'id', c.id,
        'nama_lomba', c.nama_lomba,
        'kota', c.kota,
        'tingkat', c.tingkat,
        'tahun_event', c.tahun_event,
        'status_public', c.status_public
      )
    ),
    'awards', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'result_kind', r.result_kind,
          'result_title', r.result_title,
          'position', r.position,
          'category_name', r.category_name,
          'notes', r.notes,
          'created_at', r.created_at
        ) ORDER BY r.created_at, r.id
      )
      FROM public.contest_entry_results AS r
      WHERE r.entry_id = e.id AND r.is_active = TRUE
    ), '[]'::JSONB),
    'evidence', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'evidence_type', evidence.evidence_type,
          'target_status', evidence.target_status,
          'original_filename', evidence.original_filename,
          'mime_type', evidence.mime_type,
          'file_size_bytes', evidence.file_size_bytes,
          'created_at', evidence.created_at
        ) ORDER BY evidence.created_at, evidence.id
      )
      FROM public.contest_entry_evidence AS evidence
      WHERE evidence.entry_id = e.id
        AND evidence.upload_status = 'attached'
    ), '[]'::JSONB),
    'timeline', COALESCE((
      SELECT jsonb_agg(item ORDER BY item->>'created_at', item->>'id')
      FROM (
        SELECT jsonb_build_object(
          'id', status_history.id,
          'kind', 'status',
          'status', status_history.to_status,
          'from_status', status_history.from_status,
          'to_status', status_history.to_status,
          'change_reason', status_history.change_reason,
          'changed_by', status_history.changed_by,
          'changed_by_name', actor.nama,
          'created_at', status_history.created_at
        ) AS item
        FROM public.contest_entry_status_history AS status_history
        LEFT JOIN public.users AS actor ON actor.id = status_history.changed_by
        WHERE status_history.entry_id = e.id
        UNION ALL
        SELECT jsonb_build_object(
          'id', result_history.id,
          'kind', 'result',
          'status', result_history.to_outcome_status,
          'from_status', result_history.from_outcome_status,
          'to_status', result_history.to_outcome_status,
          'change_reason', result_history.change_reason,
          'changed_by', result_history.changed_by,
          'changed_by_name', actor.nama,
          'created_at', result_history.created_at
        ) AS item
        FROM public.contest_entry_result_history AS result_history
        LEFT JOIN public.users AS actor ON actor.id = result_history.changed_by
        WHERE result_history.entry_id = e.id
      ) AS timeline_rows
    ), '[]'::JSONB)
  )
  FROM public.contest_entries AS e
  JOIN public.contests AS c ON c.id = e.contest_id
  JOIN public.media_works AS mw ON mw.id = e.work_id
  WHERE e.id = p_entry_id
    AND e.pipeline_status = 'selesai';
$function$;
CREATE OR REPLACE FUNCTION public.get_equipment_primary_photo(p_equipment_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT COALESCE(NULLIF(BTRIM(e.foto_url), ''), NULLIF(BTRIM(e.fotos[1]), ''))
  FROM public.equipment AS e
  WHERE e.id = p_equipment_id;
$function$;
CREATE OR REPLACE FUNCTION public.get_operational_dashboard_summary(p_report_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH report_window AS (
    SELECT
      COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE) AS report_date,
      date_trunc('month', COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE)::TIMESTAMP)::DATE AS month_start,
      (date_trunc('month', COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE)::TIMESTAMP) + INTERVAL '1 month')::DATE AS next_month_start
  ),
  student_summary AS (
    SELECT COUNT(*) FILTER (WHERE s.is_active IS TRUE)::INTEGER AS total_students
    FROM public.students AS s
  ),
  attendance_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE a.status = 'hadir')::INTEGER AS hadir,
      COUNT(*) FILTER (WHERE a.status = 'sakit')::INTEGER AS sakit,
      COUNT(*) FILTER (WHERE a.status = 'izin')::INTEGER AS izin,
      COUNT(*) FILTER (WHERE a.status = 'alpha')::INTEGER AS alpha,
      COUNT(*)::INTEGER AS total_recorded
    FROM public.attendance AS a
    CROSS JOIN report_window AS reporting
    WHERE a.tanggal = reporting.report_date
  ),
  cash_totals AS (
    SELECT COALESCE((summary.data->>'saldoUtama')::NUMERIC, 0)::NUMERIC AS balance
    FROM (SELECT public.get_cash_summary(NULL::UUID) AS data) AS summary
  ),
  monthly_cash AS (
    SELECT
      COALESCE(SUM(CASE WHEN NOT COALESCE(ct.is_billing, FALSE) AND ct.type::TEXT <> 'pengeluaran' THEN COALESCE(ct.nominal, 0) ELSE 0 END), 0)::NUMERIC AS monthly_income,
      COALESCE(SUM(CASE WHEN NOT COALESCE(ct.is_billing, FALSE) AND ct.type::TEXT = 'pengeluaran' THEN COALESCE(ct.nominal, 0) ELSE 0 END), 0)::NUMERIC AS monthly_expense
    FROM public.cash_transactions AS ct
    CROSS JOIN report_window AS reporting
    WHERE ct.tanggal >= reporting.month_start AND ct.tanggal < reporting.next_month_start
  ),
  recent_cash AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', recent.id::TEXT,
          'tipe', CASE WHEN recent.transaction_type = 'pengeluaran' THEN 'keluar' ELSE 'masuk' END,
          'jumlah', recent.nominal,
          'keterangan', recent.keterangan,
          'tanggal', recent.transaction_date::TEXT,
          'studentNama', recent.student_name
        )
        ORDER BY recent.transaction_date DESC NULLS LAST, recent.created_at DESC, recent.id DESC
      ),
      '[]'::JSONB
    ) AS transactions
    FROM (
      SELECT
        ct.id,
        ct.type::TEXT AS transaction_type,
        COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
        COALESCE(NULLIF(BTRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan,
        COALESCE(ct.tanggal, ct.created_at::DATE) AS transaction_date,
        ct.created_at,
        s.nama AS student_name
      FROM public.cash_transactions AS ct
      LEFT JOIN public.students AS s ON s.id = ct.student_id
      WHERE NOT COALESCE(ct.is_billing, FALSE)
      ORDER BY ct.tanggal DESC NULLS LAST, ct.created_at DESC, ct.id DESC
      LIMIT 3
    ) AS recent
  ),
  equipment_summary AS (
    SELECT
      COUNT(*)::INTEGER AS total_equipment,
      COUNT(*) FILTER (WHERE e.status = 'tersedia')::INTEGER AS available_equipment,
      COUNT(*) FILTER (WHERE e.status = 'dipinjam')::INTEGER AS borrowed_equipment,
      COUNT(*) FILTER (WHERE e.status = 'maintenance')::INTEGER AS maintenance_equipment,
      COUNT(*) FILTER (WHERE e.kondisi IN ('rusak', 'rusak_besar'))::INTEGER AS damaged_equipment
    FROM public.equipment AS e
  ),
  overdue_borrowings AS (
    SELECT COUNT(*)::INTEGER AS overdue_count
    FROM public.borrowings AS b
    WHERE b.status = 'borrowed' AND b.due_at IS NOT NULL AND b.due_at < NOW()
  ),
  latest_graded_student AS (
    SELECT DISTINCT ON (g.student_id) g.student_id, g.nilai::TEXT AS grade
    FROM public.grades AS g
    WHERE g.status = 'graded' AND g.nilai IS NOT NULL
    ORDER BY g.student_id, g.updated_at DESC NULLS LAST, g.id DESC
  ),
  grade_summary AS (
    SELECT
      COUNT(*)::INTEGER AS evaluated_students,
      COUNT(*) FILTER (WHERE latest.grade = 'A')::INTEGER AS grade_a,
      COUNT(*) FILTER (WHERE latest.grade = 'B')::INTEGER AS grade_b,
      COUNT(*) FILTER (WHERE latest.grade = 'C')::INTEGER AS grade_c,
      COUNT(*) FILTER (WHERE latest.grade = 'D')::INTEGER AS grade_d,
      COUNT(*) FILTER (WHERE latest.grade = 'E')::INTEGER AS grade_e
    FROM latest_graded_student AS latest
  )
  SELECT jsonb_build_object(
    'reportDate', reporting.report_date,
    'timezone', 'Asia/Jakarta',
    'kas', jsonb_build_object(
      'saldoTerakhir', cash.balance,
      'pemasukanBulanIni', monthly.monthly_income,
      'pengeluaranBulanIni', monthly.monthly_expense,
      'transaksiTerbaru', recent.transactions
    ),
    'absensi', jsonb_build_object(
      'hadir', attendance.hadir,
      'sakit', attendance.sakit,
      'izin', attendance.izin,
      'alpha', attendance.alpha,
      'totalSiswa', students.total_students,
      'totalTercatat', attendance.total_recorded,
      'persentaseHadir', CASE WHEN attendance.total_recorded = 0 THEN 0 ELSE ROUND((attendance.hadir::NUMERIC / attendance.total_recorded::NUMERIC) * 100, 2) END
    ),
    'alat', jsonb_build_object(
      'tersedia', equipment.available_equipment,
      'dipinjam', equipment.borrowed_equipment,
      'maintenance', equipment.maintenance_equipment,
      'rusak', equipment.damaged_equipment,
      'totalAlat', equipment.total_equipment,
      'overdueCount', overdue.overdue_count
    ),
    'gradeDistribution', jsonb_build_object(
      'totalSiswaEvaluated', grades.evaluated_students,
      'distribution', jsonb_build_object('A', grades.grade_a, 'B', grades.grade_b, 'C', grades.grade_c, 'D', grades.grade_d, 'E', grades.grade_e)
    )
  )
  FROM report_window AS reporting
  CROSS JOIN student_summary AS students
  CROSS JOIN attendance_summary AS attendance
  CROSS JOIN cash_totals AS cash
  CROSS JOIN monthly_cash AS monthly
  CROSS JOIN recent_cash AS recent
  CROSS JOIN equipment_summary AS equipment
  CROSS JOIN overdue_borrowings AS overdue
  CROSS JOIN grade_summary AS grades;
$function$;
CREATE OR REPLACE FUNCTION public.guard_agenda_activity_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.pic_names_search := array_to_string(NEW.pic_names, ' ');
  IF NEW.activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_FUTURE_DATE_FORBIDDEN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.pic_names) AS pic(name)
    WHERE name IS NULL OR length(btrim(name)) NOT BETWEEN 2 AND 100 OR name ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PIC_INVALID';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_borrowing_return_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'returned' AND EXISTS (
    SELECT 1
    FROM public.borrowing_items
    WHERE borrowing_id = NEW.id
      AND status IN ('borrowed', 'pending_resolution')
  ) THEN
    NEW.status := CASE
      WHEN EXISTS (
        SELECT 1 FROM public.borrowing_return_reports
        WHERE borrowing_id = NEW.id AND status = 'pending_verification'
      ) THEN 'pending_verification'
      ELSE 'partial'
    END;
    NEW.returned_at := OLD.returned_at;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_cash_dispute_actor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.created_by IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.id = NEW.student_id
      AND s.user_id = NEW.created_by
      AND s.is_active = TRUE
      AND u.is_active = TRUE
      AND u.role::TEXT <> 'teacher'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_cash_dispute_reviewer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND (NEW.resolved_by IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.users
       WHERE id = NEW.resolved_by AND is_active = TRUE AND role::TEXT = 'teacher'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEWER_INVALID';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_return_report_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1
    FROM public.borrowing_items
    WHERE borrowing_id = NEW.borrowing_id
      AND status IN ('borrowed', 'pending_resolution')
  ) THEN
    NEW.status := 'pending_verification';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_social_insight_recorded()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_platform TEXT;
  v_expected_end DATE;
  v_expected_start DATE;
  v_metric_count INTEGER;
  v_evidence_count INTEGER;
BEGIN
  IF NEW.archive_month IS NOT NULL THEN
    SELECT platform INTO v_platform
    FROM public.social_accounts
    WHERE id = NEW.social_account_id;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ACCOUNT_NOT_FOUND';
    END IF;

    v_expected_end := (NEW.archive_month + INTERVAL '1 month - 1 day')::DATE;
    v_expected_start := CASE
      WHEN v_platform = 'whatsapp' THEN v_expected_end - 29
      ELSE NEW.archive_month
    END;

    IF NEW.archive_month >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
       OR NEW.period_start IS DISTINCT FROM v_expected_start
       OR NEW.period_end IS DISTINCT FROM v_expected_end THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_PERIOD_INVALID';
    END IF;

    IF NEW.interactions IS NOT NULL OR NEW.published_count IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_LEGACY_METRIC_INVALID';
    END IF;

    v_metric_count := CASE v_platform
      WHEN 'instagram' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.reach IS NOT NULL)::INTEGER
        + (NEW.profile_visits IS NOT NULL)::INTEGER + (NEW.likes IS NOT NULL)::INTEGER
        + (NEW.comments IS NOT NULL)::INTEGER + (NEW.shares IS NOT NULL)::INTEGER
        + (NEW.saves IS NOT NULL)::INTEGER
      WHEN 'tiktok' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.profile_visits IS NOT NULL)::INTEGER
        + (NEW.likes IS NOT NULL)::INTEGER + (NEW.comments IS NOT NULL)::INTEGER
        + (NEW.shares IS NOT NULL)::INTEGER + (NEW.followers_gained IS NOT NULL)::INTEGER
      WHEN 'youtube' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.watch_time_minutes IS NOT NULL)::INTEGER
        + (NEW.subscribers_gained IS NOT NULL)::INTEGER + (NEW.subscribers_lost IS NOT NULL)::INTEGER
        + (NEW.impressions IS NOT NULL)::INTEGER
      WHEN 'whatsapp' THEN
        (NEW.reach IS NOT NULL)::INTEGER + (NEW.followers_gained IS NOT NULL)::INTEGER
        + (NEW.followers_lost IS NOT NULL)::INTEGER + (NEW.reactions IS NOT NULL)::INTEGER
        + (NEW.poll_votes IS NOT NULL)::INTEGER
      ELSE 0
    END;

    IF v_metric_count = 0
       OR (v_platform NOT IN ('instagram', 'whatsapp') AND NEW.reach IS NOT NULL)
       OR (v_platform <> 'instagram' AND NEW.saves IS NOT NULL)
       OR (v_platform = 'whatsapp' AND NEW.views IS NOT NULL)
       OR (v_platform NOT IN ('instagram', 'tiktok') AND (NEW.profile_visits IS NOT NULL OR NEW.likes IS NOT NULL OR NEW.comments IS NOT NULL OR NEW.shares IS NOT NULL))
       OR (v_platform <> 'youtube' AND (NEW.watch_time_minutes IS NOT NULL OR NEW.subscribers_gained IS NOT NULL OR NEW.subscribers_lost IS NOT NULL OR NEW.impressions IS NOT NULL))
       OR (v_platform NOT IN ('tiktok', 'whatsapp') AND (NEW.followers_gained IS NOT NULL OR NEW.followers_lost IS NOT NULL))
       OR (v_platform <> 'whatsapp' AND (NEW.reactions IS NOT NULL OR NEW.poll_votes IS NOT NULL)) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_METRICS_INVALID';
    END IF;
  END IF;

  IF NEW.status = 'recorded' THEN
    SELECT count(*) INTO v_evidence_count
    FROM public.social_media_evidence
    WHERE insight_period_id = NEW.id AND upload_status = 'attached';
    IF v_evidence_count < 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_INSIGHT_EVIDENCE_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_social_publication_recorded()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_platform TEXT;
  v_evidence_count INTEGER;
BEGIN
  SELECT platform INTO v_platform FROM public.social_accounts WHERE id = NEW.social_account_id;
  IF v_platform IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ACCOUNT_NOT_FOUND'; END IF;
  IF NEW.platform IS DISTINCT FROM v_platform THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PLATFORM_MISMATCH'; END IF;
  IF NEW.content_type = 'story' AND NEW.platform NOT IN ('instagram', 'tiktok') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_STORY_PLATFORM_INVALID';
  END IF;
  IF NOT (
    (NEW.platform = 'instagram' AND NEW.content_type IN ('feed', 'reel', 'story'))
    OR (NEW.platform = 'tiktok' AND NEW.content_type IN ('video', 'story'))
    OR (NEW.platform = 'youtube' AND NEW.content_type IN ('video', 'short', 'community_post'))
    OR (NEW.platform = 'whatsapp' AND NEW.content_type = 'channel_post')
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PLATFORM_MISMATCH'; END IF;
  IF NEW.platform_url IS NOT NULL AND btrim(NEW.platform_url) <> '' AND NOT (
    (NEW.platform = 'instagram' AND NEW.platform_url ~* '^https://([a-z0-9-]+\.)?instagram\.com(/|$)')
    OR (NEW.platform = 'tiktok' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)(/|$)')
    OR (NEW.platform = 'youtube' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?youtube\.com|youtu\.be)(/|$)')
    OR (NEW.platform = 'whatsapp' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?whatsapp\.com|([a-z0-9-]+\.)?whatsapp\.net|wa\.me)(/|$)')
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_LINK_INVALID'; END IF;
  IF NEW.status = 'recorded' THEN
    IF NEW.content_type = 'story' THEN
      SELECT count(*) INTO v_evidence_count FROM public.social_media_evidence
      WHERE publication_id = NEW.id AND upload_status = 'attached';
      IF v_evidence_count < 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_STORY_EVIDENCE_REQUIRED'; END IF;
    ELSIF NEW.platform IN ('instagram', 'tiktok', 'youtube') THEN
      IF NEW.platform_url IS NULL OR btrim(NEW.platform_url) = '' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_LINK_REQUIRED'; END IF;
    ELSIF NEW.platform = 'whatsapp' THEN
      SELECT count(*) INTO v_evidence_count FROM public.social_media_evidence
      WHERE publication_id = NEW.id AND upload_status = 'attached';
      IF (NEW.platform_url IS NULL OR btrim(NEW.platform_url) = '') AND v_evidence_count < 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handover_borrowing_atomic(p_borrowing_id uuid, p_handover_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Sinkronkan konteks dengan trigger Zero Silent Edits pada database lama.
  PERFORM set_config('app.current_user_id', COALESCE(p_handover_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan serah-terima minimal 5 karakter.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Peminjaman tidak ditemukan.';
  END IF;
  IF v_current_status <> 'approved' THEN
    RAISE EXCEPTION 'Peminjaman belum disetujui atau sudah diserahkan.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id) THEN
    RAISE EXCEPTION 'Detail alat belum tersedia pada peminjaman ini. Rekonsiliasi data lama terlebih dahulu.';
  END IF;

  PERFORM 1
  FROM public.equipment e
  JOIN public.borrowing_items bi ON bi.equipment_id = e.id
  WHERE bi.borrowing_id = p_borrowing_id
  ORDER BY e.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.borrowing_items bi
    JOIN public.equipment e ON e.id = bi.equipment_id
    WHERE bi.borrowing_id = p_borrowing_id
      AND (bi.status <> 'approved' OR COALESCE(e.status, e.availability_status::TEXT) <> 'tersedia')
  ) THEN
    RAISE EXCEPTION 'Kondisi alat berubah. Periksa kembali ketersediaan sebelum serah-terima.';
  END IF;

  UPDATE public.borrowing_items
  SET status = 'borrowed', tanggal_diserahkan = NOW(), updated_by = p_handover_by, updated_at = NOW()
  WHERE borrowing_id = p_borrowing_id;

  UPDATE public.equipment e
  SET status = 'dipinjam',
      availability_status = 'dipinjam',
      updated_at = NOW()
  WHERE e.id IN (
    SELECT equipment_id FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id
  );

  UPDATE public.borrowings
  SET status = 'borrowed', borrowed_at = NOW(), updated_by = p_handover_by, updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, new_values, change_reason
  ) VALUES (
    p_handover_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'borrowed'), trim(p_change_reason)
  );

  RETURN p_borrowing_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.is_login_rate_limited(p_rate_key text, p_window_seconds integer DEFAULT 300, p_max_attempts integer DEFAULT 10)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(
    (
      SELECT
        failure_count >= p_max_attempts
        AND EXTRACT(
          EPOCH FROM (
            NOW() - window_started_at
          )
        ) < p_window_seconds
      FROM public.api_login_rate_limits
      WHERE rate_key = p_rate_key
    ),
    FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.link_account_to_existing_student_atomic(p_student_id uuid, p_user_id uuid, p_actor_id uuid, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_active BOOLEAN;
  v_target public.users%ROWTYPE;
  v_student public.students%ROWTYPE;
BEGIN
  IF p_student_id IS NULL OR p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_LINK_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT u.* INTO v_target
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_target.is_active IS DISTINCT FROM TRUE
     OR v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')
     OR EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.* INTO v_student
  FROM public.students AS s
  WHERE s.id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.user_id IS NOT NULL OR v_student.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET nama = v_student.nama,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  UPDATE public.students AS s
  SET user_id = p_user_id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE s.id = p_student_id AND s.user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', p_user_id,
    'username', v_target.username,
    'nama', v_student.nama,
    'role', v_target.role::TEXT,
    'is_first_login', v_target.is_first_login,
    'previous_account', jsonb_build_object(
      'username', v_target.username,
      'nama', v_target.nama,
      'role', v_target.role::TEXT
    )
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.link_existing_student_account_atomic(p_user_id uuid, p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_actor_id uuid, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_active BOOLEAN;
  v_target public.users%ROWTYPE;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_LINK_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_nis IS NULL OR LENGTH(v_nis) > 40
     OR v_nama IS NULL OR LENGTH(v_nama) NOT BETWEEN 2 AND 120
     OR v_kelas IS NULL OR LENGTH(v_kelas) > 80 THEN
    RAISE EXCEPTION 'Data siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT u.* INTO v_target
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_target.is_active IS DISTINCT FROM TRUE
     OR v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')
     OR EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET nama = v_nama,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    p_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    NULLIF(BTRIM(p_no_telepon), ''), NULLIF(BTRIM(p_foto_url), ''),
    v_target.is_active, p_actor_id, p_actor_id, NOW()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', p_user_id,
    'username', v_target.username,
    'nama', v_nama,
    'role', v_target.role::TEXT,
    'is_first_login', v_target.is_first_login,
    'previous_account', jsonb_build_object(
      'username', v_target.username,
      'nama', v_target.nama,
      'role', v_target.role::TEXT
    )
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.list_contest_achievements_grouped(p_search text DEFAULT NULL::text, p_result_kind text DEFAULT NULL::text, p_position integer DEFAULT NULL::integer, p_outcome_status text DEFAULT NULL::text, p_tahun_event integer DEFAULT NULL::integer, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH filtered AS (
    SELECT
      e.id AS entry_id,
      e.contest_id,
      e.work_id,
      e.pipeline_status,
      e.outcome_status,
      e.result_label,
      e.result_note,
      e.completed_at,
      e.created_at,
      mw.title AS work_title,
      mw.work_type_code,
      c.nama_lomba,
      c.kota,
      c.tingkat,
      c.tahun_event,
      c.status_public
    FROM public.contest_entries AS e
    JOIN public.contests AS c ON c.id = e.contest_id
    JOIN public.media_works AS mw ON mw.id = e.work_id
    WHERE e.pipeline_status = 'selesai'
      AND (NULLIF(btrim(p_outcome_status), '') IS NULL OR e.outcome_status = btrim(p_outcome_status))
      AND (p_tahun_event IS NULL OR c.tahun_event = p_tahun_event)
      AND (
        NULLIF(btrim(p_result_kind), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND r.result_kind = btrim(p_result_kind)
        )
      )
      AND (
        p_position IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND r.position = p_position
        )
      )
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.nama_lomba ILIKE '%' || btrim(p_search) || '%'
        OR c.kota ILIKE '%' || btrim(p_search) || '%'
        OR mw.title ILIKE '%' || btrim(p_search) || '%'
        OR COALESCE(e.result_label, '') ILIKE '%' || btrim(p_search) || '%'
        OR (e.outcome_status = 'not_awarded' AND 'Tidak mendapat penghargaan' ILIKE '%' || btrim(p_search) || '%')
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND (
              r.result_title ILIKE '%' || btrim(p_search) || '%'
              OR COALESCE(r.category_name, '') ILIKE '%' || btrim(p_search) || '%'
              OR (r.result_kind = 'rank' AND ('Juara ' || r.position::TEXT) ILIKE '%' || btrim(p_search) || '%')
              OR (r.result_kind = 'top_n' AND (r.position::TEXT || ' besar') ILIKE '%' || btrim(p_search) || '%')
            )
        )
      )
  ),
  grouped AS (
    SELECT
      f.*,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'result_kind', r.result_kind,
            'result_title', r.result_title,
            'position', r.position,
            'category_name', r.category_name,
            'notes', r.notes,
            'created_at', r.created_at
          ) ORDER BY r.created_at, r.id
        )
        FROM public.contest_entry_results AS r
        WHERE r.entry_id = f.entry_id AND r.is_active = TRUE
      ), '[]'::JSONB) AS awards,
      (
        SELECT count(*)::INTEGER
        FROM public.contest_entry_evidence AS evidence
        WHERE evidence.entry_id = f.entry_id
          AND evidence.upload_status = 'attached'
      ) AS evidence_count
    FROM filtered AS f
  ),
  numbered AS (
    SELECT grouped.*, count(*) OVER () AS total
    FROM grouped
    ORDER BY completed_at DESC NULLS LAST, entry_id DESC
    OFFSET GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100)
    LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(numbered) - 'total') FROM numbered), '[]'::JSONB),
    'total', COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM grouped)),
    'page', GREATEST(p_page, 1),
    'pageSize', LEAST(GREATEST(p_page_size, 1), 100),
    'totalPages', GREATEST(
      1,
      CEIL(
        COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM grouped))::NUMERIC
        / LEAST(GREATEST(p_page_size, 1), 100)
      )::INTEGER
    )
  );
$function$;
CREATE OR REPLACE FUNCTION public.list_contest_achievements(p_search text DEFAULT NULL::text, p_result_kind text DEFAULT NULL::text, p_position integer DEFAULT NULL::integer, p_outcome_status text DEFAULT NULL::text, p_tahun_event integer DEFAULT NULL::integer, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH filtered AS (
    SELECT
      r.id AS result_id,
      e.id AS entry_id,
      e.contest_id,
      e.work_id,
      e.pipeline_status,
      e.outcome_status,
      mw.title AS work_title,
      mw.work_type_code,
      c.nama_lomba,
      c.kota,
      c.tingkat,
      c.tahun_event,
      c.status_public,
      CASE WHEN r.id IS NULL THEN NULL ELSE r.result_kind END AS result_kind,
      CASE
        WHEN r.id IS NOT NULL THEN r.result_title
        WHEN e.outcome_status = 'pending' THEN 'Menunggu hasil'
        ELSE 'Tidak mendapat penghargaan'
      END AS result_title,
      r.position,
      r.category_name,
      r.notes,
      r.created_at
    FROM public.contest_entries e
    JOIN public.contests c ON c.id = e.contest_id
    JOIN public.media_works mw ON mw.id = e.work_id
    LEFT JOIN public.contest_entry_results r
      ON r.entry_id = e.id AND r.is_active = TRUE
    WHERE (e.pipeline_status = 'selesai' OR e.outcome_status IN ('awarded', 'not_awarded'))
      AND (NULLIF(btrim(p_result_kind), '') IS NULL OR r.result_kind = btrim(p_result_kind))
      AND (p_position IS NULL OR r.position = p_position)
      AND (NULLIF(btrim(p_outcome_status), '') IS NULL OR e.outcome_status = btrim(p_outcome_status))
      AND (p_tahun_event IS NULL OR c.tahun_event = p_tahun_event)
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.nama_lomba ILIKE '%' || btrim(p_search) || '%'
        OR c.kota ILIKE '%' || btrim(p_search) || '%'
        OR mw.title ILIKE '%' || btrim(p_search) || '%'
        OR r.result_title ILIKE '%' || btrim(p_search) || '%'
        OR r.category_name ILIKE '%' || btrim(p_search) || '%'
        OR (r.result_kind = 'rank' AND ('Juara ' || r.position::TEXT) ILIKE '%' || btrim(p_search) || '%')
        OR (r.result_kind = 'top_n' AND (r.position::TEXT || ' besar') ILIKE '%' || btrim(p_search) || '%')
        OR (r.id IS NULL AND e.outcome_status = 'pending' AND 'Menunggu hasil' ILIKE '%' || btrim(p_search) || '%')
        OR (r.id IS NULL AND e.outcome_status = 'not_awarded' AND 'Tidak mendapat penghargaan' ILIKE '%' || btrim(p_search) || '%')
      )
  ),
  numbered AS (
    SELECT filtered.*, count(*) OVER () AS total
    FROM filtered
    ORDER BY created_at DESC NULLS LAST, entry_id DESC, result_id DESC NULLS LAST
    OFFSET GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100)
    LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(numbered) - 'total') FROM numbered), '[]'::JSONB),
    'total', COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM filtered)),
    'page', GREATEST(p_page, 1),
    'pageSize', LEAST(GREATEST(p_page_size, 1), 100),
    'totalPages', GREATEST(1, CEIL(COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM filtered))::NUMERIC / LEAST(GREATEST(p_page_size, 1), 100))::INTEGER)
  );
$function$;
CREATE OR REPLACE FUNCTION public.list_unlinked_student_accounts(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, username text, nama text, role text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_active BOOLEAN;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT
  FROM public.users AS u
  WHERE u.is_active IS TRUE
    AND u.id <> p_actor_id
    AND u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')
    AND NOT EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = u.id)
    AND (
      v_search IS NULL
      OR u.nama ILIKE '%' || v_search || '%'
      OR u.username ILIKE '%' || v_search || '%'
    )
  ORDER BY u.nama, u.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20);
END;
$function$;
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_id UUID;
  reason TEXT;
  old_payload JSONB;
  new_payload JSONB;
  is_system_operation BOOLEAN := COALESCE(NULLIF(current_setting('app.system_operation', TRUE), '') = 'true', FALSE);
BEGIN
  IF COALESCE(NULLIF(current_setting('app.skip_legacy_audit', TRUE), ''), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  BEGIN
    actor_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    reason := NULLIF(current_setting('app.change_reason', TRUE), '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Aksi Ditolak: app.current_user_id dan app.change_reason wajib diset di level session.';
  END;

  IF reason IS NULL OR (actor_id IS NULL AND NOT is_system_operation) THEN
    RAISE EXCEPTION 'Aksi Ditolak: Prinsip Zero Silent Edits dilanggar (ID/Alasan kosong).';
  END IF;

  old_payload := public.redact_audit_json(to_jsonb(OLD));
  new_payload := public.redact_audit_json(to_jsonb(NEW));

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values,
    aksi, tabel, data_lama, data_baru, change_reason, source
  ) VALUES (
    actor_id, TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), old_payload, new_payload,
    TG_OP, TG_TABLE_NAME, old_payload, new_payload, reason, 'trigger'
  );
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_borrowing_recipients(p_borrowing_id uuid, p_event text, p_type notification_type, p_title text, p_body text, p_recipient_ids uuid[], p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_event_key TEXT;
BEGIN
  IF p_recipient_ids IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_user_id IN ARRAY p_recipient_ids
  LOOP
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    v_event_key := p_borrowing_id::TEXT || ':' || p_event || ':' || v_user_id::TEXT;

    INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
    VALUES (
      v_user_id,
      p_type,
      p_title,
      p_body,
      p_body,
      FALSE,
      COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
        'borrowing_id', p_borrowing_id,
        'event_key', v_event_key,
        'link_url', '/borrowing'
      )
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_borrowing_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_user_id UUID;
  v_student_name TEXT;
  v_equipment_names TEXT;
  v_teacher_ids UUID[];
  v_metadata JSONB;
BEGIN
  SELECT s.user_id, s.nama
  INTO v_student_user_id, v_student_name
  FROM public.students s
  WHERE s.id = NEW.student_id;

  SELECT COALESCE(string_agg(e.nama_alat, ', ' ORDER BY e.nama_alat), 'alat yang dipilih')
  INTO v_equipment_names
  FROM public.borrowing_items bi
  JOIN public.equipment e ON e.id = bi.equipment_id
  WHERE bi.borrowing_id = NEW.id;

  v_metadata := jsonb_build_object(
    'student_id', NEW.student_id,
    'equipment', v_equipment_names,
    'due_at', NEW.due_at
  );

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(array_agg(u.id), ARRAY[]::UUID[])
    INTO v_teacher_ids
    FROM public.users u
    WHERE u.role::TEXT = 'teacher' AND u.is_active = TRUE;

    PERFORM public.notify_borrowing_recipients(
      NEW.id,
      'submitted',
      'system_alert',
      '📦 Peminjaman Baru Menunggu Persetujuan',
      format('Pengajuan peminjaman dari %s menunggu persetujuan Guru.', COALESCE(v_student_name, 'siswa')),
      v_teacher_ids,
      v_metadata
    );

    IF v_student_user_id IS NOT NULL THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'submitted',
        'system_alert',
        '📨 Pengajuan Peminjaman Diterima',
        'Pengajuan peminjaman Anda sudah tercatat dan sedang menunggu persetujuan Guru.',
        ARRAY[v_student_user_id],
        v_metadata
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND v_student_user_id IS NOT NULL THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'approved',
        'borrowing_approved',
        '✅ Peminjaman Alat Disetujui',
        format('Peminjaman %s telah disetujui Guru. Batas pengembalian: %s.', v_equipment_names, COALESCE(NEW.rencana_kembali::TEXT, NEW.due_at::DATE::TEXT, '-')),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'rejected',
        'borrowing_rejected',
        '❌ Peminjaman Alat Ditolak',
        format('Pengajuan peminjaman %s ditolak. Lihat catatan keputusan untuk detailnya.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'borrowed' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'handover',
        'system_alert',
        '🤝 Alat Berhasil Diserahkan',
        format('%s telah diserahkan dan tercatat sebagai alat yang sedang Anda pinjam.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'returned' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'returned',
        'system_alert',
        '↩️ Pengembalian Alat Tercatat',
        format('Pengembalian %s telah dicatat oleh petugas.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.open_return_recovery_case()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_borrowing_id UUID;
  v_item_status TEXT;
  v_actor_id UUID;
  v_change_reason TEXT;
  v_recovery_type TEXT;
BEGIN
  IF NEW.condition = 'bagus' THEN
    RETURN NEW;
  END IF;

  IF (NEW.condition = 'hilang' AND NEW.settlement_method <> 'replacement')
     OR (NEW.condition <> 'hilang' AND NEW.settlement_method <> 'repair') THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_METHOD_INVALID';
  END IF;

  v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_change_reason := NULLIF(current_setting('app.change_reason', true), '');
  IF v_actor_id IS NULL OR length(btrim(COALESCE(v_change_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_AUDIT_CONTEXT_REQUIRED';
  END IF;

  SELECT borrowing_id, status INTO v_borrowing_id, v_item_status
  FROM public.borrowing_items
  WHERE id = NEW.borrowing_item_id
  FOR UPDATE;
  IF v_borrowing_id IS NULL OR v_item_status <> 'borrowed' THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_ITEM_NOT_ACTIVE';
  END IF;

  -- The school has custody of the returned-but-damaged/missing item now. Keep
  -- the borrowing obligation open until the linked recovery case is completed.
  UPDATE public.borrowing_items
  SET status = 'pending_resolution',
      kondisi_kembali = NEW.condition,
      denda = NEW.charged_amount,
      tanggal_dikembalikan = NOW(),
      catatan = COALESCE(NEW.notes, catatan),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = NEW.borrowing_item_id;

  UPDATE public.equipment
  SET status = 'maintenance',
      availability_status = 'maintenance'::availability_status,
      kondisi = NEW.condition,
      physical_condition = NEW.condition::physical_condition,
      asset_state = CASE WHEN NEW.condition = 'hilang' THEN 'lost' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = NEW.equipment_id;

  v_recovery_type := CASE WHEN NEW.condition = 'hilang' THEN 'replacement' ELSE 'repair' END;
  PERFORM public.create_equipment_recovery_case_atomic(
    NEW.equipment_id,
    v_recovery_type,
    NEW.id,
    NEW.condition,
    COALESCE(NEW.notes, 'Tindak lanjut otomatis dari verifikasi pengembalian.'),
    v_actor_id,
    v_change_reason
  );

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_cash_transaction_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Transaksi kas bersifat append-only. Gunakan transaksi koreksi, bukan UPDATE atau DELETE.';
END;
$function$;
CREATE OR REPLACE FUNCTION public.preview_return_assessment(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB;
  v_equipment_id UUID;
  v_borrowing_item_id UUID;
  v_valuation_id UUID;
  v_condition TEXT;
  v_settlement TEXT;
  v_value NUMERIC(14, 2);
  v_repair_cost NUMERIC(14, 2);
  v_charge NUMERIC(14, 2);
  v_total NUMERIC(14, 2) := 0;
  v_items JSONB := '[]'::JSONB;
BEGIN
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Return item conditions are required.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    v_equipment_id := (v_item->>'equipment_id')::UUID;
    v_condition := v_item->>'kondisi_kembali';
    v_settlement := COALESCE(NULLIF(v_item->>'settlement_method', ''), CASE WHEN v_condition = 'bagus' THEN 'none' WHEN v_condition = 'hilang' THEN 'replacement' ELSE 'repair' END);
    v_repair_cost := NULLIF(trim(v_item->>'repair_cost'), '')::NUMERIC;
    v_value := NULL;
    v_valuation_id := NULL;
    v_charge := 0;

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed';
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

    IF v_settlement = 'replacement' THEN
      SELECT ev.replacement_value INTO v_value
      FROM public.equipment_valuations ev
      WHERE ev.equipment_id = v_equipment_id
        AND ev.effective_at <= (COALESCE(p_returned_at, CURRENT_DATE)::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY ev.effective_at DESC, ev.created_at DESC, ev.id DESC LIMIT 1;
      IF v_value IS NULL THEN RAISE EXCEPTION 'Replacement valuation is missing for equipment %.', v_equipment_id; END IF;
      v_charge := v_value;
    ELSIF v_settlement = 'repair' THEN
      IF v_repair_cost IS NULL OR v_repair_cost <= 0 THEN RAISE EXCEPTION 'A positive repair cost is required for repair settlement.'; END IF;
      v_charge := v_repair_cost;
    ELSIF v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Invalid settlement method.';
    END IF;

    v_total := v_total + v_charge;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'equipment_id', v_equipment_id, 'borrowing_item_id', v_borrowing_item_id,
      'condition', v_condition, 'settlement_method', v_settlement,
      'replacement_value', v_value, 'repair_cost', v_repair_cost, 'charge', v_charge
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'borrowing_id', p_borrowing_id, 'return_date', COALESCE(p_returned_at, CURRENT_DATE),
    'damage_charge', v_total, 'late_charge', 0, 'total_charge', v_total, 'items', v_items
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.protect_activity_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN RAISE EXCEPTION 'Aksi Ditolak: Audit log bersifat immutable.'; END;
$function$;
CREATE OR REPLACE FUNCTION public.protect_default_cash_payment_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.code = 'cash' AND NEW.is_active = FALSE THEN
    RAISE EXCEPTION 'Metode Cash adalah fallback histori dan tidak dapat dinonaktifkan.';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.provision_student_account_atomic(p_student_id uuid, p_username text, p_password_hash text, p_created_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
  v_user_id UUID;
  v_username TEXT := NULLIF(BTRIM(p_username), '');
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'ID siswa wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'Username akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR LENGTH(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Password hash akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Siswa ini sudah memiliki akun.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.users (
    username, password_hash, nama, role, is_first_login, is_active,
    created_by, updated_by, updated_at
  ) VALUES (
    v_username, p_password_hash, v_student.nama, 'member', TRUE, v_student.is_active,
    p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_user_id;

  UPDATE public.students
  SET user_id = v_user_id,
      updated_by = p_created_by,
      updated_at = NOW()
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', 'member',
    'is_first_login', TRUE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.provision_student_account_v2(p_student_id uuid, p_username text, p_password_hash text, p_no_telepon text, p_created_by uuid, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
  v_user_id UUID;
  v_username TEXT := lower(NULLIF(BTRIM(p_username), ''));
  v_phone TEXT := NULLIF(BTRIM(p_no_telepon), '');
  v_actor_active BOOLEAN;
  v_actor_role TEXT;
  v_inserted INTEGER;
  v_operation public.student_account_operations%ROWTYPE;
  v_operation_id UUID := COALESCE(p_operation_id, p_operation_key);
BEGIN
  IF p_student_id IS NULL OR p_created_by IS NULL OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_FINGERPRINT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_change_reason IS NULL OR length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_CHANGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active, u.role::TEXT
    INTO v_actor_active, v_actor_role
  FROM public.users AS u
  WHERE u.id = p_created_by;
  IF v_actor_active IS DISTINCT FROM TRUE OR NOT EXISTS (
    SELECT 1 FROM public.access_role_permissions AS rp
    WHERE rp.role_key = v_actor_role AND rp.permission_key = 'students.manage'
  ) THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+628[1-9][0-9]{7,10}$' THEN
    RAISE EXCEPTION 'INVALID_WHATSAPP_NUMBER' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'INVALID_PASSWORD_HASH' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_account_operations (
    actor_id, operation_key, operation_type, request_fingerprint
  ) VALUES (
    p_created_by, p_operation_key, 'provision', p_request_fingerprint
  ) ON CONFLICT (actor_id, operation_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_operation
    FROM public.student_account_operations AS op
    WHERE op.actor_id = p_created_by AND op.operation_key = p_operation_key
    FOR UPDATE;
    IF v_operation.operation_type <> 'provision'
       OR v_operation.request_fingerprint <> p_request_fingerprint
       OR v_operation.student_id <> p_student_id THEN
      RAISE EXCEPTION 'STUDENT_OPERATION_KEY_REUSED' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO v_student FROM public.students AS s WHERE s.id = v_operation.student_id;
    IF NOT FOUND OR v_student.user_id IS NULL THEN
      RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_RESULT_UNAVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    SELECT u.id INTO v_user_id FROM public.users AS u WHERE u.id = v_student.user_id;
    RETURN (
      SELECT jsonb_build_object(
        'student_id', v_student.id,
        'user_id', u.id,
        'username', u.username,
        'role', u.role::TEXT,
        'is_first_login', u.is_first_login,
        'operation_replayed', TRUE
      ) FROM public.users AS u WHERE u.id = v_user_id
    );
  END IF;

  SELECT * INTO v_student
  FROM public.students AS s
  WHERE s.id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_student.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_EXISTS' USING ERRCODE = '23505';
  END IF;

  BEGIN
    INSERT INTO public.users (
      username, password_hash, nama, role, is_first_login, is_active,
      created_by, updated_by, updated_at
    ) VALUES (
      v_username, p_password_hash, v_student.nama, 'member', TRUE, v_student.is_active,
      p_created_by, p_created_by, NOW()
    ) RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.users AS u WHERE lower(btrim(u.username)) = v_username) THEN
      RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = '23505', CONSTRAINT = 'uq_users_username_normalized';
    END IF;
    RAISE;
  END;

  UPDATE public.students
  SET user_id = v_user_id,
      no_telepon = v_phone,
      updated_by = p_created_by,
      updated_at = NOW()
  WHERE id = p_student_id;

  UPDATE public.student_account_operations
  SET student_id = p_student_id, user_id = v_user_id
  WHERE actor_id = p_created_by AND operation_key = p_operation_key;

  PERFORM public.write_audit_log(
    p_created_by, 'UPDATE', 'students', p_student_id,
    jsonb_build_object('operation', 'student_account_missing'),
    jsonb_build_object('operation', 'student_account_provisioned', 'user_id', v_user_id),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'student_account_onboarding')
  );
  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'users', v_user_id, NULL,
    jsonb_build_object('operation', 'student_account_issued', 'student_id', p_student_id, 'username', v_username, 'role', 'member', 'is_first_login', TRUE),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'credential_issuance')
  );

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', 'member',
    'is_first_login', TRUE,
    'operation_replayed', FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.purge_expired_api_rate_limit_windows(p_batch_size integer DEFAULT 1000)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'API_RATE_LIMIT_INVALID_PURGE_LIMIT';
  END IF;
  DELETE FROM public.api_rate_limit_windows
  WHERE rate_key IN (
    SELECT rate_key FROM public.api_rate_limit_windows
    WHERE updated_at < clock_timestamp() - INTERVAL '2 days'
    ORDER BY updated_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;
CREATE OR REPLACE FUNCTION public.purge_student_history_atomic(p_student_id uuid, p_actor_id uuid, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
  v_actor_allowed BOOLEAN;
  v_user_id UUID;
  v_deleted_user BOOLEAN := FALSE;
  v_account_deactivated BOOLEAN := FALSE;
  v_deleted_attendance BIGINT := 0;
  v_deleted_debt_records BIGINT := 0;
  v_deleted_billing_transactions BIGINT := 0;
  v_deleted_equipment_charges BIGINT := 0;
  v_preserved_cash_transactions BIGINT := 0;
BEGIN
  IF p_student_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_PURGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.access_role_permissions AS rp ON rp.role_key = u.role::TEXT
    WHERE u.id = p_actor_id
      AND u.is_active IS TRUE
      AND rp.permission_key = 'users.manage'
  ) INTO v_actor_allowed;
  IF v_actor_allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.is_active IS TRUE THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  v_user_id := v_student.user_id;
  SELECT COUNT(*) INTO v_deleted_attendance FROM public.attendance WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_deleted_debt_records FROM public.debt_records WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_deleted_billing_transactions
  FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS TRUE;
  SELECT COUNT(*) INTO v_deleted_equipment_charges
  FROM public.equipment_charge_settlements
  WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_preserved_cash_transactions
  FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS FALSE;

  -- Billing rows are receivables, not money movement. Remove them with the
  -- student's debt records; keep and detach real cash movements below.
  DELETE FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS TRUE;
  DELETE FROM public.debt_records WHERE student_id = p_student_id;
  DELETE FROM public.equipment_charge_settlements WHERE student_id = p_student_id;

  -- ON DELETE behaviour differs between legacy deployments. Explicitly detach
  -- real cash movements so this purge can never change cashflow or saldo.
  UPDATE public.cash_transactions
  SET student_id = NULL
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS FALSE;

  DELETE FROM public.students WHERE id = p_student_id;

  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.users WHERE id = v_user_id;
      v_deleted_user := TRUE;
    EXCEPTION
      WHEN foreign_key_violation THEN
        UPDATE public.users
        SET is_active = FALSE, updated_by = p_actor_id, updated_at = NOW()
        WHERE id = v_user_id;
        v_account_deactivated := TRUE;
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%activity_logs bersifat immutable%' THEN
          UPDATE public.users
          SET is_active = FALSE, updated_by = p_actor_id, updated_at = NOW()
          WHERE id = v_user_id;
          v_account_deactivated := TRUE;
        ELSE
          RAISE;
        END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_user_id,
    'deleted_user', v_deleted_user,
    'account_deactivated', v_account_deactivated,
    'deleted_attendance', v_deleted_attendance,
    'deleted_debt_records', v_deleted_debt_records,
    'deleted_billing_transactions', v_deleted_billing_transactions,
    'deleted_equipment_charges', v_deleted_equipment_charges,
    'preserved_cash_transactions', v_preserved_cash_transactions
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_attendance_batch_atomic(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows JSONB := '[]'::JSONB;
  v_class TEXT := NULLIF(BTRIM(p_kelas), '');
  v_reason TEXT := NULLIF(BTRIM(p_change_reason), '');
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'ID penginput absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Akun penginput absensi tidak aktif atau tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Alasan pencatatan absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF v_class IS NULL OR LOWER(v_class) = 'all' THEN
    RAISE EXCEPTION 'Satu kelas wajib dipilih.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_records) <> 'array'
     OR jsonb_array_length(p_records) < 1
     OR jsonb_array_length(p_records) > 500 THEN
    RAISE EXCEPTION 'Batch absensi harus berisi 1 sampai 500 siswa.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'student_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'student_id harus berupa UUID yang valid.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'status', '') NOT IN ('hadir', 'sakit', 'izin', 'alpha')
  ) THEN
    RAISE EXCEPTION 'Status absensi tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'status', '') <> 'hadir'
      AND NULLIF(BTRIM(item->>'keterangan'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Keterangan wajib untuk Sakit, Izin, atau Alpha.' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_records) AS item
  ) <> (
    SELECT COUNT(DISTINCT (item->>'student_id')::UUID)
    FROM jsonb_array_elements(p_records) AS item
  ) THEN
    RAISE EXCEPTION 'Siswa duplikat tidak diperbolehkan dalam satu batch.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_records) AS item(student_id UUID, status TEXT, keterangan TEXT)
    LEFT JOIN public.students AS s ON s.id = item.student_id
    WHERE s.id IS NULL
       OR s.is_active IS NOT TRUE
       OR CASE
            WHEN v_class IN ('X', 'XI', 'XII') THEN NOT (s.kelas = v_class OR s.kelas LIKE v_class || ' %')
            ELSE s.kelas <> v_class
          END
  ) THEN
    RAISE EXCEPTION 'Ada siswa yang tidak aktif atau tidak berada di kelas terpilih.' USING ERRCODE = '22023';
  END IF;

  -- The legacy attendance trigger reads these transaction-local settings.
  -- They remain visible to log_activity() during this RPC transaction.
  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(v_reason, 500), TRUE);

  WITH incoming AS (
    SELECT
      item.student_id,
      item.status,
      NULLIF(BTRIM(item.keterangan), '') AS keterangan,
      format('att-%s-%s', item.student_id, p_tanggal) AS idempotency_key
    FROM jsonb_to_recordset(p_records) AS item(student_id UUID, status TEXT, keterangan TEXT)
  ), written AS (
    INSERT INTO public.attendance (
      student_id, tanggal, status, keterangan, idempotency_key,
      created_by, updated_by, updated_at
    )
    SELECT
      student_id, p_tanggal, status, keterangan, idempotency_key,
      p_actor_id, p_actor_id, NOW()
    FROM incoming
    ON CONFLICT (student_id, tanggal) DO UPDATE
      SET status = EXCLUDED.status,
          keterangan = EXCLUDED.keterangan,
          updated_by = p_actor_id,
          updated_at = NOW()
    RETURNING id, student_id, tanggal, status, keterangan, is_locked,
      idempotency_key, created_by, created_at, updated_by, updated_at
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(written) ORDER BY written.student_id), '[]'::JSONB)
  INTO v_rows
  FROM written;

  RETURN jsonb_build_object(
    'data', v_rows,
    'total', jsonb_array_length(v_rows),
    'tanggal', p_tanggal,
    'kelas', v_class
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_attendance_batch_atomic(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.record_attendance_batch_atomic(
    p_tanggal,
    p_kelas,
    p_records,
    p_actor_id,
    'Mencatat absensi massal'
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_in_atomic(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric)
 RETURNS SETOF cash_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing cash_transactions;
  v_transaction cash_transactions;
  v_debt debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_debt_key TEXT;
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus lebih besar dari nol.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe kas masuk tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pembayaran iuran.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  -- Serialize ledger writes. saldo_sebelum/sesudah must never be calculated concurrently.
  PERFORM pg_advisory_xact_lock(4815162342);

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0)
  INTO v_saldo_sebelum
  FROM cash_transactions;
  v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := CASE WHEN p_created_by ~* '^[0-9a-f-]{36}$' THEN p_created_by::UUID ELSE NULL END;
  v_current_period := to_char(CURRENT_DATE, 'IYYY-IW');

  PERFORM set_config('app.current_user_id', COALESCE(v_created_by::TEXT, ''), TRUE);
  PERFORM set_config(
    'app.change_reason',
    LEFT(COALESCE(NULLIF(TRIM(p_change_reason), ''), 'Pencatatan transaksi kas masuk'), 500),
    TRUE
  );

  INSERT INTO cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    p_type::transaction_type, p_nominal, TRIM(p_keterangan), v_student_id, p_foto_bukti_url,
    v_saldo_sebelum, v_saldo_sesudah, p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  -- A payment settles the oldest open debts first. If no debt exists yet and
  -- the payment is below the active weekly obligation, create the shortfall.
  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;
    SELECT EXISTS (
      SELECT 1 FROM debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;
    FOR v_debt IN
      SELECT * FROM debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE debt_records SET status = 'paid' WHERE id = v_debt.id;
        v_payment_remaining := v_payment_remaining - v_debt.amount;
      ELSE
        UPDATE debt_records SET amount = v_debt.amount - v_payment_remaining WHERE id = v_debt.id;
        v_payment_remaining := 0;
        EXIT;
      END IF;
      EXIT WHEN v_payment_remaining <= 0;
    END LOOP;

    IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
      v_debt_key := 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT;
      INSERT INTO debt_records (student_id, amount, status, keterangan, periode, idempotency_key, created_by)
      VALUES (
        v_student_id,
        p_weekly_due - v_payment_remaining,
        'unpaid',
        'Selisih pembayaran iuran mingguan',
        v_current_period,
        v_debt_key,
        v_created_by
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEXT v_transaction;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_in_on_date_atomic(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date)
 RETURNS SETOF cash_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_debt public.debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_debt_key TEXT;
BEGIN
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;
  IF p_nominal IS NULL OR p_nominal <= 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus berupa angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe kas masuk tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pembayaran iuran.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  -- Serialize all ledger writes so saldo_sebelum/saldo_sesudah remains valid.
  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type::TEXT = 'pengeluaran' THEN -nominal
      ELSE nominal
    END
  ), 0)
  INTO v_saldo_sebelum
  FROM public.cash_transactions;

  v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := p_created_by::UUID;
  v_current_period := to_char(p_tanggal, 'IYYY-IW');

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    p_type::public.transaction_type, p_nominal, TRIM(p_keterangan), v_student_id,
    p_foto_bukti_url, p_tanggal, v_saldo_sebelum, v_saldo_sesudah,
    p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  -- Apply the payment to the oldest unpaid debts and create the selected
  -- business week's shortfall when the payment is below the obligation.
  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;

    SELECT EXISTS (
      SELECT 1
      FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;

    FOR v_debt IN
      SELECT *
      FROM public.debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE public.debt_records
        SET status = 'paid'
        WHERE id = v_debt.id;
        v_payment_remaining := v_payment_remaining - v_debt.amount;
      ELSE
        UPDATE public.debt_records
        SET amount = v_debt.amount - v_payment_remaining
        WHERE id = v_debt.id;
        v_payment_remaining := 0;
        EXIT;
      END IF;
      EXIT WHEN v_payment_remaining <= 0;
    END LOOP;

    IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
      v_debt_key := 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT;
      INSERT INTO public.debt_records (
        student_id, amount, status, keterangan, periode, idempotency_key, created_by
      ) VALUES (
        v_student_id,
        p_weekly_due - v_payment_remaining,
        'unpaid',
        'Selisih pembayaran iuran mingguan',
        v_current_period,
        v_debt_key,
        v_created_by
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEXT v_transaction;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_in_on_date_with_method_atomic(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text)
 RETURNS SETOF cash_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_debt public.debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_payment_method_id UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_debt_key TEXT;
BEGIN
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;
  IF p_nominal IS NULL OR p_nominal <= 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus berupa angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe kas masuk tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pembayaran iuran.';
  END IF;
  IF p_student_id IS NOT NULL AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id::UUID AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type::TEXT = 'pengeluaran' THEN -nominal
      ELSE nominal
    END
  ), 0)
  INTO v_saldo_sebelum
  FROM public.cash_transactions;

  v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := p_created_by::UUID;
  v_current_period := to_char(p_tanggal, 'IYYY-IW');

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    p_type::public.transaction_type, p_nominal, TRIM(p_keterangan), v_student_id,
    p_foto_bukti_url, p_tanggal, v_saldo_sebelum, v_saldo_sesudah,
    p_idempotency_key, v_created_by, FALSE, v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;

    SELECT EXISTS (
      SELECT 1 FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;

    FOR v_debt IN
      SELECT * FROM public.debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE public.debt_records SET status = 'paid' WHERE id = v_debt.id;
        v_payment_remaining := v_payment_remaining - v_debt.amount;
      ELSE
        UPDATE public.debt_records
        SET amount = v_debt.amount - v_payment_remaining
        WHERE id = v_debt.id;
        v_payment_remaining := 0;
        EXIT;
      END IF;
      EXIT WHEN v_payment_remaining <= 0;
    END LOOP;

    IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
      v_debt_key := 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT;
      INSERT INTO public.debt_records (
        student_id, amount, status, keterangan, periode, idempotency_key, created_by
      ) VALUES (
        v_student_id, p_weekly_due - v_payment_remaining, 'unpaid',
        'Selisih pembayaran iuran mingguan', v_current_period, v_debt_key, v_created_by
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEXT v_transaction;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_in_with_status_atomic(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_debt public.debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_payment_method_id UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_debt_key TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_payment_status TEXT;
  v_amount_outstanding NUMERIC(12,2) := 0;
  v_already_recorded BOOLEAN := FALSE;
BEGIN
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;
  IF p_nominal IS NULL OR p_nominal < 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus nol atau angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe pemasukan kas tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pencatatan iuran.';
  END IF;
  IF p_nominal = 0 AND p_type <> 'iuran_wajib' THEN
    RAISE EXCEPTION 'Pemasukan lain-lain harus memiliki nominal lebih besar dari nol.';
  END IF;
  IF p_student_id IS NOT NULL AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND NOT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = p_student_id::UUID AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_created_by::UUID AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Aktor transaksi tidak aktif atau tidak ditemukan.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := p_created_by::UUID;
  v_current_period := to_char(p_tanggal, 'IYYY-IW');
  v_debt_key := CASE
    WHEN v_student_id IS NOT NULL THEN 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT
    ELSE NULL
  END;

  -- Nol berarti tidak ada kanal pembayaran. Jangan menerima code agar data
  -- akuntansi tidak menyatakan seolah-olah uang diterima melalui suatu kanal.
  IF p_nominal = 0 THEN
    IF NULLIF(TRIM(p_payment_method_code), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Metode pembayaran harus kosong jika iuran belum dibayar.';
    END IF;
    -- PostgreSQL CURRENT_DATE mengikuti timezone session (umumnya UTC di
    -- Supabase), sedangkan tanggal transaksi bisnis mengikuti WIB.
    IF p_tanggal > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
      RAISE EXCEPTION 'Tunggakan belum dapat dicatat untuk tanggal yang akan datang.';
    END IF;
    IF COALESCE(p_weekly_due, 0) <= 0 THEN
      RAISE EXCEPTION 'Konfigurasi iuran wajib tidak valid.';
    END IF;

    -- Serialisasi kewajiban siswa+minggu agar dua klik bersamaan tidak
    -- menghasilkan dua catatan tunggakan sebelum unique key diproses.
    PERFORM pg_advisory_xact_lock(hashtext(v_debt_key));

    -- Satu kewajiban mingguan per siswa. Retry dengan key berbeda tetap aman.
    SELECT * INTO v_debt
    FROM public.debt_records
    WHERE student_id = v_student_id AND periode = v_current_period
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    IF FOUND THEN
      v_already_recorded := TRUE;
      v_amount_outstanding := CASE WHEN v_debt.status::TEXT = 'unpaid' THEN v_debt.amount ELSE 0 END;
      RETURN jsonb_build_object(
        'payment_status', CASE WHEN v_amount_outstanding > 0 THEN 'unpaid' ELSE 'paid' END,
        'already_recorded', TRUE,
        'cash_transaction', NULL,
        'debt', to_jsonb(v_debt),
        'amount_due', p_weekly_due,
        'amount_paid', GREATEST(p_weekly_due - v_amount_outstanding, 0),
        'amount_outstanding', v_amount_outstanding,
        'payment_method', NULL
      );
    END IF;

    PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
    PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

    INSERT INTO public.debt_records (
      student_id, amount, status, keterangan, periode, idempotency_key, created_by
    ) VALUES (
      v_student_id,
      p_weekly_due,
      'unpaid',
      'Iuran mingguan belum dibayar',
      v_current_period,
      v_debt_key,
      v_created_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO v_debt;

    IF v_debt.id IS NULL THEN
      SELECT * INTO v_debt
      FROM public.debt_records
      WHERE idempotency_key = v_debt_key;
      v_already_recorded := TRUE;
    END IF;

    RETURN jsonb_build_object(
      'payment_status', 'unpaid',
      'already_recorded', v_already_recorded,
      'cash_transaction', NULL,
      'debt', to_jsonb(v_debt),
      'amount_due', p_weekly_due,
      'amount_paid', 0,
      'amount_outstanding', v_debt.amount,
      'payment_method', NULL
    );
  END IF;

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    IF v_student_id IS NOT NULL THEN
      SELECT * INTO v_debt
      FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period AND status = 'unpaid'
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    END IF;
    v_amount_outstanding := COALESCE(v_debt.amount, 0);
    RETURN jsonb_build_object(
      'payment_status', CASE WHEN v_amount_outstanding > 0 THEN 'partial' ELSE 'paid' END,
      'already_recorded', TRUE,
      'cash_transaction', to_jsonb(v_existing),
      'debt', CASE WHEN v_debt.id IS NULL THEN NULL ELSE to_jsonb(v_debt) END,
      'amount_due', CASE WHEN v_student_id IS NULL THEN 0 ELSE COALESCE(p_weekly_due, 0) END,
      'amount_paid', CASE WHEN v_student_id IS NULL THEN p_nominal ELSE GREATEST(COALESCE(p_weekly_due, 0) - v_amount_outstanding, 0) END,
      'amount_outstanding', v_amount_outstanding,
      'payment_method', p_payment_method_code
    );
  END IF;

  -- Serialisasi ledger dan kewajiban dilakukan dalam transaksi yang sama.
  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_status', 'paid',
      'already_recorded', TRUE,
      'cash_transaction', to_jsonb(v_existing),
      'debt', NULL,
      'amount_due', CASE WHEN v_student_id IS NULL THEN 0 ELSE COALESCE(p_weekly_due, 0) END,
      'amount_paid', p_nominal,
      'amount_outstanding', 0,
      'payment_method', p_payment_method_code
    );
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type::TEXT = 'pengeluaran' THEN -nominal
      ELSE nominal
    END
  ), 0)
  INTO v_saldo_sebelum
  FROM public.cash_transactions;

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    p_type::public.transaction_type,
    p_nominal,
    TRIM(p_keterangan),
    v_student_id,
    p_foto_bukti_url,
    p_tanggal,
    v_saldo_sebelum,
    v_saldo_sebelum + p_nominal,
    p_idempotency_key,
    v_created_by,
    FALSE,
    v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'payment_status', 'paid',
      'already_recorded', FALSE,
      'cash_transaction', to_jsonb(v_transaction),
      'debt', NULL,
      'amount_due', 0,
      'amount_paid', p_nominal,
      'amount_outstanding', 0,
      'payment_method', p_payment_method_code
    );
  END IF;

  v_payment_remaining := p_nominal;
  SELECT EXISTS (
    SELECT 1 FROM public.debt_records
    WHERE student_id = v_student_id AND periode = v_current_period
  ) INTO v_has_current_debt;

  FOR v_debt IN
    SELECT * FROM public.debt_records
    WHERE student_id = v_student_id AND status = 'unpaid'
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    IF v_payment_remaining >= v_debt.amount THEN
      UPDATE public.debt_records SET status = 'paid' WHERE id = v_debt.id;
      v_payment_remaining := v_payment_remaining - v_debt.amount;
    ELSE
      UPDATE public.debt_records
      SET amount = v_debt.amount - v_payment_remaining
      WHERE id = v_debt.id;
      v_payment_remaining := 0;
      EXIT;
    END IF;
    EXIT WHEN v_payment_remaining <= 0;
  END LOOP;

  IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
    INSERT INTO public.debt_records (
      student_id, amount, status, keterangan, periode, idempotency_key, created_by
    ) VALUES (
      v_student_id,
      p_weekly_due - v_payment_remaining,
      'unpaid',
      'Selisih pembayaran iuran mingguan',
      v_current_period,
      v_debt_key,
      v_created_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  SELECT * INTO v_debt
  FROM public.debt_records
  WHERE student_id = v_student_id
    AND periode = v_current_period
    AND status = 'unpaid'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_amount_outstanding := COALESCE(v_debt.amount, 0);
  v_payment_status := CASE WHEN v_amount_outstanding > 0 THEN 'partial' ELSE 'paid' END;

  RETURN jsonb_build_object(
    'payment_status', v_payment_status,
    'already_recorded', FALSE,
    'cash_transaction', to_jsonb(v_transaction),
    'debt', CASE WHEN v_debt.id IS NULL THEN NULL ELSE to_jsonb(v_debt) END,
    'amount_due', COALESCE(p_weekly_due, 0),
    'amount_paid', GREATEST(COALESCE(p_weekly_due, 0) - v_amount_outstanding, 0),
    'amount_outstanding', v_amount_outstanding,
    'payment_method', p_payment_method_code
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_out_atomic(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text)
 RETURNS SETOF cash_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing cash_transactions;
  v_transaction cash_transactions;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal kas keluar harus lebih besar dari nol.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Rincian pengeluaran wajib diisi.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(4815162342);
  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;
  SELECT COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0)
  INTO v_saldo_sebelum
  FROM cash_transactions;
  IF p_nominal > v_saldo_sebelum THEN
    RAISE EXCEPTION 'Saldo kas tidak mencukupi untuk pengeluaran ini.';
  END IF;
  v_saldo_sesudah := v_saldo_sebelum - p_nominal;
  v_created_by := CASE WHEN p_created_by ~* '^[0-9a-f-]{36}$' THEN p_created_by::UUID ELSE NULL END;

  PERFORM set_config('app.current_user_id', COALESCE(v_created_by::TEXT, ''), TRUE);
  PERFORM set_config(
    'app.change_reason',
    LEFT(COALESCE(NULLIF(TRIM(p_change_reason), ''), 'Pencatatan transaksi kas keluar'), 500),
    TRUE
  );

  INSERT INTO cash_transactions (
    type, nominal, keterangan, foto_bukti_url,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    'pengeluaran', p_nominal, TRIM(p_keterangan), p_foto_bukti_url,
    v_saldo_sebelum, v_saldo_sesudah, p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  RETURN NEXT v_transaction;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_cash_out_with_method_atomic(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_payment_method_code text)
 RETURNS SETOF cash_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_created_by UUID;
  v_payment_method_id UUID;
  v_saldo_sebelum NUMERIC(12,2);
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas keluar harus berupa angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Rincian pengeluaran wajib diisi.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);
  v_created_by := p_created_by::UUID;

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type::TEXT = 'pengeluaran' THEN -nominal
      ELSE nominal
    END
  ), 0)
  INTO v_saldo_sebelum
  FROM public.cash_transactions;

  IF p_nominal > v_saldo_sebelum THEN
    RAISE EXCEPTION 'Saldo kas tidak mencukupi untuk pengeluaran ini.';
  END IF;

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    'pengeluaran', p_nominal, TRIM(p_keterangan), p_foto_bukti_url, CURRENT_DATE,
    v_saldo_sebelum, v_saldo_sebelum - p_nominal, p_idempotency_key,
    v_created_by, FALSE, v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  RETURN NEXT v_transaction;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_contest_entry_result_atomic(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_evidence_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'CONTEST_RESULT_LEGACY_DISABLED';
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_equipment_charge_payment_atomic(p_settlement_id uuid, p_paid_amount numeric, p_status text, p_notes text, p_recorded_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'CHARGE_PAYMENT_LEGACY_DISABLED';
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_equipment_charge_payment_event_atomic(p_settlement_id uuid, p_payment_amount numeric, p_evidence_ids uuid[], p_notes text, p_recorded_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
  v_paid_amount NUMERIC;
  v_status TEXT;
  v_next_paid NUMERIC;
  v_payment_id UUID;
  v_evidence_count INTEGER;
  v_payment_evidence_count INTEGER;
  v_assessment_item_id UUID;
  v_recovery_type TEXT;
  v_resolution_evidence_count INTEGER;
  v_required_resolution_evidence INTEGER;
BEGIN
  IF p_settlement_id IS NULL OR p_recorded_by IS NULL THEN RAISE EXCEPTION 'CHARGE_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'CHARGE_CHANGE_REASON_REQUIRED'; END IF;
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 OR p_payment_amount > 9999999999.99 OR p_payment_amount <> round(p_payment_amount, 2) THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  IF p_evidence_ids IS NULL OR cardinality(p_evidence_ids) = 0 OR cardinality(p_evidence_ids) > 12 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_REQUIRED'; END IF;
  IF cardinality(p_evidence_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_evidence_ids) AS ids(id)) THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;

  SELECT amount, paid_amount, status, assessment_item_id INTO v_amount, v_paid_amount, v_status, v_assessment_item_id
  FROM public.equipment_charge_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'CHARGE_SETTLEMENT_NOT_FOUND'; END IF;
  IF v_status = 'waived' OR v_paid_amount >= v_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  v_next_paid := v_paid_amount + p_payment_amount;
  IF v_next_paid > v_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;

  SELECT count(*), count(*) FILTER (WHERE evidence_type = 'payment') INTO v_evidence_count, v_payment_evidence_count
  FROM public.equipment_evidence
  WHERE id = ANY(p_evidence_ids) AND settlement_id = p_settlement_id AND created_by = p_recorded_by
    AND upload_status = 'pending';
  IF v_evidence_count <> cardinality(p_evidence_ids) THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;
  IF v_payment_evidence_count = 0 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_REQUIRED'; END IF;

  SELECT recovery_type INTO v_recovery_type
  FROM public.equipment_recovery_cases
  WHERE assessment_item_id = v_assessment_item_id
    AND status IN ('open', 'in_progress', 'awaiting_verification')
  ORDER BY created_at DESC LIMIT 1;
  IF v_next_paid >= v_amount AND v_recovery_type IS NOT NULL THEN
    SELECT count(*) INTO v_resolution_evidence_count
    FROM public.equipment_evidence
    WHERE id = ANY(p_evidence_ids) AND evidence_type = v_recovery_type
      AND settlement_id = p_settlement_id AND created_by = p_recorded_by AND upload_status = 'pending';
    v_required_resolution_evidence := CASE
      WHEN v_recovery_type = 'replacement' THEN 3
      ELSE 2
    END;
    IF v_resolution_evidence_count < v_required_resolution_evidence THEN
      RAISE EXCEPTION 'CHARGE_RESOLUTION_EVIDENCE_REQUIRED';
    END IF;
  END IF;

  INSERT INTO public.equipment_charge_payments (settlement_id, amount, notes, recorded_by)
  VALUES (p_settlement_id, p_payment_amount, NULLIF(trim(p_notes), ''), p_recorded_by)
  RETURNING id INTO v_payment_id;

  UPDATE public.equipment_evidence
  SET payment_id = v_payment_id, upload_status = 'attached', updated_at = NOW()
  WHERE id = ANY(p_evidence_ids);

  UPDATE public.equipment_charge_settlements
  SET paid_amount = v_next_paid,
      status = CASE WHEN v_next_paid >= amount THEN 'paid' ELSE 'partial' END,
      notes = COALESCE(NULLIF(trim(p_notes), ''), notes), recorded_by = p_recorded_by, updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_recorded_by, 'INSERT', 'equipment_charge_payments', v_payment_id,
    jsonb_build_object('settlement_id', p_settlement_id, 'amount', p_payment_amount, 'evidence_count', cardinality(p_evidence_ids)), trim(p_change_reason));
  RETURN p_settlement_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_grades_bulk_atomic(p_assignment_id uuid, p_grades jsonb, p_graded_by uuid, p_change_reason text)
 RETURNS SETOF grades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item JSONB;
  v_student_id UUID;
  grade_row public.grades;
BEGIN
  IF p_graded_by IS NULL THEN
    RAISE EXCEPTION 'ID penginput nilai wajib diisi.';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan penyimpanan nilai minimal 5 karakter.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assignments WHERE id = p_assignment_id) THEN
    RAISE EXCEPTION 'Tugas penilaian tidak ditemukan.';
  END IF;

  IF p_grades IS NULL OR jsonb_typeof(p_grades) <> 'array' OR jsonb_array_length(p_grades) = 0 THEN
    RAISE EXCEPTION 'Daftar nilai tidak boleh kosong.';
  END IF;

  PERFORM set_config('app.current_user_id', p_graded_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(trim(p_change_reason), 500), TRUE);

  FOR item IN SELECT value FROM jsonb_array_elements(p_grades)
  LOOP
    BEGIN
      v_student_id := (item->>'student_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'ID siswa pada payload nilai tidak valid.';
    END;

    IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id) THEN
      RAISE EXCEPTION 'Siswa pada payload nilai tidak ditemukan.';
    END IF;

    IF item->>'nilai' NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      RAISE EXCEPTION 'Predikat nilai harus A, B, C, D, atau E.';
    END IF;

    INSERT INTO public.grades (
      student_id, assignment_id, nilai, status, keterangan, graded_by,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      v_student_id,
      p_assignment_id,
      (item->>'nilai')::grade_value,
      'graded',
      NULLIF(trim(item->>'keterangan'), ''),
      p_graded_by,
      p_graded_by,
      p_graded_by,
      NOW(),
      NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_student_assignment DO UPDATE SET
      nilai = EXCLUDED.nilai,
      status = EXCLUDED.status,
      keterangan = EXCLUDED.keterangan,
      graded_by = EXCLUDED.graded_by,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING * INTO grade_row;

    RETURN NEXT grade_row;
  END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_login_failure(p_rate_key text, p_window_seconds integer DEFAULT 300)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.api_login_rate_limits (
    rate_key,
    failure_count,
    window_started_at,
    updated_at
  )
  VALUES (
    p_rate_key,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (rate_key) DO UPDATE
  SET
    failure_count = CASE
      WHEN EXTRACT(
        EPOCH FROM (
          NOW() - api_login_rate_limits.window_started_at
        )
      ) >= p_window_seconds
      THEN 1
      ELSE api_login_rate_limits.failure_count + 1
    END,
    window_started_at = CASE
      WHEN EXTRACT(
        EPOCH FROM (
          NOW() - api_login_rate_limits.window_started_at
        )
      ) >= p_window_seconds
      THEN NOW()
      ELSE api_login_rate_limits.window_started_at
    END,
    updated_at = NOW();
END;
$function$;
CREATE OR REPLACE FUNCTION public.redact_audit_json(p_value jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL::JSONB
    WHEN jsonb_typeof(p_value) <> 'object' THEN p_value
    ELSE COALESCE((
      SELECT jsonb_object_agg(
        key,
        CASE
          WHEN lower(key) IN (
            'password', 'password_hash', 'token', 'access_token',
            'refresh_token', 'secret', 'api_key', 'apikey'
          ) THEN '"[REDACTED]"'::JSONB
          ELSE value
        END
      )
      FROM jsonb_each(p_value)
    ), '{}'::JSONB)
  END;
$function$;
CREATE OR REPLACE FUNCTION public.register_equipment_replacement_atomic(p_case_id uuid, p_equipment_code text, p_name text, p_category text, p_storage_location text, p_serial_number text, p_photo_urls jsonb, p_description text, p_replacement_value numeric, p_created_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_equipment_id UUID;
  v_case_type TEXT;
  v_case_status TEXT;
  v_old_condition TEXT;
  v_new_equipment_id UUID;
  v_photos TEXT[];
BEGIN
  IF p_case_id IS NULL OR p_created_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;
  IF NULLIF(trim(p_equipment_code), '') IS NULL OR NULLIF(trim(p_name), '') IS NULL OR NULLIF(trim(p_category), '') IS NULL THEN RAISE EXCEPTION 'REPLACEMENT_EQUIPMENT_REQUIRED'; END IF;
  IF p_photo_urls IS NULL OR jsonb_typeof(p_photo_urls) <> 'array' OR jsonb_array_length(p_photo_urls) < 3 OR jsonb_array_length(p_photo_urls) > 12 THEN RAISE EXCEPTION 'REPLACEMENT_PHOTOS_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_photo_urls) AS photo(value) WHERE value !~* '^(https?://[^[:space:]]+|data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$') THEN RAISE EXCEPTION 'REPLACEMENT_PHOTOS_INVALID'; END IF;
  IF p_replacement_value IS NOT NULL AND p_replacement_value <= 0 THEN RAISE EXCEPTION 'INVALID_REPLACEMENT_VALUE'; END IF;
  IF EXISTS (SELECT 1 FROM public.equipment WHERE kode_alat = trim(p_equipment_code)) THEN RAISE EXCEPTION 'EQUIPMENT_CODE_ALREADY_EXISTS'; END IF;

  SELECT equipment_id, recovery_type, status INTO v_old_equipment_id, v_case_type, v_case_status
  FROM public.equipment_recovery_cases WHERE id = p_case_id FOR UPDATE;
  IF v_old_equipment_id IS NULL THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_FOUND'; END IF;
  IF v_case_type <> 'replacement' THEN RAISE EXCEPTION 'RECOVERY_CASE_TYPE_INVALID'; END IF;
  IF v_case_status NOT IN ('open', 'in_progress', 'awaiting_verification') THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_OPEN'; END IF;
  SELECT kondisi INTO v_old_condition FROM public.equipment WHERE id = v_old_equipment_id FOR UPDATE;

  SELECT COALESCE(array_agg(value), ARRAY[]::TEXT[]) INTO v_photos
  FROM jsonb_array_elements_text(p_photo_urls) AS photo(value);
  INSERT INTO public.equipment (
    kode_alat, kode_qr, nama_alat, kategori, kondisi, physical_condition, status,
    availability_status, fotos, foto_url, lokasi_penyimpanan, serial_number, deskripsi, asset_state, created_by
  ) VALUES (
    trim(p_equipment_code), trim(p_equipment_code), trim(p_name), trim(p_category), 'bagus', 'bagus'::physical_condition,
    'tersedia', 'tersedia'::availability_status, v_photos, v_photos[1], NULLIF(trim(p_storage_location), ''),
    NULLIF(trim(p_serial_number), ''), NULLIF(trim(p_description), ''), 'active', p_created_by
  ) RETURNING id INTO v_new_equipment_id;

  UPDATE public.equipment
  SET asset_state = CASE WHEN v_old_condition = 'hilang' THEN 'lost' ELSE 'retired' END,
      status = 'maintenance', availability_status = 'maintenance'::availability_status, updated_at = NOW()
  WHERE id = v_old_equipment_id;

  UPDATE public.equipment_recovery_cases
  SET status = 'completed', replacement_equipment_id = v_new_equipment_id,
      verified_by = p_created_by, completed_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;

  IF p_replacement_value IS NOT NULL THEN
    INSERT INTO public.equipment_valuations (equipment_id, replacement_value, currency, effective_at, created_by, change_reason)
    VALUES (v_new_equipment_id, p_replacement_value, 'IDR', CURRENT_DATE, p_created_by, trim(p_change_reason));
  END IF;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_created_by, 'INSERT', 'equipment', v_new_equipment_id,
    jsonb_build_object('replacement_for', v_old_equipment_id, 'recovery_case_id', p_case_id), trim(p_change_reason));
  RETURN v_new_equipment_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.replace_access_role_capabilities(p_role_key text, p_capabilities text[], p_actor_user_id uuid, p_change_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  previous_capabilities TEXT[];
BEGIN
  IF p_role_key = 'teacher' AND NOT ('access_control.manage' = ANY (COALESCE(p_capabilities, ARRAY[]::TEXT[]))) THEN
    RAISE EXCEPTION 'teacher access_control.manage capability cannot be removed';
  END IF;

  SELECT COALESCE(array_agg(permission_key ORDER BY permission_key), ARRAY[]::TEXT[])
    INTO previous_capabilities
  FROM public.access_role_permissions
  WHERE role_key = p_role_key;

  DELETE FROM public.access_role_permissions WHERE role_key = p_role_key;
  INSERT INTO public.access_role_permissions (role_key, permission_key)
  SELECT p_role_key, permission_key
  FROM unnest(COALESCE(p_capabilities, ARRAY[]::TEXT[])) AS requested(permission_key);

  INSERT INTO public.access_control_audit_logs (
    actor_user_id, role_key, previous_capabilities, next_capabilities, change_reason
  ) VALUES (
    p_actor_user_id, p_role_key, previous_capabilities,
    COALESCE(p_capabilities, ARRAY[]::TEXT[]), btrim(p_change_reason)
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_agenda_photo_atomic(p_activity_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_photo public.agenda_activity_photos;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_object_key, ''))) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'
     OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 614400
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INPUT_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_activities WHERE id = p_activity_id AND archived_at IS NULL) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'photo_reserve', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE id = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'photo_reserve' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_activity_photos WHERE activity_id = p_activity_id AND upload_status = 'pending') THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_UPLOAD_IN_PROGRESS'; END IF;
  INSERT INTO public.agenda_activity_photos (activity_id, object_key, mime_type, file_size_bytes, original_filename, created_by, expires_at)
  VALUES (p_activity_id, btrim(p_object_key), p_mime_type, p_file_size_bytes, btrim(p_original_filename), p_actor_id, NOW() + INTERVAL '24 hours')
  RETURNING * INTO v_photo;
  v_response := jsonb_build_object('photo', to_jsonb(v_photo), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_borrowing_return_evidence_atomic(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrowing_item_id UUID;
  v_evidence public.borrowing_return_evidence;
BEGIN
  IF p_borrowing_id IS NULL OR p_equipment_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_IDENTITY_INVALID';
  END IF;
  IF length(btrim(COALESCE(p_object_key, ''))) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$' THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_OBJECT_KEY_INVALID';
  END IF;
  IF p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 614400
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_FILE_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'equipment_team')
  ) THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_ACTOR_FORBIDDEN';
  END IF;

  SELECT bi.id
  INTO v_borrowing_item_id
  FROM public.borrowing_items bi
  JOIN public.borrowings b ON b.id = bi.borrowing_id
  WHERE bi.borrowing_id = p_borrowing_id
    AND bi.equipment_id = p_equipment_id
    AND bi.status = 'borrowed'
    AND b.status IN ('borrowed', 'partial')
  FOR UPDATE;
  IF v_borrowing_item_id IS NULL THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_ITEM_INVALID';
  END IF;

  SELECT *
  INTO v_evidence
  FROM public.borrowing_return_evidence
  WHERE object_key = btrim(p_object_key)
  FOR UPDATE;
  IF FOUND THEN
    IF v_evidence.borrowing_id IS DISTINCT FROM p_borrowing_id
       OR v_evidence.equipment_id IS DISTINCT FROM p_equipment_id
       OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'RETURN_EVIDENCE_OBJECT_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'idempotent_replay', TRUE);
  END IF;

  INSERT INTO public.borrowing_return_evidence (
    borrowing_id, borrowing_item_id, equipment_id, object_key, storage_provider,
    mime_type, file_size_bytes, original_filename, upload_status, created_by
  ) VALUES (
    p_borrowing_id, v_borrowing_item_id, p_equipment_id, btrim(p_object_key), 'r2',
    p_mime_type, p_file_size_bytes, btrim(p_original_filename), 'pending', p_actor_id
  )
  RETURNING * INTO v_evidence;

  RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'idempotent_replay', FALSE);
END;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_borrowing_self_return_evidence_atomic(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_student_id UUID;
  v_item public.borrowing_items;
  v_report public.borrowing_return_reports;
  v_evidence public.borrowing_return_evidence;
BEGIN
  IF p_borrowing_id IS NULL OR p_equipment_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_IDENTITY_INVALID';
  END IF;
  IF p_object_key IS NULL OR length(btrim(p_object_key)) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_EVIDENCE_OBJECT_KEY_INVALID';
  END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 614400
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_EVIDENCE_FILE_INVALID';
  END IF;
  SELECT s.id INTO v_student_id
  FROM public.students AS s
  WHERE s.user_id = p_actor_id AND s.is_active = TRUE;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_ACTOR_FORBIDDEN';
  END IF;
  SELECT bi.* INTO v_item
  FROM public.borrowing_items AS bi
  JOIN public.borrowings AS b ON b.id = bi.borrowing_id
  WHERE bi.borrowing_id = p_borrowing_id
    AND bi.equipment_id = p_equipment_id
    AND bi.status = 'borrowed'
    AND b.student_id = v_student_id
    AND b.status IN ('borrowed', 'partial')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_ITEM_INVALID';
  END IF;
  SELECT * INTO v_evidence FROM public.borrowing_return_evidence WHERE object_key = btrim(p_object_key) FOR UPDATE;
  IF FOUND THEN
    IF v_evidence.borrowing_id IS DISTINCT FROM p_borrowing_id
       OR v_evidence.equipment_id IS DISTINCT FROM p_equipment_id
       OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_EVIDENCE_OBJECT_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'report_id', v_evidence.return_report_id, 'idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_report
  FROM public.borrowing_return_reports
  WHERE borrowing_id = p_borrowing_id AND reporter_id = p_actor_id AND status = 'draft'
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.borrowing_return_reports (borrowing_id, reporter_id, status)
    VALUES (p_borrowing_id, p_actor_id, 'draft')
    RETURNING * INTO v_report;
  END IF;
  INSERT INTO public.borrowing_return_evidence (
    borrowing_id, borrowing_item_id, equipment_id, return_report_id, source,
    object_key, storage_provider, mime_type, file_size_bytes, original_filename,
    upload_status, created_by
  ) VALUES (
    p_borrowing_id, v_item.id, p_equipment_id, v_report.id, 'student_report',
    btrim(p_object_key), 'r2', p_mime_type, p_file_size_bytes, btrim(p_original_filename),
    'pending', p_actor_id
  ) RETURNING * INTO v_evidence;
  RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'report_id', v_report.id, 'idempotent_replay', FALSE);
END;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_contest_entry_evidence_atomic(p_entry_id uuid, p_target_status text, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_evidence public.contest_entry_evidence;
  v_expected_current_status TEXT;
BEGIN
  IF p_entry_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_IDENTITY_INVALID';
  END IF;
  IF p_target_status IS NULL
     OR p_target_status NOT IN ('sudah_terkirim', 'selesai') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_TARGET_INVALID';
  END IF;
  IF length(btrim(COALESCE(p_object_key, ''))) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_OBJECT_KEY_INVALID';
  END IF;
  IF p_mime_type IS NULL
     OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL
     OR p_file_size_bytes NOT BETWEEN 1 AND 5242880
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_FILE_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'secretary', 'contest_team')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_ACTOR_FORBIDDEN';
  END IF;

  SELECT pipeline_status
  INTO v_expected_current_status
  FROM public.contest_entries
  WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;
  IF (p_target_status = 'sudah_terkirim' AND v_expected_current_status <> 'proses_submit')
     OR (p_target_status = 'selesai' AND v_expected_current_status <> 'menunggu_pengumuman') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_TRANSITION_INVALID';
  END IF;

  SELECT *
  INTO v_evidence
  FROM public.contest_entry_evidence
  WHERE object_key = btrim(p_object_key)
  FOR UPDATE;
  IF FOUND THEN
    IF v_evidence.entry_id IS DISTINCT FROM p_entry_id
       OR v_evidence.target_status IS DISTINCT FROM p_target_status
       OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_EVIDENCE_OBJECT_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object(
      'evidence', to_jsonb(v_evidence) - 'public_url',
      'idempotent_replay', TRUE
    );
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', 'Menyiapkan unggahan bukti progres karya', TRUE);

  INSERT INTO public.contest_entry_evidence (
    entry_id,
    evidence_type,
    object_key,
    public_url,
    storage_provider,
    target_status,
    mime_type,
    file_size_bytes,
    original_filename,
    upload_status,
    attached_status,
    created_by,
    updated_at
  ) VALUES (
    p_entry_id,
    CASE WHEN p_target_status = 'selesai' THEN 'result' ELSE 'submission' END,
    btrim(p_object_key),
    NULL,
    'r2',
    p_target_status,
    p_mime_type,
    p_file_size_bytes,
    btrim(p_original_filename),
    'pending',
    NULL,
    p_actor_id,
    NOW()
  )
  RETURNING * INTO v_evidence;

  RETURN jsonb_build_object(
    'evidence', to_jsonb(v_evidence) - 'public_url',
    'idempotent_replay', FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_equipment_charge_evidence_atomic(p_settlement_id uuid, p_evidence_type text, p_object_key text, p_mime_type text, p_file_size_bytes integer, p_original_filename text, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evidence_id UUID;
  v_charge_amount NUMERIC;
  v_charge_paid NUMERIC;
  v_charge_status TEXT;
BEGIN
  IF p_settlement_id IS NULL OR p_created_by IS NULL THEN RAISE EXCEPTION 'CHARGE_IDENTITY_INVALID'; END IF;
  SELECT amount, paid_amount, status INTO v_charge_amount, v_charge_paid, v_charge_status
  FROM public.equipment_charge_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_charge_amount IS NULL THEN RAISE EXCEPTION 'CHARGE_SETTLEMENT_NOT_FOUND'; END IF;
  IF v_charge_status = 'waived' OR v_charge_paid >= v_charge_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  IF p_evidence_type NOT IN ('payment', 'repair', 'replacement') THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') OR p_file_size_bytes IS NULL OR p_file_size_bytes < 1 OR p_file_size_bytes > 614400 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_FILE_INVALID'; END IF;
  IF NULLIF(trim(p_object_key), '') IS NULL OR NULLIF(trim(p_original_filename), '') IS NULL THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_FILE_INVALID'; END IF;
  INSERT INTO public.equipment_evidence (settlement_id, evidence_type, object_key, mime_type, file_size_bytes, original_filename, created_by)
  VALUES (p_settlement_id, p_evidence_type, trim(p_object_key), p_mime_type, p_file_size_bytes, left(trim(p_original_filename), 255), p_created_by)
  RETURNING id INTO v_evidence_id;
  RETURN v_evidence_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.reset_user_password_atomic(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_operation_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, username text, nama text, role text, is_active boolean, is_first_login boolean, auth_version integer, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_role TEXT;
  actor_active BOOLEAN;
  target_row public.users;
  operation_id UUID;
  operation_inserted INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION 'RESET_ACTOR_INVALID';
  END IF;
  IF p_password_hash IS NULL OR char_length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'RESET_PASSWORD_HASH_INVALID';
  END IF;
  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'RESET_REASON_INVALID';
  END IF;
  IF p_operation_key IS NULL OR char_length(btrim(p_operation_key)) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'RESET_OPERATION_KEY_INVALID';
  END IF;

  SELECT u.role::TEXT, u.is_active
    INTO actor_role, actor_active
  FROM public.users AS u
  WHERE u.id = p_updated_by;
  IF NOT FOUND OR actor_active IS DISTINCT FROM TRUE OR actor_role <> 'teacher' THEN
    RAISE EXCEPTION 'RESET_ACTOR_FORBIDDEN';
  END IF;
  IF p_user_id = p_updated_by THEN
    RAISE EXCEPTION 'RESET_SELF_FORBIDDEN';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.password_reset_operations
    WHERE operation_key = btrim(p_operation_key)
  ) THEN
    RAISE EXCEPTION 'RESET_OPERATION_REPLAY';
  END IF;

  SELECT * INTO target_row
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESET_USER_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET password_hash = p_password_hash,
      is_first_login = TRUE,
      updated_by = p_updated_by,
      updated_at = NOW(),
      auth_version = COALESCE(u.auth_version, 1) + 1
  WHERE u.id = p_user_id;

  INSERT INTO public.password_reset_operations (
    operation_key, target_user_id, actor_user_id, resulting_auth_version
  )
  SELECT btrim(p_operation_key), u.id, p_updated_by, u.auth_version
  FROM public.users AS u
  WHERE u.id = p_user_id
  ON CONFLICT (operation_key) DO NOTHING;
  GET DIAGNOSTICS operation_inserted = ROW_COUNT;
  IF operation_inserted = 0 THEN
    RAISE EXCEPTION 'RESET_OPERATION_REPLAY';
  END IF;

  operation_id := COALESCE(p_operation_id, gen_random_uuid());
  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object('auth_version', target_row.auth_version, 'is_first_login', target_row.is_first_login),
    jsonb_build_object('operation', 'reset_password', 'auth_version', COALESCE(target_row.auth_version, 1) + 1, 'is_first_login', TRUE),
    left(btrim(p_change_reason), 500),
    p_request_id,
    operation_id,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'credential_rotation', 'idempotency_key', btrim(p_operation_key))
  );

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active, u.is_first_login,
         u.auth_version, u.updated_at
  FROM public.users AS u
  WHERE u.id = p_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.resolve_cash_payment_method_id(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_method_id UUID;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Metode pembayaran wajib dipilih.';
  END IF;

  SELECT id INTO v_method_id
  FROM public.cash_payment_methods
  WHERE code = lower(trim(p_code))
    AND is_active = TRUE;

  IF v_method_id IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia atau sudah dinonaktifkan.';
  END IF;

  RETURN v_method_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.return_borrowing_atomic(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb, p_catatan text, p_returned_by uuid, p_change_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_item JSONB;
  v_equipment_id UUID;
  v_borrowing_item_id UUID;
  v_valuation_id UUID;
  v_condition TEXT;
  v_settlement TEXT;
  v_value NUMERIC(14, 2);
  v_repair_cost NUMERIC(14, 2);
  v_charge NUMERIC(14, 2);
  v_total NUMERIC(14, 2) := 0;
  v_cumulative_total NUMERIC(14, 2) := 0;
  v_assessment_id UUID;
  v_assessment_item_id UUID;
  v_evidence_ids UUID[] := ARRAY[]::UUID[];
  v_evidence_count INTEGER;
  v_active_count INTEGER;
  v_remaining_count INTEGER;
  v_borrowing_total NUMERIC(14, 2);
  v_final_status TEXT;
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_returned_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'Return change reason must contain at least 5 characters.'; END IF;
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Return item conditions are required.';
  END IF;

  SELECT status, total_denda INTO v_current_status, v_borrowing_total
  FROM public.borrowings WHERE id = p_borrowing_id FOR UPDATE;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Borrowing not found.'; END IF;
  IF v_current_status NOT IN ('borrowed', 'partial') THEN RAISE EXCEPTION 'Borrowing is not returnable.'; END IF;

  PERFORM bi.id
  FROM public.borrowing_items AS bi
  WHERE bi.borrowing_id = p_borrowing_id AND bi.status = 'borrowed'
  ORDER BY bi.id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_active_count
  FROM public.borrowing_items
  WHERE borrowing_id = p_borrowing_id AND status = 'borrowed';
  IF jsonb_array_length(p_item_conditions) > v_active_count THEN
    RAISE EXCEPTION 'Return conditions may only include active borrowing items.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_item_conditions) AS entry(value)
    GROUP BY entry.value->>'equipment_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate equipment in return conditions.';
  END IF;

  INSERT INTO public.borrowing_return_assessments (
    borrowing_id, status, return_date, notes, created_by, finalized_by, finalized_at
  ) VALUES (
    p_borrowing_id, 'finalized', COALESCE(p_returned_at, CURRENT_DATE), NULLIF(trim(p_catatan), ''), p_returned_by, p_returned_by, NOW()
  ) RETURNING id INTO v_assessment_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' OR v_item->>'equipment_id' IS NULL OR v_item->>'kondisi_kembali' IS NULL THEN
      RAISE EXCEPTION 'Return item conditions are invalid.';
    END IF;
    v_equipment_id := (v_item->>'equipment_id')::UUID;
    v_condition := v_item->>'kondisi_kembali';
    v_settlement := COALESCE(NULLIF(v_item->>'settlement_method', ''), CASE WHEN v_condition = 'bagus' THEN 'none' WHEN v_condition = 'hilang' THEN 'replacement' ELSE 'repair' END);
    v_repair_cost := NULLIF(trim(v_item->>'repair_cost'), '')::NUMERIC;
    v_value := NULL;
    v_valuation_id := NULL;
    v_charge := 0;
    v_evidence_ids := ARRAY[]::UUID[];

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items AS bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed'
    FOR UPDATE;
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

    IF v_item ? 'evidence_ids' AND jsonb_typeof(v_item->'evidence_ids') <> 'array' THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    IF jsonb_typeof(v_item->'evidence_ids') = 'array' THEN
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_item->'evidence_ids') AS evidence(value)
        WHERE value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
      SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
      INTO v_evidence_ids
      FROM jsonb_array_elements_text(v_item->'evidence_ids') AS evidence(value);
    END IF;
    IF cardinality(v_evidence_ids) > 5 THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    IF cardinality(v_evidence_ids) <> (SELECT COUNT(DISTINCT evidence_id) FROM unnest(v_evidence_ids) AS ids(evidence_id)) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    IF v_condition <> 'hilang' AND cardinality(v_evidence_ids) < 2 THEN RAISE EXCEPTION 'RETURN_EVIDENCE_REQUIRED'; END IF;
    IF cardinality(v_evidence_ids) > 0 THEN
      SELECT COUNT(*) INTO v_evidence_count
      FROM public.borrowing_return_evidence AS bre
      WHERE bre.id = ANY(v_evidence_ids)
        AND bre.borrowing_id = p_borrowing_id
        AND bre.borrowing_item_id = v_borrowing_item_id
        AND bre.equipment_id = v_equipment_id
        AND bre.created_by = p_returned_by
        AND bre.upload_status = 'pending';
      IF v_evidence_count <> cardinality(v_evidence_ids) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    END IF;

    IF v_settlement = 'replacement' THEN
      SELECT ev.id, ev.replacement_value INTO v_valuation_id, v_value
      FROM public.equipment_valuations AS ev
      WHERE ev.equipment_id = v_equipment_id
        AND ev.effective_at <= (COALESCE(p_returned_at, CURRENT_DATE)::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY ev.effective_at DESC, ev.created_at DESC, ev.id DESC LIMIT 1;
      IF v_value IS NULL THEN RAISE EXCEPTION 'Replacement valuation is missing for equipment %.', v_equipment_id; END IF;
      v_charge := v_value;
    ELSIF v_settlement = 'repair' THEN
      IF v_repair_cost IS NULL OR v_repair_cost <= 0 THEN RAISE EXCEPTION 'A positive repair cost is required for repair settlement.'; END IF;
      v_charge := v_repair_cost;
    ELSIF v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Invalid settlement method.';
    END IF;

    INSERT INTO public.borrowing_return_assessment_items (
      assessment_id, borrowing_item_id, equipment_id, condition, settlement_method,
      valuation_id, replacement_value_snapshot, repair_cost, charged_amount, evidence_urls, notes
    ) VALUES (
      v_assessment_id, v_borrowing_item_id, v_equipment_id, v_condition, v_settlement,
      v_valuation_id, v_value, v_repair_cost, v_charge, '[]'::JSONB, NULLIF(trim(v_item->>'catatan'), '')
    ) RETURNING id INTO v_assessment_item_id;

    IF cardinality(v_evidence_ids) > 0 THEN
      UPDATE public.borrowing_return_evidence
      SET upload_status = 'attached', assessment_item_id = v_assessment_item_id, attached_at = NOW(), updated_at = NOW()
      WHERE id = ANY(v_evidence_ids) AND upload_status = 'pending';
    END IF;

    UPDATE public.borrowing_items
    SET status = 'returned', kondisi_kembali = v_condition, denda = v_charge,
        tanggal_dikembalikan = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
        catatan = NULLIF(trim(v_item->>'catatan'), ''), updated_by = p_returned_by, updated_at = NOW()
    WHERE id = v_borrowing_item_id AND status = 'borrowed';

    UPDATE public.equipment
    SET kondisi = v_condition, physical_condition = v_condition::physical_condition,
        asset_state = CASE WHEN v_condition = 'hilang' THEN 'lost' ELSE 'active' END,
        status = CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END,
        availability_status = (CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END)::availability_status,
        updated_at = NOW()
    WHERE id = v_equipment_id;
    v_total := v_total + v_charge;
  END LOOP;

  SELECT COUNT(*) INTO v_remaining_count
  FROM public.borrowing_items
  WHERE borrowing_id = p_borrowing_id AND status = 'borrowed';
  v_final_status := CASE WHEN v_remaining_count = 0 THEN 'returned' ELSE 'partial' END;
  v_cumulative_total := COALESCE(v_borrowing_total, 0) + v_total;

  UPDATE public.borrowing_return_assessments
  SET damage_charge = v_total, total_charge = v_total
  WHERE id = v_assessment_id;
  UPDATE public.borrowings
  SET status = v_final_status,
      returned_at = CASE WHEN v_remaining_count = 0 THEN COALESCE(p_returned_at::TIMESTAMPTZ, NOW()) ELSE returned_at END,
      catatan_pengembalian = COALESCE(NULLIF(trim(p_catatan), ''), catatan_pengembalian),
      total_denda = v_cumulative_total,
      processed_return_by = p_returned_by, updated_by = p_returned_by, updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_returned_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object(
      'status', v_final_status,
      'batch_charge', v_total,
      'total_charge', v_cumulative_total,
      'assessment_id', v_assessment_id,
      'remaining_item_count', v_remaining_count
    ), trim(p_change_reason));

  RETURN p_borrowing_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.review_cash_dispute_atomic(p_dispute_id uuid, p_status text, p_review_note text, p_actor_id uuid, p_resolution_date date, p_resolution_amount numeric, p_payment_method_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dispute public.cash_disputes;
  v_debt public.debt_records;
  v_transaction public.cash_transactions;
  v_payment_method_id UUID;
  v_balance NUMERIC(12,2);
  v_transaction_key TEXT;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_STATUS_INVALID';
  END IF;
  IF length(trim(COALESCE(p_review_note, ''))) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEW_NOTE_INVALID';
  END IF;
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = TRUE AND role::TEXT IN ('teacher', 'treasurer')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEWER_INVALID';
  END IF;

  SELECT * INTO v_dispute
  FROM public.cash_disputes
  WHERE id = p_dispute_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_NOT_FOUND';
  END IF;

  IF v_dispute.status <> 'pending' THEN
    IF v_dispute.status = p_status THEN
      RETURN jsonb_build_object(
        'dispute', (to_jsonb(v_dispute) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
        'idempotent_replay', TRUE
      );
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ALREADY_RESOLVED';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(trim(p_review_note), 500), TRUE);

  IF p_status = 'approved' AND v_dispute.debt_record_id IS NOT NULL THEN
    IF p_resolution_date IS NULL OR p_payment_method_code IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_REQUIRED';
    END IF;
    IF p_resolution_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_DATE_INVALID';
    END IF;

    SELECT * INTO v_debt
    FROM public.debt_records
    WHERE id = v_dispute.debt_record_id
    FOR UPDATE;
    IF NOT FOUND OR v_debt.status::TEXT <> 'unpaid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_DEBT_ALREADY_SETTLED';
    END IF;

    -- Keep old clients safe while making the database value authoritative.
    IF p_resolution_amount IS NOT NULL
       AND (p_resolution_amount <= 0 OR p_resolution_amount IS DISTINCT FROM v_debt.amount) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'DISPUTE_RESOLUTION_AMOUNT_INVALID',
        DETAIL = jsonb_build_object('expected_amount', v_debt.amount)::TEXT;
    END IF;

    v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);
    v_transaction_key := 'cash-dispute-resolution:' || v_dispute.id::TEXT;
    PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

    SELECT * INTO v_transaction
    FROM public.cash_transactions
    WHERE idempotency_key = v_transaction_key
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(is_billing, FALSE) THEN 0
          WHEN type::TEXT = 'pengeluaran' THEN -nominal
          ELSE nominal
        END
      ), 0)
      INTO v_balance
      FROM public.cash_transactions;

      INSERT INTO public.cash_transactions (
        type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
        saldo_sebelum, saldo_sesudah, idempotency_key, created_by,
        is_billing, payment_method_id
      ) VALUES (
        'iuran_wajib'::public.transaction_type,
        v_debt.amount,
        'Pembayaran terverifikasi melalui sanggahan kas',
        v_dispute.student_id,
        NULL,
        p_resolution_date,
        v_balance,
        v_balance + v_debt.amount,
        v_transaction_key,
        p_actor_id,
        FALSE,
        v_payment_method_id
      )
      RETURNING * INTO v_transaction;
    END IF;

    UPDATE public.debt_records
    SET status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        settled_transaction_id = v_transaction.id,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_debt.id;
  ELSIF v_dispute.transaction_id IS NOT NULL
    AND (p_resolution_date IS NOT NULL OR p_resolution_amount IS NOT NULL OR p_payment_method_code IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_NOT_APPLICABLE';
  END IF;

  UPDATE public.cash_disputes
  SET status = p_status,
      review_note = trim(p_review_note),
      resolved_by = p_actor_id,
      resolved_at = NOW(),
      resolution_transaction_id = v_transaction.id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE id = v_dispute.id
  RETURNING * INTO v_dispute;

  RETURN jsonb_build_object(
    'dispute', (to_jsonb(v_dispute) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
    'resolution_transaction_id', v_dispute.resolution_transaction_id,
    'idempotent_replay', FALSE
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.search_borrowings_page_ids(p_search text, p_status text, p_student_id uuid, p_borrower_id uuid, p_overdue_only boolean, p_now timestamp with time zone, p_today date, p_limit integer, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_total BIGINT;
  v_ids JSONB;
BEGIN
  IF (p_search IS NOT NULL AND (length(btrim(p_search)) NOT BETWEEN 1 AND 100))
     OR (p_status IS NOT NULL AND p_status NOT IN ('pending', 'approved', 'rejected', 'borrowed', 'pending_verification', 'returned'))
     OR p_now IS NULL OR p_today IS NULL
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN
    RAISE EXCEPTION 'BORROWING_SEARCH_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT b.id, b.created_at
    FROM public.borrowings AS b
    LEFT JOIN public.students AS s ON s.id = b.student_id
    WHERE (p_student_id IS NULL OR b.student_id = p_student_id)
      AND (p_student_id IS NOT NULL OR p_borrower_id IS NULL OR b.student_id = p_borrower_id)
      AND (p_status IS NULL OR b.status = p_status)
      AND (
        COALESCE(p_overdue_only, FALSE) = FALSE
        OR (
          b.status = 'borrowed'
          AND (b.due_at < p_now OR (b.due_at IS NULL AND b.rencana_kembali <= p_today))
        )
      )
      AND (
        p_search IS NULL
        OR s.nama ILIKE '%' || p_search || '%'
        OR s.nis ILIKE '%' || p_search || '%'
        OR EXISTS (
          SELECT 1
          FROM public.borrowing_items AS bi
          JOIN public.equipment AS e ON e.id = bi.equipment_id
          WHERE bi.borrowing_id = b.id
            AND (e.kode_alat ILIKE '%' || p_search || '%' OR e.nama_alat ILIKE '%' || p_search || '%')
        )
      )
  ),
  page_rows AS (
    SELECT id, created_at
    FROM matched
    ORDER BY created_at DESC, id DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    (SELECT count(*) FROM matched),
    COALESCE((SELECT jsonb_agg(id ORDER BY created_at DESC, id DESC) FROM page_rows), '[]'::JSONB)
  INTO v_total, v_ids;

  RETURN jsonb_build_object('ids', v_ids, 'total', v_total);
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_student_account_status_atomic(p_student_id uuid, p_is_active boolean, p_updated_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
BEGIN
  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.students
  SET is_active = p_is_active,
      updated_by = p_updated_by,
      updated_at = NOW()
  WHERE id = p_student_id;

  IF v_student.user_id IS NOT NULL THEN
    UPDATE public.users
    SET is_active = p_is_active,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = v_student.user_id;
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_student.user_id,
    'is_active', p_is_active
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.snapshot_access_control_audit_actor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name TEXT;
  v_actor_username TEXT;
  v_actor_role TEXT;
BEGIN
  IF NEW.actor_user_id IS NOT NULL THEN
    SELECT u.nama, u.username, u.role::TEXT
      INTO v_actor_name, v_actor_username, v_actor_role
    FROM public.users AS u
    WHERE u.id = NEW.actor_user_id;
    NEW.actor_name_snapshot := COALESCE(NULLIF(NEW.actor_name_snapshot, ''), v_actor_name);
    NEW.actor_username_snapshot := COALESCE(NULLIF(NEW.actor_username_snapshot, ''), v_actor_username);
    NEW.actor_role_snapshot := COALESCE(NULLIF(NEW.actor_role_snapshot, ''), v_actor_role);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.submit_borrowing_self_return_atomic(p_report_id uuid, p_evidence_ids uuid[], p_notes text, p_actor_id uuid, p_idempotency_key text, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_report public.borrowing_return_reports;
  v_borrowing public.borrowings;
  v_operation public.borrowing_return_operations;
  v_item RECORD;
  v_count INTEGER;
  v_response JSONB;
BEGIN
  IF p_report_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_INPUT_INVALID';
  END IF;
  SELECT * INTO v_report FROM public.borrowing_return_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR v_report.reporter_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_FORBIDDEN';
  END IF;
  INSERT INTO public.borrowing_return_operations (idempotency_key, report_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_report_id, 'submit', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_operation FROM public.borrowing_return_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_operation.report_id IS DISTINCT FROM p_report_id OR v_operation.actor_id IS DISTINCT FROM p_actor_id OR v_operation.operation_kind <> 'submit' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_IDEMPOTENCY_REUSED';
    END IF;
    IF v_operation.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_OPERATION_INCOMPLETE'; END IF;
    RETURN v_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_borrowing FROM public.borrowings WHERE id = v_report.borrowing_id FOR UPDATE;
  IF NOT FOUND OR v_borrowing.student_id IS DISTINCT FROM (SELECT id FROM public.students WHERE user_id = p_actor_id)
     OR v_borrowing.status NOT IN ('borrowed', 'partial') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_TRANSITION_INVALID';
  END IF;
  IF v_report.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_ALREADY_SUBMITTED';
  END IF;
  IF p_evidence_ids IS NULL OR cardinality(p_evidence_ids) < 2 OR cardinality(p_evidence_ids) > 50 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_EVIDENCE_REQUIRED';
  END IF;
  IF cardinality(p_evidence_ids) <> (SELECT COUNT(DISTINCT id) FROM unnest(p_evidence_ids) AS ids(id)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_EVIDENCE_INVALID';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.borrowing_return_evidence
  WHERE id = ANY(p_evidence_ids) AND borrowing_id = v_report.borrowing_id
    AND return_report_id = p_report_id AND source = 'student_report'
    AND created_by = p_actor_id AND upload_status = 'pending';
  IF v_count <> cardinality(p_evidence_ids) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_EVIDENCE_INVALID';
  END IF;
  FOR v_item IN SELECT bi.equipment_id FROM public.borrowing_items bi WHERE bi.borrowing_id = v_report.borrowing_id AND bi.status = 'borrowed' LOOP
    IF (SELECT COUNT(*) FROM public.borrowing_return_evidence bre WHERE bre.id = ANY(p_evidence_ids) AND bre.equipment_id = v_item.equipment_id) < 2 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_REPORT_EVIDENCE_ITEM_REQUIRED';
    END IF;
  END LOOP;
  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  UPDATE public.borrowing_return_reports
  SET status = 'pending_verification', notes = NULLIF(btrim(p_notes), ''), reported_at = NOW(), updated_at = NOW()
  WHERE id = p_report_id;
  UPDATE public.borrowings
  SET status = 'pending_verification', return_reported_at = NOW(), return_notes = NULLIF(btrim(p_notes), ''), updated_by = p_actor_id, updated_at = NOW()
  WHERE id = v_report.borrowing_id;
  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_actor_id, 'UPDATE', 'borrowings', v_report.borrowing_id,
    jsonb_build_object('status', 'pending_verification', 'return_report_id', p_report_id, 'evidence_count', v_count), btrim(p_change_reason));
  v_response := jsonb_build_object('report_id', p_report_id, 'borrowing_id', v_report.borrowing_id, 'status', 'pending_verification', 'idempotent_replay', FALSE);
  UPDATE public.borrowing_return_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_contest_frontend_contract()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_name TEXT;
  v_organizer TEXT;
  v_scope TEXT;
  v_date DATE;
  v_public_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nama_lomba IS DISTINCT FROM OLD.nama_lomba THEN
    v_name := NEW.nama_lomba;
  ELSIF TG_OP = 'UPDATE' AND NEW.nama IS DISTINCT FROM OLD.nama THEN
    v_name := NEW.nama;
  ELSIF TG_OP = 'UPDATE' AND NEW.nama_festival IS DISTINCT FROM OLD.nama_festival THEN
    v_name := NEW.nama_festival;
  ELSE
    v_name := COALESCE(NEW.nama_lomba, NEW.nama, NEW.nama_festival);
  END IF;
  v_name := NULLIF(BTRIM(v_name), '');
  IF v_name IS NOT NULL THEN
    NEW.nama_lomba := v_name;
    NEW.nama := v_name;
    NEW.nama_festival := v_name;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.penyelenggara IS DISTINCT FROM OLD.penyelenggara THEN
    v_organizer := NEW.penyelenggara;
  ELSIF TG_OP = 'UPDATE' AND NEW.jenis IS DISTINCT FROM OLD.jenis THEN
    v_organizer := NEW.jenis;
  ELSE
    v_organizer := COALESCE(NEW.penyelenggara, NEW.jenis, 'Sinematografi');
  END IF;
  v_organizer := COALESCE(NULLIF(BTRIM(v_organizer), ''), 'Sinematografi');
  IF TG_OP = 'UPDATE' AND NEW.jenis IS DISTINCT FROM OLD.jenis
     AND NEW.penyelenggara IS NOT DISTINCT FROM OLD.penyelenggara THEN
    NEW.penyelenggara := v_organizer;
  ELSE
    NEW.penyelenggara := COALESCE(NULLIF(BTRIM(NEW.penyelenggara), ''), v_organizer);
  END IF;
  NEW.jenis := COALESCE(NULLIF(BTRIM(NEW.jenis), ''), v_organizer);

  IF TG_OP = 'UPDATE' AND NEW.tingkat IS DISTINCT FROM OLD.tingkat THEN
    v_scope := NEW.tingkat;
  ELSIF TG_OP = 'UPDATE' AND NEW.level IS DISTINCT FROM OLD.level THEN
    v_scope := public.contest_scope_from_legacy(NEW.level);
  ELSE
    v_scope := public.contest_scope_from_legacy(COALESCE(NEW.tingkat, NEW.level));
  END IF;
  v_scope := lower(NULLIF(BTRIM(v_scope), ''));
  IF v_scope IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CONTEST_SCOPE_INVALID';
  END IF;
  NEW.tingkat := v_scope;
  NEW.level := public.contest_legacy_level_from_scope(v_scope);

  IF TG_OP = 'UPDATE' AND NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    v_date := NEW.deadline;
  ELSIF TG_OP = 'UPDATE' AND NEW.tanggal IS DISTINCT FROM OLD.tanggal THEN
    v_date := NEW.tanggal;
  ELSIF TG_OP = 'UPDATE' AND NEW.tanggal_lomba IS DISTINCT FROM OLD.tanggal_lomba THEN
    v_date := NEW.tanggal_lomba;
  ELSE
    v_date := COALESCE(NEW.deadline, NEW.tanggal, NEW.tanggal_lomba);
  END IF;
  NEW.deadline := v_date;
  NEW.tanggal := v_date;
  NEW.tanggal_lomba := v_date;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status_public IS NOT DISTINCT FROM OLD.status_public THEN
    v_public_status := NULL;
  ELSE
    v_public_status := LOWER(BTRIM(NEW.status_public));
  END IF;
  NEW.status_public := CASE
    WHEN v_public_status IN ('buka', 'proses_penjurian', 'selesai') THEN v_public_status
    WHEN NEW.status::TEXT = 'selesai' THEN 'selesai'
    WHEN v_date >= CURRENT_DATE THEN 'buka'
    ELSE 'proses_penjurian'
  END;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.transition_contest_entry_atomic(p_entry_id uuid, p_status text, p_result_label text, p_result_note text, p_evidence_url text, p_evidence_type text, p_change_reason text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry public.contest_entries;
  v_previous_status TEXT;
BEGIN
  IF p_actor_id IS NULL OR length(trim(COALESCE(p_change_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHANGE_REASON_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ACTOR_INVALID';
  END IF;
  IF p_status NOT IN ('proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_STATUS_INVALID';
  END IF;
  IF p_status IN ('sudah_terkirim', 'selesai') AND length(trim(COALESCE(p_evidence_url, ''))) < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_EVIDENCE_REQUIRED';
  END IF;
  IF p_status = 'selesai' AND length(trim(COALESCE(p_result_label, ''))) < 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_RESULT_REQUIRED';
  END IF;

  SELECT * INTO v_entry FROM public.contest_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;
  v_previous_status := v_entry.pipeline_status;

  IF p_evidence_url IS NOT NULL AND length(trim(p_evidence_url)) > 0 THEN
    INSERT INTO public.contest_entry_evidence (entry_id, evidence_type, public_url, created_by)
    VALUES (p_entry_id, COALESCE(NULLIF(p_evidence_type, ''), CASE WHEN p_status = 'selesai' THEN 'result' ELSE 'submission' END), trim(p_evidence_url), p_actor_id);
  END IF;

  UPDATE public.contest_entries
  SET pipeline_status = p_status,
      result_label = NULLIF(trim(p_result_label), ''),
      result_note = NULLIF(trim(p_result_note), ''),
      submitted_at = CASE WHEN p_status IN ('sudah_terkirim', 'menunggu_pengumuman', 'selesai') THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
      completed_at = CASE WHEN p_status = 'selesai' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.contest_entry_status_history (entry_id, from_status, to_status, change_reason, changed_by)
  VALUES (p_entry_id, v_previous_status, p_status, trim(p_change_reason), p_actor_id);

  RETURN jsonb_build_object('entry', to_jsonb(v_entry));
END;
$function$;
CREATE OR REPLACE FUNCTION public.transition_contest_entry_pipeline_atomic(p_entry_id uuid, p_status text, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.contest_entries;
  v_updated public.contest_entries;
  v_evidence public.contest_entry_evidence;
  v_expected_status TEXT;
  v_inserted INTEGER;
  v_existing_operation public.contest_entry_pipeline_operations;
  v_response JSONB;
BEGIN
  IF p_entry_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_IDENTITY_INVALID';
  END IF;
  IF p_status IS NULL
     OR p_status NOT IN ('sudah_terkirim', 'menunggu_pengumuman') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_STATUS_INVALID';
  END IF;
  IF length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHANGE_REASON_REQUIRED';
  END IF;
  IF length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_IDEMPOTENCY_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'secretary', 'contest_team')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ACTOR_FORBIDDEN';
  END IF;

  INSERT INTO public.contest_entry_pipeline_operations (
    idempotency_key, entry_id, operation_kind, target_status, actor_id
  ) VALUES (
    btrim(p_idempotency_key), p_entry_id, 'transition', p_status, p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
    INTO v_existing_operation
    FROM public.contest_entry_pipeline_operations
    WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing_operation.entry_id IS DISTINCT FROM p_entry_id
       OR v_existing_operation.operation_kind <> 'transition'
       OR v_existing_operation.target_status <> p_status
       OR v_existing_operation.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing_operation.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_existing_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  SELECT *
  INTO v_current
  FROM public.contest_entries
  WHERE id = p_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;

  v_expected_status := CASE p_status
    WHEN 'sudah_terkirim' THEN 'proses_submit'
    WHEN 'menunggu_pengumuman' THEN 'sudah_terkirim'
  END;
  IF v_current.pipeline_status <> v_expected_status THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_TRANSITION_INVALID';
  END IF;

  IF p_status = 'sudah_terkirim' THEN
    IF p_evidence_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_EVIDENCE_REQUIRED';
    END IF;
    SELECT *
    INTO v_evidence
    FROM public.contest_entry_evidence
    WHERE id = p_evidence_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_evidence.entry_id IS DISTINCT FROM p_entry_id
       OR v_evidence.target_status IS DISTINCT FROM 'sudah_terkirim'
       OR v_evidence.evidence_type IS DISTINCT FROM 'submission'
       OR v_evidence.storage_provider IS DISTINCT FROM 'r2'
       OR v_evidence.upload_status IS DISTINCT FROM 'pending'
       OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_EVIDENCE_INVALID';
    END IF;
  ELSIF p_evidence_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_EVIDENCE_NOT_ALLOWED';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  IF p_evidence_id IS NOT NULL THEN
    UPDATE public.contest_entry_evidence
    SET upload_status = 'attached',
        attached_status = p_status,
        updated_at = NOW()
    WHERE id = p_evidence_id;

    UPDATE public.contest_entry_evidence
    SET upload_status = 'abandoned',
        updated_at = NOW()
    WHERE entry_id = p_entry_id
      AND target_status = p_status
      AND upload_status = 'pending'
      AND id <> p_evidence_id;
  END IF;

  UPDATE public.contest_entries
  SET pipeline_status = p_status,
      submitted_at = CASE
        WHEN p_status = 'sudah_terkirim' THEN COALESCE(submitted_at, NOW())
        ELSE submitted_at
      END,
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_entry_id
  RETURNING * INTO v_updated;

  INSERT INTO public.contest_entry_status_history (
    entry_id, from_status, to_status, change_reason, changed_by
  ) VALUES (
    p_entry_id, v_current.pipeline_status, p_status, btrim(p_change_reason), p_actor_id
  );

  PERFORM public.write_audit_log(
    p_actor_id,
    'UPDATE',
    'contest_entries',
    p_entry_id,
    public.redact_audit_json(to_jsonb(v_current)),
    public.redact_audit_json(to_jsonb(v_updated)),
    left(btrim(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object(
      'audit_scope', 'contest_entry_pipeline_transition',
      'evidence_id', p_evidence_id
    )
  );

  v_response := jsonb_build_object(
    'entry', to_jsonb(v_updated),
    'evidence_id', p_evidence_id,
    'idempotent_replay', FALSE
  );
  UPDATE public.contest_entry_pipeline_operations
  SET response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);

  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_agenda_activity_atomic(p_activity_id uuid, p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_expected_version integer, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.agenda_activities;
  v_updated public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_activity_date IS NULL OR p_activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
     OR length(btrim(COALESCE(p_activity_name, ''))) NOT BETWEEN 2 AND 120
     OR length(btrim(COALESCE(p_activity_description, ''))) NOT BETWEEN 2 AND 2000
     OR (NULLIF(btrim(COALESCE(p_instructor_name, '')), '') IS NOT NULL AND length(btrim(p_instructor_name)) NOT BETWEEN 2 AND 120)
     OR cardinality(p_pic_names) NOT BETWEEN 1 AND 10
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_UPDATE_INPUT_INVALID';
  END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'update', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'update' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  SELECT * INTO v_current FROM public.agenda_activities WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_current.archived_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  IF v_current.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_VERSION_CONFLICT'; END IF;
  UPDATE public.agenda_activities
  SET activity_date = p_activity_date,
      activity_name = btrim(p_activity_name), activity_description = btrim(p_activity_description),
      instructor_name = NULLIF(btrim(p_instructor_name), ''), pic_names = p_pic_names,
      updated_by = p_actor_id, updated_at = NOW(), version = version + 1
  WHERE id = p_activity_id RETURNING * INTO v_updated;

  PERFORM public.write_audit_log(
    p_actor_id, 'UPDATE', 'agenda_activities', p_activity_id, public.redact_audit_json(to_jsonb(v_current)), public.redact_audit_json(to_jsonb(v_updated)),
    left(btrim(p_change_reason), 500), p_request_id, p_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'agenda_activity_update')
  );
  v_response := jsonb_build_object('activity', to_jsonb(v_updated), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_contest_atomic(p_contest_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS SETOF contests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.contests;
  v_updated public.contests;
  v_allowed_fields CONSTANT TEXT[] := ARRAY[
    'nama', 'nama_lomba', 'nama_festival', 'jenis', 'penyelenggara',
    'level', 'tingkat', 'tanggal', 'tanggal_lomba', 'deadline', 'status',
    'status_public', 'hasil', 'kota', 'tahun_event', 'website_url',
    'deskripsi', 'planned_work_count', 'academic_year'
  ];
  v_unknown_field TEXT;
BEGIN
  IF p_contest_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_ACTOR_INVALID';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
     OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_EMPTY';
  END IF;

  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_REASON_INVALID';
  END IF;

  SELECT key_name
  INTO v_unknown_field
  FROM jsonb_object_keys(p_changes) AS requested(key_name)
  WHERE NOT (key_name = ANY(v_allowed_fields))
  LIMIT 1;
  IF v_unknown_field IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_FIELD_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS actor
    WHERE actor.id = p_updated_by
      AND actor.is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_ACTOR_FORBIDDEN';
  END IF;

  SELECT *
  INTO v_current
  FROM public.contests AS contest
  WHERE contest.id = p_contest_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.contests AS contest
  SET
    nama = CASE WHEN p_changes ? 'nama' THEN p_changes->>'nama' ELSE contest.nama END,
    nama_lomba = CASE WHEN p_changes ? 'nama_lomba' THEN p_changes->>'nama_lomba' ELSE contest.nama_lomba END,
    nama_festival = CASE WHEN p_changes ? 'nama_festival' THEN p_changes->>'nama_festival' ELSE contest.nama_festival END,
    jenis = CASE WHEN p_changes ? 'jenis' THEN p_changes->>'jenis' ELSE contest.jenis END,
    penyelenggara = CASE WHEN p_changes ? 'penyelenggara' THEN p_changes->>'penyelenggara' ELSE contest.penyelenggara END,
    level = CASE WHEN p_changes ? 'level' THEN p_changes->>'level' ELSE contest.level END,
    tingkat = CASE WHEN p_changes ? 'tingkat' THEN p_changes->>'tingkat' ELSE contest.tingkat END,
    tanggal = CASE WHEN p_changes ? 'tanggal' THEN (p_changes->>'tanggal')::DATE ELSE contest.tanggal END,
    tanggal_lomba = CASE WHEN p_changes ? 'tanggal_lomba' THEN (p_changes->>'tanggal_lomba')::DATE ELSE contest.tanggal_lomba END,
    deadline = CASE WHEN p_changes ? 'deadline' THEN (p_changes->>'deadline')::DATE ELSE contest.deadline END,
    status = CASE WHEN p_changes ? 'status' THEN (p_changes->>'status')::public.contest_status ELSE contest.status END,
    status_public = CASE WHEN p_changes ? 'status_public' THEN p_changes->>'status_public' ELSE contest.status_public END,
    hasil = CASE WHEN p_changes ? 'hasil' THEN p_changes->>'hasil' ELSE contest.hasil END,
    kota = CASE WHEN p_changes ? 'kota' THEN p_changes->>'kota' ELSE contest.kota END,
    tahun_event = CASE WHEN p_changes ? 'tahun_event' THEN (p_changes->>'tahun_event')::INTEGER ELSE contest.tahun_event END,
    website_url = CASE WHEN p_changes ? 'website_url' THEN p_changes->>'website_url' ELSE contest.website_url END,
    deskripsi = CASE WHEN p_changes ? 'deskripsi' THEN p_changes->>'deskripsi' ELSE contest.deskripsi END,
    planned_work_count = CASE WHEN p_changes ? 'planned_work_count' THEN (p_changes->>'planned_work_count')::INTEGER ELSE contest.planned_work_count END,
    academic_year = CASE WHEN p_changes ? 'academic_year' THEN p_changes->>'academic_year' ELSE contest.academic_year END,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE contest.id = p_contest_id
  RETURNING * INTO v_updated;

  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'contests',
    p_contest_id,
    public.redact_audit_json(to_jsonb(v_current)),
    public.redact_audit_json(to_jsonb(v_updated)),
    LEFT(BTRIM(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object('audit_scope', 'contest_update_atomic')
  );

  RETURN NEXT v_updated;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_equipment_atomic(p_equipment_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS SETOF equipment
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current public.equipment;
  v_updated public.equipment;
  v_unknown_field TEXT;
BEGIN
  IF p_equipment_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_UPDATE_IDENTITY_INVALID';
  END IF;

  IF p_changes IS NULL
     OR jsonb_typeof(p_changes) <> 'object'
     OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_UPDATE_EMPTY';
  END IF;

  IF p_change_reason IS NULL
     OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_CHANGE_REASON_REQUIRED';
  END IF;

  SELECT key_name
  INTO v_unknown_field
  FROM jsonb_object_keys(p_changes) AS requested(key_name)
  WHERE key_name NOT IN (
    'kode_alat', 'nama_alat', 'kategori', 'kondisi', 'status',
    'lokasi_penyimpanan', 'serial_number', 'foto_urls', 'foto_url',
    'deskripsi', 'catatan_kerusakan'
  )
  LIMIT 1;

  IF v_unknown_field IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_UPDATE_FIELD_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_updated_by
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_UPDATE_ACTOR_FORBIDDEN';
  END IF;

  IF p_changes ? 'kategori'
     AND (p_changes->>'kategori') NOT IN ('Kamera', 'Lensa', 'Audio', 'Lighting', 'Aksesoris', 'Lainnya') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_CATEGORY_INVALID';
  END IF;

  IF p_changes ? 'kondisi'
     AND (p_changes->>'kondisi') NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_CONDITION_INVALID';
  END IF;

  IF p_changes ? 'status'
     AND (p_changes->>'status') NOT IN ('tersedia', 'dipinjam', 'maintenance') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_STATUS_INVALID';
  END IF;

  IF p_changes ? 'foto_urls'
     AND (
       jsonb_typeof(p_changes->'foto_urls') <> 'array'
       OR jsonb_array_length(p_changes->'foto_urls') NOT BETWEEN 3 AND 12
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(p_changes->'foto_urls') AS photo(value)
         WHERE jsonb_typeof(photo.value) <> 'string'
       )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_PHOTOS_INVALID';
  END IF;

  IF p_changes ? 'catatan_kerusakan'
     AND char_length(COALESCE(p_changes->>'catatan_kerusakan', '')) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_DAMAGE_NOTE_INVALID';
  END IF;

  SELECT *
  INTO v_current
  FROM public.equipment
  WHERE id = p_equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.equipment AS equipment
  SET
    kode_alat = CASE WHEN p_changes ? 'kode_alat' THEN p_changes->>'kode_alat' ELSE equipment.kode_alat END,
    kode_qr = CASE WHEN p_changes ? 'kode_alat' THEN p_changes->>'kode_alat' ELSE equipment.kode_qr END,
    nama_alat = CASE WHEN p_changes ? 'nama_alat' THEN p_changes->>'nama_alat' ELSE equipment.nama_alat END,
    kategori = CASE WHEN p_changes ? 'kategori' THEN p_changes->>'kategori' ELSE equipment.kategori END,
    kondisi = CASE WHEN p_changes ? 'kondisi' THEN p_changes->>'kondisi' ELSE equipment.kondisi END,
    physical_condition = CASE
      WHEN p_changes ? 'kondisi' THEN (p_changes->>'kondisi')::public.physical_condition
      ELSE equipment.physical_condition
    END,
    status = CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE equipment.status END,
    availability_status = CASE
      WHEN p_changes ? 'status' THEN (p_changes->>'status')::public.availability_status
      ELSE equipment.availability_status
    END,
    lokasi_penyimpanan = CASE WHEN p_changes ? 'lokasi_penyimpanan' THEN p_changes->>'lokasi_penyimpanan' ELSE equipment.lokasi_penyimpanan END,
    serial_number = CASE WHEN p_changes ? 'serial_number' THEN p_changes->>'serial_number' ELSE equipment.serial_number END,
    fotos = CASE
      WHEN p_changes ? 'foto_urls' THEN ARRAY(
        SELECT value
        FROM jsonb_array_elements_text(p_changes->'foto_urls') AS photos(value)
      )
      ELSE equipment.fotos
    END,
    foto_url = CASE
      WHEN p_changes ? 'foto_urls' THEN (
        SELECT value
        FROM jsonb_array_elements_text(p_changes->'foto_urls') AS photos(value)
        LIMIT 1
      )
      WHEN p_changes ? 'foto_url' THEN NULLIF(p_changes->>'foto_url', '')
      ELSE equipment.foto_url
    END,
    deskripsi = CASE WHEN p_changes ? 'deskripsi' THEN p_changes->>'deskripsi' ELSE equipment.deskripsi END,
    catatan_kerusakan = CASE
      WHEN p_changes ? 'catatan_kerusakan' THEN NULLIF(BTRIM(p_changes->>'catatan_kerusakan'), '')
      ELSE equipment.catatan_kerusakan
    END,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE equipment.id = p_equipment_id
  RETURNING * INTO v_updated;

  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'equipment',
    p_equipment_id,
    public.redact_audit_json(to_jsonb(v_current)),
    public.redact_audit_json(to_jsonb(v_updated)),
    LEFT(BTRIM(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object(
      'audit_scope', 'equipment_update_atomic',
      'changed_fields', (
        SELECT jsonb_agg(key_name ORDER BY key_name)
        FROM jsonb_object_keys(p_changes) AS requested(key_name)
      )
    )
  );

  RETURN NEXT v_updated;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_equipment_condition_atomic(p_equipment_id uuid, p_kondisi text, p_updated_by uuid, p_change_reason text, p_status text DEFAULT NULL::text, p_catatan_kerusakan text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_user_agent text DEFAULT NULL::text)
 RETURNS SETOF equipment
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_changes JSONB;
BEGIN
  IF p_kondisi IS NULL OR btrim(p_kondisi) = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EQUIPMENT_CONDITION_REQUIRED';
  END IF;

  v_changes := jsonb_build_object('kondisi', btrim(p_kondisi));

  IF p_status IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('status', btrim(p_status));
  END IF;

  IF p_catatan_kerusakan IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('catatan_kerusakan', p_catatan_kerusakan);
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.update_equipment_atomic(
    p_equipment_id,
    v_changes,
    p_updated_by,
    p_change_reason,
    p_request_id,
    p_operation_id,
    p_user_agent
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_student_profile_atomic(p_student_id uuid, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_updated_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
BEGIN
  IF p_student_id IS NULL OR NULLIF(BTRIM(p_nama), '') IS NULL OR NULLIF(BTRIM(p_kelas), '') IS NULL THEN
    RAISE EXCEPTION 'ID, nama, dan kelas siswa wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.students
  SET nama = BTRIM(p_nama),
      kelas = BTRIM(p_kelas),
      peminatan = NULLIF(BTRIM(p_peminatan), ''),
      no_telepon = NULLIF(BTRIM(p_no_telepon), ''),
      foto_url = NULLIF(BTRIM(p_foto_url), ''),
      updated_by = p_updated_by,
      updated_at = NOW()
  WHERE id = p_student_id
  RETURNING * INTO v_student;

  IF v_student.user_id IS NOT NULL THEN
    UPDATE public.users
    SET nama = v_student.nama,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = v_student.user_id;
  END IF;

  RETURN to_jsonb(v_student);
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_user_account_atomic(p_user_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, username text, nama text, role text, is_active boolean, is_first_login boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, updated_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_role TEXT;
  actor_active BOOLEAN;
  target_row public.users;
  linked_student_id UUID;
  linked_student_name TEXT;
  linked_student_active BOOLEAN;
  requested_username TEXT;
  requested_name TEXT;
  requested_role TEXT;
  requested_active BOOLEAN;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_INVALID';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
     OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes)) THEN
    RAISE EXCEPTION 'USER_UPDATE_EMPTY';
  END IF;
  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'USER_UPDATE_REASON_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_changes) AS requested(key_name)
    WHERE requested.key_name NOT IN ('username', 'nama', 'role', 'is_active')
  ) THEN
    RAISE EXCEPTION 'USER_UPDATE_FIELD_INVALID';
  END IF;

  SELECT u.role::TEXT, u.is_active
    INTO actor_role, actor_active
  FROM public.users AS u
  WHERE u.id = p_updated_by;
  IF NOT FOUND OR actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.access_role_permissions AS rp
    WHERE rp.role_key = actor_role
      AND rp.permission_key = 'users.manage'
  ) THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_FORBIDDEN';
  END IF;

  SELECT * INTO target_row
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_UPDATE_NOT_FOUND';
  END IF;

  SELECT s.id, s.nama, s.is_active
    INTO linked_student_id, linked_student_name, linked_student_active
  FROM public.students AS s
  WHERE s.user_id = p_user_id
  LIMIT 1;

  IF p_changes ? 'username' THEN
    IF jsonb_typeof(p_changes->'username') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_USERNAME_INVALID';
    END IF;
    requested_username := btrim(p_changes->>'username');
    IF requested_username !~ '^[A-Za-z0-9._-]{3,30}$' THEN
      RAISE EXCEPTION 'USER_UPDATE_USERNAME_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'nama' THEN
    IF jsonb_typeof(p_changes->'nama') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_NAME_INVALID';
    END IF;
    requested_name := btrim(p_changes->>'nama');
    IF char_length(requested_name) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION 'USER_UPDATE_NAME_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'role' THEN
    IF jsonb_typeof(p_changes->'role') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_ROLE_INVALID';
    END IF;
    requested_role := p_changes->>'role';
    IF requested_role NOT IN (
      'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
      'equipment_team', 'contest_team', 'social_media_team', 'member'
    ) THEN
      RAISE EXCEPTION 'USER_UPDATE_ROLE_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'is_active' THEN
    IF jsonb_typeof(p_changes->'is_active') <> 'boolean' THEN
      RAISE EXCEPTION 'USER_UPDATE_STATUS_INVALID';
    END IF;
    requested_active := (p_changes->>'is_active')::BOOLEAN;
  END IF;

  IF linked_student_id IS NOT NULL AND requested_role = 'teacher' THEN
    RAISE EXCEPTION 'USER_LINKED_STUDENT_ROLE';
  END IF;
  IF linked_student_id IS NOT NULL AND requested_name IS NOT NULL
     AND requested_name IS DISTINCT FROM target_row.nama THEN
    RAISE EXCEPTION 'USER_LINKED_STUDENT_NAME';
  END IF;
  IF linked_student_id IS NOT NULL AND requested_active IS TRUE
     AND linked_student_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'USER_INACTIVE_STUDENT';
  END IF;

  IF p_changes ? 'username' AND target_row.username IS DISTINCT FROM requested_username THEN
    changed_fields := array_append(changed_fields, 'username');
  END IF;
  IF p_changes ? 'nama' AND target_row.nama IS DISTINCT FROM requested_name THEN
    changed_fields := array_append(changed_fields, 'nama');
  END IF;
  IF p_changes ? 'role' AND target_row.role::TEXT IS DISTINCT FROM requested_role THEN
    changed_fields := array_append(changed_fields, 'role');
  END IF;
  IF p_changes ? 'is_active' AND target_row.is_active IS DISTINCT FROM requested_active THEN
    changed_fields := array_append(changed_fields, 'is_active');
  END IF;

  IF cardinality(changed_fields) = 0 THEN
    RETURN QUERY
    SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active,
           u.is_first_login, u.created_at, u.updated_at, u.created_by, u.updated_by
    FROM public.users AS u
    WHERE u.id = p_user_id;
    RETURN;
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET username = COALESCE(requested_username, u.username),
      nama = COALESCE(requested_name, u.nama),
      role = COALESCE(requested_role::public.user_role, u.role),
      is_active = COALESCE(requested_active, u.is_active),
      updated_by = p_updated_by,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object(
      'username', target_row.username,
      'nama', target_row.nama,
      'role', target_row.role::TEXT,
      'is_active', target_row.is_active
    ),
    jsonb_build_object(
      'operation', 'update_user_account',
      'changed_fields', changed_fields,
      'username', COALESCE(requested_username, target_row.username),
      'nama', COALESCE(requested_name, target_row.nama),
      'role', COALESCE(requested_role, target_row.role::TEXT),
      'is_active', COALESCE(requested_active, target_row.is_active)
    ),
    left(btrim(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'user_account')
  );

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active,
         u.is_first_login, u.created_at, u.updated_at, u.created_by, u.updated_by
  FROM public.users AS u
  WHERE u.id = p_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_cash_transaction_final()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
BEGIN
  IF NEW.type = 'pengeluaran'::transaction_type THEN
    IF NEW.keterangan IS NULL OR TRIM(NEW.keterangan) = '' THEN
      RAISE EXCEPTION 'Untuk pengeluaran, rincian untuk beli apa wajib diisi pada kolom keterangan.';
    END IF;

    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(is_billing, FALSE) THEN 0
        WHEN type = 'pengeluaran'::transaction_type THEN -nominal
        ELSE nominal
      END
    ), 0)
    INTO current_balance
    FROM cash_transactions;

    IF current_balance < NEW.nominal THEN
      RAISE EXCEPTION 'Aksi Ditolak: Saldo kas tidak mencukupi untuk pengeluaran sebesar %', NEW.nominal;
    END IF;
  END IF;
  NEW.tipe := CASE WHEN NEW.type = 'pengeluaran'::transaction_type THEN 'keluar' ELSE 'masuk' END;
  NEW.jumlah := NEW.nominal;
  NEW.tanggal := COALESCE(NEW.tanggal, CURRENT_DATE);
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_cash_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Jika tipe keluar, keterangan wajib diisi (tidak boleh kosong atau hanya spasi)
    IF NEW.tipe = 'keluar' AND (NEW.keterangan IS NULL OR TRIM(NEW.keterangan) = '') THEN
        RAISE EXCEPTION 'Untuk pengeluaran, rincian pembelian (keterangan) wajib diisi.';
    END IF;

    -- Validasi saldo tidak boleh negatif (Opsional namun disarankan)
    -- Ini memerlukan perhitungan saldo saat ini, bisa ditambahkan sesuai kebutuhan bisnis.
    
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_contest_deadline_future()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_deadline DATE;
BEGIN
  v_deadline := COALESCE(NEW.deadline, NEW.tanggal, NEW.tanggal_lomba);

  IF NEW.kota IS NOT NULL OR NEW.tahun_event IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (
         NEW.deadline IS DISTINCT FROM OLD.deadline
         OR NEW.tanggal IS DISTINCT FROM OLD.tanggal
         OR NEW.tanggal_lomba IS DISTINCT FROM OLD.tanggal_lomba
       )) THEN
      IF v_deadline IS NULL
         OR v_deadline <= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = 'CONTEST_DEADLINE_MUST_BE_FUTURE';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.verify_borrowing_self_return_atomic(p_report_id uuid, p_decision text, p_verification_method text, p_item_conditions jsonb, p_rejection_reason text, p_verified_by uuid, p_idempotency_key text, p_change_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_report public.borrowing_return_reports;
  v_borrowing public.borrowings;
  v_operation public.borrowing_return_operations;
  v_item JSONB;
  v_evidence_ids JSONB;
  v_conditions JSONB := '[]'::JSONB;
  v_equipment_ids UUID[] := ARRAY[]::UUID[];
  v_response JSONB;
  v_count INTEGER;
  v_active_count INTEGER;
  v_remaining_count INTEGER;
  v_returned_count INTEGER;
  v_parent_status TEXT;
  v_final_report_status TEXT;
  v_final_borrowing_status TEXT;
  v_equipment_id UUID;
BEGIN
  IF p_report_id IS NULL OR p_verified_by IS NULL OR p_decision IS NULL OR p_decision NOT IN ('approve', 'reject')
     OR (p_decision = 'approve' AND (p_verification_method IS NULL OR p_verification_method NOT IN ('photo', 'physical_check', 'photo_and_physical')))
     OR (p_decision = 'reject' AND length(btrim(COALESCE(p_rejection_reason, ''))) < 5)
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_INPUT_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_verified_by AND is_active = TRUE AND role::TEXT = 'teacher'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ACTOR_FORBIDDEN';
  END IF;

  PERFORM set_config('app.current_user_id', p_verified_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);

  SELECT * INTO v_report
  FROM public.borrowing_return_reports
  WHERE id = p_report_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  INSERT INTO public.borrowing_return_operations (idempotency_key, report_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_report_id, 'verify', p_verified_by)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_operation
    FROM public.borrowing_return_operations
    WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_operation.report_id IS DISTINCT FROM p_report_id
       OR v_operation.actor_id IS DISTINCT FROM p_verified_by
       OR v_operation.operation_kind <> 'verify' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_IDEMPOTENCY_REUSED';
    END IF;
    IF v_operation.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  IF v_report.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;

  SELECT * INTO v_borrowing
  FROM public.borrowings
  WHERE id = v_report.borrowing_id
  FOR UPDATE;
  IF NOT FOUND OR v_borrowing.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  PERFORM bi.id
  FROM public.borrowing_items AS bi
  WHERE bi.borrowing_id = v_borrowing.id AND bi.status = 'borrowed'
  ORDER BY bi.id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_active_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing.id AND status = 'borrowed';
  SELECT COUNT(*) INTO v_returned_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing.id AND status = 'returned';

  IF p_decision = 'reject' THEN
    UPDATE public.borrowing_return_evidence
    SET upload_status = 'abandoned', updated_at = NOW()
    WHERE return_report_id = p_report_id AND upload_status = 'pending';
    UPDATE public.borrowing_return_reports
    SET status = 'rejected', rejection_reason = btrim(p_rejection_reason),
        verified_by = p_verified_by, verified_at = NOW(), updated_at = NOW()
    WHERE id = p_report_id;

    IF v_active_count = 0 THEN
      v_parent_status := 'returned';
    ELSIF v_returned_count > 0 THEN
      v_parent_status := 'partial';
    ELSE
      v_parent_status := 'borrowed';
    END IF;
    UPDATE public.borrowings
    SET status = v_parent_status,
        return_reported_at = NULL,
        return_notes = NULL,
        updated_by = p_verified_by,
        updated_at = NOW()
    WHERE id = v_borrowing.id;

    INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
    VALUES (p_verified_by, 'UPDATE', 'borrowings', v_borrowing.id,
      jsonb_build_object(
        'return_report_id', p_report_id,
        'decision', 'reject',
        'borrowing_status', v_parent_status,
        'remaining_item_count', v_active_count,
        'rejection_reason', btrim(p_rejection_reason)
      ), btrim(p_change_reason));

    v_response := jsonb_build_object(
      'report_id', p_report_id,
      'borrowing_id', v_borrowing.id,
      'status', v_parent_status,
      'report_status', 'rejected',
      'remaining_item_count', v_active_count,
      'idempotent_replay', FALSE
    );
  ELSE
    IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array'
       OR jsonb_array_length(p_item_conditions) = 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_REQUIRED';
    END IF;
    IF jsonb_array_length(p_item_conditions) > v_active_count THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ITEM_NOT_ACTIVE';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
    LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR v_item->>'equipment_id' IS NULL
         OR v_item->>'kondisi_kembali' IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_INVALID';
      END IF;
      v_equipment_id := (v_item->>'equipment_id')::UUID;
      IF v_equipment_id = ANY(v_equipment_ids) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_DUPLICATE_ITEM';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.borrowing_items AS bi
        WHERE bi.borrowing_id = v_borrowing.id
          AND bi.equipment_id = v_equipment_id
          AND bi.status = 'borrowed'
      ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ITEM_NOT_ACTIVE';
      END IF;
      v_equipment_ids := array_append(v_equipment_ids, v_equipment_id);
      SELECT jsonb_agg(to_jsonb(bre.id)) INTO v_evidence_ids
      FROM public.borrowing_return_evidence AS bre
      WHERE bre.return_report_id = p_report_id
        AND bre.equipment_id = v_equipment_id
        AND bre.source = 'student_report'
        AND bre.upload_status = 'pending';
      v_conditions := v_conditions || jsonb_build_array(
        (v_item - 'evidence_ids') || jsonb_build_object('evidence_ids', COALESCE(v_evidence_ids, '[]'::JSONB))
      );
    END LOOP;

    UPDATE public.borrowing_return_evidence
    SET created_by = p_verified_by, updated_at = NOW()
    WHERE return_report_id = p_report_id
      AND equipment_id = ANY(v_equipment_ids)
      AND upload_status = 'pending';

    -- return_borrowing_atomic accepts the operational parent states. Restore
    -- the state derived from already-returned items inside this transaction;
    -- the parent is moved back to pending_verification below when items remain.
    UPDATE public.borrowings
    SET status = CASE WHEN v_returned_count > 0 THEN 'partial' ELSE 'borrowed' END
    WHERE id = v_borrowing.id;
    PERFORM public.return_borrowing_atomic(
      v_borrowing.id, CURRENT_DATE, v_conditions, v_report.notes, p_verified_by, p_change_reason
    );

    UPDATE public.borrowing_return_evidence
    SET created_by = v_report.reporter_id, return_report_id = p_report_id, updated_at = NOW()
    WHERE return_report_id = p_report_id;

    SELECT COUNT(*) INTO v_remaining_count
    FROM public.borrowing_items
    WHERE borrowing_id = v_borrowing.id AND status = 'borrowed';
    IF v_remaining_count = 0 THEN
      v_final_report_status := 'approved';
      v_final_borrowing_status := 'returned';
    ELSE
      v_final_report_status := 'pending_verification';
      v_final_borrowing_status := 'pending_verification';
    END IF;

    UPDATE public.borrowing_return_reports
    SET status = v_final_report_status,
        rejection_reason = NULL,
        verification_method = p_verification_method,
        verified_by = p_verified_by,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_report_id;
    UPDATE public.borrowings
    SET status = v_final_borrowing_status,
        return_reported_at = CASE WHEN v_remaining_count = 0 THEN return_reported_at ELSE COALESCE(return_reported_at, v_report.reported_at, NOW()) END,
        return_verified_at = NOW(),
        return_verified_by = p_verified_by,
        updated_by = p_verified_by,
        updated_at = NOW()
    WHERE id = v_borrowing.id;

    SELECT COUNT(*) INTO v_count
    FROM public.borrowing_return_evidence AS bre
    WHERE bre.return_report_id = p_report_id
      AND bre.equipment_id = ANY(v_equipment_ids)
      AND bre.upload_status = 'attached';
    INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
    VALUES (p_verified_by, 'UPDATE', 'borrowings', v_borrowing.id,
      jsonb_build_object(
        'return_report_id', p_report_id,
        'decision', 'approve',
        'verified_equipment_ids', to_jsonb(v_equipment_ids),
        'verified_evidence_count', v_count,
        'report_status', v_final_report_status,
        'borrowing_status', v_final_borrowing_status,
        'remaining_item_count', v_remaining_count
      ), btrim(p_change_reason));

    v_response := jsonb_build_object(
      'report_id', p_report_id,
      'borrowing_id', v_borrowing.id,
      'status', v_final_borrowing_status,
      'report_status', v_final_report_status,
      'verified_equipment_ids', to_jsonb(v_equipment_ids),
      'remaining_item_count', v_remaining_count,
      'idempotent_replay', FALSE
    );
  END IF;

  UPDATE public.borrowing_return_operations
  SET response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$function$;
CREATE OR REPLACE FUNCTION public.write_audit_log(p_user_id uuid, p_action text, p_table_name text, p_record_id uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_change_reason text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_operation_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'api'::text, p_user_agent text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'Aksi audit wajib diisi.';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values,
    change_reason, request_id, operation_id, source, user_agent, metadata
  ) VALUES (
    p_user_id, upper(trim(p_action)), trim(p_table_name), p_record_id,
    p_old_values, p_new_values, trim(p_change_reason), p_request_id,
    p_operation_id, COALESCE(NULLIF(trim(p_source), ''), 'api'),
    p_user_agent, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
ALTER TABLE public."access_control_audit_logs" ADD CONSTRAINT "access_control_audit_logs_change_reason_check" CHECK (((char_length(change_reason) >= 5) AND (char_length(change_reason) <= 500)));
ALTER TABLE public."access_control_audit_logs" ADD CONSTRAINT "access_control_audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."access_permissions" ADD CONSTRAINT "access_permissions_pkey" PRIMARY KEY (permission_key);
ALTER TABLE public."access_role_permissions" ADD CONSTRAINT "access_role_permissions_pkey" PRIMARY KEY (role_key, permission_key);
ALTER TABLE public."access_roles" ADD CONSTRAINT "access_roles_pkey" PRIMARY KEY (role_key);
ALTER TABLE public."access_roles" ADD CONSTRAINT "access_roles_role_key_check" CHECK ((role_key = ANY (ARRAY['teacher'::text, 'leader'::text, 'vice_leader'::text, 'treasurer'::text, 'secretary'::text, 'equipment_team'::text, 'contest_team'::text, 'social_media_team'::text, 'member'::text])));
ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_activity_description_check" CHECK (((length(btrim(activity_description)) >= 2) AND (length(btrim(activity_description)) <= 2000)));
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_activity_name_check" CHECK (((length(btrim(activity_name)) >= 2) AND (length(btrim(activity_name)) <= 120)));
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_instructor_name_check" CHECK (((length(btrim(instructor_name)) >= 2) AND (length(btrim(instructor_name)) <= 120)));
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_pic_names_check" CHECK (((cardinality(pic_names) >= 1) AND (cardinality(pic_names) <= 10)));
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_pkey" PRIMARY KEY (id);
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_version_check" CHECK ((version >= 1));
ALTER TABLE public."agenda_activity_operations" ADD CONSTRAINT "agenda_activity_operations_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."agenda_activity_operations" ADD CONSTRAINT "agenda_activity_operations_operation_kind_check" CHECK ((operation_kind = ANY (ARRAY['create'::text, 'update'::text, 'archive'::text, 'photo_reserve'::text, 'photo_attach'::text])));
ALTER TABLE public."agenda_activity_operations" ADD CONSTRAINT "agenda_activity_operations_pkey" PRIMARY KEY (idempotency_key);
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_file_size_bytes_check" CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 614400)));
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_object_key_check" CHECK (((length(btrim(object_key)) >= 8) AND (length(btrim(object_key)) <= 1024)));
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_object_key_key" UNIQUE (object_key);
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_original_filename_check" CHECK (((length(btrim(original_filename)) >= 1) AND (length(btrim(original_filename)) <= 255)));
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_pkey" PRIMARY KEY (id);
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_storage_provider_check" CHECK ((storage_provider = 'r2'::text));
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_upload_status_check" CHECK ((upload_status = ANY (ARRAY['pending'::text, 'attached'::text, 'abandoned'::text])));
ALTER TABLE public."agenda_migration_history" ADD CONSTRAINT "agenda_migration_history_pkey" PRIMARY KEY (migration_name);
ALTER TABLE public."api_idempotency_responses" ADD CONSTRAINT "api_idempotency_responses_pkey" PRIMARY KEY (cache_key);
ALTER TABLE public."api_idempotency_responses" ADD CONSTRAINT "api_idempotency_responses_status_code_check" CHECK (((status_code >= 100) AND (status_code <= 599)));
ALTER TABLE public."api_login_rate_limits" ADD CONSTRAINT "api_login_rate_limits_failure_count_check" CHECK ((failure_count >= 0));
ALTER TABLE public."api_login_rate_limits" ADD CONSTRAINT "api_login_rate_limits_pkey" PRIMARY KEY (rate_key);
ALTER TABLE public."api_rate_limit_windows" ADD CONSTRAINT "api_rate_limit_windows_max_requests_check" CHECK (((max_requests >= 1) AND (max_requests <= 100000)));
ALTER TABLE public."api_rate_limit_windows" ADD CONSTRAINT "api_rate_limit_windows_pkey" PRIMARY KEY (rate_key);
ALTER TABLE public."api_rate_limit_windows" ADD CONSTRAINT "api_rate_limit_windows_rate_key_check" CHECK ((rate_key ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public."api_rate_limit_windows" ADD CONSTRAINT "api_rate_limit_windows_request_count_check" CHECK (((request_count >= 1) AND (request_count <= 100001)));
ALTER TABLE public."api_rate_limit_windows" ADD CONSTRAINT "api_rate_limit_windows_window_seconds_check" CHECK (((window_seconds >= 1) AND (window_seconds <= 86400)));
ALTER TABLE public."assignments" ADD CONSTRAINT "assignments_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_status_check" CHECK ((status = ANY (ARRAY['hadir'::text, 'sakit'::text, 'izin'::text, 'alpha'::text])));
ALTER TABLE public."attendance" ADD CONSTRAINT "uq_attendance_student_date" UNIQUE (student_id, tanggal);
ALTER TABLE public."billing_rules" ADD CONSTRAINT "billing_rules_nominal_iuran_wajib_check" CHECK ((nominal_iuran_wajib >= 500));
ALTER TABLE public."billing_rules" ADD CONSTRAINT "billing_rules_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_item_return_condition_check" CHECK (((kondisi_kembali IS NULL) OR (kondisi_kembali = ANY (ARRAY['bagus'::text, 'sedikit_kerusakan'::text, 'rusak'::text, 'rusak_besar'::text, 'sedang_diperbaiki'::text, 'hilang'::text])))) NOT VALID;
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_denda_check" CHECK ((denda >= (0)::numeric)) NOT VALID;
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_returned_condition_check" CHECK ((returned_condition = ANY (ARRAY['baik'::text, 'rusak'::text, 'hilang'::text])));
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'borrowed'::text, 'pending_resolution'::text, 'returned'::text, 'rejected'::text]))) NOT VALID;
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "uq_borrowing_item" UNIQUE (borrowing_id, equipment_id);
ALTER TABLE public."borrowing_migration_history" ADD CONSTRAINT "borrowing_migration_history_pkey" PRIMARY KEY (migration_name);
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_it_replacement_value_snapshot_check" CHECK (((replacement_value_snapshot IS NULL) OR (replacement_value_snapshot > (0)::numeric)));
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_charged_amount_check" CHECK ((charged_amount >= (0)::numeric));
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_repair_cost_check" CHECK (((repair_cost IS NULL) OR (repair_cost >= (0)::numeric)));
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_settlement_method_check" CHECK ((settlement_method = ANY (ARRAY['none'::text, 'repair'::text, 'replacement'::text])));
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "return_assessment_item_amount_check" CHECK ((((settlement_method = 'none'::text) AND (charged_amount = (0)::numeric)) OR ((settlement_method = 'repair'::text) AND (repair_cost IS NOT NULL) AND (charged_amount = repair_cost)) OR ((settlement_method = 'replacement'::text) AND (valuation_id IS NOT NULL) AND (replacement_value_snapshot IS NOT NULL) AND (charged_amount = replacement_value_snapshot))));
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "return_assessment_item_unique" UNIQUE (assessment_id, borrowing_item_id);
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "return_assessment_recovery_settlement_check" CHECK ((((condition = 'bagus'::text) AND (settlement_method = 'none'::text)) OR ((condition = 'hilang'::text) AND (settlement_method = 'replacement'::text)) OR ((condition = ANY (ARRAY['sedikit_kerusakan'::text, 'rusak'::text, 'rusak_besar'::text])) AND (settlement_method = 'repair'::text)))) NOT VALID;
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_damage_charge_check" CHECK ((damage_charge >= (0)::numeric));
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_late_charge_check" CHECK ((late_charge >= (0)::numeric));
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'void'::text])));
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_total_charge_check" CHECK ((total_charge >= (0)::numeric));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_attachment_check" CHECK ((((upload_status = 'pending'::text) AND (attached_at IS NULL) AND (assessment_item_id IS NULL)) OR ((upload_status = 'attached'::text) AND (attached_at IS NOT NULL) AND (assessment_item_id IS NOT NULL)) OR (upload_status = 'abandoned'::text)));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_filename_check" CHECK (((length(btrim(original_filename)) >= 1) AND (length(btrim(original_filename)) <= 255)));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_key_check" CHECK ((((length(btrim(object_key)) >= 8) AND (length(btrim(object_key)) <= 1024)) AND (btrim(object_key) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'::text)));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_mime_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_report_check" CHECK ((((source = 'student_report'::text) AND (return_report_id IS NOT NULL)) OR ((source = 'teacher_return'::text) AND (return_report_id IS NULL))));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_size_check" CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 614400)));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_source_check" CHECK ((source = ANY (ARRAY['teacher_return'::text, 'student_report'::text])));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_status_check" CHECK ((upload_status = ANY (ARRAY['pending'::text, 'attached'::text, 'abandoned'::text])));
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_storage_check" CHECK ((storage_provider = 'r2'::text));
ALTER TABLE public."borrowing_return_operations" ADD CONSTRAINT "borrowing_return_operations_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."borrowing_return_operations" ADD CONSTRAINT "borrowing_return_operations_operation_kind_check" CHECK ((operation_kind = ANY (ARRAY['submit'::text, 'verify'::text])));
ALTER TABLE public."borrowing_return_operations" ADD CONSTRAINT "borrowing_return_operations_pkey" PRIMARY KEY (idempotency_key);
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending_verification'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_verification_method_check" CHECK (((verification_method IS NULL) OR (verification_method = ANY (ARRAY['photo'::text, 'physical_check'::text, 'photo_and_physical'::text]))));
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_pkey" PRIMARY KEY (id);
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'borrowed'::text, 'returned'::text, 'partial'::text, 'pending_verification'::text])));
ALTER TABLE public."cash_billing_runs" ADD CONSTRAINT "cash_billing_runs_billing_week_key" UNIQUE (billing_week);
ALTER TABLE public."cash_billing_runs" ADD CONSTRAINT "cash_billing_runs_nominal_iuran_wajib_check" CHECK ((nominal_iuran_wajib >= (500)::numeric));
ALTER TABLE public."cash_billing_runs" ADD CONSTRAINT "cash_billing_runs_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_billing_runs" ADD CONSTRAINT "cash_billing_runs_status_check" CHECK ((status = ANY (ARRAY['generated'::text, 'skipped_holiday'::text, 'skipped_manual'::text, 'failed'::text])));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_attempt_number_check" CHECK ((attempt_number > 0));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_exactly_one_target_check" CHECK (((transaction_id IS NOT NULL) <> (debt_record_id IS NOT NULL)));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_idempotency_key_check" CHECK (((idempotency_key IS NULL) OR ((length(TRIM(BOTH FROM idempotency_key)) >= 8) AND (length(TRIM(BOTH FROM idempotency_key)) <= 128))));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_review_note_check" CHECK (((status = 'pending'::text) OR (length(TRIM(BOTH FROM COALESCE(review_note, ''::text))) >= 5)));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "uq_dispute_per_transaction" UNIQUE (transaction_id);
ALTER TABLE public."cash_migration_history" ADD CONSTRAINT "cash_migration_history_pkey" PRIMARY KEY (migration_name);
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_code_format" CHECK ((code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'::text));
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_code_key" UNIQUE (code);
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_label_length" CHECK (((length(TRIM(BOTH FROM label)) >= 1) AND (length(TRIM(BOTH FROM label)) <= 80)));
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_holiday_range" CHECK (((holiday_start_date IS NULL) OR (holiday_end_date IS NULL) OR (holiday_start_date <= holiday_end_date)));
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_id_check" CHECK ((id = true));
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_nominal_iuran_wajib_check" CHECK ((nominal_iuran_wajib >= (500)::numeric));
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_nominal_positive" CHECK ((nominal > (0)::numeric));
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_saldo_nonnegative" CHECK ((saldo_sesudah >= (0)::numeric));
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_saldo_sebelum_nonnegative" CHECK ((saldo_sebelum >= (0)::numeric)) NOT VALID;
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_tipe_check" CHECK ((tipe = ANY (ARRAY['masuk'::text, 'keluar'::text])));
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "check_jumlah_positif" CHECK ((jumlah > 0));
ALTER TABLE public."classes" ADD CONSTRAINT "classes_nama_kelas_key" UNIQUE (nama_kelas);
ALTER TABLE public."classes" ADD CONSTRAINT "classes_pkey" PRIMARY KEY (id);
ALTER TABLE public."classes" ADD CONSTRAINT "classes_tingkat_check" CHECK ((tingkat = ANY (ARRAY['X'::text, 'XI'::text, 'XII'::text])));
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_pipeline_status_check" CHECK ((pipeline_status = ANY (ARRAY['proses_submit'::text, 'sudah_terkirim'::text, 'menunggu_pengumuman'::text, 'selesai'::text])));
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_version_check" CHECK ((version > 0));
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entry_outcome_status_check" CHECK ((outcome_status = ANY (ARRAY['pending'::text, 'awarded'::text, 'not_awarded'::text])));
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entry_result_check" CHECK (((pipeline_status <> 'selesai'::text) OR (length(TRIM(BOTH FROM COALESCE(result_label, ''::text))) >= 2)));
ALTER TABLE public."contest_entries" ADD CONSTRAINT "uq_contest_entry_work" UNIQUE (contest_id, work_id);
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_attached_status_check" CHECK (((attached_status IS NULL) OR (attached_status = ANY (ARRAY['sudah_terkirim'::text, 'selesai'::text]))));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_attachment_check" CHECK (((upload_status <> 'attached'::text) OR (NOT (attached_status IS DISTINCT FROM target_status)) OR ((storage_provider = 'legacy_url'::text) AND (target_status IS NULL) AND (attached_status IS NULL))));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_evidence_type_check" CHECK ((evidence_type = ANY (ARRAY['submission'::text, 'result'::text, 'other'::text])));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_pending_metadata_check" CHECK (((upload_status <> 'pending'::text) OR ((storage_provider = 'r2'::text) AND (target_status = ANY (ARRAY['sudah_terkirim'::text, 'selesai'::text])) AND (mime_type IS NOT NULL) AND (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])) AND (file_size_bytes IS NOT NULL) AND ((file_size_bytes >= 1) AND (file_size_bytes <= 5242880)) AND ((length(btrim(COALESCE(original_filename, ''::text))) >= 1) AND (length(btrim(COALESCE(original_filename, ''::text))) <= 255)))));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_source_check" CHECK ((((storage_provider = 'legacy_url'::text) AND (NULLIF(btrim(public_url), ''::text) IS NOT NULL)) OR ((storage_provider = 'r2'::text) AND (NULLIF(btrim(object_key), ''::text) IS NOT NULL))));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_storage_provider_check" CHECK ((storage_provider = ANY (ARRAY['legacy_url'::text, 'r2'::text])));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_target_status_check" CHECK (((target_status IS NULL) OR (target_status = ANY (ARRAY['sudah_terkirim'::text, 'selesai'::text]))));
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_upload_status_check" CHECK ((upload_status = ANY (ARRAY['pending'::text, 'attached'::text, 'abandoned'::text])));
ALTER TABLE public."contest_entry_members" ADD CONSTRAINT "contest_entry_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entry_members" ADD CONSTRAINT "contest_entry_members_role_check" CHECK (((length(TRIM(BOTH FROM role)) >= 2) AND (length(TRIM(BOTH FROM role)) <= 120)));
ALTER TABLE public."contest_entry_members" ADD CONSTRAINT "uq_contest_entry_member_role" UNIQUE (entry_id, student_id, role);
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_operation_kind_check" CHECK ((operation_kind = ANY (ARRAY['transition'::text, 'finalize'::text])));
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_pkey" PRIMARY KEY (idempotency_key);
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_target_status_check" CHECK ((target_status = ANY (ARRAY['sudah_terkirim'::text, 'menunggu_pengumuman'::text, 'selesai'::text])));
ALTER TABLE public."contest_entry_result_history" ADD CONSTRAINT "contest_entry_result_history_change_reason_check" CHECK (((length(btrim(change_reason)) >= 5) AND (length(btrim(change_reason)) <= 500)));
ALTER TABLE public."contest_entry_result_history" ADD CONSTRAINT "contest_entry_result_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entry_result_history" ADD CONSTRAINT "contest_entry_result_history_to_outcome_status_check" CHECK ((to_outcome_status = ANY (ARRAY['pending'::text, 'awarded'::text, 'not_awarded'::text])));
ALTER TABLE public."contest_entry_result_operations" ADD CONSTRAINT "contest_entry_result_operations_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."contest_entry_result_operations" ADD CONSTRAINT "contest_entry_result_operations_pkey" PRIMARY KEY (idempotency_key);
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_result_position_check" CHECK ((((result_kind = ANY (ARRAY['rank'::text, 'top_n'::text])) AND ("position" IS NOT NULL)) OR (result_kind <> ALL (ARRAY['rank'::text, 'top_n'::text]))));
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_category_name_check" CHECK (((category_name IS NULL) OR ((length(btrim(category_name)) >= 1) AND (length(btrim(category_name)) <= 160))));
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_notes_check" CHECK (((notes IS NULL) OR (length(btrim(notes)) <= 2000)));
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_position_check" CHECK ((("position" IS NULL) OR (("position" >= 1) AND ("position" <= 100000))));
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_result_kind_check" CHECK ((result_kind = ANY (ARRAY['rank'::text, 'top_n'::text, 'special_award'::text, 'finalist'::text, 'nominee'::text, 'honorable_mention'::text, 'other'::text])));
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_result_title_check" CHECK (((length(btrim(result_title)) >= 2) AND (length(btrim(result_title)) <= 200)));
ALTER TABLE public."contest_entry_status_history" ADD CONSTRAINT "contest_entry_status_history_change_reason_check" CHECK ((length(TRIM(BOTH FROM change_reason)) >= 5));
ALTER TABLE public."contest_entry_status_history" ADD CONSTRAINT "contest_entry_status_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_entry_status_history" ADD CONSTRAINT "contest_entry_status_history_to_status_check" CHECK ((to_status = ANY (ARRAY['proses_submit'::text, 'sudah_terkirim'::text, 'menunggu_pengumuman'::text, 'selesai'::text])));
ALTER TABLE public."contest_films" ADD CONSTRAINT "contest_films_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_films" ADD CONSTRAINT "uq_contest_film" UNIQUE (contest_id, film_id);
ALTER TABLE public."contest_members" ADD CONSTRAINT "contest_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_members" ADD CONSTRAINT "uq_contest_member" UNIQUE (contest_id, student_id);
ALTER TABLE public."contest_migration_history" ADD CONSTRAINT "contest_migration_history_pkey" PRIMARY KEY (migration_name);
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_crew_members_check" CHECK ((jsonb_typeof(crew_members) = 'array'::text));
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_judul_film_check" CHECK ((length(TRIM(BOTH FROM judul_film)) > 0));
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "uq_contest_submission_title" UNIQUE (contest_id, judul_film);
ALTER TABLE public."contest_task_assignees" ADD CONSTRAINT "contest_task_assignees_pkey" PRIMARY KEY (task_id, student_id);
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])));
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 2) AND (length(TRIM(BOTH FROM title)) <= 200)));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_academic_year_check" CHECK ((academic_year ~ '^[0-9]{4}$'::text));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_event_city_check" CHECK (((kota IS NULL) OR ((length(btrim(kota)) >= 2) AND (length(btrim(kota)) <= 120))));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_event_year_check" CHECK (((tahun_event IS NULL) OR ((tahun_event >= 1900) AND (tahun_event <= 2200))));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_pkey" PRIMARY KEY (id);
ALTER TABLE public."contests" ADD CONSTRAINT "contests_planned_work_count_check" CHECK (((planned_work_count IS NULL) OR (planned_work_count > 0)));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_status_public_check" CHECK (((status_public IS NULL) OR (status_public = ANY (ARRAY['buka'::text, 'proses_penjurian'::text, 'selesai'::text]))));
ALTER TABLE public."contests" ADD CONSTRAINT "contests_tingkat_scope_check" CHECK ((tingkat = ANY (ARRAY['bekasi'::text, 'jabodetabek'::text, 'jawa_barat'::text, 'nasional'::text, 'umum'::text])));
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_amount_check" CHECK ((amount > 0));
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_status_check" CHECK ((status = ANY (ARRAY['unpaid'::text, 'paid'::text])));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_asset_state_check" CHECK ((asset_state = ANY (ARRAY['active'::text, 'lost'::text, 'retired'::text])));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_fotos_check" CHECK ((array_length(fotos, 1) >= 3));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_kategori_check" CHECK ((kategori = ANY (ARRAY['Kamera'::text, 'Lensa'::text, 'Audio'::text, 'Lighting'::text, 'Aksesoris'::text, 'Lainnya'::text])));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_kode_qr_key" UNIQUE (kode_qr);
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_kondisi_check" CHECK ((kondisi = ANY (ARRAY['bagus'::text, 'sedikit_kerusakan'::text, 'rusak'::text, 'rusak_besar'::text, 'sedang_diperbaiki'::text, 'hilang'::text])));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_status_check" CHECK ((status = ANY (ARRAY['tersedia'::text, 'dipinjam'::text, 'maintenance'::text])));
ALTER TABLE public."equipment_charge_payments" ADD CONSTRAINT "equipment_charge_payments_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."equipment_charge_payments" ADD CONSTRAINT "equipment_charge_payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_amount_check" CHECK (((paid_amount <= amount) OR (status = 'waived'::text)));
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_assessment_item_id_key" UNIQUE (assessment_item_id);
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_paid_amount_check" CHECK ((paid_amount >= (0)::numeric));
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_status_check" CHECK ((status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text, 'waived'::text])));
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_status_check" CHECK ((((status = 'unpaid'::text) AND (paid_amount = (0)::numeric)) OR ((status = 'partial'::text) AND (paid_amount > (0)::numeric) AND (paid_amount < amount)) OR ((status = 'paid'::text) AND (paid_amount >= amount)) OR (status = 'waived'::text)));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_evidence_type_check" CHECK ((evidence_type = ANY (ARRAY['payment'::text, 'repair'::text, 'replacement'::text])));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_file_size_bytes_check" CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 614400)));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_object_key_key" UNIQUE (object_key);
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_original_filename_check" CHECK (((length(TRIM(BOTH FROM original_filename)) >= 1) AND (length(TRIM(BOTH FROM original_filename)) <= 255)));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_storage_provider_check" CHECK ((storage_provider = 'r2'::text));
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_upload_status_check" CHECK ((upload_status = ANY (ARRAY['pending'::text, 'attached'::text, 'abandoned'::text])));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_actual_cost_check" CHECK (((actual_cost IS NULL) OR (actual_cost >= (0)::numeric)));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_estimated_cost_check" CHECK (((estimated_cost IS NULL) OR (estimated_cost > (0)::numeric)));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_recovery_type_check" CHECK ((recovery_type = ANY (ARRAY['repair'::text, 'replacement'::text])));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_reported_condition_check" CHECK ((reported_condition = ANY (ARRAY['sedikit_kerusakan'::text, 'rusak'::text, 'rusak_besar'::text, 'sedang_diperbaiki'::text, 'hilang'::text])));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'awaiting_verification'::text, 'completed'::text, 'unrepairable'::text, 'cancelled'::text])));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_completion_check" CHECK ((((status = 'completed'::text) AND (completed_at IS NOT NULL) AND ((recovery_type <> 'repair'::text) OR (inspection_passed = true))) OR (status <> 'completed'::text)));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_photos_array" CHECK ((jsonb_typeof(inspection_photos) = 'array'::text));
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_replacement_link_check" CHECK (((recovery_type <> 'replacement'::text) OR (status <> 'completed'::text) OR (replacement_equipment_id IS NOT NULL)));
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_reason_check" CHECK ((length(TRIM(BOTH FROM change_reason)) >= 5));
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_replacement_value_check" CHECK ((replacement_value > (0)::numeric));
ALTER TABLE public."film_crew" ADD CONSTRAINT "film_crew_pkey" PRIMARY KEY (id);
ALTER TABLE public."film_crew" ADD CONSTRAINT "uq_film_crew" UNIQUE (film_id, student_id);
ALTER TABLE public."film_works" ADD CONSTRAINT "film_works_genre_check" CHECK ((genre = ANY (ARRAY['short_film'::text, 'dokumenter'::text, 'animasi'::text, 'iklan'::text, 'klip_musik'::text, 'eksperimental'::text, 'lainnya'::text])));
ALTER TABLE public."film_works" ADD CONSTRAINT "film_works_pkey" PRIMARY KEY (id);
ALTER TABLE public."film_works" ADD CONSTRAINT "film_works_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'produksi'::text, 'pasca_produksi'::text, 'selesai'::text, 'dilombakan'::text])));
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_period_dates_valid" CHECK ((start_date <= end_date));
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_academic_year_check" CHECK ((academic_year ~ '^[0-9]{4}/[0-9]{4}$'::text));
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_pkey" PRIMARY KEY (id);
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_semester_check" CHECK ((semester = ANY (ARRAY['ganjil'::text, 'genap'::text])));
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text])));
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "uq_grade_report_period" UNIQUE (academic_year, semester);
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_alpha_count_check" CHECK ((alpha_count >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_evidence_count_check" CHECK ((evidence_count >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_hadir_count_check" CHECK ((hadir_count >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_izin_count_check" CHECK ((izin_count >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_pkl_days_check" CHECK ((pkl_days >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_sakit_count_check" CHECK ((sakit_count >= 0));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text])));
ALTER TABLE public."grade_reports" ADD CONSTRAINT "uq_grade_report_period_student" UNIQUE (period_id, student_id);
ALTER TABLE public."grades" ADD CONSTRAINT "grades_pkey" PRIMARY KEY (id);
ALTER TABLE public."grades" ADD CONSTRAINT "grades_status_check" CHECK ((status = ANY (ARRAY['graded'::text, 'ungraded'::text])));
ALTER TABLE public."grades" ADD CONSTRAINT "uq_student_assignment" UNIQUE (student_id, assignment_id);
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_duration_minutes_check" CHECK (((duration_minutes IS NULL) OR (duration_minutes > (0)::numeric)));
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_pkey" PRIMARY KEY (id);
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_production_year_check" CHECK (((production_year IS NULL) OR ((production_year >= 1900) AND (production_year <= 2200))));
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 2) AND (length(TRIM(BOTH FROM title)) <= 200)));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_pkey" PRIMARY KEY (id);
ALTER TABLE public."offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text])));
ALTER TABLE public."password_reset_operations" ADD CONSTRAINT "password_reset_operations_operation_key_check" CHECK (((char_length(operation_key) >= 8) AND (char_length(operation_key) <= 128)));
ALTER TABLE public."password_reset_operations" ADD CONSTRAINT "password_reset_operations_pkey" PRIMARY KEY (operation_key);
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE (endpoint);
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."schema_migrations" ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY (migration_name);
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "social_account_snapshots_audience_count_check" CHECK ((audience_count >= 0));
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "social_account_snapshots_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "social_account_snapshots_pkey" PRIMARY KEY (id);
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "uq_social_snapshot_account_date" UNIQUE (social_account_id, as_of_date);
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "uq_social_snapshot_idempotency" UNIQUE (created_by, idempotency_key);
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_account_name_check" CHECK (((length(btrim(account_name)) >= 2) AND (length(btrim(account_name)) <= 120)));
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_account_url_check" CHECK (((length(btrim(account_url)) >= 12) AND (length(btrim(account_url)) <= 500)));
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_idempotency_key_check" CHECK (((idempotency_key IS NULL) OR ((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128))));
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text, 'whatsapp'::text])));
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_version_check" CHECK ((version >= 1));
ALTER TABLE public."social_accounts" ADD CONSTRAINT "uq_social_accounts_platform_name" UNIQUE (platform, account_name);
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_archive_month_first_day" CHECK (((archive_month IS NULL) OR (archive_month = (date_trunc('month'::text, (archive_month)::timestamp with time zone))::date)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_period_dates_valid" CHECK ((period_start <= period_end));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_comments_check" CHECK (((comments IS NULL) OR (comments >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_followers_gained_check" CHECK (((followers_gained IS NULL) OR (followers_gained >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_followers_lost_check" CHECK (((followers_lost IS NULL) OR (followers_lost >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_impressions_check" CHECK (((impressions IS NULL) OR (impressions >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_interactions_check" CHECK (((interactions IS NULL) OR (interactions >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_likes_check" CHECK (((likes IS NULL) OR (likes >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_notes_check" CHECK ((length(notes) <= 2000));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_pkey" PRIMARY KEY (id);
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_poll_votes_check" CHECK (((poll_votes IS NULL) OR (poll_votes >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_profile_visits_check" CHECK (((profile_visits IS NULL) OR (profile_visits >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_published_count_check" CHECK (((published_count IS NULL) OR (published_count >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_reach_check" CHECK (((reach IS NULL) OR (reach >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_reactions_check" CHECK (((reactions IS NULL) OR (reactions >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_saves_check" CHECK (((saves IS NULL) OR (saves >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_shares_check" CHECK (((shares IS NULL) OR (shares >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'recorded'::text, 'archived'::text])));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_subscribers_gained_check" CHECK (((subscribers_gained IS NULL) OR (subscribers_gained >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_subscribers_lost_check" CHECK (((subscribers_lost IS NULL) OR (subscribers_lost >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_version_check" CHECK ((version >= 1));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_views_check" CHECK (((views IS NULL) OR (views >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_watch_time_minutes_check" CHECK (((watch_time_minutes IS NULL) OR (watch_time_minutes >= 0)));
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "uq_social_insight_idempotency" UNIQUE (created_by, idempotency_key);
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "uq_social_insight_period_account_dates" UNIQUE (social_account_id, period_start, period_end);
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_exactly_one_parent" CHECK (((((publication_id IS NOT NULL))::integer + ((insight_period_id IS NOT NULL))::integer) = 1));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_file_size_bytes_check" CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 5242880)));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_object_key_check" CHECK (((length(btrim(object_key)) >= 8) AND (length(btrim(object_key)) <= 1024)));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_object_key_key" UNIQUE (object_key);
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_original_filename_check" CHECK (((length(btrim(original_filename)) >= 1) AND (length(btrim(original_filename)) <= 255)));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_storage_provider_check" CHECK ((storage_provider = 'r2'::text));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_upload_status_check" CHECK ((upload_status = ANY (ARRAY['pending'::text, 'attached'::text, 'abandoned'::text])));
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "uq_social_media_evidence_idempotency" UNIQUE (created_by, idempotency_key);
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_caption_check" CHECK ((length(caption) <= 5000));
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_content_type_check" CHECK ((content_type = ANY (ARRAY['feed'::text, 'reel'::text, 'story'::text, 'video'::text, 'short'::text, 'community_post'::text, 'channel_post'::text])));
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_idempotency_key_check" CHECK (((length(btrim(idempotency_key)) >= 8) AND (length(btrim(idempotency_key)) <= 128)));
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_pkey" PRIMARY KEY (id);
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text, 'whatsapp'::text])));
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'recorded'::text, 'archived'::text])));
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_version_check" CHECK ((version >= 1));
ALTER TABLE public."social_publications" ADD CONSTRAINT "uq_social_publication_idempotency" UNIQUE (created_by, idempotency_key);
ALTER TABLE public."student_account_operations" ADD CONSTRAINT "student_account_operations_operation_type_check" CHECK ((operation_type = ANY (ARRAY['create'::text, 'provision'::text])));
ALTER TABLE public."student_account_operations" ADD CONSTRAINT "student_account_operations_pkey" PRIMARY KEY (actor_id, operation_key);
ALTER TABLE public."student_account_operations" ADD CONSTRAINT "student_account_operations_request_fingerprint_check" CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_period_dates_valid" CHECK ((start_date <= end_date));
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_institution_check" CHECK (((length(TRIM(BOTH FROM institution)) >= 2) AND (length(TRIM(BOTH FROM institution)) <= 200)));
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_pkey" PRIMARY KEY (id);
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text])));
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "uq_student_pkl_period" UNIQUE (student_id, start_date, end_date);
ALTER TABLE public."students" ADD CONSTRAINT "students_nis_key" UNIQUE (nis);
ALTER TABLE public."students" ADD CONSTRAINT "students_peminatan_check" CHECK ((peminatan = ANY (ARRAY['kamera'::text, 'editing'::text, 'naskah'::text])));
ALTER TABLE public."students" ADD CONSTRAINT "students_pkey" PRIMARY KEY (id);
ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE public."users" ADD CONSTRAINT "users_username_key" UNIQUE (username);
ALTER TABLE public."work_types" ADD CONSTRAINT "work_types_pkey" PRIMARY KEY (code);
ALTER TABLE public."access_control_audit_logs" ADD CONSTRAINT "access_control_audit_logs_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."access_role_permissions" ADD CONSTRAINT "access_role_permissions_permission_key_fkey" FOREIGN KEY (permission_key) REFERENCES access_permissions(permission_key) ON DELETE CASCADE;
ALTER TABLE public."access_role_permissions" ADD CONSTRAINT "access_role_permissions_role_key_fkey" FOREIGN KEY (role_key) REFERENCES access_roles(role_key) ON DELETE CASCADE;
ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_archived_by_fkey" FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."agenda_activities" ADD CONSTRAINT "agenda_activities_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."agenda_activity_operations" ADD CONSTRAINT "agenda_activity_operations_activity_id_fkey" FOREIGN KEY (activity_id) REFERENCES agenda_activities(id) ON DELETE CASCADE;
ALTER TABLE public."agenda_activity_operations" ADD CONSTRAINT "agenda_activity_operations_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_activity_id_fkey" FOREIGN KEY (activity_id) REFERENCES agenda_activities(id) ON DELETE CASCADE;
ALTER TABLE public."agenda_activity_photos" ADD CONSTRAINT "agenda_activity_photos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."assignments" ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public."assignments" ADD CONSTRAINT "assignments_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."billing_rules" ADD CONSTRAINT "billing_rules_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_borrowing_id_fkey" FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id);
ALTER TABLE public."borrowing_items" ADD CONSTRAINT "borrowing_items_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_assessment_id_fkey" FOREIGN KEY (assessment_id) REFERENCES borrowing_return_assessments(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_borrowing_item_id_fkey" FOREIGN KEY (borrowing_item_id) REFERENCES borrowing_items(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_assessment_items" ADD CONSTRAINT "borrowing_return_assessment_items_valuation_id_fkey" FOREIGN KEY (valuation_id) REFERENCES equipment_valuations(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_borrowing_id_fkey" FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_return_assessments" ADD CONSTRAINT "borrowing_return_assessments_finalized_by_fkey" FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_assessment_item_id_fkey" FOREIGN KEY (assessment_item_id) REFERENCES borrowing_return_assessment_items(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_borrowing_id_fkey" FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_borrowing_item_id_fkey" FOREIGN KEY (borrowing_item_id) REFERENCES borrowing_items(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_evidence" ADD CONSTRAINT "borrowing_return_evidence_report_fk" FOREIGN KEY (return_report_id) REFERENCES borrowing_return_reports(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_operations" ADD CONSTRAINT "borrowing_return_operations_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_operations" ADD CONSTRAINT "borrowing_return_operations_report_id_fkey" FOREIGN KEY (report_id) REFERENCES borrowing_return_reports(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_borrowing_id_fkey" FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE;
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."borrowing_return_reports" ADD CONSTRAINT "borrowing_return_reports_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES users(id);
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_processed_return_by_fkey" FOREIGN KEY (processed_return_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_return_verified_by_fkey" FOREIGN KEY (return_verified_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public."borrowings" ADD CONSTRAINT "borrowings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_billing_runs" ADD CONSTRAINT "cash_billing_runs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_debt_record_id_fkey" FOREIGN KEY (debt_record_id) REFERENCES debt_records(id) ON DELETE CASCADE;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_previous_dispute_id_fkey" FOREIGN KEY (previous_dispute_id) REFERENCES cash_disputes(id) ON DELETE SET NULL;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_resolution_transaction_id_fkey" FOREIGN KEY (resolution_transaction_id) REFERENCES cash_transactions(id) ON DELETE SET NULL;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES users(id);
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES cash_transactions(id);
ALTER TABLE public."cash_disputes" ADD CONSTRAINT "cash_disputes_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_payment_methods" ADD CONSTRAINT "cash_payment_methods_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_settings" ADD CONSTRAINT "cash_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES cash_payment_methods(id) ON DELETE RESTRICT;
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public."cash_transactions" ADD CONSTRAINT "cash_transactions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."classes" ADD CONSTRAINT "classes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."classes" ADD CONSTRAINT "classes_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_contest_id_fkey" FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entries" ADD CONSTRAINT "contest_entries_work_id_fkey" FOREIGN KEY (work_id) REFERENCES media_works(id) ON DELETE RESTRICT;
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_evidence" ADD CONSTRAINT "contest_entry_evidence_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_members" ADD CONSTRAINT "contest_entry_members_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_members" ADD CONSTRAINT "contest_entry_members_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_pipeline_operations" ADD CONSTRAINT "contest_entry_pipeline_operations_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_result_history" ADD CONSTRAINT "contest_entry_result_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_result_history" ADD CONSTRAINT "contest_entry_result_history_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_result_operations" ADD CONSTRAINT "contest_entry_result_operations_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_result_operations" ADD CONSTRAINT "contest_entry_result_operations_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_results" ADD CONSTRAINT "contest_entry_results_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_status_history" ADD CONSTRAINT "contest_entry_status_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_entry_status_history" ADD CONSTRAINT "contest_entry_status_history_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_films" ADD CONSTRAINT "contest_films_contest_id_fkey" FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE;
ALTER TABLE public."contest_films" ADD CONSTRAINT "contest_films_film_id_fkey" FOREIGN KEY (film_id) REFERENCES film_works(id) ON DELETE CASCADE;
ALTER TABLE public."contest_members" ADD CONSTRAINT "contest_members_contest_id_fkey" FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE;
ALTER TABLE public."contest_members" ADD CONSTRAINT "contest_members_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_members" ADD CONSTRAINT "contest_members_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_contest_id_fkey" FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE;
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_film_id_fkey" FOREIGN KEY (film_id) REFERENCES film_works(id) ON DELETE SET NULL;
ALTER TABLE public."contest_submissions" ADD CONSTRAINT "contest_submissions_sutradara_id_fkey" FOREIGN KEY (sutradara_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE public."contest_task_assignees" ADD CONSTRAINT "contest_task_assignees_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."contest_task_assignees" ADD CONSTRAINT "contest_task_assignees_task_id_fkey" FOREIGN KEY (task_id) REFERENCES contest_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contest_entries(id) ON DELETE CASCADE;
ALTER TABLE public."contest_tasks" ADD CONSTRAINT "contest_tasks_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contests" ADD CONSTRAINT "contests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."contests" ADD CONSTRAINT "contests_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_settled_transaction_id_fkey" FOREIGN KEY (settled_transaction_id) REFERENCES cash_transactions(id);
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_source_transaction_id_fkey" FOREIGN KEY (source_transaction_id) REFERENCES cash_transactions(id);
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public."debt_records" ADD CONSTRAINT "debt_records_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_charge_payments" ADD CONSTRAINT "equipment_charge_payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."equipment_charge_payments" ADD CONSTRAINT "equipment_charge_payments_settlement_id_fkey" FOREIGN KEY (settlement_id) REFERENCES equipment_charge_settlements(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_assessment_item_id_fkey" FOREIGN KEY (assessment_item_id) REFERENCES borrowing_return_assessment_items(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_borrowing_id_fkey" FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_charge_settlements" ADD CONSTRAINT "equipment_charge_settlements_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES equipment_charge_payments(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_evidence" ADD CONSTRAINT "equipment_evidence_settlement_id_fkey" FOREIGN KEY (settlement_id) REFERENCES equipment_charge_settlements(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_assessment_item_id_fkey" FOREIGN KEY (assessment_item_id) REFERENCES borrowing_return_assessment_items(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT;
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_opened_by_fkey" FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_replacement_equipment_id_fkey" FOREIGN KEY (replacement_equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT;
ALTER TABLE public."equipment_recovery_cases" ADD CONSTRAINT "equipment_recovery_cases_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."equipment_valuations" ADD CONSTRAINT "equipment_valuations_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT;
ALTER TABLE public."film_crew" ADD CONSTRAINT "film_crew_film_id_fkey" FOREIGN KEY (film_id) REFERENCES film_works(id) ON DELETE CASCADE;
ALTER TABLE public."film_crew" ADD CONSTRAINT "film_crew_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."grade_report_periods" ADD CONSTRAINT "grade_report_periods_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_period_id_fkey" FOREIGN KEY (period_id) REFERENCES grade_report_periods(id) ON DELETE CASCADE;
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."grade_reports" ADD CONSTRAINT "grade_reports_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."grades" ADD CONSTRAINT "grades_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
ALTER TABLE public."grades" ADD CONSTRAINT "grades_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public."grades" ADD CONSTRAINT "grades_graded_by_fkey" FOREIGN KEY (graded_by) REFERENCES users(id);
ALTER TABLE public."grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."grades" ADD CONSTRAINT "grades_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."media_works" ADD CONSTRAINT "media_works_work_type_code_fkey" FOREIGN KEY (work_type_code) REFERENCES work_types(code) ON UPDATE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."password_reset_operations" ADD CONSTRAINT "password_reset_operations_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public."password_reset_operations" ADD CONSTRAINT "password_reset_operations_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "social_account_snapshots_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_account_snapshots" ADD CONSTRAINT "social_account_snapshots_social_account_id_fkey" FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_accounts" ADD CONSTRAINT "social_accounts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_social_account_id_fkey" FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."social_insight_periods" ADD CONSTRAINT "social_insight_periods_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_insight_period_id_fkey" FOREIGN KEY (insight_period_id) REFERENCES social_insight_periods(id) ON DELETE CASCADE;
ALTER TABLE public."social_media_evidence" ADD CONSTRAINT "social_media_evidence_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES social_publications(id) ON DELETE CASCADE;
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_agenda_activity_id_fkey" FOREIGN KEY (agenda_activity_id) REFERENCES agenda_activities(id) ON DELETE SET NULL;
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_social_account_id_fkey" FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."social_publications" ADD CONSTRAINT "social_publications_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."student_pkl_periods" ADD CONSTRAINT "student_pkl_periods_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE public."students" ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."students" ADD CONSTRAINT "students_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS public."equipment_kode_alat_unique";
CREATE UNIQUE INDEX equipment_kode_alat_unique ON public.equipment USING btree (kode_alat);
DROP INDEX IF EXISTS public."idx_access_control_audit_logs_actor_created";
CREATE INDEX idx_access_control_audit_logs_actor_created ON public.access_control_audit_logs USING btree (actor_user_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_access_control_audit_logs_role_created";
CREATE INDEX idx_access_control_audit_logs_role_created ON public.access_control_audit_logs USING btree (role_key, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_access_role_permissions_permission";
CREATE INDEX idx_access_role_permissions_permission ON public.access_role_permissions USING btree (permission_key, role_key);
DROP INDEX IF EXISTS public."idx_activity_logs_created_at_id";
CREATE INDEX idx_activity_logs_created_at_id ON public.activity_logs USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_activity_logs_table_created_at_id";
CREATE INDEX idx_activity_logs_table_created_at_id ON public.activity_logs USING btree (table_name, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_activity_logs_table_record_created_at_id";
CREATE INDEX idx_activity_logs_table_record_created_at_id ON public.activity_logs USING btree (table_name, record_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_activity_logs_user_created_at_id";
CREATE INDEX idx_activity_logs_user_created_at_id ON public.activity_logs USING btree (user_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_agenda_activity_date_id";
CREATE INDEX idx_agenda_activity_date_id ON public.agenda_activities USING btree (activity_date DESC, id DESC) WHERE (archived_at IS NULL);
DROP INDEX IF EXISTS public."idx_agenda_activity_updated_at_id";
CREATE INDEX idx_agenda_activity_updated_at_id ON public.agenda_activities USING btree (updated_at DESC, id DESC) WHERE (archived_at IS NULL);
DROP INDEX IF EXISTS public."idx_agenda_photo_cleanup";
CREATE INDEX idx_agenda_photo_cleanup ON public.agenda_activity_photos USING btree (expires_at, id) WHERE (upload_status = 'pending'::text);
DROP INDEX IF EXISTS public."idx_api_idempotency_responses_expiry";
CREATE INDEX idx_api_idempotency_responses_expiry ON public.api_idempotency_responses USING btree (expires_at);
DROP INDEX IF EXISTS public."idx_api_login_rate_limits_updated_at";
CREATE INDEX idx_api_login_rate_limits_updated_at ON public.api_login_rate_limits USING btree (updated_at);
DROP INDEX IF EXISTS public."idx_api_rate_limit_windows_updated";
CREATE INDEX idx_api_rate_limit_windows_updated ON public.api_rate_limit_windows USING btree (updated_at);
DROP INDEX IF EXISTS public."idx_assignments_kelas_due_id";
CREATE INDEX idx_assignments_kelas_due_id ON public.assignments USING btree (kelas, due_date DESC, id DESC);
DROP INDEX IF EXISTS public."idx_attendance_tanggal_status";
CREATE INDEX idx_attendance_tanggal_status ON public.attendance USING btree (tanggal, status);
DROP INDEX IF EXISTS public."idx_attendance_tanggal_student";
CREATE INDEX idx_attendance_tanggal_student ON public.attendance USING btree (tanggal, student_id);
DROP INDEX IF EXISTS public."idx_borrowing_items_borrowing_id";
CREATE INDEX idx_borrowing_items_borrowing_id ON public.borrowing_items USING btree (borrowing_id);
DROP INDEX IF EXISTS public."idx_borrowing_items_equipment_id";
CREATE INDEX idx_borrowing_items_equipment_id ON public.borrowing_items USING btree (equipment_id);
DROP INDEX IF EXISTS public."idx_borrowing_items_equipment_status";
CREATE INDEX idx_borrowing_items_equipment_status ON public.borrowing_items USING btree (equipment_id, status);
DROP INDEX IF EXISTS public."idx_borrowing_return_evidence_assessment_item";
CREATE INDEX idx_borrowing_return_evidence_assessment_item ON public.borrowing_return_evidence USING btree (assessment_item_id) WHERE (assessment_item_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_borrowing_return_evidence_item_status";
CREATE INDEX idx_borrowing_return_evidence_item_status ON public.borrowing_return_evidence USING btree (borrowing_id, equipment_id, upload_status, created_at DESC);
DROP INDEX IF EXISTS public."idx_borrowing_return_evidence_pending_cleanup";
CREATE INDEX idx_borrowing_return_evidence_pending_cleanup ON public.borrowing_return_evidence USING btree (created_at, id) WHERE (upload_status = 'pending'::text);
DROP INDEX IF EXISTS public."idx_borrowing_return_evidence_report";
CREATE INDEX idx_borrowing_return_evidence_report ON public.borrowing_return_evidence USING btree (return_report_id, upload_status, equipment_id, created_at);
DROP INDEX IF EXISTS public."idx_borrowing_return_reports_status";
CREATE INDEX idx_borrowing_return_reports_status ON public.borrowing_return_reports USING btree (status, reported_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_borrowings_borrowed_due_at";
CREATE INDEX idx_borrowings_borrowed_due_at ON public.borrowings USING btree (due_at) WHERE (status = 'borrowed'::text);
DROP INDEX IF EXISTS public."idx_borrowings_borrowed_planned_return";
CREATE INDEX idx_borrowings_borrowed_planned_return ON public.borrowings USING btree (rencana_kembali) WHERE ((status = 'borrowed'::text) AND (due_at IS NULL));
DROP INDEX IF EXISTS public."idx_borrowings_created_at_id";
CREATE INDEX idx_borrowings_created_at_id ON public.borrowings USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_borrowings_status_created_at_id";
CREATE INDEX idx_borrowings_status_created_at_id ON public.borrowings USING btree (status, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_borrowings_status_returned_at";
CREATE INDEX idx_borrowings_status_returned_at ON public.borrowings USING btree (status, returned_at DESC) WHERE (returned_at IS NOT NULL);
DROP INDEX IF EXISTS public."idx_borrowings_student_created_at_id";
CREATE INDEX idx_borrowings_student_created_at_id ON public.borrowings USING btree (student_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_disputes_debt_history";
CREATE INDEX idx_cash_disputes_debt_history ON public.cash_disputes USING btree (debt_record_id, created_at DESC, id DESC) WHERE (debt_record_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_cash_disputes_debt_record";
CREATE INDEX idx_cash_disputes_debt_record ON public.cash_disputes USING btree (debt_record_id);
DROP INDEX IF EXISTS public."idx_cash_disputes_review_queue";
CREATE INDEX idx_cash_disputes_review_queue ON public.cash_disputes USING btree (status, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_disputes_status_created";
CREATE INDEX idx_cash_disputes_status_created ON public.cash_disputes USING btree (status, created_at DESC);
DROP INDEX IF EXISTS public."idx_cash_disputes_student_created";
CREATE INDEX idx_cash_disputes_student_created ON public.cash_disputes USING btree (student_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_cash_disputes_student_history";
CREATE INDEX idx_cash_disputes_student_history ON public.cash_disputes USING btree (student_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_disputes_student_pending";
CREATE INDEX idx_cash_disputes_student_pending ON public.cash_disputes USING btree (student_id, created_at DESC, id DESC) WHERE (status = 'pending'::text);
DROP INDEX IF EXISTS public."idx_cash_disputes_student_quota_period";
CREATE INDEX idx_cash_disputes_student_quota_period ON public.cash_disputes USING btree (student_id, quota_period_start);
DROP INDEX IF EXISTS public."idx_cash_disputes_transaction_history";
CREATE INDEX idx_cash_disputes_transaction_history ON public.cash_disputes USING btree (transaction_id, created_at DESC, id DESC) WHERE (transaction_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_cash_payment_methods_active_order";
CREATE INDEX idx_cash_payment_methods_active_order ON public.cash_payment_methods USING btree (is_active, sort_order, label);
DROP INDEX IF EXISTS public."idx_cash_transactions_created_at";
CREATE INDEX idx_cash_transactions_created_at ON public.cash_transactions USING btree (created_at DESC);
DROP INDEX IF EXISTS public."idx_cash_transactions_created_at_id";
CREATE INDEX idx_cash_transactions_created_at_id ON public.cash_transactions USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_transactions_created_at_type";
CREATE INDEX idx_cash_transactions_created_at_type ON public.cash_transactions USING btree (created_at DESC, type) WHERE (COALESCE(is_billing, false) = false);
DROP INDEX IF EXISTS public."idx_cash_transactions_payment_method_tanggal";
CREATE INDEX idx_cash_transactions_payment_method_tanggal ON public.cash_transactions USING btree (payment_method_id, tanggal DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_transactions_real_created_at";
CREATE INDEX idx_cash_transactions_real_created_at ON public.cash_transactions USING btree (created_at DESC, id DESC) WHERE (COALESCE(is_billing, false) = false);
DROP INDEX IF EXISTS public."idx_cash_transactions_student";
CREATE INDEX idx_cash_transactions_student ON public.cash_transactions USING btree (student_id);
DROP INDEX IF EXISTS public."idx_cash_transactions_student_created_at";
CREATE INDEX idx_cash_transactions_student_created_at ON public.cash_transactions USING btree (student_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_cash_transactions_tanggal_id";
CREATE INDEX idx_cash_transactions_tanggal_id ON public.cash_transactions USING btree (tanggal DESC, id DESC);
DROP INDEX IF EXISTS public."idx_cash_transactions_type";
CREATE INDEX idx_cash_transactions_type ON public.cash_transactions USING btree (type);
DROP INDEX IF EXISTS public."idx_classes_is_active";
CREATE INDEX idx_classes_is_active ON public.classes USING btree (is_active);
DROP INDEX IF EXISTS public."idx_classes_nama_kelas_trgm";
CREATE INDEX idx_classes_nama_kelas_trgm ON public.classes USING gin (nama_kelas gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_classes_name_id";
CREATE INDEX idx_classes_name_id ON public.classes USING btree (nama_kelas, id);
DROP INDEX IF EXISTS public."idx_classes_status_level_name_id";
CREATE INDEX idx_classes_status_level_name_id ON public.classes USING btree (is_active, tingkat, nama_kelas, id);
DROP INDEX IF EXISTS public."idx_classes_tingkat";
CREATE INDEX idx_classes_tingkat ON public.classes USING btree (tingkat);
DROP INDEX IF EXISTS public."idx_contest_entries_completed_recap";
CREATE INDEX idx_contest_entries_completed_recap ON public.contest_entries USING btree (completed_at DESC, id DESC) WHERE (pipeline_status = 'selesai'::text);
DROP INDEX IF EXISTS public."idx_contest_entries_contest_status_updated";
CREATE INDEX idx_contest_entries_contest_status_updated ON public.contest_entries USING btree (contest_id, pipeline_status, updated_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entries_outcome_updated";
CREATE INDEX idx_contest_entries_outcome_updated ON public.contest_entries USING btree (outcome_status, updated_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entries_work_id";
CREATE INDEX idx_contest_entries_work_id ON public.contest_entries USING btree (work_id);
DROP INDEX IF EXISTS public."idx_contest_entry_evidence_entry_created";
CREATE INDEX idx_contest_entry_evidence_entry_created ON public.contest_entry_evidence USING btree (entry_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_evidence_entry_target";
CREATE INDEX idx_contest_entry_evidence_entry_target ON public.contest_entry_evidence USING btree (entry_id, target_status, upload_status, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_evidence_pending_cleanup";
CREATE INDEX idx_contest_entry_evidence_pending_cleanup ON public.contest_entry_evidence USING btree (created_at, id) WHERE (upload_status = 'pending'::text);
DROP INDEX IF EXISTS public."idx_contest_entry_history_entry_created";
CREATE INDEX idx_contest_entry_history_entry_created ON public.contest_entry_status_history USING btree (entry_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_members_student";
CREATE INDEX idx_contest_entry_members_student ON public.contest_entry_members USING btree (student_id, entry_id);
DROP INDEX IF EXISTS public."idx_contest_entry_pipeline_operations_entry_created";
CREATE INDEX idx_contest_entry_pipeline_operations_entry_created ON public.contest_entry_pipeline_operations USING btree (entry_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_result_history_entry_created";
CREATE INDEX idx_contest_entry_result_history_entry_created ON public.contest_entry_result_history USING btree (entry_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_results_active_entry_filter";
CREATE INDEX idx_contest_entry_results_active_entry_filter ON public.contest_entry_results USING btree (entry_id, result_kind, "position", created_at DESC, id DESC) WHERE (is_active = true);
DROP INDEX IF EXISTS public."idx_contest_entry_results_category";
CREATE INDEX idx_contest_entry_results_category ON public.contest_entry_results USING btree (lower(category_name), entry_id) WHERE ((is_active = true) AND (category_name IS NOT NULL));
DROP INDEX IF EXISTS public."idx_contest_entry_results_entry_active_created";
CREATE INDEX idx_contest_entry_results_entry_active_created ON public.contest_entry_results USING btree (entry_id, is_active, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_entry_results_kind_position";
CREATE INDEX idx_contest_entry_results_kind_position ON public.contest_entry_results USING btree (result_kind, "position", entry_id) WHERE (is_active = true);
DROP INDEX IF EXISTS public."idx_contest_entry_results_title_trgm";
CREATE INDEX idx_contest_entry_results_title_trgm ON public.contest_entry_results USING gin (lower(result_title) gin_trgm_ops) WHERE (is_active = true);
DROP INDEX IF EXISTS public."idx_contest_films_contest_id";
CREATE INDEX idx_contest_films_contest_id ON public.contest_films USING btree (contest_id);
DROP INDEX IF EXISTS public."idx_contest_films_film_id";
CREATE INDEX idx_contest_films_film_id ON public.contest_films USING btree (film_id);
DROP INDEX IF EXISTS public."idx_contest_submissions_contest_created_id";
CREATE INDEX idx_contest_submissions_contest_created_id ON public.contest_submissions USING btree (contest_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contest_submissions_director_id";
CREATE INDEX idx_contest_submissions_director_id ON public.contest_submissions USING btree (sutradara_id) WHERE (sutradara_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_contest_submissions_film_id";
CREATE INDEX idx_contest_submissions_film_id ON public.contest_submissions USING btree (film_id) WHERE (film_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_contest_task_assignees_student";
CREATE INDEX idx_contest_task_assignees_student ON public.contest_task_assignees USING btree (student_id, task_id);
DROP INDEX IF EXISTS public."idx_contest_tasks_entry_status_due";
CREATE INDEX idx_contest_tasks_entry_status_due ON public.contest_tasks USING btree (entry_id, status, due_date, id);
DROP INDEX IF EXISTS public."idx_contests_city_trgm";
CREATE INDEX idx_contests_city_trgm ON public.contests USING gin (kota gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_contests_event_year_deadline_id";
CREATE INDEX idx_contests_event_year_deadline_id ON public.contests USING btree (tahun_event, deadline DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contests_level_tanggal_id";
CREATE INDEX idx_contests_level_tanggal_id ON public.contests USING btree (level, tanggal DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contests_nama_lomba_trgm";
CREATE INDEX idx_contests_nama_lomba_trgm ON public.contests USING gin (nama_lomba gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_contests_nama_trgm";
CREATE INDEX idx_contests_nama_trgm ON public.contests USING gin (nama gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_contests_public_level_deadline_id";
CREATE INDEX idx_contests_public_level_deadline_id ON public.contests USING btree (tingkat, deadline DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contests_public_status_deadline_id";
CREATE INDEX idx_contests_public_status_deadline_id ON public.contests USING btree (status_public, deadline DESC, id DESC);
DROP INDEX IF EXISTS public."idx_contests_status_tanggal_id";
CREATE INDEX idx_contests_status_tanggal_id ON public.contests USING btree (status, tanggal DESC, id DESC);
DROP INDEX IF EXISTS public."idx_debt_records_created_at_unpaid";
CREATE INDEX idx_debt_records_created_at_unpaid ON public.debt_records USING btree (created_at DESC, student_id) WHERE (status = 'unpaid'::text);
DROP INDEX IF EXISTS public."idx_debt_records_student_periode_created_at";
CREATE INDEX idx_debt_records_student_periode_created_at ON public.debt_records USING btree (student_id, periode, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_debt_records_student_status_created_at";
CREATE INDEX idx_debt_records_student_status_created_at ON public.debt_records USING btree (student_id, status, created_at DESC);
DROP INDEX IF EXISTS public."idx_debt_records_unpaid_created_student";
CREATE INDEX idx_debt_records_unpaid_created_student ON public.debt_records USING btree (created_at DESC, student_id) WHERE (status = 'unpaid'::text);
DROP INDEX IF EXISTS public."idx_debt_student_status";
CREATE INDEX idx_debt_student_status ON public.debt_records USING btree (student_id, status);
DROP INDEX IF EXISTS public."idx_equipment_charge_borrowing";
CREATE INDEX idx_equipment_charge_borrowing ON public.equipment_charge_settlements USING btree (borrowing_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_equipment_charge_payments_settlement";
CREATE INDEX idx_equipment_charge_payments_settlement ON public.equipment_charge_payments USING btree (settlement_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_equipment_charge_student_status";
CREATE INDEX idx_equipment_charge_student_status ON public.equipment_charge_settlements USING btree (student_id, status, created_at DESC);
DROP INDEX IF EXISTS public."idx_equipment_created_at_id";
CREATE INDEX idx_equipment_created_at_id ON public.equipment USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_equipment_evidence_settlement_status";
CREATE INDEX idx_equipment_evidence_settlement_status ON public.equipment_evidence USING btree (settlement_id, upload_status, created_at DESC);
DROP INDEX IF EXISTS public."idx_equipment_kategori_created_at_id";
CREATE INDEX idx_equipment_kategori_created_at_id ON public.equipment USING btree (kategori, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_equipment_kode_alat_trgm";
CREATE INDEX idx_equipment_kode_alat_trgm ON public.equipment USING gin (kode_alat gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_equipment_kondisi_created_at_id";
CREATE INDEX idx_equipment_kondisi_created_at_id ON public.equipment USING btree (kondisi, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_equipment_nama_alat_trgm";
CREATE INDEX idx_equipment_nama_alat_trgm ON public.equipment USING gin (nama_alat gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_equipment_nama_trgm";
CREATE INDEX idx_equipment_nama_trgm ON public.equipment USING gin (nama_alat gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_equipment_recovery_equipment_status";
CREATE INDEX idx_equipment_recovery_equipment_status ON public.equipment_recovery_cases USING btree (equipment_id, status, created_at DESC);
DROP INDEX IF EXISTS public."idx_equipment_status_created_at_id";
CREATE INDEX idx_equipment_status_created_at_id ON public.equipment USING btree (status, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_equipment_valuations_lookup";
CREATE INDEX idx_equipment_valuations_lookup ON public.equipment_valuations USING btree (equipment_id, effective_at DESC, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_film_crew_film_id";
CREATE INDEX idx_film_crew_film_id ON public.film_crew USING btree (film_id);
DROP INDEX IF EXISTS public."idx_film_works_status_year_id";
CREATE INDEX idx_film_works_status_year_id ON public.film_works USING btree (status, tahun_produksi DESC, id DESC);
DROP INDEX IF EXISTS public."idx_grade_report_periods_status_dates";
CREATE INDEX idx_grade_report_periods_status_dates ON public.grade_report_periods USING btree (status, start_date DESC, end_date DESC);
DROP INDEX IF EXISTS public."idx_grade_reports_period_status";
CREATE INDEX idx_grade_reports_period_status ON public.grade_reports USING btree (period_id, status, student_id);
DROP INDEX IF EXISTS public."idx_grades_student_updated_id";
CREATE INDEX idx_grades_student_updated_id ON public.grades USING btree (student_id, updated_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_media_works_title_trgm";
CREATE INDEX idx_media_works_title_trgm ON public.media_works USING gin (lower(title) gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_media_works_type_title";
CREATE INDEX idx_media_works_type_title ON public.media_works USING btree (work_type_code, lower(title));
DROP INDEX IF EXISTS public."idx_notifications_user_created_id";
CREATE INDEX idx_notifications_user_created_id ON public.notifications USING btree (user_id, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_notifications_user_unread_created_id";
CREATE INDEX idx_notifications_user_unread_created_id ON public.notifications USING btree (user_id, created_at DESC, id DESC) WHERE (is_read = false);
DROP INDEX IF EXISTS public."idx_offline_queue_user_status";
CREATE INDEX idx_offline_queue_user_status ON public.offline_sync_queue USING btree (user_id, status);
DROP INDEX IF EXISTS public."idx_password_reset_operations_target_created";
CREATE INDEX idx_password_reset_operations_target_created ON public.password_reset_operations USING btree (target_user_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_return_assessment_items_assessment";
CREATE INDEX idx_return_assessment_items_assessment ON public.borrowing_return_assessment_items USING btree (assessment_id);
DROP INDEX IF EXISTS public."idx_return_assessment_items_borrowing_item";
CREATE INDEX idx_return_assessment_items_borrowing_item ON public.borrowing_return_assessment_items USING btree (borrowing_item_id);
DROP INDEX IF EXISTS public."idx_return_assessments_borrowing";
CREATE INDEX idx_return_assessments_borrowing ON public.borrowing_return_assessments USING btree (borrowing_id, created_at DESC);
DROP INDEX IF EXISTS public."idx_social_evidence_insight_period";
CREATE INDEX idx_social_evidence_insight_period ON public.social_media_evidence USING btree (insight_period_id, created_at, id) WHERE (upload_status = 'attached'::text);
DROP INDEX IF EXISTS public."idx_social_evidence_pending_expiry";
CREATE INDEX idx_social_evidence_pending_expiry ON public.social_media_evidence USING btree (expires_at, id) WHERE (upload_status = 'pending'::text);
DROP INDEX IF EXISTS public."idx_social_evidence_publication";
CREATE INDEX idx_social_evidence_publication ON public.social_media_evidence USING btree (publication_id, created_at, id) WHERE (upload_status = 'attached'::text);
DROP INDEX IF EXISTS public."idx_social_insight_account_period";
CREATE INDEX idx_social_insight_account_period ON public.social_insight_periods USING btree (social_account_id, period_start DESC, period_end DESC);
DROP INDEX IF EXISTS public."idx_social_insight_archive_month";
CREATE INDEX idx_social_insight_archive_month ON public.social_insight_periods USING btree (archive_month DESC, social_account_id) WHERE ((archive_month IS NOT NULL) AND (status <> 'archived'::text));
DROP INDEX IF EXISTS public."idx_social_publications_agenda";
CREATE INDEX idx_social_publications_agenda ON public.social_publications USING btree (agenda_activity_id) WHERE (agenda_activity_id IS NOT NULL);
DROP INDEX IF EXISTS public."idx_social_publications_date_id";
CREATE INDEX idx_social_publications_date_id ON public.social_publications USING btree (published_at DESC, id DESC) WHERE (status <> 'archived'::text);
DROP INDEX IF EXISTS public."idx_social_publications_platform_date";
CREATE INDEX idx_social_publications_platform_date ON public.social_publications USING btree (platform, published_at DESC, id DESC) WHERE (status <> 'archived'::text);
DROP INDEX IF EXISTS public."idx_social_snapshots_account_date";
CREATE INDEX idx_social_snapshots_account_date ON public.social_account_snapshots USING btree (social_account_id, as_of_date DESC, id DESC);
DROP INDEX IF EXISTS public."idx_student_account_operations_created_at";
CREATE INDEX idx_student_account_operations_created_at ON public.student_account_operations USING btree (created_at);
DROP INDEX IF EXISTS public."idx_student_pkl_periods_status_dates";
CREATE INDEX idx_student_pkl_periods_status_dates ON public.student_pkl_periods USING btree (status, start_date, end_date);
DROP INDEX IF EXISTS public."idx_student_pkl_periods_student_dates";
CREATE INDEX idx_student_pkl_periods_student_dates ON public.student_pkl_periods USING btree (student_id, start_date, end_date);
DROP INDEX IF EXISTS public."idx_students_active_class_created_at_id";
CREATE INDEX idx_students_active_class_created_at_id ON public.students USING btree (is_active, kelas, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_students_active_created_at";
CREATE INDEX idx_students_active_created_at ON public.students USING btree (is_active, created_at DESC);
DROP INDEX IF EXISTS public."idx_students_active_created_at_id";
CREATE INDEX idx_students_active_created_at_id ON public.students USING btree (is_active, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_students_active_kelas_nama_id";
CREATE INDEX idx_students_active_kelas_nama_id ON public.students USING btree (is_active, kelas, nama, id);
DROP INDEX IF EXISTS public."idx_students_active_name_id";
CREATE INDEX idx_students_active_name_id ON public.students USING btree (is_active, nama, id);
DROP INDEX IF EXISTS public."idx_students_active_peminatan_created_at_id";
CREATE INDEX idx_students_active_peminatan_created_at_id ON public.students USING btree (is_active, peminatan, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_students_class_id";
CREATE INDEX idx_students_class_id ON public.students USING btree (class_id);
DROP INDEX IF EXISTS public."idx_students_created_at_id";
CREATE INDEX idx_students_created_at_id ON public.students USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_students_kelas_trgm";
CREATE INDEX idx_students_kelas_trgm ON public.students USING gin (kelas gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_unique_contest_name";
CREATE UNIQUE INDEX idx_unique_contest_name ON public.contests USING btree (lower(nama_festival));
DROP INDEX IF EXISTS public."idx_users_active_created_at_id";
CREATE INDEX idx_users_active_created_at_id ON public.users USING btree (is_active, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_users_active_role_created_at";
CREATE INDEX idx_users_active_role_created_at ON public.users USING btree (is_active, role, created_at DESC);
DROP INDEX IF EXISTS public."idx_users_created_at_id";
CREATE INDEX idx_users_created_at_id ON public.users USING btree (created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_users_nama_trgm";
CREATE INDEX idx_users_nama_trgm ON public.users USING gin (nama gin_trgm_ops);
DROP INDEX IF EXISTS public."idx_users_role_created_at_id";
CREATE INDEX idx_users_role_created_at_id ON public.users USING btree (role, created_at DESC, id DESC);
DROP INDEX IF EXISTS public."idx_users_username_trgm";
CREATE INDEX idx_users_username_trgm ON public.users USING gin (username gin_trgm_ops);
DROP INDEX IF EXISTS public."uq_active_borrowing_item_equipment";
CREATE UNIQUE INDEX uq_active_borrowing_item_equipment ON public.borrowing_items USING btree (equipment_id) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text, 'borrowed'::text]));
DROP INDEX IF EXISTS public."uq_agenda_photo_attached";
CREATE UNIQUE INDEX uq_agenda_photo_attached ON public.agenda_activity_photos USING btree (activity_id) WHERE (upload_status = 'attached'::text);
DROP INDEX IF EXISTS public."uq_agenda_photo_pending";
CREATE UNIQUE INDEX uq_agenda_photo_pending ON public.agenda_activity_photos USING btree (activity_id) WHERE (upload_status = 'pending'::text);
DROP INDEX IF EXISTS public."uq_borrowing_return_evidence_object_key";
CREATE UNIQUE INDEX uq_borrowing_return_evidence_object_key ON public.borrowing_return_evidence USING btree (object_key);
DROP INDEX IF EXISTS public."uq_borrowing_return_reports_active";
CREATE UNIQUE INDEX uq_borrowing_return_reports_active ON public.borrowing_return_reports USING btree (borrowing_id) WHERE (status = ANY (ARRAY['draft'::text, 'pending_verification'::text]));
DROP INDEX IF EXISTS public."uq_borrowing_return_reports_idempotency";
CREATE UNIQUE INDEX uq_borrowing_return_reports_idempotency ON public.borrowing_return_reports USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
DROP INDEX IF EXISTS public."uq_borrowings_idempotency_key";
CREATE UNIQUE INDEX uq_borrowings_idempotency_key ON public.borrowings USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
DROP INDEX IF EXISTS public."uq_cash_disputes_active_debt";
CREATE UNIQUE INDEX uq_cash_disputes_active_debt ON public.cash_disputes USING btree (debt_record_id) WHERE ((debt_record_id IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'approved'::text])));
DROP INDEX IF EXISTS public."uq_cash_disputes_active_transaction";
CREATE UNIQUE INDEX uq_cash_disputes_active_transaction ON public.cash_disputes USING btree (transaction_id) WHERE ((transaction_id IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'approved'::text])));
DROP INDEX IF EXISTS public."uq_cash_disputes_debt_attempt";
CREATE UNIQUE INDEX uq_cash_disputes_debt_attempt ON public.cash_disputes USING btree (debt_record_id, attempt_number) WHERE (debt_record_id IS NOT NULL);
DROP INDEX IF EXISTS public."uq_cash_disputes_student_idempotency";
CREATE UNIQUE INDEX uq_cash_disputes_student_idempotency ON public.cash_disputes USING btree (student_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
DROP INDEX IF EXISTS public."uq_cash_disputes_transaction_attempt";
CREATE UNIQUE INDEX uq_cash_disputes_transaction_attempt ON public.cash_disputes USING btree (transaction_id, attempt_number) WHERE (transaction_id IS NOT NULL);
DROP INDEX IF EXISTS public."uq_contest_entry_evidence_object_key";
CREATE UNIQUE INDEX uq_contest_entry_evidence_object_key ON public.contest_entry_evidence USING btree (object_key) WHERE (object_key IS NOT NULL);
DROP INDEX IF EXISTS public."uq_contest_entry_result_active_value";
CREATE UNIQUE INDEX uq_contest_entry_result_active_value ON public.contest_entry_results USING btree (entry_id, result_kind, COALESCE("position", 0), lower(btrim(result_title)), lower(COALESCE(btrim(category_name), ''::text))) WHERE (is_active = true);
DROP INDEX IF EXISTS public."uq_contest_name_event_year";
CREATE UNIQUE INDEX uq_contest_name_event_year ON public.contests USING btree (lower(btrim(nama_lomba)), tahun_event) WHERE (tahun_event IS NOT NULL);
DROP INDEX IF EXISTS public."uq_debt_records_idempotency_key";
CREATE UNIQUE INDEX uq_debt_records_idempotency_key ON public.debt_records USING btree (idempotency_key);
DROP INDEX IF EXISTS public."uq_equipment_recovery_open_case";
CREATE UNIQUE INDEX uq_equipment_recovery_open_case ON public.equipment_recovery_cases USING btree (equipment_id) WHERE (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'awaiting_verification'::text]));
DROP INDEX IF EXISTS public."uq_final_return_assessment_item_once";
CREATE UNIQUE INDEX uq_final_return_assessment_item_once ON public.borrowing_return_assessment_items USING btree (borrowing_item_id);
DROP INDEX IF EXISTS public."uq_media_works_legacy_submission";
CREATE UNIQUE INDEX uq_media_works_legacy_submission ON public.media_works USING btree (legacy_submission_id) WHERE (legacy_submission_id IS NOT NULL);
DROP INDEX IF EXISTS public."uq_notifications_borrowing_event";
CREATE UNIQUE INDEX uq_notifications_borrowing_event ON public.notifications USING btree (((metadata ->> 'event_key'::text))) WHERE ((metadata ? 'event_key'::text) AND (NULLIF((metadata ->> 'event_key'::text), ''::text) IS NOT NULL));
DROP INDEX IF EXISTS public."uq_social_accounts_created_idempotency";
CREATE UNIQUE INDEX uq_social_accounts_created_idempotency ON public.social_accounts USING btree (created_by, idempotency_key) WHERE (idempotency_key IS NOT NULL);
DROP INDEX IF EXISTS public."uq_social_evidence_insight_active";
CREATE UNIQUE INDEX uq_social_evidence_insight_active ON public.social_media_evidence USING btree (insight_period_id) WHERE ((insight_period_id IS NOT NULL) AND (upload_status = ANY (ARRAY['pending'::text, 'attached'::text])));
DROP INDEX IF EXISTS public."uq_social_evidence_publication_active";
CREATE UNIQUE INDEX uq_social_evidence_publication_active ON public.social_media_evidence USING btree (publication_id) WHERE ((publication_id IS NOT NULL) AND (upload_status = ANY (ARRAY['pending'::text, 'attached'::text])));
DROP INDEX IF EXISTS public."uq_social_insight_archive_account_month";
CREATE UNIQUE INDEX uq_social_insight_archive_account_month ON public.social_insight_periods USING btree (social_account_id, archive_month) WHERE (archive_month IS NOT NULL);
DROP INDEX IF EXISTS public."uq_students_user_id";
CREATE UNIQUE INDEX uq_students_user_id ON public.students USING btree (user_id) WHERE (user_id IS NOT NULL);
DROP INDEX IF EXISTS public."uq_users_username_normalized";
CREATE UNIQUE INDEX uq_users_username_normalized ON public.users USING btree (lower(btrim(username)));
CREATE OR REPLACE VIEW public."v_contest_win_rate" WITH (security_invoker=true) AS  SELECT (EXTRACT(year FROM tanggal))::integer AS tahun,
    level,
    count(*) AS total_lomba,
    count(*) FILTER (WHERE ((status)::text = 'selesai'::text)) AS total_selesai,
    count(*) FILTER (WHERE ((juara IS NOT NULL) AND ((status)::text = 'selesai'::text))) AS total_menang,
    round((((count(*) FILTER (WHERE ((juara IS NOT NULL) AND ((status)::text = 'selesai'::text))))::numeric / (NULLIF(count(*) FILTER (WHERE ((status)::text = 'selesai'::text)), 0))::numeric) * (100)::numeric), 1) AS win_rate_persen
   FROM contests c
  GROUP BY (EXTRACT(year FROM tanggal)), level
  ORDER BY ((EXTRACT(year FROM tanggal))::integer) DESC, level;
CREATE OR REPLACE VIEW public."v_student_dashboard_summary" WITH (security_invoker=true) AS  SELECT s.id AS student_id,
    s.nis,
    s.nama,
    s.class_id,
    COALESCE(c.nama_kelas, s.kelas) AS kelas,
    s.peminatan,
    s.foto_url,
    s.is_active,
    COALESCE(att.persentase_kehadiran, 100.0) AS persentase_kehadiran,
    COALESCE(debt.total_tunggakan, (0)::bigint) AS total_tunggakan,
    COALESCE(grd.rata_nilai, 'A'::grade_value) AS predikat_rata_nilai,
    COALESCE(bor.active_borrowings_count, (0)::bigint) AS active_borrowings_count
   FROM (((((students s
     LEFT JOIN classes c ON ((c.id = s.class_id)))
     LEFT JOIN ( SELECT attendance.student_id,
            round((((count(
                CASE
                    WHEN (attendance.status = 'hadir'::text) THEN 1
                    ELSE NULL::integer
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 1) AS persentase_kehadiran
           FROM attendance
          GROUP BY attendance.student_id) att ON ((att.student_id = s.id)))
     LEFT JOIN ( SELECT debt_records.student_id,
            sum(debt_records.amount) AS total_tunggakan
           FROM debt_records
          WHERE (debt_records.status = 'unpaid'::text)
          GROUP BY debt_records.student_id) debt ON ((debt.student_id = s.id)))
     LEFT JOIN ( SELECT grades.student_id,
            mode() WITHIN GROUP (ORDER BY grades.nilai) AS rata_nilai
           FROM grades
          WHERE (grades.status = 'graded'::text)
          GROUP BY grades.student_id) grd ON ((grd.student_id = s.id)))
     LEFT JOIN ( SELECT borrowings.student_id,
            count(*) AS active_borrowings_count
           FROM borrowings
          WHERE (borrowings.status = ANY (ARRAY['borrowed'::text, 'pending'::text]))
          GROUP BY borrowings.student_id) bor ON ((bor.student_id = s.id)));
DROP TRIGGER IF EXISTS "trg_access_control_audit_actor_snapshot" ON public."access_control_audit_logs";
CREATE TRIGGER trg_access_control_audit_actor_snapshot BEFORE INSERT ON public.access_control_audit_logs FOR EACH ROW EXECUTE FUNCTION snapshot_access_control_audit_actor();
DROP TRIGGER IF EXISTS "trg_enrich_activity_log" ON public."activity_logs";
CREATE TRIGGER trg_enrich_activity_log BEFORE INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION enrich_activity_log();
DROP TRIGGER IF EXISTS "trg_protect_audit_logs" ON public."activity_logs";
CREATE TRIGGER trg_protect_audit_logs BEFORE DELETE OR UPDATE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION protect_activity_logs();
DROP TRIGGER IF EXISTS "trg_guard_agenda_activity_date" ON public."agenda_activities";
CREATE TRIGGER trg_guard_agenda_activity_date BEFORE INSERT OR UPDATE OF activity_date, pic_names ON public.agenda_activities FOR EACH ROW EXECUTE FUNCTION guard_agenda_activity_date();
DROP TRIGGER IF EXISTS "trg_audit_attendance" ON public."attendance";
CREATE TRIGGER trg_audit_attendance AFTER UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_audit_billing" ON public."billing_rules";
CREATE TRIGGER trg_audit_billing AFTER UPDATE ON public.billing_rules FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_create_equipment_charge_settlement" ON public."borrowing_return_assessment_items";
CREATE TRIGGER trg_create_equipment_charge_settlement AFTER INSERT ON public.borrowing_return_assessment_items FOR EACH ROW EXECUTE FUNCTION create_equipment_charge_settlement_trigger();
DROP TRIGGER IF EXISTS "trg_open_return_recovery_case" ON public."borrowing_return_assessment_items";
CREATE TRIGGER trg_open_return_recovery_case AFTER INSERT ON public.borrowing_return_assessment_items FOR EACH ROW EXECUTE FUNCTION open_return_recovery_case();
DROP TRIGGER IF EXISTS "trg_guard_return_report_approval" ON public."borrowing_return_reports";
CREATE TRIGGER trg_guard_return_report_approval BEFORE UPDATE OF status ON public.borrowing_return_reports FOR EACH ROW EXECUTE FUNCTION guard_return_report_approval();
DROP TRIGGER IF EXISTS "trg_audit_borrowings" ON public."borrowings";
CREATE TRIGGER trg_audit_borrowings AFTER UPDATE ON public.borrowings FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_block_borrowing_approval_with_unpaid_charge" ON public."borrowings";
CREATE TRIGGER trg_block_borrowing_approval_with_unpaid_charge BEFORE UPDATE OF status ON public.borrowings FOR EACH ROW EXECUTE FUNCTION block_borrowing_approval_with_unpaid_charge();
DROP TRIGGER IF EXISTS "trg_borrowing_status_notification" ON public."borrowings";
CREATE TRIGGER trg_borrowing_status_notification AFTER INSERT OR UPDATE OF status ON public.borrowings FOR EACH ROW EXECUTE FUNCTION notify_borrowing_status_change();
DROP TRIGGER IF EXISTS "trg_guard_borrowing_return_completion" ON public."borrowings";
CREATE TRIGGER trg_guard_borrowing_return_completion BEFORE UPDATE OF status ON public.borrowings FOR EACH ROW EXECUTE FUNCTION guard_borrowing_return_completion();
DROP TRIGGER IF EXISTS "trg_cash_dispute_notify" ON public."cash_disputes";
CREATE TRIGGER trg_cash_dispute_notify AFTER INSERT OR UPDATE OF status ON public.cash_disputes FOR EACH ROW EXECUTE FUNCTION fn_notify_cash_dispute();
DROP TRIGGER IF EXISTS "trg_guard_cash_dispute_actor" ON public."cash_disputes";
CREATE TRIGGER trg_guard_cash_dispute_actor BEFORE INSERT ON public.cash_disputes FOR EACH ROW EXECUTE FUNCTION guard_cash_dispute_actor();
DROP TRIGGER IF EXISTS "trg_guard_cash_dispute_reviewer" ON public."cash_disputes";
CREATE TRIGGER trg_guard_cash_dispute_reviewer BEFORE UPDATE OF status ON public.cash_disputes FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION guard_cash_dispute_reviewer();
DROP TRIGGER IF EXISTS "trg_protect_default_cash_payment_method" ON public."cash_payment_methods";
CREATE TRIGGER trg_protect_default_cash_payment_method BEFORE UPDATE OF is_active ON public.cash_payment_methods FOR EACH ROW EXECUTE FUNCTION protect_default_cash_payment_method();
DROP TRIGGER IF EXISTS "trg_audit_cash" ON public."cash_transactions";
CREATE TRIGGER trg_audit_cash AFTER INSERT OR UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_audit_cash_transactions" ON public."cash_transactions";
CREATE TRIGGER trg_audit_cash_transactions AFTER INSERT ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION audit_cash_row_change();
DROP TRIGGER IF EXISTS "trg_cash_transaction_immutable" ON public."cash_transactions";
CREATE TRIGGER trg_cash_transaction_immutable BEFORE DELETE OR UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION prevent_cash_transaction_mutation();
DROP TRIGGER IF EXISTS "trg_cash_transaction_ledger_guard" ON public."cash_transactions";
CREATE TRIGGER trg_cash_transaction_ledger_guard BEFORE INSERT OR UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION enforce_cash_transaction_ledger();
DROP TRIGGER IF EXISTS "trg_default_cash_payment_method" ON public."cash_transactions";
CREATE TRIGGER trg_default_cash_payment_method BEFORE INSERT ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION default_cash_payment_method();
DROP TRIGGER IF EXISTS "trg_validate_cash_flow" ON public."cash_transactions";
CREATE TRIGGER trg_validate_cash_flow BEFORE INSERT ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION validate_cash_transaction_final();
DROP TRIGGER IF EXISTS "trg_audit_contests" ON public."contests";
CREATE TRIGGER trg_audit_contests AFTER DELETE OR UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_sync_contest_frontend_contract" ON public."contests";
CREATE TRIGGER trg_sync_contest_frontend_contract BEFORE INSERT OR UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION sync_contest_frontend_contract();
DROP TRIGGER IF EXISTS "trg_validate_contest_deadline_future" ON public."contests";
CREATE TRIGGER trg_validate_contest_deadline_future BEFORE INSERT OR UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION validate_contest_deadline_future();
DROP TRIGGER IF EXISTS "trg_audit_debt" ON public."debt_records";
CREATE TRIGGER trg_audit_debt AFTER UPDATE ON public.debt_records FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_audit_debt_records" ON public."debt_records";
CREATE TRIGGER trg_audit_debt_records AFTER INSERT OR DELETE OR UPDATE ON public.debt_records FOR EACH ROW EXECUTE FUNCTION audit_cash_row_change();
DROP TRIGGER IF EXISTS "trg_enrich_debt_record_state" ON public."debt_records";
CREATE TRIGGER trg_enrich_debt_record_state BEFORE INSERT OR UPDATE ON public.debt_records FOR EACH ROW EXECUTE FUNCTION enrich_debt_record_state();
DROP TRIGGER IF EXISTS "trg_audit_equipment" ON public."equipment";
CREATE TRIGGER trg_audit_equipment AFTER DELETE OR UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_enforce_equipment_state_consistency" ON public."equipment";
CREATE TRIGGER trg_enforce_equipment_state_consistency BEFORE INSERT OR UPDATE OF kondisi, status ON public.equipment FOR EACH ROW EXECUTE FUNCTION enforce_equipment_state_consistency();
DROP TRIGGER IF EXISTS "trg_finish_borrowing_after_recovery" ON public."equipment_recovery_cases";
CREATE TRIGGER trg_finish_borrowing_after_recovery AFTER UPDATE OF status ON public.equipment_recovery_cases FOR EACH ROW EXECUTE FUNCTION finish_borrowing_after_recovery();
DROP TRIGGER IF EXISTS "trg_audit_grades" ON public."grades";
CREATE TRIGGER trg_audit_grades AFTER UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_guard_social_insight_recorded" ON public."social_insight_periods";
CREATE TRIGGER trg_guard_social_insight_recorded BEFORE INSERT OR UPDATE OF social_account_id, archive_month, period_start, period_end, status, views, reach, interactions, profile_visits, published_count, likes, comments, shares, saves, watch_time_minutes, subscribers_gained, subscribers_lost, impressions, followers_gained, followers_lost, reactions, poll_votes ON public.social_insight_periods FOR EACH ROW EXECUTE FUNCTION guard_social_insight_recorded();
DROP TRIGGER IF EXISTS "trg_guard_social_publication_recorded" ON public."social_publications";
CREATE TRIGGER trg_guard_social_publication_recorded BEFORE INSERT OR UPDATE OF social_account_id, platform, content_type, platform_url, status ON public.social_publications FOR EACH ROW EXECUTE FUNCTION guard_social_publication_recorded();
DROP TRIGGER IF EXISTS "trg_audit_users" ON public."users";
CREATE TRIGGER trg_audit_users AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS "trg_enforce_user_role_account_boundary" ON public."users";
CREATE TRIGGER trg_enforce_user_role_account_boundary BEFORE UPDATE OF role ON public.users FOR EACH ROW EXECUTE FUNCTION enforce_user_role_account_boundary();
DROP POLICY IF EXISTS "view_assignments_by_scope" ON public."assignments";
CREATE POLICY "view_assignments_by_scope" ON public."assignments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'teacher'::text) OR (kelas IS NULL) OR (kelas = 'Semua'::text) OR (kelas = ( SELECT s.kelas
   FROM (students s
     JOIN users u ON ((u.id = s.user_id)))
  WHERE ((u.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)) AND (s.is_active = true))
 LIMIT 1)) OR (kelas = split_part(( SELECT s.kelas
   FROM (students s
     JOIN users u ON ((u.id = s.user_id)))
  WHERE ((u.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)) AND (s.is_active = true))
 LIMIT 1), ' '::text, 1))));
DROP POLICY IF EXISTS "Allow public read access for classes" ON public."classes";
CREATE POLICY "Allow public read access for classes" ON public."classes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Allow read access to classes" ON public."classes";
CREATE POLICY "Allow read access to classes" ON public."classes" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
DROP POLICY IF EXISTS "view_own_grades" ON public."grades";
CREATE POLICY "view_own_grades" ON public."grades" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((student_id IN ( SELECT s.id
   FROM (students s
     JOIN users u ON ((u.id = s.user_id)))
  WHERE (u.username = ((current_setting('request.jwt.claims'::text, true))::json ->> 'username'::text)))) OR (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'teacher'::text)));
DROP POLICY IF EXISTS "teacher_read_all_offline_queue" ON public."offline_sync_queue";
CREATE POLICY "teacher_read_all_offline_queue" ON public."offline_sync_queue" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'role'::text) = ANY (ARRAY['teacher'::text, 'leader'::text])));
DROP POLICY IF EXISTS "users_own_offline_queue" ON public."offline_sync_queue";
CREATE POLICY "users_own_offline_queue" ON public."offline_sync_queue" AS PERMISSIVE FOR ALL TO PUBLIC USING ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.username = ((COALESCE(NULLIF(current_setting('request.jwt.claims'::text, true), ''::text), '{}'::text))::json ->> 'username'::text)))));
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."access_control_audit_logs" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."access_permissions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."access_role_permissions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."access_roles" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."activity_logs" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."agenda_activities" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."agenda_activity_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."agenda_activity_photos" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."api_idempotency_responses" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."api_login_rate_limits" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."api_rate_limit_windows" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."assignments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."attendance" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."billing_rules" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_return_assessment_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_return_assessments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_return_evidence" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_return_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowing_return_reports" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."borrowings" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cash_billing_runs" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cash_disputes" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cash_payment_methods" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cash_settings" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."cash_transactions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."classes" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entries" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_evidence" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_members" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_pipeline_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_result_history" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_result_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_results" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_entry_status_history" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_films" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_members" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_submissions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_task_assignees" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contest_tasks" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contests" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."debt_records" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment_charge_payments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment_charge_settlements" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment_evidence" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment_recovery_cases" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."equipment_valuations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."film_crew" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."film_works" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."grade_report_periods" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."grade_reports" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."grades" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."media_works" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."notifications" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."offline_sync_queue" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."password_reset_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."push_subscriptions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_account_snapshots" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_accounts" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_insight_periods" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_media_evidence" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_publications" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."student_account_operations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."student_pkl_periods" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."students" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."users" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."work_types" TO service_role;
GRANT SELECT ON public."v_contest_win_rate" TO service_role;
GRANT SELECT ON public."v_student_dashboard_summary" TO service_role;
GRANT EXECUTE ON FUNCTION public."approve_borrowing_atomic"(p_borrowing_id uuid, p_action text, p_catatan text, p_approved_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."approve_borrowing_atomic"(p_borrowing_id uuid, p_action text, p_catatan text, p_approved_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."archive_agenda_activity_atomic"(p_activity_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."archive_agenda_activity_atomic"(p_activity_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."attach_agenda_photo_atomic"(p_activity_id uuid, p_photo_id uuid, p_actor_id uuid, p_idempotency_key text) TO service_role;
ALTER FUNCTION public."attach_agenda_photo_atomic"(p_activity_id uuid, p_photo_id uuid, p_actor_id uuid, p_idempotency_key text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."audit_cash_row_change"() TO service_role;
ALTER FUNCTION public."audit_cash_row_change"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."audit_changed_fields"(p_old_values jsonb, p_new_values jsonb) TO service_role;
ALTER FUNCTION public."audit_changed_fields"(p_old_values jsonb, p_new_values jsonb) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."block_borrowing_approval_with_unpaid_charge"() TO service_role;
ALTER FUNCTION public."block_borrowing_approval_with_unpaid_charge"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."change_password_atomic"(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_expected_auth_version integer) TO service_role;
ALTER FUNCTION public."change_password_atomic"(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_expected_auth_version integer) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."clear_login_rate_limit"(p_rate_key text) TO service_role;
ALTER FUNCTION public."clear_login_rate_limit"(p_rate_key text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."complete_equipment_repair_atomic"(p_case_id uuid, p_inspection_photos jsonb, p_actual_cost numeric, p_notes text, p_inspection_passed boolean, p_verified_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."complete_equipment_repair_atomic"(p_case_id uuid, p_inspection_photos jsonb, p_actual_cost numeric, p_notes text, p_inspection_passed boolean, p_verified_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."consume_api_rate_limit_atomic"(p_rate_key text, p_window_seconds integer, p_max_requests integer) TO service_role;
ALTER FUNCTION public."consume_api_rate_limit_atomic"(p_rate_key text, p_window_seconds integer, p_max_requests integer) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."contest_legacy_level_from_scope"(p_scope text) TO service_role;
ALTER FUNCTION public."contest_legacy_level_from_scope"(p_scope text) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."contest_scope_from_legacy"(p_value text) TO service_role;
ALTER FUNCTION public."contest_scope_from_legacy"(p_value text) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."correct_attendance_atomic"(p_attendance_id uuid, p_status text, p_keterangan text, p_actor_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."correct_attendance_atomic"(p_attendance_id uuid, p_status text, p_keterangan text, p_actor_id uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_agenda_activity_atomic"(p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."create_agenda_activity_atomic"(p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_borrowing_atomic"(p_student_id uuid, p_equipment_ids uuid[], p_tanggal_pinjam date, p_rencana_kembali date, p_keperluan text, p_created_by uuid, p_idempotency_key text) TO service_role;
ALTER FUNCTION public."create_borrowing_atomic"(p_student_id uuid, p_equipment_ids uuid[], p_tanggal_pinjam date, p_rencana_kembali date, p_keperluan text, p_created_by uuid, p_idempotency_key text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_cash_dispute_atomic"(p_student_id uuid, p_transaction_id uuid, p_debt_record_id uuid, p_reason text, p_evidence_value text, p_actor_id uuid, p_idempotency_key text) TO service_role;
ALTER FUNCTION public."create_cash_dispute_atomic"(p_student_id uuid, p_transaction_id uuid, p_debt_record_id uuid, p_reason text, p_evidence_value text, p_actor_id uuid, p_idempotency_key text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_contest_entry_atomic"(p_contest_id uuid, p_work_id uuid, p_title text, p_work_type_code text, p_description text, p_primary_asset_url text, p_video_url text, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."create_contest_entry_atomic"(p_contest_id uuid, p_work_id uuid, p_title text, p_work_type_code text, p_description text, p_primary_asset_url text, p_video_url text, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_equipment_charge_settlement_trigger"() TO service_role;
ALTER FUNCTION public."create_equipment_charge_settlement_trigger"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_equipment_recovery_case_atomic"(p_equipment_id uuid, p_recovery_type text, p_assessment_item_id uuid, p_reported_condition text, p_notes text, p_opened_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."create_equipment_recovery_case_atomic"(p_equipment_id uuid, p_recovery_type text, p_assessment_item_id uuid, p_reported_condition text, p_notes text, p_opened_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_student_with_account_atomic"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text) TO service_role;
ALTER FUNCTION public."create_student_with_account_atomic"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."create_student_with_account_atomic"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid) TO service_role;
ALTER FUNCTION public."create_student_with_account_atomic"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."create_student_with_account_v2"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."create_student_with_account_v2"(p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_username text, p_password_hash text, p_created_by uuid, p_role text, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."default_cash_payment_method"() TO service_role;
ALTER FUNCTION public."default_cash_payment_method"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."delete_equipment_atomic"(p_equipment_id uuid, p_deleted_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."delete_equipment_atomic"(p_equipment_id uuid, p_deleted_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."enforce_cash_transaction_ledger"() TO service_role;
ALTER FUNCTION public."enforce_cash_transaction_ledger"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."enforce_equipment_state_consistency"() TO service_role;
ALTER FUNCTION public."enforce_equipment_state_consistency"() SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."enforce_user_role_account_boundary"() TO service_role;
ALTER FUNCTION public."enforce_user_role_account_boundary"() SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."enrich_activity_log"() TO service_role;
ALTER FUNCTION public."enrich_activity_log"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."enrich_debt_record_state"() TO service_role;
ALTER FUNCTION public."enrich_debt_record_state"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."finalize_contest_entry_atomic"(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."finalize_contest_entry_atomic"(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."finish_borrowing_after_recovery"() TO service_role;
ALTER FUNCTION public."finish_borrowing_after_recovery"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."fn_notify_cash_dispute"() TO service_role;
ALTER FUNCTION public."fn_notify_cash_dispute"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."generate_weekly_cash_billing"(p_run_date date) TO service_role;
ALTER FUNCTION public."generate_weekly_cash_billing"(p_run_date date) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_attendance_summary_filtered"(p_student_id uuid, p_date_from date, p_date_to date, p_kelas text, p_status text, p_search text) TO service_role;
ALTER FUNCTION public."get_attendance_summary_filtered"(p_student_id uuid, p_date_from date, p_date_to date, p_kelas text, p_status text, p_search text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_attendance_summary"(p_tanggal date) TO service_role;
ALTER FUNCTION public."get_attendance_summary"(p_tanggal date) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_cash_dispute_quota"(p_student_id uuid) TO service_role;
ALTER FUNCTION public."get_cash_dispute_quota"(p_student_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_cash_report_with_method"(p_start_date date, p_end_date date, p_payment_method_code text) TO service_role;
ALTER FUNCTION public."get_cash_report_with_method"(p_start_date date, p_end_date date, p_payment_method_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_cash_report"(p_start_date date, p_end_date date) TO service_role;
ALTER FUNCTION public."get_cash_report"(p_start_date date, p_end_date date) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_cash_summary"(p_student_id uuid) TO service_role;
ALTER FUNCTION public."get_cash_summary"(p_student_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_contest_achievement_detail"(p_entry_id uuid) TO service_role;
ALTER FUNCTION public."get_contest_achievement_detail"(p_entry_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_equipment_primary_photo"(p_equipment_id uuid) TO service_role;
ALTER FUNCTION public."get_equipment_primary_photo"(p_equipment_id uuid) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."get_operational_dashboard_summary"(p_report_date date) TO service_role;
ALTER FUNCTION public."get_operational_dashboard_summary"(p_report_date date) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_agenda_activity_date"() TO service_role;
ALTER FUNCTION public."guard_agenda_activity_date"() SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_borrowing_return_completion"() TO service_role;
ALTER FUNCTION public."guard_borrowing_return_completion"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_cash_dispute_actor"() TO service_role;
ALTER FUNCTION public."guard_cash_dispute_actor"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_cash_dispute_reviewer"() TO service_role;
ALTER FUNCTION public."guard_cash_dispute_reviewer"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_return_report_approval"() TO service_role;
ALTER FUNCTION public."guard_return_report_approval"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_social_insight_recorded"() TO service_role;
ALTER FUNCTION public."guard_social_insight_recorded"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."guard_social_publication_recorded"() TO service_role;
ALTER FUNCTION public."guard_social_publication_recorded"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."handover_borrowing_atomic"(p_borrowing_id uuid, p_handover_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."handover_borrowing_atomic"(p_borrowing_id uuid, p_handover_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."is_login_rate_limited"(p_rate_key text, p_window_seconds integer, p_max_attempts integer) TO service_role;
ALTER FUNCTION public."is_login_rate_limited"(p_rate_key text, p_window_seconds integer, p_max_attempts integer) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."link_account_to_existing_student_atomic"(p_student_id uuid, p_user_id uuid, p_actor_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."link_account_to_existing_student_atomic"(p_student_id uuid, p_user_id uuid, p_actor_id uuid, p_change_reason text) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."link_existing_student_account_atomic"(p_user_id uuid, p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_actor_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."link_existing_student_account_atomic"(p_user_id uuid, p_nis text, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_actor_id uuid, p_change_reason text) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."list_contest_achievements_grouped"(p_search text, p_result_kind text, p_position integer, p_outcome_status text, p_tahun_event integer, p_page integer, p_page_size integer) TO service_role;
ALTER FUNCTION public."list_contest_achievements_grouped"(p_search text, p_result_kind text, p_position integer, p_outcome_status text, p_tahun_event integer, p_page integer, p_page_size integer) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."list_contest_achievements"(p_search text, p_result_kind text, p_position integer, p_outcome_status text, p_tahun_event integer, p_page integer, p_page_size integer) TO service_role;
ALTER FUNCTION public."list_contest_achievements"(p_search text, p_result_kind text, p_position integer, p_outcome_status text, p_tahun_event integer, p_page integer, p_page_size integer) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."list_unlinked_student_accounts"(p_search text, p_limit integer, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."list_unlinked_student_accounts"(p_search text, p_limit integer, p_actor_id uuid) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."log_activity"() TO service_role;
ALTER FUNCTION public."log_activity"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."notify_borrowing_recipients"(p_borrowing_id uuid, p_event text, p_type notification_type, p_title text, p_body text, p_recipient_ids uuid[], p_metadata jsonb) TO service_role;
ALTER FUNCTION public."notify_borrowing_recipients"(p_borrowing_id uuid, p_event text, p_type notification_type, p_title text, p_body text, p_recipient_ids uuid[], p_metadata jsonb) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."notify_borrowing_status_change"() TO service_role;
ALTER FUNCTION public."notify_borrowing_status_change"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."open_return_recovery_case"() TO service_role;
ALTER FUNCTION public."open_return_recovery_case"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."prevent_cash_transaction_mutation"() TO service_role;
ALTER FUNCTION public."prevent_cash_transaction_mutation"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."preview_return_assessment"(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb) TO service_role;
ALTER FUNCTION public."preview_return_assessment"(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."protect_activity_logs"() TO service_role;
ALTER FUNCTION public."protect_activity_logs"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."protect_default_cash_payment_method"() TO service_role;
ALTER FUNCTION public."protect_default_cash_payment_method"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."provision_student_account_atomic"(p_student_id uuid, p_username text, p_password_hash text, p_created_by uuid) TO service_role;
ALTER FUNCTION public."provision_student_account_atomic"(p_student_id uuid, p_username text, p_password_hash text, p_created_by uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."provision_student_account_v2"(p_student_id uuid, p_username text, p_password_hash text, p_no_telepon text, p_created_by uuid, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."provision_student_account_v2"(p_student_id uuid, p_username text, p_password_hash text, p_no_telepon text, p_created_by uuid, p_operation_key uuid, p_request_fingerprint text, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO '';
GRANT EXECUTE ON FUNCTION public."purge_expired_api_rate_limit_windows"(p_batch_size integer) TO service_role;
ALTER FUNCTION public."purge_expired_api_rate_limit_windows"(p_batch_size integer) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."purge_student_history_atomic"(p_student_id uuid, p_actor_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."purge_student_history_atomic"(p_student_id uuid, p_actor_id uuid, p_change_reason text) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_attendance_batch_atomic"(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."record_attendance_batch_atomic"(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_attendance_batch_atomic"(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."record_attendance_batch_atomic"(p_tanggal date, p_kelas text, p_records jsonb, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_in_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric) TO service_role;
ALTER FUNCTION public."record_cash_in_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_in_on_date_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date) TO service_role;
ALTER FUNCTION public."record_cash_in_on_date_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_in_on_date_with_method_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text) TO service_role;
ALTER FUNCTION public."record_cash_in_on_date_with_method_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_in_with_status_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text) TO service_role;
ALTER FUNCTION public."record_cash_in_with_status_atomic"(p_student_id text, p_nominal numeric, p_keterangan text, p_type text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_weekly_due numeric, p_tanggal date, p_payment_method_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_out_atomic"(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text) TO service_role;
ALTER FUNCTION public."record_cash_out_atomic"(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_cash_out_with_method_atomic"(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_payment_method_code text) TO service_role;
ALTER FUNCTION public."record_cash_out_with_method_atomic"(p_nominal numeric, p_keterangan text, p_foto_bukti_url text, p_created_by text, p_idempotency_key text, p_change_reason text, p_payment_method_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_contest_entry_result_atomic"(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_evidence_url text) TO service_role;
ALTER FUNCTION public."record_contest_entry_result_atomic"(p_entry_id uuid, p_outcome_status text, p_results jsonb, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_evidence_url text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_equipment_charge_payment_atomic"(p_settlement_id uuid, p_paid_amount numeric, p_status text, p_notes text, p_recorded_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."record_equipment_charge_payment_atomic"(p_settlement_id uuid, p_paid_amount numeric, p_status text, p_notes text, p_recorded_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_equipment_charge_payment_event_atomic"(p_settlement_id uuid, p_payment_amount numeric, p_evidence_ids uuid[], p_notes text, p_recorded_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."record_equipment_charge_payment_event_atomic"(p_settlement_id uuid, p_payment_amount numeric, p_evidence_ids uuid[], p_notes text, p_recorded_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_grades_bulk_atomic"(p_assignment_id uuid, p_grades jsonb, p_graded_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."record_grades_bulk_atomic"(p_assignment_id uuid, p_grades jsonb, p_graded_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."record_login_failure"(p_rate_key text, p_window_seconds integer) TO service_role;
ALTER FUNCTION public."record_login_failure"(p_rate_key text, p_window_seconds integer) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."redact_audit_json"(p_value jsonb) TO service_role;
ALTER FUNCTION public."redact_audit_json"(p_value jsonb) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."register_equipment_replacement_atomic"(p_case_id uuid, p_equipment_code text, p_name text, p_category text, p_storage_location text, p_serial_number text, p_photo_urls jsonb, p_description text, p_replacement_value numeric, p_created_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."register_equipment_replacement_atomic"(p_case_id uuid, p_equipment_code text, p_name text, p_category text, p_storage_location text, p_serial_number text, p_photo_urls jsonb, p_description text, p_replacement_value numeric, p_created_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."replace_access_role_capabilities"(p_role_key text, p_capabilities text[], p_actor_user_id uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."replace_access_role_capabilities"(p_role_key text, p_capabilities text[], p_actor_user_id uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reserve_agenda_photo_atomic"(p_activity_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid, p_idempotency_key text) TO service_role;
ALTER FUNCTION public."reserve_agenda_photo_atomic"(p_activity_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid, p_idempotency_key text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reserve_borrowing_return_evidence_atomic"(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."reserve_borrowing_return_evidence_atomic"(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reserve_borrowing_self_return_evidence_atomic"(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."reserve_borrowing_self_return_evidence_atomic"(p_borrowing_id uuid, p_equipment_id uuid, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reserve_contest_entry_evidence_atomic"(p_entry_id uuid, p_target_status text, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."reserve_contest_entry_evidence_atomic"(p_entry_id uuid, p_target_status text, p_object_key text, p_mime_type text, p_file_size_bytes bigint, p_original_filename text, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reserve_equipment_charge_evidence_atomic"(p_settlement_id uuid, p_evidence_type text, p_object_key text, p_mime_type text, p_file_size_bytes integer, p_original_filename text, p_created_by uuid) TO service_role;
ALTER FUNCTION public."reserve_equipment_charge_evidence_atomic"(p_settlement_id uuid, p_evidence_type text, p_object_key text, p_mime_type text, p_file_size_bytes integer, p_original_filename text, p_created_by uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."reset_user_password_atomic"(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_operation_key text, p_request_id uuid, p_operation_id uuid) TO service_role;
ALTER FUNCTION public."reset_user_password_atomic"(p_user_id uuid, p_password_hash text, p_updated_by uuid, p_change_reason text, p_operation_key text, p_request_id uuid, p_operation_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."resolve_cash_payment_method_id"(p_code text) TO service_role;
ALTER FUNCTION public."resolve_cash_payment_method_id"(p_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."return_borrowing_atomic"(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb, p_catatan text, p_returned_by uuid, p_change_reason text) TO service_role;
ALTER FUNCTION public."return_borrowing_atomic"(p_borrowing_id uuid, p_returned_at date, p_item_conditions jsonb, p_catatan text, p_returned_by uuid, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."review_cash_dispute_atomic"(p_dispute_id uuid, p_status text, p_review_note text, p_actor_id uuid, p_resolution_date date, p_resolution_amount numeric, p_payment_method_code text) TO service_role;
ALTER FUNCTION public."review_cash_dispute_atomic"(p_dispute_id uuid, p_status text, p_review_note text, p_actor_id uuid, p_resolution_date date, p_resolution_amount numeric, p_payment_method_code text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."search_borrowings_page_ids"(p_search text, p_status text, p_student_id uuid, p_borrower_id uuid, p_overdue_only boolean, p_now timestamp with time zone, p_today date, p_limit integer, p_offset integer) TO service_role;
ALTER FUNCTION public."search_borrowings_page_ids"(p_search text, p_status text, p_student_id uuid, p_borrower_id uuid, p_overdue_only boolean, p_now timestamp with time zone, p_today date, p_limit integer, p_offset integer) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."set_student_account_status_atomic"(p_student_id uuid, p_is_active boolean, p_updated_by uuid) TO service_role;
ALTER FUNCTION public."set_student_account_status_atomic"(p_student_id uuid, p_is_active boolean, p_updated_by uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."snapshot_access_control_audit_actor"() TO service_role;
ALTER FUNCTION public."snapshot_access_control_audit_actor"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."submit_borrowing_self_return_atomic"(p_report_id uuid, p_evidence_ids uuid[], p_notes text, p_actor_id uuid, p_idempotency_key text, p_change_reason text) TO service_role;
ALTER FUNCTION public."submit_borrowing_self_return_atomic"(p_report_id uuid, p_evidence_ids uuid[], p_notes text, p_actor_id uuid, p_idempotency_key text, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."sync_contest_frontend_contract"() TO service_role;
ALTER FUNCTION public."sync_contest_frontend_contract"() SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."transition_contest_entry_atomic"(p_entry_id uuid, p_status text, p_result_label text, p_result_note text, p_evidence_url text, p_evidence_type text, p_change_reason text, p_actor_id uuid) TO service_role;
ALTER FUNCTION public."transition_contest_entry_atomic"(p_entry_id uuid, p_status text, p_result_label text, p_result_note text, p_evidence_url text, p_evidence_type text, p_change_reason text, p_actor_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."transition_contest_entry_pipeline_atomic"(p_entry_id uuid, p_status text, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."transition_contest_entry_pipeline_atomic"(p_entry_id uuid, p_status text, p_evidence_id uuid, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_agenda_activity_atomic"(p_activity_id uuid, p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_expected_version integer, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."update_agenda_activity_atomic"(p_activity_id uuid, p_activity_date date, p_activity_name text, p_activity_description text, p_instructor_name text, p_pic_names text[], p_expected_version integer, p_change_reason text, p_actor_id uuid, p_idempotency_key text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_contest_atomic"(p_contest_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."update_contest_atomic"(p_contest_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_equipment_atomic"(p_equipment_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."update_equipment_atomic"(p_equipment_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_equipment_condition_atomic"(p_equipment_id uuid, p_kondisi text, p_updated_by uuid, p_change_reason text, p_status text, p_catatan_kerusakan text, p_request_id uuid, p_operation_id uuid, p_user_agent text) TO service_role;
ALTER FUNCTION public."update_equipment_condition_atomic"(p_equipment_id uuid, p_kondisi text, p_updated_by uuid, p_change_reason text, p_status text, p_catatan_kerusakan text, p_request_id uuid, p_operation_id uuid, p_user_agent text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_student_profile_atomic"(p_student_id uuid, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_updated_by uuid) TO service_role;
ALTER FUNCTION public."update_student_profile_atomic"(p_student_id uuid, p_nama text, p_kelas text, p_peminatan text, p_no_telepon text, p_foto_url text, p_updated_by uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."update_user_account_atomic"(p_user_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid) TO service_role;
ALTER FUNCTION public."update_user_account_atomic"(p_user_id uuid, p_changes jsonb, p_updated_by uuid, p_change_reason text, p_request_id uuid, p_operation_id uuid) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."validate_cash_transaction_final"() TO service_role;
ALTER FUNCTION public."validate_cash_transaction_final"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."validate_cash_transaction"() TO service_role;
ALTER FUNCTION public."validate_cash_transaction"() SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."validate_contest_deadline_future"() TO service_role;
ALTER FUNCTION public."validate_contest_deadline_future"() SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public."verify_borrowing_self_return_atomic"(p_report_id uuid, p_decision text, p_verification_method text, p_item_conditions jsonb, p_rejection_reason text, p_verified_by uuid, p_idempotency_key text, p_change_reason text) TO service_role;
ALTER FUNCTION public."verify_borrowing_self_return_atomic"(p_report_id uuid, p_decision text, p_verification_method text, p_item_conditions jsonb, p_rejection_reason text, p_verified_by uuid, p_idempotency_key text, p_change_reason text) SET search_path TO public, pg_temp;
GRANT EXECUTE ON FUNCTION public."write_audit_log"(p_user_id uuid, p_action text, p_table_name text, p_record_id uuid, p_old_values jsonb, p_new_values jsonb, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_source text, p_user_agent text, p_metadata jsonb) TO service_role;
ALTER FUNCTION public."write_audit_log"(p_user_id uuid, p_action text, p_table_name text, p_record_id uuid, p_old_values jsonb, p_new_values jsonb, p_change_reason text, p_request_id uuid, p_operation_id uuid, p_source text, p_user_agent text, p_metadata jsonb) SET search_path TO public, pg_temp;
