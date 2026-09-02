/* ============================================================
   MedCare — the contact details on contact.html

   One row: site_settings, key 'footer.contact', written by
   admin/contact.html. Shape:

       { email: 'someone@gmail.com',
         phones: [ { label: 'Office line', number: '+95 9 …', hint: '' } ] }

   WHY THIS FILE EXISTS AT ALL. A phone number that changes needs an
   admin and five minutes, not a developer and a deploy. Everything else
   about the page — the emergency warning, what we will and will not
   answer, the privacy paragraph — is written into contact.html, because
   none of it is a detail somebody should be able to reword from a form.

   IT FAILS BACK, NEVER BLANK. The markup in contact.html is a complete,
   correct page on its own. This replaces the cards only once the
   database has answered with something usable; no database, no table,
   no row, an empty row, a malformed one — every one of those leaves the
   page exactly as it was served. A contact page that renders an empty
   box because a fetch timed out has managed to be worse than a stale
   phone number.

   NOTHING HERE IS TRUSTED. The row was typed into a form by an admin,
   and site_settings.value says in its own comment that it is rendered
   as text and never as HTML. So: textContent for everything on screen,
   and hrefs built only from characters that belong in a mailto: or a
   tel:. An admin is not an attacker, but a row is a row.
   ============================================================ */

(function () {
  'use strict';

  var list = document.getElementById('contactList');
  var db   = window.supabaseClient;
  if (!list || !db) { return; }

  var MAX_PHONES = 4;

  /* The address has to be a Gmail one: that is the only mailbox the team
     actually reads, and it is the rule admin/contact.html enforces on
     the way in. Checked again here because the way in is not the only
     way a row can change — anybody with the database open can edit it. */
  function gmail(value) {
    var v = String(value == null ? '' : value).trim();
    return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(v) ? v : '';
  }

  /* What is displayed keeps the admin's spacing and dashes; what is
     dialled keeps only what a phone can dial. A number is dropped
     entirely if nothing dialable survives, rather than being drawn as a
     card that does nothing when tapped. */
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

  /* One card. <a> with spans inside rather than divs: the whole card is
     the link, and a div inside an anchor is legal but a span is what the
     rest of the site does. */
  function card(href, icon, label, value, hint) {
    var a = document.createElement('a');
    a.className = 'mc-contact-card';
    a.href = href;

    var ico = document.createElement('span');
    ico.className = 'mc-contact-ico';
    ico.innerHTML = '<i class="bi ' + icon + '"></i>';   // literal, not from the row

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

  function render(value) {
    var cards = [];

    var address = gmail(value.email);
    if (address) {
      cards.push(card('mailto:' + address, 'bi-envelope-fill', 'Email', address,
        'Questions about the site, corrections to a page, or anything else for the team.'));
    }

    var phones = Array.isArray(value.phones) ? value.phones : [];
    phones.slice(0, MAX_PHONES).forEach(function (row) {
      if (!row || typeof row !== 'object') { return; }
      var num = phone(row.number);
      if (!num) { return; }
      var label = String(row.label == null ? '' : row.label).trim() || 'Phone';
      var hint  = String(row.hint  == null ? '' : row.hint).trim();
      cards.push(card('tel:' + num.dial, 'bi-telephone-fill', label, num.shown, hint));
    });

    /* Nothing usable in the row. The served page stands: it names a way
       to reach us, and this one does not. */
    if (!cards.length) { return; }

    list.textContent = '';
    cards.forEach(function (el) { list.appendChild(el); });
  }

  db.from('site_settings').select('value').eq('key', 'footer.contact').maybeSingle()
    .then(function (res) {
      if (res.error) {
        /* Commonest cause is supabase_admin_scope.sql not having been
           run, which is a fine state for this site to be in. Logged, not
           surfaced: a reader is not owed a message about a table they
           have never heard of, and the page they are reading is right. */
        console.info('[MedCare] Contact details unavailable; the page keeps its own.',
                     res.error.message);
        return;
      }
      var value = res.data && res.data.value;
      if (value && typeof value === 'object') { render(value); }
    })
    .catch(function () { /* offline; what was served stands */ });

})();
