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
    user: null,   // the signed-in account, or null
    role: null,   // 'user' | 'editor' | 'admin', or null when signed out
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

  /* ---------- Loading the role ----------
     The role is read from the profiles table, not from anything the
     browser sent. RLS makes this query return only this user's own row,
     so there is no way to ask for somebody else's. */
  function loadRole(user) {
    if (!user) { return Promise.resolve(null); }
    return db.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(function (res) {
        if (res.error) {
          console.error('[MedCare] Could not read profile role:', res.error);
          return null;
        }
        return res.data ? res.data.role : null;
      })
      .catch(function (err) {
        console.error('[MedCare] Could not read profile role:', err);
        return null;
      });
  }

  function applySession(session) {
    state.user = session ? session.user : null;
    return loadRole(state.user).then(function (role) {
      state.role = role;
      writeCachedRole(role);
      state.ready = true;
      notify();
      return role;
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

    signUp: function (email, password) {
      // Note there is no role argument. The client never gets to say what
      // it should be — the database trigger assigns 'user'.
      return db.auth.signUp({ email: email, password: password });
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

  api.ready = db.auth.getSession().then(function (res) {
    return applySession(res.data ? res.data.session : null);
  });

  // Fires on sign in, sign out, token refresh, and in other tabs.
  db.auth.onAuthStateChange(function (event, session) {
    applySession(session);
  });

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

    function render() {
      if (state.user) {
        var role = state.role || 'user';
        // Staff-only link. This HIDES the tool from ordinary users; it does
        // not protect it. The page itself re-checks, and the RLS policies
        // are what actually refuse their writes.
        var manage = api.isStaff()
          ? '<a class="mc-account-btn" href="' + depth + 'manage-diseases.html">Manage</a>' +
            '<a class="mc-account-btn" href="' + depth + 'reports.html">Inbox</a>'
          : '';
        wrap.innerHTML = manage +
          '<span class="mc-account-who" title="' + esc(state.user.email) + '">' +
            '<i class="bi bi-person-circle"></i>' +
            '<span class="mc-account-email">' + esc(state.user.email) + '</span>' +
            '<span class="mc-account-role mc-account-role--' + esc(role) + '">' + esc(role) + '</span>' +
          '</span>' +
          '<button type="button" class="mc-account-btn" id="mcSignOut">Sign out</button>';
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
