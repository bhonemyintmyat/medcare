(function () {
  'use strict';

  var db = window.supabaseClient;

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
    { what: 'Edit the addresses and numbers on the Contact us page',
      user: false, editor: true, admin: true,
      by: '"Editors change/create the contact details" — supabase_contact_editors.sql. The policy names key = footer.contact and reaches no other setting' },
    { what: 'Create an account for somebody else',
      user: false, editor: false, admin: false,
      by: 'auth.admin — needs the service_role key, which is not in this browser',
      nobody: true }
  ];

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

  var FULL_COLUMNS = 'id,email,display_name,full_name,role,locale,created_at';
  var BARE_COLUMNS = 'id,role,created_at';

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

  function deleteAccount(id) {
    return db.rpc('delete_account', { target_id: id })
      .then(function (res) {
        if (res.error) { throw res.error; }
        return res.data;
      });
  }

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

  var DEFAULTS = {
    maintenance: { enabled: false, message: '', allow_emergency: true },
    notice:      { enabled: false, tone: 'info', text: '' },

    'footer.contact': { emails: [], phones: [] }
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

  function loadPages() {
    return db.from('pages')
      .select('slug,title,body,body_my,href,updated_at,updated_by')
      .order('slug')
      .then(function (res) {
        if (res.error) { throw res.error; }
        return res.data || [];
      });
  }

  function savePage(slug, fields) {
    return db.from('pages')
      .update({ title: fields.title, body: fields.body, body_my: fields.body_my })
      .eq('slug', slug)
      .select('slug,title,body,body_my,href,updated_at,updated_by')
      .then(function (res) {
        if (res.error) { throw res.error; }

        if (!res.data || !res.data.length) {
          throw { code: '42501',
                  message: 'The database changed nothing. Either this account may not edit pages, or supabase_footer_pages.sql has not been run.' };
        }
        return res.data[0];
      });
  }

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

    loadPages: loadPages,
    savePage: savePage,

    confirmDialog: confirmDialog,
    confirmByName: confirmByName
  };

})();
