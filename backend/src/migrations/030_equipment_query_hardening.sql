-- 030_equipment_query_hardening.sql
-- Additive hardening for the extracted equipment catalog module.
-- Apply after 009_equipment_catalog_fields.sql and 017_audit_trail_hardening.sql.

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS catatan_kerusakan TEXT;

-- The list endpoint always sorts by created_at/id and optionally filters by
-- one catalog dimension. These indexes keep the bounded range query stable as
-- the catalog grows; verify plans on representative staging data before
-- production rollout.
CREATE INDEX IF NOT EXISTS idx_equipment_created_at_id
  ON public.equipment (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_status_created_at_id
  ON public.equipment (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_kondisi_created_at_id
  ON public.equipment (kondisi, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_kategori_created_at_id
  ON public.equipment (kategori, created_at DESC, id DESC);

-- The API sanitizes the search term before it reaches PostgREST. Trigram
-- indexes avoid a full table scan for the existing contains-search contract.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_equipment_nama_alat_trgm
  ON public.equipment USING gin (nama_alat gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_equipment_kode_alat_trgm
  ON public.equipment USING gin (kode_alat gin_trgm_ops);

-- Reservation lookups are bounded by the current page's equipment ids and
-- active borrowing statuses, so the index supports both the join key and the
-- state predicate without loading the borrowing table into Node.js.
CREATE INDEX IF NOT EXISTS idx_borrowing_items_equipment_status
  ON public.borrowing_items (equipment_id, status);

NOTIFY pgrst, 'reload schema';
