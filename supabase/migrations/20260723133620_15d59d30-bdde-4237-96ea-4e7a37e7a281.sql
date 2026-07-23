DROP POLICY IF EXISTS "Authenticated read hospitals" ON public.hospitals;
CREATE POLICY "Staff read hospitals" ON public.hospitals
FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()));