# CO Consulting dashboard

Christians personlige CRM og dashboard: én `index.html`, Supabase og Cloudflare Pages Functions, ingen build.
Deployer automatisk til Cloudflare Pages ved push til `main`.
Nøglerne (`GMAIL_URL`, `GMAIL_NOEGLE`, `TODOIST_TOKEN`) ligger som Secrets i Cloudflare-projektet, aldrig her. Se `CLAUDE.md`.
