/* =========================================================================
   GoPromotes - firebase-config.js   (PRIVATE admin auth config)
   -------------------------------------------------------------------------
   REAL Firebase Auth configuration for the hidden admin panel.

   WHY FIREBASE: the site source is PUBLIC on GitHub, so any client-side
   passphrase verifier (admin-config.js) can be read, copied and brute-forced
   by anyone. Firebase Auth moves identity SERVER-SIDE: your email/password
   or Google account is verified by Google's servers. There is no secret in
   this repo that can be stolen or bypassed, and editing/forking these files
   cannot grant access. See FIREBASE-SETUP.md for the setup guide.

   HOW TO ENABLE:
     1. Create a FREE Firebase project (Spark plan - no credit card).
     2. Authentication -> Sign-in method -> enable Email/Password and Google.
     3. Authentication -> Settings -> Authorized domains -> add gopromotes.com.
     4. Project settings -> Your apps -> Web -> copy the firebaseConfig
        values into `config` below.
     5. Put YOUR admin email(s) in `adminEmails` below (allow-list - anyone
        else who signs in is rejected and signed out immediately).
     6. Set `enabled: true` and commit/push.

   SECURITY NOTE: Firebase web config values are PUBLIC BY DESIGN - they only
   identify your project. Real security comes from Firebase Authentication
   (server-side) plus the adminEmails allow-list below, so committing these
   placeholders is safe. NEVER set enabled:true with placeholder values.
   ========================================================================= */

window.DD_FIREBASE_CFG = {
  /* Set to true ONLY after you pasted real values into `config` below and
     put your email into adminEmails. Until then the admin page keeps the
     local passphrase gate (clearly labeled as the legacy fallback). */
  enabled: false,

  /* ALLOW-LIST: the only email addresses permitted to enter the panel.
     After a successful Firebase sign-in the email is checked against this
     list; any other account is signed out immediately. */
  adminEmails: [
    "you@example.com"        /* <-- replace with YOUR email */
  ],

  /* Show the "Continue with Google" button (requires Google enabled in the
     Firebase console). */
  googleEnabled: true,

  /* Paste the firebaseConfig from Firebase console here (Project settings ->
     Your apps -> Web app -> SDK setup and configuration -> firebaseConfig). */
  config: {
    apiKey: "AIzaSy_REPLACE_WITH_YOUR_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
  }
};
