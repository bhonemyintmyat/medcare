

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


  var invitedUser = null;

  
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

  
  revealBtn.addEventListener('click', function () {
    var shown = passEl.type === 'text';
    passEl.type = shown ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    revealBtn.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
  });

  
  function params() {
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    var query = new URLSearchParams(window.location.search);
    return { get: function (name) { return hash.get(name) || query.get(name); } };
  }


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


    return Promise.resolve(
      'Open this page from the link in your invitation email. Reaching it any other way leaves nothing to check.'
    );
  }

  
  function invitedName() {
    var m = (invitedUser && invitedUser.user_metadata) || {};
    return m.display_name || m.full_name || (invitedUser && invitedUser.email) || 'your account';
  }
  function invitedRole() {
    var m = (invitedUser && invitedUser.user_metadata) || {};
    return m.invited_role || null;
  }

  
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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    auth.updatePassword(password).then(function (res) {
      if (res.error) { message(explainSave(res.error)); return; }


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

  
  if (!db || !auth) {
    refuse('Accepting invitations is unavailable because this site is not connected to its database.');
    return;
  }

  redeemLink().then(function (problem) {
    scrubUrl();
    if (problem) { refuse(problem); return; }


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
