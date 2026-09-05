/* ============================================================
   MedCare — Cookie Settings page
   ------------------------------------------------------------
   Drives the two cards on cookies.html. Each one reports what is
   actually on the device right now and offers the control that
   removes it. Nothing here is decorative: if a card says a thing
   is stored, reading it back is how the label was produced.

   The page names its own storage keys in the prose, so the keys
   are read here from one place and nowhere else.
   ============================================================ */

(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };

  /* Bail out politely on any page that is not cookies.html. */
  if (!el('setLang')) { return; }

  /* Both languages ship in the markup and CSS reveals the one
     html[lang] selects — same helper the other page scripts use. */
  function bi(en, my) {
    return '<span class="mc-en">' + en + '</span><span class="mc-my">' + my + '</span>';
  }

  function state(node, on, en, my) {
    if (!node) { return; }
    node.innerHTML = bi(en, my);
    node.className = 'mc-setting-state ' + (on ? 'on' : 'off');
  }

  /* localStorage throws rather than returns null in a locked-down
     browser (Safari private mode, "block all cookies"). Treating a
     throw as "nothing stored" is right on both counts: we cannot
     read it, and we could not have written it either. */
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function drop(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  /* ---------- 1. Language preference ---------- */

  var LANG_KEY  = 'mc-lang';          // written by script.js, on an explicit choice only
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

  /* The language bar is on this page too. Clicking it writes the key
     straight back, so the card has to follow along or it would sit
     there claiming "Not stored" over a setting that just returned. */
  var bar = document.querySelector('.mc-langbar');
  if (bar) { bar.addEventListener('click', function () { setTimeout(syncLang, 0); }); }

  /* ---------- 2. Signed-in session ---------- */

  var sessState = el('sessState');
  var sessOut   = el('sessOut');
  var auth      = window.MedCareAuth;

  if (!auth) {
    /* auth.js missing or Supabase unconfigured. Say so rather than
       leaving "Checking…" on screen for ever. */
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

  /* onChange fires immediately if the first session check already
     finished, and again on every sign-in and sign-out — so this one
     line covers load, and both directions afterwards. */
  auth.onChange(function (user) { syncSession(user); });

  if (sessOut) {
    sessOut.addEventListener('click', function () {
      sessOut.disabled = true;
      auth.signOut().then(function () {
        /* onChange repaints the card. Nothing to do here but let it. */
      })['catch'](function () {
        syncSession(auth.getUser());
      });
    });
  }
})();
