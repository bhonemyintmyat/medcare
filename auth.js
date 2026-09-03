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

  /* A one-shot note from a deletion to the page it lands on. See
     forgetSession() and openDeleteAccountDialog() for why it is a
     stored flag rather than a ?deleted=1 on the URL: the deletion has
     TWO redirects racing it on staff pages, and only one of them is
     ours. Both end at login.html, so the message has to be attached to
     the tab rather than to a link. Read and cleared by login.js. */
  var DELETED_FLAG_KEY = 'mc-account-deleted';

  var state = {
    user: null,     // the signed-in account, or null
    role: null,     // 'user' | 'editor' | 'admin', or null when signed out
    profile: null,  // the whole profiles row: role, display_name, full_name
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

  /* Both halves in this file, both wrapped: private mode throws on the
     way in as readily as on the way out, and a browser that will not
     carry the note must still let the deletion finish. Losing the
     message is a worse page; losing the deletion is a worse bug. */
  function flagDeleted(name) {
    try { sessionStorage.setItem(DELETED_FLAG_KEY, name || '1'); } catch (e) { /* private mode */ }
  }

  var db = window.supabaseClient;

  /* ---------- Loading the profile ----------
     The role is read from the profiles table, not from anything the
     browser sent. RLS makes this query return only this user's own row,
     so there is no way to ask for somebody else's.

     The display name rides along in the same request — one round
     trip, and the header can greet people by name instead of by email.
     They are display fields: nothing is ever decided by them. */
  function loadProfile(user) {
    if (!user) { return Promise.resolve(null); }
    return db.from('profiles')
      .select('role,display_name,full_name')
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

  /* Escaping, at module scope because two things need it now: the navbar
     menu, and the delete dialog that has to be reachable from pages the
     navbar was never built on. */
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

    /* What to call this person on screen: the display name they chose,
       then the name they signed up with, then the email. Never used to
       decide anything — only to write it. */
    displayName: function () {
      var p = state.profile;
      if (p && p.display_name) { return p.display_name; }
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
       { fullName, displayName }. There is still no role argument, and there
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
            display_name: (profile && profile.displayName) || null
          }
        }
      });
    },

    /* Changes THIS person's display name, and nothing else about them.

       Note what is not here: an id argument. The database takes the
       account from the verified token, so there is no field to point at
       somebody else's row. And no UPDATE runs from the browser — a
       narrow SECURITY DEFINER function does the write, because a policy
       permitting own-row updates would combine with the existing
       UPDATE (role) column grant and hand every user a promotion.
       supabase_display_name.sql spells that out. */
    setDisplayName: function (name) {
      return db.rpc('set_display_name', { new_name: name })
        .then(function (res) {
          if (res.error) { throw res.error; }
          if (state.profile) { state.profile.display_name = res.data; }
          notify();   // the header is showing the old name until this runs
          return res.data;
        });
    },

    signIn: function (email, password) {
      return db.auth.signInWithPassword({ email: email, password: password });
    },

    /* ---------- Forgetting a password, and getting back in ----------

       Two halves of one trip. sendRecovery() asks Supabase to mail a
       one-time link; that link lands on reset-password.html, where the
       token in the URL becomes a short-lived session and updatePassword()
       writes the new password against it.

       redirectTo is resolved against whatever page is asking rather than
       written out as a domain, so the same file works from a localhost
       server and from the real site. Supabase only honours a redirect it
       recognises, so wherever this is served from has to be listed under
       Authentication -> URL Configuration in the dashboard, and
       reset-password.html has to be reachable there.

       Note what sendRecovery does NOT report: whether the address has an
       account. Supabase answers the same way either way, and that is the
       point — a truthful answer would turn the form into a way of asking
       whether a given person has an account on a health site. */
    recoveryRedirect: function () {
      return new URL('reset-password.html', window.location.href).href;
    },

    sendRecovery: function (email) {
      return db.auth.resetPasswordForEmail(email, { redirectTo: api.recoveryRedirect() });
    },

    /* Sets a new password for whoever the CURRENT session belongs to.
       There is no id argument and no old-password argument for the same
       reason setDisplayName has none: the account comes from the verified
       token. Clicking the emailed link is what proves the mailbox, and
       the session it grants is what authorises this write. */
    updatePassword: function (password) {
      return db.auth.updateUser({ password: password });
    },

    signOut: function () {
      return db.auth.signOut().then(function (res) {
        writeCachedRole(null);
        return res;
      });
    },

    /* ---------- Leaving for good ----------

       Deletes THIS account. No id argument here either, and for the
       same reason setDisplayName has none: the database takes the
       person from the verified token, so there is no field on the call
       to point at somebody else's row.

       The one argument is that account's own password, and it is SENT
       rather than checked here: this browser has no hash to check it
       against. delete_own_account() compares it with the one GoTrue
       stored, and refuses the whole call when they differ — so a script
       that skips the dialog below gains nothing by skipping it.

       supabase_account_deletion.sql holds the rules — the one refusal
       (the last admin cannot leave the site without an admin) and the
       full list of what the cascade takes and what it leaves standing.
       Nothing on this side re-implements any of it; the interface asks,
       and Postgres answers.

       Resolves with the name the site used to call them, so the
       confirmation can say goodbye to a person rather than to an id. */
    deleteOwnAccount: function (password) {
      return db.rpc('delete_own_account', { confirm_password: password }).then(function (res) {
        if (res.error) { throw res.error; }
        var name = res.data;

        /* The note is written HERE, between the deletion succeeding and
           the session being cleared, and the order is the whole point.
           Clearing the session fires SIGNED_OUT, and on a guarded page
           admin-guard.js answers that by starting a navigation. Writing
           the note afterwards would be a write racing a page that is
           already on its way out. */
        flagDeleted(name);

        return forgetSession().then(function () { return name; });
      });
    },

    /* Opens the confirm-and-delete dialog. Public because the navbar is
       not the only place it is needed: staff spend their day in
       admin/ and editor/, which have their own chrome and no navbar,
       and "you may delete your account, but only from a page you are
       not on" is not a policy anybody meant to write. */
    openDeleteAccountDialog: null,  // assigned below, once it is defined

    /* The other end of the note a deletion leaves on the tab. Reading it
       clears it, so a reload of login.html does not keep announcing a
       deletion that happened ten minutes ago. Returns the name the site
       used to call them, or null when nothing was left. */
    takeDeletionNotice: function () {
      var name = null;
      try {
        name = sessionStorage.getItem(DELETED_FLAG_KEY);
        sessionStorage.removeItem(DELETED_FLAG_KEY);
      } catch (e) { /* private mode */ }
      return name;
    }
  };

  /* The tokens in this browser outlive the account by up to an hour. An
     access token is a signed statement, not a lookup, so nothing
     revokes one that has already been handed out — clearing them here
     is the browser's half of the deletion.

     `scope: 'local'` rather than a full sign-out: the server-side
     session died with the row, and asking Supabase to end a session
     that no longer exists returns an error about nothing. That error
     would otherwise be the only thing a successful deletion ever
     reported. Either outcome runs the same teardown, because a failed
     sign-out must not leave a deleted account with a header still
     greeting it by name. */
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

  /* ---------- "Delete your account" ----------
     One dialog, built on first use and reused, living here rather than
     inside the navbar menu so every area of the site can open it.

     It asks for the account's password. That is not a second factor and
     is not treated as one — the session already proves who this is, and
     whoever holds the session can usually read the password out of the
     browser that saved it. It is there because the session cannot prove
     that the person MEANT it, and this is the only action on the site
     with nothing behind it: no archive, no draft, no undo, no admin who
     can put it back.

     It used to ask for the email address, which was sitting on the
     screen behind the dialog and could be copied by somebody who did
     not know it. A password cannot be read off the page — and, the part
     this file could not offer on its own, it is checked in the database
     rather than here, so it stands in front of anything that skips this
     dialog and calls delete_own_account() directly too.

     Nothing is compared in this file any more. The field is only
     checked for being non-empty, to save an empty submit a round trip;
     the verdict that counts comes back from Postgres, which is the side
     holding the hash. */
  var killModal = null;

  function deleteMessage(text, kind) {
    var el = document.getElementById('mcKillMsg');
    if (!el) { return; }
    if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = text;
    el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
    el.style.display = 'block';
  }

  /* The database answers in error codes. This turns the ones this
     dialog can actually provoke into sentences that say what to do. */
  function explainDelete(err) {
    var text = String((err && err.message) || '');
    if (/wrong_password/i.test(text)) {
      return 'That is not the password for this account. Nothing has been deleted.';
    }
    /* Cannot happen while signup is the only way in, and it is answered
       anyway rather than falling through to "something went wrong",
       which is what an account signed up through a future magic link
       would otherwise be told. */
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
    /* PGRST301 is PostgREST refusing the token itself — expired, or from
       a project this key does not belong to. It arrives worded for
       whoever wrote the token ("No suitable key or wrong key type"),
       which is nobody who is reading this dialog. */
    if (err && err.code === 'PGRST301') {
      return 'Your session is no longer valid, so nothing was deleted. ' +
             'Sign in again and try once more.';
    }
    if (/permission denied for table users/i.test(text)) {
      return 'The database can accept the request but is not allowed to carry it out. ' +
             'Run supabase_account_deletion.sql as postgres — its first section explains why.';
    }
    if (err && err.code === 'PGRST202') {
      // The function is not deployed yet.
      return 'Account deletion is not switched on for this site yet. ' +
             'Run supabase_account_deletion.sql in the Supabase SQL editor.';
    }
    if (/Failed to fetch|NetworkError/i.test(text)) {
      return 'Could not reach the database. Check your connection — nothing was deleted.';
    }
    return text || 'Something went wrong, and your account has not been deleted.';
  }

  /* Both the goes/stays list and the final screen are written in plain
     terms because this is the last thing somebody reads before an
     irreversible act, and it should not be the first place they learn
     that their bookmarks were included. */
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

    // Close the navbar menu behind it, where there is one, so the
    // dialog is the only thing open.
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
            /* autocomplete="off", not "current-password": a password
               manager filling this in would be handing back the very
               proof the field is here to ask for. Browsers honour that
               unevenly, which is why the danger button is still a
               deliberate second act. */
            '<input type="password" id="mcKillInput" autocomplete="off" spellcheck="false" ' +
                   'autocapitalize="off" placeholder="Your password">' +
            '<button type="button" class="mc-auth-reveal" id="mcKillReveal" ' +
                    'aria-label="Show password"><i class="bi bi-eye"></i></button>' +
          '</div>' +
          '<div class="mc-modal-msg" id="mcKillMsg" role="status" aria-live="polite" style="display:none"></div>' +
          /* Cancel first here, unlike the rename dialog, and matching the
             admin area's confirm-by-name. In a dialog whose other button
             cannot be undone, the safe one should be the one a cursor
             moving left to right reaches first. Enter still confirms:
             the submit button is the form's default, and it is disabled
             until the password field has something in it. */
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

    /* Same toggle as the sign-in and reset screens. It matters a little
       more here: this is the one password field with nothing to compare
       against on the client, so a typo comes back as a refusal from the
       database rather than as a mismatch under the cursor. */
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
          /* Nothing is shown in the dialog on success, on purpose. The
             page behind it belongs to an account that no longer exists,
             and on a guarded page it is ALREADY being replaced: the
             sign-out inside deleteOwnAccount fires SIGNED_OUT, and
             admin-guard.js answers that by sending the browser to the
             sign-in screen. A congratulations panel here would be a
             panel that the admin area gets to see for a quarter of a
             second and the public site gets to see for ever.

             So the note is left on the tab — deleteOwnAccount has
             already done that — and the same destination is chosen
             deliberately. Whichever redirect wins, the page that loads
             is login.html, and login.js is what says goodbye. */
          killModal.classList.remove('is-open');
          window.location.replace(loginUrl());
        })
        .catch(function (err) {
          console.error('[MedCare] Could not delete the account:', err);
          go.textContent = 'Delete my account';
          deleteMessage(explainDelete(err));

          /* A refused password empties the field and puts the button
             back out of reach, so the next attempt is a fresh one and
             not a nudge at the same wrong word. Every other failure
             here — a dead session, an unreachable database — is not the
             typing's fault, so it keeps what was typed. */
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

  /* Where login.html is from wherever this is running. The navbar menu
     works this out for itself with the same trick, but it only ever has
     to cope with /diseases/; this can be called from /admin/ and
     /editor/ too. Not root-absolute like admin-guard.js's copy — that
     one assumes the site is served from a domain root, and this file is
     also loaded by pages opened from a subfolder. */
  function loginUrl() {
    var dir = window.location.pathname.replace(/[^/]*$/, '');
    return (/\/(diseases|admin|editor)\/$/.test(dir) ? '../' : '') + 'login.html';
  }

  api.openDeleteAccountDialog = openDeleteAccountDialog;

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
    /* Two kinds of host. A public page has a navbar and the menu is
       appended to it; the staff areas have no navbar at all, and mark
       the spot in their own topbar with data-mc-account instead. */
    var slot = document.querySelector('[data-mc-account]');
    var nav = document.querySelector('.mc-nav .navbar-collapse');
    if ((!slot && !nav) || document.getElementById('mcAccount')) { return; }

    var path = window.location.pathname;
    var here = path.split('/').pop() || 'index.html';
    /* Everything the menu links to sits at the site root, and these are
       the three folders a page can be one level down in. `atRoot` is
       what keeps a file name from matching across them: the desk has a
       reports.html of its own, and it is not the one in the menu. */
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
      // A person with a cross, not a wastebasket. A bin says "throw the
      // thing away"; this is about an account, and the account is a person.
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

    /* What each role finds in the menu. Everyone gets the last two
       groups — a name to change and a way out — so the menu is now the
       account control for readers as much as for admins. */
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
          /* The desk moved into editor/ when it grew past one page. `here`
             is only the file name, and every area has an index.html, so
             this one is matched on the directory instead. */
          { label: 'Editor desk', icon: 'desk', href: depth + 'editor/index.html',
            current: inDesk },
          { label: 'Manage diseases', icon: 'pencil', href: depth + 'manage-diseases.html',
            current: atRoot && here === 'manage-diseases.html' },
          { label: 'Reports inbox', icon: 'inbox', href: depth + 'reports.html',
            current: atRoot && here === 'reports.html' }
        ];
      }
      // A reader has no tools, which is not the same as having no menu.
      return [];
    }

    // The role, as a word rather than a database value.
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

      /* Saved items. Every signed-in reader has these, staff included —
         an editor reads the site too — so it lives outside menuItems(),
         which is only the role-specific tools. */
      var savedCurrent = atRoot && here === 'saved.html';
      var savedLink =
        '<a class="mc-menu-item' + (savedCurrent ? ' is-current' : '') + '" role="menuitem" ' +
          'tabindex="-1" href="' + depth + 'saved.html"' +
          (savedCurrent ? ' aria-current="page"' : '') + '>' +
          svg('bookmark', 18) + '<span>Saved items</span></a>';

      // Every role gets this one, which is the point of it.
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
            /* Below signing out, and in the same group, because they are
               the two ways of leaving and one of them is permanent.
               Every role gets it: an editor and an admin own their
               account exactly as much as a reader owns theirs. */
            '<button type="button" class="mc-menu-item mc-menu-item--danger" role="menuitem" ' +
                    'tabindex="-1" id="mcDeleteAccount">' + svg('erase', 18) +
              '<span>Delete your account</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* ---------- "Change your display name" ----------
       The same lightweight modal the disease pages use to report an
       inaccuracy — this site does not load Bootstrap's JS bundle — built
       once on first use and reused after that.

       There is nothing to validate but emptiness. A display name may be
       written in any script, may hold spaces and punctuation, and does
       not have to be unique: it is what the site calls you, not how you
       sign in. The only limit is 60 characters, which is about the
       navbar rather than about names. */
    var renameModal = null;

    function renameMessage(text, kind) {
      var el = document.getElementById('mcRenameMsg');
      if (!el) { return; }
      if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
      el.textContent = text;
      el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
      el.style.display = 'block';
    }

    // The database answers in error codes. This turns them into sentences.
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
        // The function is not deployed yet.
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

      // Close the menu behind it, so the dialog is the only thing open.
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

      // The only thing that can be wrong with it.
      if (!name) {
        renameMessage('Enter the name you would like to be called.');
        input.focus();
        return;
      }

      save.disabled = true;
      renameMessage('');

      api.setDisplayName(name)
        .then(function () {
          // setDisplayName has already told the listeners, so the header is
          // showing the new name by the time this closes.
          closeRenameDialog();
        })
        .catch(function (err) {
          console.error('[MedCare] Could not change the display name:', err);
          renameMessage(explainRename(err));
        })
        .then(function () { save.disabled = false; });
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

        /* One control for everybody now: the menu hangs off their own
           face and carries whatever their role can reach. Staff keep the
           desk link beside it, because that is the page they live on.

           Staff-only links HIDE tools from ordinary users; they do not
           protect them. Each page re-checks, and the RLS policies are
           what refuse the writes. */
        var deskLink = api.isStaff() && !inDesk
          ? '<a class="mc-account-btn" href="' + depth + 'editor/index.html">Desk</a>'
          : '';
        wrap.innerHTML = deskLink + menuMarkup(api.displayName(), role);
        wireMenu();

        var out = document.getElementById('mcSignOut');
        out.addEventListener('click', function () {
          out.disabled = true;
          /* Inside a guarded area, reloading would only paint the gate
             on its way to the login page. The guard already knows where
             someone who has just signed out belongs, so let it say. */
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

    // esc() is the one at the top of this file now: the delete dialog
    // needs it too, and it lives outside this function.

    api.onChange(render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNavAccount);
  } else {
    buildNavAccount();
  }

})();
