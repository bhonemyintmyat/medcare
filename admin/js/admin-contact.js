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
  var MAX = 4;

  var saved = null;
  var names = {};
  var busy  = false;

  function isAddress(value) {
    return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(value || '').trim());
  }

  function dialable(value) {
    return String(value || '').replace(/\D/g, '').length >= 3;
  }

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

  function domRows(list) {
    return Array.prototype.map.call(list.host.querySelectorAll('.mc-ad-phone'), function (el) {
      return {
        label: el.querySelector('[data-label]').value.trim(),
        value: el.querySelector('[data-value]').value.trim(),
        hint:  el.querySelector('[data-hint]').value.trim()
      };
    });
  }

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

  function save() {
    var next = readForm();

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

        console.error('[MedCare] Could not save the contact details:', err);
        sync();
        api.message(msgEl, 'error', api.describeError(err, 'the contact details'));
      });
  }

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

  window.addEventListener('beforeunload', function (e) {
    if (!saved || busy) { return; }
    if (same(readForm(), saved)) { return; }
    e.preventDefault();
    e.returnValue = '';
  });

  guard.ready.then(load);

})();
