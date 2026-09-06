/* =========================================================================
   GoPromotes — admin-config.js   (PRIVATE — see README → Security model)
   -------------------------------------------------------------------------
   Runtime settings for the hidden control panel.

   AUTHENTICATION: Firebase Auth is the ONLY way into the panel (see
   firebase-config.js → enabled:true with the real gopromotes-admin
   project). Identity is verified server-side by Google; the signed-in email
   must match the adminEmails allow-list. There is no passphrase and no
   PBKDF2 verifier in this file anymore — the legacy passphrase gate was
   removed (v18) because on a public repo any client-side verifier can be
   read and brute-forced. Do NOT add one back.

   Session bookkeeping is handled by admin.js (sessionStorage).
   ========================================================================= */

window.DD_ADMIN_CFG = {
  /* Session token lives in sessionStorage under this key (cleared when the
     tab closes — never localStorage, so it cannot persist after logout). */
  sessionKey: "dd_admin_session",

  /* Cloudflare Worker backend session token (Bearer auth). Kept for
     compatibility with the optional /api/click redirect counting if the
     owner ever deploys the (removed-from-repo) worker; unused otherwise.
     Stored in sessionStorage too. */
  backendTokenKey: "dd_admin_backend_token",

  /* Brute-force mitigation for the Firebase email/password form is handled
     natively by Firebase Auth (server-side). The legacy client-side lockout
     keys below are retained only for the optional Cloudflare Worker backend
     login path and are inert while Firebase is the only auth mode. */
  maxAttempts: 5,
  lockoutMs: 30000,
  attemptsKey: "dd_admin_attempts",

  /* Backend mode: set the Cloudflare Worker URL here to make it the DEFAULT
     for every visitor. Leave null to start in local mode and configure
     per-browser from the admin panel. */
  backendUrl: null,
};
