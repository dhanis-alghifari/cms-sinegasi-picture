BEGIN;

-- Migration bookkeeping is never a public API resource. RLS stays deny by
-- default for PostgREST roles while the trusted migration runner (table owner)
-- keeps access to record migration state.
ALTER TABLE public.cash_migration_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cash_migration_history FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
