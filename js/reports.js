/* ============================================================
   MedCare — reports inbox page guard
   Loaded only by reports.html, after auth.js and reports-queue.js.

   This file does one job: decide whether to show the page. All the
   list/filter/update behaviour lives in reports-queue.js, which
   manage-diseases.html shares.
   ============================================================ */

(function () {
  'use strict';

  var app = document.getElementById('adminApp');
  if (!app) { return; }

  var checking = document.getElementById('adminChecking');
  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  /* ================================================================
     THE GUARD — CONVENIENCE ONLY, NOT SECURITY
     ----------------------------------------------------------------
     The redirect below spares a signed-in reader a page full of
     controls that would only fail for them. That is all it does.

     It protects nothing. This file runs on the visitor's machine:
     anyone can open DevTools, set a breakpoint, edit the source, or
     skip the page entirely and call the REST API with curl. No
     client-side check survives that, and none is meant to.

     What actually protects the reports is RLS, from step 2
     (supabase_reports_rls.sql):

       "Users can read their own reports"  using (user_id = auth.uid())
       "Staff can read all reports"        using (my_role() in ('editor','admin'))
       "Staff can update report status"    using + with check, same test

     Those two SELECT policies are why this page can exist at all: the
     same `select * from reports` returns every row to an editor and
     only their own rows to a reader. Delete the redirect below and a
     plain user reaches this page — and sees a queue containing
     nothing but their own reports, because Postgres filtered the rest
     out before it ever reached the browser. Their "Mark reviewed"
     click returns 200 with an empty array: allowed to run, matched no
     rows.

     Verified against the live project: a plain user was refused every
     write and saw only their own report, while an editor saw both
     users' reports and could flip status.

     JavaScript decides what to SHOW. The database decides what is
     ALLOWED.
     ================================================================ */
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
        // Signed in, but role is 'user'.
        window.location.replace('index.html');
        return;
      }
      checking.style.display = 'none';
      app.style.display = 'block';
      // Only now does the queue fetch anything.
      if (window.MedCareReportsQueue) { window.MedCareReportsQueue.start(); }
    });
  }

  guard();
})();
