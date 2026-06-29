
CREATE TABLE public.recurring_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_time TIME,
  end_time TIME,
  repeat_type TEXT NOT NULL DEFAULT 'daily',
  repeat_days INTEGER[] NOT NULL DEFAULT '{}',
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  position INTEGER NOT NULL DEFAULT 0,
  reminder_minutes_before INTEGER,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_tasks TO authenticated;
GRANT ALL ON public.recurring_tasks TO service_role;

ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recurring tasks"
  ON public.recurring_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_tasks_updated
  BEFORE UPDATE ON public.recurring_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX recurring_tasks_user_idx ON public.recurring_tasks(user_id, starts_on);

CREATE TABLE public.recurring_task_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_task_id UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  skipped BOOLEAN NOT NULL DEFAULT false,
  override_title TEXT,
  override_start_time TIME,
  override_end_time TIME,
  override_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurring_task_id, occurrence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_task_logs TO authenticated;
GRANT ALL ON public.recurring_task_logs TO service_role;

ALTER TABLE public.recurring_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recurring task logs"
  ON public.recurring_task_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_task_logs_updated
  BEFORE UPDATE ON public.recurring_task_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX recurring_task_logs_lookup_idx ON public.recurring_task_logs(user_id, occurrence_date);
