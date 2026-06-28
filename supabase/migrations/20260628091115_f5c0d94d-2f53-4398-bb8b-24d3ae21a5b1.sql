DO $$ BEGIN
  CREATE TYPE public.habit_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS difficulty public.habit_difficulty NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS target_per_week SMALLINT NOT NULL DEFAULT 7 CHECK (target_per_week BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS reminder_time TIME,
  ADD COLUMN IF NOT EXISTS icon TEXT;