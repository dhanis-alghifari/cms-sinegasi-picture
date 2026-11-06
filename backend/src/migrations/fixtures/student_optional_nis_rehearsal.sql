\set ON_ERROR_STOP on
-- Run ONLY in an isolated disposable PostgreSQL cluster. Migrations commit.
DO $$
BEGIN
  IF current_database() <> 'sinegasi_student_optional_nis_rehearsal'
     OR to_regclass('public.users') IS NOT NULL
     OR to_regclass('public.students') IS NOT NULL
     OR to_regclass('public.activity_logs') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) THEN
    RAISE EXCEPTION 'DISPOSABLE_EMPTY_REHEARSAL_CLUSTER_REQUIRED';
  END IF;
END;
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.user_role AS ENUM (
  'teacher', 'leader', 'vice_leader', 'secretary', 'treasurer',
  'equipment_team', 'contest_team', 'social_media_team', 'member'
);
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, nama TEXT NOT NULL, role public.user_role NOT NULL,
  is_first_login BOOLEAN NOT NULL DEFAULT TRUE, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID, updated_by UUID, updated_at TIMESTAMPTZ
);
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES public.users(id),
  nis TEXT NOT NULL UNIQUE, nama TEXT NOT NULL, kelas TEXT NOT NULL, peminatan TEXT,
  no_telepon TEXT, foto_url TEXT, is_active BOOLEAN, created_by UUID, updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE TABLE public.access_role_permissions (role_key TEXT, permission_key TEXT);
CREATE TABLE public.student_account_operations (
  actor_id UUID NOT NULL, operation_key UUID NOT NULL, operation_type TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL, student_id UUID, user_id UUID,
  PRIMARY KEY (actor_id, operation_key)
);
CREATE TABLE public.activity_logs (user_id UUID, action TEXT, table_name TEXT, change_reason TEXT);

