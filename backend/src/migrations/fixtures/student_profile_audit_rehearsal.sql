\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'sinegasi_student_profile_audit_rehearsal'
     OR to_regclass('public.users') IS NOT NULL
     OR to_regclass('public.students') IS NOT NULL
     OR to_regclass('public.activity_logs') IS NOT NULL THEN
    RAISE EXCEPTION 'DISPOSABLE_EMPTY_REHEARSAL_DATABASE_REQUIRED';
  END IF;
END;
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.users (
  id UUID PRIMARY KEY, nama TEXT NOT NULL, role TEXT NOT NULL, is_active BOOLEAN NOT NULL,
  password_hash TEXT, updated_by UUID, updated_at TIMESTAMPTZ
);
CREATE TABLE public.students (
  id UUID PRIMARY KEY, user_id UUID REFERENCES public.users(id), nis TEXT, nama TEXT,
  kelas TEXT, peminatan TEXT, no_telepon TEXT, foto_url TEXT, is_active BOOLEAN,
  updated_by UUID, updated_at TIMESTAMPTZ
);
CREATE TABLE public.access_role_permissions (role_key TEXT, permission_key TEXT);
CREATE TABLE public.activity_logs (
  user_id UUID, action TEXT, table_name TEXT, record_id UUID, old_values JSONB, new_values JSONB,
  aksi TEXT, tabel TEXT, data_lama JSONB, data_baru JSONB, change_reason TEXT, source TEXT,
  CONSTRAINT synthetic_audit_failure CHECK (change_reason <> 'Simulasi kegagalan audit')
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.users, public.access_role_permissions TO service_role;

-- @BASELINE_FUNCTIONS@
CREATE TRIGGER trg_audit_users AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
REVOKE ALL ON FUNCTION public.update_student_profile_atomic(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_profile_atomic(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID)
  TO service_role;

INSERT INTO public.users (id, nama, role, is_active, password_hash) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Operator Uji', 'secretary', TRUE, 'SYNTHETIC_ONLY'),
  ('22222222-2222-4222-8222-222222222222', 'Akun Siswa Uji', 'member', TRUE, 'SYNTHETIC_ONLY'),
  ('33333333-3333-4333-8333-333333333333', 'Operator Nonaktif', 'secretary', FALSE, 'SYNTHETIC_ONLY');
INSERT INTO public.students (id, user_id, nis, nama, kelas, peminatan, no_telepon, is_active) VALUES
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'TEST-001', 'Siswa Uji', 'X Uji', 'naskah', 'SYNTHETIC_ONLY', TRUE),
  ('55555555-5555-4555-8555-555555555555', NULL, 'TEST-002', 'Tanpa Akun Uji', 'X Uji', NULL, NULL, TRUE);
INSERT INTO public.access_role_permissions VALUES ('secretary', 'students.manage');

-- Reproduce the original failure with the real baseline function and audit trigger.
DO $$
BEGIN
  BEGIN
    PERFORM public.update_student_profile_atomic(
      '44444444-4444-4444-8444-444444444444', 'Siswa Uji', 'X Uji', 'naskah', 'SYNTHETIC_ONLY',
      'data:image/png;base64,SYNTHETIC_ONLY', '11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'LEGACY_FAILURE_NOT_REPRODUCED' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF position('Zero Silent Edits' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.students WHERE foto_url IS NOT NULL) THEN
    RAISE EXCEPTION 'FAILED_LEGACY_MUTATION_NOT_ROLLED_BACK';
  END IF;
END;
$$;

-- @AUDIT_CONTEXT_MIGRATION@

DO $$
DECLARE
  signature TEXT := 'public.update_student_profile_audited_atomic(uuid,text,text,text,text,text,uuid,text)';
BEGIN
  IF has_function_privilege('anon', signature, 'EXECUTE')
     OR has_function_privilege('authenticated', signature, 'EXECUTE')
     OR NOT has_function_privilege('service_role', signature, 'EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid = signature::regprocedure) THEN
    RAISE EXCEPTION 'RPC_PRIVILEGE_BOUNDARY_FAILED';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  actor UUID := '11111111-1111-4111-8111-111111111111';
  target UUID := '44444444-4444-4444-8444-444444444444';
  invalid_actor UUID;
  invalid_reason TEXT;
BEGIN
  PERFORM public.update_student_profile_audited_atomic(
    target, 'Siswa Uji Baru', 'XI Uji', 'editing', 'SYNTHETIC_ONLY',
    'data:image/png;base64,SYNTHETIC_ONLY', actor, '  Ubah foto pengujian  ');
  IF NULLIF(current_setting('app.current_user_id', TRUE), '') IS NOT NULL
     OR NULLIF(current_setting('app.change_reason', TRUE), '') IS NOT NULL THEN
    RAISE EXCEPTION 'AUDIT_CONTEXT_LEAKED_AFTER_SUCCESS';
  END IF;

  FOREACH invalid_actor IN ARRAY ARRAY[NULL::UUID,
    '22222222-2222-4222-8222-222222222222'::UUID,
    '33333333-3333-4333-8333-333333333333'::UUID,
    '99999999-9999-4999-8999-999999999999'::UUID] LOOP
    BEGIN
      PERFORM public.update_student_profile_audited_atomic(
        target, 'Forbidden', 'X Uji', NULL, NULL, NULL, invalid_actor, 'Ubah foto pengujian');
      RAISE EXCEPTION 'INVALID_ACTOR_ACCEPTED' USING ERRCODE = 'ZX002';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  FOREACH invalid_reason IN ARRAY ARRAY[NULL::TEXT, '', '    ', 'abcd', repeat('a', 501)] LOOP
    BEGIN
      PERFORM public.update_student_profile_audited_atomic(
        target, 'Forbidden', 'X Uji', NULL, NULL, NULL, actor, invalid_reason);
      RAISE EXCEPTION 'INVALID_REASON_ACCEPTED' USING ERRCODE = 'ZX003';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.update_student_profile_audited_atomic(
      target, 'Must Roll Back', 'X Uji', NULL, NULL, 'BROKEN_PHOTO', actor, 'Simulasi kegagalan audit');
    RAISE EXCEPTION 'AUDIT_FAILURE_ACCEPTED' USING ERRCODE = 'ZX004';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NULLIF(current_setting('app.current_user_id', TRUE), '') IS NOT NULL
     OR NULLIF(current_setting('app.change_reason', TRUE), '') IS NOT NULL THEN
    RAISE EXCEPTION 'AUDIT_CONTEXT_LEAKED_AFTER_FAILURE';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = '44444444-4444-4444-8444-444444444444'
    AND nama = 'Siswa Uji Baru' AND kelas = 'XI Uji' AND peminatan = 'editing'
    AND foto_url = 'data:image/png;base64,SYNTHETIC_ONLY'
    AND updated_by = '11111111-1111-4111-8111-111111111111')
    OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = '22222222-2222-4222-8222-222222222222'
    AND nama = 'Siswa Uji Baru') THEN
    RAISE EXCEPTION 'LINKED_PROFILE_OR_ROLLBACK_CHECK_FAILED';
  END IF;
  IF (SELECT count(*) FROM public.activity_logs) <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.activity_logs WHERE table_name = 'users' AND action = 'UPDATE'
      AND user_id = '11111111-1111-4111-8111-111111111111'
      AND change_reason = 'Ubah foto pengujian' AND source = 'trigger'
      AND new_values->>'password_hash' = '[REDACTED]'
  ) THEN RAISE EXCEPTION 'AUDIT_ACTOR_REASON_OR_REDACTION_FAILED'; END IF;
