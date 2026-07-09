
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS has_insurance boolean NOT NULL DEFAULT false;

ALTER TABLE public.patient_cases ADD COLUMN IF NOT EXISTS service_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.patient_cases ADD COLUMN IF NOT EXISTS service_description text;
ALTER TABLE public.patient_cases ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'registration';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.patient_cases(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_validation jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_matched boolean;
