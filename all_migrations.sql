-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  job_title text DEFAULT 'معلم',
  school text,
  subject text,
  stage text,
  education_office text,
  years_experience integer CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 60)),
  phone text,
  bio text,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user: profile + teacher role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Standards (managed by admins, readable by all signed-in users)
CREATE TABLE public.standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  indicators text[] NOT NULL DEFAULT '{}',
  weight numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  is_placeholder boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standards TO authenticated;
GRANT ALL ON public.standards TO service_role;
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read active standards" ON public.standards
  FOR SELECT TO authenticated USING (is_active OR public.is_admin());
CREATE POLICY "Admins insert standards" ON public.standards
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update standards" ON public.standards
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete standards" ON public.standards
  FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER standards_updated_at BEFORE UPDATE ON public.standards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Evidences (strictly private to the owning teacher; no admin policy)
CREATE TABLE public.evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  standard_id uuid NOT NULL REFERENCES public.standards(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidences_path_owner CHECK (split_part(file_path, '/', 1) = user_id::text)
);
CREATE INDEX evidences_user_standard_idx ON public.evidences (user_id, standard_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidences TO authenticated;
GRANT ALL ON public.evidences TO service_role;
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads evidences" ON public.evidences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts evidences" ON public.evidences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates evidences" ON public.evidences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner deletes evidences" ON public.evidences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Completion tracking per teacher per standard
CREATE TABLE public.standard_progress (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  standard_id uuid NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, standard_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_progress TO authenticated;
GRANT ALL ON public.standard_progress TO service_role;
ALTER TABLE public.standard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads progress" ON public.standard_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts progress" ON public.standard_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates progress" ON public.standard_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner deletes progress" ON public.standard_progress
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER standard_progress_updated_at BEFORE UPDATE ON public.standard_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private storage: each teacher can only touch files under "<their user id>/..."
CREATE POLICY "Teachers read own evidence files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teachers upload own evidence files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','pdf')
  );
CREATE POLICY "Teachers update own evidence files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teachers delete own evidence files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Teacher standards (editable placeholder criteria until an official source is approved)
INSERT INTO public.standards (code, title, description, indicators, weight, sort_order, is_placeholder) VALUES
('م-01', 'أداء الواجبات الوظيفية', 'الانضباط الوظيفي والالتزام بالأنظمة والمشاركة في مهام المدرسة.', ARRAY['الحفاظ على الدوام','رفع الإجازات وفق النظام','إشعار الإدارة بالغياب ونوعه بوقت كافٍ','شغل حصص الانتظار وتفعيلها','المشاركة في اللجان المدرسية وتفعيلها','الالتزام بالمناوبة اليومية وفق الجدول المعد','تفعيل حصص النشاط','المشاركة في الأنشطة والمناسبات الوطنية','التواصل الفعال مع الإدارة المدرسية','تقديم مبادرة للمدرسة وتنفيذها على المنسوبين','تفعيل الإذاعة الصباحية','الالتزام بحضور الطابور الصباحي والمساهمة في تنظيمه','الالتزام بزمن الحصة الدراسية','الاطلاع والالتزام بالتعاميم واللوائح المنظمة والتوقيع عليها بالعلم','الالتزام بالسلوك المهني','مراعاة المرحلة العمرية للطلاب','اتباع الأساليب التربوية مع الطلاب','تفعيل منصة مدرستي'], 10, 1, true),
('م-02', 'التفاعل مع المجتمع المهني', 'التدريب والنمو المهني وتبادل الخبرات مع الزملاء.', ARRAY['تنفيذ البرامج التدريبية','حضور البرامج التدريبية الداخلية والخارجية والفردية','تنفيذ زيارات تبادلية','حضور الملتقيات','حضور الزيارات التبادلية','تفعيل دوره في مجتمعات التعلم المهنية','تنفيذ الدروس التطبيقية والحلقات التنشيطية','تقديم إنتاج معرفي / تجارب عملية / وسيلة تعليمية / تطوير مناهج / ساعات تطوع','إصدار الرخصة المهنية'], 10, 2, true),
('م-03', 'التفاعل مع أولياء الأمور', 'التواصل مع الأسرة وإشراكها في تعلم الطالب.', ARRAY['التواصل الفعال مع أولياء الأمور','إرسال تقارير مستويات الطلاب','حضور اجتماعات أولياء الأمور','إرسال استمارات الاستدعاء عند الحاجة','مشاركة أولياء الأمور في العملية التعليمية','تفعيل سجل المتابعة لاطلاع ولي الأمر على مستوى الطالب'], 10, 3, true),
('م-04', 'التنوع في استراتيجيات التدريس', 'تنويع طرق التدريس بما يناسب الموقف التعليمي واحتياجات الطلاب.', ARRAY['دمج مهارات التفكير في التدريس','تفعيل استراتيجيات تدريس مناسبة للموقف التعليمي وملائمة لميول الطلاب واحتياجاتهم','تفعيل استراتيجيات تنمي مهارات الفهم القرائي لدى الطلاب وتدعم قدرتهم على الحوار والمناقشة','ربط الدرس بالواقع والخبرات الحياتية'], 10, 4, true),
('م-05', 'تحسين نتائج المتعلمين', 'تشخيص مستوى الطلاب ومعالجة جوانب الضعف وإثراء جوانب التميز.', ARRAY['تنفيذ الاختبارات التشخيصية','تحديد المهارات المفقودة','وضع خطة علاجية للمهارات المتدنية','وضع خطة إثرائية للمهارات الجيدة','متابعة ملفات إنجاز المتعلمين','تصحيح الكتب الدراسية','تحليل النتائج وإعداد التقارير','التحفيز والتكريم وتعزيز ثقة الطلاب بأنفسهم','تحسين نتائج الطلاب في الاختبارات الوطنية نافس والتحصيل'], 10, 5, true),
('م-06', 'إعداد وتنفيذ خطة التعلم', 'إعداد خطط التعلم وتسليمها وتنفيذها في وقتها.', ARRAY['تسليم توزيع المنهج في الوقت المحدد','تسليم خطة التعلم الأسبوعية في الوقت المحدد','تحضير الدروس في المنصة في الوقت المحدد','تنفيذ الخطة العلاجية للمهارات المفقودة','تنفيذ الخطة الإثرائية','تنفيذ خطة النشاط في الوقت المحدد'], 10, 6, true),
('م-07', 'توظيف تقنيات ووسائل التعلم المناسبة', 'توظيف مصادر التعلم والتقنيات الرقمية بما يخدم تعلم الطلاب.', ARRAY['تفعيل سجل مصادر التعلم','استخدام وسائل وتقنيات مناسبة لحاجات وأنماط المتعلمين وتراعي الفروق الفردية','تنمية قدرة الطالب على التأمل والملاحظة والتفكير العلمي','تفعيل تطبيقات وبرامج الذكاء الاصطناعي في الحصة الدراسية','تفعيل قنوات عين','تفعيل الأنشطة والواجبات والاختبارات والإثرائيات في منصة مدرستي'], 10, 7, true),
('م-08', 'تهيئة بيئة تعليمية', 'بيئة صفية آمنة ومحفزة تحترم الطلاب وتشجع مشاركتهم.', ARRAY['توفير بيئة تعليمية آمنة خالية من الأخطار','توفير بيئة تعليمية تحقق الأمان النفسي والاحترام المتبادل','إتاحة الفرصة للطلاب للتعبير عن أنفسهم ومشاركة أفكارهم مع أقرانهم','إثارة دافعية الطلاب داخل الفصل من خلال التنوع في أساليب التعلم'], 5, 8, true),
('م-09', 'الإدارة الصفية', 'ضبط الصف وتنظيمه بما يخدم الموقف التعليمي.', ARRAY['عرض القوانين الصفية للطلاب في الحصة الدراسية','توجيه الطلاب لتطبيق القوانين الصفية في الحصة الدراسية','تعزيز الانضباط','تنوع نبرات الصوت بما يتوافق مع الموقف التعليمي','تنظيم الطلاب داخل الفصل بما يتناسب مع الموقف الدراسي'], 5, 9, true),
('م-10', 'تحليل نتائج المتعلمين وتشخيص مستوياتهم', 'تحليل نتائج التقييم وتحديد جوانب القوة والضعف لدى الطلاب.', ARRAY['تحليل نتائج التقييم وإعداد التقارير بشأن فعالية التدريس','تحديد نقاط القوة والضعف','إشراك الطلاب في نتائجهم ومدى تقدمهم لدعم تطورهم'], 10, 10, true),
('م-11', 'تنوع أساليب التقويم', 'تنويع أدوات التقويم ومصادره وتوظيف التغذية الراجعة.', ARRAY['تنوع مصادر التقويم (ملاحظة صفية / استبانات / تقارير ذاتية / تحليل نتائج)','تنوع أساليب التقويم (اختبارات شفهية / تحريرية / مهام أدائية)','تقديم التغذية الراجعة لتقويم الطلاب','تطبيق التقويم التكويني والبنائي لتطوير أداء الطلاب','تطبيق التقويم الختامي وقياس تقدم التعلم وإصدار الحكم على مستوى الطالب','بناء الاختبارات (الفصلية والنهائية) وفق معايير الاختبار الجيد'], 10, 11, true);
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
    SELECT 1 FROM public.standards st WHERE st.id = standard_id AND (st.owner_id IS NULL OR st.owner_id = auth.uid())));CREATE TABLE public.professional_roles (
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
GRANT EXECUTE ON FUNCTION public.admin_list_personal_accounts() TO authenticated,service_role;REVOKE EXECUTE ON FUNCTION public.validate_profile_career_path() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_evidence_criterion() FROM PUBLIC,anon,authenticated;CREATE OR REPLACE FUNCTION public.owns_evidence_for_standard(_standard_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.evidences e WHERE e.standard_id=_standard_id AND e.user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.owns_evidence_for_standard(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owns_evidence_for_standard(uuid) TO authenticated,service_role;
DROP POLICY "Read assigned or own standards" ON public.standards;
CREATE POLICY "Read assigned or own standards" ON public.standards FOR SELECT TO authenticated USING(owner_id=auth.uid() OR (owner_id IS NULL AND public.is_admin()) OR public.can_document_standard(id) OR public.owns_evidence_for_standard(id));CREATE OR REPLACE FUNCTION public.validate_criterion_official_label() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.owner_id IS NULL AND NOT NEW.is_placeholder AND NOT EXISTS(SELECT 1 FROM public.criteria_versions v WHERE v.id=NEW.criteria_version_id AND v.is_official AND length(trim(coalesce(v.source_reference,'')))>0) THEN RAISE EXCEPTION 'Official criterion requires verified version source' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.validate_criterion_official_label() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER standards_validate_official_label BEFORE INSERT OR UPDATE OF is_placeholder,criteria_version_id ON public.standards FOR EACH ROW EXECUTE FUNCTION public.validate_criterion_official_label();ALTER TABLE public.evidences
  ADD COLUMN IF NOT EXISTS indicator_index integer,
  ADD COLUMN IF NOT EXISTS indicator_text text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidences_indicator_index_nonnegative'
      AND conrelid = 'public.evidences'::regclass
  ) THEN
    ALTER TABLE public.evidences
      ADD CONSTRAINT evidences_indicator_index_nonnegative
      CHECK (indicator_index IS NULL OR indicator_index >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS evidences_user_standard_indicator_idx
  ON public.evidences (user_id, standard_id, indicator_index);
-- Update only the shared criteria version assigned to the teacher / teacheress career path.
-- Existing evidence and progress rows are intentionally left untouched.
WITH teacher_version AS (
  SELECT v.id
  FROM public.criteria_versions v
  JOIN public.professional_roles r ON r.id = v.professional_role_id
  WHERE r.code = 'teacher'
    AND v.status = 'published'
), teacher_criteria(code, title, description, indicators, weight, sort_order) AS (
  VALUES
  ('م-01', 'أداء الواجبات الوظيفية', 'الانضباط الوظيفي والالتزام بالأنظمة والمشاركة في مهام المدرسة.', ARRAY['الحفاظ على الدوام','رفع الإجازات وفق النظام','إشعار الإدارة بالغياب ونوعه بوقت كافٍ','شغل حصص الانتظار وتفعيلها','المشاركة في اللجان المدرسية وتفعيلها','الالتزام بالمناوبة اليومية وفق الجدول المعد','تفعيل حصص النشاط','المشاركة في الأنشطة والمناسبات الوطنية','التواصل الفعال مع الإدارة المدرسية','تقديم مبادرة للمدرسة وتنفيذها على المنسوبين','تفعيل الإذاعة الصباحية','الالتزام بحضور الطابور الصباحي والمساهمة في تنظيمه','الالتزام بزمن الحصة الدراسية','الاطلاع والالتزام بالتعاميم واللوائح المنظمة والتوقيع عليها بالعلم','الالتزام بالسلوك المهني','مراعاة المرحلة العمرية للطلاب','اتباع الأساليب التربوية مع الطلاب','تفعيل منصة مدرستي']::text[], 10::numeric, 1),
  ('م-02', 'التفاعل مع المجتمع المهني', 'التدريب والنمو المهني وتبادل الخبرات مع الزملاء.', ARRAY['تنفيذ البرامج التدريبية','حضور البرامج التدريبية الداخلية والخارجية والفردية','تنفيذ زيارات تبادلية','حضور الملتقيات','حضور الزيارات التبادلية','تفعيل دوره في مجتمعات التعلم المهنية','تنفيذ الدروس التطبيقية والحلقات التنشيطية','تقديم إنتاج معرفي / تجارب عملية / وسيلة تعليمية / تطوير مناهج / ساعات تطوع','إصدار الرخصة المهنية']::text[], 10::numeric, 2),
  ('م-03', 'التفاعل مع أولياء الأمور', 'التواصل مع الأسرة وإشراكها في تعلم الطالب.', ARRAY['التواصل الفعال مع أولياء الأمور','إرسال تقارير مستويات الطلاب','حضور اجتماعات أولياء الأمور','إرسال استمارات الاستدعاء عند الحاجة','مشاركة أولياء الأمور في العملية التعليمية','تفعيل سجل المتابعة لاطلاع ولي الأمر على مستوى الطالب']::text[], 10::numeric, 3),
  ('م-04', 'التنوع في استراتيجيات التدريس', 'تنويع طرق التدريس بما يناسب الموقف التعليمي واحتياجات الطلاب.', ARRAY['دمج مهارات التفكير في التدريس','تفعيل استراتيجيات تدريس مناسبة للموقف التعليمي وملائمة لميول الطلاب واحتياجاتهم','تفعيل استراتيجيات تنمي مهارات الفهم القرائي لدى الطلاب وتدعم قدرتهم على الحوار والمناقشة','ربط الدرس بالواقع والخبرات الحياتية']::text[], 10::numeric, 4),
  ('م-05', 'تحسين نتائج المتعلمين', 'تشخيص مستوى الطلاب ومعالجة جوانب الضعف وإثراء جوانب التميز.', ARRAY['تنفيذ الاختبارات التشخيصية','تحديد المهارات المفقودة','وضع خطة علاجية للمهارات المتدنية','وضع خطة إثرائية للمهارات الجيدة','متابعة ملفات إنجاز المتعلمين','تصحيح الكتب الدراسية','تحليل النتائج وإعداد التقارير','التحفيز والتكريم وتعزيز ثقة الطلاب بأنفسهم','تحسين نتائج الطلاب في الاختبارات الوطنية نافس والتحصيل']::text[], 10::numeric, 5),
  ('م-06', 'إعداد وتنفيذ خطة التعلم', 'إعداد خطط التعلم وتسليمها وتنفيذها في وقتها.', ARRAY['تسليم توزيع المنهج في الوقت المحدد','تسليم خطة التعلم الأسبوعية في الوقت المحدد','تحضير الدروس في المنصة في الوقت المحدد','تنفيذ الخطة العلاجية للمهارات المفقودة','تنفيذ الخطة الإثرائية','تنفيذ خطة النشاط في الوقت المحدد']::text[], 10::numeric, 6),
  ('م-07', 'توظيف تقنيات ووسائل التعلم المناسبة', 'توظيف مصادر التعلم والتقنيات الرقمية بما يخدم تعلم الطلاب.', ARRAY['تفعيل سجل مصادر التعلم','استخدام وسائل وتقنيات مناسبة لحاجات وأنماط المتعلمين وتراعي الفروق الفردية','تنمية قدرة الطالب على التأمل والملاحظة والتفكير العلمي','تفعيل تطبيقات وبرامج الذكاء الاصطناعي في الحصة الدراسية','تفعيل قنوات عين','تفعيل الأنشطة والواجبات والاختبارات والإثرائيات في منصة مدرستي']::text[], 10::numeric, 7),
  ('م-08', 'تهيئة بيئة تعليمية', 'بيئة صفية آمنة ومحفزة تحترم الطلاب وتشجع مشاركتهم.', ARRAY['توفير بيئة تعليمية آمنة خالية من الأخطار','توفير بيئة تعليمية تحقق الأمان النفسي والاحترام المتبادل','إتاحة الفرصة للطلاب للتعبير عن أنفسهم ومشاركة أفكارهم مع أقرانهم','إثارة دافعية الطلاب داخل الفصل من خلال التنوع في أساليب التعلم']::text[], 5::numeric, 8),
  ('م-09', 'الإدارة الصفية', 'ضبط الصف وتنظيمه بما يخدم الموقف التعليمي.', ARRAY['عرض القوانين الصفية للطلاب في الحصة الدراسية','توجيه الطلاب لتطبيق القوانين الصفية في الحصة الدراسية','تعزيز الانضباط','تنوع نبرات الصوت بما يتوافق مع الموقف التعليمي','تنظيم الطلاب داخل الفصل بما يتناسب مع الموقف الدراسي']::text[], 5::numeric, 9),
  ('م-10', 'تحليل نتائج المتعلمين وتشخيص مستوياتهم', 'تحليل نتائج التقييم وتحديد جوانب القوة والضعف لدى الطلاب.', ARRAY['تحليل نتائج التقييم وإعداد التقارير بشأن فعالية التدريس','تحديد نقاط القوة والضعف','إشراك الطلاب في نتائجهم ومدى تقدمهم لدعم تطورهم']::text[], 10::numeric, 10),
  ('م-11', 'تنوع أساليب التقويم', 'تنويع أدوات التقويم ومصادره وتوظيف التغذية الراجعة.', ARRAY['تنوع مصادر التقويم (ملاحظة صفية / استبانات / تقارير ذاتية / تحليل نتائج)','تنوع أساليب التقويم (اختبارات شفهية / تحريرية / مهام أدائية)','تقديم التغذية الراجعة لتقويم الطلاب','تطبيق التقويم التكويني والبنائي لتطوير أداء الطلاب','تطبيق التقويم الختامي وقياس تقدم التعلم وإصدار الحكم على مستوى الطالب','بناء الاختبارات (الفصلية والنهائية) وفق معايير الاختبار الجيد']::text[], 10::numeric, 11)
)
UPDATE public.standards s
SET title = c.title,
    description = c.description,
    indicators = c.indicators,
    weight = c.weight,
    sort_order = c.sort_order,
    is_placeholder = true,
    is_active = true
FROM teacher_criteria c, teacher_version tv
WHERE s.code = c.code
  AND s.criteria_version_id = tv.id
  AND s.owner_id IS NULL;
