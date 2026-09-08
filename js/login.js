

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
  var forgotBtn  = document.getElementById('authForgot');
  var backBtn    = document.getElementById('authRecoverBack');
  var passWrap   = document.getElementById('fieldPassword');


  var fullNameEl = document.getElementById('authFullName');
  var displayEl  = document.getElementById('authDisplayName');
  var confirmEl  = document.getElementById('authConfirm');
  var signupOnly  = document.querySelectorAll('.mc-signup-only');
  var signinOnly  = document.querySelectorAll('.mc-signin-only');
  var recoverOnly = document.querySelectorAll('.mc-recover-only');


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


  function explainAuth(err) {
    var text = String((err && err.message) || '');
    if (/profiles_display_name_len/i.test(text)) {
      return 'Display names stop at 60 characters.';
    }
    if (/email.not.confirmed/i.test(text)) {
      return 'Your email address has not been confirmed yet. Open the link in the confirmation email we sent you, then sign in.';
    }
    if (/Database error saving new user/i.test(text)) {
      return 'The account could not be created. Please try again.';
    }
    if (/rate limit|only request this after|too many requests/i.test(text)) {
      if (mode === 'signup') {
        return 'Too many signup attempts. Wait a few minutes before trying again. If you already created an account, check your email for a confirmation link and sign in instead.';
      }
      if (mode === 'recover') {
        return 'A recovery link was requested very recently. Wait a minute, then try again.';
      }
      return 'Too many attempts. Wait a minute, then try again.';
    }
    
    if (/error sending|unexpected_failure/i.test(text)) {
      return 'The recovery email could not be sent. That is a fault on our side, not yours — please try again shortly.';
    }
    return text || 'That did not work. Please try again.';
  }


  function submitLabel() {
    if (mode === 'recover') { return 'Send a recovery link'; }
    return mode === 'signup' ? 'Create account' : 'Sign in';
  }

  function setMode(next) {
    mode = next;
    var up = mode === 'signup';
    var recover = mode === 'recover';


    tabIn.classList.toggle('is-active', mode === 'signin');
    tabUp.classList.toggle('is-active', up);
    tabIn.setAttribute('aria-selected', String(mode === 'signin'));
    tabUp.setAttribute('aria-selected', String(up));

    submitBtn.textContent = submitLabel();
    hintEl.textContent = recover
      ? 'Enter the address on your account. We will email a link that lets you pick a new password. It works once, and it expires within the hour.'
      : up
        ? 'Pick a password: ' + auth.PASSWORD_HINT + ' Your account starts with the "user" role.'
        : 'Use the email and password you signed up with.';

    passEl.setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    passEl.setAttribute('placeholder', up ? 'At least 8 characters' : 'Your password');
    
    if (up) { passEl.setAttribute('minlength', String(auth.PASSWORD_MIN)); }
    else    { passEl.removeAttribute('minlength'); }

    passEl.required = !recover;
    passWrap.hidden = recover;

    Array.prototype.forEach.call(signupOnly, function (el) { el.hidden = !up; });
    Array.prototype.forEach.call(signinOnly, function (el) { el.hidden = mode !== 'signin'; });
    Array.prototype.forEach.call(recoverOnly, function (el) { el.hidden = !recover; });
    clearMessage();
  }

  tabIn.addEventListener('click', function () { setMode('signin'); });
  tabUp.addEventListener('click', function () { setMode('signup'); });
  forgotBtn.addEventListener('click', function () { setMode('recover'); emailEl.focus(); });
  backBtn.addEventListener('click', function () { setMode('signin'); emailEl.focus(); });

  revealBtn.addEventListener('click', function () {
    var shown = passEl.type === 'text';
    passEl.type = shown ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    revealBtn.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
  });

  function showSignedIn(user, role) {

    whoEmail.textContent = auth.displayName();
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

    
    if (mode === 'recover') {
      if (!email) {
        message('Enter the email address on your account.');
        emailEl.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      auth.sendRecovery(email).then(function (res) {
        if (res.error) { message(explainAuth(res.error)); return; }
        
        message('If that address has an account, a recovery link is on its way. Open it and you can choose a new password.', 'ok');
      }).catch(function (err) {
        console.error('[MedCare] Recovery request failed:', err);
        message('Could not reach the server. Check your connection and try again.');
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel();
      });
      return;
    }

    if (!email || !password) {
      message('Enter both your email address and password.');
      return;
    }

    var profile = null;
    if (mode === 'signup') {
      var fullName = fullNameEl.value.trim();
      var displayName = displayEl.value.trim();

      if (fullName.length < 2) {
        message('Enter your full name, as you would write it on a form.');
        fullNameEl.focus();
        return;
      }

      if (!displayName) {
        message('Enter the name you would like to be called.');
        displayEl.focus();
        return;
      }
      var problem = auth.passwordProblem(password);
      if (problem) {
        message(problem);
        passEl.focus();
        return;
      }

      if (confirmEl.value !== password) {
        message('The two passwords do not match. Type the same one twice.');
        confirmEl.focus();
        return;
      }
      profile = { fullName: fullName, displayName: displayName };
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';


    var call = mode === 'signup'
      ? auth.signUp(email, password, profile)
      : auth.signIn(email, password);

    call.then(function (res) {
      if (res.error) {

        message(explainAuth(res.error));
        return;
      }

      if (mode === 'signup' && res.data && !res.data.session) {

        message('Account created. Check your email for a confirmation link, then sign in.', 'ok');
        setMode('signin');
        return;
      }


      return auth.ready.then(function () {
        var user = auth.getUser();
        if (user) { showSignedIn(user, auth.getRole()); }
      });
    }).catch(function (err) {
      console.error('[MedCare] Auth request failed:', err);
      message('Could not reach the server. Check your connection and try again.');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel();
    });
  });


  if (!auth) {
    message('Sign-in is unavailable because Supabase is not configured.');
    return;
  }

  
  (function announceDeletion() {
    if (!auth.takeDeletionNotice) { return; }
    var name = auth.takeDeletionNotice();
    if (!name) { return; }

    showForm();
    setMode('signin');
    message(
      (name === '1' ? 'Your account' : '“' + name + '”') +
      ' has been deleted. MedCare no longer holds your email address, your ' +
      'password or your saved items, and nothing here can bring the account ' +
      'back. You are welcome to read the site without one, or to create a new one.',
      'ok'
    );
  })();

  auth.onChange(function (user, role) {
    if (user) { showSignedIn(user, role); }
    else { showForm(); }
  });
})();
