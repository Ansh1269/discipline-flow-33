ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_streaks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_xp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_focus boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_achievements boolean NOT NULL DEFAULT true;