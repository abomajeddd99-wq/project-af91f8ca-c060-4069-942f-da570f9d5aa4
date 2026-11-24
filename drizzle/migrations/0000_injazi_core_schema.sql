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
