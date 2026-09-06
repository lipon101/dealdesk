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

   CURRENT STATE: `enabled: true` and the REAL firebaseConfig for the
   owner's project (gopromotes-admin) are in place. The ONLY remaining
   required step is to replace the placeholder "you@example.com" in
   `adminEmails` below with the owner's actual email, then commit/push.

   SECURITY NOTE: Firebase web config values are PUBLIC BY DESIGN - they only
   identify your project. Real security comes from Firebase Authentication
   (server-side) plus the adminEmails allow-list below, so committing these
   placeholders is safe. NEVER set enabled:true with placeholder values.
   ========================================================================= */

window.DD_FIREBASE_CFG = {
  /* ENABLED: real Firebase project values are configured below. The gate on
     the admin page now uses Firebase Auth (email/password + Google) and the
     legacy passphrase gate is disabled in Firebase mode. NOTE: you MUST still
     replace "you@example.com" in adminEmails with your real admin email or
     every sign-in will be rejected by the allow-list check. */
  enabled: true,

  /* ALLOW-LIST: the only email addresses permitted to enter the panel.
     After a successful Firebase sign-in the email is checked against this
     list; any other account is signed out immediately.
     !!! ACTION REQUIRED: replace "you@example.com" below with YOUR OWN
     admin email (the one you created the Firebase user with). Until you do,
     the allow-list check will REJECT every sign-in (Access denied) and you
     will be locked out of the panel. Keep it lowercase. */
  adminEmails: [
    "you@example.com"        /* <-- REPLACE with YOUR email (required) */
  ],

  /* Show the "Continue with Google" button (requires Google enabled in the
     Firebase console). */
  googleEnabled: true,

  /* Paste the firebaseConfig from Firebase console here (Project settings ->
     Your apps -> Web app -> SDK setup and configuration -> firebaseConfig). */
  config: {
    apiKey: "AIzaSyBiTZKHoQ7Tnxa8ZEDksqjPmO5VtqHQ5tM",
    authDomain: "gopromotes-admin.firebaseapp.com",
    projectId: "gopromotes-admin",
    storageBucket: "gopromotes-admin.firebasestorage.app",
    messagingSenderId: "269230953055",
    appId: "1:269230953055:web:187f1bd007c13fe5ba01ea"
  }
};
