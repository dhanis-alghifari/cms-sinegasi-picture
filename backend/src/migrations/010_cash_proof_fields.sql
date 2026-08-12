-- 010_cash_proof_fields.sql
-- Aligns cash transaction/dispute persistence with the frontend payloads.

ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS foto_bukti_url TEXT;
ALTER TABLE cash_disputes ADD COLUMN IF NOT EXISTS bukti_sanggahan_url TEXT;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_student ON cash_transactions(student_id);
