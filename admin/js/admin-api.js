/* ============================================================
   MedCare — the admin area's shared vocabulary
   Loaded on every admin page that touches data, after admin-guard.js
   and before the page's own script.

   Three things live here:

     1. ROLES — what the three roles ARE: their name on screen, the one
        sentence that explains them, and the capability matrix that
        permissions.html draws. Written down once, because a role's
        meaning drifting between two screens is how somebody ends up
        granting more than they meant to.

     2. Reading and writing `profiles` — one query, one save path, one
        error translator. Every admin screen's failure message comes
        from the same function.

     3. The dialogs — plain confirm, and confirm-by-name for the changes
        that cannot be undone from this browser.

   What is NOT here: any check that decides whether a write is allowed.
   Everything below decides what to DRAW. RLS and the guard_profile_role
   trigger decide what happens.

   OVERLAP, KNOWINGLY: esc/when/message/describeError/confirmDialog also
   exist in editor/js/editor-api.js. They are the same idea written for
   two areas that share a stylesheet and a shell but not a data model.
   If a third area ever appears, extract them — two is not yet enough to
   justify a file that both areas have to load.
   ============================================================ */

(function () {
  'use strict';

  var db = window.supabaseClient;

  /* ================================================================
     1. THE ROLES
     ================================================================
     `can` is the capability matrix on permissions.html. Every entry
     names the policy or grant that actually enforces it, so a row can
     be checked against the database rather than believed.

     This table is DOCUMENTATION. It is generated from nothing; it is
     typed out from the SQL files and it goes stale the moment somebody
     edits a policy without editing this. permissions.html says so on
     the page, in those words, because a permissions matrix that is
     quietly wrong is worse than no matrix at all.
     ================================================================ */

  var ROLES = {
    user: {
      id: 'user',
      label: 'Reader',
      value: 'user',
      blurb: 'Everybody who signs up. Reads the site, files a report, edits their own name.',
      tone: 'muted'
    },
    editor: {
      id: 'editor',
      label: 'Editor',
      value: 'editor',
      blurb: 'Writes and publishes the medical content. This is the role that decides what the site tells a sick person to do.',
      tone: 'primary'
    },
    admin: {
      id: 'admin',
      label: 'Admin',
      value: 'admin',
      blurb: 'Runs the site and the accounts on it. Grants roles, closes the site for maintenance, keeps the data tidy.',
      tone: 'danger'
    }
  };

  var ROLE_ORDER = ['user', 'editor', 'admin'];

  /* Rows of the matrix. `by` is where the rule lives, so a doubt about
     any single cell is one grep away from being settled. */
  var CAPABILITIES = [
    { group: 'The public site' },
    { what: 'Read published diseases, articles, hospitals and pharmacies',
      user: true, editor: true, admin: true,
      by: '"Public reads published …" — supabase_admin_schema.sql' },
    { what: 'Read emergency numbers',
      user: true, editor: true, admin: true,
      by: '"Public reads published emergency contacts" — anon too' },
    { what: 'Read drafts and archived pages',
      user: false, editor: true, admin: true,
      by: '"Staff read every …" — my_role() in (editor, admin)' },

    { group: 'Health content' },
    { what: 'Write and publish diseases, articles, hospitals, pharmacies',
      user: false, editor: true, admin: true,
      by: '"Editors update …" — supabase_editor.sql §2' },
    { what: 'Correct and add emergency numbers',
      user: false, editor: true, admin: true,
      by: '"Editors update/insert emergency contacts" — supabase_editor.sql §3, supabase_admin_scope.sql §1' },
    { what: 'Upload images, write translations',
      user: false, editor: true, admin: true,
      by: '"Staff upload content images", "Staff write translations"' },
    { what: 'Archive a page (take it off the site)',
      user: false, editor: true, admin: true,
      by: "status = 'archived' — supabase_editor.sql §1" },
    { what: 'Hard-delete a content row',
      user: false, editor: false, admin: true,
      by: '"Admins delete …" — the only DELETE policy anywhere' },

    { group: 'Reports' },
    { what: 'File a report about a page',
      user: true, editor: true, admin: true,
      by: '"Anyone signed in files a report"' },
    { what: 'Read their own reports back',
      user: true, editor: true, admin: true,
      by: '"Reporters read their own reports"' },
    { what: 'Read and resolve everybody’s reports',
      user: false, editor: true, admin: true,
      by: '"Staff read every report", "Staff resolve reports"' },

    { group: 'Accounts' },
    { what: 'Edit their own display name',
      user: true, editor: true, admin: true,
      by: 'set_display_name() — the only non-admin write to profiles' },
    { what: 'See every account',
      user: false, editor: false, admin: true,
      by: '"Admins can read all profiles"' },
    { what: 'Change somebody else’s role',
      user: false, editor: false, admin: true,
      by: '"Admins can change roles" + guard_profile_role trigger' },
    { what: 'Change their OWN role',
      user: false, editor: false, admin: false,
      by: 'guard_profile_role refuses it — nobody, including an admin',
      nobody: true },
    { what: 'Delete their own account',
      user: true, editor: true, admin: true,
      by: 'delete_own_account(password) — supabase_account_deletion.sql §1. Needs their own password retyped; refused only for the last admin' },
    { what: 'Delete somebody else’s account',
      user: false, editor: false, admin: true,
      by: 'delete_account() — §2 checks my_role() = admin, and refuses the caller’s own id' },

    { group: 'The site itself' },
    { what: 'Read site settings (maintenance, notices)',
      user: true, editor: true, admin: true,
      by: '"Anyone reads site settings" — anon too, so a closed site can say so' },
    { what: 'Turn maintenance mode on, edit the legal pages',
      user: false, editor: false, admin: true,
      by: '"Admins write/change site settings" — supabase_admin_scope.sql §2' },
    { what: 'Create an account for somebody else',
      user: false, editor: false, admin: false,
      by: 'auth.admin — needs the service_role key, which is not in this browser',
      nobody: true }
  ];


  /* ================================================================
     2. HELPERS
     ================================================================ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function when(iso) {
    if (!iso) { return '—'; }
    var d = new Date(iso);
    if (isNaN(d)) { return '—'; }
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function whenExact(iso) {
    if (!iso) { return '—'; }
    var d = new Date(iso);
    if (isNaN(d)) { return '—'; }
    return when(iso) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /* What to call this account on screen, in the same order the rest of
     the site uses: the name they picked, then the name they gave at
     signup, then their handle, then their email, then the bare id.

     Never returns an empty string. Every caller uses it as the thing a
     confirmation dialog asks you to type, and a dialog asking you to
     type nothing would confirm everything. */
  function accountLabel(p) {
    if (!p) { return 'Unknown account'; }
    return p.display_name || p.full_name || p.email ||
           ('Account ' + String(p.id || '').slice(0, 8));
  }

  var ROLE_PILL_CLASS = {
    user:   'mc-account-role',
    editor: 'mc-account-role mc-account-role--editor',
    admin:  'mc-account-role mc-account-role--admin'
  };

  function rolePill(role) {
    var r = ROLES[role] ? role : 'user';
    return '<span class="mc-admin-pill ' + ROLE_PILL_CLASS[r] + '">' +
             esc(ROLES[r].label) +
           '</span>';
  }

  /* Postgres is precise and means nothing to the person who just
     pressed Save. This turns the handful we can actually provoke into
     sentences that say what to do. The two role guards come back as
     42501 with the trigger's own word as the message, so they are
     matched before the general permission case — "you cannot change
     your own role" is a different problem from "you are not an admin",
     and telling somebody the wrong one sends them to the wrong fix. */
  function describeError(error, what) {
    if (!error) { return ''; }
    var code = error.code || '';
    var msg  = error.message || '';
    var noun = what || 'that';

    if (/role_self_change_forbidden/.test(msg)) {
      return 'The database refused it: an admin cannot change their own role. ' +
             'Ask another admin, or use the Supabase SQL editor.';
    }
    if (/role_change_forbidden/.test(msg)) {
      return 'The database refused it: only an admin may change a role. ' +
             'If you are an admin, your session may have expired — reload and try again.';
    }
    if (/delete_self_forbidden/.test(msg)) {
      return 'The database refused it: an admin cannot delete their own account from ' +
             'the accounts list. Use “Delete your account” at the foot of the sidebar.';
    }
    if (/delete_forbidden/.test(msg)) {
      return 'The database refused it: only an admin may delete somebody else’s account. ' +
             'If you are an admin, your session may have expired — reload and try again.';
    }
    if (/last_admin_forbidden/.test(msg)) {
      return 'The database refused it: that is the only admin account, and the site ' +
             'would be left with nobody who can run it. Promote somebody else first.';
    }
    if (/account_not_found/.test(msg)) {
      return 'No account has that id any more. Somebody may have deleted it already — ' +
             'press Refresh to see the list as it stands.';
    }
    if (/permission denied for table users/i.test(msg)) {
      return 'The database accepted the request but is not allowed to carry it out. ' +
             'Run supabase_account_deletion.sql as postgres — its first section says why.';
    }
    if (code === 'PGRST202') {
      return 'That function is not deployed yet. Run supabase_account_deletion.sql in the ' +
             'Supabase SQL editor.';
    }
    // PostgREST refusing the token itself, worded for whoever wrote the
    // token rather than for the admin reading the message strip.
    if (code === 'PGRST301') {
      return 'Your session is no longer valid, so nothing was changed. ' +
             'Reload the page and sign in again.';
    }
    if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
      return 'The database refused ' + noun + '. Your account may not have the rights, ' +
             'or your session may have expired — reload the page and try once more.';
    }
    if (code === '42P01' || /does not exist/i.test(msg)) {
      return 'That table does not exist yet. Run supabase_admin_scope.sql in the Supabase ' +
             'SQL editor — it creates site_settings and seeds the keys these screens read.';
    }
    if (code === '42703') {
      return 'This table is missing a column the admin area expects. Run the supabase_*.sql ' +
             'files in the Supabase SQL editor, in the order their headers give.';
    }
    if (code === '23514') {
      return 'The database rejected that value: ' + msg;
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      return 'Could not reach the database. Check your connection — nothing was saved.';
    }
    return msg || 'The database refused that, without saying why.';
  }

  /* One message strip per screen. Errors stay until something replaces
     them; confirmations clear themselves, because a green bar that
     outlives what it describes starts lying about the state of the
     page. Same behaviour as the editor area, on purpose. */
  function message(el, kind, text) {
    if (!el) { return; }
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.className = 'mc-admin-msg mc-admin-msg--' + (kind === 'ok' ? 'ok' : 'error');
    el.textContent = text;
    el.hidden = false;
    el.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
    if (kind === 'ok') {
      window.clearTimeout(el._mcTimer);
      el._mcTimer = window.setTimeout(function () {
        el.hidden = true; el.textContent = '';
      }, 6000);
    }
  }


  /* ================================================================
     3. TALKING TO profiles
     ================================================================ */

  /* No `username`. supabase_display_name.sql renamed that column to
     display_name and dropped everything around it, so asking for it here
     is asking PostgREST for a column the schema is supposed to be rid of.
     It costs more than a dead name: a 42703 sends loadAccounts down the
     fallback below, and the whole table renders by id with no name, no
     email and a banner about a migration that has in fact been run. */
  var FULL_COLUMNS = 'id,email,display_name,full_name,role,locale,created_at';
  var BARE_COLUMNS = 'id,role,created_at';

  /* "Admins can read all profiles" is what makes this return more than
     one row. The same query run by an editor returns exactly their own
     profile — Postgres filters the rest out before the response is
     built, so there is nothing to leak and no check needed here.

     The fallback exists because the columns arrived across four
     migrations. If one has not been run, the page lists accounts by id
     rather than refusing to load, and says which file is missing. */
  function loadAccounts() {
    return db.from('profiles').select(FULL_COLUMNS).order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) { throw res.error; }
        return { rows: res.data || [], partial: false };
      })
      .catch(function (err) {
        if (!err || err.code !== '42703') { throw err; }
        return db.from('profiles').select(BARE_COLUMNS).order('created_at', { ascending: true })
          .then(function (res) {
            if (res.error) { throw res.error; }
            return { rows: res.data || [], partial: true };
          });
      });
  }

  /* Ask for the row back. An RLS refusal is not always an error: an
     update that matches no row returns 200 with an empty array, and
     that silence is exactly what a non-admin gets here. Treating it as
     success is how a page comes to report a change that never
     happened. */
  function writeProfile(id, patch, returning) {
    return db.from('profiles').update(patch).eq('id', id).select(returning || 'id')
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data || !res.data.length) {
          throw { code: '42501',
                  message: 'The database changed nothing: no row matched the update.' };
        }
        return res.data[0];
      });
  }

  function setRole(id, role) {
    return writeProfile(id, { role: role }, 'id,role');
  }

  function clearDisplayName(id) {
    return writeProfile(id, { display_name: null }, 'id,display_name');
  }

  /* Deleting somebody else's account.

     Not writeProfile(). Not a DELETE at all from this browser: DELETE on
     profiles is revoked from `authenticated`, and profiles is the wrong
     table anyway — the row that matters is in auth.users, which this key
     cannot see, let alone touch. What goes over the wire is a request to
     a named function that holds the privilege itself and checks the
     caller before using it. supabase_account_deletion.sql §2 is the
     whole of the rule set; nothing here re-states it.

     One deliberate difference from every other write in this file: no
     empty-result check. An RLS refusal is silence, which is why
     writeProfile has to look for it — a function refusal is an
     exception, and it arrives with the reason written on it. */
  function deleteAccount(id) {
    return db.rpc('delete_account', { target_id: id })
      .then(function (res) {
        if (res.error) { throw res.error; }
        return res.data;      // the name the site used to call them
      });
  }

  /* Names for a set of ids, for the "last changed by" lines. One request
     rather than a join: the client cannot join to profiles under RLS,
     and a per-row query would be one request per line. */
  function loadNames(ids) {
    var wanted = [];
    (ids || []).forEach(function (id) {
      if (id && wanted.indexOf(id) === -1) { wanted.push(id); }
    });
    if (!wanted.length) { return Promise.resolve({}); }

    return db.from('profiles').select('id,display_name,full_name,email').in('id', wanted)
      .then(function (res) {
        var out = {};
        (res.data || []).forEach(function (p) { out[p.id] = accountLabel(p); });
        return out;
      })
      .catch(function () { return {}; });
  }


  /* ================================================================
     3b. TALKING TO site_settings
     ================================================================
     Key/value rows, one per setting. Every reader must treat a missing
     key as "off": the table is created and seeded by
     supabase_admin_scope.sql, and a site whose admin has not run it yet
     is a perfectly ordinary state that must not break either this
     screen or the public pages.

     DEFAULTS is that rule written down once. It is also what a Save
     merges into, so a key that reaches the database missing half its
     fields — an older seed, a hand-edit in the dashboard — comes back
     complete rather than as a form full of undefined.
     ================================================================ */

  var DEFAULTS = {
    maintenance: { enabled: false, message: '', allow_emergency: true },
    notice:      { enabled: false, tone: 'info', text: '' },
    /* The Contact us page: one email address and up to four numbers.
       `phones` is a list rather than the single `phone` the key was
       first seeded with — admin-contact.js carries an old `phone`
       forward into it, so neither shape is lost. */
    'footer.contact': { email: '', phones: [] }
  };

  function withDefaults(key, value) {
    var base = DEFAULTS[key] || {};
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        if (value[k] !== null && value[k] !== undefined) { out[k] = value[k]; }
      });
    }
    return out;
  }

  /* Resolves { key: { value, updated_at, updated_by } } for every key
     asked for, present in the table or not. */
  function loadSettings(keys) {
    return db.from('site_settings')
      .select('key,value,updated_at,updated_by')
      .in('key', keys)
      .then(function (res) {
        if (res.error) { throw res.error; }
        var out = {};
        keys.forEach(function (k) {
          out[k] = { value: withDefaults(k, null), updated_at: null, updated_by: null, missing: true };
        });
        (res.data || []).forEach(function (row) {
          out[row.key] = {
            value: withDefaults(row.key, row.value),
            updated_at: row.updated_at,
            updated_by: row.updated_by,
            missing: false
          };
        });
        return out;
      });
  }

  /* Update, then insert if the key was never seeded. Two round trips in
     the uncommon case, one in the normal one — and no upsert, because an
     upsert here would happily create a key nobody meant to add if the
     name were ever mistyped in this file. */
  function saveSetting(key, value) {
    return db.from('site_settings').update({ value: value }).eq('key', key)
      .select('key,value,updated_at,updated_by')
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (res.data && res.data.length) { return res.data[0]; }

        return db.from('site_settings').insert({ key: key, value: value })
          .select('key,value,updated_at,updated_by')
          .then(function (ins) {
            if (ins.error) { throw ins.error; }
            if (!ins.data || !ins.data.length) {
              throw { code: '42501',
                      message: 'The database changed nothing: no row matched and none was created.' };
            }
            return ins.data[0];
          });
      });
  }


  /* ================================================================
     4. THE DIALOGS
     ================================================================
     Reuses .mc-modal from styles.css. Both resolve rather than reject,
     and both restore focus to whatever opened them — an admin working
     down a list with the keyboard should not be dropped at the top of
     the page after every action.
     ================================================================ */

  function openDialog(html, onReady) {
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
      },
      ready: onReady
    };
  }

  function trapEscape(host, cancel) {
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        document.removeEventListener('keydown', onKey);
        cancel();
      }
    }
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); };
  }

  /* The ordinary one. Names what it is about to do, in words that can be
     answered: "Clear Su Aung's display name?" is a question; "Are you
     sure?" is not, and is why people learn to click through these. */
  function confirmDialog(opts) {
    var d = openDialog(
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcConfirmTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico ' + (opts.danger ? 'mc-modal-ico--muted' : 'mc-modal-ico--ok') + '">' +
          '<i class="bi ' + esc(opts.icon || (opts.danger ? 'bi-exclamation-triangle' : 'bi-check2-circle')) + '"></i></div>' +
        '<h2 id="mcConfirmTitle">' + esc(opts.title) + '</h2>' +
        '<p class="mc-modal-sub">' + esc(opts.body) + '</p>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
          '<button type="button" class="mc-auth-btn" data-go>' + esc(opts.go || 'Confirm') + '</button>' +
        '</div>' +
      '</div>');

    d.host.querySelector('[data-go]').focus();

    return new Promise(function (resolve) {
      var untrap = trapEscape(d.host, function () { finish(false); });
      function finish(answer) { untrap(); d.close(); resolve(answer); }
      d.host.addEventListener('click', function (e) {
        if (e.target.closest('[data-go]'))    { finish(true);  return; }
        if (e.target.closest('[data-close]')) { finish(false); }
      });
    });
  }

  /* The one for changes this browser cannot undo.

     Typing the account's name is not security — the same admin could
     type it without reading it. It is there to make the WRONG ROW
     expensive: the mistake this screen actually produces is promoting
     the person above or below the one you meant, in a list of names
     that look alike, and that mistake cannot survive having to type the
     name out. The keystrokes are the point; the string comparison is
     just what makes them mandatory.

     Comparison is trimmed and case-insensitive. Anything stricter
     punishes the correct answer for its capitals. */
  function confirmByName(opts) {
    var expect = String(opts.expect || '').trim();

    var d = openDialog(
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcNameTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico mc-modal-ico--muted"><i class="bi ' +
          esc(opts.icon || 'bi-shield-exclamation') + '"></i></div>' +
        '<h2 id="mcNameTitle">' + esc(opts.title) + '</h2>' +
        '<p class="mc-modal-sub">' + esc(opts.body) + '</p>' +
        '<p class="mc-modal-msg mc-modal-msg--error" data-err hidden></p>' +
        '<div class="mc-confirm-field">' +
          '<label class="mc-auth-label" for="mcNameInput">' +
            'Type <strong>' + esc(expect) + '</strong> to confirm' +
          '</label>' +
          '<div class="mc-auth-field">' +
            '<i class="bi bi-input-cursor-text"></i>' +
            '<input id="mcNameInput" type="text" autocomplete="off" ' +
                   'spellcheck="false" data-input>' +
          '</div>' +
        '</div>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
          '<button type="button" class="mc-auth-btn" data-go disabled>' +
            esc(opts.go || 'Confirm') + '</button>' +
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
      errEl.hidden = true;
    });

    return new Promise(function (resolve) {
      var untrap = trapEscape(d.host, function () { finish(false); });
      function finish(answer) { untrap(); d.close(); resolve(answer); }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && matches()) { finish(true); }
      });

      d.host.addEventListener('click', function (e) {
        if (e.target.closest('[data-go]')) {
          if (!matches()) {
            errEl.textContent = 'That is not the name on the account. Check you have the right row.';
            errEl.hidden = false;
            return;
          }
          finish(true);
          return;
        }
        if (e.target.closest('[data-close]')) { finish(false); }
      });
    });
  }


  window.MedCareAdmin = {
    ROLES: ROLES,
    ROLE_ORDER: ROLE_ORDER,
    CAPABILITIES: CAPABILITIES,

    esc: esc,
    when: when,
    whenExact: whenExact,
    accountLabel: accountLabel,
    rolePill: rolePill,
    message: message,
    describeError: describeError,

    loadAccounts: loadAccounts,
    writeProfile: writeProfile,
    setRole: setRole,
    clearDisplayName: clearDisplayName,
    deleteAccount: deleteAccount,
    loadNames: loadNames,

    SETTING_DEFAULTS: DEFAULTS,
    loadSettings: loadSettings,
    saveSetting: saveSetting,

    confirmDialog: confirmDialog,
    confirmByName: confirmByName
  };

})();
