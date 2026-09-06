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
  var forgotBtn  = document.getElementById('authForgot');
  var backBtn    = document.getElementById('authRecoverBack');
  var passWrap   = document.getElementById('fieldPassword');

  // Signup-only: a real name, a name to be called by, and the password
  // a second time.
  var fullNameEl = document.getElementById('authFullName');
  var displayEl  = document.getElementById('authDisplayName');
  var confirmEl  = document.getElementById('authConfirm');
  var signupOnly  = document.querySelectorAll('.mc-signup-only');
  var signinOnly  = document.querySelectorAll('.mc-signin-only');
  var recoverOnly = document.querySelectorAll('.mc-recover-only');

  // 'signin' | 'signup' | 'recover'. The third is this same form asking
  // for one thing only: the address to send a recovery link to.
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
    /* A 500 from /recover: Supabase found the account, minted the token,
       and then could not post the letter. In the auth log it reads
       `535 "Authentication credentials invalid"` — the mail server
       rejecting the project's SMTP username and password. Whatever the
       cause, it is ours and not theirs, and the raw server sentence is
       no help to somebody who just wants back into their account. */
    if (/error sending|unexpected_failure/i.test(text)) {
      return 'The recovery email could not be sent. That is a fault on our side, not yours — please try again shortly.';
    }
    return text || 'That did not work. Please try again.';
  }

  // Written once because three places need the same three words: both
  // ends of setMode, and putting the label back after a request finishes.
  function submitLabel() {
    if (mode === 'recover') { return 'Send a recovery link'; }
    return mode === 'signup' ? 'Create account' : 'Sign in';
  }

  function setMode(next) {
    mode = next;
    var up = mode === 'signup';
    var recover = mode === 'recover';

    // In recovery mode NEITHER tab is current: the form has stopped being
    // either of the two things they name.
    tabIn.classList.toggle('is-active', mode === 'signin');
    tabUp.classList.toggle('is-active', up);
    tabIn.setAttribute('aria-selected', String(mode === 'signin'));
    tabUp.setAttribute('aria-selected', String(up));

    submitBtn.textContent = submitLabel();
    hintEl.textContent = recover
      ? 'Enter the address on your account. We will email a link that lets you pick a new password. It works once, and it expires within the hour.'
      : up
        ? 'Pick a password of at least 6 characters. Your account starts with the "user" role.'
        : 'Use the email and password you signed up with.';

    passEl.setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    passEl.setAttribute('placeholder', up ? 'At least 6 characters' : 'Your password');
    // Not merely hidden. A hidden field that is still `required` is what
    // makes a form refuse to submit with nothing on screen to fix.
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
    // Their display name, if they have one — the site shows that in
    // place of the email everywhere else, and this panel is no exception.
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

    /* Recovery asks for one field and leaves by its own door. Nothing
       below this block applies to it: no password to check, no profile
       to build, and no session at the end of it — only an email on its
       way to a mailbox we are not told exists. */
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
        /* The same sentence whether or not that address has an account.
           "No account with that email" would turn this form into a way
           of asking whether a named person uses a health site — the
           note in auth.js has the longer version. */
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
      // A display name has no shape to get wrong — any script, spaces and
      // punctuation included. It just cannot be nothing.
      if (!displayName) {
        message('Enter the name you would like to be called.');
        displayEl.focus();
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
      profile = { fullName: fullName, displayName: displayName };
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';

    // Display names are not unique, so there is nothing to check first.
    var call = mode === 'signup'
      ? auth.signUp(email, password, profile)
      : auth.signIn(email, password);

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
      submitBtn.textContent = submitLabel();
    });
  });

  // On load: if there is already a session, show the signed-in panel.
  if (!auth) {
    message('Sign-in is unavailable because Supabase is not configured.');
    return;
  }

  /* ---------- Arriving here straight from a deletion ----------
     Somebody who has just closed their account is sent to this page,
     from whichever part of the site they were on. It is the right
     landing spot for an odd reason: it is also the create-account page,
     so it is the one screen that can tell them their account is gone
     and, in the same breath, offer them a new one without pretending
     the old one might come back.

     The notice is taken from the tab rather than from the URL — see
     DELETED_FLAG_KEY in auth.js — and taking it clears it, so a reload
     is not a second announcement. It is read BEFORE the session check
     below, because that check will run showForm() and clear the
     message strip on its way past. */
  (function announceDeletion() {
    if (!auth.takeDeletionNotice) { return; }   // older auth.js
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
