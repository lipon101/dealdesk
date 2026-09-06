# Set up REAL Firebase Auth for the GoPromotes admin panel

This guide makes the hidden admin panel (https://gopromotes.com/<secret-slug>.html)
authenticate with **Firebase Auth** - Google's server-side identity service -
instead of the client-side passphrase verifier.

## Why this matters (public repo = no client-side secrets)

The site source lives in a **public GitHub repo**. Anyone can read it. A
client-side PBKDF2 verifier (`admin-config.js`) can therefore be copied and
brute-forced offline, or the repo can be forked and the files edited to
bypass the gate or point affiliate links elsewhere. Firebase Auth fixes that:

- The **password / Google account is verified by Google's servers**; there is
  no secret anywhere in this repo that can be stolen or forged.
- Editing or forking these files **cannot grant access** - an attacker would
  need your real Firebase password or your Google account.
- The **admin-email allow-list** (`adminEmails` in `firebase-config.js`)
  rejects every other account, even one the attacker creates themselves.

Firebase's free **Spark plan** needs no credit card and keeps working
indefinitely for a site of this size (generous quotas; it does not sleep).

## What you configure

Your real Firebase project values are already in **`firebase-config.js`**
(`enabled: true` + the `gopromotes-admin` firebaseConfig). The **only**
remaining step before sign-in will work is your admin email:

```js
window.DD_FIREBASE_CFG = {
  enabled: true,                  // already on - gate uses Firebase now
  adminEmails: ["you@example.com"],  // <-- REPLACE with YOUR email (lowercase)
  googleEnabled: true,            // show "Continue with Google"
  config: { apiKey: "AIzaSyBi...", authDomain: "gopromotes-admin.firebaseapp.com", ... }
};
```

> ⚠️ If `adminEmails` still contains `you@example.com`, the allow-list check
> rejects **every** sign-in ("Access denied") - you must set your own email.

## Step-by-step (free, ~10 minutes)

1. **Create the project**: go to https://console.firebase.google.com and
   **Add project** (name it e.g. `gopromotes-admin`). Google Analytics can be
   disabled - it is not needed.

2. **Enable sign-in methods**: left sidebar **Build -> Authentication ->
   Get started -> Sign-in method**. Enable **Email/Password**, and if you want
   the Google button also enable **Google** (follow the prompt to enable the
   Google Cloud project's OAuth consent screen).

3. **Authorized domains**: still under Authentication -> Settings, the
   **Authorized domains** list must include `gopromotes.com` (and
   `localhost` for testing). Firebase adds its own `*.firebaseapp.com`
   domains automatically.

4. **Add yourself as a user**: Authentication -> Users -> **Add user** with
   your email and a strong password (or sign up later via the gate; the first
   account must be allow-listed *before* sign-in, so creating it in the
   console is the reliable path).

5. **Copy the web config**: Project settings (gear) -> **Your apps** ->
   **Web app** (`</>`). Register a web app (name e.g. `gopromotes-admin-web`),
   then copy the `firebaseConfig` object shown in the SDK snippet into
   `config` in `firebase-config.js`.

6. **Set your admin email**: replace `you@example.com` in `adminEmails` with
   your email. Keep it lowercase. Add more addresses (comma-separated) only
   if someone else legitimately co-admins.

7. **Enable**: set `enabled: true`, then commit and push. The gate on the
   admin page now shows **email/password + Google sign-in** and ignores the
   legacy passphrase. The allow-list check runs after every sign-in: any
   email not listed is signed out immediately with "Access denied".

## Rollback (if you ever want the passphrase gate back)

Set `enabled: false` in `firebase-config.js` (or restore the placeholder
apiKey) and push. The gate reverts to the clearly-labelled legacy passphrase
fallback automatically - the PBKDF2 verifier in `admin-config.js` is
untouched and still works.

## Security notes

- The Firebase web config values (apiKey etc.) are **public by design** - they
  only identify your project to Google. They are safe to commit; real
  security comes from Firebase Authentication + the allow-list.
- Revoking access = delete the user in Firebase console (Authentication ->
  Users) or remove their email from `adminEmails` and push.
- The legacy passphrase flow is intentionally kept as a clearly-labelled
  fallback while Firebase is not configured, so you can never be locked out
  of the panel.
- Free-tier honesty: the Spark plan has no expiry or card, but like every
  free tier it is a standing offer subject to Google's terms. For a
  single-owner admin gate it is effectively permanent.