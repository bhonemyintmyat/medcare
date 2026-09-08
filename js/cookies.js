(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };

  if (!el('setLang')) { return; }

  function bi(en, my) {
    return '<span class="mc-en">' + en + '</span><span class="mc-my">' + my + '</span>';
  }

  function state(node, on, en, my) {
    if (!node) { return; }
    node.innerHTML = bi(en, my);
    node.className = 'mc-setting-state ' + (on ? 'on' : 'off');
  }

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function drop(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  var LANG_KEY  = 'mc-lang';
  var langState = el('langState');
  var langClear = el('langClear');

  function syncLang() {
    var v = read(LANG_KEY);
    if (v === 'my') {
      state(langState, true, 'Stored — Burmese', 'သိမ်းထားသည် — မြန်မာ');
    } else if (v === 'en') {
      state(langState, true, 'Stored — English', 'သိမ်းထားသည် — အင်္ဂလိပ်');
    } else {
      state(langState, false, 'Not stored', 'မသိမ်းထားပါ');
    }
    if (langClear) { langClear.disabled = !v; }
  }

  if (langClear) {
    langClear.addEventListener('click', function () {
      drop(LANG_KEY);
      syncLang();
    });
  }
  syncLang();

  var bar = document.querySelector('.mc-langbar');
  if (bar) { bar.addEventListener('click', function () { setTimeout(syncLang, 0); }); }

  var sessState = el('sessState');
  var sessOut   = el('sessOut');
  var auth      = window.MedCareAuth;

  if (!auth) {

    state(sessState, false, 'Cannot check — sign-in is unavailable',
                            'စစ်ဆေး၍ မရပါ — အကောင့်ဝင်ခြင်း မရနိုင်ပါ');
    if (sessOut) { sessOut.disabled = true; }
    return;
  }

  function syncSession(user) {
    if (user) {
      state(sessState, true, 'Stored — signed in as ' + auth.displayName(),
                             'သိမ်းထားသည် — ဝင်ရောက်ထားသူ ' + auth.displayName());
    } else {
      state(sessState, false, 'Not stored — you are signed out',
                              'မသိမ်းထားပါ — ထွက်ထားသည်');
    }
    if (sessOut) { sessOut.disabled = !user; }
  }

  auth.onChange(function (user) { syncSession(user); });

  if (sessOut) {
    sessOut.addEventListener('click', function () {
      sessOut.disabled = true;
      auth.signOut().then(function () {

      })['catch'](function () {
        syncSession(auth.getUser());
      });
    });
  }
})();
