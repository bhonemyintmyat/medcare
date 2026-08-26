/* ============================================================
   MedCare — "choose a new password" page
   Loaded only by reset-password.html, after auth.js.

   This is the far end of the recovery link that login.html asks
   Supabase to send. Two jobs, in order:

     1. Turn whatever Supabase put in the address bar into a real
        session — and get it out of the address bar again.
     2. Write the new password against that session.

   Why step 1 is hand-rolled here: supabase.js deliberately creates
   the client with `detectSessionInUrl: false`, so the library will
   NOT go looking for a callback in the URL. That setting is what
   keeps every other page from inspecting its own address bar for a
   redirect that never arrives, and the note in supabase.js explains
   what it cost to get there. Rather than switch it back on for all
   33 pages to serve this one, the one page that really does receive
   a callback reads it itself.
   ============================================================ */

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

  // Whose account the redeemed link turned out to belong to. Taken from
  // the response below rather than from auth.js: its onAuthStateChange
  // listener is not guaranteed to have run by the time we want the name.
  var recoveredUser = null;

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

  /* ---------- reading the link ----------

     Supabase has shipped three shapes of callback over the years and a
     project can be configured into any of them, so all three are read.
     They differ only in where the proof sits:

       #access_token=…&refresh_token=…   the session, already minted
       ?token_hash=…&type=recovery       a one-time code to redeem
       ?code=…                           a PKCE code to exchange

     Failures arrive the same way successes do — as parameters, not as a
     thrown error: #error=access_denied&error_code=otp_expired is what an
     hour-old link looks like. */
  function params() {
    // The hash carries a query string of its own, minus the '#'.
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    var query = new URLSearchParams(window.location.search);
    return {
      get: function (name) { return hash.get(name) || query.get(name); }
    };
  }

  /* Tokens in the address bar end up in browser history, in a shared
     screen, and in the Referer header of anything this page loads next.
     They have done their job the moment they are read, so take them out
     of the URL without adding a history entry. */
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

  // All three redemption calls answer the same shape: { data, error }.
  // Either it failed and the sentence explaining that is the result, or
  // it worked and the account it belongs to is worth keeping.
  function keep(res) {
    if (res.error) { return explainLinkError('invalid', res.error.message); }
    recoveredUser = (res.data && res.data.user) || null;
    return null;
  }

  /* Resolves with an error string to show, or null when a session is in
     place and the form can be shown. */
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

    /* Nothing in the URL at all. Note what deliberately does NOT happen
       here: an existing session is not accepted as permission to set a
       new password. Somebody who is merely signed in — on a borrowed
       laptop, on a session someone else left open — must prove the
       mailbox first, which is exactly what the emailed link is for. */
    return Promise.resolve(
      'Open this page from the link in your recovery email. Reaching it any other way leaves nothing to check.'
    );
  }

  /* ---------- saving the new password ---------- */
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

    if (password.length < 6) {
      message('Passwords need to be at least 6 characters long.');
      passEl.focus();
      return;
    }
    // Checked in the browser and nowhere else, the same as on the signup
    // form: the confirmation never leaves this page. It is here so a typo
    // cannot lock somebody out a second time.
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

  /* ---------- on load ---------- */
  if (!db || !auth) {
    // supabase.js already explained why on the console.
    refuse('Password recovery is unavailable because this site is not connected to its database.');
    return;
  }

  redeemLink().then(function (problem) {
    scrubUrl();
    if (problem) { refuse(problem); return; }

    // Name the account the new password will belong to, so a link opened
    // from the wrong mailbox is obvious before anything is typed.
    whoEl.textContent = (recoveredUser && recoveredUser.email) || '';
    show(formCard);
    passEl.focus();
  }).catch(function (err) {
    console.error('[MedCare] Could not read the recovery link:', err);
    scrubUrl();
    refuse('Could not reach the server to check this link. Check your connection and open the link again.');
  });
})();
