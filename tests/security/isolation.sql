-- Multi-user isolation test for إنجازي.
-- Runs entirely inside one transaction and ALWAYS ends with RAISE EXCEPTION,
-- so every test row is rolled back. Read the exception message:
--   "ISOLATION RESULT: PASS (n checks)"  or  "ISOLATION RESULT: FAIL ... <list>"
DO $$
DECLARE
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  s uuid;
  sec_a uuid;
  ev_a uuid;
  n int;
  checks int := 0;
  failures text[] := '{}';
BEGIN
  -- Setup (privileged)
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES
    (a,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso_a_'||a||'@test.local', '{"full_name":"معلم أ"}', now(), now()),
    (b,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso_b_'||b||'@test.local', '{"full_name":"معلم ب"}', now(), now()),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso_adm_'||adm||'@test.local', '{"full_name":"مشرف"}', now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (adm, 'admin');
  UPDATE public.profiles SET professional_role_id=(SELECT id FROM public.professional_roles WHERE code='teacher') WHERE id IN (a,b,adm);
  SELECT id INTO s FROM public.standards ORDER BY sort_order LIMIT 1;

  -- Signup trigger created profile + teacher role
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.profiles WHERE id IN (a, b, adm);
  IF n <> 3 THEN failures := failures || 'signup trigger did not create profiles'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.user_roles WHERE user_id = a AND role = 'teacher';
  IF n <> 1 THEN failures := failures || 'signup trigger did not assign teacher role'; END IF;

  -- ===== Teacher A creates private data =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  INSERT INTO public.evidences (user_id, standard_id, title, file_path, file_name, mime_type, file_size)
  VALUES (a, s, 'شاهد أ', a || '/e1.pdf', 'e1.pdf', 'application/pdf', 100) RETURNING id INTO ev_a;
  INSERT INTO public.standard_progress (user_id, standard_id, status) VALUES (a, s, 'completed');
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('evidence', a || '/e1.pdf', a);
  UPDATE public.profiles SET school = 'مدرسة أ' WHERE id = a;

  checks := checks + 1;
  SELECT count(*) INTO n FROM public.evidences; IF n <> 1 THEN failures := failures || 'A cannot see own evidence'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'evidence'; IF n <> 1 THEN failures := failures || 'A cannot see own file'; END IF;

  checks := checks + 1;
  BEGIN
    INSERT INTO public.evidences (user_id, standard_id, title, file_path, file_name, mime_type, file_size)
    VALUES (b, s, 'forged', b || '/f.pdf', 'f.pdf', 'application/pdf', 100);
    failures := failures || 'A inserted evidence owned by B';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  BEGIN
    INSERT INTO public.evidences (user_id, standard_id, title, file_path, file_name, mime_type, file_size)
    VALUES (a, s, 'path into B', b || '/f.pdf', 'f.pdf', 'application/pdf', 100);
    failures := failures || 'A inserted evidence pointing into B folder';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('evidence', b || '/steal.pdf', a);
    failures := failures || 'A uploaded into B storage folder';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('evidence', a || '/bad.exe', a);
    failures := failures || 'A uploaded disallowed file type';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (a, 'admin');
    failures := failures || 'A self-promoted to admin';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  BEGIN
    INSERT INTO public.standards (code, title) VALUES ('X', 'teacher-made');
    failures := failures || 'Teacher created a standard';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  checks := checks + 1;
  UPDATE public.standards SET title = 'hacked' WHERE id = s; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'Teacher updated a standard'; END IF;

  checks := checks + 1;
  DELETE FROM public.standards WHERE id = s; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'Teacher deleted a standard'; END IF;

  checks := checks + 1;
  SELECT count(*) INTO n FROM public.standards; IF n = 0 THEN failures := failures || 'Teacher cannot read standards'; END IF;

  -- Teacher-owned custom sections
  checks := checks + 1;
  BEGIN
    INSERT INTO public.standards (code, title, is_placeholder, owner_id, sort_order)
    VALUES ('خ-1', 'قسم أ الخاص', false, a, 100) RETURNING id INTO sec_a;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('A cannot create own section: ' || SQLERRM); END;
  checks := checks + 1;
  BEGIN
    INSERT INTO public.evidences (user_id, standard_id, title, file_path, file_name, mime_type, file_size, evidence_date)
    VALUES (a, sec_a, 'شاهد قسم خاص', a || '/e2.png', 'e2.png', 'image/png', 50, DATE '2026-01-15');
  EXCEPTION WHEN OTHERS THEN failures := failures || ('A cannot add evidence to own section: ' || SQLERRM); END;
  checks := checks + 1;
  BEGIN
    INSERT INTO public.standards (code, title, is_placeholder, owner_id) VALUES ('خ-2', 'forged', false, b);
    failures := failures || 'A created a section owned by B';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  checks := checks + 1;
  UPDATE public.evidences SET title = 'عنوان معدل', evidence_date = DATE '2026-02-01' WHERE id = ev_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'A cannot edit own evidence'; END IF;
  -- Replacing the file: allowed inside own folder, refused when pointing into another teacher's folder
  checks := checks + 1;
  UPDATE public.evidences SET file_path = a || '/e1-new.png', file_name = 'e1-new.png', mime_type = 'image/png', file_size = 200 WHERE id = ev_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'A cannot replace own evidence file'; END IF;
  checks := checks + 1;
  BEGIN
    UPDATE public.evidences SET file_path = b || '/x.pdf' WHERE id = ev_a;
    failures := failures || 'A re-pointed evidence into B folder';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;

  -- ===== Teacher B tries to reach A =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  checks := checks + 1;
  SELECT count(*) INTO n FROM public.evidences; IF n <> 0 THEN failures := failures || 'B sees A evidences'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.standard_progress; IF n <> 0 THEN failures := failures || 'B sees A progress'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.profiles WHERE id <> b; IF n <> 0 THEN failures := failures || 'B sees other profiles'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'evidence'; IF n <> 0 THEN failures := failures || 'B sees A files'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.user_roles WHERE user_id <> b; IF n <> 0 THEN failures := failures || 'B sees other roles'; END IF;

  checks := checks + 1;
  UPDATE public.evidences SET title = 'tampered' WHERE id = ev_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B updated A evidence'; END IF;
  checks := checks + 1;
  DELETE FROM public.evidences WHERE id = ev_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B deleted A evidence'; END IF;
  checks := checks + 1;
  UPDATE public.profiles SET school = 'tampered' WHERE id = a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B updated A profile'; END IF;
  checks := checks + 1;
  UPDATE public.standard_progress SET status = 'not_started' WHERE user_id = a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B updated A progress'; END IF;
  -- (File deletion is checked through the Storage API test; direct SQL deletes are blocked by the platform.)
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.standards WHERE owner_id IS NOT NULL; IF n <> 0 THEN failures := failures || 'B sees A custom section'; END IF;
  checks := checks + 1;
  UPDATE public.standards SET title = 'tampered' WHERE id = sec_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B renamed A section'; END IF;
  checks := checks + 1;
  DELETE FROM public.standards WHERE id = sec_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B deleted A section'; END IF;
  checks := checks + 1;
  BEGIN
    INSERT INTO public.evidences (user_id, standard_id, title, file_path, file_name, mime_type, file_size)
    VALUES (b, sec_a, 'into A section', b || '/x.pdf', 'x.pdf', 'application/pdf', 100);
    failures := failures || 'B attached evidence to A section';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN NULL; END;
  checks := checks + 1;
  UPDATE storage.objects SET name = b || '/moved.pdf' WHERE bucket_id = 'evidence' AND name = a || '/e1.pdf'; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'B moved A file'; END IF;

  -- ===== Admin manages standards but cannot see private teacher data =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);

  checks := checks + 1;
  SELECT count(*) INTO n FROM public.evidences; IF n <> 0 THEN failures := failures || 'Admin sees teacher evidences'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'evidence'; IF n <> 0 THEN failures := failures || 'Admin sees teacher files'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.standard_progress; IF n <> 0 THEN failures := failures || 'Admin sees teacher progress'; END IF;
  checks := checks + 1;
  SELECT count(*) INTO n FROM public.profiles WHERE id <> adm; IF n <> 0 THEN failures := failures || 'Admin sees teacher profiles'; END IF;

  checks := checks + 1;
  SELECT count(*) INTO n FROM public.standards WHERE owner_id IS NOT NULL; IF n <> 0 THEN failures := failures || 'Admin sees teacher custom sections'; END IF;
  checks := checks + 1;
  UPDATE public.standards SET title = 'admin edit' WHERE id = sec_a; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'Admin edited teacher section'; END IF;

  checks := checks + 1;
  BEGIN
    INSERT INTO public.standards (code, title, is_placeholder) VALUES ('T-1', 'admin standard', true);
  EXCEPTION WHEN OTHERS THEN failures := failures || ('Admin cannot create standard: ' || SQLERRM); END;
  checks := checks + 1;
  UPDATE public.standards SET description = 'edited by admin' WHERE id = s; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'Admin cannot update standard'; END IF;

  -- ===== Anonymous visitor =====
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('role', 'anon', true);
  checks := checks + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.evidences;
    IF n <> 0 THEN failures := failures || 'Anon sees evidences'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  checks := checks + 1;
  BEGIN
    SELECT count(*) INTO n FROM public.profiles;
    IF n <> 0 THEN failures := failures || 'Anon sees profiles'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  checks := checks + 1;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'evidence';
  IF n <> 0 THEN failures := failures || 'Anon sees files'; END IF;

  IF array_length(failures, 1) IS NULL THEN
    RAISE EXCEPTION 'ISOLATION RESULT: PASS (% checks)', checks;
  ELSE
    RAISE EXCEPTION 'ISOLATION RESULT: FAIL (% of % checks) %', array_length(failures, 1), checks, array_to_string(failures, ' | ');
  END IF;
END $$;
