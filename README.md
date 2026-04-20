<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0cbc0958-4583-4132-b4d9-86218e4115a1

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
3. Run the app: `npm run dev`

> For admin features (table management, user creation) to work locally, use `vercel dev` instead of `npm run dev`. This starts both the frontend and the `/api/admin-proxy` route together.

## Environment Variables

See [.env.example](.env.example) for the full list. Quick summary:

| Variable | Where it lives | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser + Netlify | Public — uncheck "Secret" in Netlify UI |
| `VITE_SUPABASE_ANON_KEY` | Browser + Netlify | Public by design; RLS enforces security |
| `VITE_GAS_WEBHOOK_URL` | Browser + Netlify | Public |
| `VITE_ADMIN_EMAIL` | Browser + Netlify | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Netlify Functions only** | **Secret — never prefix with `VITE_`** |

### Why the service-role key is server-only

`SUPABASE_SERVICE_ROLE_KEY` bypasses Supabase Row Level Security. If it were in the browser bundle, any visitor could extract it and read or delete all data. It lives exclusively in `netlify/functions/admin-proxy.ts`, which verifies the caller's JWT before performing any privileged operation.

### Adding a new public `VITE_` variable

1. Add it to `.env.local` and to Netlify's Environment Variables (uncheck "Secret").
2. Add its name to `SECRETS_SCAN_OMIT_KEYS` in [netlify.toml](netlify.toml) so the scanner does not block the build.

### Vercel dashboard checklist (first deploy)

1. Go to **Settings → Environment Variables**.
2. **Delete** `VITE_SUPABASE_SERVICE_ROLE_KEY` if it exists.
3. **Add** `SUPABASE_SERVICE_ROLE_KEY` — mark as **Sensitive**, available to all environments.
4. Add the remaining `VITE_*` variables for the Production environment.
