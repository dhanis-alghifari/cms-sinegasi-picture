-- 019_student_account_provisioning.sql
-- Provisioning akun siswa, relasi siswa-akun yang unik, dan lifecycle alumni.
-- Migration ini aman dijalankan ulang dan tidak menghapus data.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.users
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

UPDATE public.students
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user_id
  ON public.students (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_active_created_at
  ON public.students (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_active_role_created_at
  ON public.users (is_active, role, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_student_with_account_atomic(
  p_nis TEXT,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_username TEXT,
  p_password_hash TEXT,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.provision_student_account_atomic(
  p_student_id UUID,
  p_username TEXT,
  p_password_hash TEXT,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.set_student_account_status_atomic(
  p_student_id UUID,
  p_is_active BOOLEAN,
  p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.update_student_profile_atomic(
  p_student_id UUID,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_student_account_atomic(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_student_account_status_atomic(UUID, BOOLEAN, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_student_profile_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_student_account_atomic(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_student_account_status_atomic(UUID, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_student_profile_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
