-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('web_admin', 'hospital_admin', 'manager', 'doctor_room', 'patient');
CREATE TYPE public.room_type AS ENUM ('doctor', 'manager');
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.patient_status AS ENUM ('pending_payment', 'active');
CREATE TYPE public.queue_status AS ENUM ('waiting', 'in_progress', 'done');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('web_admin','hospital_admin','manager'))
$$;

-- ============ AUTHORIZED EMAILS (role gating set by admins) ============
CREATE TABLE public.authorized_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorized_emails TO authenticated;
GRANT ALL ON public.authorized_emails TO service_role;
ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;

-- ============ HOSPITALS ============
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Ambo General Hospital',
  logo_url text,
  admin_email text,
  room_limit integer NOT NULL DEFAULT 100,
  base_price numeric NOT NULL DEFAULT 0,
  subscription_years integer NOT NULL DEFAULT 1,
  registration_fee numeric NOT NULL DEFAULT 0,
  telebirr_number text,
  bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_active boolean NOT NULL DEFAULT false,
  service_start timestamptz,
  service_end timestamptz,
  payment_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hospitals TO authenticated;
GRANT SELECT ON public.hospitals TO anon;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- ============ HOSPITAL MEDIA (backgrounds, branding) ============
CREATE TABLE public.hospital_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'background',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_media TO authenticated;
GRANT SELECT ON public.hospital_media TO anon;
GRANT ALL ON public.hospital_media TO service_role;
ALTER TABLE public.hospital_media ENABLE ROW LEVEL SECURITY;

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type public.room_type NOT NULL DEFAULT 'doctor',
  room_code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  fan_number text NOT NULL UNIQUE,
  photo_url text,
  date_of_birth date,
  place_of_birth text,
  sex text,
  phone text,
  status public.patient_status NOT NULL DEFAULT 'pending_payment',
  medical_notes text,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- ============ PATIENT CASES ============
CREATE TABLE public.patient_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  diagnosis text,
  prescriptions text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_cases TO authenticated;
GRANT ALL ON public.patient_cases TO service_role;
ALTER TABLE public.patient_cases ENABLE ROW LEVEL SECURITY;

-- ============ CASE ATTACHMENTS ============
CREATE TABLE public.case_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
  url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.case_attachments TO authenticated;
GRANT ALL ON public.case_attachments TO service_role;
ALTER TABLE public.case_attachments ENABLE ROW LEVEL SECURITY;

-- ============ CHECKUPS ============
CREATE TABLE public.checkups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  checkup_date date NOT NULL,
  note text,
  notified boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkups TO authenticated;
GRANT ALL ON public.checkups TO service_role;
ALTER TABLE public.checkups ENABLE ROW LEVEL SECURITY;

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  transaction_id text NOT NULL UNIQUE,
  screenshot_url text,
  amount numeric,
  account_used text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  auto_evaluated boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============ ROOM QUEUE ============
CREATE TABLE public.room_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status public.queue_status NOT NULL DEFAULT 'waiting',
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_queue TO authenticated;
GRANT ALL ON public.room_queue TO service_role;
ALTER TABLE public.room_queue ENABLE ROW LEVEL SECURITY;

-- ============ MESSAGES (admin <-> hospital admin chat) ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid,
  content text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ AI INTERACTIONS ============
CREATE TABLE public.ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_role text NOT NULL,
  prompt text NOT NULL,
  response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_interactions TO authenticated;
GRANT ALL ON public.ai_interactions TO service_role;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ HOSPITAL TIME SETTING (manager-set clock) ============
CREATE TABLE public.hospital_time (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  base_time timestamptz NOT NULL DEFAULT now(),
  set_at timestamptz NOT NULL DEFAULT now(),
  set_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.hospital_time TO authenticated;
GRANT SELECT ON public.hospital_time TO anon;
GRANT ALL ON public.hospital_time TO service_role;
ALTER TABLE public.hospital_time ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'web_admin'));

-- authorized_emails
CREATE POLICY "Admins manage authorized emails" ON public.authorized_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));

-- hospitals
CREATE POLICY "Anyone can read hospital branding" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Web admin inserts hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'web_admin'));
CREATE POLICY "Admins update hospitals" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));

-- hospital_media
CREATE POLICY "Anyone reads hospital media" ON public.hospital_media FOR SELECT USING (true);
CREATE POLICY "Admins manage hospital media" ON public.hospital_media FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));

-- rooms
CREATE POLICY "Staff read rooms" ON public.rooms FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage rooms" ON public.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));

-- patients
CREATE POLICY "Staff manage patients" ON public.patients FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- patient_cases
CREATE POLICY "Staff manage cases" ON public.patient_cases FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- case_attachments
CREATE POLICY "Staff manage attachments" ON public.case_attachments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- checkups
CREATE POLICY "Staff manage checkups" ON public.checkups FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- payments
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- room_queue
CREATE POLICY "Staff manage queue" ON public.room_queue FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- messages
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));
CREATE POLICY "Senders insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Participants update read state" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid() OR sender_id = auth.uid() OR public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));

-- notifications
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ai_interactions
CREATE POLICY "Users read own ai logs" ON public.ai_interactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'web_admin'));
CREATE POLICY "Users insert own ai logs" ON public.ai_interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- audit_logs
CREATE POLICY "Web admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'web_admin') OR public.has_role(auth.uid(), 'hospital_admin'));
CREATE POLICY "Authenticated insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- hospital_time
CREATE POLICY "Anyone reads hospital time" ON public.hospital_time FOR SELECT USING (true);
CREATE POLICY "Staff set hospital time" ON public.hospital_time FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hospitals_updated BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.patient_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED: the hospital row ============
INSERT INTO public.hospitals (name) VALUES ('Ambo General Hospital');

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_queue;