-- ─── Wakeel — Migration 003: Per-Service-Type Availability ───────────────────
-- Adds two layers of "is this consultation type accepted today?" control:
--   1) lawyer_service_defaults  — weekly defaults, like the existing weekly
--      lawyer_availability table but for service types.
--   2) service_types JSONB on lawyer_schedule_overrides — per-date overrides,
--      e.g. "on 2026-04-30 don't accept video calls".
--
-- Booking validation joins these tables so a booking can ONLY be created
-- with a type the lawyer has marked enabled for that date.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Widen the bookings.type CHECK to include the 4 service types the
--    mobile app actually offers (text/video/inperson/document) plus PHONE
--    for legacy data.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_type_check
  CHECK (type IN ('VIDEO','CHAT','PHONE','INPERSON','DOCUMENT','TEXT'));

-- 2) Per-weekday default of which service types the lawyer accepts.
--    One row per (lawyer, weekday). service_types is a JSONB array of strings.
--    Example row: lawyer_id=…, day_of_week=1, service_types=["video","text"]
CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
  lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  service_types JSONB NOT NULL DEFAULT '["video","text","phone","inperson","document"]'::jsonb,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lawyer_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_service_defaults_lawyer ON lawyer_service_defaults(lawyer_id);

-- 3) Per-date override for service types — sits next to the existing
--    is_off / slots overrides on lawyer_schedule_overrides.
--    NULL means "use the weekly default".
ALTER TABLE lawyer_schedule_overrides
  ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT NULL;

-- 4) Helper view used by the booking validator and the public availability
--    endpoint. Resolves a date's effective service types as either the
--    override value (if non-null) or the weekly default (if any).
--    Default-when-no-row-exists falls through to "all 5 types accepted".
CREATE OR REPLACE FUNCTION resolve_lawyer_services(
  p_lawyer_id UUID,
  p_date      DATE
) RETURNS JSONB AS $$
DECLARE
  v_override   JSONB;
  v_default    JSONB;
  v_dow        INTEGER;
BEGIN
  -- Per-date override wins
  SELECT service_types INTO v_override
    FROM lawyer_schedule_overrides
   WHERE lawyer_id = p_lawyer_id
     AND override_date = p_date
   LIMIT 1;
  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  -- Weekly default for this day-of-week
  v_dow := EXTRACT(DOW FROM p_date)::INTEGER;
  SELECT service_types INTO v_default
    FROM lawyer_service_defaults
   WHERE lawyer_id = p_lawyer_id
     AND day_of_week = v_dow
   LIMIT 1;
  IF v_default IS NOT NULL THEN
    RETURN v_default;
  END IF;

  -- Nothing configured — accept everything (matches pre-migration behavior)
  RETURN '["video","text","phone","inperson","document"]'::jsonb;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5) Backfill: for any existing lawyer with a saved weekly schedule, mark all
--    five service types as enabled on every weekday they work. This keeps
--    behavior identical for lawyers who already onboarded before this feature.
INSERT INTO lawyer_service_defaults (lawyer_id, day_of_week, service_types)
SELECT DISTINCT
  la.lawyer_id,
  la.day_of_week,
  '["video","text","phone","inperson","document"]'::jsonb
FROM lawyer_availability la
ON CONFLICT (lawyer_id, day_of_week) DO NOTHING;
