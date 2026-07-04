
CREATE POLICY "own note files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own note files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own note files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own note files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
