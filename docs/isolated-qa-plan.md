# Isolated teacher evidence QA plan

## Safety boundary

This plan is for a future, dedicated non-production Supabase project only. Do
not run these checks against the current Replit Supabase target or production
data. Do not change schema, RLS policies, subscription settings, or payment
settings as part of the tests. Use normal authenticated teacher sessions; do not
use a service-role key or bypass RLS.

The test project must already have the app schema and at least one published
active standard. Configure a separate test workspace with only that project's
development URL and publishable key. Do not replace the current workspace's
Supabase configuration.

## Minimal fixture

1. Create two synthetic teacher accounts through the app's normal signup and
   onboarding flows. Call them Teacher A and Teacher B. Give both the same
   teacher role and use test-only email addresses with no personal information.
2. Create one small synthetic PNG containing no real or identifying content.
3. Sign in as Teacher A, upload the PNG to one published standard, and record
   the resulting evidence ID and storage path for this disposable test project.
4. Do not create any other evidence or alter the published standards.

## Tests and expected results

| Test                      | Action                                                          | Expected result                                                                     |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Teacher registration      | Register a synthetic teacher through the app                    | Account and profile are created only in the isolated project.                       |
| Sign-in                   | Sign in as each synthetic teacher                               | Each teacher reaches only their own authenticated workspace.                        |
| Password-reset redirect   | Request reset for a synthetic teacher and follow the test email | The link returns to the isolated app's reset page and completes there.              |
| Evidence-to-standard link | Teacher A opens the standard and portfolio after upload         | The evidence is listed under the selected standard and counted once.                |
| Evidence owner read       | Teacher A opens and previews the evidence                       | The file and metadata are available to Teacher A.                                   |
| Other-teacher read        | Teacher B queries the exact evidence ID and storage path        | Access is denied or no row is returned; no file content is exposed.                 |
| Other-teacher update      | Teacher B attempts to change the synthetic evidence metadata    | The request is denied or affects zero rows; Teacher A still sees original metadata. |
| Other-teacher delete      | Teacher B attempts to delete the synthetic evidence object      | The request is denied; Teacher A can still access the file.                         |
| Portfolio output          | Print Teacher A's portfolio to an in-memory PDF                 | Evidence appears for Teacher A and not for Teacher B.                               |

The update and delete probes are limited to this single synthetic fixture. If
RLS is unexpectedly permissive, only that disposable fixture could be changed;
record the result and continue cleanup. Do not modify policies during the test.

## Cleanup and verification

1. Remove the synthetic evidence row and its storage object using the test
   project's authorized owner workflow.
2. Delete Teacher A and Teacher B from the test project's authentication
   dashboard and remove any remaining profile or progress rows associated with
   those two test IDs.
3. Query the test project for the two fixture IDs and confirm the evidence row,
   storage object, profiles, and accounts are gone.
4. Do not delete or edit standards, policies, schema, or any non-fixture data.

Do not begin until the isolated project is available and the user explicitly
approves this plan.

## Current QA status

- **NOT TESTED:** End-to-end registration, because it creates an auth account
  and no test account was created.
- **NOT TESTED:** Password-reset email redirect, because it sends an email and
  requires the provider to deliver a reset link; no email was requested.
- **PASS:** QA authentication and signed-in dashboard loaded; the dashboard
  reports 11 standards and shows four next-incomplete cards, with all 11 on the
  standards index.
- **PASS:** The QA profile's career role matched the published criteria
  version.
- **PASS:** All 11 standard detail pages showed the matching title,
  description, and indicators.
- **PASS:** The evidence file picker was available on all 11 standard detail
  pages. No real file was uploaded.
- **PASS:** The empty progress baseline showed 0 of 11 completed and 0%
  weighted progress.
- **PASS:** The portfolio print flow produced a valid in-memory PDF with 11
  standard rows. No evidence was present.
- **NOT TESTED:** Evidence-to-standard linking, because the QA account had no
  evidence rows.
- **NOT TESTED:** Nonzero progress states, because the QA account had no
  progress rows.
- **NOT TESTED:** Cross-teacher evidence read/write isolation, because no
  second test account or evidence fixture was available.
- **PASS:** Mock-only regression checks cover standards assignment content,
  dashboard summary and preview, uploader validation/linking/rollback,
  progress calculations, and portfolio print behavior. No Supabase calls are
  made by these tests.

PDF evidence is currently represented in the printed portfolio by a filename
card rather than embedded PDF pages. Confirm the desired export behavior before
changing it.
