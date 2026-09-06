/* =========================================================================
   GoPromotes — admin.js  (hidden control panel logic)
   -------------------------------------------------------------------------
   Single-page app behind the login gate. Two auth modes:

     BACKEND MODE (recommended): when a Cloudflare Worker backend URL is
     configured (Settings → Backend API → saved to localStorage under
     `dd_backend_url`, or hardcoded in backendUrl below), the passphrase is
     POSTed to the Worker (/api/login). The Worker verifies PBKDF2-SHA256
     SERVER-SIDE against its own secrets, rate-limits per IP, and returns a
     session token (Bearer, stored in sessionStorage). The stats dashboard
     then reads REAL cross-device data from GET /api/stats, and affiliate
     overrides are written server-side (PUT /api/affiliate-config) so they
     apply to every visitor instantly.

     LOCAL MODE (automatic fallback): with no backend configured, the gate
     verifies PBKDF2 in the browser against admin-config.js (310,000
     iterations + exponential-backoff lockout) and the dashboard reads the
     local analytics in this browser. Honest limits: client-side auth is
     NOT truly secure on a static host — anyone with the source can read
     the hash. Deploy the Worker for real security (see README).

   This panel is intentionally NOT linked from any public page — it lives
   at a long secret slug, and robots.txt disallows it.
   ========================================================================= */

