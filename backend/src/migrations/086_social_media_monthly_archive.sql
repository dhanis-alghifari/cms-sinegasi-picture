ALTER TABLE public.social_insight_periods
  ADD COLUMN IF NOT EXISTS archive_month DATE,
  ADD COLUMN IF NOT EXISTS likes BIGINT CHECK (likes IS NULL OR likes >= 0),
  ADD COLUMN IF NOT EXISTS comments BIGINT CHECK (comments IS NULL OR comments >= 0),
  ADD COLUMN IF NOT EXISTS shares BIGINT CHECK (shares IS NULL OR shares >= 0),
  ADD COLUMN IF NOT EXISTS saves BIGINT CHECK (saves IS NULL OR saves >= 0),
  ADD COLUMN IF NOT EXISTS watch_time_minutes BIGINT CHECK (watch_time_minutes IS NULL OR watch_time_minutes >= 0),
  ADD COLUMN IF NOT EXISTS subscribers_gained BIGINT CHECK (subscribers_gained IS NULL OR subscribers_gained >= 0),
  ADD COLUMN IF NOT EXISTS subscribers_lost BIGINT CHECK (subscribers_lost IS NULL OR subscribers_lost >= 0),
  ADD COLUMN IF NOT EXISTS impressions BIGINT CHECK (impressions IS NULL OR impressions >= 0),
  ADD COLUMN IF NOT EXISTS followers_gained BIGINT CHECK (followers_gained IS NULL OR followers_gained >= 0),
  ADD COLUMN IF NOT EXISTS followers_lost BIGINT CHECK (followers_lost IS NULL OR followers_lost >= 0),
  ADD COLUMN IF NOT EXISTS reactions BIGINT CHECK (reactions IS NULL OR reactions >= 0),
  ADD COLUMN IF NOT EXISTS poll_votes BIGINT CHECK (poll_votes IS NULL OR poll_votes >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_insight_periods'::regclass
      AND conname = 'social_insight_archive_month_first_day'
  ) THEN
    ALTER TABLE public.social_insight_periods
      ADD CONSTRAINT social_insight_archive_month_first_day
      CHECK (archive_month IS NULL OR archive_month = date_trunc('month', archive_month)::DATE);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_insight_archive_account_month
  ON public.social_insight_periods (social_account_id, archive_month)
  WHERE archive_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_insight_archive_month
  ON public.social_insight_periods (archive_month DESC, social_account_id)
  WHERE archive_month IS NOT NULL AND status <> 'archived';

CREATE OR REPLACE FUNCTION public.guard_social_insight_recorded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_platform TEXT;
  v_expected_end DATE;
  v_expected_start DATE;
  v_metric_count INTEGER;
  v_evidence_count INTEGER;
BEGIN
  IF NEW.archive_month IS NOT NULL THEN
    SELECT platform INTO v_platform
    FROM public.social_accounts
    WHERE id = NEW.social_account_id;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ACCOUNT_NOT_FOUND';
    END IF;

    v_expected_end := (NEW.archive_month + INTERVAL '1 month - 1 day')::DATE;
    v_expected_start := CASE
      WHEN v_platform = 'whatsapp' THEN v_expected_end - 29
      ELSE NEW.archive_month
    END;

    IF NEW.archive_month >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
       OR NEW.period_start IS DISTINCT FROM v_expected_start
       OR NEW.period_end IS DISTINCT FROM v_expected_end THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_PERIOD_INVALID';
    END IF;

    IF NEW.interactions IS NOT NULL OR NEW.published_count IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_LEGACY_METRIC_INVALID';
    END IF;

    v_metric_count := CASE v_platform
      WHEN 'instagram' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.reach IS NOT NULL)::INTEGER
        + (NEW.profile_visits IS NOT NULL)::INTEGER + (NEW.likes IS NOT NULL)::INTEGER
        + (NEW.comments IS NOT NULL)::INTEGER + (NEW.shares IS NOT NULL)::INTEGER
        + (NEW.saves IS NOT NULL)::INTEGER
      WHEN 'tiktok' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.profile_visits IS NOT NULL)::INTEGER
        + (NEW.likes IS NOT NULL)::INTEGER + (NEW.comments IS NOT NULL)::INTEGER
        + (NEW.shares IS NOT NULL)::INTEGER + (NEW.followers_gained IS NOT NULL)::INTEGER
      WHEN 'youtube' THEN
        (NEW.views IS NOT NULL)::INTEGER + (NEW.watch_time_minutes IS NOT NULL)::INTEGER
        + (NEW.subscribers_gained IS NOT NULL)::INTEGER + (NEW.subscribers_lost IS NOT NULL)::INTEGER
        + (NEW.impressions IS NOT NULL)::INTEGER
      WHEN 'whatsapp' THEN
        (NEW.reach IS NOT NULL)::INTEGER + (NEW.followers_gained IS NOT NULL)::INTEGER
        + (NEW.followers_lost IS NOT NULL)::INTEGER + (NEW.reactions IS NOT NULL)::INTEGER
        + (NEW.poll_votes IS NOT NULL)::INTEGER
      ELSE 0
    END;

    IF v_metric_count = 0
       OR (v_platform NOT IN ('instagram', 'whatsapp') AND NEW.reach IS NOT NULL)
       OR (v_platform <> 'instagram' AND NEW.saves IS NOT NULL)
       OR (v_platform = 'whatsapp' AND NEW.views IS NOT NULL)
       OR (v_platform NOT IN ('instagram', 'tiktok') AND (NEW.profile_visits IS NOT NULL OR NEW.likes IS NOT NULL OR NEW.comments IS NOT NULL OR NEW.shares IS NOT NULL))
       OR (v_platform <> 'youtube' AND (NEW.watch_time_minutes IS NOT NULL OR NEW.subscribers_gained IS NOT NULL OR NEW.subscribers_lost IS NOT NULL OR NEW.impressions IS NOT NULL))
       OR (v_platform NOT IN ('tiktok', 'whatsapp') AND (NEW.followers_gained IS NOT NULL OR NEW.followers_lost IS NOT NULL))
       OR (v_platform <> 'whatsapp' AND (NEW.reactions IS NOT NULL OR NEW.poll_votes IS NOT NULL)) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ARCHIVE_METRICS_INVALID';
    END IF;
  END IF;

  IF NEW.status = 'recorded' THEN
    SELECT count(*) INTO v_evidence_count
    FROM public.social_media_evidence
    WHERE insight_period_id = NEW.id AND upload_status = 'attached';
    IF v_evidence_count < 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_INSIGHT_EVIDENCE_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_social_insight_recorded ON public.social_insight_periods;
CREATE TRIGGER trg_guard_social_insight_recorded
  BEFORE INSERT OR UPDATE OF social_account_id, archive_month, period_start, period_end, status,
    views, reach, interactions, profile_visits, published_count, likes, comments, shares, saves,
    watch_time_minutes, subscribers_gained, subscribers_lost, impressions, followers_gained,
    followers_lost, reactions, poll_votes
  ON public.social_insight_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_social_insight_recorded();

REVOKE ALL ON FUNCTION public.guard_social_insight_recorded() FROM PUBLIC, anon, authenticated;
