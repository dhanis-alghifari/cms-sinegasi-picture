-- 021_auth_session_hardening.sql
-- Canonical first-login state and password-reset session invalidation.
-- Additive and safe to re-run.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_version INTEGER;

ALTER TABLE public.users
  ALTER COLUMN auth_version SET DEFAULT 1;

-- Existing databases may have an audit trigger that requires an explicit
-- system reason for maintenance updates. This backfill is scoped to NULL rows
-- only and never changes password or business data.
SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'Inisialisasi versi keamanan sesi akun', true);

UPDATE public.users
SET auth_version = 1
WHERE auth_version IS NULL;

ALTER TABLE public.users
  ALTER COLUMN auth_version SET NOT NULL;

COMMENT ON COLUMN public.users.auth_version IS
  'Naik setiap reset/ganti password untuk membatalkan JWT lama.';

NOTIFY pgrst, 'reload schema';
