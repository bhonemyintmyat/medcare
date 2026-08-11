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
    if (mode === 'signup' && password.length < 6) {
      message('Passwords need to be at least 6 characters long.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';

    var call = mode === 'signup' ? auth.signUp(email, password) : auth.signIn(email, password);

    call.then(function (res) {
      if (res.error) {
        // Supabase resolves with { error } for a bad password or a
        // duplicate signup — it does not throw.
        message(res.error.message || 'That did not work. Please try again.');
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
