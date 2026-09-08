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

  var people      = [];
  var roleFilter  = 'all';
  var query       = '';
  var myId        = null;
  var hasEmail    = true;
  var hasNames    = true;

  var ROLES = ['user', 'editor', 'admin'];

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

  function explain(err) {
    if (!err) { return 'Something went wrong.'; }
    var msg = err.message || '';

    if (/delete_self_forbidden/.test(msg)) {
      return 'An admin cannot delete their own account from this list. ' +
             'Use “Delete your account” in the account menu, top right.';
    }
    if (/delete_forbidden/.test(msg)) {
      return 'The database refused it: only an admin may delete somebody else’s account. ' +
             'Your session may have expired — reload and try again.';
    }
    if (/last_admin_forbidden/.test(msg)) {
      return 'That is the only admin account, and the site would be left with nobody who ' +
             'can run it. Promote somebody else to admin first.';
    }
    if (/account_not_found/.test(msg)) {
      return 'No account has that id any more — it may have been deleted already. ' +
             'Press Refresh to see the list as it stands.';
    }
    if (/permission denied for table users/i.test(msg)) {
      return 'The database accepted the request but is not allowed to carry it out. ' +
             'Run supabase_account_deletion.sql as postgres — its first section says why.';
    }
    if (err.code === 'PGRST202') {
      return 'Account deletion is not switched on for this site yet. ' +
             'Run supabase_account_deletion.sql in the Supabase SQL editor.';
    }
    if (err.code === 'PGRST301') {
      return 'Your session is no longer valid, so nothing was deleted. Reload and sign in again.';
    }

    if (err.code === '42501') {

      return 'The database refused this change: your account does not have permission (RLS).';
    }
    if (err.code === '42703') {
      return 'The profiles table has no email column yet. Run supabase_admin.sql in the Supabase SQL editor.';
    }
    if (err.code === '23514') {
      return 'That is not a valid role. Allowed values are user, editor, and admin.';
    }
    return msg || 'Something went wrong.';
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

        if (sub) { sub.innerHTML = '<span>Reviewed</span> ' + n; }
      })
      .catch(function () {  });
  }

  function statsFromPeople(rows) {
    var editors = rows.filter(function (p) { return p.role === 'editor'; }).length;
    var admins  = rows.filter(function (p) { return p.role === 'admin'; }).length;
    setStat('statAccounts', rows.length);
    setStat('statStaff', editors + admins);

    var sub = document.getElementById('statStaffSub');
    if (sub) {
      sub.innerHTML = '<span>Admins</span> ' + admins + ' · <span>Editors</span> ' + editors;
    }
  }

  function loadPeople() {
    bodyEl.innerHTML = '<tr><td colspan="5"><div class="mc-admin-loading">Loading accounts…</div></td></tr>';

    select('id,email,display_name,full_name,role,created_at')
      .catch(function (err) {

        if (err && err.code === '42703') {
          hasNames = false;
          return select('id,email,role,created_at');
        }
        throw err;
      })
      .catch(function (err) {

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
        bodyEl.innerHTML = '<tr><td colspan="5"><div class="mc-admin-loading">' +
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
      bodyEl.innerHTML = '<tr><td colspan="5"><div class="mc-admin-loading">' +
        (people.length ? 'No account matches this filter.' : 'No accounts yet.') +
        '</div></td></tr>';
      return;
    }

    bodyEl.innerHTML = rows.map(function (p) {
      var isMe = p.id === myId;
      var name = esc(label(p));

      var emailCell = (hasEmail && p.email)
        ? '<a class="mc-people-mailcell" href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>'
        : '<span class="mc-people-mailcell mc-people-mailcell--none">—</span>';

      var options = ROLES.map(function (r) {
        return '<option value="' + r + '"' + (r === p.role ? ' selected' : '') + '>' + r + '</option>';
      }).join('');

      return '<tr data-id="' + esc(p.id) + '">' +
        '<td>' +
          '<div class="mc-people-email">' + name +
            (isMe ? '<span class="mc-people-you">you</span>' : '') + '</div>' +
          '<div class="mc-people-id">' + esc(p.id) + '</div>' +
        '</td>' +
        '<td>' + emailCell + '</td>' +
        '<td>' +

          '<div class="mc-people-role">' +
            '<span class="mc-admin-pill mc-account-role--' + esc(p.role) + '" data-current>' + esc(p.role) + '</span>' +
            '<select class="mc-role-select" aria-label="Role for ' + name + '">' + options + '</select>' +
            '<button type="button" class="mc-auth-btn mc-people-save" hidden>Save</button>' +
          '</div>' +
        '</td>' +
        '<td class="mc-people-when">' + esc(fullDate(p.created_at)) + '</td>' +
        '<td class="mc-people-actions-col">' +

          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost mc-people-delete" ' +
                  'data-act="delete"' +
                  (isMe ? ' disabled title="Delete your own account from the account menu, ' +
                          'not from this list."' : '') +
                  '>Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

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

    row.tr.querySelector('.mc-people-save').hidden = (select.value === row.record.role);
  }

  function onTableClick(e) {
    var del = e.target.closest('.mc-people-delete');
    if (del) {
      if (del.disabled) { return; }
      var drow = rowFor(del);
      if (drow) { removeAccount(drow.record); }
      return;
    }

    var btn = e.target.closest('.mc-people-save');
    if (!btn) { return; }
    var row = rowFor(btn);
    if (!row) { return; }

    var select  = row.tr.querySelector('.mc-role-select');
    var next    = select.value;
    var current = row.record.role;
    if (next === current) { return; }

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

  function removeAccount(p) {

    if (p.id === myId) { return; }

    var name = label(p);
    var consequence = (p.role === 'user')
      ? 'Their saved diseases and articles go too. Reports they filed stay, ' +
        'without their name on them.'
      : 'Everything they wrote stays on the site, unsigned — the medical guidance ' +
        'does not leave with them. Their saved items and their ' + p.role + ' rights go.';

    confirmByName({
      title: 'Delete this account?',
      body: name + ' will be removed from MedCare: their email, their password and ' +
            'their profile. They will not be able to sign in again, and nothing on ' +
            'this site can undo it. ' + consequence,
      expect: name,
      go: 'Delete the account'
    }).then(function (yes) {
      if (!yes) { return; }
      msgEl.style.display = 'none';

      db.rpc('delete_account', { target_id: p.id })
        .then(function (res) {
          if (res.error) { throw res.error; }

          people = people.filter(function (row) { return row.id !== p.id; });
          statsFromPeople(people);
          render();
          message(name + ' has been deleted. Anything they wrote is still on the site, ' +
                  'with the author line blank.', 'ok');
        })
        .catch(function (err) {
          console.error('[MedCare] Could not delete the account:', err);
          message(explain(err));
        });
    });
  }

  function openDialog(html) {
    var opener = document.activeElement;
    var host = document.createElement('div');
    host.className = 'mc-modal is-open';
    host.innerHTML = html;
    document.body.appendChild(host);
    return {
      host: host,
      close: function () {
        host.remove();
        if (opener && opener.focus) { opener.focus(); }
      }
    };
  }

  function confirmByName(opts) {
    var expect = String(opts.expect || '').trim();
    var d = openDialog(
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcNameTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico mc-modal-ico--danger"><i class="bi bi-person-x"></i></div>' +
        '<h2 id="mcNameTitle">' + esc(opts.title) + '</h2>' +
        '<p class="mc-modal-sub">' + esc(opts.body) + '</p>' +
        '<div class="mc-modal-msg mc-modal-msg--error" data-err style="display:none"></div>' +
        '<label class="mc-auth-label" for="mcNameInput">Type <strong>' + esc(expect) +
          '</strong> to confirm</label>' +
        '<div class="mc-auth-field">' +
          '<i class="bi bi-input-cursor-text"></i>' +
          '<input id="mcNameInput" type="text" autocomplete="off" spellcheck="false" data-input>' +
        '</div>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--danger" data-go disabled>' +
            esc(opts.go || 'Delete') + '</button>' +
        '</div>' +
      '</div>');

    var input = d.host.querySelector('[data-input]');
    var goBtn = d.host.querySelector('[data-go]');
    var errEl = d.host.querySelector('[data-err]');
    input.focus();

    function matches() {
      return input.value.trim().toLowerCase() === expect.toLowerCase();
    }
    input.addEventListener('input', function () {
      goBtn.disabled = !matches();
      errEl.style.display = 'none';
    });

    return new Promise(function (resolve) {
      function onKey(e) {
        if (e.key === 'Escape' || e.key === 'Esc') { finish(false); }
      }
      document.addEventListener('keydown', onKey);
      function finish(answer) {
        document.removeEventListener('keydown', onKey);
        d.close();
        resolve(answer);
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && matches()) { finish(true); }
      });
      d.host.addEventListener('click', function (e) {
        if (e.target.closest('[data-go]')) {
          if (!matches()) {
            errEl.textContent = 'That is not the name on the account. Check you have the right row.';
            errEl.style.display = 'block';
            return;
          }
          finish(true);
          return;
        }
        if (e.target.closest('[data-close]')) { finish(false); }
      });
    });
  }

  var addBtn = document.getElementById('addStaffBtn');

  var STAFF_ROLES = [
    { value: 'editor', label: 'Editor', blurb: 'Can change what the site says about illness.' },
    { value: 'admin',  label: 'Admin',  blurb: 'Everything an editor can do, plus roles, deletion and the site’s state.' }
  ];

  function explainInvite(code, detail) {
    switch (code) {
      case 'not_admin':
        return 'Your account is not an admin any more, so it cannot invite staff. Reload and check.';
      case 'not_signed_in':
        return 'Your session has expired. Reload the page and sign in again.';
      case 'already_exists':
        return 'Someone already has an account with that email. Find them in the list to change their role.';
      case 'bad_email':
        return 'That email address does not look right. Check it and try again.';
      case 'bad_role':
        return 'Choose a role for the new member of staff.';
      case 'role_assign_failed':
        return 'The invitation was sent, but their role could not be set. Set it from the list once they appear.';
      case 'invite_failed':
        if (detail && /redirect|not allowed|url/i.test(detail)) {
          return 'The invite could not be sent: this site’s address is not on Supabase’s allowed-redirect ' +
                 'list yet. Add accept-invite.html under Authentication → URL Configuration, then try again.';
        }
        if (detail && /smtp|mail|send/i.test(detail)) {
          return 'The account was made but the email could not be sent — check the SMTP settings in Supabase. ' +
                 'The invitee can still be reached with a fresh invite once mail works.';
        }
        return 'The invitation could not be sent. ' + (detail || 'Please try again.');
      default:
        return detail || 'The invitation could not be sent. Please try again.';
    }
  }

  function openStaffDialog() {
    var roleOptions = STAFF_ROLES.map(function (r) {
      return '<option value="' + r.value + '">' + r.label + '</option>';
    }).join('');

    var d = openDialog(
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcStaffTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico mc-modal-ico--ok"><i class="bi bi-person-plus"></i></div>' +
        '<h2 id="mcStaffTitle">Add new staff</h2>' +
        '<p class="mc-modal-sub">They are emailed an invitation and choose their own password — ' +
          'you never set it. The account appears in the list straight away, with the role you pick.</p>' +
        '<form id="mcStaffForm" novalidate style="text-align:left">' +
          '<label class="mc-auth-label" for="mcStaffFull">Full name</label>' +
          '<div class="mc-auth-field"><i class="bi bi-person"></i>' +
            '<input id="mcStaffFull" type="text" autocomplete="off" maxlength="80" placeholder="Kyaw Kyaw"></div>' +

          '<label class="mc-auth-label" for="mcStaffDisplay">Display name <span style="font-weight:400;color:var(--mc-muted)">(optional)</span></label>' +
          '<div class="mc-auth-field"><i class="bi bi-person-badge"></i>' +
            '<input id="mcStaffDisplay" type="text" autocomplete="off" maxlength="60" placeholder="What the site calls them"></div>' +

          '<label class="mc-auth-label" for="mcStaffRole">Role</label>' +
          '<div class="mc-auth-field"><i class="bi bi-shield-check"></i>' +
            '<select id="mcStaffRole" class="mc-role-select" style="flex:1;background:transparent;border:none;padding:.7rem .9rem .7rem 2.5rem">' +
              roleOptions + '</select></div>' +
          '<p class="mc-auth-hint" id="mcStaffRoleBlurb" style="margin:-.6rem 0 1rem">' + STAFF_ROLES[0].blurb + '</p>' +

          '<label class="mc-auth-label" for="mcStaffEmail">Email address</label>' +
          '<div class="mc-auth-field"><i class="bi bi-envelope"></i>' +
            '<input id="mcStaffEmail" type="email" autocomplete="off" placeholder="them@example.com"></div>' +

          '<div class="mc-modal-msg mc-modal-msg--error" id="mcStaffErr" style="display:none"></div>' +
          '<div class="mc-modal-actions">' +
            '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
            '<button type="submit" class="mc-auth-btn" id="mcStaffGo">Send invitation</button>' +
          '</div>' +
        '</form>' +
      '</div>');

    var form    = d.host.querySelector('#mcStaffForm');
    var fullEl  = d.host.querySelector('#mcStaffFull');
    var dispEl  = d.host.querySelector('#mcStaffDisplay');
    var roleEl  = d.host.querySelector('#mcStaffRole');
    var blurbEl = d.host.querySelector('#mcStaffRoleBlurb');
    var emailEl = d.host.querySelector('#mcStaffEmail');
    var errEl   = d.host.querySelector('#mcStaffErr');
    var goBtn   = d.host.querySelector('#mcStaffGo');
    fullEl.focus();

    function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') { finish(); } }
    document.addEventListener('keydown', onKey);
    function finish() { document.removeEventListener('keydown', onKey); d.close(); }

    function staffErr(text) {
      if (!text) { errEl.style.display = 'none'; errEl.textContent = ''; return; }
      errEl.textContent = text;
      errEl.style.display = 'block';
    }

    roleEl.addEventListener('change', function () {
      var r = STAFF_ROLES.filter(function (x) { return x.value === roleEl.value; })[0];
      blurbEl.textContent = r ? r.blurb : '';
    });

    d.host.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { finish(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fullName = fullEl.value.trim();
      var display  = dispEl.value.trim();
      var role     = roleEl.value;
      var email    = emailEl.value.trim();

      if (!fullName) { staffErr('Give the new member of staff a full name.'); fullEl.focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { staffErr('That email address does not look right.'); emailEl.focus(); return; }
      if (role !== 'editor' && role !== 'admin') { staffErr('Choose a role.'); roleEl.focus(); return; }

      staffErr('');
      goBtn.disabled = true;
      goBtn.textContent = 'Sending…';

      var redirectTo = new URL('accept-invite.html', window.location.href).href;

      db.functions.invoke('invite-staff', {
        body: { full_name: fullName, display_name: display || null, role: role, email: email, redirectTo: redirectTo }
      }).then(function (res) {
        if (res.error) {
          var ctx = res.error.context;
          if (ctx && typeof ctx.json === 'function') {
            return ctx.json().then(function (b) {
              throw { code: (b && b.error), detail: (b && b.detail) };
            }, function () {
              throw { code: null, detail: res.error.message };
            });
          }
          throw { code: null, detail: res.error.message };
        }

        finish();
        message('Invitation sent to ' + email + '. They appear below as ' + role +
                ' now, and can sign in once they set a password from the email.', 'ok');
        loadPeople();
      }).catch(function (err) {
        console.error('[MedCare] Could not invite staff:', err);
        staffErr(explainInvite(err && err.code, err && err.detail));
        goBtn.disabled = false;
        goBtn.textContent = 'Send invitation';
      });
    });
  }

  if (addBtn) { addBtn.addEventListener('click', openStaffDialog); }
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
