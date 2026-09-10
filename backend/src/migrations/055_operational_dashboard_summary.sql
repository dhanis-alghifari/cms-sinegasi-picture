-- 055_operational_dashboard_summary.sql
-- Operational dashboard read model for teacher-facing summary data.
-- Expand-only: adds one stable, read-only RPC without altering existing tables.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_055_OPERATIONAL_DASHBOARD_SUMMARY', true);

DO $$
BEGIN
  IF to_regclass('public.students') IS NULL
     OR to_regclass('public.attendance') IS NULL
     OR to_regclass('public.cash_transactions') IS NULL
     OR to_regclass('public.equipment') IS NULL
     OR to_regclass('public.borrowings') IS NULL
     OR to_regclass('public.grades') IS NULL THEN
    RAISE EXCEPTION 'DASHBOARD_SCHEMA_MISSING: tabel operasional belum tersedia';
  END IF;
  IF to_regclass('public.contest_migration_history') IS NULL THEN
    RAISE EXCEPTION 'DASHBOARD_MIGRATION_HISTORY_MISSING: tabel migration history belum tersedia';
  END IF;
  IF to_regprocedure('public.get_cash_summary(uuid)') IS NULL THEN
    RAISE EXCEPTION 'DASHBOARD_CASH_SUMMARY_MISSING: jalankan migration cash accounting terlebih dahulu';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operational_dashboard_summary(
  p_report_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH report_window AS (
    SELECT
      COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE) AS report_date,
      date_trunc('month', COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE)::TIMESTAMP)::DATE AS month_start,
      (date_trunc('month', COALESCE(p_report_date, (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE)::TIMESTAMP) + INTERVAL '1 month')::DATE AS next_month_start
  ),
  student_summary AS (
    SELECT COUNT(*) FILTER (WHERE s.is_active IS TRUE)::INTEGER AS total_students
    FROM public.students AS s
  ),
  attendance_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE a.status = 'hadir')::INTEGER AS hadir,
      COUNT(*) FILTER (WHERE a.status = 'sakit')::INTEGER AS sakit,
      COUNT(*) FILTER (WHERE a.status = 'izin')::INTEGER AS izin,
      COUNT(*) FILTER (WHERE a.status = 'alpha')::INTEGER AS alpha,
      COUNT(*)::INTEGER AS total_recorded
    FROM public.attendance AS a
    CROSS JOIN report_window AS reporting
    WHERE a.tanggal = reporting.report_date
  ),
  cash_totals AS (
    SELECT COALESCE((summary.data->>'saldoUtama')::NUMERIC, 0)::NUMERIC AS balance
    FROM (SELECT public.get_cash_summary(NULL::UUID) AS data) AS summary
  ),
  monthly_cash AS (
    SELECT
      COALESCE(SUM(CASE WHEN NOT COALESCE(ct.is_billing, FALSE) AND ct.type::TEXT <> 'pengeluaran' THEN COALESCE(ct.nominal, 0) ELSE 0 END), 0)::NUMERIC AS monthly_income,
      COALESCE(SUM(CASE WHEN NOT COALESCE(ct.is_billing, FALSE) AND ct.type::TEXT = 'pengeluaran' THEN COALESCE(ct.nominal, 0) ELSE 0 END), 0)::NUMERIC AS monthly_expense
    FROM public.cash_transactions AS ct
    CROSS JOIN report_window AS reporting
    WHERE ct.tanggal >= reporting.month_start AND ct.tanggal < reporting.next_month_start
  ),
  recent_cash AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', recent.id::TEXT,
          'tipe', CASE WHEN recent.transaction_type = 'pengeluaran' THEN 'keluar' ELSE 'masuk' END,
          'jumlah', recent.nominal,
          'keterangan', recent.keterangan,
          'tanggal', recent.transaction_date::TEXT,
          'studentNama', recent.student_name
        )
        ORDER BY recent.transaction_date DESC NULLS LAST, recent.created_at DESC, recent.id DESC
      ),
      '[]'::JSONB
    ) AS transactions
    FROM (
      SELECT
        ct.id,
        ct.type::TEXT AS transaction_type,
        COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
        COALESCE(NULLIF(BTRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan,
        COALESCE(ct.tanggal, ct.created_at::DATE) AS transaction_date,
        ct.created_at,
        s.nama AS student_name
      FROM public.cash_transactions AS ct
      LEFT JOIN public.students AS s ON s.id = ct.student_id
      WHERE NOT COALESCE(ct.is_billing, FALSE)
      ORDER BY ct.tanggal DESC NULLS LAST, ct.created_at DESC, ct.id DESC
      LIMIT 3
    ) AS recent
  ),
  equipment_summary AS (
    SELECT
      COUNT(*)::INTEGER AS total_equipment,
      COUNT(*) FILTER (WHERE e.status = 'tersedia')::INTEGER AS available_equipment,
      COUNT(*) FILTER (WHERE e.status = 'dipinjam')::INTEGER AS borrowed_equipment,
      COUNT(*) FILTER (WHERE e.status = 'maintenance')::INTEGER AS maintenance_equipment,
      COUNT(*) FILTER (WHERE e.kondisi IN ('rusak', 'rusak_besar'))::INTEGER AS damaged_equipment
    FROM public.equipment AS e
  ),
  overdue_borrowings AS (
    SELECT COUNT(*)::INTEGER AS overdue_count
    FROM public.borrowings AS b
    WHERE b.status = 'borrowed' AND b.due_at IS NOT NULL AND b.due_at < NOW()
  ),
  latest_graded_student AS (
    SELECT DISTINCT ON (g.student_id) g.student_id, g.nilai::TEXT AS grade
    FROM public.grades AS g
    WHERE g.status = 'graded' AND g.nilai IS NOT NULL
    ORDER BY g.student_id, g.updated_at DESC NULLS LAST, g.id DESC
  ),
  grade_summary AS (
    SELECT
      COUNT(*)::INTEGER AS evaluated_students,
      COUNT(*) FILTER (WHERE latest.grade = 'A')::INTEGER AS grade_a,
      COUNT(*) FILTER (WHERE latest.grade = 'B')::INTEGER AS grade_b,
      COUNT(*) FILTER (WHERE latest.grade = 'C')::INTEGER AS grade_c,
      COUNT(*) FILTER (WHERE latest.grade = 'D')::INTEGER AS grade_d,
      COUNT(*) FILTER (WHERE latest.grade = 'E')::INTEGER AS grade_e
    FROM latest_graded_student AS latest
  )
  SELECT jsonb_build_object(
    'reportDate', reporting.report_date,
    'timezone', 'Asia/Jakarta',
    'kas', jsonb_build_object(
      'saldoTerakhir', cash.balance,
      'pemasukanBulanIni', monthly.monthly_income,
      'pengeluaranBulanIni', monthly.monthly_expense,
      'transaksiTerbaru', recent.transactions
    ),
    'absensi', jsonb_build_object(
      'hadir', attendance.hadir,
      'sakit', attendance.sakit,
      'izin', attendance.izin,
      'alpha', attendance.alpha,
      'totalSiswa', students.total_students,
      'totalTercatat', attendance.total_recorded,
      'persentaseHadir', CASE WHEN attendance.total_recorded = 0 THEN 0 ELSE ROUND((attendance.hadir::NUMERIC / attendance.total_recorded::NUMERIC) * 100, 2) END
    ),
    'alat', jsonb_build_object(
      'tersedia', equipment.available_equipment,
      'dipinjam', equipment.borrowed_equipment,
      'maintenance', equipment.maintenance_equipment,
      'rusak', equipment.damaged_equipment,
      'totalAlat', equipment.total_equipment,
      'overdueCount', overdue.overdue_count
    ),
    'gradeDistribution', jsonb_build_object(
      'totalSiswaEvaluated', grades.evaluated_students,
      'distribution', jsonb_build_object('A', grades.grade_a, 'B', grades.grade_b, 'C', grades.grade_c, 'D', grades.grade_d, 'E', grades.grade_e)
    )
  )
  FROM report_window AS reporting
  CROSS JOIN student_summary AS students
  CROSS JOIN attendance_summary AS attendance
  CROSS JOIN cash_totals AS cash
  CROSS JOIN monthly_cash AS monthly
  CROSS JOIN recent_cash AS recent
  CROSS JOIN equipment_summary AS equipment
  CROSS JOIN overdue_borrowings AS overdue
  CROSS JOIN grade_summary AS grades;
$$;

REVOKE ALL ON FUNCTION public.get_operational_dashboard_summary(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_dashboard_summary(DATE) TO service_role;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('055_operational_dashboard_summary.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