(function () {
  "use strict";

  var CFG = window.DD_ADMIN_CFG;
  if (!CFG) { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">admin-config.js missing. This panel is broken — check the file list.</p>'; return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var state = { view: "dashboard" };

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function toast(msg, isError) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (isError ? " error" : "");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = "toast"; }, 3800);
  }
  function fmt(n) { return (n || 0).toLocaleString("en-US"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function normUrl(u) { return (u || "").replace(/\/+$/, ""); }

  /* ---------- backend config (shared localStorage key) ---------- */
  function backendUrl() {
    try { return localStorage.getItem(CFG.backendUrlKey) || null; } catch (e) { return null; }
  }
  function saveBackendUrl(u) {
    try {
      if (u) localStorage.setItem(CFG.backendUrlKey, normUrl(u));
      else localStorage.removeItem(CFG.backendUrlKey);
    } catch (e) {}
  }
  function backendToken() {
    try { return sessionStorage.getItem(CFG.backendTokenKey) || null; } catch (e) { return null; }
  }
  function setBackendToken(t) {
    try { if (t) sessionStorage.setItem(CFG.backendTokenKey, t); else sessionStorage.removeItem(CFG.backendTokenKey); } catch (e) {}
  }

  /* ---------- PBKDF2 via Web Crypto (local-mode gate) ---------- */
  function pbkdf2(pass, saltHex, iterations) {
    var enc = new TextEncoder();
    var saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
    return crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: iterations, hash: "SHA-256" }, key, 256);
      })
      .then(function (bits) {
        return Array.prototype.map.call(new Uint8Array(bits), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
  }
  function constEq(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- lockout state (localStorage, exponential backoff) --------- */
  function getAttempts() {
    try { return JSON.parse(localStorage.getItem(CFG.attemptsKey) || "{}"); }
    catch (e) { return {}; }
  }
  function saveAttempts(a) { try { localStorage.setItem(CFG.attemptsKey, JSON.stringify(a)); } catch (e) {} }
  function lockoutRemaining() {
    var a = getAttempts();
    if (!a.until) return 0;
    var remain = a.until - Date.now();
    return remain > 0 ? remain : 0;
  }
  function registerFailure() {
    var a = getAttempts();
    a.fail = (a.fail || 0) + 1;
    var wait = CFG.lockoutMs * Math.pow(2, Math.min(a.fail - CFG.maxAttempts, 8));
    a.until = Date.now() + (a.fail >= CFG.maxAttempts ? wait : 0);
    saveAttempts(a);
    return a;
  }
  function resetAttempts() { try { localStorage.removeItem(CFG.attemptsKey); } catch (e) {} }

  /* ---------- session (local OR backend token) ---------- */
  function sessionGet() {
    try {
      if (sessionStorage.getItem(CFG.sessionKey)) return "local";
      if (backendToken()) return "backend";
    } catch (e) {}
    return null;
  }
  function sessionClear() {
    try {
      sessionStorage.removeItem(CFG.sessionKey);
      var tok = backendToken();
      setBackendToken(null);
      if (tok && backendUrl()) {
        fetch(normUrl(backendUrl()) + "/api/session", { method: "DELETE", headers: { "Authorization": "Bearer " + tok } })
          .catch(function () {});
      }
    } catch (e) {}
  }

  /* ---------- backend API helpers ---------- */
  function api(path, opts) {
    var base = backendUrl();
    if (!base) return Promise.reject(new Error("no backend"));
    var headers = { "Content-Type": "application/json" };
    var tok = backendToken();
    if (tok) headers["Authorization"] = "Bearer " + tok;
    return fetch(normUrl(base) + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          return { status: r.status, data: data };
        });
      });
  }

  /* ---------- boot: auth gate ---------- */
  function updateLockoutUI() {
    var remain = lockoutRemaining();
    var btn = $("#loginBtn"), input = $("#passInput"), err = $("#gateError");
    if (remain > 0) {
      var secs = Math.ceil(remain / 1000);
      if (btn) { btn.disabled = true; btn.textContent = "Locked — try again in " + secs + "s"; }
      if (input) input.disabled = true;
      if (err) { err.className = "gate-error show"; err.textContent = "Too many failed attempts. Locked for " + secs + " more second" + (secs === 1 ? "" : "s") + "."; }
      setTimeout(updateLockoutUI, 1000);
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = "Unlock dashboard"; }
    if (input) input.disabled = false;
    if (err) err.className = "gate-error";
  }

  function gateMessage(text, isInfo) {
    var err = $("#gateError");
    if (!err) return;
    err.className = "gate-error show" + (isInfo ? " info" : "");
    err.textContent = text;
  }

  /* Server-side login (Cloudflare Worker). The Worker rate-limits per IP;
     when it answers 429 we surface the real backoff instead of the local one. */
  function doBackendLogin(pass) {
    var btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "Verifying on server…";
    return fetch(normUrl(backendUrl()) + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: pass })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        if (r.ok && data && data.ok && data.token) {
          setBackendToken(data.token);
          resetAttempts();
          enterApp();
          return;
        }
        btn.disabled = false; btn.textContent = "Unlock dashboard";
        var input = $("#passInput"); if (input) input.value = "";
        if (r.status === 429) {
          var mins = Math.ceil((data && data.retryAfter ? data.retryAfter : 600) / 60);
          gateMessage("Too many failed attempts from this IP. Try again in about " + mins + " minute" + (mins === 1 ? "" : "s") + ".");
        } else {
          var a = registerFailure();
          if (a.fail >= CFG.maxAttempts) gateMessage("Incorrect passphrase. Security lockout starting.");
          else gateMessage("Incorrect passphrase. " + (CFG.maxAttempts - a.fail) + " attempt" + (CFG.maxAttempts - a.fail === 1 ? "" : "s") + " left before lockout.");
        }
      });
    }).catch(function () {
      btn.disabled = false; btn.textContent = "Unlock dashboard";
      gateMessage("Backend unreachable — check the URL in Settings, or deploy the Worker (README).");
    });
  }

  function doLocalLogin() {
    var input = $("#passInput");
    var pass = input.value;
    if (!pass) { gateMessage("Enter the admin passphrase."); return; }
    $("#loginBtn").disabled = true; $("#loginBtn").textContent = "Verifying…";
    pbkdf2(pass, CFG.salt, CFG.iterations).then(function (hex) {
      if (constEq(hex, CFG.hash)) {
        resetAttempts();
        try { sessionStorage.setItem(CFG.sessionKey, "ok-" + Date.now()); } catch (e) {}
        enterApp();
      } else {
        var a = registerFailure();
        input.value = "";
        $("#loginBtn").disabled = false; $("#loginBtn").textContent = "Unlock dashboard";
        if (a.fail >= CFG.maxAttempts) gateMessage("Incorrect passphrase. Security lockout starting.");
        else gateMessage("Incorrect passphrase. " + (CFG.maxAttempts - a.fail) + " attempt" + (CFG.maxAttempts - a.fail === 1 ? "" : "s") + " left before lockout.");
      }
    }).catch(function () {
      gateMessage("This browser does not support Web Crypto PBKDF2 — use a current Chrome, Edge, Firefox, or Safari.");
      $("#loginBtn").disabled = false; $("#loginBtn").textContent = "Unlock dashboard";
    });
  }

  function doLogin() {
    var remain = lockoutRemaining();
    if (remain > 0) return;
    var input = $("#passInput");
    var pass = input.value;
    if (!pass) { gateMessage("Enter the admin passphrase."); return; }
    if (backendUrl()) { doBackendLogin(pass); return; }
    doLocalLogin();
  }

  /* ---------- data: local vs backend stats ---------- */
  var BACKEND_CACHE = null;
  function loadStats() {
    if (backendUrl() && backendToken()) {
      return api("/api/stats").then(function (res) {
        if (res.status === 200 && res.data && res.data.ok) {
          BACKEND_CACHE = res.data;
          return { mode: "backend", stats: res.data };
        }
        if (res.status === 401) { setBackendToken(null); return { mode: "local", stats: localStats() }; }
        return { mode: "local", stats: localStats() };
      }).catch(function () { return { mode: "local", stats: localStats() }; });
    }
    return Promise.resolve({ mode: "local", stats: localStats() });
  }
  function localStats() { return window.DealDeskStats ? window.DealDeskStats.getAll() : {}; }

  /* ---------- views ---------- */
  var postById = {};
  (window.DD_POSTS || []).forEach(function (p) { postById[p.id] = p; });

  function catLabel(slug) {
    var c = (window.DD_CATEGORIES || []).filter(function (x) { return x.slug === slug; })[0];
    return c ? c.label : slug;
  }

  function renderDashboard() {
    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Dashboard</h1><div class="crumb">Site performance &amp; affiliate clicks</div></div>'
      + '<div class="right"><span class="badge-local" id="statModeBadge">Loading…</span>'
      + '<button class="btn btn-ghost btn-sm" id="refreshBtn">↻ Refresh</button></div></div>'
      + '<div class="panel" style="text-align:center;padding:40px" id="statsLoading">Loading statistics…</div>';

    var badge = $("#statModeBadge");
    if (backendUrl() && backendToken()) badge.textContent = "Backend tracking ON";
    else if (backendUrl()) badge.textContent = "Backend not logged in";
    else badge.textContent = "Local-only stats";

    loadStats().then(function (res) {
      if (res.mode === "backend") {
        renderBackendDashboard(res.stats);
      } else {
        renderLocalDashboard(res.stats);
      }
      bindDashboard();
    });
  }

  /* Backend (real cross-device) dashboard ---------------------------------- */
  function renderBackendDashboard(data) {
    var posts = window.DD_POSTS || [];
    var totals = data.totals || { views: 0, clicks: 0 };
    var perPost = data.perPost || {};
    var days = data.days || [];
    var clicked = posts.filter(function (p) { return (perPost[p.id] || {}).clicks > 0; }).length;

    var maxV = 1, maxC = 1;
    posts.forEach(function (p) {
      var s = perPost[p.id] || {};
      if ((s.views || 0) > maxV) maxV = s.views;
      if ((s.clicks || 0) > maxC) maxC = s.clicks;
    });
    var rows = posts.map(function (p) {
      var s = perPost[p.id] || {};
      var v = s.views || 0, c = s.clicks || 0;
      return "<tr>"
        + "<td><strong>" + esc(p.vendor) + "</strong><div style='font-size:.76rem;color:var(--ink-faint)'>" + esc(p.file) + "</div></td>"
        + "<td><span class='tag " + (p.category === "ai-stack" ? "tag-amber" : "tag-green") + "'>" + esc(catLabel(p.category)) + "</span></td>"
        + "<td class='num bar-cell'><span class='bar' style='width:" + Math.max(3, Math.round(v / maxV * 100)) + "%'></span><span style='position:relative'>" + fmt(v) + "</span></td>"
        + "<td class='num bar-cell'><span class='bar' style='width:" + Math.max(3, Math.round(c / maxC * 100)) + "%'></span><span style='position:relative'>" + fmt(c) + "</span></td>"
        + "<td class='num'>" + (s.lastClick ? esc(s.lastClick.slice(0, 10)) : "—") + "</td>"
        + "</tr>";
    }).join("");

    var chart = days.length ? days.map(function (d) {
      var h = Math.max(3, Math.round((d.views || 0) / 8));
      return '<div class="chart-col"><div class="chart-bar" style="height:' + Math.min(h, 120) + 'px" title="' + esc(d.date) + " — " + fmt(d.views) + " views, " + fmt(d.clicks) + " clicks\"></div><div class=\"chart-lbl\">" + esc(d.date.slice(5)) + "</div></div>";
    }).join("") : '<p style="color:var(--ink-faint);font-size:.86rem">No traffic recorded yet — the backend started counting the moment it went live.</p>';

    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Dashboard</h1><div class="crumb">Real cross-device stats via Cloudflare Worker + KV</div></div>'
      + '<div class="right"><span class="badge-live">Backend tracking ON</span>'
      + '<button class="btn btn-ghost btn-sm" id="refreshBtn">↻ Refresh</button></div></div>'
      + '<div class="stat-grid">'
      + '<div class="stat-card"><div class="k">Total views</div><div class="v">' + fmt(totals.views) + '</div><div class="d">across ' + posts.length + ' posts</div></div>'
      + '<div class="stat-card"><div class="k">Affiliate clicks</div><div class="v">' + fmt(totals.clicks) + '</div><div class="d">' + clicked + '/' + posts.length + ' posts clicked</div></div>'
      + '<div class="stat-card"><div class="k">Posts</div><div class="v">' + posts.length + '</div><div class="d">published guides</div></div>'
      + '<div class="stat-card"><div class="k">CTR (clicks/views)</div><div class="v">' + (totals.views ? Math.round(totals.clicks / totals.views * 100) + "%" : "—") + '</div><div class="d">all posts</div></div>'
      + '</div>'
      + '<div class="panel"><h2>Views &amp; clicks — last 30 days</h2>'
      + '<div class="chart-row">' + chart + '</div>'
      + '<div class="panel-sub" style="margin-top:6px">Counted server-side by the Worker (KV). Every visitor on every device is included; the local browser numbers below are not added to these.</div></div>'
      + '<div class="panel"><h2>Per-post performance</h2>'
      + '<div class="panel-sub">Views count one per post per day per browser (dedupe by the Worker); clicks count every affiliate tap through /api/click.</div>'
      + '<div class="table-scroll"><table class="grid"><thead><tr><th>Post</th><th>Category</th><th>Views</th><th>Clicks</th><th>Last click</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  /* Local (this browser only) dashboard ------------------------------------ */
  function renderLocalDashboard(stats) {
    var posts = window.DD_POSTS || [];
    var totalViews = 0, totalClicks = 0, clicked = 0;
    posts.forEach(function (p) {
      var s = stats[p.id] || {};
      totalViews += s.views || 0;
      totalClicks += s.clicks || 0;
      if (s.clicks) clicked++;
    });
    var maxV = 1, maxC = 1;
    posts.forEach(function (p) { var s = stats[p.id] || {}; if ((s.views||0) > maxV) maxV = s.views; if ((s.clicks||0) > maxC) maxC = s.clicks; });
    var rows = posts.map(function (p) {
      var s = stats[p.id] || {};
      var v = s.views || 0, c = s.clicks || 0;
      return "<tr>"
        + "<td><strong>" + esc(p.vendor) + "</strong><div style='font-size:.76rem;color:var(--ink-faint)'>" + esc(p.file) + "</div></td>"
        + "<td><span class='tag " + (p.category === "ai-stack" ? "tag-amber" : "tag-green") + "'>" + esc(catLabel(p.category)) + "</span></td>"
        + "<td class='num bar-cell'><span class='bar' style='width:" + Math.max(3, Math.round(v / maxV * 100)) + "%'></span><span style='position:relative'>" + fmt(v) + "</span></td>"
        + "<td class='num bar-cell'><span class='bar' style='width:" + Math.max(3, Math.round(c / maxC * 100)) + "%'></span><span style='position:relative'>" + fmt(c) + "</span></td>"
        + "<td class='num'>" + (s.lastClick ? esc(s.lastClick.slice(0, 10)) : "—") + "</td>"
        + "</tr>";
    }).join("");
    var mode = backendUrl() ? "Local fallback (backend not logged in)" : "Local-only stats";
    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Dashboard</h1><div class="crumb">Site performance &amp; affiliate clicks</div></div>'
      + '<div class="right"><span class="badge-' + (backendUrl() ? "warn" : "local") + '">' + esc(mode) + "</span>"
      + '<button class="btn btn-ghost btn-sm" id="refreshBtn">↻ Refresh</button></div></div>'
      + '<div class="stat-grid">'
      + '<div class="stat-card"><div class="k">Total views</div><div class="v">' + fmt(totalViews) + '</div><div class="d">across ' + posts.length + ' posts</div></div>'
      + '<div class="stat-card"><div class="k">Affiliate clicks</div><div class="v">' + fmt(totalClicks) + '</div><div class="d">' + clicked + '/' + posts.length + ' posts clicked</div></div>'
      + '<div class="stat-card"><div class="k">Posts</div><div class="v">' + posts.length + '</div><div class="d">published guides</div></div>'
      + '<div class="stat-card"><div class="k">CTR (clicks/views)</div><div class="v">' + (totalViews ? Math.round(totalClicks / totalViews * 100) + "%" : "—") + '</div><div class="d">all posts</div></div>'
      + '</div>'
      + '<div class="panel" style="border-left:3px solid var(--amber)"><h2>⚠ Local-only view</h2>'
      + '<div class="panel-sub">These numbers come from <strong>this browser only</strong> (localStorage) — not real site traffic. Connect the Cloudflare Worker backend in <strong>Settings → Backend API</strong> to count every visitor on every device.</div></div>'
      + '<div class="panel"><h2>Per-post performance</h2>'
      + '<div class="panel-sub">Views are counted once per post per day per browser; clicks count every affiliate tap. Local mode stores everything in this browser only.</div>'
      + '<div class="table-scroll"><table class="grid"><thead><tr><th>Post</th><th>Category</th><th>Views</th><th>Clicks</th><th>Last click</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  function bindDashboard() {
    var refresh = $("#refreshBtn");
    if (refresh) refresh.addEventListener("click", renderDashboard);
    $("#view").addEventListener("click", function (e) {
      var n = e.target.closest && e.target.closest("[data-nav-post]");
      if (n) { var p = postById[n.dataset.navPost]; if (p) window.open(p.file, "_blank"); }
    });
  }

  /* Affiliate links view ---------------------------------------------------- */
  function renderLinks() {
    var overrides = window.DealDeskAffiliate ? window.DealDeskAffiliate.getOverrides() : {};
    var posts = window.DD_POSTS || [];
    var opts = posts.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.vendor) + " — " + esc(p.file) + "</option>"; }).join("");
    var active = Object.keys(overrides).map(function (slug) {
      var p = postById[slug];
      return '<div class="override-item"><div style="min-width:0"><div class="slug">' + esc(p ? p.vendor : slug) + '</div>'
        + '<div class="url">' + esc(overrides[slug]) + "</div></div>"
        + '<div class="actions"><button class="btn btn-ghost btn-sm" data-clear="' + esc(slug) + '">Reset</button></div></div>';
    }).join("") || '<p style="color:var(--ink-faint);font-size:.86rem">No overrides yet — every post uses your default affiliate link.</p>';

    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Affiliate links</h1><div class="crumb">Change the affiliate URL of any post — applies instantly, no rebuild</div></div></div>'
      + '<div class="panel"><h2>Apply a new link to one post</h2>'
      + '<div class="panel-sub">Pick a post, paste the affiliate URL, and hit Apply. All CTA buttons on that post point at the new URL instantly — on this device now, and (when the Worker backend is connected) for every visitor, because the override is pushed to the server.</div>'
      + '<div class="form-row">'
      + '<div class="field"><label>Post</label><select id="affPost">' + opts + "</select></div>"
      + '<div class="field"><label>Affiliate URL</label><input type="url" id="affUrl" placeholder="https://your-identifier.trackdesk.com/xyz" value="https://appsumo.8odi.net/Ag17e7"></div>'
      + '<button class="btn btn-primary" id="affApply" style="flex:0 0 auto">Apply to this post</button>'
      + "</div>"
      + '<div class="inline-note"><strong>How it works:</strong> the override is saved locally (this browser) right now'
      + (backendUrl() && backendToken() ? " <strong>and pushed to the Worker</strong> (PUT /api/affiliate-config), so every visitor fetching the live config gets the new link at page-load." : " — the post reads it at load via <code>affiliate-config.js</code>, so you can verify it on this device. Connect the Worker backend in <strong>Settings</strong> to make overrides site-wide (server-pushed), or click <strong>Export overrides</strong> and upload the JSON beside your site files for a static deploy.") + "</div>"
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '<button class="btn btn-ghost" id="affExport">Export overrides (.json)</button>'
      + '<button class="btn btn-ghost" id="affResetAll" style="' + (active ? "" : "display:none") + '">Reset all to default</button>'
      + "</div></div>"
      + '<div class="panel"><h2>Active overrides</h2><div class="override-list">' + active + "</div></div>";
  }

  function renderCategories() {
    var cats = window.DD_CATEGORIES || [];
    var rows = cats.map(function (c) {
      var count = (window.DD_POSTS || []).filter(function (p) { return p.category === c.slug; }).length;
      return '<div class="cat-item"><span class="slug-pill">' + esc(c.slug) + '</span>'
        + '<input type="text" value="' + esc(c.label) + '" data-cat-slug="' + esc(c.slug) + '" maxlength="60">'
        + "<span style='font-size:.8rem;color:var(--ink-faint)'>" + count + " post" + (count === 1 ? "" : "s") + "</span></div>";
    }).join("");
    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Categories</h1><div class="crumb">Labels used across category.html, post cards and the admin</div></div></div>'
      + '<div class="panel"><h2>Category labels</h2>'
      + '<div class="panel-sub">These labels mirror the public navigation of the site. Rename a label here and it updates everywhere the manifest is used (homepage nav, archive tabs, admin tables). The slug (left, grey) is the stable id used in URLs — keep it unchanged.</div>'
      + '<div class="cat-list">' + rows + "</div>"
      + '<div style="margin-top:14px"><button class="btn btn-primary" id="catSave">Save labels</button></div>'
      + "</div>";
  }

  function renderSettings() {
    var aff = window.DealDeskAffiliate;
    var ep = backendUrl() || "";
    var authedBackend = !!(backendUrl() && backendToken());
    $("#view").innerHTML =
      '<div class="topbar"><div><h1>Settings</h1><div class="crumb">Backend API, default affiliate link, security &amp; data</div></div></div>'
      + '<div class="panel"><h2>Backend API (Cloudflare Worker)</h2>'
      + '<div class="panel-sub">Connect the Worker for <strong>server-side auth</strong> (the passphrase is verified on Cloudflare, never in the browser) and <strong>real cross-device stats</strong>. Free forever on Cloudflare\'s free tier. Deploy it first — full guide + code in README → "Cloudflare Worker backend".</div>'
      + '<div class="form-row"><div class="field"><label>Worker URL (https://…workers.dev)</label><input type="url" id="backendEp" placeholder="https://dealdesk-backend.your-subdomain.workers.dev" value="' + esc(ep) + '"></div>'
      + '<button class="btn btn-primary" id="epSave">Save &amp; test</button></div>'
      + '<div class="inline-note" id="epStatus">' + (backendUrl() ? (authedBackend ? "<strong>Connected:</strong> " + esc(ep) + " — you are logged in server-side." : "<strong>Configured but not logged in server-side.</strong> Log out and log back in to obtain a server session, or check the URL.") : "<strong>No backend configured.</strong> Login + stats currently run locally (this browser only).") + "</div></div>"
      + '<div class="panel"><h2>Default affiliate link</h2>'
      + '<div class="panel-sub">Used by every CTA that has no per-post override. To change it permanently, edit <code>defaultAff</code> in posts-manifest.js and the <code>DEFAULT_LINK</code> in affiliate-config.js, then redeploy.</div>'
      + '<div class="form-row"><div class="field"><label>Current default</label><input type="url" id="defAff" value="' + esc(aff ? aff.defaultLink : "") + '" readonly style="background:var(--paper-2)"></div></div>'
      + '<div class="inline-note">Quick per-post swaps belong in the <strong>Affiliate links</strong> view — that writes an override you can verify live, export as JSON, and push to the backend.</div></div>'
      + '<div class="panel"><h2>Security model</h2>'
      + '<div class="settings-block"><p><strong>' + (backendUrl() ? "Backend mode" : "Local mode") + ':</strong> ' + (backendUrl() ? "the passphrase is verified server-side (PBKDF2-SHA256 on the Worker, rate-limited per IP). The hash never ships to the browser." : "the passphrase is verified in this browser against a PBKDF2-SHA256 hash with exponential-backoff lockout. Because the site is static, the verifier travels with the source — a determined attacker with your files can bypass it. For real protection, deploy the Cloudflare Worker backend (below) — the passphrase then never leaves your browser in a form that can be replayed.") + "</p>"
      + '<p style="font-size:.8rem;color:var(--ink-faint)">Session ends when you close this tab, or use the Log out button in the sidebar.</p></div></div>'
      + '<div class="panel"><h2>Data</h2><div class="settings-block"><p>Local stats live in localStorage under <code>dd_stats_v1</code>. Clearing wipes views and clicks recorded in this browser. Backend stats live in Cloudflare KV (45-day retention on daily rollups) and are shown on the Dashboard.</p>'
      + '<button class="btn btn-ghost" id="statsClear" style="color:var(--bad);border-color:#e5b9b2">Clear local stats</button></div></div>';
  }

  function show(view) {
    state.view = view;
    $$(".side-nav button").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    if (view === "dashboard") renderDashboard();
    else if (view === "links") renderLinks();
    else if (view === "categories") renderCategories();
    else if (view === "settings") renderSettings();
    $("#view").scrollIntoView();
  }

  /* ---------- wiring ---------- */
  function bindStatic() {
    $("#loginBtn").addEventListener("click", doLogin);
    $("#passInput").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    $$(".side-nav button").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.view); }); });
    $("#logoutBtn").addEventListener("click", function () { sessionClear(); location.reload(); });
  }

  function bindView() {
    var v = state.view;
    if (v === "dashboard") {
      /* refresh bound inside renderDashboard via bindDashboard() */
    }
    if (v === "links") {
      $("#affApply").addEventListener("click", function () {
        var id = $("#affPost").value, url = $("#affUrl").value.trim();
        if (!/^https?:\/\//i.test(url)) { toast("Enter a full URL starting with https://", true); return; }
        if (window.DealDeskAffiliate) window.DealDeskAffiliate.setOverride(id, url);
        toast(backendUrl() && backendToken()
          ? "Applied to " + id + " — saved locally and pushed to the backend. All visitors now use the new link."
          : "Applied to " + id + " — the live post now uses the new link on this device.");
        setTimeout(renderLinks, 400);
      });
      $("#affExport").addEventListener("click", function () {
        var overrides = window.DealDeskAffiliate.getOverrides();
        var blob = new Blob([JSON.stringify({ generated: new Date().toISOString(), overrides: overrides }, null, 2)], { type: "application/json" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "affiliate-overrides.json"; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast("Exported affiliate-overrides.json — upload it beside your site files.");
      });
      $("#affResetAll").addEventListener("click", function () {
        if (!confirm("Reset every override to the default affiliate link?")) return;
        (window.DD_POSTS || []).forEach(function (p) { if (window.DealDeskAffiliate) window.DealDeskAffiliate.clearOverride(p.id); });
        toast("All overrides reset to default."); renderLinks();
      });
      $("#view").addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("[data-clear]");
        if (btn) { if (window.DealDeskAffiliate) window.DealDeskAffiliate.clearOverride(btn.dataset.clear); toast("Override cleared — post back to default."); renderLinks(); }
      });
    }
    if (v === "categories") {
      $("#catSave").addEventListener("click", function () {
        $$("#view [data-cat-slug]").forEach(function (inp) {
          var slug = inp.dataset.catSlug;
          var cat = (window.DD_CATEGORIES || []).filter(function (c) { return c.slug === slug; })[0];
          if (cat) cat.label = inp.value.trim() || cat.label;
        });
        toast("Category labels saved for this session. Edit posts-manifest.js to persist them site-wide.");
      });
    }
    if (v === "settings") {
      $("#epSave").addEventListener("click", function () {
        var url = $("#backendEp").value.trim();
        var btn = $("#epSave"), status = $("#epStatus");
        if (!url) { saveBackendUrl(null); setBackendToken(null); status.innerHTML = "<strong>Backend removed.</strong> Login + stats are local again."; toast("Backend cleared."); return; }
        if (!/^https:\/\//i.test(url)) { toast("Enter a full https:// URL", true); return; }
        btn.disabled = true; btn.textContent = "Testing…";
        fetch(normUrl(url) + "/api/health").then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.ok) {
            saveBackendUrl(normUrl(url));
            status.innerHTML = "<strong>Connected ✓</strong> Worker reachable. Log out and back in to enable server-side auth.";
            toast("Backend connected. Log out & back in to use server auth.");
          } else { toast("Reached the Worker but it answered unexpectedly.", true); }
        }).catch(function () { toast("Could not reach that Worker URL — check it is deployed and CORS-enabled.", true); })
        .finally(function () { btn.disabled = false; btn.textContent = "Save & test"; });
      });
      try {
        var savedEp = backendUrl();
        if (savedEp) $("#backendEp").value = savedEp;
      } catch (e) {}
      $("#statsClear").addEventListener("click", function () {
        if (!confirm("Clear all locally recorded views and clicks?")) return;
        if (window.DealDeskStats) window.DealDeskStats.clear();
        toast("Local stats cleared."); renderDashboard();
      });
    }
  }

  function enterApp() {
    $("#gate").classList.add("hidden");
    $("#app").classList.remove("hidden");
    show("dashboard");
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (sessionGet()) { enterApp(); } else {
      $("#gate").classList.remove("hidden");
      $("#app").classList.add("hidden");
      /* show which mode the gate will use */
      var hint = $(".gate-hint");
      if (hint && backendUrl()) hint.innerHTML = "Server-side verification via Cloudflare Worker (PBKDF2-SHA256, IP rate-limited).<br>Repeated failures trigger an automatic lockout.";
      else if (hint) hint.innerHTML = "PBKDF2-SHA256 verified in your browser with 310,000 iterations.<br>Repeated failures trigger an automatic lockout with backoff.";
    }
    bindStatic();
  });
  /* re-bind dynamic controls after each view render */
  var _origShow = show;
  show = function (view) { _origShow(view); bindView(); };
})();
