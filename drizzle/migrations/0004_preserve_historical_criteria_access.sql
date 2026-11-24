CREATE OR REPLACE FUNCTION public.owns_evidence_for_standard(_standard_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.evidences e WHERE e.standard_id=_standard_id AND e.user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.owns_evidence_for_standard(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owns_evidence_for_standard(uuid) TO authenticated,service_role;
DROP POLICY "Read assigned or own standards" ON public.standards;
CREATE POLICY "Read assigned or own standards" ON public.standards FOR SELECT TO authenticated USING(owner_id=auth.uid() OR (owner_id IS NULL AND public.is_admin()) OR public.can_document_standard(id) OR public.owns_evidence_for_standard(id));