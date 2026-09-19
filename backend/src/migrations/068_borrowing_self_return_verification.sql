-- 068_borrowing_self_return_verification.sql
-- Asynchronous student return reports with teacher-only verification.
-- 064 is already used by equipment charge/payment evidence; keep this migration
-- independently deployable after 063/064-067.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_068_BORROWING_SELF_RETURN_VERIFICATION', true);

DO $$
BEGIN
  IF to_regclass('public.borrowings') IS NULL
     OR to_regclass('public.borrowing_items') IS NULL
     OR to_regclass('public.borrowing_return_evidence') IS NULL THEN
    RAISE EXCEPTION 'BORROWING_SELF_RETURN_SCHEMA_MISSING: jalankan migration 062 terlebih dahulu';
  END IF;
END;
$$;

-- Keep borrowing migrations independent from the contest module's migration
-- ledger. This table is metadata only and is not exposed to application roles.
CREATE TABLE IF NOT EXISTS public.borrowing_migration_history (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON TABLE public.borrowing_migration_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.borrowing_migration_history TO service_role;

ALTER TABLE public.borrowings
  ADD COLUMN IF NOT EXISTS return_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_notes TEXT,
  ADD COLUMN IF NOT EXISTS return_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.borrowings DROP CONSTRAINT IF EXISTS borrowings_status_check;
ALTER TABLE public.borrowings
  ADD CONSTRAINT borrowings_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'partial', 'pending_verification')
  );

ALTER TABLE public.borrowing_return_evidence
  ADD COLUMN IF NOT EXISTS return_report_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'teacher_return';

ALTER TABLE public.borrowing_return_evidence
  DROP CONSTRAINT IF EXISTS borrowing_return_evidence_source_check,
  ADD CONSTRAINT borrowing_return_evidence_source_check
    CHECK (source IN ('teacher_return', 'student_report')),
  DROP CONSTRAINT IF EXISTS borrowing_return_evidence_report_check,
  ADD CONSTRAINT borrowing_return_evidence_report_check CHECK (
    (source = 'student_report' AND return_report_id IS NOT NULL)
    OR (source = 'teacher_return' AND return_report_id IS NULL)
  );

CREATE TABLE IF NOT EXISTS public.borrowing_return_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id UUID NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_verification', 'approved', 'rejected')),
  notes TEXT,
  rejection_reason TEXT,
  verification_method TEXT
    CHECK (verification_method IS NULL OR verification_method IN ('photo', 'physical_check', 'photo_and_physical')),
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.borrowing_return_evidence
  DROP CONSTRAINT IF EXISTS borrowing_return_evidence_report_fk;

