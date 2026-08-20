/* ============================================================
   MedCare — editor desk
   Loaded only by editor-dashboard.html, after auth.js and
   reports-queue.js.

   The desk is a hub, not a new tool: the report queue it shows is the
   very same reports-queue.js that reports.html and manage-diseases.html
   use, started here once the role guard has passed. Everything this
   file adds on top is read-only — counts and a recent-conditions list.
   ============================================================ */

(function () {
  'use strict';

  var app = document.getElementById('adminApp');
  if (!app) { return; }

  var checking  = document.getElementById('adminChecking');
  var auth      = window.MedCareAuth;
  var db        = window.supabaseClient;

  var whoEl     = document.getElementById('deskWho');
  var msgEl     = document.getElementById('deskMsg');
  var adminCard = document.getElementById('deskAdminCard');
  var recentEl  = document.getElementById('recentList');
  var recentNum = document.getElementById('recentCount');

  /* ================================================================
     THE GUARD — CONVENIENCE ONLY, NOT SECURITY
     ----------------------------------------------------------------
     Same rule as manage-diseases.js and reports.js: this redirect only
     spares a reader a page of controls that would fail for them. It
     runs on the visitor's machine, so it protects nothing.

     What is actually enforced, in Postgres, on every request:

       reports   "Staff can read all reports"     -> my_role() in ('editor','admin')
                 "Staff can update report status" -> same, plus grant update(status)
       diseases  "Anyone can read diseases"       -> the counts below are public anyway

     Delete this guard and a plain user reaches the desk — and sees a
     queue holding only their own reports, because RLS filtered the
     rest out before the browser ever saw them.

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

      var user = auth.getUser();
      var role = auth.getRole() || 'editor';
      whoEl.textContent = user.email + ' · ' + role;
      // The tile is hidden markup for an editor; admin.html re-checks the
      // role for itself, so revealing it is a convenience, not a hole.
      if (role === 'admin' && adminCard) { adminCard.style.display = 'flex'; }

      // Only now does anything fetch.
      if (window.MedCareReportsQueue) { window.MedCareReportsQueue.start(); }
      loadStats();
      loadRecent();
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function message(text, kind) {
    if (!msgEl) { return; }
    msgEl.textContent = text;
    msgEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.textContent = value == null ? '—' : String(value);
    el.classList.remove('is-loading');
  }

  // "3 d ago" reads better than a timestamp in a list you scan.
  function when(iso) {
    if (!iso) { return ''; }
    var then = new Date(iso), mins = Math.round((Date.now() - then.getTime()) / 60000);
    if (mins < 1)     { return 'just now'; }
    if (mins < 60)    { return mins + ' min ago'; }
    if (mins < 1440)  { return Math.round(mins / 60) + ' h ago'; }
    if (mins < 10080) { return Math.round(mins / 1440) + ' d ago'; }
    return then.toLocaleDateString();
  }

  /* ---------- counts ----------
     head:true asks Postgres for the count without shipping the rows —
     three small queries instead of three table downloads. */
  function count(table, column, value) {
    var q = db.from(table).select('id', { count: 'exact', head: true });
    if (column) { q = q.eq(column, value); }
    return q.then(function (res) {
      if (res.error) { throw res.error; }
      return res.count == null ? 0 : res.count;
    });
  }

  function loadStats() {
    count('reports', 'status', 'new')
      .then(function (n) { setStat('statNew', n); })
      .catch(function (err) {
        console.error('[MedCare] Could not count new reports:', err);
        setStat('statNew', '—');
      });

    count('reports', 'status', 'reviewed')
      .then(function (n) { setStat('statReviewed', n); })
      .catch(function () { setStat('statReviewed', '—'); });

    count('diseases')
      .then(function (n) { setStat('statDiseases', n); })
      .catch(function () { setStat('statDiseases', '—'); });
  }

  /* ---------- recently added conditions ---------- */
  function loadRecent() {
    recentEl.innerHTML = '<div class="mc-admin-loading">Loading conditions…</div>';

    db.from('diseases')
      .select('id,name,tag,href,created_at')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(function (res) {
        if (res.error) { throw res.error; }
        var rows = res.data || [];
        recentNum.textContent = rows.length;

        if (!rows.length) {
          recentEl.innerHTML = '<div class="mc-admin-loading">No conditions yet. ' +
            'Add the first one in the disease manager.</div>';
          setStat('statLatest', '—');
          return;
        }

        // The newest row doubles as the "newest condition" tile.
        setStat('statLatest', when(rows[0].created_at));
        var nameEl = document.getElementById('statLatestName');
        if (nameEl) { nameEl.textContent = rows[0].name; }

        recentEl.innerHTML = rows.map(function (d) {
          return '<div class="mc-admin-row">' +
            '<span class="mc-admin-row-icon"><i class="bi bi-journal-medical"></i></span>' +
            '<div class="mc-admin-row-main">' +
              '<div class="mc-admin-row-name">' + esc(d.name) + '</div>' +
              '<div class="mc-admin-row-meta">' +
                '<span class="mc-admin-pill">' + esc(d.tag) + '</span>' +
                '<span class="mc-admin-cat">' + esc(when(d.created_at)) + '</span>' +
              '</div>' +
              '<div class="mc-admin-row-href"><a href="' + esc(d.href) + '">' + esc(d.href) + '</a></div>' +
            '</div>' +
          '</div>';
        }).join('');
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load conditions:', err);
        recentEl.innerHTML = '<div class="mc-admin-loading">Could not load conditions.</div>';
        message('Could not load the condition list. Check the console for details.');
      });
  }

  guard();
})();
