(function () {
  'use strict';

  var ALLOWED = ['editor', 'admin'];

  var LOGIN_PAGE = '/login.html';
  var SITE_PAGE  = '/index.html';

  var PATIENCE_MS = 10000;

  var root = document.documentElement;
  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var settle;
  var state = { user: null, profile: null, role: null, passed: false };

  function reveal() {
    root.classList.add('mc-guard-ok');
    root.classList.remove('mc-guard-pending');
  }

  function leaveFor(url) {

    window.location.replace(url);
  }

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

    ready: null,

    getUser:    function () { return state.user; },
    getProfile: function () { return state.profile; },
    getRole:    function () { return state.role; },

    isAdmin:    function () { return state.role === 'admin'; },

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

  window.MedCareAdminGuard = api;

  root.classList.add('mc-guard-pending');

  if (!auth || !db) {

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

      leaveFor(SITE_PAGE);
      return;
    }

    state.passed = true;
    reveal();
    settle(state);
  });

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
