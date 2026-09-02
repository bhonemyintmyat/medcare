/* ============================================================
   MedCare — the contact details
   Loaded by admin/contact.html AND editor/contact.html, after that
   area's guard, admin-shell.js and admin-api.js.

   One setting, one form, one row: site_settings, key 'footer.contact'.
   What reads it is contact.js, on the public Contact us page.

   TWO AREAS, ONE SCRIPT. Editors keep these details as well as admins:
   an email address and a phone number on a public page are the same
   kind of thing as a hospital's, and supabase_contact_editors.sql
   widens exactly this key to them. Both screens carry the same form and
   run this file rather than a copy, and it needs nothing to tell them
   apart — editor-guard.js answers to MedCareAdminGuard too, and
   admin-api.js's loadNames() returns nothing rather than failing when
   the reader is an editor with no policy on profiles. The line about
   who last changed the row simply loses the name.

       { email:  'someone@example.com',
         phones: [ { label: 'Office line', number: '+95 …', hint: '' } ] }

   ------------------------------------------------------------
   WHAT IS CHECKED ABOUT THE ADDRESS, AND WHAT IS NOT

   That it looks like an address. That is all this can know, and it is
   worth being honest about how little it is: no test in a browser can
   tell whether mail sent there reaches a person. A sending domain, an
   alias nobody forwards, a mailbox at its quota — all of them pass.

   So the rule is enforced as a refusal, here on the way in and again in
   contact.js on the way out, and the screen says in as many words that
   the real test is sending a message to it and getting a reply. An
   address on a contact page is read by somebody who then waits, and a
   typo that sends their message nowhere costs them more than it costs
   us to retype it.

   ------------------------------------------------------------
   WHY AN EMPTY ROW IS ALLOWED

   Saving nothing is not an error. contact.html carries a complete set
   of details of its own and falls back to them, so an empty row leaves
   readers with the deployed copy rather than with a blank page. The
   screen says so, in a warning, instead of refusing the save — an admin
   clearing a number that no longer works should not have to invent a
   replacement before they are allowed to remove it.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  var api   = window.MedCareAdmin;
  if (!guard || !api) { return; }

  var esc = api.esc;

  var msgEl     = document.getElementById('ctMsg');
  var form      = document.getElementById('ctForm');
  var emailEl   = document.getElementById('ctEmail');
  var phonesEl  = document.getElementById('ctPhones');
  var addBtn    = document.getElementById('ctAdd');
  var addHint   = document.getElementById('ctAddHint');
  var emptyWarn = document.getElementById('ctEmptyWarn');
  var preview   = document.getElementById('ctPreview');
  var prevList  = document.getElementById('ctPreviewList');
  var resetBtn  = document.getElementById('ctReset');
  var saveBtn   = document.getElementById('ctSave');
  var touchedEl = document.getElementById('ctTouched');

  var KEY = 'footer.contact';
  var MAX_PHONES = 4;

  /* `saved` is what the database last told us; the form is the working
     copy. Everything that decides whether Save is live is a comparison
     between the two, so a failed write leaves the page describing the
     database rather than describing what somebody typed. */
  var saved = null;
  var names = {};
  var busy  = false;

  /* ---------------------------------------------------------------
     WHAT COUNTS AS VALID
     ---------------------------------------------------------------
     Both tests are also in contact.js. Duplicated knowingly: this one
     exists to tell an admin what is wrong while they can still fix it,
     that one exists because a row is a row whoever wrote it.
     --------------------------------------------------------------- */

  function isAddress(value) {
    return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(value || '').trim());
  }

  /* Spacing and dashes are the admin's to choose — they are what a
     reader sees. Only the digits decide whether it is a number at all. */
  function dialable(value) {
    return String(value || '').replace(/\D/g, '').length >= 3;
  }

  /* ---------------------------------------------------------------
     READING
     --------------------------------------------------------------- */

  function load() {
    return api.loadSettings([KEY])
      .then(function (rows) {
        saved = normalise(rows[KEY].value);
        saved.meta = { updated_at: rows[KEY].updated_at, updated_by: rows[KEY].updated_by,
                       missing: rows[KEY].missing };
        return api.loadNames([rows[KEY].updated_by]);
      })
      .then(function (found) {
        names = found;
        fillForm();
        renderTouched();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not read the contact details:', err);
        api.message(msgEl, 'error', api.describeError(err, 'the contact details'));
        disableForm();
      });
  }

  /* A row from the database, or from an older seed with a single
     `phone` string in it, becomes the shape this screen edits. Nothing
     is thrown away silently: an old `phone` is carried forward as the
     first number rather than being dropped on the first save. */
  function normalise(value) {
    var v = (value && typeof value === 'object') ? value : {};
    var phones = [];

    if (Array.isArray(v.phones)) {
      v.phones.forEach(function (row) {
        if (!row || typeof row !== 'object') { return; }
        phones.push({
          label:  String(row.label  == null ? '' : row.label).trim(),
          number: String(row.number == null ? '' : row.number).trim(),
          hint:   String(row.hint   == null ? '' : row.hint).trim()
        });
      });
    } else if (v.phone) {
      phones.push({ label: 'Phone', number: String(v.phone).trim(), hint: '' });
    }

    return {
      email:  String(v.email == null ? '' : v.email).trim(),
      phones: phones.slice(0, MAX_PHONES)
    };
  }

  function disableForm() {
    [emailEl, addBtn, saveBtn, resetBtn].forEach(function (el) {
      if (el) { el.disabled = true; }
    });
    Array.prototype.forEach.call(phonesEl.querySelectorAll('input, button'), function (el) {
      el.disabled = true;
    });
  }

  function renderTouched() {
    var meta = saved.meta;
    if (!meta || meta.missing || !meta.updated_at) {
      touchedEl.innerHTML = '<span class="mc-touched">Never changed from this screen</span>';
      return;
    }
    var who = meta.updated_by && names[meta.updated_by];
    touchedEl.innerHTML = '<span class="mc-touched">' +
      (who ? 'Last changed by <b>' + esc(who) + '</b> ' : 'Last changed ') +
      esc(api.whenExact(meta.updated_at)) + '</span>';
  }

  /* ---------------------------------------------------------------
     THE FORM
     --------------------------------------------------------------- */

  function phoneRow(row, i) {
    var wrap = document.createElement('div');
    wrap.className = 'mc-ad-phone';
    wrap.innerHTML =
      '<div class="mc-ad-phone-grid">' +
        '<div>' +
          '<label class="mc-auth-label" for="ctLabel' + i + '">What it is</label>' +
          '<div class="mc-auth-field">' +
            '<input id="ctLabel' + i + '" data-label maxlength="40" autocomplete="off" ' +
                   'placeholder="Office line">' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label class="mc-auth-label" for="ctNumber' + i + '">Number</label>' +
          '<div class="mc-auth-field">' +
            '<input id="ctNumber' + i + '" data-number maxlength="32" inputmode="tel" ' +
                   'autocomplete="off" spellcheck="false" placeholder="+95 9 123 456 78">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mc-ad-phone-foot">' +
        '<div class="mc-ad-phone-hint">' +
          '<label class="mc-auth-label" for="ctHint' + i + '">When it is answered <span>(optional)</span></label>' +
          '<div class="mc-auth-field">' +
            '<input id="ctHint' + i + '" data-hint maxlength="80" autocomplete="off" ' +
                   'placeholder="Monday to Friday, 9am to 5pm">' +
          '</div>' +
        '</div>' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost mc-ad-rowbtn mc-ad-rowbtn--danger" ' +
                'data-remove aria-label="Remove this number">Remove</button>' +
      '</div>';

    wrap.querySelector('[data-label]').value  = row.label;
    wrap.querySelector('[data-number]').value = row.number;
    wrap.querySelector('[data-hint]').value   = row.hint;
    return wrap;
  }

  function drawPhones(list) {
    phonesEl.textContent = '';
    list.forEach(function (row, i) { phonesEl.appendChild(phoneRow(row, i)); });
    if (!list.length) {
      var none = document.createElement('p');
      none.className = 'mc-ad-count mc-ad-phone-none';
      none.textContent = 'No phone number. The Contact us page will offer the email address alone.';
      phonesEl.appendChild(none);
    }
  }

  function fillForm() {
    emailEl.value = saved.email;
    drawPhones(saved.phones);
    sync();
  }

  /* Every row on screen, empty ones included. This is what redraws are
     built from: a blank row somebody has just added and not yet typed
     into is still a row, and rebuilding the list from readForm() below
     would delete it under their cursor. */
  function domRows() {
    return Array.prototype.map.call(phonesEl.querySelectorAll('.mc-ad-phone'), function (el) {
      return {
        label:  el.querySelector('[data-label]').value.trim(),
        number: el.querySelector('[data-number]').value.trim(),
        hint:   el.querySelector('[data-hint]').value.trim()
      };
    });
  }

  /* What is on screen, in the shape that gets written. Empty rows are
     dropped here rather than refused: clearing a number is how a number
     is removed, and there is nothing to complain about. It also means an
     untouched blank row is not a change, so Save stays quiet until
     something is actually typed. */
  function readForm() {
    var phones = domRows().filter(function (row) {
      return row.label || row.number || row.hint;
    });
    return { email: emailEl.value.trim(), phones: phones.slice(0, MAX_PHONES) };
  }

  function same(a, b) {
    return JSON.stringify({ email: a.email, phones: a.phones }) ===
           JSON.stringify({ email: b.email, phones: b.phones });
  }

  /* ---------------------------------------------------------------
     THE PREVIEW
     ---------------------------------------------------------------
     Deliberately built from the same classes contact.html uses, and
     deliberately showing only what would survive the save: a number
     with no digits in it, or an address that is not an address, is
     absent from the preview before it is refused by the Save. Seeing it
     missing is a faster explanation than reading one.
     --------------------------------------------------------------- */

  function previewCard(icon, label, value, hint) {
    return '<span class="mc-contact-card">' +
             '<span class="mc-contact-ico"><i class="bi ' + icon + '"></i></span>' +
             '<span class="body">' +
               '<span class="label">' + esc(label) + '</span>' +
               '<span class="value">' + esc(value) + '</span>' +
               (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') +
             '</span>' +
             '<i class="bi bi-arrow-right arr"></i>' +
           '</span>';
  }

  function renderPreview(next) {
    var html = '';

    if (isAddress(next.email)) {
      html += previewCard('bi-envelope-fill', 'Email', next.email.trim(),
        'Questions about the site, corrections to a page, or anything else for the team.');
    }
    next.phones.forEach(function (row) {
      if (!dialable(row.number)) { return; }
      html += previewCard('bi-telephone-fill', row.label || 'Phone', row.number, row.hint);
    });

    preview.hidden = !html;
    prevList.innerHTML = html;
  }

  function sync() {
    var next = readForm();
    var rows = phonesEl.querySelectorAll('.mc-ad-phone').length;

    addBtn.disabled = busy || rows >= MAX_PHONES;
    addHint.textContent = rows >= MAX_PHONES
      ? 'Four is the most the page shows.'
      : 'Up to ' + MAX_PHONES + '.';

    var usable = (isAddress(next.email) ? 1 : 0) +
                 next.phones.filter(function (r) { return dialable(r.number); }).length;
    emptyWarn.hidden = usable > 0;

    renderPreview(next);

    var dirty = !same(next, saved);
    saveBtn.disabled  = !dirty || busy;
    resetBtn.disabled = !dirty || busy;
    saveBtn.textContent = dirty ? 'Save' : 'Saved';
  }

  /* ---------------------------------------------------------------
     WRITING
     --------------------------------------------------------------- */

  function save() {
    var next = readForm();

    if (next.email && !isAddress(next.email)) {
      api.message(msgEl, 'error',
        'That does not look like an email address. The Contact us page offers ' +
        'this one address and nothing else, so it has to be the mailbox somebody ' +
        'actually opens — name@example.com.');
      emailEl.focus();
      return;
    }

    var bad = null;
    next.phones.forEach(function (row, i) {
      if (bad === null && !dialable(row.number)) { bad = i; }
    });
    if (bad !== null) {
      api.message(msgEl, 'error',
        'One of the numbers has nothing to dial in it. Fill it in, or press ' +
        'Remove on that row — a card that does nothing when it is tapped is ' +
        'worse than no card.');
      var el = phonesEl.querySelectorAll('.mc-ad-phone')[bad];
      if (el) { el.querySelector('[data-number]').focus(); }
      return;
    }

    var value = {
      email: next.email,
      phones: next.phones.map(function (row) {
        return { label: row.label || 'Phone', number: row.number, hint: row.hint };
      })
    };

    busy = true;
    sync();
    api.message(msgEl, 'ok', '');

    api.saveSetting(KEY, value)
      .then(function (row) {
        saved = normalise(value);
        saved.meta = { updated_at: row.updated_at, updated_by: row.updated_by, missing: false };
        busy = false;
        return api.loadNames([row.updated_by]).then(function (found) {
          Object.keys(found).forEach(function (id) { names[id] = found[id]; });
          fillForm();
          renderTouched();
          api.message(msgEl, 'ok',
            value.email || value.phones.length
              ? 'Saved. The Contact us page is showing these details now.'
              : 'Saved. The Contact us page has fallen back to the details it was published with.');
        });
      })
      .catch(function (err) {
        busy = false;
        // The form keeps what was typed and `saved` is untouched, so Save
        // stays live for another attempt with nothing to retype.
        console.error('[MedCare] Could not save the contact details:', err);
        sync();
        api.message(msgEl, 'error', api.describeError(err, 'the contact details'));
      });
  }

  /* ---------------------------------------------------------------
     WIRING
     --------------------------------------------------------------- */

  form.addEventListener('input',  sync);
  form.addEventListener('change', sync);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    save();
  });

  addBtn.addEventListener('click', function () {
    var rows = domRows();
    if (rows.length >= MAX_PHONES) { return; }
    rows.push({ label: '', number: '', hint: '' });
    drawPhones(rows);
    sync();
    var last = phonesEl.querySelectorAll('.mc-ad-phone [data-label]');
    if (last.length) { last[last.length - 1].focus(); }
  });

  /* Removing a row redraws the rest from what is on screen, so the ids
     the labels point at stay in step with the rows they name. */
  phonesEl.addEventListener('click', function (e) {
    if (!e.target.closest('[data-remove]')) { return; }
    var row  = e.target.closest('.mc-ad-phone');
    var all  = Array.prototype.slice.call(phonesEl.querySelectorAll('.mc-ad-phone'));
    var gone = all.indexOf(row);
    var kept = domRows().filter(function (_, i) { return i !== gone; });
    drawPhones(kept);
    sync();
    addBtn.focus();
  });

  resetBtn.addEventListener('click', function () {
    fillForm();
    api.message(msgEl, 'ok', '');
  });

  /* Leaving with something typed and unsaved. The browser's own dialog
     rather than a nicer one of ours: ours cannot stop a navigation, and
     a prettier warning that does not actually prevent the loss is worse
     than the ugly one that does. */
  window.addEventListener('beforeunload', function (e) {
    if (!saved || busy) { return; }
    if (same(readForm(), saved)) { return; }
    e.preventDefault();
    e.returnValue = '';
  });

  guard.ready.then(load);

})();
