
-- 1. Private schema for role helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('web_admin','hospital_admin','manager')) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

-- 2. Recreate every policy that referenced public.has_role / public.is_staff, using the private versions

-- profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR private.is_staff(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'web_admin'::public.app_role));

-- authorized_emails
DROP POLICY IF EXISTS "Admins manage authorized emails" ON public.authorized_emails;
CREATE POLICY "Admins manage authorized emails" ON public.authorized_emails FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- hospitals: drop old public read, restrict to authenticated
DROP POLICY IF EXISTS "Anyone can read hospital branding" ON public.hospitals;
DROP POLICY IF EXISTS "Web admin inserts hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins update hospitals" ON public.hospitals;
CREATE POLICY "Authenticated read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Web admin inserts hospitals" ON public.hospitals FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(),'web_admin'::public.app_role));
CREATE POLICY "Admins update hospitals" ON public.hospitals FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- payments
DROP POLICY IF EXISTS "Staff insert payments" ON public.payments;
DROP POLICY IF EXISTS "Staff update payments" ON public.payments;
DROP POLICY IF EXISTS "Staff read payments" ON public.payments;
CREATE POLICY "Staff insert payments" ON public.payments FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update payments" ON public.payments FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()));

-- hospital_media: drop public read, restrict to authenticated
DROP POLICY IF EXISTS "Anyone reads hospital media" ON public.hospital_media;
DROP POLICY IF EXISTS "Admins manage hospital media" ON public.hospital_media;
CREATE POLICY "Authenticated read hospital media" ON public.hospital_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage hospital media" ON public.hospital_media FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- hospital_time: drop public read, restrict to authenticated
DROP POLICY IF EXISTS "Anyone reads hospital time" ON public.hospital_time;
DROP POLICY IF EXISTS "Staff set hospital time" ON public.hospital_time;
CREATE POLICY "Authenticated read hospital time" ON public.hospital_time FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff set hospital time" ON public.hospital_time FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- rooms
DROP POLICY IF EXISTS "Staff read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admins manage rooms" ON public.rooms;
CREATE POLICY "Staff read rooms" ON public.rooms FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Admins manage rooms" ON public.rooms FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- patients
DROP POLICY IF EXISTS "Staff manage patients" ON public.patients;
CREATE POLICY "Staff manage patients" ON public.patients FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- patient_cases
DROP POLICY IF EXISTS "Staff manage cases" ON public.patient_cases;
CREATE POLICY "Staff manage cases" ON public.patient_cases FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- case_attachments
DROP POLICY IF EXISTS "Staff manage attachments" ON public.case_attachments;
CREATE POLICY "Staff manage attachments" ON public.case_attachments FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- checkups
DROP POLICY IF EXISTS "Staff manage checkups" ON public.checkups;
CREATE POLICY "Staff manage checkups" ON public.checkups FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- room_queue
DROP POLICY IF EXISTS "Staff manage queue" ON public.room_queue;
CREATE POLICY "Staff manage queue" ON public.room_queue FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- messages
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
DROP POLICY IF EXISTS "Participants update read state" ON public.messages;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated
USING ((sender_id = auth.uid()) OR (recipient_id = auth.uid())
       OR private.has_role(auth.uid(),'web_admin'::public.app_role)
       OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));
CREATE POLICY "Participants update read state" ON public.messages FOR UPDATE TO authenticated
USING ((recipient_id = auth.uid()) OR (sender_id = auth.uid())
       OR private.has_role(auth.uid(),'web_admin'::public.app_role)
       OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.is_staff(auth.uid()));
CREATE POLICY "Staff insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()) OR (user_id = auth.uid()));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING ((user_id = auth.uid()) OR private.is_staff(auth.uid()));

-- ai_interactions
DROP POLICY IF EXISTS "Users read own ai logs" ON public.ai_interactions;
CREATE POLICY "Users read own ai logs" ON public.ai_interactions FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(),'web_admin'::public.app_role));

-- audit_logs
DROP POLICY IF EXISTS "Web admin reads audit logs" ON public.audit_logs;
CREATE POLICY "Web admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role));

-- storage.objects
DROP POLICY IF EXISTS "Admins upload hospital media" ON storage.objects;
DROP POLICY IF EXISTS "Admins update hospital media" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete hospital media" ON storage.objects;
DROP POLICY IF EXISTS "Staff read patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins read chat files" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload chat files" ON storage.objects;

CREATE POLICY "Admins upload hospital media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hospital-media' AND (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role)));
CREATE POLICY "Admins update hospital media" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hospital-media' AND (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role)));
CREATE POLICY "Admins delete hospital media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hospital-media' AND (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role)));
CREATE POLICY "Staff read patient files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-files' AND private.is_staff(auth.uid()));
CREATE POLICY "Staff upload patient files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-files' AND private.is_staff(auth.uid()));
CREATE POLICY "Staff delete patient files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-files' AND private.is_staff(auth.uid()));
CREATE POLICY "Staff read payment proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND private.is_staff(auth.uid()));
CREATE POLICY "Admins read chat files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files' AND (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role)));
CREATE POLICY "Admins upload chat files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-files' AND (private.has_role(auth.uid(),'web_admin'::public.app_role) OR private.has_role(auth.uid(),'hospital_admin'::public.app_role)));

-- 3. Drop the public.has_role / public.is_staff functions (now unreferenced)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);
