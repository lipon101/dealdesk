/* =========================================================================
   DealDesk — posts manifest (single source of truth for site + admin panel)
   -------------------------------------------------------------------------
   One entry per published review. The admin panel uses this list for the
   stats dashboard and the affiliate-link manager. When you publish a new
   post, add it here (copy an existing entry and change the fields).

   Fields:
     id        – stable short id (used in analytics keys; do NOT change once live)
     file      – the actual HTML filename (must match the file in this folder)
     title     – display title
     category  – one of the category slugs used by category.html
     vendor    – product / company name
     price     – human label of the starting tier (display only)
     dealUrl   – official AppSumo product page (NOT the affiliate link)
     defaultAff– the affiliate link used by this post's CTA buttons today
   ========================================================================= */

window.DD_POSTS = [
  {
    "id": "tidycal",
    "file": "tidycal-review.html",
    "title": "TidyCal Review: The AppSumo Scheduling Deal Worth It?",
    "category": "operations",
    "vendor": "TidyCal",
    "price": "from $29",
    "dealUrl": "https://appsumo.com/products/tidycal/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "zerorank-ai",
    "file": "zerorank-ai-review.html",
    "title": "ZeroRank AI Review: AppSumo AI-SEO Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "ZeroRank AI",
    "price": "from $69",
    "dealUrl": "https://appsumo.com/products/zerorank-ai/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "dealdrive",
    "file": "dealdrive-review.html",
    "title": "DealDrive Review: AppSumo AI-CRM Lifetime Worth It?",
    "category": "crm-sales-tools",
    "vendor": "DealDrive",
    "price": "from $69",
    "dealUrl": "https://appsumo.com/products/dealdrive/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "inbox",
    "file": "inbox-review.html",
    "title": "INBOX Review: AppSumo Email Deal Worth Buying in 2026?",
    "category": "marketing-sales-leads",
    "vendor": "INBOX",
    "price": "from $99 / code",
    "dealUrl": "https://appsumo.com/products/inbox/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "essential-addons",
    "file": "essential-addons-elementor-review.html",
    "title": "Essential Addons for Elementor Review: AppSumo Lifetime",
    "category": "build-code",
    "vendor": "Essential Addons for Elementor",
    "price": "from $49",
    "dealUrl": "https://appsumo.com/products/essential-addons-elementor/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "wp-security-ninja",
    "file": "wp-security-ninja-review.html",
    "title": "WP Security Ninja Review: Is the AppSumo Lifetime Deal Worth It?",
    "category": "build-code",
    "vendor": "WP Security Ninja",
    "price": "from $69",
    "dealUrl": "https://appsumo.com/products/wp-security-ninja/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "amical",
    "file": "amical-review.html",
    "title": "Amical AI Dictation Review: AppSumo Lifetime Deal Worth It?",
    "category": "ai-stack",
    "vendor": "Amical",
    "price": "from $49",
    "dealUrl": "https://appsumo.com/products/amical/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  }
];

/* Category catalog used by the site + admin (label is editable in admin). */
window.DD_CATEGORIES = [
  { "slug": "marketing-sales-leads", "label": "Marketing & Sales Leads" },
  { "slug": "media-design", "label": "Media & Design" },
  { "slug": "operations", "label": "Operations" },
  { "slug": "build-code", "label": "Build & Code" },
  { "slug": "customer-engagement", "label": "Customer Engagement" },
  { "slug": "crm-sales-tools", "label": "CRM & Sales Tools" },
  { "slug": "ai-stack", "label": "AI Stack" }
];
