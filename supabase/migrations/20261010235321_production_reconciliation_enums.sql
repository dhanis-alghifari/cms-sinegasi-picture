-- REHEARSAL-ONLY CANDIDATE. No dev data, accounts or historical migration receipts.

DO $guard$ BEGIN
  IF current_database() NOT IN ('sinegasi_backup_restore', 'sinegasi_schema_fresh') THEN
    RAISE EXCEPTION 'ISOLATED_REHEARSAL_DATABASE_REQUIRED';
  END IF;
END $guard$;
SET LOCAL search_path = pg_catalog, public, extensions;
DO $enum$ BEGIN IF to_regtype('public."assignment_category"') IS NULL THEN
      CREATE TYPE public."assignment_category" AS ENUM ('class_task', 'crew_film', 'event_participation', 'other');
      END IF; END $enum$;
ALTER TYPE public."assignment_category" ADD VALUE IF NOT EXISTS 'class_task';
ALTER TYPE public."assignment_category" ADD VALUE IF NOT EXISTS 'crew_film';
ALTER TYPE public."assignment_category" ADD VALUE IF NOT EXISTS 'event_participation';
ALTER TYPE public."assignment_category" ADD VALUE IF NOT EXISTS 'other';
DO $enum$ BEGIN IF to_regtype('public."availability_status"') IS NULL THEN
      CREATE TYPE public."availability_status" AS ENUM ('tersedia', 'dipinjam', 'maintenance');
      END IF; END $enum$;
ALTER TYPE public."availability_status" ADD VALUE IF NOT EXISTS 'tersedia';
ALTER TYPE public."availability_status" ADD VALUE IF NOT EXISTS 'dipinjam';
ALTER TYPE public."availability_status" ADD VALUE IF NOT EXISTS 'maintenance';
DO $enum$ BEGIN IF to_regtype('public."contest_status"') IS NULL THEN
      CREATE TYPE public."contest_status" AS ENUM ('progres', 'selesai');
      END IF; END $enum$;
ALTER TYPE public."contest_status" ADD VALUE IF NOT EXISTS 'progres';
ALTER TYPE public."contest_status" ADD VALUE IF NOT EXISTS 'selesai';
DO $enum$ BEGIN IF to_regtype('public."grade_value"') IS NULL THEN
      CREATE TYPE public."grade_value" AS ENUM ('A', 'B', 'C', 'D', 'E');
      END IF; END $enum$;
ALTER TYPE public."grade_value" ADD VALUE IF NOT EXISTS 'A';
ALTER TYPE public."grade_value" ADD VALUE IF NOT EXISTS 'B';
ALTER TYPE public."grade_value" ADD VALUE IF NOT EXISTS 'C';
ALTER TYPE public."grade_value" ADD VALUE IF NOT EXISTS 'D';
ALTER TYPE public."grade_value" ADD VALUE IF NOT EXISTS 'E';
DO $enum$ BEGIN IF to_regtype('public."notification_type"') IS NULL THEN
      CREATE TYPE public."notification_type" AS ENUM ('attendance_correction', 'grade_posted', 'grade_correction', 'borrowing_approved', 'borrowing_rejected', 'borrowing_overdue', 'cash_deducted', 'cash_dispute_response', 'contest_assigned', 'system_alert', 'password_reset');
      END IF; END $enum$;
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'attendance_correction';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'grade_posted';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'grade_correction';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'borrowing_approved';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'borrowing_rejected';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'borrowing_overdue';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'cash_deducted';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'cash_dispute_response';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'contest_assigned';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'system_alert';
ALTER TYPE public."notification_type" ADD VALUE IF NOT EXISTS 'password_reset';
DO $enum$ BEGIN IF to_regtype('public."physical_condition"') IS NULL THEN
      CREATE TYPE public."physical_condition" AS ENUM ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang');
      END IF; END $enum$;
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'bagus';
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'sedikit_kerusakan';
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'rusak';
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'rusak_besar';
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'sedang_diperbaiki';
ALTER TYPE public."physical_condition" ADD VALUE IF NOT EXISTS 'hilang';
DO $enum$ BEGIN IF to_regtype('public."transaction_type"') IS NULL THEN
      CREATE TYPE public."transaction_type" AS ENUM ('iuran_wajib', 'pemasukan', 'pengeluaran', 'koreksi');
      END IF; END $enum$;
ALTER TYPE public."transaction_type" ADD VALUE IF NOT EXISTS 'iuran_wajib';
ALTER TYPE public."transaction_type" ADD VALUE IF NOT EXISTS 'pemasukan';
ALTER TYPE public."transaction_type" ADD VALUE IF NOT EXISTS 'pengeluaran';
ALTER TYPE public."transaction_type" ADD VALUE IF NOT EXISTS 'koreksi';
DO $enum$ BEGIN IF to_regtype('public."user_role"') IS NULL THEN
      CREATE TYPE public."user_role" AS ENUM ('teacher', 'leader', 'vice_leader', 'treasurer', 'secretary', 'equipment_team', 'contest_team', 'member', 'social_media_team');
      END IF; END $enum$;
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'leader';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'vice_leader';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'treasurer';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'equipment_team';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'contest_team';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'member';
ALTER TYPE public."user_role" ADD VALUE IF NOT EXISTS 'social_media_team';
