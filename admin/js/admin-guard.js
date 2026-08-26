/* ============================================================
   MedCare — admin area gate
   Loaded on EVERY admin page, before that page's own script:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3" defer></script>
     <script src="../supabase.js" defer></script>
     <script src="../auth.js" defer></script>
     <script src="../script.js" defer></script>
     <script src="js/admin-guard.js" defer></script>
     <script src="js/admin-shell.js" defer></script>
     <script src="js/admin-users.js" defer></script>     <- the page's own

   ------------------------------------------------------------
   WHAT THIS IS FOR, AND WHAT IT IS NOT FOR

   It decides what to SHOW. It sends a signed-out visitor to the login
   page and a signed-in reader back to the site, so that neither is left
   staring at a dashboard whose every query would return nothing.

   It is not access control. Every line here runs on the visitor's own
   machine: anyone can open DevTools, delete this file from the page, or
   never load it at all and call the REST API with curl. What actually
   refuses them is Row Level Security, in Postgres, after the JWT has
   been verified, on every single request:

     profiles       "Admins can read all profiles"  -> my_role() = 'admin'
                    "Admins can change roles"       -> + the guard_profile_role
                                                       trigger, which also
                                                       refuses self-demotion
     site_settings  "Admins write site settings"    -> my_role() = 'admin';
                    everyone else reads, because the public site has to
                    know whether it is in maintenance mode

   The content tables are not in that list, and that is the point: this
   area administers the site and the people on it, not the medicine. The
   health tables answer to the editor desk, and an admin's reach into
   them is limited to deciding who holds the editor role.

   Delete this file and an ordinary account still sees an empty page and
   is still refused every write. That is the test worth running, and it
   is the reason this file is allowed to be simple.
   ------------------------------------------------------------
   ONE SESSION READ, NOT TWO

   The role comes from MedCareAuth (auth.js) rather than from a fresh
   getUser() + profiles query here. That is deliberate. Two independent
   readers of the same stored session each try to refresh the same
   rotating token, and the loser gets

     POST /auth/v1/token?grant_type=refresh_token -> 400 Already Used

   which, under refresh-token reuse detection, can revoke the whole
   family and sign the person out mid-session. auth.js reads the session
   exactly once and hands the answer to everybody; this file waits for
   that answer.
   ============================================================ */

(function () {
  'use strict';

  var REQUIRED_ROLE = 'admin';

  // Root-absolute: the admin pages sit one directory down, and these
  // must not become admin/login.html.
  var LOGIN_PAGE = '/login.html';
  var SITE_PAGE  = '/index.html';

  // If the answer never arrives — network gone, project URL wrong — the
  // page must not sit blank for ever pretending to load.
  var PATIENCE_MS = 10000;

  var root = document.documentElement;
  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var settle;
  var state = { user: null, profile: null, role: null, passed: false };

  /* The shell is hidden by admin.css until this class arrives, so no
     protected markup is painted while the role is still unknown. The
     failure mode is a blank page rather than a leaked one. */
  function reveal() {
    root.classList.add('mc-guard-ok');
    root.classList.remove('mc-guard-pending');
  }

  function leaveFor(url) {
    // replace(), not assign(): the back button should not walk them
    // into a page they have just been told they cannot have.
    window.location.replace(url);
  }

  /* Shown in place of the page when the check itself fails. Not used
     for "you are not an admin" — that redirects instead. */
  function stall(title, detail) {
    root.classList.remove('mc-guard-pending');
    document.body.innerHTML =
      '<div class="mc-guard-stall" role="alert">' +
        '<h1>' + title + '</h1>' +
        '<p>' + detail + '</p>' +
        '<p><a href="' + SITE_PAGE + '">Back to MedCare</a></p>' +
      '</div>';
  }

  var api = {
    /* Resolves ONLY when an admin is confirmed. A page script does its
       work inside this and needs no role check of its own:

         MedCareAdminGuard.ready.then(function (who) { ... });

       On any other outcome the promise never settles, because the page
       is on its way somewhere else and running its queries would be
       pointless noise. */
    ready: null,

    getUser: function () { return state.user; },
    getProfile: function () { return state.profile; },
    getRole: function () { return state.role; },

    // What to call this person in the admin chrome.
    displayName: function () {
      return (auth && auth.displayName && auth.displayName()) ||
             (state.user ? state.user.email : '');
    },

    signOut: function () {
      return auth.signOut().then(function () { leaveFor(LOGIN_PAGE); });
    }
  };

  api.ready = new Promise(function (resolve) { settle = resolve; });
  window.MedCareAdminGuard = api;

  root.classList.add('mc-guard-pending');

  if (!auth || !db) {
    // supabase.js has already said why on the console.
    stall('Admin area unavailable',
          'This site is not connected to its database. See the console for details.');
    return;
  }

  auth.ready.then(function () {
    state.user    = auth.getUser();
    state.profile = auth.getProfile();
    state.role    = auth.getRole();

    if (!state.user) {
      leaveFor(LOGIN_PAGE);
      return;
    }

    if (state.role !== REQUIRED_ROLE) {
      // Signed in, but not an admin. Back to the public site — the
      // database would refuse everything on this page anyway.
      leaveFor(SITE_PAGE);
      return;
    }

    state.passed = true;
    reveal();
    settle(state);
  });

  /* An expired or revoked session is the case worth handling carefully.
     Without this, the page keeps its rendered tables while every query
     behind them starts returning nothing — which reads as "the data
     vanished" rather than "you are signed out", and is exactly when
     somebody starts filing bugs about lost records.

     SIGNED_OUT covers signing out in another tab as well. A role change
     is not covered: it takes effect on the next page load, and until
     then the database refuses the work regardless. */
  db.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT' || (state.passed && !session)) {
      leaveFor(LOGIN_PAGE);
    }
  });

  window.setTimeout(function () {
    if (!state.passed && !state.user) {
      stall('Could not check your permissions',
            'The database did not answer. Check your connection and reload the page.');
    }
  }, PATIENCE_MS);

})();
