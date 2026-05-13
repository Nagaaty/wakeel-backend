-- ─── Wakeel — Migration 004: 4-type pricing + office coordinates ─────────────
-- 1) Removes 'phone' from the default service_types array (now 4 types only:
--    video, text, inperson, document)
-- 2) Updates the resolve_lawyer_services() function to match
-- 3) Adds office_lat / office_lng columns for the map preview feature
-- 4) Backfills existing rows: replaces 'phone' with nothing, leaves other
--    types intact. Existing 'phone' bookings keep working (CHECK constraint
--    still allows the value, it just isn't offered going forward).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Update lawyer_service_defaults: remove 'phone' wherever it appears.
UPDATE lawyer_service_defaults
   SET service_types = (
     SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
     FROM jsonb_array_elements_text(service_types) AS t
     WHERE t::text NOT IN ('"phone"', '"voice"')
   )
 WHERE service_types ?| array['phone','voice'];

-- Update the column default for any future inserts.
ALTER TABLE lawyer_service_defaults
  ALTER COLUMN service_types
  SET DEFAULT '["video","text","inperson","document"]'::jsonb;

-- 2) Update lawyer_schedule_overrides: same cleanup for service_types overrides.
UPDATE lawyer_schedule_overrides
   SET service_types = (
     SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
     FROM jsonb_array_elements_text(service_types) AS t
     WHERE t::text NOT IN ('"phone"', '"voice"')
   )
 WHERE service_types IS NOT NULL
   AND service_types ?| array['phone','voice'];

-- 3) Update the resolver function to use the new 4-type default.
CREATE OR REPLACE FUNCTION resolve_lawyer_services(
  p_lawyer_id UUID,
  p_date      DATE
) RETURNS JSONB AS $$
DECLARE
  v_override JSONB;
  v_default  JSONB;
  v_dow      INTEGER;
BEGIN
  SELECT service_types INTO v_override
    FROM lawyer_schedule_overrides
   WHERE lawyer_id = p_lawyer_id
     AND override_date = p_date
   LIMIT 1;
  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  v_dow := EXTRACT(DOW FROM p_date)::INTEGER;
  SELECT service_types INTO v_default
    FROM lawyer_service_defaults
   WHERE lawyer_id = p_lawyer_id
     AND day_of_week = v_dow
   LIMIT 1;
  IF v_default IS NOT NULL THEN
    RETURN v_default;
  END IF;

  -- Fallback for lawyers who never configured anything: 4 types only
  RETURN '["video","text","inperson","document"]'::jsonb;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4) Office coordinates for the map preview on lawyer profile + find-lawyer.
-- The 'office' TEXT column already exists (address as text). We add lat/lng.
ALTER TABLE lawyer_profiles
  ADD COLUMN IF NOT EXISTS office_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS office_lng NUMERIC(10, 7);

-- 5) Clean phone out of any existing service_prices JSONB.
-- We don't drop the JSONB key because that requires plpgsql gymnastics — the
-- frontend already ignores 'phone' after this migration. But we do
-- migrate any legacy 'voice' → nothing too (we already had this from chunk 2).
-- Lawyers re-saving their prices on the new edit-profile screen will fully
-- normalize their data.
