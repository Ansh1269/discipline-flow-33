
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS last_fired_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ics_token TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes_rich BOOLEAN NOT NULL DEFAULT true;
UPDATE public.profiles SET ics_token = encode(gen_random_bytes(18), 'hex') WHERE ics_token IS NULL;
CREATE INDEX IF NOT EXISTS profiles_ics_token_idx ON public.profiles(ics_token);
