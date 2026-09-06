/* =========================================================================
   GoPromotes — admin-config.js   (PRIVATE — see README → Security model)
   -------------------------------------------------------------------------
   Holds the PBKDF2 credential verifier used by the admin login gate.

   ▶ NO default passphrase ships with the site. The salt + hash below are
     for the OWNER-ONLY passphrase that was generated at setup and given to
     the owner privately. It is NOT written in any file here. If you are a
     visitor, stop — you cannot log in.

   HOW TO CHANGE THE PASSPHRASE:
     1. Pick a strong passphrase (16+ chars, mixed case + digits + symbols).
     2. Generate a fresh salt + hash with 600,000 iterations:
          node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');
                   console.log(JSON.stringify({salt:s,iter:600000,
                     hash:c.pbkdf2Sync('YOUR_NEW_PASSPHRASE', s, 600000, 32, 'sha256').toString('hex')}))"
        (or use tools/hash-generator.html — it now defaults to 600,000 too)
     3. Paste the three values below (salt, iterations, hash) and commit.
     NEVER store the plain passphrase here.
     NOTE — salt convention: the hash is derived with the salt passed as a
     UTF-8 STRING (the raw hex characters), i.e. pbkdf2Sync(pass, s, ...) with
     s a string — NOT hex-decoded bytes. The login gate (admin.js), the
     change-passphrase flow, hash-generator.html and the Worker all use this
     same convention; keep it when regenerating.

   WHY PBKDF2: Web Crypto API (window.crypto.subtle) implements PBKDF2 in
   every modern browser, so the login gate can verify the passphrase with
   the same audited KDF used by password managers — 600,000 iterations,
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
  salt: "cc254f21ae9072352fc0881c1877176f",
  iterations: 600000,
  hash: "6afb198d8d0916bfa81505a1aa13cb68a379644da372ec563790c281566b3faf",

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

  /* Backend mode: set the Cloudflare Worker URL here to make it the DEFAULT
     for every visitor (they will use server-side auth + real cross-device
     stats even before anyone opens Settings). Leave null to start in local
     mode and configure per-browser from the admin panel. */
  backendUrl: null,
};
