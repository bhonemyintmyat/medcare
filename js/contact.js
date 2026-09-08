(function () {
  'use strict';

  var list = document.getElementById('contactList');
  var db   = window.supabaseClient;
  if (!list || !db) { return; }

  var MAX_EACH = 4;

  function address(value) {
    var v = String(value == null ? '' : value).trim();
    return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v) ? v : '';
  }

  function phone(value) {
    var shown = String(value == null ? '' : value).trim();
    var dial  = shown.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return dial.replace(/\D/g, '').length >= 3 ? { shown: shown, dial: dial } : null;
  }

  function text(tag, className, value) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  }

  function card(href, icon, label, value, hint) {
    var a = document.createElement('a');
    a.className = 'mc-contact-card';
    a.href = href;

    var ico = document.createElement('span');
    ico.className = 'mc-contact-ico';
    ico.innerHTML = '<i class="bi ' + icon + '"></i>';

    var body = document.createElement('span');
    body.className = 'body';
    body.appendChild(text('span', 'label', label));
    body.appendChild(text('span', 'value', value));
    if (hint) { body.appendChild(text('span', 'hint', hint)); }

    var arr = document.createElement('i');
    arr.className = 'bi bi-arrow-right arr';

    a.appendChild(ico);
    a.appendChild(body);
    a.appendChild(arr);
    return a;
  }

  function each(rows, fn) {
    (Array.isArray(rows) ? rows : []).slice(0, MAX_EACH).forEach(function (row) {
      if (row && typeof row === 'object') { fn(row); }
    });
  }

  function labelOf(row, fallback) {
    return String(row.label == null ? '' : row.label).trim() || fallback;
  }

  function hintOf(row) {
    return String(row.hint == null ? '' : row.hint).trim();
  }

  function render(value) {
    var cards = [];

    var emails = Array.isArray(value.emails) ? value.emails
               : (value.email ? [{ label: 'Email', address: value.email }] : []);
    var phones = Array.isArray(value.phones) ? value.phones
               : (value.phone ? [{ label: 'Phone', number: value.phone }] : []);

    each(emails, function (row) {
      var addr = address(row.address);
      if (!addr) { return; }
      cards.push(card('mailto:' + addr, 'bi-envelope-fill', labelOf(row, 'Email'), addr,
        hintOf(row) ||
        'Questions about the site, corrections to a page, or anything else for the team.'));
    });

    each(phones, function (row) {
      var num = phone(row.number);
      if (!num) { return; }
      cards.push(card('tel:' + num.dial, 'bi-telephone-fill',
                      labelOf(row, 'Phone'), num.shown, hintOf(row)));
    });

    if (!cards.length) { return; }

    list.textContent = '';
    cards.forEach(function (el) { list.appendChild(el); });
  }

  db.from('site_settings').select('value').eq('key', 'footer.contact').maybeSingle()
    .then(function (res) {
      if (res.error) {

        console.info('[MedCare] Contact details unavailable; the page keeps its own.',
                     res.error.message);
        return;
      }
      var value = res.data && res.data.value;
      if (value && typeof value === 'object') { render(value); }
    })
    .catch(function () {  });

})();
