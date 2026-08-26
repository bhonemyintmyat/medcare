/* ============================================================
   MedCare — editor area gate
   Loaded on EVERY editor page, before that page's own script:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3" defer></script>
     <script src="../supabase.js" defer></script>
     <script src="../auth.js" defer></script>
     <script src="../script.js" defer></script>
     <script src="js/editor-guard.js" defer></script>
     <script src="../admin/js/admin-shell.js" defer></script>
     <script src="js/editor-api.js" defer></script>
     <script src="js/editor-content.js" defer></script>   <- the page's own

   ------------------------------------------------------------
   THE SAME WARNING AS admin-guard.js, AND IT MATTERS MORE HERE

   This decides what to SHOW. It is not access control. Every line runs
   on the visitor's machine, and anyone can delete the file from the
   page and open editor/content.html directly.

   It matters more here because the editor area is defined by what it
   CANNOT do, and none of those limits live in this file:

     profiles   no editor policy of any kind, plus the
                guard_profile_role trigger -> an editor cannot read
                other accounts or change a role, from any client
     *          no DELETE policy names 'editor' anywhere -> hard-delete
                is refused in Postgres, not by a hidden button
     emergency_contacts
                editors may UPDATE only; insert and delete stay admin

   Delete this file and an editor still cannot reach a user account,
   still cannot destroy a row, and still cannot add an emergency number.
   That is the test worth running, and it is why this file is short.

   supabase_editor.sql is where those rules are written down.
   ------------------------------------------------------------
   WHY ADMINS ARE LET IN

   An admin is an editor with more, not a different person, and every
   policy this area relies on is written `in ('editor', 'admin')`. If an
   admin were bounced to the admin area they would have no way to reach
   the translations screen or the media library, which exist only here.
   The desk points that out rather than pretending the two are the same.
   ------------------------------------------------------------
   ONE SESSION READ, NOT TWO

   The role comes from MedCareAuth. Two independent readers of the same
   stored session each try to refresh the same rotating token and the
   loser gets a 400 "Already Used", which under reuse detection can
   revoke the family and sign the person out mid-edit. auth.js reads the
   session once; this file waits for the answer. Same reasoning, and the
   same failure, as admin-guard.js.
   ============================================================ */

(function () {
  'use strict';

  var ALLOWED = ['editor', 'admin'];

  // Root-absolute: the editor pages sit one directory down, and these
  // must not become editor/login.html.
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
     for "you are not an editor" — that redirects instead. */
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
    /* Resolves ONLY when an editor or admin is confirmed. A page script
       does its work inside this and needs no role check of its own:

         MedCareEditorGuard.ready.then(function (who) { ... });

       On any other outcome the promise never settles, because the page
       is on its way somewhere else and running its queries would be
       pointless noise. */
    ready: null,

    getUser:    function () { return state.user; },
    getProfile: function () { return state.profile; },
    getRole:    function () { return state.role; },

    // True for an admin visiting the editor area. Used only to soften
    // wording — "you cannot do this" is wrong to print at someone who
    // can. It grants nothing; RLS decides the rest.
    isAdmin:    function () { return state.role === 'admin'; },

    // What to call this person in the editor chrome.
    displayName: function () {
      return (auth && auth.displayName && auth.displayName()) ||
             (state.user ? state.user.email : '');
    },

    signOut: function () {
      return auth.signOut().then(function () { leaveFor(LOGIN_PAGE); });
    }
  };

  api.ready = new Promise(function (resolve) { settle = resolve; });

  window.MedCareEditorGuard = api;

  /* The chrome — sidebar, topbar, drawer, "which page is this" — is
     admin/js/admin-shell.js, loaded unchanged by both areas. It looks
     for its guard under one fixed name, so we answer to that name too.

     Copying it into an editor-shell.js instead would be two files that
     agree today and disagree by the third change, which is the exact
     drift its own header comment was written to avoid. The alias is the
     cheaper of the two wrongs, and this comment is the price. */
  window.MedCareAdminGuard = api;

  root.classList.add('mc-guard-pending');

  if (!auth || !db) {
    // supabase.js has already said why on the console.
    stall('Editor area unavailable',
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

    if (ALLOWED.indexOf(state.role) === -1) {
      // Signed in, but a reader. Back to the public site — the database
      // would refuse every write on this page anyway, and the lists
      // would come back holding only published rows.
      leaveFor(SITE_PAGE);
      return;
    }

    state.passed = true;
    reveal();
    settle(state);
  });

  /* An expired or revoked session is the case worth handling carefully.
     Without this, the page keeps its rendered form while every save
     behind it starts failing — which reads as "the site is broken"
     rather than "you are signed out", and on an edit screen it reads as
     "my work is being lost".

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
