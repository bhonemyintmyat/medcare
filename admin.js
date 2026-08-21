/* ============================================================
   MedCare — admin dashboard
   Loaded only by admin.html, after auth.js.

   Two jobs: show the site-wide numbers, and change roles. Role
   changing is the only thing on this site that an editor cannot do,
   and the only screen that writes to public.profiles.
   ============================================================ */

(function () {
  'use strict';

  var app = document.getElementById('adminApp');
  if (!app) { return; }

  var checking = document.getElementById('adminChecking');
  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var whoEl     = document.getElementById('adminWho');
  var msgEl     = document.getElementById('adminMsg');
  var bodyEl    = document.getElementById('peopleBody');
  var countEl   = document.getElementById('peopleCount');
  var refreshEl = document.getElementById('peopleRefresh');
  var searchEl  = document.getElementById('peopleSearch');
  var filtersEl = document.getElementById('peopleFilters');

  var people      = [];     // every profile row the database returned
  var roleFilter  = 'all';
  var query       = '';
  var myId        = null;
  var hasEmail    = true;   // false until supabase_admin.sql has been run
  var hasNames    = true;   // false until supabase_display_name.sql has been run

  var ROLES = ['user', 'editor', 'admin'];

  /* ================================================================
     THE GUARD — CONVENIENCE ONLY, NOT SECURITY
     ----------------------------------------------------------------
     As on every other staff page: this decides what to SHOW. An editor
     who edits the check below still cannot change a role, because the
     policy in supabase_rls.sql is what grants it:

       "Admins can read all profiles"  using (my_role() = 'admin')
       "Admins can change roles"       using + with check, same test

     and supabase_admin.sql narrows the write further, to the `role`
     column alone, with a column GRANT. An editor's update returns
     42501 or simply touches zero rows. Nothing here is trusted.

     The self-promotion case is worth stating plainly: there is no
     UPDATE policy for ordinary users at all, so no reader can make
     themselves staff, whatever they do to this file.
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
      if (!auth.hasRole('admin')) {
        // An editor gets their own dashboard rather than a dead end.
        window.location.replace(auth.isStaff() ? 'editor-dashboard.html' : 'index.html');
        return;
      }

      checking.style.display = 'none';
      app.style.display = 'block';

      myId = auth.getUser().id;
      whoEl.textContent = auth.getUser().email + ' · admin';

      loadStats();
      loadPeople();
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function message(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
    if (kind === 'ok') {
      window.setTimeout(function () { msgEl.style.display = 'none'; }, 4000);
    }
  }

  // Turns a Supabase error into something a human can act on.
  function explain(err) {
    if (!err) { return 'Something went wrong.'; }
    if (err.code === '42501') {
      // RLS or the column grant refusing the write — the policies working.
      return 'The database refused this change: your account does not have permission (RLS).';
    }
    if (err.code === '42703') {
      return 'The profiles table has no email column yet. Run supabase_admin.sql in the Supabase SQL editor.';
    }
    if (err.code === '23514') {
      return 'That is not a valid role. Allowed values are user, editor, and admin.';
    }
    return err.message || 'Something went wrong.';
  }

  function fullDate(iso) {
    if (!iso) { return '—'; }
    return new Date(iso).toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.textContent = value == null ? '—' : String(value);
    el.classList.remove('is-loading');
  }

  /* ---------- counts ----------
     head:true returns the count without the rows. The reports and
     diseases counts are the same queries the editor desk runs; the
     account counts come from the profiles rows already loaded, so an
     admin-only table is not fetched twice. */
  function count(table, column, value) {
    var q = db.from(table).select('id', { count: 'exact', head: true });
    if (column) { q = q.eq(column, value); }
    return q.then(function (res) {
      if (res.error) { throw res.error; }
      return res.count == null ? 0 : res.count;
    });
  }

  function loadStats() {
    count('diseases')
      .then(function (n) { setStat('statDiseases', n); })
      .catch(function () { setStat('statDiseases', '—'); });

    count('reports', 'status', 'new')
      .then(function (n) { setStat('statNew', n); })
      .catch(function () { setStat('statNew', '—'); });

    count('reports', 'status', 'reviewed')
      .then(function (n) {
        var sub = document.getElementById('statReportsSub');
        // Same reason as the staff line above: the label is its own node.
        if (sub) { sub.innerHTML = '<span>Reviewed</span> ' + n; }
      })
      .catch(function () { /* the sub-line is cosmetic */ });
  }

  // Called after the profiles list arrives: the tiles and the table
  // describe the same rows, so they cannot disagree.
  function statsFromPeople(rows) {
    var editors = rows.filter(function (p) { return p.role === 'editor'; }).length;
    var admins  = rows.filter(function (p) { return p.role === 'admin'; }).length;
    setStat('statAccounts', rows.length);
    setStat('statStaff', editors + admins);
    // Label first, and each label in its own element. script.js translates
    // whole text nodes, so a number glued to its word ("2 admins") can never
    // match a dictionary key; kept apart, both halves work in either language.
    var sub = document.getElementById('statStaffSub');
    if (sub) {
      sub.innerHTML = '<span>Admins</span> ' + admins + ' · <span>Editors</span> ' + editors;
    }
  }

  /* ---------- loading the accounts ----------
     "Admins can read all profiles" is what makes this return more than
     one row. The same query run by an editor returns exactly their own
     profile — Postgres filters the rest out before the response is
     built, so there is nothing to leak. */
  function loadPeople() {
    bodyEl.innerHTML = '<tr><td colspan="3"><div class="mc-admin-loading">Loading accounts…</div></td></tr>';

    select('id,email,display_name,full_name,role,created_at')
      .catch(function (err) {
        // Names arrive with supabase_display_name.sql. Without them the
        // table still works, listing accounts by email.
        if (err && err.code === '42703') {
          hasNames = false;
          return select('id,email,role,created_at');
        }
        throw err;
      })
      .catch(function (err) {
        // The email column arrives with supabase_admin.sql. Without it
        // the page still works, listing accounts by id.
        if (err && err.code === '42703') {
          hasEmail = false;
          message('Showing account ids only: profiles has no email column yet. ' +
                  'Run supabase_admin.sql to add it.', 'error');
          return select('id,role,created_at');
        }
        throw err;
      })
      .then(function (rows) {
        people = rows;
        statsFromPeople(rows);
        render();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load profiles:', err);
        bodyEl.innerHTML = '<tr><td colspan="3"><div class="mc-admin-loading">' +
          'Could not load accounts.</div></td></tr>';
        message(explain(err));
      });
  }

  function select(columns) {
    return db.from('profiles').select(columns).order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) { throw res.error; }
        return res.data || [];
      });
  }

  /* ---------- rendering ---------- */
  // What to call this account on screen, in the same order the rest of
  // the site uses: the display name they picked, then their name, then
  // the email, then the bare id.
  function label(p) {
    if (hasNames && p.display_name) { return p.display_name; }
    if (hasNames && p.full_name) { return p.full_name; }
    if (hasEmail && p.email) { return p.email; }
    return 'Account ' + p.id.slice(0, 8);
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return people.filter(function (p) {
      if (roleFilter !== 'all' && p.role !== roleFilter) { return false; }
      if (!q) { return true; }
      return (p.display_name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.full_name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.email || '').toLowerCase().indexOf(q) !== -1 ||
             p.role.indexOf(q) !== -1 ||
             p.id.toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    var rows = visible();
    countEl.textContent = rows.length;

    if (!rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="3"><div class="mc-admin-loading">' +
        (people.length ? 'No account matches this filter.' : 'No accounts yet.') +
        '</div></td></tr>';
      return;
    }

    bodyEl.innerHTML = rows.map(function (p) {
      var isMe = p.id === myId;
      var name = esc(label(p));
      // The email is a fallback identity, not a second label: it appears
      // only for accounts that have not picked a display name yet.
      var mail = (hasEmail && p.email && !(hasNames && p.display_name) && p.email !== label(p))
        ? '<div class="mc-people-mail">' + esc(p.email) + '</div>' : '';

      var options = ROLES.map(function (r) {
        return '<option value="' + r + '"' + (r === p.role ? ' selected' : '') + '>' + r + '</option>';
      }).join('');

      return '<tr data-id="' + esc(p.id) + '">' +
        '<td>' +
          '<div class="mc-people-email">' + name +
            (isMe ? '<span class="mc-people-you">you</span>' : '') + '</div>' +
          mail +
          '<div class="mc-people-id">' + esc(p.id) + '</div>' +
        '</td>' +
        '<td class="mc-people-when">' + esc(fullDate(p.created_at)) + '</td>' +
        '<td>' +
          '<div class="mc-people-actions">' +
            '<span class="mc-admin-pill mc-account-role--' + esc(p.role) + '" data-current>' + esc(p.role) + '</span>' +
            '<select class="mc-role-select" aria-label="Role for ' + name + '">' + options + '</select>' +
            '<button type="button" class="mc-auth-btn mc-people-save" hidden>Save</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- changing a role ---------- */
  function rowFor(el) {
    var tr = el.closest('tr');
    if (!tr) { return null; }
    var id = tr.getAttribute('data-id');
    var record = people.filter(function (p) { return p.id === id; })[0];
    return record ? { tr: tr, id: id, record: record } : null;
  }

  function onTableChange(e) {
    var select = e.target.closest('.mc-role-select');
    if (!select) { return; }
    var row = rowFor(select);
    if (!row) { return; }
    // The Save button only appears once the value actually differs, so a
    // stray click on the dropdown cannot write anything.
    row.tr.querySelector('.mc-people-save').hidden = (select.value === row.record.role);
  }

  function onTableClick(e) {
    var btn = e.target.closest('.mc-people-save');
    if (!btn) { return; }
    var row = rowFor(btn);
    if (!row) { return; }

    var select  = row.tr.querySelector('.mc-role-select');
    var next    = select.value;
    var current = row.record.role;
    if (next === current) { return; }

    // Locking yourself out is the one mistake this page can make that it
    // cannot undo from the browser: only an admin may restore an admin.
    var admins = people.filter(function (p) { return p.role === 'admin'; }).length;
    if (current === 'admin' && next !== 'admin' && admins <= 1) {
      message('This is the only admin account. Promote somebody else first, ' +
              'or the site would have no admin at all.');
      return;
    }
    if (row.id === myId && next !== 'admin') {
      var ok = window.confirm(
        'Change your own role to "' + next + '"?\n\n' +
        'You will lose access to this page immediately, and only another ' +
        'admin (or the Supabase SQL editor) can give it back.');
      if (!ok) { return; }
    }

    btn.disabled = true;
    select.disabled = true;
    msgEl.style.display = 'none';

    db.from('profiles')
      .update({ role: next })
      .eq('id', row.id)
      // Ask for the row back: RLS refusals are not always errors. An
      // update that matches no rows returns 200 with an empty array, and
      // that silence is exactly what a non-admin would get here.
      .select('id,role')
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data || !res.data.length) {
          throw { code: '42501', message: 'The database changed nothing: no row matched.' };
        }

        row.record.role = next;
        message(label(row.record) + ' is now ' + next + '.', 'ok');
        statsFromPeople(people);

        if (row.id === myId) {
          // Our own role decides what this page shows. Reload so the
          // guard, the navbar, and the cached role all agree again.
          window.location.reload();
          return;
        }
        render();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not change role:', err);
        message(explain(err));
        btn.disabled = false;
        select.disabled = false;
        select.value = current;
        btn.hidden = true;
      });
  }

  function onFilterClick(e) {
    var chip = e.target.closest('.mc-chip');
    if (!chip) { return; }
    roleFilter = chip.getAttribute('data-role');
    Array.prototype.forEach.call(filtersEl.children, function (b) {
      b.classList.toggle('is-active', b === chip);
    });
    render();
  }

  /* ---------- wiring ---------- */
  bodyEl.addEventListener('change', onTableChange);
  bodyEl.addEventListener('click', onTableClick);
  filtersEl.addEventListener('click', onFilterClick);
  refreshEl.addEventListener('click', function () {
    msgEl.style.display = 'none';
    loadPeople();
  });
  searchEl.addEventListener('input', function () {
    query = searchEl.value;
    render();
  });

  guard();
})();
