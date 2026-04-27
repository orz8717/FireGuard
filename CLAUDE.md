# FireGuard — Project Reference for Claude Sessions

## What Is This Project

FireGuard is a Hebrew-language fire-safety inspection management system for field technicians and office staff.
It manages customers, inspections, certificates, dynamic forms, and offline sync.
Deployed on Vercel. Backend is Neon (PostgreSQL). Frontend is React 19 + Vite + Tailwind CSS v4.

---

## How to Run Locally

**Do NOT use `npm run dev` directly** — the API routes require Vercel's dev server.

Run from PowerShell:
```powershell
.\dev.ps1
```

This script sets all required environment variables at the OS level (so `vercel dev` doesn't overwrite them) and then runs `vercel dev`.

`dev.ps1` is gitignored — it lives only on this machine at `c:\Users\Lap-1\FireGuard\dev.ps1`.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Server only | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Server only | HMAC-SHA256 key for JWT signing |
| `CLERK_SECRET_KEY` | Server only | Clerk (kept in env but unused in auth flow) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk (loaded but not used for auth) |
| `VITE_GAS_WEBHOOK_URL` | Frontend | Google Apps Script webhook |
| `VITE_ADMIN_EMAIL` | Frontend | orz7178@gmail.com |

In Vercel Dashboard, `DATABASE_URL` and `AUTH_SECRET` must be set for **Production** and **Preview** environments (Vercel blocks "Sensitive" vars from the Development environment — this is why `dev.ps1` exists).

---

## Authentication — Custom JWT (NOT Clerk)

Auth was migrated away from Clerk. The custom system works as follows:

**Login flow:**
1. Frontend calls `POST /api/auth` with `{ action: 'login', email, password }`
2. `api/auth.ts` queries the Neon `users` table
3. If `password_hash` is NULL → first login: hash the password and store it
4. Returns `{ token, user }` — token is HS256 JWT signed with `AUTH_SECRET`
5. Frontend stores token in `localStorage.fireguard_token` and user JSON in `localStorage.fireguard_session`

**Token verification:**
- All API routes call `verifyToken()` from `api/_auth.ts`
- 30-day expiry, HMAC-SHA256, timing-safe comparison
- `verifyUser(token)` in `admin-proxy.ts` is **synchronous** (not async)

**Password hashing:**
- Node.js `crypto.scrypt` with random 16-byte salt
- Stored as `"saltHex:keyHex"` in `users.password_hash` column

**Key files:**
- `api/_auth.ts` — shared JWT + scrypt utilities (never import this in frontend code)
- `api/auth.ts` — login and changePassword endpoints
- `src/lib/supabase.ts` — custom shim that replaces Supabase SDK, stores token in localStorage

---

## Database — Neon (PostgreSQL)

Connection string is in `DATABASE_URL`. Uses `@neondatabase/serverless`.

**CRITICAL — Neon SDK API:**
- `neon()` returns a **tagged-template function** — no `.query()` method exists on it
- `Pool` from the same package requires WebSocket configuration in serverless and crashes silently

The correct pattern for parameterised queries is to reconstruct the tagged-template call:

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function query(text: string, params: unknown[] = []): Promise<any[]> {
  const parts = text.split(/\$\d+/);
  const strings = Object.assign(parts, { raw: parts }) as unknown as TemplateStringsArray;
  return sql(strings, ...params) as unknown as Promise<any[]>;
}
```

This uses the HTTP transport (no WebSocket needed) and returns rows directly as `any[]`.

**Key tables:**
- `users` — id (UUID), email, name, phone, role (ADMIN/OFFICE/USER), is_active, password_hash
- Dynamic tables created at runtime via `create_dynamic_table` RPC

**Required migration (run once in Neon SQL editor):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

---

## API Routes (Vercel Serverless Functions)

All under `api/`:

| File | Endpoint | Purpose |
|---|---|---|
| `api/auth.ts` | `POST /api/auth` | Login (`action: 'login'`) and change password (`action: 'changePassword'`) |
| `api/admin-proxy.ts` | `POST /api/admin-proxy` | All DB operations: select/insert/upsert/update/delete + RPC calls |
| `api/_auth.ts` | (internal) | Shared JWT and password utilities — not an HTTP endpoint |

**admin-proxy actions:**
- `{ action: 'from', table, method, ... }` — CRUD operations
- `{ action: 'rpc', fnName, fnArgs }` — whitelisted RPC calls
- `{ action: 'listUsers' }` — returns all users
- `{ action: 'updateUserById', userId, userAttrs }` — update user fields or password

All requests to `admin-proxy` require `Authorization: Bearer <token>` header.

---

## Frontend Architecture

### Entry point
`index.tsx` → `App.tsx` — no Clerk provider. Auth state comes from localStorage via the supabase shim's `onAuthStateChange`.

### Supabase Shim (`src/lib/supabase.ts`)
A drop-in replacement for the Supabase JS client. The rest of the codebase calls `supabase.from(...)`, `supabase.auth.signInWithPassword(...)` etc. and this shim routes everything to `/api/admin-proxy` and `/api/auth` using the localStorage JWT token.

### Query builder (`src/lib/adminProxy.ts`)
Frontend fluent builder — mirrors Supabase's `.from(table).select().eq().limit().single()` API. Sends `POST /api/admin-proxy`. Reads the token via `localStorage.getItem('fireguard_token')`.

### Connection status (`src/hooks/useConnectionStatus.ts`)
Checks internet (Google favicon ping) and database connectivity (fires `POST /api/admin-proxy` with stored token). Runs on mount and every 30 seconds. Drives `ConnectionBadge.tsx` which shows Hebrew status labels.

### Offline-first sync
`services/syncEngine.ts` + `services/localDb.ts` (Dexie/IndexedDB) — local writes queue and sync to Neon when online.

---

## Roles and Permissions

Three roles defined in the `users` table:
- `ADMIN` — full access to all screens
- `OFFICE` — limited access
- `USER` — field technician

Permission checks live in `src/context/PermissionContext.tsx` and `src/constants/screens.tsx`.

---

## File Structure

```
FireGuard/
├── api/
│   ├── _auth.ts          ← JWT + scrypt utilities (server only)
│   ├── auth.ts           ← /api/auth endpoint
│   └── admin-proxy.ts    ← /api/admin-proxy endpoint
├── src/
│   ├── lib/
│   │   ├── supabase.ts       ← Auth + DB shim (localStorage JWT)
│   │   ├── supabaseClient.ts ← Re-exports from supabase.ts
│   │   ├── adminProxy.ts     ← Frontend query builder
│   │   └── connectionGuard.ts
│   ├── hooks/
│   │   └── useConnectionStatus.ts ← DB + internet health check
│   ├── context/
│   │   ├── PermissionContext.tsx
│   │   └── SyncContext.tsx
│   ├── constants/
│   │   ├── screens.tsx   ← Screen list with lazy imports + permissions
│   │   └── config.ts
│   └── utils/
│       └── idGenerators.ts
├── pages/                ← Page components (Dashboard, Customers, Inspections, etc.)
├── components/           ← Shared UI components
│   ├── ErrorBoundary.tsx
│   ├── Layout.tsx
│   ├── DynamicForm.tsx
│   ├── BarcodeScanner.tsx
│   └── DatabaseFixModal.tsx
├── hooks/                ← Custom hooks (useBotRealtime, useDraftManager, etc.)
├── services/             ← Business logic (syncEngine, localDb, dbService, etc.)
├── utils/                ← Utility functions
├── index.html            ← Google Fonts loaded here as <link> tags (NOT in CSS)
├── index.css             ← Tailwind v4 @import at top; no @import url() after it
├── index.tsx             ← React root, no ClerkProvider
├── App.tsx               ← Main app, auth state, screen routing
├── types.ts              ← Global TypeScript types
├── vercel.json           ← SPA rewrite: /((?!api/|@|__|node_modules/)[^.]*)
├── vite.config.ts
├── dev.ps1               ← Local dev script (gitignored)
└── supabase_rpc.sql      ← SQL for DB functions
```

---

## Deployment

**Platform:** Vercel (hobby plan)
**Build:** `npm run build` → `dist/`
**Framework:** Vite

`vercel.json` SPA rewrite regex:
```json
"source": "/((?!api/|@|__|node_modules/)[^.]*)"
```
This excludes paths with a file extension AND Vite internals (`@react-refresh`, `@vite/client`, `__vite_ping`).

---

## Known Gotchas

1. **Neon `sql.query()` returns `QueryResult`, not an array** — always use the `query()` wrapper that returns `result.rows`.
2. **`verifyUser()` in admin-proxy is synchronous** — do not `await` it.
3. **Google Fonts must be `<link>` tags in `index.html`**, not `@import url(...)` in CSS — Tailwind v4 expands to thousands of lines first, violating CSS `@import` spec ordering.
4. **Vercel overwrites `.env.local`** with only `VERCEL_OIDC_TOKEN` on `vercel dev`. Always use `dev.ps1` for local development.
5. **First login sets the password** — if `password_hash` is NULL, the first successful login hashes whatever password was entered and stores it. No manual user setup needed.
6. **Clerk packages are still installed** (`@clerk/react`, `@clerk/backend`) but are not used in the auth flow. Do not remove them without checking all imports — some files may still reference Clerk types.

---

## Git

Remote: `https://github.com/orz8717/FireGuard`
Main branch: `main`
Git user: `orz7178`
