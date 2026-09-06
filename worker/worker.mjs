/**
 * ============================================================================
 *  GoPromotes backend — Cloudflare Worker (server-side auth + stats + config)
 * ============================================================================
 *  Turns the static GoPromotes admin panel into a genuinely secure, server-
 *  side system AND adds real cross-device statistics:
 *
 *    POST   /api/login             verify passphrase server-side (PBKDF2-SHA256
 *                                  against Worker SECRETS — never ships to the
 *                                  browser), return a signed session token
 *    GET    /api/session           validate the current Bearer token (200/401)
 *    DELETE /api/session           invalidate the session token (logout)
 *    GET    /api/stats             aggregated per-post views + affiliate clicks
 *                                  + last-30-days series (requires session)
 *    GET    /api/click?slug=<id>   302-redirect to the post's affiliate URL and
 *                                  count the click (server-counted CTA clicks)
 *    POST   /api/click             record an affiliate click (beacon fallback)
 *    POST   /api/view              record a page view (beacon from the site)
 *    GET    /api/affiliate-config  public: { default, overrides } — the site
 *                                  fetches this at page-load and swaps hrefs
 *    PUT    /api/affiliate-config  { slug, url } set/clear a per-post override
 *                                  (admin only)
 *    GET    /api/health            { ok:true } for the admin "test connection"
 *
 *  Security properties:
 *   - The PBKDF2 verifier (ADMIN_SALT / ADMIN_HASH / ADMIN_ITER) lives in
 *     Worker secrets — it is NEVER in the repo or the browser.
 *   - Login is rate-limited per IP (5 failures → 10-minute lockout, tracked in
 *     KV) — genuinely non-bruteforceable. A 429 is returned while locked.
 *   - Sessions are signed tokens: base64url(payload).base64url(HMAC-SHA256),
 *     where payload = { jti (random 256-bit), exp (12 h) }. The signature is
 *     keyed by SESSION_SECRET (or, if unset, a stable key derived from the
 *     ADMIN_SALT + ADMIN_HASH secrets). Validation checks the signature and
 *     expiry; revoked/expired tokens are rejected. The admin page keeps the
 *     token in sessionStorage and sends it as an `Authorization: Bearer`
 *     header (Bearer, not a cookie, so it works cross-origin from GitHub
 *     Pages without the HttpOnly-cookie dance; if you ever serve the admin
 *     from the SAME origin as this Worker, switch to an HttpOnly cookie for
 *     an extra layer).
 *   - KV counters are eventually consistent — exact enough for click/view
 *     dashboards; under extreme bursts a count may drift by ±a few. If you
 *     outgrow KV, move the counters to D1 (Cloudflare's SQLite) — same API
 *     shape, real transactions.
 *   - Slugs are validated against /^[a-z0-9][a-z0-9-]{0,63}$/ before any KV
 *     write, so untrusted input can never forge KV keys.
 *
 *  Deploy (full copy-paste guide: DEPLOY-CLOUDFLARE.md in the site root):
 *    npm i -g wrangler
 *    wrangler login
 *    wrangler kv namespace create GP_KV          # copy the returned id ↓
 *    # paste the KV id into wrangler.toml → id = "…"
 *    wrangler secret put ADMIN_HASH              # PBKDF2 hex hash of passphrase
 *    wrangler secret put ADMIN_SALT              # hex salt (16 bytes = 32 hex)
 *    wrangler secret put ADMIN_ITER              # 600000
 *    wrangler secret put SESSION_SECRET          # any long random string
 *    wrangler deploy
 *  Generate the salt/hash exactly as documented in admin-config.js (600,000
 *  iterations). The SAME PBKDF2 values that are in admin-config.js will work —
 *  that file is the static fallback; these secrets are the real gate.
 * ============================================================================
 */

const DEFAULT_AFFILIATE = "https://appsumo.8odi.net/Ag17e7";
const SESSION_TTL_SECONDS = 12 * 60 * 60;        // 12 h sessions
const LOGIN_RATE_MAX = 5;                         // failed logins…
const LOGIN_RATE_WINDOW_SECONDS = 10 * 60;        // …per 10 minutes per IP
const DAY_TTL_SECONDS = 45 * 24 * 60 * 60;        // keep daily rollups 45 days
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;      // KV-key-safe slug

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

/* --------------------------------------------------------------------------
 * Small utilities
 * ------------------------------------------------------------------------ */
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json;charset=UTF-8", ...CORS }
  });
}
function err(message, status) {
  return json({ ok: false, error: message }, status || 400);
}
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}
function constEqHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function pbkdf2Hex(pass, saltHex, iterations) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    material, 256
  );
  return bytesToHex(new Uint8Array(bits));
}
async function hmacKey(env) {
  // Stable per-deployment key: explicit SESSION_SECRET, else derived from the
  // two admin secrets (so sessions survive restarts without extra config).
  const raw = env.SESSION_SECRET || (env.ADMIN_SALT + ":" + env.ADMIN_HASH) || "gopromotes-dev-only";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signToken(env, payload) {
  const key = await hmacKey(env);
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return body + "." + b64url(new Uint8Array(sig));
}
async function verifyToken(env, token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sigB64] = token.split(".");
  try {
    const key = await hmacKey(env);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), new TextEncoder().encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}
