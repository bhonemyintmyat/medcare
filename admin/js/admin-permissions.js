/* ============================================================
   MedCare — roles and permissions
   Loaded by admin/permissions.html, after admin-guard.js,
   admin-shell.js and admin-api.js.

   The one screen on this site that changes what somebody is allowed to
   do. Three parts: the grant form, the list of who currently holds
   each role, and the capability matrix from admin-api.js.

   Everything here is a drawing decision. What actually decides is
   "Admins can change roles" and the guard_profile_role trigger, and the
   two guards this file spends the most code on — self-demotion and the
   last admin — are worth reading in that light:

     SELF-DEMOTION is enforced in the database. The trigger raises
     role_self_change_forbidden whatever the browser sends. The disabled
     radios here are a courtesy, so nobody discovers the rule by having
     a save fail.

     THE LAST ADMIN is NOT enforced anywhere but here. Postgres is
     perfectly willing to let the only admin be demoted by another
     admin — there is no constraint that counts them. If that happens,
     the site has no admin at all and no in-app way to appoint one; the
     fix is the Supabase SQL editor. So this check is real load-bearing
     logic rather than a nicety, and it is the one place in the admin
     area where the browser is the only thing standing between the site
     and a state it cannot leave.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  var api   = window.MedCareAdmin;
  if (!guard || !api) { return; }

  var esc = api.esc;

  var msgEl      = document.getElementById('permMsg');
  var searchEl   = document.getElementById('permSearch');
  var resultsEl  = document.getElementById('permResults');
  var emptyEl    = document.getElementById('permEmpty');
  var chosenEl   = document.getElementById('permChosen');
  var holdersEl  = document.getElementById('permHolders');
  var matrixEl   = document.getElementById('permMatrixBody');

  var MAX_RESULTS = 12;

  var accounts = [];
  var myId     = null;
  var chosenId = null;
  var pending  = null;      // the role the radios are currently showing
  var saving   = false;

  /* ---------------------------------------------------------------
     LOADING
     --------------------------------------------------------------- */

  function load() {
    return api.loadAccounts()
      .then(function (result) {
        accounts = result.rows;
        renderResults();
        renderHolders();
        if (chosenId) { renderForm(); }
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load accounts:', err);
        resultsEl.innerHTML =
          '<div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not load the accounts</h2>' +
            '<p>' + esc(api.describeError(err, 'the account list')) + '</p>' +
          '</div>';
        holdersEl.innerHTML = '';
        api.message(msgEl, 'error', api.describeError(err, 'the account list'));
      });
  }

  function accountById(id) {
    return accounts.filter(function (p) { return p.id === id; })[0] || null;
  }

  function adminCount() {
    return accounts.filter(function (p) { return p.role === 'admin'; }).length;
  }

  /* ---------------------------------------------------------------
     PICKING AN ACCOUNT
     --------------------------------------------------------------- */

  function matching() {
    var q = searchEl.value.trim().toLowerCase();
    var rows = accounts;
    if (q) {
      rows = accounts.filter(function (p) {
        return [p.display_name, p.full_name, p.username, p.email, p.role, p.id]
          .some(function (v) { return String(v || '').toLowerCase().indexOf(q) !== -1; });
      });
    }
    return rows;
  }

  function renderResults() {
    var rows = matching();

    if (!rows.length) {
      resultsEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-search"></i></span>' +
          '<h2>Nobody matches</h2>' +
          '<p>No account matches that. Search by name, email, or the account id.</p>' +
        '</div>';
      return;
    }

    var shown = rows.slice(0, MAX_RESULTS);
    resultsEl.innerHTML =
      shown.map(function (p) {
        var name = api.accountLabel(p);
        var sub  = (p.email && p.email !== name) ? p.email : p.id;
        /* An explicit label rather than one computed from the nested
           spans: the pill inside says "EDITOR", the name may be an
           email, and "Su Aung you EDITOR" is not what a screen reader
           should say for a button whose job is "choose this account". */
        return '<button type="button" class="mc-ad-result' +
                 (p.id === chosenId ? ' is-chosen' : '') + '" ' +
                 'aria-pressed="' + (p.id === chosenId) + '" ' +
                 'aria-label="' + esc(name + ' — ' + api.ROLES[p.role].label) + '" ' +
                 'data-id="' + esc(p.id) + '">' +
                 '<span class="mc-ad-result-body">' +
                   '<span class="mc-ad-result-name">' + esc(name) +
                     (p.id === myId ? '<span class="mc-people-you">you</span>' : '') +
                   '</span>' +
                   '<span class="mc-ad-result-sub">' + esc(sub) + '</span>' +
                 '</span>' +
                 api.rolePill(p.role) +
               '</button>';
      }).join('') +
      (rows.length > shown.length
        ? '<p class="mc-admin-hint mc-ad-more">' +
            (rows.length - shown.length) + ' more match. Narrow the search to see them.' +
          '</p>'
        : '');
  }

  /* ---------------------------------------------------------------
     THE FORM
     --------------------------------------------------------------- */

  function choose(id) {
    chosenId = id;
    var p = accountById(id);
    pending = p ? p.role : null;
    renderResults();
    renderForm();
  }

  /* What changes for this person, said in terms of what they will be
     able to do to the site rather than in terms of a role name. The
     name is the thing being chosen; the consequence is the thing being
     decided. */
  function consequence(from, to) {
    if (to === 'admin') {
      return 'They will be able to grant roles — including making somebody else ' +
             'an admin — close the public site for maintenance, and delete content ' +
             'outright.';
    }
    if (to === 'editor') {
      return 'They will be able to write, publish and archive every page on the ' +
             'site, including the emergency numbers. Nothing stands between what ' +
             'they publish and a reader acting on it.';
    }
    // to === 'user'
    if (from === 'admin') {
      return 'They lose the admin area on their next page load. If they are the ' +
             'person who knows how this site is run, make sure somebody else does.';
    }
    return 'They lose the editor area on their next page load. Everything they ' +
           'wrote stays on the site, still credited to them.';
  }

  function renderForm() {
    var p = accountById(chosenId);
    if (!p) {
      emptyEl.hidden = false;
      chosenEl.hidden = true;
      chosenEl.innerHTML = '';
      return;
    }

    emptyEl.hidden = true;
    chosenEl.hidden = false;

    var name    = api.accountLabel(p);
    var isMe    = p.id === myId;
    var current = p.role;
    var target  = pending || current;
    var onlyAdmin = current === 'admin' && adminCount() <= 1;

    var blocked = null;
    if (isMe) {
      blocked = 'This is your own account. The database refuses a role change made ' +
                'by an admin on their own row — guard_profile_role raises ' +
                'role_self_change_forbidden — so this is not a rule this page is ' +
                'choosing to apply. Ask another admin.';
    } else if (onlyAdmin && target !== 'admin') {
      blocked = 'This is the only admin account on the site. Demoting it leaves ' +
                'nobody able to grant roles, and no way back except the Supabase ' +
                'SQL editor. Promote somebody else to admin first.';
    }

    var changed = target !== current && !blocked;

    var options = api.ROLE_ORDER.map(function (key) {
      var role = api.ROLES[key];
      var id   = 'permRole_' + key;
      return '<label class="mc-ad-choice' + (target === key ? ' is-picked' : '') +
               (isMe ? ' is-locked' : '') + '" for="' + id + '">' +
               '<input type="radio" name="permRole" id="' + id + '" value="' + key + '"' +
                 ' aria-label="' + esc(role.label) + '"' +
                 (target === key ? ' checked' : '') +
                 (isMe ? ' disabled' : '') + '>' +
               '<span class="mc-ad-choice-body">' +
                 '<span class="mc-ad-choice-head">' +
                   api.rolePill(key) +
                   (key === current ? '<span class="mc-ad-choice-now">current</span>' : '') +
                 '</span>' +
                 '<span class="mc-ad-choice-blurb">' + esc(role.blurb) + '</span>' +
               '</span>' +
             '</label>';
    }).join('');

    chosenEl.innerHTML =
      '<div class="mc-ad-chosen">' +
        '<div class="mc-ad-chosen-name">' + esc(name) +
          (isMe ? '<span class="mc-people-you">you</span>' : '') + '</div>' +
        '<div class="mc-ad-chosen-sub">' +
          esc(p.email || '') +
          '<span class="mc-people-id">' + esc(p.id) + '</span>' +
        '</div>' +
      '</div>' +

      '<fieldset class="mc-ad-choices">' +
        '<legend class="mc-auth-label">Role</legend>' +
        options +
      '</fieldset>' +

      (blocked
        ? '<p class="mc-ad-warn mc-ad-warn--stop"><i class="bi bi-slash-circle"></i>' +
            '<span>' + esc(blocked) + '</span></p>'
        : '') +

      (changed
        ? '<p class="mc-ad-warn"><i class="bi bi-exclamation-triangle"></i>' +
            '<span>' + esc(consequence(current, target)) + '</span></p>'
        : '') +

      '<div class="mc-ad-actions">' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-cancel>Clear</button>' +
        '<button type="button" class="mc-auth-btn" data-save' + (changed ? '' : ' disabled') + '>' +
          (changed ? 'Make them ' + esc(api.ROLES[target].label.toLowerCase()) : 'Pick a different role') +
        '</button>' +
      '</div>';
  }

  /* ---------------------------------------------------------------
     SAVING
     --------------------------------------------------------------- */

  function save() {
    if (saving) { return; }
    var p = accountById(chosenId);
    if (!p) { return; }

    var current = p.role;
    var target  = pending;
    if (!target || target === current) { return; }

    // Re-checked at the moment of saving, not only when the radios were
    // drawn: the list may have been reloaded since, and the last-admin
    // count is the one number where a stale answer is unrecoverable.
    if (p.id === myId) { return; }
    if (current === 'admin' && target !== 'admin' && adminCount() <= 1) {
      api.message(msgEl, 'error',
        'Refused: that is the only admin account. Promote somebody else first.');
      return;
    }

    var name = api.accountLabel(p);

    api.confirmByName({
      title: 'Change this role?',
      body: name + ' goes from ' + api.ROLES[current].label.toLowerCase() +
            ' to ' + api.ROLES[target].label.toLowerCase() + '. ' +
            consequence(current, target),
      expect: name,
      go: 'Change the role',
      icon: target === 'user' ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle'
    }).then(function (yes) {
      if (!yes) { return; }

      saving = true;
      var btn = chosenEl.querySelector('[data-save]');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

      return api.setRole(p.id, target)
        .then(function (row) {
          // Trust the row that came back rather than what was asked for.
          p.role = row.role;
          pending = row.role;
          saving = false;
          renderResults();
          renderHolders();
          renderForm();
          api.message(msgEl, 'ok',
            name + ' is now ' + api.ROLES[row.role].label.toLowerCase() + '. ' +
            'It takes effect for them on their next page load.');
        })
        .catch(function (err) {
          saving = false;
          console.error('[MedCare] Could not change the role:', err);
          pending = current;          // the radios go back to the truth
          renderForm();
          api.message(msgEl, 'error',
            api.describeError(err, 'changing ' + name + '’s role'));
        });
    });
  }

  /* ---------------------------------------------------------------
     WHO HOLDS EACH ROLE
     --------------------------------------------------------------- */

  function holderList(role) {
    var rows = accounts.filter(function (p) { return p.role === role; });
    if (!rows.length) {
      return '<p class="mc-ad-holder-none">Nobody holds this role.</p>';
    }
    return '<ul class="mc-ad-holder-list">' +
      rows.map(function (p) {
        var name = api.accountLabel(p);
        return '<li>' +
          '<button type="button" class="mc-ad-holder" data-id="' + esc(p.id) + '">' +
            '<span class="mc-ad-holder-name">' + esc(name) +
              (p.id === myId ? '<span class="mc-people-you">you</span>' : '') + '</span>' +
            '<span class="mc-ad-holder-sub">' + esc(p.email || p.id) + '</span>' +
          '</button>' +
        '</li>';
      }).join('') +
    '</ul>';
  }

  function renderHolders() {
    var admins  = accounts.filter(function (p) { return p.role === 'admin'; }).length;
    var readers = accounts.filter(function (p) { return p.role === 'user'; }).length;

    holdersEl.innerHTML =
      (admins <= 1
        ? '<p class="mc-ad-warn mc-ad-warn--stop"><i class="bi bi-exclamation-octagon"></i>' +
            '<span>There is only one admin account. If it is lost, nobody can grant ' +
            'roles or reopen the site from a maintenance page without going into the ' +
            'Supabase SQL editor. A second admin is cheap insurance.</span></p>'
        : '') +

      '<div class="mc-ad-holders">' +
        '<section>' +
          '<h3>' + api.rolePill('admin') + ' Admins</h3>' +
          holderList('admin') +
        '</section>' +
        '<section>' +
          '<h3>' + api.rolePill('editor') + ' Editors</h3>' +
          holderList('editor') +
        '</section>' +
      '</div>' +

      '<p class="mc-admin-hint mc-ad-readers">' +
        'Everybody else — <strong>' + readers + '</strong> ' +
        (readers === 1 ? 'account' : 'accounts') + ' — is a reader. ' +
        '<a href="users.html">See them all</a>.' +
      '</p>';
  }

  /* ---------------------------------------------------------------
     THE MATRIX
     ---------------------------------------------------------------
     Drawn from MedCareAdmin.CAPABILITIES. A row marked `nobody` is the
     interesting kind: it is a capability the site deliberately gives to
     no one, and leaving it off the table would make it look like an
     oversight rather than a decision.
     --------------------------------------------------------------- */

  function cell(allowed) {
    return allowed
      ? '<td class="mc-ad-yes"><i class="bi bi-check-lg"></i>' +
          '<span class="visually-hidden">Yes</span></td>'
      : '<td class="mc-ad-no"><i class="bi bi-dash"></i>' +
          '<span class="visually-hidden">No</span></td>';
  }

  function renderMatrix() {
    matrixEl.innerHTML = api.CAPABILITIES.map(function (row) {
      if (row.group) {
        return '<tr class="mc-ad-group"><th colspan="4" scope="colgroup">' +
                 esc(row.group) + '</th></tr>';
      }
      return '<tr' + (row.nobody ? ' class="mc-ad-nobody"' : '') + '>' +
        '<th scope="row">' +
          '<span class="mc-ad-what">' + esc(row.what) + '</span>' +
          '<span class="mc-ad-by">' + esc(row.by) + '</span>' +
        '</th>' +
        cell(row.user) + cell(row.editor) + cell(row.admin) +
      '</tr>';
    }).join('');
  }

  /* ---------------------------------------------------------------
     WIRING
     --------------------------------------------------------------- */

  searchEl.addEventListener('input', renderResults);

  resultsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.mc-ad-result');
    if (!btn) { return; }
    choose(btn.getAttribute('data-id'));
  });

  chosenEl.addEventListener('change', function (e) {
    var radio = e.target.closest('input[name="permRole"]');
    if (!radio) { return; }
    pending = radio.value;
    renderForm();
  });

  chosenEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-save]'))   { save(); return; }
    if (e.target.closest('[data-cancel]')) {
      chosenId = null;
      pending = null;
      renderResults();
      renderForm();
      searchEl.focus();
    }
  });

  holdersEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.mc-ad-holder');
    if (!btn) { return; }
    // Clearing the search first, so the chosen row is visible in the
    // list rather than filtered out of it by a leftover query.
    searchEl.value = '';
    choose(btn.getAttribute('data-id'));
    searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  renderMatrix();

  guard.ready.then(function (state) {
    myId = state.user.id;

    /* users.html links here with the account already chosen. The id is
       validated against the loaded list rather than trusted: a stale or
       hand-edited link should land on an empty form, not on somebody
       else's row. */
    var m = /[?&]user=([^&]+)/.exec(window.location.search);
    var wanted = m ? decodeURIComponent(m[1]) : null;

    load().then(function () {
      if (wanted && accountById(wanted)) {
        choose(wanted);
      } else if (wanted) {
        api.message(msgEl, 'error',
          'That account is not in the list. It may have been deleted, or the link may be out of date.');
      }
    });
  });

})();
