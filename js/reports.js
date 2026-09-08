(function () {
  'use strict';

  var app = document.getElementById('adminApp');
  if (!app) { return; }

  var checking = document.getElementById('adminChecking');
  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  function guard() {
    if (!auth || !db) {
      checking.innerHTML = '<div class="container"><div class="mc-empty-simple" style="display:block">' +
        '<div class="fw-semibold">Supabase is not configured</div>' +
        '<div>See the console for details.</div></div></div>';
      return;
    }

    auth.ready.then(function () {
      if (!auth.isSignedIn()) {
        window.location.replace('login.html');
        return;
      }
      if (!auth.isStaff()) {

        window.location.replace('index.html');
        return;
      }
      checking.style.display = 'none';
      app.style.display = 'block';

      if (window.MedCareReportsQueue) { window.MedCareReportsQueue.start(); }
    });
  }

  guard();
})();
