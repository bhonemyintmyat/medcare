/* ============================================================
   MedCare — authentication + role helper
   ------------------------------------------------------------
   Load after supabase.js on every page:

     <script src=".../supabase-js@2.112.3" defer></script>
     <script src="supabase.js" defer></script>
     <script src="auth.js" defer></script>
     <script src="script.js" defer></script>

   Two different jobs live in this file, and it is worth keeping them
   apart in your head:

     AUTHENTICATION — "who are you?"  Handled by Supabase Auth. Email and
       password go to Supabase, which checks them and returns a signed
       token (a JWT) proving who you are. That token is what every later
       request carries.

     AUTHORIZATION — "what are you allowed to do?"  That is the `role`
       column in the profiles table, enforced by RLS policies in the
       database. Everything this file does with roles is for the
       INTERFACE ONLY: hiding a button, showing a name. It is not
       security. See the warning above getRole().
   ============================================================ */

(function () {
  'use strict';

  var ROLE_CACHE_KEY = 'mc-role';

  var state = {
    user: null,     // the signed-in account, or null
    role: null,     // 'user' | 'editor' | 'admin', or null when signed out
    profile: null,  // the whole profiles row: role, username, full_name
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
    } catch (e) { /* private mode */ }
  }

  var db = window.supabaseClient;

  /* ---------- Loading the profile ----------
     The role is read from the profiles table, not from anything the
     browser sent. RLS makes this query return only this user's own row,
     so there is no way to ask for somebody else's.

     The name and username ride along in the same request — one round
     trip, and the header can greet people by name instead of by email.
     They are display fields: nothing is ever decided by them. */
  function loadProfile(user) {
    if (!user) { return Promise.resolve(null); }
    return db.from('profiles')
      .select('role,username,full_name')
      .eq('id', user.id)
      .single()
      .then(function (res) {
        if (res.error) {
          // 42703 = the columns are not there yet, which means
          // supabase_profile_fields.sql has not been run. Fall back to the
          // role alone rather than leaving the page looking signed out.
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

  // Bumped on every session event, so a slow reply cannot overwrite a
  // newer one: sign out while the role query is in flight and the answer
  // that comes back belongs to an account that is no longer here.
  var applyToken = 0;

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

  /* ---------- Public API ---------- */
  var api = {
    // Resolves once the first session check has finished. Await this
    // before trusting getUser()/getRole() on page load.
    ready: null,

    getUser: function () { return state.user; },

    isSignedIn: function () { return !!state.user; },

    /* WARNING — UI ONLY.
       This value lives in the browser, so a determined visitor can change
       it with DevTools and make the interface behave as if they were an
       admin. That is fine, because it grants them nothing: the database
       re-checks the real role on every request via RLS. Use this to decide
       what to SHOW. Never use it to decide what is ALLOWED. */
    getRole: function () { return state.role; },

    // The whole profiles row, or null. Display fields only.
    getProfile: function () { return state.profile; },

    /* What to call this person on screen: the username they chose, then
       their name, then the email they signed in with. Never used to
       decide anything — only to write it. */
    displayName: function () {
      var p = state.profile;
      if (p && p.username) { return p.username; }
      if (p && p.full_name) { return p.full_name; }
      return state.user ? state.user.email : '';
    },

    hasRole: function (role) { return state.role === role; },

    // Convenience for menus: is this an editor or an admin?
    isStaff: function () { return state.role === 'editor' || state.role === 'admin'; },

    onChange: function (fn) {
      listeners.push(fn);
      if (state.ready) { fn(state.user, state.role); }
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) { listeners.splice(i, 1); }
      };
    },

    /* `profile` carries the two display fields the signup form collects:
       { fullName, username }. There is still no role argument, and there
       never will be — the trigger assigns 'user' and reads nothing from
       the client.

       These two DO come from the browser, so Supabase stores them
       verbatim as user metadata and the trigger re-validates them before
       they reach profiles. Treat what arrives here as a request, not as
       a fact. */
    signUp: function (email, password, profile) {
      return db.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: (profile && profile.fullName) || null,
            username: (profile && profile.username) || null
          }
        }
      });
    },

    /* Asks the database whether a username is free. The browser cannot
       answer this itself: RLS shows it one profile row, its own. See
       supabase_profile_fields.sql for what the function does and does
       not reveal. */
    usernameAvailable: function (name) {
      return db.rpc('username_available', { candidate: name })
        .then(function (res) {
          if (res.error) { throw res.error; }
          return res.data === true;
        });
    },

    signIn: function (email, password) {
      return db.auth.signInWithPassword({ email: email, password: password });
    },

    signOut: function () {
      return db.auth.signOut().then(function (res) {
        writeCachedRole(null);
        return res;
      });
    }
  };

  window.MedCareAuth = api;

  if (!db) {
    // supabase.js already explained why on the console.
    state.ready = true;
    api.ready = Promise.resolve(null);
    return;
  }

  // Restore the cached role immediately so the header does not flicker,
  // then overwrite it with the freshly fetched value a moment later.
  state.role = readCachedRole();

  /* ---------- ONE session read, not two ----------
     Registering this listener is the whole of it. supabase-js emits
     INITIAL_SESSION as soon as it has read the stored session — first
     refreshing the access token if it has expired — so there is nothing
     left for a getSession() call to do.

     This file used to do BOTH: getSession() here, and this listener,
     which is what produced the 400s in the console:

       POST /auth/v1/token?grant_type=refresh_token  ->  400
       {"error":"invalid_grant","error_description":"Invalid Refresh Token: Already Used"}

     Two reads, one stored refresh token, two refresh requests in flight.
     Refresh tokens rotate: the first request consumes the token and
     returns a new one, so the second arrives holding a token that has
     already been spent. Supabase treats a reused refresh token as a
     stolen one and can revoke the whole family — which is how a session
     that looked fine at page load turned into a silent sign-out later.
     Reading once removes the race rather than hiding the error. */
  var settleReady;
  api.ready = new Promise(function (resolve) { settleReady = resolve; });

  db.auth.onAuthStateChange(function (event, session) {
    // TOKEN_REFRESHED is a new access token for the same person, roughly
    // hourly. Their role cannot have changed with it, so keep what we
    // have instead of asking the database again on every refresh.
    if (event === 'TOKEN_REFRESHED' && session && session.user &&
        state.user && session.user.id === state.user.id) {
      state.user = session.user;
      settleReady(state.role);
      return;
    }
    applySession(session).then(settleReady);
  });

  /* If the library never reports at all — network blocked, wrong project
     URL — every guarded page would sit on "Checking your permissions…"
     for ever. Fall through as signed out instead: the guards then send
     people to the login page, and the database is what refuses the work
     regardless. */
  window.setTimeout(function () {
    if (!state.ready) {
      console.warn('[MedCare] No session answer from Supabase; treating this visit as signed out.');
      state.ready = true;
      settleReady(null);
    }
  }, 8000);

  /* ---------- Account control in the navbar ----------
     Injected rather than pasted into 33 HTML files, the same way the
     language bar is built in script.js. */
  function buildNavAccount() {
    var nav = document.querySelector('.mc-nav .navbar-collapse');
    if (!nav || document.getElementById('mcAccount')) { return; }

    var here = window.location.pathname.split('/').pop() || 'index.html';
    var depth = window.location.pathname.indexOf('/diseases/') !== -1 ? '../' : '';

    var wrap = document.createElement('div');
    wrap.id = 'mcAccount';
    wrap.className = 'mc-account';
    nav.appendChild(wrap);

    /* ---------- The account menu (admins) ----------
       An admin's account control is a menu button, not a row of buttons:
       the tools that only they can reach live behind their own face. The
       icons are drawn inline rather than taken from the Bootstrap Icons
       webfont so their stroke weight and size stay put next to 14px text.

       Everything here is still interface. The pages behind these links
       re-check the role, and RLS refuses the work regardless. */
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
      caret:     '<path d="M6 9.5l6 6 6-6"></path>'
    };

    function svg(name, size) {
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true">' + ICONS[name] + '</svg>';
    }

    // The avatar is drawn from whatever we can call them by:
    // "Su Myat Aung" -> SM, "su.aung@..." -> SA, "lead@..." -> LE.
    function initials(source) {
      var text = String(source || '').split('@')[0];
      var parts = text.split(/[\s._+-]+/).filter(Boolean);
      var out = parts.length > 1
        ? parts[0].charAt(0) + parts[1].charAt(0)
        : text.slice(0, 2);
      return (out || '?').toUpperCase();
    }

    // Four of these have no page yet. They are shown, disabled and
    // labelled, rather than hidden: the menu is also the plan.
    function adminItems() {
      return [
        { label: 'Admin Dashboard', icon: 'dashboard', href: depth + 'admin.html',
          current: here === 'admin.html' },
        { label: 'System Settings', icon: 'settings', soon: true },
        { label: 'Security &amp; MFA', icon: 'security', soon: true },
        { label: 'Audit Logs', icon: 'logs', soon: true },
        { label: 'Manage Staff', icon: 'staff', href: depth + 'admin.html#people' }
      ];
    }

    function menuMarkup(name, email) {
      var rows = adminItems().map(function (it) {
        var inner = svg(it.icon, 18) + '<span>' + it.label + '</span>' +
          (it.soon ? '<span class="mc-menu-soon">Soon</span>' : '');
        if (it.soon) {
          return '<span class="mc-menu-item" role="menuitem" tabindex="-1" aria-disabled="true">' +
            inner + '</span>';
        }
        return '<a class="mc-menu-item' + (it.current ? ' is-current' : '') + '" role="menuitem" ' +
          'tabindex="-1" href="' + it.href + '"' +
          (it.current ? ' aria-current="page"' : '') + '>' + inner + '</a>';
      }).join('');

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
              '<div class="mc-menu-head-name" title="' + esc(email) + '">' + esc(name) + '</div>' +
              '<div class="mc-menu-head-sub">Admin</div>' +
              // Only worth a line when it is not already the name above.
              (name === email ? '' :
                '<div class="mc-menu-head-mail">' + esc(email) + '</div>') +
            '</div>' +
          '</div>' +
          '<div class="mc-menu-sep"></div>' +
          '<div class="mc-menu-list">' + rows + '</div>' +
          '<div class="mc-menu-sep"></div>' +
          '<div class="mc-menu-list">' +
            '<button type="button" class="mc-menu-item mc-menu-item--danger" role="menuitem" ' +
                    'tabindex="-1" id="mcSignOut">' + svg('signout', 18) +
              '<span>Secure Log Out</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* Menu-button behaviour, by the book: click or ArrowDown opens and
       lands on the first item, Escape closes and gives the trigger its
       focus back, arrows roll around the list, and a click anywhere else
       or a Tab out closes it. Disabled items stay reachable by keyboard
       (aria-disabled, not removed) so they are discoverable, not secret. */
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

      // A click on a disabled row should do nothing at all — not even
      // close the menu, which would read as "that worked".
      panel.addEventListener('click', function (e) {
        var dead = e.target.closest('[aria-disabled="true"]');
        if (dead) { e.preventDefault(); e.stopPropagation(); }
      });
    }

    function render() {
      if (state.user) {
        var role = state.role || 'user';

        if (role === 'admin') {
          // An admin's tools hang off their own face: the menu carries the
          // dashboard, the staff list and the sign-out, so the navbar keeps
          // only the desk link beside it.
          wrap.innerHTML =
            '<a class="mc-account-btn" href="' + depth + 'editor-dashboard.html">Desk</a>' +
            menuMarkup(api.displayName(), state.user.email);
          wireMenu();
        } else {
          // Editors and readers keep the plain controls. Staff-only links
          // HIDE tools from ordinary users; they do not protect them. Each
          // page re-checks, and the RLS policies are what refuse the writes.
          var staffLinks = api.isStaff()
            ? '<a class="mc-account-btn" href="' + depth + 'editor-dashboard.html">Desk</a>'
            : '';
          wrap.innerHTML = staffLinks +
            '<span class="mc-account-who" title="' + esc(state.user.email) + '">' +
              '<i class="bi bi-person-circle"></i>' +
              '<span class="mc-account-email">' + esc(state.user.email) + '</span>' +
              '<span class="mc-account-role mc-account-role--' + esc(role) + '">' + esc(role) + '</span>' +
            '</span>' +
            '<button type="button" class="mc-account-btn" id="mcSignOut">Sign out</button>';
        }

        // Both branches draw a sign-out control; only its shape differs.
        var out = document.getElementById('mcSignOut');
        out.addEventListener('click', function () {
          out.disabled = true;
          api.signOut().then(function () { window.location.reload(); });
        });
      } else if (here !== 'login.html') {
        wrap.innerHTML = '<a class="mc-account-btn" href="' + depth + 'login.html">Sign in</a>';
      } else {
        wrap.innerHTML = '';
      }
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
