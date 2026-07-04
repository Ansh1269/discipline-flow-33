
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  mood TEXT,
  weather TEXT,
  energy_level SMALLINT CHECK (energy_level BETWEEN 1 AND 5),
  productivity_rating SMALLINT CHECK (productivity_rating BETWEEN 1 AND 5),
  accomplishments TEXT,
  biggest_achievement TEXT,
  challenges TEXT,
  lessons TEXT,
  gratitude TEXT,
  improvements TEXT,
  reflections TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own journal entries"
  ON public.journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX journal_entries_user_date_idx ON public.journal_entries (user_id, entry_date DESC, entry_time DESC);
CREATE INDEX journal_entries_user_favorite_idx ON public.journal_entries (user_id) WHERE is_favorite;
CREATE INDEX journal_entries_tags_idx ON public.journal_entries USING GIN (tags);

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
