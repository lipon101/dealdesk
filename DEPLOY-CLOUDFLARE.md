# Deploy GoPromotes Backend to Cloudflare Workers + KV (FREE, lifetime, always-active)

This is the ready-to-deploy package for the GoPromotes admin backend. It gives
you **real server-side admin auth** (the passphrase is verified on Cloudflare,
never in the browser) and **real cross-device stats** (every visitor, every
device), for **free, for life, with no expiry and no sleep** — the Worker and
its KV store stay active even if the site is unused for months or years.

- **Worker code:** `worker/worker.mjs` (all endpoints, CORS, rate limiting)
- **Config:** `worker/wrangler.toml` (KV binding)
- **Client wiring (already done in this repo):** `admin.js`, `analytics.js`,
  `affiliate-config.js` auto-detect a Worker URL saved in the admin panel
  (Settings → Backend API) and gracefully fall back to local mode when no
  backend (or an unreachable one) is configured.

---

## 1. Why Cloudflare Workers + KV (recommended) vs Firebase

| Criterion | **Cloudflare Workers + KV** ✅ | Firebase (Spark free plan) |
|---|---|---|
| **Free tier** | 100,000 requests/day, KV 1 GB storage, unlimited reads/writes within quota, 10 ms CPU/request — generous and **permanent** | Quotas are generous but **usage-based**; some features need a billing account; free tier has no hard SLA and is subject to change |
| **"Lifetime" guarantee** | Free tier is a **standing offer** (like GitHub Pages) — no trial clock, no expiry. Workers do **not** sleep or cold-start | Free Spark plan does not expire per se, but Google has **project lifecycle/cleanup policies**: inactive projects can be flagged and deleted, and free-tier terms/quotas change more often |
| **Stays active if unused** | ✅ **Always active.** A Worker with zero traffic costs nothing and keeps serving the moment a request arrives. KV data persists indefinitely | ⚠️ Firebase has **periodic-activity / project-cleanup** expectations; an abandoned project risks deletion or quota surprises |
| **Auth security** | PBKDF2 verified **server-side** in the Worker with per-IP rate limiting (5 fails → 10-min lockout) — the hash never ships to the browser | Firebase Auth is secure but pulls in a Google account + SDK; overkill for a single-owner passphrase gate |
| **Cost at scale** | Still free up to 100k req/day; beyond that it's ~$0.30/million — effectively free for a deals blog | Free until quotas; sustained real traffic can push you to Blaze (pay-as-you-go) |
| **Setup friction** | One Worker + one KV namespace + 4 secrets. `wrangler` CLI, ~10 minutes | Console project + Firebase SDK + rules; heavier setup |
| **Lock-in / complexity** | Minimal — plain fetch handler, easy to read/move | Significant — Firebase SDK + service config in client code |

**Recommendation: Cloudflare Workers + KV.** It is the only one of the two that
is genuinely **free-forever AND always-active with no sleep and no expiry**,
which is exactly what was asked for. Firebase's Spark plan is fine for a hobby
project you check weekly, but it is not "lifetime / always-active" in the same
guaranteed sense: Google's inactive-project cleanup and evolving free-tier
terms make it the weaker fit. (If you already run on Firebase and don't want a
second account, the client in this repo is architected so you could point
`admin.js` at a Firebase Callable Function instead — but the Worker is the
primary, zero-account-friction path.)

> Free-tier honesty: Cloudflare's free tier is a *standing offer*, not a
> contractual SLA, and Workers/KV limits have changed over the years (always
> generous for a site of this size). "Lifetime" here means **no trial clock,
> no credit card, no sleep, no expiry** — the strongest free option available.

---

## 2. Deploy in ~10 minutes (copy-paste)

### 2.1 Prerequisites

