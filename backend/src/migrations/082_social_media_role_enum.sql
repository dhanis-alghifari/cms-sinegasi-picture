-- 082_social_media_role_enum.sql
-- Keep ALTER TYPE isolated: PostgreSQL cannot use a new enum value before the
-- transaction that adds it commits.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'social_media_team';
