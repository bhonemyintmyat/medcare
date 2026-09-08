

(function () {
  'use strict';

  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var checking = document.getElementById('resetChecking');
  var formCard = document.getElementById('resetFormCard');
  var badCard  = document.getElementById('resetBadCard');
  var doneCard = document.getElementById('resetDoneCard');
  var badWhy   = document.getElementById('resetBadWhy');
  var whoEl    = document.getElementById('resetWho');

  var form      = document.getElementById('resetForm');
  var passEl    = document.getElementById('resetPassword');
  var confirmEl = document.getElementById('resetConfirm');
  var revealBtn = document.getElementById('resetReveal');
  var submitBtn = document.getElementById('resetSubmit');
  var msgEl     = document.getElementById('resetMsg');

  if (!form) { return; }


  var recoveredUser = null;

  
  function show(card) {
    [checking, formCard, badCard, doneCard].forEach(function (el) {
      el.hidden = el !== card;
    });
  }

  function refuse(why) {
    if (why) { badWhy.textContent = why; }
    show(badCard);
  }

  function message(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'mc-auth-msg mc-auth-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
  }
  function clearMessage() {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }

  revealBtn.addEventListener('click', function () {
    var shown = passEl.type === 'text';
    passEl.type = shown ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    revealBtn.innerHTML = shown ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
  });

  
  function params() {

    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    var query = new URLSearchParams(window.location.search);
    return {
      get: function (name) { return hash.get(name) || query.get(name); }
    };
  }

  
  function scrubUrl() {
    if (!window.history || !window.history.replaceState) { return; }
    window.history.replaceState(null, '', window.location.pathname);
  }

  function explainLinkError(code, description) {
    if (/expired/i.test(code + ' ' + description)) {
      return 'That recovery link has expired. Links last about an hour — ask for a new one and open the newest email.';
    }
    if (/access_denied|invalid/i.test(code)) {
      return 'That recovery link is not valid any more. Each one works only once, so ask for a fresh link.';
    }
    return description || 'That recovery link could not be used. Ask for a fresh one.';
  }


  function keep(res) {
    if (res.error) { return explainLinkError('invalid', res.error.message); }
    recoveredUser = (res.data && res.data.user) || null;
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
      return db.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(keep);
    }

    var tokenHash = p.get('token_hash') || p.get('token');
    if (tokenHash) {
      return db.auth
        .verifyOtp({ token_hash: tokenHash, type: p.get('type') || 'recovery' })
        .then(keep);
    }

    var code = p.get('code');
    if (code && typeof db.auth.exchangeCodeForSession === 'function') {
      return db.auth.exchangeCodeForSession(code).then(keep);
    }

    
    return Promise.resolve(
      'Open this page from the link in your recovery email. Reaching it any other way leaves nothing to check.'
    );
  }

  
  function explainSave(err) {
    var text = String((err && err.message) || '');
    if (/should be at least|at least 6/i.test(text)) {
      return 'Passwords need to be at least 6 characters long.';
    }
    if (/should be different|same as the old/i.test(text)) {
      return 'That is the password you already had. Choose a different one.';
    }
    if (/session|jwt|token/i.test(text)) {
      return 'The recovery link has expired while this page was open. Ask for a new one.';
    }
    return text || 'The password could not be changed. Please try again.';
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
      if (res.error) {
        message(explainSave(res.error));
        return;
      }
      show(doneCard);
    }).catch(function (err) {
      console.error('[MedCare] Password change failed:', err);
      message('Could not reach the server. Check your connection and try again.');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save new password';
    });
  });

  
  if (!db || !auth) {

    refuse('Password recovery is unavailable because this site is not connected to its database.');
    return;
  }

  redeemLink().then(function (problem) {
    scrubUrl();
    if (problem) { refuse(problem); return; }


    whoEl.textContent = (recoveredUser && recoveredUser.email) || '';
    show(formCard);
    passEl.focus();
  }).catch(function (err) {
    console.error('[MedCare] Could not read the recovery link:', err);
    scrubUrl();
    refuse('Could not reach the server to check this link. Check your connection and open the link again.');
  });
})();
