(function () {
  'use strict';

  var db   = window.supabaseClient;
  var auth = window.MedCareAuth;
  var page = window.MedCarePageTarget;
  if (!db || !page) { return; }

  var CATEGORIES = [
    { value: 'inaccuracy',  label: 'Medical inaccuracy',
      hint: 'A fact, dose, symptom or piece of advice looks wrong.' },
    { value: 'typo',        label: 'Typo',
      hint: 'A spelling, grammar or formatting mistake.' },
    { value: 'broken_link', label: 'Broken link',
      hint: 'A link goes nowhere, or to the wrong place.' },
    { value: 'other',       label: 'Other',
      hint: 'Something else about this page.' }
  ];

  var MIN_REASON = 10;
  var MAX_REASON = 2000;

  var target   = null;
  var existing = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  page.ready.then(function (t) {
    if (!t) { return; }
    target = { targetType: t.kind, id: t.id, title: t.title };
    mount();
  });

  function mount() {
    if (document.getElementById('reportOpen')) { return; }

    var anchor = document.querySelector('.mc-sources') ||
                 document.querySelector('.mc-detail-body .container');
    if (!anchor) { return; }

    var wrap = document.createElement('div');
    wrap.className = 'mc-report';
    wrap.innerHTML =
      '<div class="mc-report-text">' +
        '<strong>Spotted something wrong?</strong> ' +
        'Tell our editorial team and they will check it.' +
      '</div>' +
      '<button type="button" class="mc-report-btn" id="reportOpen">' +
        '<i class="bi bi-flag"></i> Report Error</button>';

    if (anchor.classList.contains('mc-sources')) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      anchor.appendChild(wrap);
    }
    document.getElementById('reportOpen').addEventListener('click', open);
  }

  var modal = null;
  var lastFocus = null;

  function isOpen() { return !!modal && modal.classList.contains('is-open'); }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'mc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'reportTitle');
    modal.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Close">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div id="reportBody"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) { return; }
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') { keepFocusInside(e); }
    });
  }

  function keepFocusInside(e) {
    var focusable = modal.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) { return; }
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function open() {
    if (!modal) { buildModal(); }
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderSignedOut();
    auth.ready.then(function () {
      if (!auth.isSignedIn()) { renderSignedOut(); return; }
      checkExisting().then(renderForm);
    });
  }

  function close() {
    if (!modal) { return; }
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function body() { return document.getElementById('reportBody'); }

  function renderSignedOut() {

    var loginHref = window.location.pathname.indexOf('/diseases/') !== -1
      ? '../login.html' : 'login.html';

    body().innerHTML =
      '<div class="mc-modal-ico mc-modal-ico--muted"><i class="bi bi-person-lock"></i></div>' +
      '<h2 id="reportTitle">Please log in to report</h2>' +
      '<p class="mc-modal-sub">Reports are linked to an account so our editors ' +
        'can follow up. Signing in takes a moment.</p>' +
      '<div class="mc-modal-actions">' +
        '<a class="mc-auth-btn" href="' + esc(loginHref) + '">Sign in</a>' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Not now</button>' +
      '</div>';
  }

  function checkExisting() {
    existing = null;
    return db.from('reports')
      .select('id,status,category,created_at')
      .eq('target_type', target.targetType)
      .eq('target_id', target.id)
      .order('id', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (!res.error && res.data && res.data.length) { existing = res.data[0]; }
      })
      .catch(function () {  });
  }

  function categoryLabel(value) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].value === value) { return CATEGORIES[i].label; }
    }
    return 'Other';
  }

  function renderForm() {
    if (existing) {

      var stateLine =
        existing.status === 'resolved'  ? 'been <strong>resolved</strong> by our editors.' :
        existing.status === 'dismissed' ? 'been reviewed, and our editors did not find a change was needed.' :
                                          'not been reviewed yet.';
      body().innerHTML =
        '<div class="mc-modal-ico mc-modal-ico--ok"><i class="bi bi-check2-circle"></i></div>' +
        '<h2 id="reportTitle">You already reported this</h2>' +
        '<p class="mc-modal-sub">Your report about <strong>' + esc(target.title) + '</strong> ' +
          '(' + esc(categoryLabel(existing.category)) + ') has ' + stateLine +
        '</p>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn" data-close>Close</button>' +
        '</div>';
      return;
    }

    var titleField =
      '<label class="mc-auth-label" for="reportItem">' +
        (target.targetType === 'disease' ? 'Disease' : 'Article') +
      '</label>' +
      '<div class="mc-auth-field mc-auth-field--static">' +
        '<i class="bi ' + (target.targetType === 'disease' ? 'bi-virus' : 'bi-journal-text') + '"></i>' +
        '<input id="reportItem" type="text" readonly ' +
          'value="' + esc(target.title) + '">' +
      '</div>';

    var options = CATEGORIES.map(function (c, i) {
      return '<label class="mc-radio">' +
        '<input type="radio" name="reportCategory" value="' + esc(c.value) + '"' +
          (i === 0 ? ' checked' : '') + '>' +
        '<span class="mc-radio-mark" aria-hidden="true"></span>' +
        '<span class="mc-radio-text">' +
          '<span class="mc-radio-label">' + esc(c.label) + '</span>' +
          '<span class="mc-radio-hint">' + esc(c.hint) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    body().innerHTML =
      '<h2 id="reportTitle">Report Error</h2>' +
      '<p class="mc-modal-sub">Tell our medical editorial team what looks wrong. ' +
        'The more specific you can be, the faster they can check it.</p>' +
      '<form id="reportForm" novalidate>' +
        titleField +
        '<fieldset class="mc-radio-group">' +
          '<legend class="mc-auth-label">What kind of problem is it?</legend>' +
          options +
        '</fieldset>' +
        '<label class="mc-auth-label" for="reportReason">Description</label>' +
        '<div class="mc-auth-field">' +
          '<textarea id="reportReason" rows="5" required ' +
            'minlength="' + MIN_REASON + '" maxlength="' + MAX_REASON + '" ' +
            'placeholder="Describe what is wrong, and what it should say if you know."></textarea>' +
        '</div>' +
        '<div class="mc-modal-msg" id="reportMsg" role="status" aria-live="polite" style="display:none"></div>' +
        '<div class="mc-modal-actions">' +
          '<button type="submit" class="mc-auth-btn" id="reportSubmit">Submit</button>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
        '</div>' +
      '</form>';

    var form = document.getElementById('reportForm');

    document.getElementById('reportReason').focus();
    form.addEventListener('submit', submit);
  }

  function message(text, kind) {
    var el = document.getElementById('reportMsg');
    if (!el) { return; }
    el.textContent = text;
    el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
    el.style.display = 'block';
  }

  function submit(e) {
    e.preventDefault();
    var ta  = document.getElementById('reportReason');
    var btn = document.getElementById('reportSubmit');
    var reason = ta.value.trim();

    var picked = modal.querySelector('input[name="reportCategory"]:checked');
    if (!picked) {
      message('Please choose what kind of problem this is.');
      return;
    }
    if (reason.length < MIN_REASON) {
      message('Please describe the problem in a little more detail (at least ' +
              MIN_REASON + ' characters).');
      ta.focus();
      return;
    }

    var user = auth.getUser();
    if (!user) { renderSignedOut(); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    db.from('reports').insert({
      target_type: target.targetType,
      target_id:   target.id,
      category:    picked.value,
      reason:      reason,
      reporter_id: user.id
    }).select().then(function (res) {
      if (res.error) { throw res.error; }

      existing = (res.data && res.data[0]) || null;
      close();
      toast('Thank you. Our medical editorial team will review this issue.');
    }).catch(function (err) {
      console.error('[MedCare] Report failed:', err);
      btn.disabled = false;
      btn.textContent = 'Submit';
      if (err && err.code === '42501') {

        message('Your session has expired. Please sign in again to send this report.');
      } else if (err && err.code === '23514') {

        message('That report could not be accepted. Please shorten your ' +
                'description and make sure a category is selected.');
      } else {
        message('Could not send your report. Please check your connection and try again.');
      }
    });
  }

  var toastWrap = null;

  function toast(text) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'mc-toast-wrap';
      document.body.appendChild(toastWrap);
    }

    var t = document.createElement('div');
    t.className = 'mc-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML =
      '<span class="mc-toast-ico"><i class="bi bi-check2-circle"></i></span>' +
      '<p class="mc-toast-text"></p>' +
      '<button type="button" class="mc-toast-x" aria-label="Dismiss">' +
        '<i class="bi bi-x-lg"></i></button>';
    t.querySelector('.mc-toast-text').textContent = text;
    toastWrap.appendChild(t);

    void t.offsetHeight;
    t.classList.add('is-in');

    var timer = window.setTimeout(dismiss, 6000);
    var gone  = false;

    function remove() {
      if (gone) { return; }
      gone = true;
      if (t.parentNode) { t.parentNode.removeChild(t); }
    }

    function dismiss() {
      window.clearTimeout(timer);
      if (gone || !t.parentNode) { return; }
      t.classList.remove('is-in');

      t.addEventListener('transitionend', remove);
      window.setTimeout(remove, 400);
    }

    t.querySelector('.mc-toast-x').addEventListener('click', dismiss);
  }

})();
