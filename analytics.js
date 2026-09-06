/* =========================================================================
   GoPromotes — analytics module (local-first, backend-capable)
   -------------------------------------------------------------------------
   Records page views + affiliate clicks. Two layers:

     (i)  LOCAL MODE (always on): localStorage (`dd_stats_v1`, `dd_viewed_*`).
          Used by the admin dashboard until a backend is configured. Counts
          only this browser.

     (ii) BACKEND MODE (optional, recommended): when a backend URL is saved
          (admin Settings tab → "Backend API" → stored under `dd_backend_url`,
          or hardcode `backendUrl` below), every event is ALSO POSTed to the
          Cloudflare Worker (/api/view, /api/click) so the admin dashboard
          shows REAL cross-device totals. The site keeps working if the
          Worker is unreachable (fire-and-forget with keepalive).

   Nothing here sets cookies or fingerprints users. Views are deduplicated
   to one per post per browser per day (local) — the Worker does the same
   per request by design (you can add dedupe there later if you need it).
   Load on every page via:  <script src="analytics.js" defer></script>
   ========================================================================= */

(function () {
  "use strict";

  var BACKEND_KEY = "dd_backend_url"; /* shared with affiliate-config.js + admin.js */

  var CFG = {
    /* Fallback URL used when localStorage has none (set it here to hardcode
       a backend into every deploy, e.g. "https://gopromotes-backend.xxx.workers.dev"). */
    backendUrl: null,
    statsKey: "dd_stats_v1",
    viewKeyPrefix: "dd_viewed_",
    /* same-origin slug overrides (for testing on file:// or sandbox paths) */
    slugOverrides: {
      "wp-security-ninja-review.html": "wp-security-ninja",
      "amical-review.html": "amical",
      "tidycal-review.html": "tidycal",
      "zerorank-ai-review.html": "zerorank-ai",
      "dealdrive-review.html": "dealdrive",
      "inbox-review.html": "inbox",
      "essential-addons-elementor-review.html": "essential-addons"
    }
  };

  function configuredBackend() {
    try {
      var saved = localStorage.getItem(BACKEND_KEY);
      if (saved) return saved;
    } catch (e) {}
    return CFG.backendUrl;
  }
  function base(url) { return (url || "").replace(/\/+$/, ""); }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* Derive the post slug from the current page filename. */
  function currentSlug() {
    var path = location.pathname.split("/").pop() || "index.html";
    if (CFG.slugOverrides[path]) return CFG.slugOverrides[path];
    var slug = path.replace(/\.html?$/i, "").replace(/-review$/i, "");
    return slug === "index" || slug === "category" || slug === "about" ||
           slug === "affiliate-disclosure" || slug === "post-template" ||
           slug === "ca1726777db73e40db30975d6b115f9b3453" ? null : slug;
  }

  /* ---------- page view (once per slug per calendar day per browser) ---- */
  function trackView() {
    var slug = currentSlug();
    if (!slug) return;
    var day = new Date().toISOString().slice(0, 10);
    var key = CFG.viewKeyPrefix + slug + "_" + day;
    try {
      if (localStorage.getItem(key)) return; /* already counted today */
      localStorage.setItem(key, "1");
    } catch (e) {}
    bump("views", slug, 1);
  }

  /* ---------- generic counter ------------------------------------------- */
  function bump(type, slug, by) {
    var stats = storageGet(CFG.statsKey, {});
    if (!stats[slug]) stats[slug] = { views: 0, clicks: 0, lastClick: null };
    if (type === "views") stats[slug].views += by;
    if (type === "clicks") {
      stats[slug].clicks += by;
      stats[slug].lastClick = new Date().toISOString();
    }
    storageSet(CFG.statsKey, stats);
    sendToBackend(type, slug, by);
  }

  /* Fire-and-forget POST to the Worker (keeps page-nav redirects alive). */
  function sendToBackend(type, slug, by) {
    var ep = configuredBackend();
    if (!ep) return;
    var endpoint = base(ep) + (type === "views" ? "/api/view" : "/api/click");
    try {
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify({
        type: type, slug: slug, by: by, ts: new Date().toISOString(), href: location.href
      })], { type: "application/json" }));
    } catch (e) {
      try {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: type, slug: slug, by: by, ts: new Date().toISOString(), href: location.href }),
          keepalive: true
        }).catch(function () {});
      } catch (e2) {}
    }
  }

  /* ---------- affiliate click tracking ----------------------------------- */
  function isAffiliate(el) {
    if (!el || el.nodeName !== "A") return false;
    var href = el.getAttribute("href") || "";
    if (/appsumo\.8odi\.net|appsumo\.com\/products|shareasale|avantlink|impact/i.test(href)) return true;
    if ((el.getAttribute("rel") || "").indexOf("sponsored") !== -1) return true;
    if (el.hasAttribute("data-aff")) return true;
    return false;
  }

  function onDocClick(e) {
    var el = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!el) return;
    if (!isAffiliate(el)) return;
    var slug = currentSlug();
    if (!slug) {
      slug = el.getAttribute("data-post") ||
             (document.body && document.body.getAttribute("data-post"));
    }
    if (!slug) return;
    bump("clicks", slug, 1);
  }

  /* ---------- public API ------------------------------------------------ */
  window.DealDeskStats = {
    getAll: function () { return storageGet(CFG.statsKey, {}); },
    clear: function () {
      try {
        localStorage.removeItem(CFG.statsKey);
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf(CFG.viewKeyPrefix) === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
    },
    _slug: currentSlug,
    _cfg: CFG,
    backend: configuredBackend
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackView);
  } else {
    trackView();
  }
  document.addEventListener("click", onDocClick, true);
})();