async function readJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ||
         request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
         "unknown";
}
function cleanSlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  return SLUG_RE.test(s) ? s : null;
}

/* KV helpers ---------------------------------------------------------------- */
async function kvInc(env, key, ttlSeconds) {
  const cur = parseInt((await env.GP_KV.get(key)) || "0", 10) || 0;
  const next = cur + 1;
  await env.GP_KV.put(key, String(next), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
  return next;
}
async function kvListNames(env, prefix, cap) {
  const names = [];
  let cursor;
  const limit = 1000;
  do {
    const page = await env.GP_KV.list({ prefix, cursor, limit });
    for (const k of page.keys) {
      names.push(k.name);
      if (cap && names.length >= cap) return names;
    }
    cursor = page.cursor;
  } while (cursor);
  return names;
}

/* Recording ----------------------------------------------------------------- */
async function recordView(env, slug) {
  await kvInc(env, "agg:views:" + slug);
  await kvInc(env, "day:" + todayUTC() + ":view:" + slug, DAY_TTL_SECONDS);
}
async function recordClick(env, slug) {
  await kvInc(env, "agg:clicks:" + slug);
  await kvInc(env, "day:" + todayUTC() + ":click:" + slug, DAY_TTL_SECONDS);
  await env.GP_KV.put("lastclick:" + slug, new Date().toISOString(), { expirationTtl: DAY_TTL_SECONDS });
}

/* Sessions + auth ------------------------------------------------------------ */
async function createSession(env) {
  const jti = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signToken(env, { jti, exp });
  // Keep a KV record keyed by jti so logout can revoke immediately and so we
  // can list/limit active sessions later if needed.
  await env.GP_KV.put("session:" + jti, String(exp), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}
async function destroySession(env, token) {
  const payload = await verifyToken(env, token);
  if (payload && payload.jti) await env.GP_KV.delete("session:" + payload.jti);
}
async function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}
async function isAuthed(request, env) {
  const token = await bearerToken(request);
  if (!token) return false;
  const payload = await verifyToken(env, token);
  if (!payload || !payload.jti) return false;
  // Token must be signed AND still listed in KV (revoked tokens fail here).
  return (await env.GP_KV.get("session:" + payload.jti)) !== null;
}

/* Login rate limiting (per IP, KV-backed) ------------------------------------ */
async function loginFailCount(env, ip) {
  const raw = await env.GP_KV.get("rl:login:" + ip);
  return raw ? parseInt(raw, 10) || 0 : 0;
}
async function incLoginFail(env, ip) {
  const n = (await loginFailCount(env, ip)) + 1;
  await env.GP_KV.put("rl:login:" + ip, String(n), { expirationTtl: LOGIN_RATE_WINDOW_SECONDS });
  return n;
}
async function clearLoginFails(env, ip) {
  await env.GP_KV.delete("rl:login:" + ip);
}

/* Aggregated stats ------------------------------------------------------------ */
async function buildStats(env) {
  const perPost = {};
  const totals = { views: 0, clicks: 0 };
  const days = {};
  const overrides = {};

  const aggKeys = await kvListNames(env, "agg:", 2000);
  for (const key of aggKeys) {
    const rest = key.slice("agg:".length);          // views:<slug> | clicks:<slug>
    const [type, slug] = [rest.split(":")[0], rest.slice(rest.indexOf(":") + 1)];
    if (!slug) continue;
    if (!perPost[slug]) perPost[slug] = { views: 0, clicks: 0, lastClick: null };
    const n = parseInt((await env.GP_KV.get(key)) || "0", 10) || 0;
    perPost[slug][type] = n;
    totals[type] += n;
  }

  const dayKeys = await kvListNames(env, "day:", 3000);
  for (const key of dayKeys) {
    // day:YYYY-MM-DD:view:slug  |  day:YYYY-MM-DD:click:slug
    const parts = key.split(":");
    if (parts.length < 4) continue;
    const date = parts[1], type = parts[2];
    if (type !== "view" && type !== "click") continue;
    if (!days[date]) days[date] = { views: 0, clicks: 0 };
    const n = parseInt((await env.GP_KV.get(key)) || "0", 10) || 0;
    days[date][type === "view" ? "views" : "clicks"] += n;
  }
  const daySeries = Object.keys(days).sort().slice(-30).map((d) => ({
    date: d, views: days[d].views, clicks: days[d].clicks
  }));

  const lcKeys = await kvListNames(env, "lastclick:", 2000);
  for (const key of lcKeys) {
    const slug = key.slice("lastclick:".length);
    if (perPost[slug]) perPost[slug].lastClick = await env.GP_KV.get(key);
  }

  const affKeys = await kvListNames(env, "aff:", 500);
  for (const key of affKeys) overrides[key.slice("aff:".length)] = await env.GP_KV.get(key);

  return { totals, perPost, days: daySeries, overrides };
}

async function listAffiliateOverrides(env) {
  const overrides = {};
  const affKeys = await kvListNames(env, "aff:", 500);
  for (const key of affKeys) overrides[key.slice("aff:".length)] = await env.GP_KV.get(key);
  return overrides;
}

/* --------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    /* ---- public: click redirect + counter ------------------------------ */
    if (path === "/api/click" && method === "GET") {
      const slug = cleanSlug(url.searchParams.get("slug"));
      if (!slug) return err("missing or invalid slug", 400);
      const override = await env.GP_KV.get("aff:" + slug);
      const target = override || env.DEFAULT_AFFILIATE || DEFAULT_AFFILIATE;
      await recordClick(env, slug);
      return Response.redirect(target, 302);
    }
    if (path === "/api/click" && method === "POST") {
      const body = await readJson(request);
      const slug = cleanSlug(body && body.slug);
      if (!slug) return err("missing or invalid slug", 400);
      await recordClick(env, slug);
      const override = await env.GP_KV.get("aff:" + slug);
      return json({ ok: true, target: override || env.DEFAULT_AFFILIATE || DEFAULT_AFFILIATE });
    }

    /* ---- public: page view --------------------------------------------- */
    if (path === "/api/view" && method === "POST") {
      const body = await readJson(request);
      const slug = cleanSlug(body && body.slug);
      if (!slug) return err("missing or invalid slug", 400);
      await recordView(env, slug);
      return json({ ok: true });
    }

    /* ---- public: affiliate config the site fetches at load -------------- */
    if (path === "/api/affiliate-config" && method === "GET") {
      const overrides = await listAffiliateOverrides(env);
      return json({ ok: true, default: env.DEFAULT_AFFILIATE || DEFAULT_AFFILIATE, overrides });
    }

    /* ---- admin: login (server-side PBKDF2 + per-IP rate limit) ---------- */
    if (path === "/api/login" && method === "POST") {
      const ip = clientIp(request);
      const fails = await loginFailCount(env, ip);
      if (fails >= LOGIN_RATE_MAX) {
        return json({ ok: false, error: "rate_limited", retryAfter: LOGIN_RATE_WINDOW_SECONDS }, 429);
      }
      const body = await readJson(request);
      const pass = body && typeof body.pass === "string" ? body.pass : "";
      if (!pass) return err("missing pass", 400);

      const saltHex = env.ADMIN_SALT || "";
      const hashHex = env.ADMIN_HASH || "";
      const iter = parseInt(env.ADMIN_ITER || "600000", 10) || 600000;
      if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) {
        return err("server misconfigured: ADMIN_SALT/ADMIN_HASH secrets missing", 500);
      }
      const candidate = await pbkdf2Hex(pass, saltHex, iter);
      if (!constEqHex(candidate, hashHex)) {
        const n = await incLoginFail(env, ip);
        return json({ ok: false, error: "bad_credentials", fails: n, max: LOGIN_RATE_MAX }, 401);
      }
      await clearLoginFails(env, ip);
      const token = await createSession(env);
      return json({ ok: true, token, expiresIn: SESSION_TTL_SECONDS });
    }

    /* ---- admin: session validation (used by the panel on boot) ---------- */
    if (path === "/api/session" && method === "GET") {
      if (!(await isAuthed(request, env))) return err("unauthorized", 401);
      return json({ ok: true, expiresIn: SESSION_TTL_SECONDS });
    }

    /* ---- admin: logout --------------------------------------------------- */
    if (path === "/api/session" && method === "DELETE") {
      await destroySession(env, await bearerToken(request));
      return json({ ok: true });
    }

    /* ---- admin: stats ---------------------------------------------------- */
    if (path === "/api/stats" && method === "GET") {
      if (!(await isAuthed(request, env))) return err("unauthorized", 401);
      const stats = await buildStats(env);
      return json({ ok: true, ...stats, defaultAffiliate: env.DEFAULT_AFFILIATE || DEFAULT_AFFILIATE });
    }

    /* ---- admin: set/clear a per-post affiliate override ----------------- */
    if (path === "/api/affiliate-config" && method === "PUT") {
      if (!(await isAuthed(request, env))) return err("unauthorized", 401);
      const body = await readJson(request);
      const slug = cleanSlug(body && body.slug);
      if (!slug) return err("missing or invalid slug", 400);
      if (body.url == null || body.url === "") {
        await env.GP_KV.delete("aff:" + slug);
      } else {
        const u = String(body.url);
        if (!/^https:\/\/[a-z0-9.-]/i.test(u)) return err("url must start with https://", 400);
        await env.GP_KV.put("aff:" + slug, u);
      }
      const overrides = await listAffiliateOverrides(env);
      return json({ ok: true, overrides });
    }

    /* ---- health ---------------------------------------------------------- */
    if (path === "/api/health") {
      return json({ ok: true, service: "gopromotes-backend" });
    }

    return err("not found", 404);
  }
};
