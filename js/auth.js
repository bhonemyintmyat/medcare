

(function () {
  'use strict';

  var ROLE_CACHE_KEY = 'mc-role';

  
  var DELETED_FLAG_KEY = 'mc-account-deleted';

  var state = {
    user: null,
    role: null,
    profile: null,
    ready: false
  };

  var listeners = [];

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state.user, state.role); } catch (e) { console.error(e); }
    });
  }

  function readCachedRole() {
    try { return sessionStorage.getItem(ROLE_CACHE_KEY); } catch (e) { return null; }
  }
  function writeCachedRole(role) {
    try {
      if (role) { sessionStorage.setItem(ROLE_CACHE_KEY, role); }
      else { sessionStorage.removeItem(ROLE_CACHE_KEY); }
    } catch (e) {  }
  }

  
  function flagDeleted(name) {
    try { sessionStorage.setItem(DELETED_FLAG_KEY, name || '1'); } catch (e) {  }
  }

  var db = window.supabaseClient;

  
  function loadProfile(user) {
    if (!user) { return Promise.resolve(null); }
    return db.from('profiles')
      .select('role,display_name,full_name')
      .eq('id', user.id)
      .single()
      .then(function (res) {
        if (res.error) {

          if (res.error.code === '42703') { return loadRoleOnly(user); }
          console.error('[MedCare] Could not read profile:', res.error);
          return null;
        }
        return res.data || null;
      })
      .catch(function (err) {
        console.error('[MedCare] Could not read profile:', err);
        return null;
      });
  }

  function loadRoleOnly(user) {
    return db.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(function (res) { return res.error ? null : res.data; })
      .catch(function () { return null; });
  }


  var applyToken = 0;

  
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function applySession(session) {
    var mine = ++applyToken;
    state.user = session ? session.user : null;
    return loadProfile(state.user).then(function (profile) {
      if (mine !== applyToken) { return state.role; }
      state.profile = profile;
      state.role = profile ? profile.role : null;
      writeCachedRole(state.role);
      state.ready = true;
      notify();
      return state.role;
    });
  }

  
  var PASSWORD_MIN = 8;
  var PASSWORD_HINT = 'At least 8 characters, with an upper-case letter, a lower-case letter, a number, and a symbol.';

  
  function passwordProblem(password) {
    var pw = String(password == null ? '' : password);
    if (pw.length < PASSWORD_MIN) {
      return 'Passwords need to be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(pw)) { return 'Passwords need at least one upper-case letter.'; }
    if (!/[a-z]/.test(pw)) { return 'Passwords need at least one lower-case letter.'; }
    if (!/[0-9]/.test(pw)) { return 'Passwords need at least one number.'; }
    if (!/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(pw)) {
      return 'Passwords need at least one symbol, such as ! ? # or @.';
    }
    return null;
  }

  
  var api = {

    PASSWORD_MIN: PASSWORD_MIN,
    PASSWORD_HINT: PASSWORD_HINT,
    passwordProblem: passwordProblem,


    ready: null,

    getUser: function () { return state.user; },

    isSignedIn: function () { return !!state.user; },

    
    getRole: function () { return state.role; },


    getProfile: function () { return state.profile; },

    
    displayName: function () {
      var p = state.profile;
      if (p && p.display_name) { return p.display_name; }
      if (p && p.full_name) { return p.full_name; }
      return state.user ? state.user.email : '';
    },

    hasRole: function (role) { return state.role === role; },


    isStaff: function () { return state.role === 'editor' || state.role === 'admin'; },

    onChange: function (fn) {
      listeners.push(fn);
      if (state.ready) { fn(state.user, state.role); }
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) { listeners.splice(i, 1); }
      };
    },

    
    signUp: function (email, password, profile) {
      return db.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: (profile && profile.fullName) || null,
            display_name: (profile && profile.displayName) || null
          }
        }
      });
    },

    
    setDisplayName: function (name) {
      return db.rpc('set_display_name', { new_name: name })
        .then(function (res) {
          if (res.error) { throw res.error; }
          if (state.profile) { state.profile.display_name = res.data; }
          notify();
          return res.data;
        });
    },

    signIn: function (email, password) {
      return db.auth.signInWithPassword({ email: email, password: password });
    },

    
    recoveryRedirect: function () {
      return new URL('reset-password.html', window.location.href).href;
    },

    sendRecovery: function (email) {
      return db.auth.resetPasswordForEmail(email, { redirectTo: api.recoveryRedirect() });
    },

    
    updatePassword: function (password) {
      return db.auth.updateUser({ password: password });
    },

    signOut: function () {
      return db.auth.signOut().then(function (res) {
        writeCachedRole(null);
        return res;
      });
    },

    
    deleteOwnAccount: function (password) {
      return db.rpc('delete_own_account', { confirm_password: password }).then(function (res) {
        if (res.error) { throw res.error; }
        var name = res.data;

        
        flagDeleted(name);

        return forgetSession().then(function () { return name; });
      });
    },

    
    openDeleteAccountDialog: null,

    
    takeDeletionNotice: function () {
      var name = null;
      try {
        name = sessionStorage.getItem(DELETED_FLAG_KEY);
        sessionStorage.removeItem(DELETED_FLAG_KEY);
      } catch (e) {  }
      return name;
    }
  };

  
  function forgetSession() {
    writeCachedRole(null);

    function done() {
      state.user = null;
      state.role = null;
      state.profile = null;
      state.ready = true;
      notify();
      return null;
    }

    if (!db || !db.auth) { return Promise.resolve(done()); }
    return db.auth.signOut({ scope: 'local' }).then(done, done);
  }

  
  var killModal = null;

  function deleteMessage(text, kind) {
    var el = document.getElementById('mcKillMsg');
    if (!el) { return; }
    if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = text;
    el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
    el.style.display = 'block';
  }

  
  function explainDelete(err) {
    var text = String((err && err.message) || '');
    if (/wrong_password/i.test(text)) {
      return 'That is not the password for this account. Nothing has been deleted.';
    }
    
    if (/no_password_set/i.test(text)) {
      return 'This account has no password to confirm with. Set one from ' +
             '“Forgot your password?” on the sign-in screen, then come back here.';
    }
    if (/last_admin_forbidden/i.test(text)) {
      return 'You are the only admin. Make somebody else an admin first — otherwise ' +
             'nobody would be able to run the site after you go.';
    }
    if (/not_signed_in/i.test(text)) {
      return 'You have been signed out. Sign in again and try once more.';
    }
    
    if (err && err.code === 'PGRST301') {
      return 'Your session is no longer valid, so nothing was deleted. ' +
             'Sign in again and try once more.';
    }
    if (/permission denied for table users/i.test(text)) {
      return 'The database can accept the request but is not allowed to carry it out. ' +
             'Run supabase_account_deletion.sql as postgres — its first section explains why.';
    }
    if (err && err.code === 'PGRST202') {

      return 'Account deletion is not switched on for this site yet. ' +
             'Run supabase_account_deletion.sql in the Supabase SQL editor.';
    }
    if (/Failed to fetch|NetworkError/i.test(text)) {
      return 'Could not reach the database. Check your connection — nothing was deleted.';
    }
    return text || 'Something went wrong, and your account has not been deleted.';
  }

  
  function killListHtml(isStaff) {
    var rows = [
      ['goes',  'bi-x-circle-fill',    '<strong>Your name, email and password</strong> are erased. ' +
                                       'You cannot sign in again, and this cannot be undone.'],
      ['goes',  'bi-x-circle-fill',    '<strong>Your saved diseases and articles</strong> go with them.'],
      ['stays', 'bi-check-circle-fill','<strong>Reports you filed stay</strong>, with your name taken off. ' +
                                       'A wrong page is still wrong after you leave.']
    ];
    if (isStaff) {
      rows.push(['stays', 'bi-check-circle-fill',
        '<strong>Pages you wrote stay on the site</strong>, unsigned. The medical ' +
        'guidance does not leave with the person who wrote it.']);
    }
    return '<ul class="mc-modal-list">' + rows.map(function (r) {
      return '<li><i class="bi ' + r[1] + ' mc-' + r[0] + '"></i><span>' + r[2] + '</span></li>';
    }).join('') + '</ul>';
  }

  function buildDeleteDialog() {
    killModal = document.createElement('div');
    killModal.className = 'mc-modal';
    killModal.setAttribute('role', 'dialog');
    killModal.setAttribute('aria-modal', 'true');
    killModal.setAttribute('aria-labelledby', 'mcKillTitle');
    document.body.appendChild(killModal);

    killModal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeDeleteDialog(); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') &&
          killModal.classList.contains('is-open')) {
        closeDeleteDialog();
      }
    });
  }

  function closeDeleteDialog() {
    if (killModal) { killModal.classList.remove('is-open'); }
    var trigger = document.getElementById('mcMenuTrigger');
    if (trigger) { trigger.focus(); }
  }

  function openDeleteAccountDialog() {
    var user = state.user;
    if (!user) { return; }

    if (!killModal) { buildDeleteDialog(); }


    var panel = document.getElementById('mcMenuPanel');
    var trigger = document.getElementById('mcMenuTrigger');
    if (panel) { panel.classList.remove('is-open'); }
    if (trigger) { trigger.setAttribute('aria-expanded', 'false'); }

    var email = user.email || '';
    var isStaff = state.role === 'editor' || state.role === 'admin';

    killModal.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Close">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico mc-modal-ico--danger"><i class="bi bi-person-x"></i></div>' +
        '<h2 id="mcKillTitle">Delete your account?</h2>' +
        '<p class="mc-modal-sub">' +
          'This closes <strong>' + esc(api.displayName()) + '</strong> for good. ' +
          'There is no way to bring it back — not from this page, and not by asking an admin.' +
        '</p>' +
        killListHtml(isStaff) +
        '<form id="mcKillForm" novalidate>' +
          '<label class="mc-auth-label" for="mcKillInput">' +
            'Type the password for <strong>' + esc(email) + '</strong> to confirm' +
          '</label>' +
          '<div class="mc-auth-field">' +
            '<i class="bi bi-lock"></i>' +
            
            '<input type="password" id="mcKillInput" autocomplete="off" spellcheck="false" ' +
                   'autocapitalize="off" placeholder="Your password">' +
            '<button type="button" class="mc-auth-reveal" id="mcKillReveal" ' +
                    'aria-label="Show password"><i class="bi bi-eye"></i></button>' +
          '</div>' +
          '<div class="mc-modal-msg" id="mcKillMsg" role="status" aria-live="polite" style="display:none"></div>' +
          
          '<div class="mc-modal-actions">' +
            '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
            '<button type="submit" class="mc-auth-btn mc-auth-btn--danger" id="mcKillGo" disabled>' +
              'Delete my account</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    var input  = document.getElementById('mcKillInput');
    var go     = document.getElementById('mcKillGo');
    var reveal = document.getElementById('mcKillReveal');

    
    reveal.addEventListener('click', function () {
      var shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      reveal.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
      reveal.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
      input.focus();
    });

    input.addEventListener('input', function () {
      go.disabled = !input.value;
      deleteMessage('');
    });

    document.getElementById('mcKillForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var password = input.value;
      if (!password) {
        deleteMessage('Type the password for this account to confirm.');
        input.focus();
        return;
      }

      go.disabled = true;
      go.textContent = 'Deleting…';
      deleteMessage('');

      api.deleteOwnAccount(password)
        .then(function () {
          
          killModal.classList.remove('is-open');
          window.location.replace(loginUrl());
        })
        .catch(function (err) {
          console.error('[MedCare] Could not delete the account:', err);
          go.textContent = 'Delete my account';
          deleteMessage(explainDelete(err));

          
          if (/wrong_password/i.test(String((err && err.message) || ''))) {
            input.value = '';
            go.disabled = true;
          } else {
            go.disabled = false;
          }
          input.focus();
        });
    });

    killModal.classList.add('is-open');
    input.focus();
  }

  
  function loginUrl() {
    var dir = window.location.pathname.replace(/[^/]*$/, '');
    return (/\/(diseases|admin|editor)\/$/.test(dir) ? '../' : '') + 'login.html';
  }

  api.openDeleteAccountDialog = openDeleteAccountDialog;

  window.MedCareAuth = api;

  if (!db) {

    state.ready = true;
    api.ready = Promise.resolve(null);
    return;
  }


  state.role = readCachedRole();

  
  var settleReady;
  api.ready = new Promise(function (resolve) { settleReady = resolve; });

  db.auth.onAuthStateChange(function (event, session) {

    if (event === 'TOKEN_REFRESHED' && session && session.user &&
        state.user && session.user.id === state.user.id) {
      state.user = session.user;
      settleReady(state.role);
      return;
    }
    applySession(session).then(settleReady);
  });

  
  window.setTimeout(function () {
    if (!state.ready) {
      console.warn('[MedCare] No session answer from Supabase; treating this visit as signed out.');
      state.ready = true;
      settleReady(null);
    }
  }, 8000);

  
  function buildNavAccount() {
    
    var slot = document.querySelector('[data-mc-account]');
    var nav = document.querySelector('.mc-nav .navbar-collapse');
    if ((!slot && !nav) || document.getElementById('mcAccount')) { return; }

    var path = window.location.pathname;
    var here = path.split('/').pop() || 'index.html';
    
    var depth = /\/(diseases|editor|admin)\//.test(path) ? '../' : '';
    var atRoot = !depth;
    var inDesk = path.indexOf('/editor/') !== -1;

    var wrap = slot;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'mc-account';
      nav.appendChild(wrap);
    }
    wrap.id = 'mcAccount';

    
    var ICONS = {
      dashboard: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"></rect>' +
                 '<rect x="13.5" y="3.5" width="7" height="7" rx="1.6"></rect>' +
                 '<rect x="13.5" y="13.5" width="7" height="7" rx="1.6"></rect>' +
                 '<rect x="3.5" y="13.5" width="7" height="7" rx="1.6"></rect>',
      settings:  '<path d="M4 7h16M4 12h16M4 17h16"></path>' +
                 '<circle cx="9" cy="7" r="2.2" fill="#fff"></circle>' +
                 '<circle cx="15" cy="12" r="2.2" fill="#fff"></circle>' +
                 '<circle cx="8" cy="17" r="2.2" fill="#fff"></circle>',
      security:  '<path d="M12 3.2l7 2.9v5c0 4.3-2.9 7.8-7 8.9-4.1-1.1-7-4.6-7-8.9v-5l7-2.9z"></path>' +
                 '<path d="M9.2 12.1l2 2 3.6-3.8"></path>',
      logs:      '<path d="M14 3.2H7.4A2.2 2.2 0 0 0 5.2 5.4v13.2a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2V8.2z"></path>' +
                 '<path d="M14 3.2v5h4.8"></path><path d="M8.8 13.2h6.4M8.8 17h4.2"></path>',
      staff:     '<circle cx="9.2" cy="8.4" r="3.2"></circle>' +
                 '<path d="M3.6 20a5.6 5.6 0 0 1 11.2 0"></path>' +
                 '<path d="M16.2 5.6a3 3 0 0 1 0 5.8"></path>' +
                 '<path d="M18.2 20a5.7 5.7 0 0 0-2.4-4.5"></path>',
      signout:   '<path d="M12 4.2H6.6a2.2 2.2 0 0 0-2.2 2.2v11.2a2.2 2.2 0 0 0 2.2 2.2H12"></path>' +
                 '<path d="M15.6 16.4l4.4-4.4-4.4-4.4"></path><path d="M20 12H9.4"></path>',
      desk:      '<rect x="3.4" y="4.4" width="17.2" height="12" rx="2"></rect>' +
                 '<path d="M8 20h8M12 16.4V20"></path>',
      bookmark:  '<path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-3.6L5.5 19.5v-14a1 1 0 0 1 1-1z"></path>',
      pencil:    '<path d="M16.6 3.9a2 2 0 0 1 2.8 2.8L8.2 17.9l-3.7 1 1-3.7z"></path>' +
                 '<path d="M14.6 5.9l3.5 3.5"></path>',
      inbox:     '<path d="M4 13.5h4l1.2 2.4h5.6L16 13.5h4"></path>' +
                 '<path d="M4 13.5l2.4-7.6a1.6 1.6 0 0 1 1.5-1.1h8.2a1.6 1.6 0 0 1 1.5 1.1L20 13.5v4.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 17.9z"></path>',
      rename:    '<path d="M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z"></path>' +
                 '<circle cx="12" cy="10" r="2.8"></circle>' +
                 '<path d="M6.6 18.6a6.2 6.2 0 0 1 10.8 0"></path>',

      erase:     '<circle cx="10.2" cy="8.4" r="3.4"></circle>' +
                 '<path d="M4 20a6.2 6.2 0 0 1 10.6-4.4"></path>' +
                 '<path d="M16.4 16.4l4.2 4.2M20.6 16.4l-4.2 4.2"></path>',
      caret:     '<path d="M6 9.5l6 6 6-6"></path>'
    };

    function svg(name, size) {
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true">' + ICONS[name] + '</svg>';
    }


    function initials(source) {
      var text = String(source || '').split('@')[0];
      var parts = text.split(/[\s._+-]+/).filter(Boolean);
      var out = parts.length > 1
        ? parts[0].charAt(0) + parts[1].charAt(0)
        : text.slice(0, 2);
      return (out || '?').toUpperCase();
    }

    
    function menuItems(role) {
      if (role === 'admin') {
        return [
          { label: 'Admin Dashboard', icon: 'dashboard', href: depth + 'admin.html',
            current: atRoot && here === 'admin.html' },
          { label: 'Manage Staff', icon: 'staff', href: depth + 'admin.html#people' }
        ];
      }
      if (role === 'editor') {
        return [
          
          { label: 'Editor desk', icon: 'desk', href: depth + 'editor/index.html',
            current: inDesk },
          { label: 'Manage diseases', icon: 'pencil', href: depth + 'manage-diseases.html',
            current: atRoot && here === 'manage-diseases.html' },
          { label: 'Reports inbox', icon: 'inbox', href: depth + 'reports.html',
            current: atRoot && here === 'reports.html' }
        ];
      }

      return [];
    }


    function roleLabel(role) {
      if (role === 'admin') { return 'Admin'; }
      if (role === 'editor') { return 'Editor'; }
      return 'Reader';
    }

    function menuMarkup(name, role) {
      var rows = menuItems(role).map(function (it) {
        var inner = svg(it.icon, 18) + '<span>' + it.label + '</span>';
        return '<a class="mc-menu-item' + (it.current ? ' is-current' : '') + '" role="menuitem" ' +
          'tabindex="-1" href="' + it.href + '"' +
          (it.current ? ' aria-current="page"' : '') + '>' + inner + '</a>';
      }).join('');

      
      var savedCurrent = atRoot && here === 'saved.html';
      var savedLink =
        '<a class="mc-menu-item' + (savedCurrent ? ' is-current' : '') + '" role="menuitem" ' +
          'tabindex="-1" href="' + depth + 'saved.html"' +
          (savedCurrent ? ' aria-current="page"' : '') + '>' +
          svg('bookmark', 18) + '<span>Saved items</span></a>';


      var rename =
        '<button type="button" class="mc-menu-item" role="menuitem" tabindex="-1" ' +
                'id="mcRename">' + svg('rename', 18) +
          '<span>Change your display name</span></button>';

      return '<div class="mc-menu">' +
        '<button type="button" class="mc-menu-trigger" id="mcMenuTrigger" ' +
                'aria-haspopup="true" aria-expanded="false" aria-controls="mcMenuPanel">' +
          '<span class="mc-menu-avatar">' + esc(initials(name)) + '</span>' +
          '<span class="mc-menu-name">' + esc(name) + '</span>' +
          '<span class="mc-menu-caret">' + svg('caret', 15) + '</span>' +
        '</button>' +
        '<div class="mc-menu-panel" id="mcMenuPanel" role="menu" aria-labelledby="mcMenuTrigger">' +
          '<div class="mc-menu-head">' +
            '<span class="mc-menu-avatar">' + esc(initials(name)) + '</span>' +
            '<div class="mc-menu-head-text">' +
              '<div class="mc-menu-head-name">' + esc(name) + '</div>' +
              '<div class="mc-menu-head-sub">' + esc(roleLabel(role)) + '</div>' +
            '</div>' +
          '</div>' +
          (rows ? '<div class="mc-menu-sep"></div>' +
                  '<div class="mc-menu-list">' + rows + '</div>' : '') +
          '<div class="mc-menu-sep"></div>' +
          '<div class="mc-menu-list">' + savedLink + '</div>' +
          '<div class="mc-menu-sep"></div>' +
          '<div class="mc-menu-list">' + rename + '</div>' +
          '<div class="mc-menu-sep"></div>' +
          '<div class="mc-menu-list">' +
            '<button type="button" class="mc-menu-item mc-menu-item--danger" role="menuitem" ' +
                    'tabindex="-1" id="mcSignOut">' + svg('signout', 18) +
              '<span>Secure Log Out</span></button>' +
            
            '<button type="button" class="mc-menu-item mc-menu-item--danger" role="menuitem" ' +
                    'tabindex="-1" id="mcDeleteAccount">' + svg('erase', 18) +
              '<span>Delete your account</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    
    var renameModal = null;

    function renameMessage(text, kind) {
      var el = document.getElementById('mcRenameMsg');
      if (!el) { return; }
      if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
      el.textContent = text;
      el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
      el.style.display = 'block';
    }


    function explainRename(err) {
      var text = String((err && err.message) || '');
      if (/display_name_blank/i.test(text)) {
        return 'Enter the name you would like to be called.';
      }
      if (/display_name_too_long|profiles_display_name_len/i.test(text)) {
        return 'Display names stop at 60 characters.';
      }
      if (/not_signed_in/i.test(text)) {
        return 'You have been signed out. Sign in again and try once more.';
      }
      if (err && err.code === 'PGRST202') {

        return 'Display name changes are not switched on for this site yet.';
      }
      return text || 'Something went wrong.';
    }

    function buildRenameDialog() {
      renameModal = document.createElement('div');
      renameModal.className = 'mc-modal';
      renameModal.setAttribute('role', 'dialog');
      renameModal.setAttribute('aria-modal', 'true');
      renameModal.setAttribute('aria-labelledby', 'mcRenameTitle');
      renameModal.innerHTML =
        '<div class="mc-modal-backdrop" data-close></div>' +
        '<div class="mc-modal-panel">' +
          '<button type="button" class="mc-modal-x" data-close aria-label="Close">' +
            '<i class="bi bi-x-lg"></i></button>' +
          '<div class="mc-modal-ico mc-modal-ico--muted">' + svg('rename', 26) + '</div>' +
          '<h2 id="mcRenameTitle">Change your display name</h2>' +
          '<p class="mc-modal-sub">This is the name the site shows in place of your email address.</p>' +
          '<form id="mcRenameForm" novalidate>' +
            '<label class="mc-auth-label" for="mcRenameInput">Display name</label>' +
            '<div class="mc-auth-field">' +
              '<input type="text" id="mcRenameInput" maxlength="60" ' +
                     'autocomplete="nickname" placeholder="Su Myat Aung" style="padding-left:.9rem">' +
            '</div>' +
            '<p class="mc-admin-hint" style="text-align:left;margin:-.55rem 0 1rem">' +
              'Anything you like, in any language. Spaces and punctuation are fine.</p>' +
            '<div class="mc-modal-msg" id="mcRenameMsg" role="status" aria-live="polite" style="display:none"></div>' +
            '<div class="mc-modal-actions">' +
              '<button type="submit" class="mc-auth-btn" id="mcRenameSave">Save</button>' +
              '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>';
      document.body.appendChild(renameModal);

      renameModal.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { closeRenameDialog(); }
      });
      document.addEventListener('keydown', function (e) {
        if ((e.key === 'Escape' || e.key === 'Esc') &&
            renameModal.classList.contains('is-open')) {
          closeRenameDialog();
        }
      });
      document.getElementById('mcRenameForm').addEventListener('submit', onRenameSubmit);
    }

    function openRenameDialog() {
      if (!renameModal) { buildRenameDialog(); }


      var panel = document.getElementById('mcMenuPanel');
      var trigger = document.getElementById('mcMenuTrigger');
      if (panel) { panel.classList.remove('is-open'); }
      if (trigger) { trigger.setAttribute('aria-expanded', 'false'); }

      var profile = api.getProfile();
      var input = document.getElementById('mcRenameInput');
      input.value = (profile && profile.display_name) || '';
      renameMessage('');
      renameModal.classList.add('is-open');
      input.focus();
      input.select();
    }

    function closeRenameDialog() {
      if (renameModal) { renameModal.classList.remove('is-open'); }
      var trigger = document.getElementById('mcMenuTrigger');
      if (trigger) { trigger.focus(); }
    }

    function onRenameSubmit(e) {
      e.preventDefault();
      var input = document.getElementById('mcRenameInput');
      var save = document.getElementById('mcRenameSave');
      var name = input.value.trim();


      if (!name) {
        renameMessage('Enter the name you would like to be called.');
        input.focus();
        return;
      }

      save.disabled = true;
      renameMessage('');

      api.setDisplayName(name)
        .then(function () {

          closeRenameDialog();
        })
        .catch(function (err) {
          console.error('[MedCare] Could not change the display name:', err);
          renameMessage(explainRename(err));
        })
        .then(function () { save.disabled = false; });
    }

    
    function wireMenu() {
      var trigger = document.getElementById('mcMenuTrigger');
      var panel   = document.getElementById('mcMenuPanel');
      if (!trigger || !panel) { return; }

      var items = Array.prototype.slice.call(panel.querySelectorAll('[role="menuitem"]'));

      function onDocPointer(e) {
        if (!panel.contains(e.target) && !trigger.contains(e.target)) { close(false); }
      }

      function open(focusFirst) {
        panel.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onDocPointer, true);
        if (focusFirst && items.length) { items[0].focus(); }
      }

      function close(returnFocus) {
        panel.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDocPointer, true);
        if (returnFocus) { trigger.focus(); }
      }

      function isOpen() { return panel.classList.contains('is-open'); }

      function move(step) {
        var i = items.indexOf(document.activeElement);
        var next = (i + step + items.length) % items.length;
        items[next < 0 ? items.length - 1 : next].focus();
      }

      trigger.addEventListener('click', function () {
        if (isOpen()) { close(false); } else { open(false); }
      });

      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Down') { e.preventDefault(); open(true); }
        if (e.key === 'ArrowUp' || e.key === 'Up') {
          e.preventDefault();
          open(false);
          if (items.length) { items[items.length - 1].focus(); }
        }
      });

      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(true); return; }
        if (e.key === 'Tab') { close(false); return; }
        if (e.key === 'ArrowDown' || e.key === 'Down') { e.preventDefault(); move(1); }
        if (e.key === 'ArrowUp' || e.key === 'Up') { e.preventDefault(); move(-1); }
        if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
        if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      });


      panel.addEventListener('click', function (e) {
        var dead = e.target.closest('[aria-disabled="true"]');
        if (dead) { e.preventDefault(); e.stopPropagation(); }
      });
    }

    function render() {
      if (state.user) {
        var role = state.role || 'user';

        
        var deskLink = api.isStaff() && !inDesk
          ? '<a class="mc-account-btn" href="' + depth + 'editor/index.html">Desk</a>'
          : '';
        wrap.innerHTML = deskLink + menuMarkup(api.displayName(), role);
        wireMenu();

        var out = document.getElementById('mcSignOut');
        out.addEventListener('click', function () {
          out.disabled = true;
          
          var guard = window.MedCareEditorGuard || window.MedCareAdminGuard;
          if (guard && guard.signOut) { guard.signOut(); return; }
          api.signOut().then(function () { window.location.reload(); });
        });

        var rename = document.getElementById('mcRename');
        if (rename) {
          rename.addEventListener('click', function () { openRenameDialog(); });
        }

        var kill = document.getElementById('mcDeleteAccount');
        if (kill) {
          kill.addEventListener('click', function () { openDeleteAccountDialog(); });
        }
      } else if (here !== 'login.html') {
        wrap.innerHTML = '<a class="mc-account-btn" href="' + depth + 'login.html">Sign in</a>';
      } else {
        wrap.innerHTML = '';
      }
    }



    api.onChange(render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNavAccount);
  } else {
    buildNavAccount();
  }

})();
