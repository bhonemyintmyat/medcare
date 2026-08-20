/* ============================================================
   MedCare — login page behaviour
   Loaded only by login.html, after auth.js.
   ============================================================ */

(function () {
  'use strict';

  var form = document.getElementById('authForm');
  if (!form) { return; }

  var auth       = window.MedCareAuth;
  var formCard   = document.getElementById('authFormCard');
  var signedIn   = document.getElementById('authSignedIn');
  var whoEmail   = document.getElementById('authWhoEmail');
  var whoRole    = document.getElementById('authWhoRole');
  var emailEl    = document.getElementById('authEmail');
  var passEl     = document.getElementById('authPassword');
  var submitBtn  = document.getElementById('authSubmit');
  var msgEl      = document.getElementById('authMsg');
  var hintEl     = document.getElementById('authHint');
  var tabIn      = document.getElementById('tabSignIn');
  var tabUp      = document.getElementById('tabSignUp');
  var revealBtn  = document.getElementById('authReveal');

  // Signup-only: a name, a handle, and the password a second time.
  var fullNameEl = document.getElementById('authFullName');
  var usernameEl = document.getElementById('authUsername');
  var confirmEl  = document.getElementById('authConfirm');
  var signupOnly = document.querySelectorAll('.mc-signup-only');

  // Kept in step with profiles_username_format in
  // supabase_profile_fields.sql. The copy here is a courtesy that catches
  // a typo before a round trip; the constraint is what enforces it.
  var USERNAME_RE = /^[A-Za-z0-9._-]{3,24}$/;

  var mode = 'signin';

  function message(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'mc-auth-msg mc-auth-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
  }
  function clearMessage() {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }

  // The database speaks in constraint names and error codes. This is
  // where they become sentences.
  function explainAuth(err) {
    var text = String((err && err.message) || '');
    if ((err && err.code === 'username_taken') ||
        /profiles_username_lower_idx|duplicate key/i.test(text)) {
      return 'That username is already taken. Please pick another one.';
    }
    if (/username_invalid/i.test(text)) {
      return 'That username has characters the site cannot use. Letters, numbers, dots, dashes or underscores only.';
    }
    if (/Database error saving new user/i.test(text)) {
      return 'The account could not be created. If you picked an unusual username, try a simpler one.';
    }
    return text || 'That did not work. Please try again.';
  }

  function setMode(next) {
    mode = next;
    var up = mode === 'signup';
    tabIn.classList.toggle('is-active', !up);
    tabUp.classList.toggle('is-active', up);
    tabIn.setAttribute('aria-selected', String(!up));
    tabUp.setAttribute('aria-selected', String(up));
    submitBtn.textContent = up ? 'Create account' : 'Sign in';
    hintEl.textContent = up
      ? 'Pick a password of at least 6 characters. Your account starts with the "user" role.'
      : 'Use the email and password you signed up with.';
    passEl.setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    passEl.setAttribute('placeholder', up ? 'At least 6 characters' : 'Your password');
    Array.prototype.forEach.call(signupOnly, function (el) { el.hidden = !up; });
    clearMessage();
  }

  tabIn.addEventListener('click', function () { setMode('signin'); });
  tabUp.addEventListener('click', function () { setMode('signup'); });

  revealBtn.addEventListener('click', function () {
    var shown = passEl.type === 'text';
    passEl.type = shown ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    revealBtn.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
  });

  function showSignedIn(user, role) {
    whoEmail.textContent = user.email;
    whoRole.textContent = role || 'user';
    whoRole.className = 'mc-account-role mc-account-role--' + (role || 'user');
    formCard.style.display = 'none';
    signedIn.style.display = 'block';
  }

  function showForm() {
    signedIn.style.display = 'none';
    formCard.style.display = 'block';
  }

  document.getElementById('authSignOut').addEventListener('click', function (e) {
    e.target.disabled = true;
    auth.signOut().then(function () { window.location.reload(); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessage();

    var email = emailEl.value.trim();
    var password = passEl.value;

    if (!email || !password) {
      message('Enter both your email address and password.');
      return;
    }

    var profile = null;
    if (mode === 'signup') {
      var fullName = fullNameEl.value.trim();
      var username = usernameEl.value.trim();

      if (fullName.length < 2) {
        message('Enter your full name, as you would write it on a form.');
        fullNameEl.focus();
        return;
      }
      if (!USERNAME_RE.test(username)) {
        message('Pick a username of 3 to 24 characters: letters, numbers, dots, dashes or underscores.');
        usernameEl.focus();
        return;
      }
      if (password.length < 6) {
        message('Passwords need to be at least 6 characters long.');
        return;
      }
      // Checked in the browser and nowhere else, which is the point: the
      // confirmation never leaves this page. It exists so a typo cannot
      // lock somebody out of an account they just created.
      if (confirmEl.value !== password) {
        message('The two passwords do not match. Type the same one twice.');
        confirmEl.focus();
        return;
      }
      profile = { fullName: fullName, username: username };
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';

    var call;
    if (mode === 'signup') {
      call = auth.usernameAvailable(profile.username)
        .catch(function (err) {
          // A courtesy, not a guard: the unique index in the database is
          // what actually stops two people holding one name. If the check
          // is unavailable, carry on and let the database answer.
          console.warn('[MedCare] Could not check the username:', err);
          return true;
        })
        .then(function (free) {
          if (!free) { return { error: { code: 'username_taken' } }; }
          return auth.signUp(email, password, profile);
        });
    } else {
      call = auth.signIn(email, password);
    }

    call.then(function (res) {
      if (res.error) {
        // Supabase resolves with { error } for a bad password or a
        // duplicate signup — it does not throw.
        message(explainAuth(res.error));
        return;
      }

      if (mode === 'signup' && res.data && !res.data.session) {
        // Email confirmation is on: the account exists but there is no
        // session until the emailed link is clicked.
        message('Account created. Check your email for a confirmation link, then sign in.', 'ok');
        setMode('signin');
        return;
      }

      // auth.js reloads the session and role; wait for it so the panel
      // shows the real role rather than a stale one.
      return auth.ready.then(function () {
        var user = auth.getUser();
        if (user) { showSignedIn(user, auth.getRole()); }
      });
    }).catch(function (err) {
      console.error('[MedCare] Auth request failed:', err);
      message('Could not reach the server. Check your connection and try again.');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    });
  });

  // On load: if there is already a session, show the signed-in panel.
  if (!auth) {
    message('Sign-in is unavailable because Supabase is not configured.');
    return;
  }

  auth.onChange(function (user, role) {
    if (user) { showSignedIn(user, role); }
    else { showForm(); }
  });
})();
