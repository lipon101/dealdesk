/* =========================================================================
   GoPromotes — admin.js  (hidden control panel logic)
   -------------------------------------------------------------------------
   Single-page app behind the login gate. Authentication is Firebase Auth
   ONLY (firebase-config.js → enabled:true with the real gopromotes-admin
   project): email/password or Google sign-in, verified SERVER-SIDE by
   Google; the signed-in email must match the adminEmails allow-list. There
   is no secret in the source that can be stolen or bypassed, so a PUBLIC
   repo cannot be used to forge access or swap affiliate links. The legacy
   passphrase / PBKDF2 gate was removed in v18 — no passphrase works.

   Stats are local-first (this browser) with an optional Cloudflare Worker
   backend for real cross-device numbers; affiliate-link overrides are
   local-first too. The worker code itself is no longer shipped in this
   repo (see the v17 commit if you ever need it).

   This panel is intentionally NOT linked from any public page — it lives
   at /lostsec.html, robots.txt disallows it, and it is noindex.
   ========================================================================= */

(function () {
  "use strict";

  var CFG = window.DD_ADMIN_CFG;
  if (!CFG) { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">admin-config.js missing. This panel is broken — check the file list.</p>'; return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var state = { view: "dashboard" };

  /* ---------- tiny DOM helpers ---------- */
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
    try { return localStorage.getItem(CFG.backendUrlKey) || CFG.backendUrl || null; } catch (e) { return CFG.backendUrl || null; }
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

  /* ---------- session ---------- */
  function sessionGet() {
    try {
      if (sessionStorage.getItem(CFG.sessionKey)) return "firebase";
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
      if (window.__gpFb) { window.__gpFb.ns.signOut(window.__gpFb.auth).catch(function () {}); }
    } catch (e) {}
  }

  /* ---------- backend API helpers (optional Cloudflare Worker) ---------- */
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

  /* ---------- Firebase Auth (the ONLY login) ---------- */
  function fbCfg() { return window.DD_FIREBASE_CFG || null; }
  function fbEnabled() {
    var c = fbCfg();
    return !!(c && c.enabled === true && c.config && c.config.apiKey &&
              !/REPLACE/i.test(c.config.apiKey) && !/your-project/i.test(c.config.projectId || ""));
  }
  function fbIsAllowed(email) {
    var c = fbCfg(); var list = (c && c.adminEmails) || [];
    email = String(email || "").toLowerCase().trim();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i] || "").toLowerCase().trim() === email) return true;
    }
    return false;
  }
  var FB_MODULES_URL = "https://www.gstatic.com/firebasejs/10.12.2/";
  function fbLoad() {
    if (fbLoad._p) return fbLoad._p;
    fbLoad._p = Promise.all([
      import(FB_MODULES_URL + "firebase-app.js"),
      import(FB_MODULES_URL + "firebase-auth.js")
    ]).then(function (m) { return { app: m[0], auth: m[1] }; });
    return fbLoad._p;
  }
  function gateMessage(text, isInfo) {
    var err = $("#gateError");
    if (!err) return;
    err.className = "gate-error show" + (isInfo ? " info" : "");
    err.textContent = text;
  }
  function bootFirebase() {
    var c = fbCfg();
    $("#fbAuth").classList.remove("hidden");
    $("#gate").classList.remove("hidden");
    $("#app").classList.add("hidden");
    /* Hide the Google option + "or" divider when googleEnabled is false. */
    if (!(c && c.googleEnabled)) {
      var gb = $("#fbGoogleBtn"); if (gb) gb.style.display = "none";
      var or = $("#fbOr"); if (or) or.style.display = "none";
    }
    fbLoad().then(function (mods) {
      var app = mods.app.initializeApp(c.config, "gopromotes-admin");
      var auth = mods.auth.getAuth(app);
      window.__gpFb = { ns: mods.auth, auth: auth };
      auth.onAuthStateChanged(function (user) {
        if (user && fbIsAllowed(user.email)) {
          try { sessionStorage.setItem(CFG.sessionKey, "firebase"); } catch (e) {}
          enterApp();
        } else if (user) {
          mods.auth.signOut(auth).catch(function () {});
          gateMessage("Access denied: " + esc(user.email || "this account") + " is not on the admin allow-list.");
        } else {
          try { sessionStorage.removeItem(CFG.sessionKey); } catch (e) {}
          var err = $("#gateError");
          if (err) err.className = "gate-error";
        }
      });
      bindFirebase(mods, auth);
    }).catch(function (err) {
      gateMessage("Firebase could not load: " + esc((err && err.message) || err) + " — check firebase-config.js, then reload.");
    });
  }
  function bindFirebase(mods, auth) {
    var loginBtn = $("#fbLoginBtn"), googleBtn = $("#fbGoogleBtn"), passIn = $("#fbPass");
    function attempt(p) {
      if (loginBtn) loginBtn.disabled = true;
      if (googleBtn) googleBtn.disabled = true;
      gateMessage("Signing in…", true);
      p.then(function (cred) {
        var u = cred.user;
        if (!fbIsAllowed(u.email)) {
          mods.auth.signOut(auth).catch(function () {});
          gateMessage("Access denied: " + esc(u.email || "this account") + " is not on the admin allow-list.");
        } else {
          try { sessionStorage.setItem(CFG.sessionKey, "firebase"); } catch (e) {}
          enterApp();
        }
      }).catch(function (err) {
        if (loginBtn) loginBtn.disabled = false;
        if (googleBtn) googleBtn.disabled = false;
        var msg = (err && err.message) || String(err);
        if (err && err.code === "auth/invalid-credential") msg = "Incorrect email or password.";
        else if (err && err.code === "auth/user-not-found") msg = "No account found with that email.";
        else if (err && err.code === "auth/popup-blocked") msg = "Google sign-in popup was blocked — allow popups for this site and try again.";
        gateMessage(msg);
      });
    }
    if (loginBtn) loginBtn.addEventListener("click", function () {
      var email = $("#fbEmail").value.trim(), pass = $("#fbPass").value;
      if (!email || !pass) { gateMessage("Enter your email and password."); return; }
      attempt(mods.auth.signInWithEmailAndPassword(auth, email, pass));
    });
    if (passIn) passIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && loginBtn) { e.preventDefault(); loginBtn.click(); }
    });
    if (googleBtn && mods.auth.GoogleAuthProvider) googleBtn.addEventListener("click", function () {
      attempt(mods.auth.signInWithPopup(auth, new mods.auth.GoogleAuthProvider()));
    });
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
      + '<div class="panel"><h2>Backend API (optional Cloudflare Worker)</h2>'
      + '<div class="panel-sub">Connect the Worker for <strong>real cross-device stats</strong> and server-side click counting. Free forever on Cloudflare\'s free tier. The worker code is not shipped in this repo anymore (see the v17 commit if you need it) — deploy it, then paste its URL here.</div>'
      + '<div class="form-row"><div class="field"><label>Worker URL (https://…workers.dev)</label><input type="url" id="backendEp" placeholder="https://gopromotes-backend.your-subdomain.workers.dev" value="' + esc(ep) + '"></div>'
      + '<button class="btn btn-primary" id="epSave">Save &amp; test</button></div>'
      + '<div class="inline-note" id="epStatus">' + (backendUrl() ? (authedBackend ? "<strong>Connected:</strong> " + esc(ep) + " — you are logged in server-side." : "<strong>Configured but not logged in server-side.</strong> Log out and log back in to obtain a server session, or check the URL.") : "<strong>No backend configured.</strong> Stats currently run locally (this browser only).") + "</div></div>"
      + '<div class="panel"><h2>Default affiliate link</h2>'
      + '<div class="panel-sub">Used by every CTA that has no per-post override. To change it permanently, edit <code>defaultAff</code> in posts-manifest.js and the <code>DEFAULT_LINK</code> in affiliate-config.js, then redeploy.</div>'
      + '<div class="form-row"><div class="field"><label>Current default</label><input type="url" id="defAff" value="' + esc(aff ? aff.defaultLink : "") + '" readonly style="background:var(--paper-2)"></div></div>'
      + '<div class="inline-note">Quick per-post swaps belong in the <strong>Affiliate links</strong> view — that writes an override you can verify live, export as JSON, and push to the backend.</div></div>'
      + '<div class="panel"><h2>Security model</h2>'
      + '<div class="settings-block"><p><strong>Firebase Auth enabled:</strong> identity is verified server-side by Google (email/password or Google sign-in). Only the allow-listed admin email(s) in <code>firebase-config.js</code> can enter the panel. The legacy passphrase was removed in v18 — no passphrase works. Remove an email from the Firebase console (Authentication → Users) to revoke access.</p>'
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
    $$(".side-nav button").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.view); }); });
    $("#logoutBtn").addEventListener("click", function () { sessionClear(); location.reload(); });
  }

  function bindView() {
    var v = state.view;
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
        if (!url) { saveBackendUrl(null); setBackendToken(null); status.innerHTML = "<strong>Backend removed.</strong> Stats are local again."; toast("Backend cleared."); return; }
        if (!/^https:\/\//i.test(url)) { toast("Enter a full https:// URL", true); return; }
        btn.disabled = true; btn.textContent = "Testing…";
        fetch(normUrl(url) + "/api/health").then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.ok) {
            saveBackendUrl(normUrl(url));
            status.innerHTML = "<strong>Connected ✓</strong> Worker reachable.";
            toast("Backend connected.");
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
    bindStatic();
    if (!fbEnabled()) {
      /* firebase-config.js is not enabled — show the gate with a clear
         message; the panel cannot be entered until Firebase is configured.
         (This state should not occur in the deployed site.) */
      $("#fbAuth").classList.remove("hidden");
      $("#gate").classList.remove("hidden");
      $("#app").classList.add("hidden");
      gateMessage("Firebase Auth is not configured. Open firebase-config.js, set enabled:true with your project values and your admin email in adminEmails, then push.", true);
      return;
    }
    if (sessionGet()) {
      enterApp();
    } else {
      bootFirebase();
    }
  });
  /* re-bind dynamic controls after each view render */
  var _origShow = show;
  show = function (view) { _origShow(view); bindView(); };
})();
