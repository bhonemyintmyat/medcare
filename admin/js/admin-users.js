/* ============================================================
   MedCare — users and accounts
   Loaded by admin/users.html, after admin-guard.js, admin-shell.js and
   admin-api.js.

   The account directory. It answers "who is on this site", and it makes
   two writes: clearing a display name that should not be on the page,
   and deleting an account. Granting a role is deliberately not here —
   that is permissions.html, and the row's Role button walks you there
   with the account already chosen.

   The split is not tidiness. Reading a list of names and changing what
   somebody is allowed to do are different acts, and putting the second
   one inside the first is how it gets done absent-mindedly while
   scrolling.

   WHY DELETION IS HERE AND ROLES ARE NOT, WHICH LOOKS BACKWARDS.
   A role change is a decision about the site — who should be trusted
   with what — and it wants the screen that shows every role at once. A
   deletion is a fact about one person: they are leaving, or they should
   never have been here. That fact is read off this list, and the list
   is where an admin already is when they learn it. Sending them to a
   third screen to act on it would not add a moment's thought; the
   confirm-by-name dialog is what adds that, and it travels with the
   button.

   The database still refuses two things this page cannot: an admin
   deleting their own account from here, and anything at all from a
   non-admin. See supabase_account_deletion.sql §2.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  var api   = window.MedCareAdmin;
  if (!guard || !api) { return; }   // guard missing: the page stays blank, by design

  var esc = api.esc;

  var msgEl     = document.getElementById('usersMsg');
  var bodyEl    = document.getElementById('usersBody');
  var countEl   = document.getElementById('usersCount');
  var searchEl  = document.getElementById('usersSearch');
  var filtersEl = document.getElementById('usersFilters');
  var refreshEl = document.getElementById('usersRefresh');

  var accounts = [];       // every profile row the database returned
  var roleFilter = 'all';
  var query = '';
  var myId = null;
  var partial = false;     // true when the profiles table is missing columns

  /* ---------------------------------------------------------------
     LOADING
     --------------------------------------------------------------- */

  function load() {
    bodyEl.innerHTML =
      '<tr><td colspan="4">' +
        '<div class="mc-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '</td></tr>';

    api.loadAccounts()
      .then(function (result) {
        accounts = result.rows;
        partial  = result.partial;
        if (partial) {
          api.message(msgEl, 'error',
            'Showing account ids only: the profiles table has no name or email columns yet. ' +
            'Run supabase_admin.sql, supabase_display_name.sql and supabase_profile_fields.sql.');
        }
        renderStats();
        render();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load accounts:', err);
        bodyEl.innerHTML =
          '<tr><td colspan="4">' +
            '<div class="mc-state mc-state--error">' +
              '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
              '<h2>Could not load the accounts</h2>' +
              '<p>' + esc(api.describeError(err, 'the account list')) + '</p>' +
            '</div>' +
          '</td></tr>';
        api.message(msgEl, 'error', api.describeError(err, 'the account list'));
      });
  }

  /* Counted from the rows already in hand rather than four head:true
     queries. One request cannot disagree with itself; five can, and the
     moment they do it is the numbers people believe over the table. */
  function renderStats() {
    var byRole = { user: 0, editor: 0, admin: 0 };
    accounts.forEach(function (p) {
      if (byRole[p.role] === undefined) { byRole[p.role] = 0; }
      byRole[p.role] += 1;
    });
    setStat('statTotal',   accounts.length);
    setStat('statAdmins',  byRole.admin);
    setStat('statEditors', byRole.editor);
    setStat('statReaders', byRole.user);
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.textContent = String(value);
    el.classList.remove('is-loading');
  }

  /* ---------------------------------------------------------------
     THE TABLE
     --------------------------------------------------------------- */

  function visible() {
    var q = query.trim().toLowerCase();
    return accounts.filter(function (p) {
      if (roleFilter !== 'all' && p.role !== roleFilter) { return false; }
      if (!q) { return true; }
      return [p.display_name, p.full_name, p.username, p.email, p.role, p.id]
        .some(function (v) {
          return String(v || '').toLowerCase().indexOf(q) !== -1;
        });
    });
  }

  function render() {
    var rows = visible();
    countEl.textContent = rows.length;

    if (!rows.length) {
      bodyEl.innerHTML =
        '<tr><td colspan="4">' +
          '<div class="mc-state mc-state--empty">' +
            '<span class="mc-state-ico"><i class="bi bi-search"></i></span>' +
            '<h2>' + (accounts.length ? 'No account matches' : 'No accounts yet') + '</h2>' +
            '<p>' + (accounts.length
              ? 'Nothing here matches that search and filter. Clear one of them.'
              : 'Nobody has signed up. The first account to sign up becomes a reader.') +
            '</p>' +
          '</div>' +
        '</td></tr>';
      return;
    }

    bodyEl.innerHTML = rows.map(rowHtml).join('');
  }

  function rowHtml(p) {
    var isMe  = p.id === myId;
    var name  = api.accountLabel(p);

    /* The email is a fallback identity, not a second label: it shows
       only when it is not already the thing printed above it. */
    var mail = (p.email && p.email !== name)
      ? '<div class="mc-people-mail">' + esc(p.email) + '</div>' : '';

    return '<tr data-id="' + esc(p.id) + '">' +
      '<td>' +
        '<div class="mc-people-email">' + esc(name) +
          (isMe ? '<span class="mc-people-you">you</span>' : '') +
        '</div>' +
        mail +
        '<div class="mc-people-id">' + esc(p.id) + '</div>' +
      '</td>' +
      '<td>' + api.rolePill(p.role) + '</td>' +
      '<td class="mc-people-when">' + esc(api.when(p.created_at)) + '</td>' +
      '<td>' +
        '<div class="mc-people-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost mc-ad-rowbtn" ' +
                  'data-act="details">Details</button>' +
          '<a class="mc-auth-btn mc-ad-rowbtn" href="permissions.html?user=' +
             encodeURIComponent(p.id) + '">Role</a>' +
          /* Disabled on your own row rather than missing from it. The
             database refuses this case anyway (delete_self_forbidden),
             so the disabled attribute is a label for a rule, not the
             rule — deleting it from DevTools changes nothing. */
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost mc-ad-rowbtn ' +
                  'mc-ad-rowbtn--danger" data-act="delete"' +
                  (isMe ? ' disabled title="Delete your own account from the foot of ' +
                          'the sidebar, not from this list."' : '') +
                  '>Delete</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function accountFor(el) {
    var tr = el.closest('tr');
    if (!tr) { return null; }
    var id = tr.getAttribute('data-id');
    return accounts.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---------------------------------------------------------------
     THE DETAIL PANEL
     ---------------------------------------------------------------
     Everything the database will tell us about one account, which is
     less than people expect: `profiles` holds names, a role and a
     joining date. Last sign-in, email confirmation and the password
     itself live in auth.users, which no browser key can read.
     --------------------------------------------------------------- */

  function detailRow(label, value, mono) {
    var v = value == null || value === '' ? '—' : String(value);
    return '<div class="mc-ad-def-row">' +
             '<dt>' + esc(label) + '</dt>' +
             '<dd' + (mono ? ' class="mc-ad-mono"' : '') + '>' + esc(v) + '</dd>' +
           '</div>';
  }

  function openDetails(p) {
    var opener = document.activeElement;
    var name = api.accountLabel(p);
    var role = api.ROLES[p.role] || api.ROLES.user;

    var host = document.createElement('div');
    host.className = 'mc-modal is-open';
    host.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel mc-ad-panel" role="dialog" aria-modal="true" aria-labelledby="mcDetailTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Close">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<h2 id="mcDetailTitle">' + esc(name) + '</h2>' +
        '<p class="mc-modal-sub">' + api.rolePill(p.role) + ' ' + esc(role.blurb) + '</p>' +

        '<dl class="mc-ad-def">' +
          detailRow('Display name', p.display_name) +
          detailRow('Name at signup', p.full_name) +
          detailRow('Username', p.username) +
          detailRow('Email', p.email) +
          detailRow('Language', p.locale === 'my' ? 'Burmese' : (p.locale === 'en' ? 'English' : 'Follows the switcher')) +
          detailRow('Joined', api.whenExact(p.created_at)) +
          detailRow('Account id', p.id, true) +
        '</dl>' +

        '<p class="mc-ad-note">' +
          'Last sign-in, email confirmation and the password live in ' +
          '<code>auth.users</code>, which no key this browser holds can read. ' +
          'They are in the Supabase dashboard.' +
        '</p>' +

        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Close</button>' +
          (p.display_name
            ? '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-clear>Clear display name</button>'
            : '') +
          '<a class="mc-auth-btn" href="permissions.html?user=' + encodeURIComponent(p.id) + '">' +
            'Change role</a>' +
          /* The same action as the row's Delete, offered again where an
             admin has just finished reading who this actually is. That
             is the moment the decision is best made, and making them
             close the panel to reach the button would move it. */
          (p.id === myId ? '' :
            '<button type="button" class="mc-auth-btn mc-auth-btn--danger" data-delete>' +
              'Delete account</button>') +
        '</div>' +
      '</div>';

    document.body.appendChild(host);
    host.querySelector('[data-close]').focus();

    function close() {
      document.removeEventListener('keydown', onKey);
      host.remove();
      if (opener && opener.focus) { opener.focus(); }
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); }
    }
    document.addEventListener('keydown', onKey);

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      if (e.target.closest('[data-clear]')) {
        close();
        clearName(p);
        return;
      }
      if (e.target.closest('[data-delete]')) {
        close();
        removeAccount(p);
      }
    });
  }

  /* ---------------------------------------------------------------
     THE ONE WRITE
     ---------------------------------------------------------------
     An admin may clear a display name because a display name is
     published: it is what the site calls somebody in public. Setting it
     to something else on their behalf is not the same act — that is
     putting words in their mouth — so the only option here is to remove
     it, which drops them back to the name they signed up with.

     What allows it is the column grant in supabase_admin_schema.sql
     (display_name is updatable by `authenticated`) plus the "Admins can
     change roles" policy, which is an UPDATE policy over every row and
     is misnamed for what it actually permits. The guard_profile_role
     trigger is what keeps that from being a hole: it pins id, email and
     created_at, and refuses every role change that is not an admin
     changing somebody else.
     --------------------------------------------------------------- */

  function clearName(p) {
    var name = api.accountLabel(p);

    api.confirmDialog({
      title: 'Clear this display name?',
      body: '“' + p.display_name + '” will be removed. The account keeps working ' +
            'and the site will call them by the name they signed up with. They can ' +
            'set a new display name themselves at any time.',
      go: 'Clear it',
      danger: true,
      icon: 'bi-person-badge'
    }).then(function (yes) {
      if (!yes) { return; }

      return api.clearDisplayName(p.id)
        .then(function () {
          p.display_name = null;
          render();
          api.message(msgEl, 'ok', 'Display name cleared. ' + api.accountLabel(p) +
                                   ' is what the site calls them now.');
        })
        .catch(function (err) {
          console.error('[MedCare] Could not clear the display name:', err);
          api.message(msgEl, 'error',
            api.describeError(err, 'clearing ' + name + '’s display name'));
        });
    });
  }

  /* ---------------------------------------------------------------
     THE OTHER WRITE: DELETING AN ACCOUNT
     ---------------------------------------------------------------
     This is the only thing either admin screen does that no admin can
     put back. Three things stand in front of it, and they are three
     different things rather than three copies of "are you sure":

       1. The dialog says what a deletion takes and what it leaves.
          Most of the surprise in deleting an account is not that the
          account goes — it is finding out afterwards that something
          else went with it, or that something else did not.

       2. It asks for the account's name to be typed. That is aimed at
          the mistake this screen actually produces: acting on the row
          above or below the one you meant. A wrong row cannot survive
          having its name typed out. It is not aimed at a determined
          admin, who can of course read the name and type it.

       3. The last-admin refusal, which lives in the database and is
          not repeated here as a check. It cannot fire on this path —
          an admin calling delete_account() is themselves an admin, so
          one always remains — and writing a guard for an unreachable
          case would only invite somebody to trust it later.

     What is NOT here: a soft delete, an "are you really sure" second
     dialog, or a grace period. A grace period is the honest way to make
     this recoverable, and it is a different feature: it needs a
     scheduled job, a "closing soon" state on the profile, and a way
     back in for somebody who has changed their mind. Half of it —
     hiding the row and deleting it anyway — would be worse than this.
     --------------------------------------------------------------- */

  function removeAccount(p) {
    // Re-checked at the moment of acting, not only when the row was
    // drawn: the list may have been refreshed since, and this is the
    // one action where a stale answer cannot be taken back.
    if (p.id === myId) { return; }

    var name = api.accountLabel(p);
    var role = api.ROLES[p.role] || api.ROLES.user;

    // What an admin most needs to know before pressing this is which
    // kind of account it is. Deleting a reader loses a reader; deleting
    // an editor unsigns everything they wrote.
    var consequence = (p.role === 'user')
      ? 'Their saved diseases and articles go too. Reports they filed stay, ' +
        'without their name on them.'
      : 'Everything they wrote stays on the site, unsigned — the medical guidance ' +
        'does not leave with them. Their saved items and their ' + role.label.toLowerCase() +
        ' rights go.';

    api.confirmByName({
      title: 'Delete this account?',
      body: name + ' will be removed from MedCare: their email, their password and ' +
            'their profile. They will not be able to sign in again, and nothing on ' +
            'this site can undo it. ' + consequence,
      expect: name,
      go: 'Delete the account',
      icon: 'bi-person-x'
    }).then(function (yes) {
      if (!yes) { return; }

      api.message(msgEl, 'ok', '');

      return api.deleteAccount(p.id)
        .then(function () {
          // Drop it from the rows in hand rather than reloading. The
          // stats are counted from this same array, so the table and
          // the four numbers above it cannot disagree about who is left.
          accounts = accounts.filter(function (row) { return row.id !== p.id; });
          renderStats();
          render();
          api.message(msgEl, 'ok',
            name + ' has been deleted. Anything they wrote is still on the site, ' +
            'with the author line blank.');
        })
        .catch(function (err) {
          console.error('[MedCare] Could not delete the account:', err);
          api.message(msgEl, 'error',
            api.describeError(err, 'deleting ' + name + '’s account'));
        });
    });
  }

  /* ---------------------------------------------------------------
     WIRING
     --------------------------------------------------------------- */

  bodyEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) { return; }
    var p = accountFor(btn);
    if (!p) { return; }
    if (btn.getAttribute('data-act') === 'details') { openDetails(p); }
    if (btn.getAttribute('data-act') === 'delete')  { removeAccount(p); }
  });

  filtersEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.mc-chip');
    if (!chip) { return; }
    roleFilter = chip.getAttribute('data-role');
    Array.prototype.forEach.call(filtersEl.children, function (b) {
      b.classList.toggle('is-active', b === chip);
    });
    render();
  });

  searchEl.addEventListener('input', function () {
    query = searchEl.value;
    render();
  });

  refreshEl.addEventListener('click', function () {
    api.message(msgEl, 'ok', '');
    load();
  });


  guard.ready.then(function (state) {
    myId = state.user.id;
    load();
  });

  /* NOT LIVE, ON PURPOSE. A role change made elsewhere — the Supabase
     dashboard, another admin, this admin in a second tab — does not
     appear here until Refresh. A realtime subscription would be a
     second source of truth for a table whose whole point is to be the
     first one, and a row that changes under a cursor mid-click is a
     worse failure than a stale one next to a Refresh button. */

})();
