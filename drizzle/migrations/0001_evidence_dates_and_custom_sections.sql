-- Evidence: date + last-edited timestamp
ALTER TABLE public.evidences ADD COLUMN IF NOT EXISTS evidence_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.evidences ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.evidences SET evidence_date = created_at::date WHERE evidence_date IS NULL;
CREATE TRIGGER evidences_updated_at BEFORE UPDATE ON public.evidences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Standards: NULL owner = shared (managed by admins), otherwise a teacher's own custom section
ALTER TABLE public.standards ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.standards ADD CONSTRAINT standards_custom_not_placeholder
  CHECK (owner_id IS NULL OR is_placeholder = false);
CREATE INDEX IF NOT EXISTS standards_owner_idx ON public.standards (owner_id);

DROP POLICY "Signed-in users read active standards" ON public.standards;
DROP POLICY "Admins insert standards" ON public.standards;
DROP POLICY "Admins update standards" ON public.standards;
DROP POLICY "Admins delete standards" ON public.standards;

CREATE POLICY "Read shared or own standards" ON public.standards
  FOR SELECT TO authenticated
  USING ((owner_id IS NULL AND (is_active OR public.is_admin())) OR owner_id = auth.uid());
CREATE POLICY "Admins insert shared standards" ON public.standards
  FOR INSERT TO authenticated WITH CHECK (owner_id IS NULL AND public.is_admin());
CREATE POLICY "Admins update shared standards" ON public.standards
  FOR UPDATE TO authenticated
  USING (owner_id IS NULL AND public.is_admin()) WITH CHECK (owner_id IS NULL AND public.is_admin());
CREATE POLICY "Admins delete shared standards" ON public.standards
  FOR DELETE TO authenticated USING (owner_id IS NULL AND public.is_admin());
CREATE POLICY "Teachers insert own sections" ON public.standards
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Teachers update own sections" ON public.standards
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Teachers delete own sections" ON public.standards
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Evidence and progress may only point at a section the teacher can see (shared or own)
DROP POLICY "Owner inserts evidences" ON public.evidences;
DROP POLICY "Owner updates evidences" ON public.evidences;
CREATE POLICY "Owner inserts evidences" ON public.evidences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.standards st WHERE st.id = standard_id AND (st.owner_id IS NULL OR st.owner_id = auth.uid())));
CREATE POLICY "Owner updates evidences" ON public.evidences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.standards st WHERE st.id = standard_id AND (st.owner_id IS NULL OR st.owner_id = auth.uid())));

DROP POLICY "Owner inserts progress" ON public.standard_progress;
DROP POLICY "Owner updates progress" ON public.standard_progress;
CREATE POLICY "Owner inserts progress" ON public.standard_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.standards st WHERE st.id = standard_id AND (st.owner_id IS NULL OR st.owner_id = auth.uid())));
CREATE POLICY "Owner updates progress" ON public.standard_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.standards st WHERE st.id = standard_id AND (st.owner_id IS NULL OR st.owner_id = auth.uid())));