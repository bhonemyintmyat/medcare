/* ============================================================
   MedCare — your profile
   Loaded by admin/profile.html, after admin-guard.js, admin-shell.js
   and admin-api.js.

   Three things, and the dashboard card names all three: your display
   name, your language, and your password. Nothing on this screen is
   about anybody else — there is no id on any call below, because every
   one of them takes the account from the verified session and could not
   be pointed at a second account if it tried.

   WHAT IS NOT HERE, AND WHY

   Your role. It is shown, and it cannot be changed from here by anyone,
   including an admin looking at their own row: supabase_admin_scope.sql
   refuses a self-change at the database, so a control for it would be a
   button whose only outcome is an error. admin/users.html is where one
   admin changes another's role.

   Your email address. Changing it means proving the new one, which is a
   confirmation mail and a second screen to land on, and this screen
   would be claiming to do something it only half does.

   Deleting your account. auth.js has it and the public account menu
   offers it. An admin deleting themselves from the admin area — possibly
   the last admin, which delete_own_account() refuses anyway — is not a
   thing this screen should make convenient.

   THE PASSWORD IS CHECKED BEFORE IT IS CHANGED

   Supabase's updateUser({ password }) does not ask for the old one: it
   trusts the session. That is a reasonable default and the wrong one for
   a screen left open on a shared desk, so the current password is
   verified first by signing in with it. Same account, same session, and
   a wrong answer stops before anything is written.

   That is the rule delete_own_account() already applies to the most
   destructive action here, and a password change is the one that hands
   somebody else the account permanently.
   ============================================================ */

(function () {
  'use strict';

  var ad   = window.MedCareAdmin;
  var auth = window.MedCareAuth;
  if (!ad || !auth || !document.getElementById('pfName')) { return; }

  var el = function (id) { return document.getElementById(id); };

  var msgEl     = el('pfMsg');
  var emailEl   = el('pfEmail');
  var roleEl    = el('pfRole');
  var joinedEl  = el('pfJoined');

  var nameEl    = el('pfName');
  var nameSave  = el('pfNameSave');
  var nameHint  = el('pfNameHint');

  var langState = el('pfLangState');
  var langEn    = el('pfLangEn');
  var langMy    = el('pfLangMy');
  var langClear = el('pfLangClear');

  var pwCurrent = el('pfPwCurrent');
  var pwNew     = el('pfPwNew');
  var pwConfirm = el('pfPwConfirm');
  var pwSave    = el('pfPwSave');
  var pwMsg     = el('pfPwMsg');

  var MIN_PASSWORD = 6;      // the same floor login.html sets on signup

  /* ---------- Who you are ---------- */

  function paint(user, role) {
    if (!user) { return; }
    emailEl.textContent  = user.email || '—';
    roleEl.innerHTML     = ad.rolePill(role || 'user');
    joinedEl.textContent = user.created_at ? ad.whenExact(user.created_at) : '—';

    /* Only fill the box when it is not being typed in. onChange fires on
       every token refresh, and a name half-typed when one lands should
       not be replaced by the stored one. */
    if (document.activeElement !== nameEl) {
      nameEl.value = auth.displayName() || '';
    }
  }

  auth.onChange(function (user, role) { paint(user, role); });

  /* ---------- Display name ---------- */

  nameSave.addEventListener('click', function () {
    var name = (nameEl.value || '').trim();

    if (!name) {
      ad.message(msgEl, 'error', 'A display name cannot be empty. Clear it from the account menu if you would rather not have one.');
      return;
    }

    nameSave.disabled = true;
    ad.message(msgEl, null, '');

    auth.setDisplayName(name).then(function (res) {
      if (res && res.error) { throw res.error; }
      nameSave.disabled = false;
      if (nameHint) { nameHint.textContent = 'Saved. This is what the editors see on anything you touch.'; }
      ad.message(msgEl, 'ok', 'Display name saved.');
    })['catch'](function (err) {
      nameSave.disabled = false;
      ad.message(msgEl, 'error', ad.describeError(err, 'your display name'));
    });
  });

  /* ---------- Language ---------- */

  /* The same key script.js writes, read and cleared the same way
     cookies.js does it on the public side. It is a browser setting rather
     than an account one: it lives on this device and follows nobody
     between machines, and the card says so rather than letting an admin
     assume their phone will match. */

  var LANG_KEY = 'mc-lang';

  function readLang() {
    try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; }
  }

  function syncLang() {
    var v = readLang();
    langState.textContent = v === 'my' ? 'Burmese, on this device'
                          : v === 'en' ? 'English, on this device'
                          : 'Not set — the site opens in English';
    langState.className = 'mc-setting-state ' + (v ? 'on' : 'off');
    if (langClear) { langClear.disabled = !v; }
  }

  function setLang(lang) {
    /* Going through the language bar rather than writing the key here:
       that is the control that also re-renders the page, and two places
       that set a language is how they come to disagree. */
    var btn = document.querySelector('.mc-langbar .mc-lang-btn[data-lang="' + lang + '"]');
    if (btn) { btn.click(); }
    setTimeout(syncLang, 0);
  }

  if (langEn) { langEn.addEventListener('click', function () { setLang('en'); }); }
  if (langMy) { langMy.addEventListener('click', function () { setLang('my'); }); }
  if (langClear) {
    langClear.addEventListener('click', function () {
      try { localStorage.removeItem(LANG_KEY); } catch (e) { /* nothing to remove */ }
      syncLang();
    });
  }
  syncLang();

  /* ---------- Password ---------- */

  function pwProblem(current, next, confirm) {
    if (!current)                  { return 'Type your current password first.'; }
    if (!next)                     { return 'Type the new password.'; }
    if (next.length < MIN_PASSWORD){ return 'The new password has to be at least ' + MIN_PASSWORD + ' characters.'; }
    if (next !== confirm)          { return 'The two new passwords are different.'; }
    if (next === current)          { return 'That is the password you already have.'; }
    return null;
  }

  pwSave.addEventListener('click', function () {
    var current = pwCurrent.value || '';
    var next    = pwNew.value || '';
    var confirm = pwConfirm.value || '';

    var problem = pwProblem(current, next, confirm);
    if (problem) { ad.message(pwMsg, 'error', problem); return; }

    var user = auth.getUser();
    if (!user || !user.email) {
      ad.message(pwMsg, 'error', 'Your session has expired. Sign in again.');
      return;
    }

    pwSave.disabled = true;
    ad.message(pwMsg, null, '');

    /* Step one: prove the current password. signIn resolves with
       { error } for a wrong one rather than throwing, so the check is on
       the value and not in a catch. */
    auth.signIn(user.email, current).then(function (res) {
      if (res && res.error) {
        throw { code: 'wrong_password',
                message: 'That is not your current password.' };
      }
      return auth.updatePassword(next);
    }).then(function (res) {
      if (res && res.error) { throw res.error; }

      pwCurrent.value = ''; pwNew.value = ''; pwConfirm.value = '';
      pwSave.disabled = false;
      ad.message(pwMsg, 'ok',
        'Password changed. This browser stays signed in; anywhere else ' +
        'signed in as you will need the new one.');
    })['catch'](function (err) {
      pwSave.disabled = false;
      ad.message(pwMsg, 'error',
        err && err.code === 'wrong_password'
          ? err.message
          : ad.describeError(err, 'your password'));
    });
  });

  /* Enter anywhere in the password fields submits it, because three
     boxes and a button is a form in everything but name. */
  [pwCurrent, pwNew, pwConfirm].forEach(function (box) {
    if (!box) { return; }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); pwSave.click(); }
    });
  });
})();