END;
$$;

-- Explicit inherited bypass flag must not suppress the existing audit trigger.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  actor UUID := '11111111-1111-4111-8111-111111111111';
BEGIN
  PERFORM set_config('app.current_user_id', actor::TEXT, TRUE);
  PERFORM set_config('app.change_reason', 'Outer transaction reason', TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);
  PERFORM public.update_student_profile_audited_atomic(
    '44444444-4444-4444-8444-444444444444', 'Siswa Uji Baru', 'XI Uji', 'editing', 'SYNTHETIC_ONLY',
    NULL, actor, 'Hapus foto pengujian');
  IF current_setting('app.change_reason', TRUE) <> 'Outer transaction reason'
     OR current_setting('app.skip_legacy_audit', TRUE) <> 'true' THEN
    RAISE EXCEPTION 'OUTER_CONTEXT_NOT_RESTORED';
  END IF;
  PERFORM public.update_student_profile_audited_atomic(
    '55555555-5555-4555-8555-555555555555', 'Tanpa Akun Uji', 'X Uji', NULL, NULL,
    'data:image/png;base64,SYNTHETIC_ONLY', actor, 'Ubah foto tanpa akun');
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.activity_logs) <> 2
    OR EXISTS (SELECT 1 FROM public.students WHERE id = '44444444-4444-4444-8444-444444444444' AND foto_url IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.students WHERE id = '55555555-5555-4555-8555-555555555555' AND foto_url IS NOT NULL) THEN
    RAISE EXCEPTION 'PHOTO_CLEAR_UNLINKED_OR_AUDIT_BYPASS_CHECK_FAILED';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'STUDENT_PROFILE_AUDIT_REHEARSAL_OK' AS result;
