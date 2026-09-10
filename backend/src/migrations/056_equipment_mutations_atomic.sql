-- 056_equipment_mutations_atomic.sql
-- Atomic equipment mutations with auditable Zero Silent Edits context.
-- Apply after the equipment schema and audit hardening migrations.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.equipment') IS NULL THEN
    RAISE EXCEPTION 'EQUIPMENT_SCHEMA_BASE_MISSING: public.equipment belum tersedia';
  END IF;
  IF to_regtype('public.physical_condition') IS NULL
     OR to_regtype('public.availability_status') IS NULL THEN
    RAISE EXCEPTION 'EQUIPMENT_LEGACY_ENUM_MISSING: enum peralatan belum tersedia';
  END IF;
  IF to_regprocedure(
    'public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'AUDIT_HELPER_MISSING: public.write_audit_log belum tersedia';
  END IF;
END;
$$;

-- One transaction owns validation, row locking, the equipment mutation, and
-- the canonical audit record. The legacy AFTER UPDATE trigger is suppressed
-- only inside this audited transaction.
CREATE OR REPLACE FUNCTION public.update_equipment_atomic(
  p_equipment_id UUID,
  p_changes JSONB,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS SETOF public.equipment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.update_equipment_condition_atomic(
  p_equipment_id UUID,
  p_kondisi TEXT,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_status TEXT DEFAULT NULL,
  p_catatan_kerusakan TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS SETOF public.equipment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.delete_equipment_atomic(
  p_equipment_id UUID,
  p_deleted_by UUID,
  p_change_reason TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.update_equipment_atomic(
  UUID, JSONB, UUID, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_equipment_atomic(
  UUID, JSONB, UUID, TEXT, UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.update_equipment_condition_atomic(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_equipment_condition_atomic(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.delete_equipment_atomic(
  UUID, UUID, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_equipment_atomic(
  UUID, UUID, TEXT, UUID, UUID, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