- A free Cloudflare account (https://dash.cloudflare.com/sign-up) — **no
  credit card required**. You do NOT need a domain; the Worker gets a
  `*.workers.dev` URL automatically.
- Node.js 18+ (for wrangler).

### 2.2 Commands

```bash
# 1) Install Wrangler and log in (opens a browser to authorize)
npm i -g wrangler
wrangler login

# 2) Create the KV namespace (copy the printed id)
wrangler kv namespace create GP_KV
#    →  id = "abc123..."   ← paste this into worker/wrangler.toml below:
#       [[kv_namespaces]]  binding = "GP_KV"  id = "abc123..."
cd worker   # run the remaining commands from the worker/ folder

# 3) Set the secret passphrase verifier — same PBKDF2 values as admin-config.js
#    (generate fresh ones with tools/hash-generator.html if you prefer):
wrangler secret put ADMIN_SALT     # hex salt, 32 hex chars (16 bytes)
wrangler secret put ADMIN_HASH     # hex PBKDF2-SHA256 hash (64 hex chars)
wrangler secret put ADMIN_ITER     # 600000
#    Optional but recommended — signs admin session tokens:
wrangler secret put SESSION_SECRET # any long random string (e.g. openssl rand -hex 32)

# 4) Deploy!
wrangler deploy
#    → prints your live URL, e.g.  https://gopromotes-backend.<your-subdomain>.workers.dev
```

### 2.3 Connect the site to the Worker

1. Open your admin panel:
   `https://gopromotes.com/ca1726777db73e40db30975d6b115f9b3453.html`
2. **Settings → Backend API** → paste your Worker URL
   (`https://gopromotes-backend.<your-subdomain>.workers.dev`) → **Save & test**
   (it calls `/api/health`).
3. **Log out**, then log back in — the gate now POSTs to `/api/login` and the
   Worker verifies the passphrase **server-side**, rate-limited per IP.
4. The Dashboard now shows **real cross-device views/clicks** from KV, and
   affiliate overrides you set are pushed to the Worker so every visitor gets
   them at page-load.

---

## 3. Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/login` | — | Verify passphrase (PBKDF2-SHA256, server-side), return signed session token. 5 fails/IP → 429 for 10 min |
| `GET /api/session` | Bearer | Validate current session (200/401) |
| `DELETE /api/session` | Bearer | Logout / revoke token |
| `GET /api/stats` | Bearer | Aggregated per-post views + clicks + 30-day series |
| `GET /api/click?slug=<id>` | — | 302-redirect to the post's affiliate URL and count the click |
| `POST /api/click` | — | Beacon: record an affiliate click |
| `POST /api/view` | — | Beacon: record a page view |
| `GET /api/affiliate-config` | — | Public: `{ default, overrides }` — pages fetch this to swap CTAs |
| `PUT /api/affiliate-config` | Bearer | Set/clear a per-post affiliate override |
| `GET /api/health` | — | `{ ok: true }` for the admin "Save & test" |

## 4. How the free, always-active property works

- Cloudflare Workers run on demand — there is **no server to keep awake** and
  **no idle shutdown**. A Worker with zero traffic for a year still answers the
  next request instantly, and KV data persists (no TTL is set on aggregates).
- Daily rollup keys expire after **45 days** by design (bounded storage);
  aggregate counters (`agg:*`) are permanent.
- The free tier is **100k requests/day** — a deals blog of this size will use
  a tiny fraction of that. If you ever exceed it, Cloudflare simply starts
  billing at ~$0.30 per additional million requests; nothing breaks.

## 5. Verify your deployment

```bash
curl https://gopromotes-backend.<your-subdomain>.workers.dev/api/health
# → {"ok":true,"service":"gopromotes-backend"}

curl -X POST https://gopromotes-backend.<your-subdomain>.workers.dev/api/login \
  -H "Content-Type: application/json" \
  -d '{"pass":"YOUR_PASSPHRASE"}'
# → {"ok":true,"token":"…","expiresIn":43200}   (wrong pass → 401; 5 fails → 429)
```

## 6. Troubleshooting

- **"server misconfigured" on login** → `ADMIN_SALT`/`ADMIN_HASH` secrets not
  set (step 2.2 #3).
- **CORS errors from the admin page** → the Worker already sends
  `Access-Control-Allow-Origin: *`; if you changed CORS, re-check the headers.
- **Stats show zeros after connecting** → views are only sent for real article
  pages (not index/category/admin), one per browser per day; clicks only on
  affiliate taps. Give it traffic and refresh.
- **Old 310k secret still set** → `wrangler secret put ADMIN_ITER` (600000) so
  the Worker matches admin-config.js; or set it to whatever iteration count
  your admin-config.js hash uses — they must agree.
