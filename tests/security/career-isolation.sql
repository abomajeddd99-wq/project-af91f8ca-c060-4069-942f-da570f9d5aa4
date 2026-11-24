DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); adm uuid:=gen_random_uuid(); teacher uuid; principal uuid; v uuid; s uuid; teacher_s uuid; n int; checks int:=0;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','career_a_'||a||'@test.local','{}',now(),now()),
 (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','career_b_'||b||'@test.local','{}',now(),now()),
 (adm,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','career_admin_'||adm||'@test.local','{}',now(),now());
 SELECT id INTO teacher FROM professional_roles WHERE code='teacher';
 SELECT id INTO principal FROM professional_roles WHERE code='principal';
 UPDATE profiles SET professional_role_id=teacher WHERE id=a;
 UPDATE profiles SET professional_role_id=principal WHERE id=b;
 INSERT INTO user_roles(user_id,role) VALUES(adm,'admin');
 INSERT INTO criteria_versions(professional_role_id,title,status) VALUES(principal,'اختبار فقط','published') RETURNING id INTO v;
 INSERT INTO standards(code,title,criteria_version_id) VALUES('iso-principal','معيار تجريبي للاختبار',v) RETURNING id INTO s;
 SELECT id INTO teacher_s FROM standards WHERE criteria_version_id<>v LIMIT 1;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 PERFORM set_config('role','authenticated',true);
 SELECT count(*) INTO n FROM profiles WHERE id=a; IF n<>1 THEN RAISE EXCEPTION 'FAIL signup profile'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM standards WHERE id=s; IF n<>0 THEN RAISE EXCEPTION 'FAIL teacher sees principal criterion'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM standards WHERE id=teacher_s; IF n<>1 THEN RAISE EXCEPTION 'FAIL teacher cannot read assigned criterion'; END IF; checks:=checks+1;
 IF is_admin() THEN RAISE EXCEPTION 'FAIL career granted admin'; END IF; checks:=checks+1;
 BEGIN PERFORM admin_list_personal_accounts(); RAISE EXCEPTION 'FAIL ordinary account admin access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; checks:=checks+1;
 BEGIN INSERT INTO professional_roles(code,title) VALUES('forged','forged'); RAISE EXCEPTION 'FAIL career catalog write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; checks:=checks+1;
 BEGIN INSERT INTO evidences(standard_id,title,file_path,file_name,mime_type,file_size) VALUES(s,'forged',a||'/test.pdf','test.pdf','application/pdf',100); RAISE EXCEPTION 'FAIL unassigned evidence criterion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; checks:=checks+1;
 INSERT INTO evidences(standard_id,title,file_path,file_name,mime_type,file_size) VALUES(teacher_s,'private',a||'/test.pdf','test.pdf','application/pdf',100);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM standards WHERE id=s; IF n<>1 THEN RAISE EXCEPTION 'FAIL principal cannot read assigned criterion'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM standards WHERE id=teacher_s; IF n<>0 THEN RAISE EXCEPTION 'FAIL principal sees teacher criterion'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM evidences WHERE user_id=a; IF n<>0 THEN RAISE EXCEPTION 'FAIL evidence isolation'; END IF; checks:=checks+1;
 UPDATE profiles SET professional_role_id=teacher WHERE id=a; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'FAIL profile isolation'; END IF; checks:=checks+1;
 BEGIN INSERT INTO user_roles(user_id,role) VALUES(b,'admin'); RAISE EXCEPTION 'FAIL self promotion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; checks:=checks+1;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 UPDATE profiles SET professional_role_id=principal WHERE id=a;
 SELECT count(*) INTO n FROM evidences WHERE user_id=a; IF n<>1 THEN RAISE EXCEPTION 'FAIL career change lost evidence'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM standards WHERE id=teacher_s; IF n<>1 THEN RAISE EXCEPTION 'FAIL historical criterion inaccessible'; END IF; checks:=checks+1;
 UPDATE evidences SET title='edited after role change' WHERE user_id=a; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'FAIL historical evidence cannot edit'; END IF; checks:=checks+1;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',adm,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM admin_list_personal_accounts(); IF n<3 THEN RAISE EXCEPTION 'FAIL admin accounts'; END IF; checks:=checks+1;
 SELECT count(*) INTO n FROM evidences WHERE user_id=a; IF n<>0 THEN RAISE EXCEPTION 'FAIL admin evidence exposure'; END IF; checks:=checks+1;
 INSERT INTO professional_roles(code,title) VALUES('iso-role-'||adm,'مسار اختبار'); checks:=checks+1;
 BEGIN INSERT INTO standards(code,title,is_placeholder) VALUES('fake-official','غير معتمد',false); RAISE EXCEPTION 'FAIL official criteria without verified source'; EXCEPTION WHEN check_violation THEN NULL; END; checks:=checks+1;
 RAISE EXCEPTION 'CAREER ISOLATION PASS (% checks; rolled back)',checks;
END $$;