CREATE FUNCTION public.write_audit_log(UUID, TEXT, TEXT, UUID, JSONB, JSONB, TEXT, UUID, UUID, TEXT, TEXT, JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.activity_logs VALUES ($1, $2, $3, $7);
  RETURN gen_random_uuid();
END;
$$;
CREATE FUNCTION public.synthetic_user_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor TEXT := NULLIF(current_setting('app.current_user_id', TRUE), '');
  reason TEXT := NULLIF(current_setting('app.change_reason', TRUE), '');
BEGIN
  IF current_setting('app.skip_legacy_audit', TRUE) = 'true' THEN RETURN NEW; END IF;
  IF actor IS NULL OR reason IS NULL THEN RAISE EXCEPTION 'AUDIT_CONTEXT_REQUIRED'; END IF;
  IF reason = 'Simulasi audit gagal' THEN RAISE EXCEPTION 'SIMULATED_AUDIT_FAILURE'; END IF;
  INSERT INTO public.activity_logs VALUES (actor::UUID, 'UPDATE', 'users', reason);
  RETURN NEW;
END;
$$;
CREATE TRIGGER synthetic_audit_users AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.synthetic_user_audit();
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON public.users, public.students TO service_role;
GRANT SELECT ON public.access_role_permissions TO service_role;

-- @BASELINE_FUNCTIONS@

INSERT INTO public.users (id, username, password_hash, nama, role) VALUES
 ('11111111-1111-4111-8111-111111111111', 'guru', 'synthetic-hash-only', 'Guru Uji', 'teacher'),
 ('22222222-2222-4222-8222-222222222222', 'lama', 'synthetic-hash-only', 'Akun Lama', 'treasurer'),
 ('33333333-3333-4333-8333-333333333333', 'anggota', 'synthetic-hash-only', 'Akun Anggota', 'member');
INSERT INTO public.access_role_permissions VALUES
 ('teacher', 'students.manage'), ('teacher', 'users.manage');

-- @OPTIONAL_NIS_MIGRATION_TWICE@

DO $$
DECLARE
  sig TEXT := 'public.update_student_profile_nis_audited_atomic(uuid,text,text,text,text,text,text,uuid,text)';
BEGIN
  IF has_function_privilege('anon', sig, 'EXECUTE')
     OR has_function_privilege('authenticated', sig, 'EXECUTE')
     OR NOT has_function_privilege('service_role', sig, 'EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid = sig::regprocedure) THEN
    RAISE EXCEPTION 'RPC_PRIVILEGE_BOUNDARY_FAILED';
  END IF;
END;
$$;

SET ROLE service_role;
DO $$
DECLARE
  actor UUID := '11111111-1111-4111-8111-111111111111';
  bad_actor UUID := '33333333-3333-4333-8333-333333333333';
  account_result JSONB;
  replay JSONB;
  first_student UUID;
  number_student UUID;
BEGIN
  account_result := public.create_student_with_account_v2(
    NULL, 'Siswa Pertama', 'X Uji', NULL, '+6281234567890', NULL,
    'murid1', repeat('x',32), actor, 'member',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'Tambah siswa uji');
  first_student := (account_result->>'student_id')::UUID;
  replay := public.create_student_with_account_v2(
    NULL, 'Siswa Pertama', 'X Uji', NULL, '+6281234567890', NULL,
    'murid1', repeat('x',32), actor, 'member',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), 'Tambah siswa uji');
  IF replay->>'operation_replayed' <> 'true' OR (replay->>'student_id')::UUID <> first_student THEN
    RAISE EXCEPTION 'IDEMPOTENT_REPLAY_FAILED';
  END IF;
  PERFORM public.create_student_with_account_v2(
    '  ', 'Siswa Kedua', 'X Uji', NULL, '+6281234567890', NULL,
    'murid2', repeat('x',32), actor, 'member',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repeat('b',64), 'Tambah siswa uji');
  PERFORM public.link_existing_student_account_atomic(
    '22222222-2222-4222-8222-222222222222', NULL, 'Siswa Lama', 'X Uji',
    NULL, NULL, NULL, actor, 'Tautkan siswa uji');
  -- The legacy link function sets transaction-local context for its caller.
  PERFORM set_config('app.current_user_id', '', TRUE);
  PERFORM set_config('app.change_reason', '', TRUE);
  PERFORM set_config('app.skip_legacy_audit', '', TRUE);
  IF (SELECT count(*) FROM public.students WHERE nis IS NULL) <> 3 THEN
    RAISE EXCEPTION 'MULTIPLE_NULL_STUDENTS_FAILED';
  END IF;

  account_result := public.create_student_with_account_v2(
    '000123', 'Nomor Asli', 'X Uji', NULL, '+6281234567890', NULL,
    'murid3', repeat('x',32), actor, 'member',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', repeat('c',64), 'Tambah siswa uji');
  number_student := (account_result->>'student_id')::UUID;
  BEGIN
    PERFORM public.create_student_with_account_v2(
      '000123', 'Nomor Duplikat', 'X Uji', NULL, '+6281234567890', NULL,
      'murid4', repeat('x',32), actor, 'member',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', repeat('d',64), 'Tambah siswa uji');
    RAISE EXCEPTION 'DUPLICATE_NIS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.users WHERE username = 'murid4') THEN
    RAISE EXCEPTION 'FAILED_CREATE_NOT_ROLLED_BACK';
  END IF;

  PERFORM public.update_student_profile_nis_audited_atomic(
    first_student, '000999', 'Siswa Pertama', 'X Uji', NULL, NULL, NULL, actor, 'Isi NIS siswa uji');
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = first_student AND nis = '000999') THEN
    RAISE EXCEPTION 'NIS_FILL_FAILED';
  END IF;
  BEGIN
    PERFORM public.update_student_profile_nis_audited_atomic(
      first_student, '000123', 'Siswa Pertama', 'X Uji', NULL, NULL, NULL, actor, 'Duplikat siswa uji');
    RAISE EXCEPTION 'DUPLICATE_UPDATE_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.update_student_profile_nis_audited_atomic(
      first_student, NULL, 'Siswa Pertama', 'X Uji', NULL, NULL, NULL, bad_actor, 'Ubah siswa uji');
    RAISE EXCEPTION 'UNAUTHORIZED_ACTOR_ACCEPTED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.update_student_profile_nis_audited_atomic(
      first_student, NULL, 'Gagal Audit', 'X Uji', NULL, NULL, NULL, actor, 'Simulasi audit gagal');
    RAISE EXCEPTION 'AUDIT_FAILURE_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SIMULATED_AUDIT_FAILURE' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = first_student AND nis = '000999' AND nama = 'Siswa Pertama') THEN
    RAISE EXCEPTION 'FAILED_UPDATE_NOT_ROLLED_BACK';
  END IF;
  PERFORM public.update_student_profile_nis_audited_atomic(
    first_student, NULL, 'Siswa Pertama', 'X Uji', NULL, NULL, NULL, actor, 'Kosongkan NIS uji');
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = first_student AND nis IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.students WHERE id = number_student AND nis = '000123') THEN
    RAISE EXCEPTION 'NIS_CLEAR_FAILED';
  END IF;
  IF NULLIF(current_setting('app.current_user_id', TRUE), '') IS NOT NULL
     OR NULLIF(current_setting('app.change_reason', TRUE), '') IS NOT NULL THEN
    RAISE EXCEPTION 'AUDIT_CONTEXT_LEAKED';
  END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_logs
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND table_name = 'users' AND action = 'UPDATE' AND change_reason = 'Kosongkan NIS uji') THEN
    RAISE EXCEPTION 'AUDIT_ACTOR_OR_REASON_FAILED';
  END IF;
END;
$$;
SELECT 'STUDENT_OPTIONAL_NIS_REHEARSAL_OK';
