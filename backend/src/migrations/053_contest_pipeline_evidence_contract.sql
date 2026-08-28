-- 053_contest_pipeline_evidence_contract.sql
-- Strict contest-entry pipeline, private object-storage evidence metadata, and
-- atomic completion with a simplified award contract.
--
-- Expand phase: legacy URL evidence and the RPCs from 048/050 remain available
-- until the backend/frontend rollout is complete.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config(
  'app.change_reason',
  'SYSTEM:MIGRATION_053_CONTEST_PIPELINE_EVIDENCE_CONTRACT',
  true
);

DO $$
BEGIN
  IF to_regclass('public.contest_entries') IS NULL
     OR to_regclass('public.contest_entry_evidence') IS NULL
     OR to_regclass('public.contest_entry_results') IS NULL
     OR to_regclass('public.contest_entry_status_history') IS NULL
     OR to_regclass('public.contest_entry_result_history') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_PIPELINE_SCHEMA_MISSING: jalankan migration 048 dan 050 terlebih dahulu';
  END IF;

  IF to_regclass('public.contest_migration_history') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.contest_migration_history
       WHERE migration_name = '052_contest_scope_contract.sql'
     ) THEN
    RAISE EXCEPTION 'CONTEST_MIGRATION_ORDER_INVALID: jalankan migration 052 terlebih dahulu';
  END IF;

  IF to_regprocedure(
    'public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'AUDIT_HELPER_MISSING: public.write_audit_log belum tersedia';
  END IF;
END;
$$;

-- Evidence created by the new API stores an R2 object key, never image bytes or
-- a permanent public URL. Existing rows keep their URL for backward-compatible
-- reads during the expand phase.
ALTER TABLE public.contest_entry_evidence
  ALTER COLUMN public_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS target_status TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS upload_status TEXT,
  ADD COLUMN IF NOT EXISTS attached_status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.contest_entry_evidence
SET storage_provider = COALESCE(
      storage_provider,
      CASE WHEN NULLIF(btrim(object_key), '') IS NULL THEN 'legacy_url' ELSE 'r2' END
    ),
    target_status = COALESCE(
      target_status,
      CASE evidence_type
        WHEN 'submission' THEN 'sudah_terkirim'
        WHEN 'result' THEN 'selesai'
        ELSE NULL
      END
    ),
    upload_status = COALESCE(upload_status, 'attached'),
    attached_status = COALESCE(
      attached_status,
      CASE evidence_type
        WHEN 'submission' THEN 'sudah_terkirim'
        WHEN 'result' THEN 'selesai'
        ELSE NULL
      END
    ),
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE storage_provider IS NULL
   OR upload_status IS NULL
   OR updated_at IS NULL
   OR (
     target_status IS NULL
     AND evidence_type IN ('submission', 'result')
   )
   OR (
     attached_status IS NULL
     AND evidence_type IN ('submission', 'result')
   );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contest_entry_evidence
    WHERE (storage_provider = 'legacy_url' AND NULLIF(btrim(public_url), '') IS NULL)
       OR (storage_provider = 'r2' AND NULLIF(btrim(object_key), '') IS NULL)
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: ditemukan bukti lomba tanpa sumber file yang valid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contest_entry_evidence
    WHERE object_key IS NOT NULL
    GROUP BY object_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: ditemukan object_key bukti lomba yang duplikat';
  END IF;
END;
$$;

ALTER TABLE public.contest_entry_evidence
  -- Compatibility defaults keep the still-deployed 048/050 RPCs functional.
  -- New upload reservations always write r2/pending explicitly.
  ALTER COLUMN storage_provider SET DEFAULT 'legacy_url',
  ALTER COLUMN storage_provider SET NOT NULL,
  ALTER COLUMN upload_status SET DEFAULT 'attached',
  ALTER COLUMN upload_status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.contest_entry_evidence
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_storage_provider_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_target_status_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_upload_status_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_attached_status_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_source_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_pending_metadata_check,
  DROP CONSTRAINT IF EXISTS contest_entry_evidence_attachment_check,
  ADD CONSTRAINT contest_entry_evidence_storage_provider_check
    CHECK (storage_provider IN ('legacy_url', 'r2')),
  ADD CONSTRAINT contest_entry_evidence_target_status_check
    CHECK (target_status IS NULL OR target_status IN ('sudah_terkirim', 'selesai')),
  ADD CONSTRAINT contest_entry_evidence_upload_status_check
    CHECK (upload_status IN ('pending', 'attached', 'abandoned')),
  ADD CONSTRAINT contest_entry_evidence_attached_status_check
    CHECK (attached_status IS NULL OR attached_status IN ('sudah_terkirim', 'selesai')),
  ADD CONSTRAINT contest_entry_evidence_source_check CHECK (
    (storage_provider = 'legacy_url' AND NULLIF(btrim(public_url), '') IS NOT NULL)
    OR
    (storage_provider = 'r2' AND NULLIF(btrim(object_key), '') IS NOT NULL)
  ),
  ADD CONSTRAINT contest_entry_evidence_pending_metadata_check CHECK (
    upload_status <> 'pending'
    OR (
      storage_provider = 'r2'
      AND target_status IN ('sudah_terkirim', 'selesai')
      AND mime_type IS NOT NULL
      AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND file_size_bytes IS NOT NULL
      AND file_size_bytes BETWEEN 1 AND 5242880
      AND length(btrim(COALESCE(original_filename, ''))) BETWEEN 1 AND 255
    )
  ),
  ADD CONSTRAINT contest_entry_evidence_attachment_check CHECK (
    upload_status <> 'attached'
    OR attached_status IS NOT DISTINCT FROM target_status
    OR (
      storage_provider = 'legacy_url'
      AND target_status IS NULL
      AND attached_status IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_contest_entry_evidence_object_key
  ON public.contest_entry_evidence (object_key)
  WHERE object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contest_entry_evidence_pending_cleanup
  ON public.contest_entry_evidence (created_at, id)
  WHERE upload_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_contest_entry_evidence_entry_target
  ON public.contest_entry_evidence (entry_id, target_status, upload_status, created_at DESC, id DESC);

-- One idempotency ledger is shared by ordinary pipeline transitions and the
-- final result transaction. response_payload preserves the original response.
CREATE TABLE IF NOT EXISTS public.contest_entry_pipeline_operations (
  idempotency_key TEXT PRIMARY KEY
    CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('transition', 'finalize')),
  target_status TEXT NOT NULL CHECK (target_status IN ('sudah_terkirim', 'menunggu_pengumuman', 'selesai')),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_entry_pipeline_operations_entry_created
  ON public.contest_entry_pipeline_operations (entry_id, created_at DESC);

-- Reserve evidence metadata before the backend issues a short-lived signed PUT
-- URL. Reusing an object key is accepted only for the identical entry/actor.
CREATE OR REPLACE FUNCTION public.reserve_contest_entry_evidence_atomic(
  p_entry_id UUID,
  p_target_status TEXT,
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
$$;

-- Only the next sequential status is accepted. Evidence is mandatory for
-- proses_submit -> sudah_terkirim and forbidden for the waiting transition.
CREATE OR REPLACE FUNCTION public.transition_contest_entry_pipeline_atomic(
  p_entry_id UUID,
  p_status TEXT,
  p_evidence_id UUID,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Finish the pipeline, outcome, structured results, evidence attachment, both
-- histories, and one canonical audit record in the same database transaction.
CREATE OR REPLACE FUNCTION public.finalize_contest_entry_atomic(
  p_entry_id UUID,
  p_outcome_status TEXT,
  p_results JSONB,
  p_evidence_id UUID,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.reserve_contest_entry_evidence_atomic(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_contest_entry_evidence_atomic(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, UUID
) TO service_role;

REVOKE ALL ON FUNCTION public.transition_contest_entry_pipeline_atomic(
  UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_contest_entry_pipeline_atomic(
  UUID, TEXT, UUID, TEXT, UUID, TEXT, UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_contest_entry_atomic(
  UUID, TEXT, JSONB, UUID, TEXT, UUID, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_contest_entry_atomic(
  UUID, TEXT, JSONB, UUID, TEXT, UUID, TEXT, UUID, UUID, TEXT
) TO service_role;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('053_contest_pipeline_evidence_contract.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
