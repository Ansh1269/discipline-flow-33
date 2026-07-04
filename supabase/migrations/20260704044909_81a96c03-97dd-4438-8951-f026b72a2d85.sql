
CREATE TABLE public.note_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.note_folders(id) ON DELETE CASCADE,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_folders TO authenticated;
GRANT ALL ON public.note_folders TO service_role;
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folders" ON public.note_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_note_folders_updated_at BEFORE UPDATE ON public.note_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'quick',
  folder_id uuid REFERENCES public.note_folders(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  color text,
  is_favorite boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX notes_user_updated_idx ON public.notes(user_id, updated_at DESC);
CREATE INDEX notes_user_folder_idx ON public.notes(user_id, folder_id);
