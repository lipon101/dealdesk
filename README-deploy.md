# GoPromotes — GitHub Pages deployment guide

This folder is the **ready-to-push static package**. It contains everything the
live site needs and nothing else:

- all public HTML pages (plus the hidden admin page at its secret slug)
- `styles.css`, `script.js`, `analytics.js`, `affiliate-config.js`,
  `posts-manifest.js`, `admin.js`, `admin.css`
- `admin-config.js` — **secret-free** runtime settings only (the legacy
  passphrase verifier was removed in v18 — Firebase Auth is the only login)
- `images/` — all self-hosted product images
- `robots.txt`, `sitemap.xml`, `favicon.svg`
- `firebase-config.js` — real Firebase Auth config (see FIREBASE-SETUP.md)
- `lostsec.html` — the hidden admin panel (noindex, robots-disallowed)

Not included on purpose: the `worker/` backend source (deploy that to
Cloudflare separately — see site README §6) and `post-template.html` (internal
editorial template).

---

## 1. One-time setup (exact commands)

```bash
# From this deploy/ folder:

git init
git add .
git commit -m "GoPromotes static site — initial production deploy"

# Create an empty repo on github.com first (no README/gitignore),
# then connect it:
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

> Tip: keep this repo **private** while you are still changing defaults
> (passphrase, admin slug, domain). Make it public only after you have done the
> pre-launch checklist below.

## 2. Enable GitHub Pages

1. GitHub → your repo → **Settings → Pages**.
2. **Source: Deploy from a branch**, branch `main`, folder `/ (root)` → Save.
3. Your site goes live at `https://<your-username>.github.io/<your-repo>/`
   (a user/org site named `<your-username>.github.io` serves at the root
   instead).

## 3. Custom domain (optional)

1. Add a file named `CNAME` in this folder containing exactly:

   ```
   deals.yourdomain.com
   ```

2. At your DNS provider add a `CNAME` record: `deals` → `<your-username>.github.io.`
3. Repo **Settings → Pages → Custom domain** → enter `deals.yourdomain.com` →
   Save (GitHub verifies DNS and issues an automatic HTTPS certificate).

## 4. Pre-launch checklist (do these BEFORE going public)

- [ ] Replace every `https://gopromotes.com/...` with your real domain
      in: all HTML `rel="canonical"`, `robots.txt` (`Sitemap:` line) and
      `sitemap.xml` (all `<loc>` entries).
- [ ] Set YOUR admin email in `adminEmails` in `firebase-config.js` (the
      allow-list rejects every other account) and confirm `enabled:true`.
- [ ] If you renamed the admin page, update the `Disallow:` line in
      `robots.txt` and the secret-URL note in the README.
- [ ] (Optional) Deploy the Cloudflare Worker backend (restore worker/ from the
      v17 commit) and save its URL in the admin **Settings → Backend API** so
      stats are real cross-device numbers. Auth is Firebase-only; the Worker
      is not required.
- [ ] Verify: `curl -I https://<your-domain>/index.html`, then submit
      `sitemap.xml` in Google Search Console.

## 5. After first push

```bash
git add .
git commit -m "Update content"
git push
```

GitHub Pages redeploys automatically from `main` — no build step needed.

---

*Site documentation (architecture, security model, Firebase Auth, Worker
backend, AdSense, analytics, adding new posts) is maintained in the project
workspace at `documents/appsumo-blog-site_v16/README.md`.*
