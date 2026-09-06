/* =========================================================================
   GoPromotes — posts manifest (single source of truth for site + admin panel)
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
  },
  {
    "id": "truconversion",
    "file": "truconversion-review.html",
    "title": "TruConversion Review: Is the AppSumo Heatmap Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "TruConversion",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/truconversion/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "katteb",
    "file": "katteb-review.html",
    "title": "Katteb Review: Is the AppSumo AI Writer Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "Katteb",
    "price": "from $39",
    "dealUrl": "https://appsumo.com/products/katteb/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "reoon-email-verifier",
    "file": "reoon-email-verifier-review.html",
    "title": "Reoon Email Verifier Review: Is the AppSumo Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "Reoon Email Verifier",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/reoon-email-verifier/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "flexclip",
    "file": "flexclip-review.html",
    "title": "FlexClip Review: Is the AppSumo Video Editor Deal Worth It?",
    "category": "media-design",
    "vendor": "FlexClip",
    "price": "from $99",
    "dealUrl": "https://appsumo.com/products/flexclip/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "salesblink",
    "file": "salesblink-review.html",
    "title": "SalesBlink Review: Is the AppSumo Cold-Email Deal Worth It?",
    "category": "crm-sales-tools",
    "vendor": "SalesBlink",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/salesblink/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "leadrocks",
    "file": "leadrocks-review.html",
    "title": "LeadRocks Review: Is the AppSumo B2B Database Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "LeadRocks",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/leadrocks/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "sendfox",
    "file": "sendfox-review.html",
    "title": "SendFox Review: Is the AppSumo Email Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "SendFox",
    "price": "from $29",
    "dealUrl": "https://appsumo.com/products/sendfox/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "gobrunch",
    "file": "gobrunch-review.html",
    "title": "GoBrunch Review: Is the AppSumo Webinar Deal Worth It?",
    "category": "customer-engagement",
    "vendor": "GoBrunch",
    "price": "from $89",
    "dealUrl": "https://appsumo.com/products/gobrunch/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "acadle",
    "file": "acadle-review.html",
    "title": "Acadle Review: Is the AppSumo LMS Deal Worth It?",
    "category": "customer-engagement",
    "vendor": "Acadle",
    "price": "from $109",
    "dealUrl": "https://appsumo.com/products/acadle/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "bannerboo",
    "file": "bannerboo-review.html",
    "title": "BannerBoo Review: Is the AppSumo Ad Designer Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "BannerBoo",
    "price": "from $59",
    "dealUrl": "https://appsumo.com/products/bannerboo/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "switchy",
    "file": "switchy-review.html",
    "title": "Switchy Review: Is the AppSumo Link Retargeting Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "Switchy",
    "price": "from $39",
    "dealUrl": "https://appsumo.com/products/switchy/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "writerzen",
    "file": "writerzen-review.html",
    "title": "WriterZen Review: Is the AppSumo SEO Toolkit Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "WriterZen",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/writerzen/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "divhunt",
    "file": "divhunt-review.html",
    "title": "Divhunt Review: Is the AppSumo Website Builder Worth It?",
    "category": "build-code",
    "vendor": "Divhunt",
    "price": "from $79",
    "dealUrl": "https://appsumo.com/products/divhunt/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "viloud",
    "file": "viloud-review.html",
    "title": "Viloud Review: Is the AppSumo Online TV Channel Worth It?",
    "category": "media-design",
    "vendor": "Viloud",
    "price": "from $99",
    "dealUrl": "https://appsumo.com/products/viloud/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "elkqr",
    "file": "elkqr-review.html",
    "title": "ElkQR Review: Is the AppSumo QR Code Manager Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "ElkQR",
    "price": "from $39",
    "dealUrl": "https://appsumo.com/products/elkqr/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "growify",
    "file": "growify-review.html",
    "title": "Growify Review: Is the AppSumo Ad Attribution Deal Worth It?",
    "category": "marketing-sales-leads",
    "vendor": "Growify",
    "price": "from $69",
    "dealUrl": "https://appsumo.com/products/growify/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "hedy-ai",
    "file": "hedy-ai-review.html",
    "title": "Hedy AI Review: Is the AppSumo Meeting Assistant Worth It?",
    "category": "operations",
    "vendor": "Hedy AI",
    "price": "$179 one-time",
    "dealUrl": "https://appsumo.com/products/hedy-ai/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "updf",
    "file": "updf-review.html",
    "title": "UPDF Review: Is the AppSumo PDF Editor Worth It?",
    "category": "operations",
    "vendor": "UPDF",
    "price": "$69 one-time",
    "dealUrl": "https://appsumo.com/products/updf/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "goose-vpn",
    "file": "goose-vpn-review.html",
    "title": "GOOSE VPN Review: Is the AppSumo Lifetime VPN Worth It?",
    "category": "operations",
    "vendor": "GOOSE VPN",
    "price": "from $29",
    "dealUrl": "https://appsumo.com/products/goose-vpn/",
    "defaultAff": "https://appsumo.8odi.net/Ag17e7"
  },
  {
    "id": "onlinecoursehost",
    "file": "onlinecoursehost-review.html",
    "title": "OnlineCourseHost Review: Is the AppSumo Course Platform Worth It?",
    "category": "operations",
    "vendor": "OnlineCourseHost.com",
    "price": "from $99",
    "dealUrl": "https://appsumo.com/products/onlinecoursehost-com/",
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
