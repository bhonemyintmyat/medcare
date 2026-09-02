/* ============================================================
   MedCare — the contact details
   Loaded by admin/contact.html AND editor/contact.html, after that
   area's guard, admin-shell.js and admin-api.js.

   One setting, one form, one row: site_settings, key 'footer.contact'.
   What reads it is contact.js, on the public Contact us page.

       { emails: [ { label: 'General enquiries',
                     address: 'someone@example.com', hint: '' } ],
         phones: [ { label: 'Office line',
                     number: '+95 …', hint: '' } ] }

   TWO AREAS, ONE SCRIPT. Editors keep these details as well as admins:
   an email address and a phone number on a public page are the same
   kind of thing as a hospital's, and supabase_contact_editors.sql
   widens exactly this key to them. Both screens carry the same form and
   run this file rather than a copy, and it needs nothing to tell them
   apart — editor-guard.js answers to MedCareAdminGuard too, and
   admin-api.js's loadNames() returns nothing rather than failing when
   the reader is an editor with no policy on profiles. The line about
   who last changed the row simply loses the name.

   Both screens must carry BOTH lists. A page with the address list left
   off would read the whole row, draw half of it, and save the half back
   over the rest — so a form that is missing a list is refused below
   rather than driven.

   ------------------------------------------------------------
   TWO LISTS, ONE PIECE OF CODE

   Addresses and numbers behave identically: a label, a value, an
   optional note, up to four, added and removed the same way. They are
   built from one description each rather than from two sets of
   near-identical functions, because near-identical is what stops being
   identical the first time only one of them gets fixed.

   What genuinely differs is all in the descriptions: what makes a value
   valid, what the field is called on screen, and which icon the preview
   card carries.

   ------------------------------------------------------------
   WHAT IS CHECKED ABOUT AN ADDRESS, AND WHAT IS NOT

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
  var emptyWarn = document.getElementById('ctEmptyWarn');
  var preview   = document.getElementById('ctPreview');
  var prevList  = document.getElementById('ctPreviewList');
  var resetBtn  = document.getElementById('ctReset');
  var saveBtn   = document.getElementById('ctSave');
  var touchedEl = document.getElementById('ctTouched');

  var KEY = 'footer.contact';
  var MAX = 4;          // per list, and it is what the public page draws

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
     exists to tell somebody what is wrong while they can still fix it,
     that one exists because a row is a row whoever wrote it.
     --------------------------------------------------------------- */

  function isAddress(value) {
    return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(value || '').trim());
  }

  /* Spacing and dashes are theirs to choose — they are what a reader
     sees. Only the digits decide whether it is a number at all. */
  function dialable(value) {
    return String(value || '').replace(/\D/g, '').length >= 3;
  }

  /* ---------------------------------------------------------------
     THE TWO LISTS
     ---------------------------------------------------------------
     `field` is the name the value is stored under, so the shape written
     to the database stays readable from here: an email carries
     `address`, a phone carries `number`.
     --------------------------------------------------------------- */

  var LISTS = [
    {
      name:   'emails',
      field:  'address',
      hostId: 'ctEmails',
      addId:  'ctEmailAdd',
      hintId: 'ctEmailAddHint',
      idBase: 'ctEmail',
      legend: 'Address',
      hintLegend: 'What it is for <span>(optional)</span>',
      labelPlaceholder: 'General enquiries',
      valuePlaceholder: 'someone@example.com',
      hintPlaceholder:  'Answered within two working days',
      inputAttrs: 'type="email" inputmode="email" spellcheck="false" maxlength="120"',
      defaultLabel: 'Email',
      icon: 'bi-envelope-fill',
      removeLabel: 'Remove this address',
      none: 'No email address. The Contact us page will offer the phone numbers alone.',
      valid: isAddress,
      complain:
        'That does not look like an email address. Every address here is one a ' +
        'reader may write to and then wait for an answer, so a row with nothing ' +
        'to send to is refused rather than saved — name@example.com.'
    },
    {
      name:   'phones',
      field:  'number',
      hostId: 'ctPhones',
      addId:  'ctPhoneAdd',
      hintId: 'ctPhoneAddHint',
      idBase: 'ctPhone',
      legend: 'Number',
      hintLegend: 'When it is answered <span>(optional)</span>',
      labelPlaceholder: 'Office line',
      valuePlaceholder: '+95 9 123 456 78',
      hintPlaceholder:  'Monday to Friday, 9am to 5pm',
      inputAttrs: 'inputmode="tel" spellcheck="false" maxlength="32"',
      defaultLabel: 'Phone',
      icon: 'bi-telephone-fill',
      removeLabel: 'Remove this number',
      none: 'No phone number. The Contact us page will offer the email addresses alone.',
      valid: dialable,
      complain:
        'One of the numbers has nothing to dial in it. Fill it in, or press ' +
        'Remove on that row — a card that does nothing when it is tapped is ' +
        'worse than no card.'
    }
  ];

  LISTS.forEach(function (list) {
    list.host    = document.getElementById(list.hostId);
    list.addBtn  = document.getElementById(list.addId);
    list.addHint = document.getElementById(list.hintId);
  });

  var incomplete = LISTS.filter(function (l) { return !l.host || !l.addBtn || !l.addHint; });
  if (!form || incomplete.length) {
    console.error('[MedCare] The contact form is missing part of itself; this screen is ' +
                  'not wired up rather than half-wired.',
                  incomplete.map(function (l) { return l.name; }));
    return;
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

  /* A row from the database becomes the shape this screen edits,
     whatever shape it arrives in. Two older ones are carried forward
     rather than dropped on the first save: a single `email` string, from
     when the page offered exactly one, and a single `phone` string from
     the seed before that. Neither is written back — saving normalises
     the row — so this is the only place that needs to know they existed. */
  function normalise(value) {
    var v = (value && typeof value === 'object') ? value : {};
    var out = {};

    LISTS.forEach(function (list) {
      var rows = [];
      if (Array.isArray(v[list.name])) {
        v[list.name].forEach(function (row) {
          if (!row || typeof row !== 'object') { return; }
          rows.push({
            label: String(row.label == null ? '' : row.label).trim(),
            value: String(row[list.field] == null ? '' : row[list.field]).trim(),
            hint:  String(row.hint == null ? '' : row.hint).trim()
          });
        });
      }
      out[list.name] = rows.slice(0, MAX);
    });

    if (!out.emails.length && v.email) {
      out.emails.push({ label: 'Email', value: String(v.email).trim(), hint: '' });
    }
    if (!out.phones.length && v.phone) {
      out.phones.push({ label: 'Phone', value: String(v.phone).trim(), hint: '' });
    }

    return out;
  }

  function disableForm() {
    [saveBtn, resetBtn].forEach(function (el) { if (el) { el.disabled = true; } });
    LISTS.forEach(function (list) {
      list.addBtn.disabled = true;
      Array.prototype.forEach.call(list.host.querySelectorAll('input, button'), function (el) {
        el.disabled = true;
      });
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

  function rowEl(list, row, i) {
    var wrap = document.createElement('div');
    wrap.className = 'mc-ad-phone';
    wrap.innerHTML =
      '<div class="mc-ad-phone-grid">' +
        '<div>' +
          '<label class="mc-auth-label" for="' + list.idBase + 'Label' + i + '">What it is</label>' +
          '<div class="mc-auth-field">' +
            '<input id="' + list.idBase + 'Label' + i + '" data-label maxlength="40" ' +
                   'autocomplete="off" placeholder="' + list.labelPlaceholder + '">' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label class="mc-auth-label" for="' + list.idBase + 'Value' + i + '">' +
            list.legend +
          '</label>' +
          '<div class="mc-auth-field">' +
            '<input id="' + list.idBase + 'Value' + i + '" data-value ' + list.inputAttrs + ' ' +
                   'autocomplete="off" placeholder="' + list.valuePlaceholder + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mc-ad-phone-foot">' +
        '<div class="mc-ad-phone-hint">' +
          '<label class="mc-auth-label" for="' + list.idBase + 'Hint' + i + '">' +
            list.hintLegend +
          '</label>' +
          '<div class="mc-auth-field">' +
            '<input id="' + list.idBase + 'Hint' + i + '" data-hint maxlength="80" ' +
                   'autocomplete="off" placeholder="' + list.hintPlaceholder + '">' +
          '</div>' +
        '</div>' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost mc-ad-rowbtn mc-ad-rowbtn--danger" ' +
                'data-remove aria-label="' + list.removeLabel + '">Remove</button>' +
      '</div>';

    wrap.querySelector('[data-label]').value = row.label;
    wrap.querySelector('[data-value]').value = row.value;
    wrap.querySelector('[data-hint]').value  = row.hint;
    return wrap;
  }

  function draw(list, rows) {
    list.host.textContent = '';
    rows.forEach(function (row, i) { list.host.appendChild(rowEl(list, row, i)); });
    if (!rows.length) {
      var none = document.createElement('p');
      none.className = 'mc-ad-count mc-ad-phone-none';
      none.textContent = list.none;
      list.host.appendChild(none);
    }
  }

  function fillForm() {
    LISTS.forEach(function (list) { draw(list, saved[list.name]); });
    sync();
  }

  /* Every row on screen, empty ones included. This is what redraws are
     built from: a blank row somebody has just added and not yet typed
     into is still a row, and rebuilding the list from readForm() below
     would delete it under their cursor. */
  function domRows(list) {
    return Array.prototype.map.call(list.host.querySelectorAll('.mc-ad-phone'), function (el) {
      return {
        label: el.querySelector('[data-label]').value.trim(),
        value: el.querySelector('[data-value]').value.trim(),
        hint:  el.querySelector('[data-hint]').value.trim()
      };
    });
  }

  /* What is on screen, in the shape that gets written. Empty rows are
     dropped here rather than refused: clearing a row is how a detail is
     removed, and there is nothing to complain about. It also means an
     untouched blank row is not a change, so Save stays quiet until
     something is actually typed. */
  function readForm() {
    var out = {};
    LISTS.forEach(function (list) {
      out[list.name] = domRows(list).filter(function (row) {
        return row.label || row.value || row.hint;
      }).slice(0, MAX);
    });
    return out;
  }

  function same(a, b) {
    return LISTS.every(function (list) {
      return JSON.stringify(a[list.name]) === JSON.stringify(b[list.name]);
    });
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

  /* Addresses first, then numbers — the same order contact.js draws
     them in, because a preview that agrees about the content and
     disagrees about the order is still lying about the page. */
  function renderPreview(next) {
    var html = '';
    LISTS.forEach(function (list) {
      next[list.name].forEach(function (row) {
        if (!list.valid(row.value)) { return; }
        html += previewCard(list.icon, row.label || list.defaultLabel, row.value, row.hint);
      });
    });
    preview.hidden = !html;
    prevList.innerHTML = html;
  }

  function sync() {
    var next = readForm();
    var usable = 0;

    LISTS.forEach(function (list) {
      var rows = list.host.querySelectorAll('.mc-ad-phone').length;
      list.addBtn.disabled = busy || rows >= MAX;
      list.addHint.textContent = rows >= MAX
        ? 'Four is the most the page shows.'
        : 'Up to ' + MAX + '.';
      usable += next[list.name].filter(function (row) { return list.valid(row.value); }).length;
    });

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

    /* The first thing that is wrong, and the field it is in. One at a
       time rather than a list of complaints: the row is on the screen in
       front of them, and a form that answers back once is easier to work
       down than one that answers back four times. */
    var bad = null;
    LISTS.forEach(function (list) {
      if (bad) { return; }
      next[list.name].forEach(function (row, i) {
        if (!bad && !list.valid(row.value)) { bad = { list: list, at: i }; }
      });
    });
    if (bad) {
      api.message(msgEl, 'error', bad.list.complain);
      var el = bad.list.host.querySelectorAll('.mc-ad-phone')[bad.at];
      if (el) { el.querySelector('[data-value]').focus(); }
      return;
    }

    var value = {};
    LISTS.forEach(function (list) {
      value[list.name] = next[list.name].map(function (row) {
        var out = { label: row.label || list.defaultLabel, hint: row.hint };
        out[list.field] = row.value;
        return out;
      });
    });

    var anything = value.emails.length || value.phones.length;

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
            anything
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

  LISTS.forEach(function (list) {
    list.addBtn.addEventListener('click', function () {
      var rows = domRows(list);
      if (rows.length >= MAX) { return; }
      rows.push({ label: '', value: '', hint: '' });
      draw(list, rows);
      sync();
      var fields = list.host.querySelectorAll('[data-label]');
      if (fields.length) { fields[fields.length - 1].focus(); }
    });

    /* Removing a row redraws the rest from what is on screen, so the ids
       the labels point at stay in step with the rows they name. */
    list.host.addEventListener('click', function (e) {
      if (!e.target.closest('[data-remove]')) { return; }
      var row  = e.target.closest('.mc-ad-phone');
      var all  = Array.prototype.slice.call(list.host.querySelectorAll('.mc-ad-phone'));
      var gone = all.indexOf(row);
      draw(list, domRows(list).filter(function (_, i) { return i !== gone; }));
      sync();
      list.addBtn.focus();
    });
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
