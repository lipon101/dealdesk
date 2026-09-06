# DealDesk — GitHub Pages deployment guide

This folder is the **ready-to-push static package**. It contains everything the
live site needs and nothing else:

- all public HTML pages (plus the hidden admin page at its secret slug)
- `styles.css`, `script.js`, `analytics.js`, `affiliate-config.js`,
  `posts-manifest.js`, `admin.js`, `admin.css`
- `admin-config.js` — **hash-only** credential verifier (never contains the
  plaintext passphrase; see the site README §4)
- `images/` — all self-hosted product images
- `robots.txt`, `sitemap.xml`, `favicon.svg`
- `tools/hash-generator.html` — browser-based passphrase hasher (noindex)

Not included on purpose: the `worker/` backend source (deploy that to
Cloudflare separately — see site README §6) and `post-template.html` (internal
editorial template).

---

## 1. One-time setup (exact commands)

```bash
# From this deploy/ folder:

git init
git add .
git commit -m "DealDesk static site — initial production deploy"

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

- [ ] Replace every `https://dealdesk.example.com/...` with your real domain
      in: all HTML `rel="canonical"`, `robots.txt` (`Sitemap:` line) and
      `sitemap.xml` (all `<loc>` entries).
- [ ] Change the admin passphrase (site README §4) and confirm the new hash is
      in `admin-config.js`.
- [ ] If you renamed the admin page, update the `Disallow:` line in
      `robots.txt` and the secret-URL note in the README.
- [ ] (Recommended) Deploy the Cloudflare Worker backend (site README §6) and
      save its URL in the admin **Settings → Backend API** so stats are real
      and auth is server-side.
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

*Full documentation (security model, Worker backend, AdSense, analytics,
adding new posts) lives in the parent `documents/appsumo-blog-site_v8/README.md`.*
