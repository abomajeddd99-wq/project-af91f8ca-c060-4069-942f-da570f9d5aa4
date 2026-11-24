CREATE TABLE public.professional_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, title text NOT NULL, is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_roles TO authenticated;
GRANT ALL ON public.professional_roles TO service_role;
ALTER TABLE public.professional_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read career paths" ON public.professional_roles FOR SELECT TO authenticated USING (is_active OR public.is_admin());
CREATE POLICY "Admin manages career paths" ON public.professional_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER professional_roles_updated BEFORE UPDATE ON public.professional_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.professional_roles (code,title,sort_order) VALUES ('teacher','معلم / معلمة',1),('principal','مدير / مديرة مدرسة',2),('vice_principal','وكيل / وكيلة',3),('counselor','مرشد / مرشدة طلابية',4),('activity','رائد / رائدة نشاط',5),('supervisor','مشرف / مشرفة تعليمية',6);
ALTER TABLE public.profiles ADD COLUMN professional_role_id uuid REFERENCES public.professional_roles(id) ON DELETE RESTRICT;
ALTER TABLE public.profiles ADD COLUMN onboarding_completed_at timestamptz;
UPDATE public.profiles SET professional_role_id=(SELECT id FROM public.professional_roles WHERE code='teacher');
CREATE INDEX profiles_career_path_idx ON public.profiles(professional_role_id);
CREATE TABLE public.criteria_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), professional_role_id uuid NOT NULL REFERENCES public.professional_roles(id) ON DELETE RESTRICT, title text NOT NULL, academic_year text, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), is_official boolean NOT NULL DEFAULT false, source_reference text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,professional_role_id), CHECK(NOT is_official OR length(trim(coalesce(source_reference,'')))>0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criteria_versions TO authenticated;
GRANT ALL ON public.criteria_versions TO service_role;
ALTER TABLE public.criteria_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own published versions" ON public.criteria_versions FOR SELECT TO authenticated USING(public.is_admin() OR (status='published' AND professional_role_id=(SELECT p.professional_role_id FROM public.profiles p WHERE p.id=auth.uid())));
CREATE POLICY "Admin manages versions" ON public.criteria_versions FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE TRIGGER criteria_versions_updated BEFORE UPDATE ON public.criteria_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.criteria_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES public.criteria_versions(id) ON DELETE RESTRICT, title text NOT NULL, sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,version_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criteria_categories TO authenticated;
GRANT ALL ON public.criteria_categories TO service_role;
ALTER TABLE public.criteria_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read assigned categories" ON public.criteria_categories FOR SELECT TO authenticated USING(public.is_admin() OR (is_active AND EXISTS(SELECT 1 FROM public.criteria_versions v WHERE v.id=version_id AND v.status='published')));
CREATE POLICY "Admin manages categories" ON public.criteria_categories FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
ALTER TABLE public.standards ADD COLUMN criteria_version_id uuid REFERENCES public.criteria_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.standards ADD COLUMN category_id uuid;
ALTER TABLE public.standards ADD COLUMN guidance text;
ALTER TABLE public.standards ADD CONSTRAINT standards_category_version_fk FOREIGN KEY(category_id,criteria_version_id) REFERENCES public.criteria_categories(id,version_id) ON DELETE RESTRICT;
ALTER TABLE public.standards ADD CONSTRAINT standards_category_requires_version CHECK(category_id IS NULL OR criteria_version_id IS NOT NULL);
ALTER TABLE public.standards ADD CONSTRAINT custom_sections_no_shared_version CHECK(owner_id IS NULL OR (criteria_version_id IS NULL AND category_id IS NULL));
INSERT INTO public.criteria_versions(professional_role_id,title,status,is_official) SELECT id,'المعايير التجريبية الحالية','published',false FROM public.professional_roles WHERE code='teacher';
UPDATE public.standards SET criteria_version_id=(SELECT id FROM public.criteria_versions WHERE title='المعايير التجريبية الحالية') WHERE owner_id IS NULL;
CREATE INDEX standards_version_idx ON public.standards(criteria_version_id);
CREATE OR REPLACE FUNCTION public.can_document_standard(_standard_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.standards s WHERE s.id=_standard_id AND (s.owner_id=auth.uid() OR (s.owner_id IS NULL AND s.is_active AND EXISTS(SELECT 1 FROM public.criteria_versions v JOIN public.profiles p ON p.professional_role_id=v.professional_role_id WHERE v.id=s.criteria_version_id AND v.status='published' AND p.id=auth.uid()))))
$$;
REVOKE ALL ON FUNCTION public.can_document_standard(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_document_standard(uuid) TO authenticated,service_role;
DROP POLICY "Read shared or own standards" ON public.standards;
CREATE POLICY "Read assigned or own standards" ON public.standards FOR SELECT TO authenticated USING(owner_id=auth.uid() OR (owner_id IS NULL AND public.is_admin()) OR public.can_document_standard(id) OR EXISTS(SELECT 1 FROM public.evidences e WHERE e.standard_id=id AND e.user_id=auth.uid()));
DROP POLICY "Owner inserts evidences" ON public.evidences;
DROP POLICY "Owner updates evidences" ON public.evidences;
CREATE POLICY "Owner inserts evidences" ON public.evidences FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_document_standard(standard_id));
CREATE POLICY "Owner updates evidences" ON public.evidences FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.validate_evidence_criterion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.standard_id IS DISTINCT FROM OLD.standard_id AND auth.uid() IS NOT NULL AND NOT public.can_document_standard(NEW.standard_id) THEN RAISE EXCEPTION 'Criterion not assigned' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_criterion_change BEFORE UPDATE ON public.evidences FOR EACH ROW EXECUTE FUNCTION public.validate_evidence_criterion();
DROP POLICY "Owner inserts progress" ON public.standard_progress;
DROP POLICY "Owner updates progress" ON public.standard_progress;
CREATE POLICY "Owner inserts progress" ON public.standard_progress FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_document_standard(standard_id));
CREATE POLICY "Owner updates progress" ON public.standard_progress FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND public.can_document_standard(standard_id));
CREATE OR REPLACE FUNCTION public.validate_profile_career_path() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.professional_role_id IS DISTINCT FROM OLD.professional_role_id AND NEW.professional_role_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.professional_roles r WHERE r.id=NEW.professional_role_id AND r.is_active) THEN RAISE EXCEPTION 'Career path unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profiles_validate_career BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_career_path();
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,full_name,email) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),NEW.email) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'teacher') ON CONFLICT(user_id,role) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_list_personal_accounts() RETURNS TABLE(id uuid, full_name text, email text, career_path text, created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,r.title,p.created_at FROM public.profiles p LEFT JOIN public.professional_roles r ON r.id=p.professional_role_id ORDER BY p.created_at DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_personal_accounts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_personal_accounts() TO authenticated,service_role;