ALTER TABLE public.borrowing_return_evidence
  ADD CONSTRAINT borrowing_return_evidence_report_fk
  FOREIGN KEY (return_report_id) REFERENCES public.borrowing_return_reports(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_return_reports_active
  ON public.borrowing_return_reports (borrowing_id)
  WHERE status IN ('draft', 'pending_verification');
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_return_reports_idempotency
  ON public.borrowing_return_reports (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_borrowing_return_reports_status
  ON public.borrowing_return_reports (status, reported_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_borrowing_return_evidence_report
  ON public.borrowing_return_evidence (return_report_id, upload_status, equipment_id, created_at);

CREATE TABLE IF NOT EXISTS public.borrowing_return_operations (
  idempotency_key TEXT PRIMARY KEY CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  report_id UUID NOT NULL REFERENCES public.borrowing_return_reports(id) ON DELETE CASCADE,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('submit', 'verify')),
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.borrowing_return_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_return_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.borrowing_return_reports, public.borrowing_return_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.borrowing_return_reports, public.borrowing_return_operations TO service_role;
REVOKE ALL ON TABLE public.borrowing_return_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.borrowing_return_evidence TO service_role;

-- The persistent matrix is the source of truth for authMiddleware reloads.
INSERT INTO public.access_permissions (permission_key, label)
VALUES
  ('borrowing.return.report', 'Borrowing return report'),
  ('borrowing.return.verify', 'Verify borrowing return')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, 'borrowing.return.report'
FROM public.access_roles
WHERE role_key IN ('member', 'leader', 'vice_leader', 'equipment_team', 'contest_team')
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
VALUES ('teacher', 'borrowing.return.verify')
ON CONFLICT DO NOTHING;

-- Student committee roles must not approve, hand over, or finalize returns.
DELETE FROM public.access_role_permissions
WHERE role_key IN ('leader', 'vice_leader', 'equipment_team')
  AND permission_key = 'borrowing.manage';

CREATE OR REPLACE FUNCTION public.reserve_borrowing_self_return_evidence_atomic(
  p_borrowing_id UUID,
  p_equipment_id UUID,
  p_object_key TEXT,
  p_mime_type TEXT,
  p_file_size_bytes BIGINT,
  p_original_filename TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.submit_borrowing_self_return_atomic(
  p_report_id UUID,
  p_evidence_ids UUID[],
  p_notes TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.verify_borrowing_self_return_atomic(
  p_report_id UUID,
  p_decision TEXT,
  p_verification_method TEXT,
  p_item_conditions JSONB,
  p_rejection_reason TEXT,
  p_verified_by UUID,
  p_idempotency_key TEXT,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.borrowing_return_reports;
  v_borrowing public.borrowings;
  v_operation public.borrowing_return_operations;
  v_item JSONB;
  v_evidence_ids JSONB;
  v_conditions JSONB := '[]'::JSONB;
  v_response JSONB;
  v_count INTEGER;
BEGIN
  IF p_report_id IS NULL OR p_verified_by IS NULL OR p_decision NOT IN ('approve', 'reject')
     OR (p_decision = 'approve' AND p_verification_method NOT IN ('photo', 'physical_check', 'photo_and_physical'))
     OR (p_decision = 'reject' AND length(btrim(COALESCE(p_rejection_reason, ''))) < 5)
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_INPUT_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_verified_by AND is_active = TRUE AND role::TEXT = 'teacher') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ACTOR_FORBIDDEN';
  END IF;

  -- Ensure Zero Silent Edits audit context is present for all subsequent updates (approve or reject)
  PERFORM set_config('app.current_user_id', p_verified_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);

  SELECT * INTO v_report FROM public.borrowing_return_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  INSERT INTO public.borrowing_return_operations (idempotency_key, report_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_report_id, 'verify', p_verified_by)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_operation FROM public.borrowing_return_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_operation.report_id IS DISTINCT FROM p_report_id OR v_operation.actor_id IS DISTINCT FROM p_verified_by OR v_operation.operation_kind <> 'verify' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_IDEMPOTENCY_REUSED';
    END IF;
    IF v_operation.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_OPERATION_INCOMPLETE'; END IF;
    RETURN v_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  IF v_report.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  SELECT * INTO v_borrowing FROM public.borrowings WHERE id = v_report.borrowing_id FOR UPDATE;
  IF NOT FOUND OR v_borrowing.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  IF p_decision = 'reject' THEN
    UPDATE public.borrowing_return_evidence SET upload_status = 'abandoned', updated_at = NOW()
    WHERE return_report_id = p_report_id AND upload_status = 'pending';
    UPDATE public.borrowing_return_reports SET status = 'rejected', rejection_reason = btrim(p_rejection_reason), verified_by = p_verified_by, verified_at = NOW(), updated_at = NOW() WHERE id = p_report_id;
    UPDATE public.borrowings SET status = 'borrowed', return_reported_at = NULL, return_notes = NULL, updated_by = p_verified_by, updated_at = NOW() WHERE id = v_borrowing.id;
    v_response := jsonb_build_object('report_id', p_report_id, 'borrowing_id', v_borrowing.id, 'status', 'borrowed', 'idempotent_replay', FALSE);
  ELSE
    IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_REQUIRED'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions) LOOP
      IF jsonb_typeof(v_item) <> 'object' OR v_item->>'equipment_id' IS NULL OR v_item->>'kondisi_kembali' IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_INVALID'; END IF;
      SELECT jsonb_agg(to_jsonb(bre.id)) INTO v_evidence_ids FROM public.borrowing_return_evidence bre WHERE bre.return_report_id = p_report_id AND bre.equipment_id = (v_item->>'equipment_id')::UUID AND bre.upload_status = 'pending';
      v_conditions := v_conditions || jsonb_build_array(v_item || jsonb_build_object('evidence_ids', COALESCE(v_evidence_ids, '[]'::JSONB)));
    END LOOP;
    SELECT COUNT(*) INTO v_count FROM public.borrowing_items WHERE borrowing_id = v_borrowing.id AND status = 'borrowed';
    IF jsonb_array_length(v_conditions) <> v_count THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_REQUIRED'; END IF;
    -- Reuse the existing charge/assessment transaction. The status and creator
    -- changes are transaction-local and are rolled back together on failure.
    UPDATE public.borrowings SET status = 'borrowed' WHERE id = v_borrowing.id;
    UPDATE public.borrowing_return_evidence SET created_by = p_verified_by WHERE return_report_id = p_report_id AND upload_status = 'pending';
    PERFORM public.return_borrowing_atomic(v_borrowing.id, CURRENT_DATE, v_conditions, v_report.notes, p_verified_by, p_change_reason);
    UPDATE public.borrowing_return_evidence
    SET created_by = v_report.reporter_id, return_report_id = p_report_id, updated_at = NOW()
    WHERE return_report_id = p_report_id;
    UPDATE public.borrowing_return_reports SET status = 'approved', verification_method = p_verification_method, verified_by = p_verified_by, verified_at = NOW(), updated_at = NOW() WHERE id = p_report_id;
    UPDATE public.borrowings SET return_verified_at = NOW(), return_verified_by = p_verified_by, updated_at = NOW() WHERE id = v_borrowing.id;
    v_response := jsonb_build_object('report_id', p_report_id, 'borrowing_id', v_borrowing.id, 'status', 'returned', 'idempotent_replay', FALSE);
  END IF;
  UPDATE public.borrowing_return_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_borrowing_self_return_evidence_atomic(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_borrowing_self_return_evidence_atomic(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.submit_borrowing_self_return_atomic(UUID, UUID[], TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_borrowing_self_return_atomic(UUID, UUID[], TEXT, UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.verify_borrowing_self_return_atomic(UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_borrowing_self_return_atomic(UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) TO service_role;

INSERT INTO public.borrowing_migration_history (migration_name)
VALUES ('068_borrowing_self_return_verification.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
