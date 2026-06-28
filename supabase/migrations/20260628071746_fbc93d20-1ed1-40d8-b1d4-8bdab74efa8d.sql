
DROP POLICY IF EXISTS "Users manage own action plans" ON public.action_plans;
CREATE POLICY "Users manage own action plans" ON public.action_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own reminders" ON public.reminders;
CREATE POLICY "Users manage their own reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own task attachments" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
