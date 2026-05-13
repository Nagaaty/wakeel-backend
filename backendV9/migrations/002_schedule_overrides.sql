CREATE TABLE IF NOT EXISTS lawyer_schedule_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_off        BOOLEAN DEFAULT true,
  slots         JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lawyer_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_override_lawyer_date ON lawyer_schedule_overrides(lawyer_id, override_date);
