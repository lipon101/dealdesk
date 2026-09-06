/* =========================================================================
   DealDesk — admin-config.js   (PRIVATE — see README → Security model)
   -------------------------------------------------------------------------
   Holds the PBKDF2 credential verifier used by the admin login gate.

   ▶ DEFAULT PASSPHRASE (working):  DealDesk#Ridge7!Cipher
     Log in with it now, then change it to your own (steps below).

   HOW TO CHANGE THE PASSPHRASE:
     1. Pick a strong passphrase (16+ chars, mixed case + digits + symbols).
     2. Generate a fresh salt + hash with:
          node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');
                   console.log(JSON.stringify({salt:s,iter:310000,
                     hash:c.pbkdf2Sync('YOUR_NEW_PASSPHRASE', s, 310000, 32, 'sha256').toString('hex')}))"
     3. Paste the three values below (salt, iterations, hash) and commit.
     NEVER store the plain passphrase here.

   WHY PBKDF2: Web Crypto API (window.crypto.subtle) implements PBKDF2 in
   every modern browser, so the login gate can verify the passphrase with
   the same audited KDF used by password managers — 310,000 iterations,
   SHA-256, random per-install salt. See README → "Security model" for the
   honest limits of client-side auth on a static host and the serverless
   upgrade path (worker/ in this folder = the real-security deployment).

   LOCKOUT RESET: if you ever trigger the lockout, the gate auto-unlocks
   after the backoff window (30s base, doubling per extra failure, capped).
   To reset immediately, clear this site's localStorage key
   `dd_admin_attempts` (DevTools → Application → Local Storage) or run
   localStorage.removeItem("dd_admin_attempts") in the console.
   ========================================================================= */

window.DD_ADMIN_CFG = {
  /* PBKDF2-SHA256 verifier (hex). Change these three values together. */
  salt: "4445b522c8cdfe49efb6c53875b1d6a2",
  iterations: 310000,
  hash: "31a87cf0a96ab4b81011888130339059f3385d98d2c387c409fc19bd45684b72",

  /* Session token lives in sessionStorage under this key (cleared when the
     tab closes — never localStorage, so it cannot persist after logout). */
  sessionKey: "dd_admin_session",

  /* Token returned by the Cloudflare Worker backend (Bearer auth). Stored
     in sessionStorage too. Empty = backend not used / not logged in there. */
  backendTokenKey: "dd_admin_backend_token",

  /* Brute-force mitigation (client-side; localStorage-persisted).
     After `maxAttempts` failures the gate locks for `lockoutMs`,
     then doubles the wait on every further failure (exponential backoff). */
  maxAttempts: 5,
  lockoutMs: 30000,
  attemptsKey: "dd_admin_attempts",

  /* Shared key where the backend URL lives (admin Settings tab writes it;
     affiliate-config.js + analytics.js + admin.js all read it). */
  backendUrlKey: "dd_backend_url"
};
