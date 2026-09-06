/* DealDesk — static promo-blog site JS
   Nav toggle · sticky header · scrollspy TOC · reveal-on-scroll ·
   countdown demo fill · category page param handling.
   No external calls. Everything here is demo/placeholder behavior.
 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ---------- Mobile nav toggle ---------- */
  var burger = document.querySelector(".nav-burger");
  var navLinks = document.querySelector(".nav-links");
  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      navLinks.classList.toggle("open");
      burger.setAttribute("aria-expanded", navLinks.classList.contains("open") ? "true" : "false");
    });
    // Close the drawer when a link is chosen (mobile)
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") navLinks.classList.remove("open");
    });
  }

  /* ---------- Sticky header shadow state ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 6);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Reveal-on-scroll (progressive enhancement) ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el, idx) {
      el.style.transitionDelay = Math.min(idx % 6, 4) * 45 + "ms";
      // Hide only what's below the initial viewport; everything already on
      // screen stays visible (no empty bands on first paint / screenshots).
      var r = el.getBoundingClientRect();
      if (r.top >= window.innerHeight || r.bottom < 0) el.classList.add("pre");
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Ad-slot graceful-collapse guard ----------
     The site ships with elegant branded placeholder panels (no fake
     AdSense IDs). If a REAL responsive unit is later dropped inside
     an .ad-slot and it fails to fill, Google leaves an empty
     <ins class="adsbygoogle"> (sometimes an empty body iframe). We
     poll until the adsbygoogle loader has had its chance, then
     collapse any slot whose ins/iframe stayed empty so no ugly
     bordered box ever shows. */
  function setupAdCollapseGuard() {
    var slots = Array.prototype.slice.call(document.querySelectorAll(".ad-slot"));
    if (!slots.length) return;
    var tries = 0;
    var MAX_TRIES = 20;
    var emptyCheck = function () {
      var allEmpty = true;
      var anyIns = false;
      slots.forEach(function (slot) {
        if (slot.classList.contains("ad-collapsed")) return;
        var ins = slot.querySelector("ins.adsbygoogle");
        var ifr = slot.querySelector("iframe");
        var ph = slot.querySelector(".ad-placeholder");
        var isEmpty = false;
        if (ifr) {
          // Real ad iframe: look for the empty transparent-body tell.
          var doc = null;
          try { doc = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document); } catch (e) { doc = null; }
          var body = doc && doc.body ? doc.body : null;
          isEmpty = !body || (body.childElementCount === 0 && (body.textContent || "").trim() === "");
        } else if (ins) {
          // No iframe yet: AdSense reserves height on the ins itself.
          var h = parseFloat(getComputedStyle(ins).height) || 0;
          isEmpty = !ifr && h < 24;
        } else if (ph) {
          // Placeholder panel: never empty.
          isEmpty = false;
        } else {
          // A bare slot with nothing inside is empty by definition.
          isEmpty = true;
        }
        if (isEmpty) {
          slot.classList.add("ad-collapsed");
        } else {
          allEmpty = false;
        }
        if (ins || ifr) anyIns = true;
      });
      if (!allEmpty) return;               // at least one slot filled
      if (anyIns && tries >= MAX_TRIES) return; // give real ads up to ~5s
      tries += 1;
      window.setTimeout(emptyCheck, 250);
    };
    window.setTimeout(emptyCheck, 1200);
  }
  setupAdCollapseGuard();

  /* ---------- TOC scrollspy (post pages) ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-list a"));
  if (tocLinks.length) {
    var map = tocLinks.map(function (a) {
      var id = a.getAttribute("href").replace(/^#/, "");
      return { link: a, target: document.getElementById(id) };
    }).filter(function (m) { return m.target !== null; });

    var spy = function () {
      var probe = window.scrollY + (window.innerHeight / 3);
      var current = null;
      map.forEach(function (m) {
        if (m.target.offsetTop <= probe) current = m.link;
      });
      map.forEach(function (m) {
        m.link.classList.toggle("active", m.link === current);
      });
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  /* ---------- Category page: read ?category= and mark tabs ---------- */
  var catTabs = Array.prototype.slice.call(document.querySelectorAll("[data-cat-tab]"));
  if (catTabs.length) {
    var params = new URLSearchParams(window.location.search);
    var wanted = params.get("category") || null;
    var docTitle = document.querySelector("[data-cat-title]");
    var docDesc = document.querySelector("[data-cat-desc]");
    var cards = document.querySelectorAll("[data-deal-cat]");
    var guides = document.querySelectorAll("[data-guide-cat]");

    var meta = {
      "all": {
        label: "All reviews",
        desc: "Every DealDesk guide, organized by category. Each review is based on hands-on testing with deal terms verified against the official AppSumo product page on the day of publication."
      },
      "marketing-sales-leads": {
        label: "Marketing & Sales Leads",
        desc: "Real reviews of marketing and lead-gen software on AppSumo: AI search visibility (ZeroRank AI) and creator email marketing (INBOX), plus every future guide in the category."
      },
      "media-design": {
        label: "Media & Design",
        desc: "Design, video and brand tooling. No reviewed deals yet \u2014 new guides land here as we publish them."
      },
      "operations": {
        label: "Operations",
        desc: "Scheduling, docs and workflow tooling \u2014 including our TidyCal review, the AppSumo Original booking tool with lifetime access from $29."
      },
      "build-code": {
        label: "Build & Code",
        desc: "WordPress and dev tooling: Essential Addons for Elementor (100+ widgets) and WP Security Ninja (firewall, malware scanning) \u2014 both reviewed on lifetime licenses."
      },
      "customer-engagement": {
        label: "Customer Engagement",
        desc: "Support, community and retention tooling. No reviewed deals yet \u2014 new guides land here as we publish them."
      },
      "crm-sales-tools": {
        label: "CRM & Sales Tools",
        desc: "Pipelines, outreach and sales intelligence \u2014 including our DealDrive review of the agentic AI CRM with contracts and e-signatures built in."
      },
      "ai-stack": {
        label: "AI Stack",
        desc: "AI writing, agents and dictation \u2014 including our Amical review of the open-source dictation app with unlimited local transcription and 100+ languages."
      }
    };

    var active = meta[wanted] ? wanted : "all";
    var info = meta[active];
    var defaultTitle = document.title;

    catTabs.forEach(function (tab) {
      var on = tab.getAttribute("data-cat-tab") === active;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-current", on ? "page" : "false");
    });
    if (docTitle) docTitle.textContent = info.label;
    if (docDesc) docDesc.textContent = info.desc;
    document.title = info.label + " \u2014 DealDesk";
    if (cards.length) {
      cards.forEach(function (c) {
        var show = active === "all" || c.getAttribute("data-deal-cat") === active;
        c.style.display = show ? "" : "none";
      });
    }
    if (guides.length) {
      guides.forEach(function (g) {
        var show = active === "all" || g.getAttribute("data-guide-cat") === active;
        g.style.display = show ? "" : "none";
      });
    }
  }
})();
