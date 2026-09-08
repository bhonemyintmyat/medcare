

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



  

  function paint(user, role) {
    if (!user) { return; }
    emailEl.textContent  = user.email || '—';
    roleEl.innerHTML     = ad.rolePill(role || 'user');
    joinedEl.textContent = user.created_at ? ad.whenExact(user.created_at) : '—';

    
    if (document.activeElement !== nameEl) {
      nameEl.value = auth.displayName() || '';
    }
  }

  auth.onChange(function (user, role) { paint(user, role); });

  

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
    
    var btn = document.querySelector('.mc-langbar .mc-lang-btn[data-lang="' + lang + '"]');
    if (btn) { btn.click(); }
    setTimeout(syncLang, 0);
  }

  if (langEn) { langEn.addEventListener('click', function () { setLang('en'); }); }
  if (langMy) { langMy.addEventListener('click', function () { setLang('my'); }); }
  if (langClear) {
    langClear.addEventListener('click', function () {
      try { localStorage.removeItem(LANG_KEY); } catch (e) {  }
      syncLang();
    });
  }
  syncLang();

  

  function pwProblem(current, next, confirm) {
    if (!current)                  { return 'Type your current password first.'; }
    if (!next)                     { return 'Type the new password.'; }
    var problem = auth.passwordProblem(next);
    if (problem)                   { return problem; }
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

  
  [pwCurrent, pwNew, pwConfirm].forEach(function (box) {
    if (!box) { return; }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); pwSave.click(); }
    });
  });
})();
