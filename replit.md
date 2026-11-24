# Running on Replit

- This is the imported إنجازي teacher portfolio app. Preserve its React, TanStack Start, Vite, Bun, and Supabase stack and existing layout.
- Use the **Start application** workflow, which runs `bun run dev` on `0.0.0.0:5000`. Click Run to start the preview.
- Dependencies are tracked by `package.json` and `bun.lock`.
- Run the existing tests with `bun run test`.
- Vite reads the existing local `.env` for public Supabase configuration. Never copy credentials into documentation or source code.
- The browser requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-side authenticated functions additionally require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is only needed if a server operation deliberately uses the privileged Supabase client. The current admin account function uses the caller's authenticated client and database role-check RPCs; it does not need the service-role key. Never put privileged keys in `VITE_*` variables.
- In Supabase **Authentication → URL Configuration**, set the Site URL to the app's canonical origin and allow the exact Replit preview and published app origins used for testing. Signup confirmation redirects to the app origin; password recovery redirects to `/reset-password`, so allow that exact path for each origin too. If email confirmation is enabled, ensure the configured email provider can deliver confirmation and recovery messages.
- Teacher evidence uploads and meaningful portfolio content require at least one active performance standard in Supabase. If the catalog is empty, ask Lovable to populate it; do not add database migrations or edit generated schema files from Replit.
- Database schema, generated integration files, and Lovable-managed services remain governed by `AGENTS.md`. Do not migrate the database or edit generated files for Replit setup.
- Do not publish until the security and multi-user isolation checks required by the project README pass.
