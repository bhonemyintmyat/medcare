/* ============================================================
   MedCare — accepting a staff invitation
   Loaded by accept-invite.html, after auth.js.

   The mirror image of reset-password.js. There, somebody who has an
   account proves the mailbox to set a NEW password; here, somebody who
   has just been GIVEN an account proves the mailbox to set their FIRST
   one. The mechanics are the same — a one-time link in an email becomes
   a short-lived session, and a password is written against it — so this
   reads the link the same three ways, and differs only in wording and
   in what it does once the password is saved.

   The account already exists: the invite-staff Edge Function created it,
   unconfirmed and password-less, and wrote the role the admin chose. So
   there is nothing here about names or roles — they are already on the
   account. The one thing still missing, the password, is the one thing
   only this person can supply.
   ============================================================ */

(function () {
  'use strict';

  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var checking = document.getElementById('inviteChecking');
  var formCard = document.getElementById('inviteFormCard');
  var badCard  = document.getElementById('inviteBadCard');
  var doneCard = document.getElementById('inviteDoneCard');
  var badWhy   = document.getElementById('inviteBadWhy');
  var whoEl    = document.getElementById('inviteWho');
  var doneWho  = document.getElementById('inviteDoneWho');
  var staffLink = document.getElementById('inviteStaffLink');

  var form      = document.getElementById('inviteForm');
  var passEl    = document.getElementById('invitePassword');
  var confirmEl = document.getElementById('inviteConfirm');
  var revealBtn = document.getElementById('inviteReveal');
  var submitBtn = document.getElementById('inviteSubmit');
  var msgEl     = document.getElementById('inviteMsg');

  if (!form) { return; }

  // Whose account the redeemed link turned out to belong to, taken from
  // the response below rather than from auth.js, whose listener is not
  // guaranteed to have run by the time the name is wanted.
  var invitedUser = null;

  /* ---------- one card at a time ---------- */
  function show(card) {
    [checking, formCard, badCard, doneCard].forEach(function (el) {
      el.hidden = el !== card;
    });
  }
  function refuse(why) {
    if (why) { badWhy.textContent = why; }
    show(badCard);
  }
  function message(text) {
    if (!text) { msgEl.style.display = 'none'; msgEl.textContent = ''; return; }
    msgEl.textContent = text;
    msgEl.className = 'mc-auth-msg mc-auth-msg--error';
    msgEl.style.display = 'block';
  }
  function clearMessage() { message(''); }

  /* ---------- show / hide the password ---------- */
  revealBtn.addEventListener('click', function () {
    var shown = passEl.type === 'text';
    passEl.type = shown ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    revealBtn.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
  });

  /* ---------- reading the link ----------
     Same three shapes reset-password.js handles, for the same reason: a
     project can be configured into any of them.

       #access_token=…&refresh_token=…   the session, already minted
       ?token_hash=…&type=invite         a one-time code to redeem
       ?code=…                           a PKCE code to exchange

     Failures arrive as parameters too, not as a thrown error:
     #error=access_denied&error_code=otp_expired is an hour-old link. */
  function params() {
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    var query = new URLSearchParams(window.location.search);
    return { get: function (name) { return hash.get(name) || query.get(name); } };
  }

  // Tokens in the address bar reach history, screen-shares and the
  // Referer header. They have done their job once read, so strip them
  // without adding a history entry.
  function scrubUrl() {
    if (!window.history || !window.history.replaceState) { return; }
    window.history.replaceState(null, '', window.location.pathname);
  }

  function explainLinkError(code, description) {
    if (/expired/i.test(code + ' ' + description)) {
      return 'That invitation link has expired. Links last a while but not for ever — ask the admin who ' +
             'invited you to send a fresh one, and open the newest email.';
    }
    if (/access_denied|invalid/i.test(code)) {
      return 'That invitation link is not valid any more. Each one works only once — ask for a fresh invite.';
    }
    return description || 'That invitation link could not be used. Ask for a fresh invite.';
  }

  function keep(res) {
    if (res.error) { return explainLinkError('invalid', res.error.message); }
    invitedUser = (res.data && res.data.user) || null;
    return null;
  }

  function redeemLink() {
    var p = params();

    var errCode = p.get('error_code') || p.get('error');
    if (errCode) {
      return Promise.resolve(explainLinkError(errCode, p.get('error_description') || ''));
    }

    var accessToken  = p.get('access_token');
    var refreshToken = p.get('refresh_token');
    if (accessToken && refreshToken) {
      return db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(keep);
    }

    var tokenHash = p.get('token_hash') || p.get('token');
    if (tokenHash) {
      return db.auth.verifyOtp({ token_hash: tokenHash, type: p.get('type') || 'invite' }).then(keep);
    }

    var code = p.get('code');
    if (code && typeof db.auth.exchangeCodeForSession === 'function') {
      return db.auth.exchangeCodeForSession(code).then(keep);
    }

    // Nothing in the URL. An existing session is deliberately NOT accepted
    // as permission to claim an invitation — the emailed link is the proof.
    return Promise.resolve(
      'Open this page from the link in your invitation email. Reaching it any other way leaves nothing to check.'
    );
  }

  /* ---------- what to call them, and where they belong ----------
     Both come from the invite itself, carried as user metadata by the
     Edge Function. No profile query, so this does not lean on a read
     policy the invitee may not have yet. */
  function invitedName() {
    var m = (invitedUser && invitedUser.user_metadata) || {};
    return m.display_name || m.full_name || (invitedUser && invitedUser.email) || 'your account';
  }
  function invitedRole() {
    var m = (invitedUser && invitedUser.user_metadata) || {};
    return m.invited_role || null;
  }

  /* ---------- saving the first password ---------- */
  function explainSave(err) {
    var text = String((err && err.message) || '');
    if (/should be at least|at least 6/i.test(text)) {
      return 'Passwords need to be at least 6 characters long.';
    }
    if (/session|jwt|token/i.test(text)) {
      return 'The invitation link expired while this page was open. Ask for a fresh invite.';
    }
    return text || 'The password could not be set. Please try again.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessage();

    var password = passEl.value;
    if (password.length < 6) {
      message('Passwords need to be at least 6 characters long.');
      passEl.focus();
      return;
    }
    // Checked only in the browser, like the signup form: the confirmation
    // never leaves this page. It is here so a typo cannot lock somebody
    // out of an account they have only just been given.
    if (confirmEl.value !== password) {
      message('The two passwords do not match. Type the same one twice.');
      confirmEl.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    auth.updatePassword(password).then(function (res) {
      if (res.error) { message(explainSave(res.error)); return; }

      // Point the staff shortcut at where this role actually lives.
      var role = invitedRole();
      if (role === 'admin' || role === 'editor') {
        staffLink.hidden = false;
        staffLink.href = role === 'admin' ? 'admin.html' : 'editor-dashboard.html';
        staffLink.textContent = role === 'admin' ? 'Open the admin area' : 'Open the editor desk';
      }
      doneWho.textContent = 'Welcome, ' + invitedName() + '. Your account is ready and you are ' +
        'signed in on this device' + (role ? ' as ' + role + '.' : '.');
      show(doneCard);
    }).catch(function (err) {
      console.error('[MedCare] Could not set the password:', err);
      message('Could not reach the server. Check your connection and try again.');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Set password and sign in';
    });
  });

  /* ---------- on load ---------- */
  if (!db || !auth) {
    refuse('Accepting invitations is unavailable because this site is not connected to its database.');
    return;
  }

  redeemLink().then(function (problem) {
    scrubUrl();
    if (problem) { refuse(problem); return; }

    // Name the account this password will belong to, so a link opened
    // from the wrong mailbox is obvious before anything is typed.
    var role = invitedRole();
    whoEl.textContent = 'For ' + invitedName() +
      ((invitedUser && invitedUser.email) ? ' · ' + invitedUser.email : '') +
      (role ? ' · invited as ' + role : '');
    show(formCard);
    passEl.focus();
  }).catch(function (err) {
    console.error('[MedCare] Could not read the invitation link:', err);
    scrubUrl();
    refuse('Could not reach the server to check this invitation. Check your connection and open the link again.');
  });
})();
