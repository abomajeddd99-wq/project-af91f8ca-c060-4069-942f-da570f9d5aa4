# إنجازي — roadmap

## Approved expansion brief — staged delivery
- [x] Current request: Stage A implementation — independent personal accounts, configurable career paths, categories/criteria/versions and protected administration; existing records preserved
- [x] New signup + email verification + login/logout; two career paths; 18 database isolation checks; ordinary-account admin denial; temporary admin creates a path and reads account list; 13 unit/smoke tests
- [ ] Activate platform-owner administration — blocked until requesting user registers/signs in with their own verified account (no matching owner account; no existing user selected automatically)
- [ ] Password recovery complete-flow verification — email delivery works; hosted recovery link reaches preview login rather than local recovery form; final password update not verified
- [ ] Wait for explicit approval before Stage B; do not publish
- [ ] Later Stage B: Link each evidence to one or multiple criteria and allow relinking without losing existing evidence
- [ ] Stage A: Preserve current work; verify auth, onboarding, configurable professional roles and role-assigned versioned criteria without losing existing records
- [ ] Stage B: Evidence-based dashboard coverage, searchable evidence library, academic-year/semester fields, multiple attachments and configurable upload limits
- [ ] Stage C: Arabic A4 portfolio preview and real PDF download with optional pages and original cover themes
- [ ] Stage D: Opt-in selected-content sharing with expiration and revocation
- [ ] Stage E: Secure administration for roles, criteria versions/CSV, academic years, templates, accounts and aggregate usage
- [ ] Verify each stage with rule tests, signed-in browser flows, multi-user isolation and mobile/tablet/desktop checks; do not publish

The tasks below describe the existing teacher MVP. Preserve completed evidence work and incorporate unfinished tasks into the expansion stages above.

## Stage 1 — Auth & data (verify first)
- [ ] Verify sign up / login / logout / password recovery flows
- [x] DB: evidence date + updated_at; teacher-owned custom sections (standards.owner_id) with RLS
- [x] Extend security isolation test for custom sections + evidence linking

## Stage 2 — Evidence
- [x] Multi-file upload (images + PDF) per standard
- [x] Title, description, date per item
- [x] In-app preview (image + PDF pages)
- [x] Edit, delete, replace file

## Stage 3 — Progress & sections
- [ ] Completion = sections that contain evidence (tests)
- [ ] Teachers add/rename/delete their own sections; official/global ones stay configurable data
- [ ] Profile: name, school, specialization, academic year

## Stage 4 — PDF portfolio
- [ ] Cover, teacher details, table of contents, sections, evidence (images + rendered PDF pages)
- [ ] Arabic fonts, RTL, preview + one-click download (+ print)
- [ ] Pagination tests

## Stage 5 — Responsive check (mobile / tablet / desktop) & end-to-end run
