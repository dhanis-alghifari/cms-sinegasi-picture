-- 033_classes_query_hardening.sql
-- Additive indexes for public class options and teacher-only class management.
-- Apply after 025_security_privileges_hardening.sql.

-- Management pages sort by class name/id and may filter by level/status.
CREATE INDEX IF NOT EXISTS idx_classes_name_id
  ON public.classes (nama_kelas ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_classes_status_level_name_id
  ON public.classes (is_active, tingkat, nama_kelas ASC, id ASC);

-- The list endpoint uses a bounded contains-search over nama_kelas. The
-- trigram index keeps that compatibility contract index-assisted as the
-- master table grows beyond the seeded class set.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_classes_nama_kelas_trgm
  ON public.classes USING gin (nama_kelas gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
