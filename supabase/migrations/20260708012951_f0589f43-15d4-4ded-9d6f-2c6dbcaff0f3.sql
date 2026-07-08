-- Storage RLS policies
-- hospital-media: branding/backgrounds readable by everyone (signed URLs), managed by admins
CREATE POLICY "Anyone can read hospital media files" ON storage.objects FOR SELECT USING (bucket_id = 'hospital-media');
CREATE POLICY "Admins upload hospital media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hospital-media' AND (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin')));
CREATE POLICY "Admins update hospital media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hospital-media' AND (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin')));
CREATE POLICY "Admins delete hospital media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hospital-media' AND (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin')));

-- patient-files: staff only (doctor rooms and patients go through server functions)
CREATE POLICY "Staff read patient files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload patient files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete patient files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));

-- payment-proofs: staff read/review; patient uploads happen via secure server functions
CREATE POLICY "Staff read payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.is_staff(auth.uid()));

-- chat-files: web admin and hospital admin conversation attachments
CREATE POLICY "Admins read chat files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files' AND (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin')));
CREATE POLICY "Admins upload chat files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files' AND (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin')));