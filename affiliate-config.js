/* =========================================================================
   DealDesk — affiliate-link override runtime
   -------------------------------------------------------------------------
   Every article loads this file. On load it:
     1. reads local overrides (localStorage — written by the admin panel),
     2. applies the default affiliate link (or the per-post override), then
     3. IF a backend URL is configured (admin Settings tab → saved to
        localStorage under `dd_backend_url`), fetches the live affiliate
        config from the Cloudflare Worker (GET /api/affiliate-config) and
        re-applies the server truth — so an override set from ANY device
        applies site-wide instantly, no rebuild.
   Then it rewrites EVERY matching CTA href on the page to the configured
   URL. Only `https://appsumo.8odi.net/...` links (and any link tagged
   data-aff-swap) are touched — internal links are never modified.

   Security note: affiliate links are public configuration — fine to serve
   client-side. The Worker version additionally lets the admin redirect
   clicks THROUGH /api/click?slug=... for server-counted 302s (see README).
   ========================================================================= */

(function () {
  "use strict";

  var DEFAULT_LINK = "https://appsumo.8odi.net/Ag17e7";
  var OVERRIDES = {};                 /* { slug: "https://..." } */
  var LOCAL_KEY = "dd_aff_overrides_v1";
  var BACKEND_KEY = "dd_backend_url"; /* shared with analytics.js + admin.js */

  function backendUrl() {
    try { return localStorage.getItem(BACKEND_KEY) || null; } catch (e) { return null; }
  }

  /* Post slug for THIS page (from the filename, matching posts-manifest). */
  function currentSlug() {
    var path = location.pathname.split("/").pop() || "";
    var map = {
      "wp-security-ninja-review.html": "wp-security-ninja",
      "amical-review.html": "amical",
      "tidycal-review.html": "tidycal",
      "zerorank-ai-review.html": "zerorank-ai",
      "dealdrive-review.html": "dealdrive",
      "inbox-review.html": "inbox",
      "essential-addons-elementor-review.html": "essential-addons"
    };
    return map[path] || null;
  }

  function mergeLocalOverrides() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      Object.keys(parsed).forEach(function (slug) { OVERRIDES[slug] = parsed[slug]; });
    } catch (e) {}
  }

  /* Rewrite every CTA on the page to `targetUrl`. Returns # of links hit. */
  function applySwap(targetUrl) {
    var links = document.querySelectorAll('a[href*="appsumo.8odi.net"], a[data-aff-swap]');
    var changed = 0;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var use = (a.getAttribute("href") || "").indexOf("appsumo.8odi.net") !== -1 ||
                a.hasAttribute("data-aff-swap");
      if (!use) continue;
      a.setAttribute("href", targetUrl);
      a.setAttribute("rel", "sponsored nofollow");
      if (!a.getAttribute("target")) a.setAttribute("target", "_blank");
      changed++;
    }
    return changed;
  }

  function resolveTarget() {
    var slug = currentSlug();
    return (slug && OVERRIDES[slug]) ? OVERRIDES[slug] : DEFAULT_LINK;
  }

  function applyAll() { applySwap(resolveTarget()); }

  /* Fetch the server-side affiliate config (if a backend is configured) and
     re-apply — this is what makes an override set in the admin panel reach
     every visitor on every device without redeploying. */
  function fetchRemoteConfig() {
    var base = backendUrl();
    if (!base) return;
    fetch(base.replace(/\/+$/, "") + "/api/affiliate-config", { method: "GET" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;
        if (data.default) DEFAULT_LINK = data.default;
        if (data.overrides) {
          Object.keys(data.overrides).forEach(function (slug) { OVERRIDES[slug] = data.overrides[slug]; });
        }
        applyAll();
      })
      .catch(function () { /* offline / not deployed — local state stays */ });
  }

  /* Push an override to the backend so it becomes site-wide (admin only;
     silently no-ops when no backend is configured). */
  function saveRemoteOverride(slug, url) {
    var base = backendUrl();
    if (!base) return Promise.resolve(false);
    var token = null;
    try { token = sessionStorage.getItem("dd_admin_backend_token"); } catch (e) {}
    return fetch(base.replace(/\/+$/, "") + "/api/affiliate-config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? "Bearer " + token : ""
      },
      body: JSON.stringify({ slug: slug, url: url || null })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function run() {
    mergeLocalOverrides();
    applyAll();
    fetchRemoteConfig();
  }

  /* Export helpers for the admin panel (same-origin) */
  window.DealDeskAffiliate = {
    getOverrides: function () { return OVERRIDES; },
    setOverride: function (slug, url) {
      OVERRIDES[slug] = url;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(OVERRIDES)); } catch (e) {}
      if (currentSlug() === slug) applyAll();
      saveRemoteOverride(slug, url);              /* site-wide when backend up */
    },
    clearOverride: function (slug) {
      delete OVERRIDES[slug];
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(OVERRIDES)); } catch (e) {}
      if (currentSlug() === slug) applyAll();
      saveRemoteOverride(slug, null);             /* clears server-side too */
    },
    defaultLink: DEFAULT_LINK,
    backendUrl: backendUrl
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
