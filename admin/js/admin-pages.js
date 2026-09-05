/* ============================================================
   MedCare — the footer pages
   Loaded by admin/pages.html AND editor/pages.html, after that area's
   guard, admin-shell.js and admin-api.js.

   Four pages hang off the footer and carry no medical advice: About
   MedCare, Terms of use, Privacy policy, Cookie settings. Each has a row
   in public.pages and a hand-written HTML file. The row wins when it has
   prose in it; otherwise the file's own copy stands, and page-body.js on
   the public side decides that.

   ------------------------------------------------------------
   TWO AREAS, ONE SCRIPT, TWO DIFFERENT ANSWERS

   admin/pages.html and editor/pages.html both run this file, the way the
   contact screens both run admin-contact.js. The difference here is that
   the two areas are NOT equal:

       admin    reads and writes
       editor   reads

   That is not a decision this screen makes. supabase_footer_pages.sql
   grants UPDATE on public.pages to admins alone, exactly as
   supabase_contact_editors.sql left legal text admin-only while widening
   the contact details to editors. Legal text is the one thing on this
   site an editor does not sign off.

   So an editor gets the whole screen, the real text, and no Save. The
   read-only state is drawn from the role, but the database is what
   enforces it: if this file were wrong, or somebody opened the admin URL
   with an editor account, the write is still refused and savePage()
   turns that refusal into a sentence.

   ------------------------------------------------------------
   WHERE THE TEXT COMES FROM THE FIRST TIME

   Every row is seeded empty, so the first time a page is opened here the
   boxes would be blank — while the live page is full of prose. That is
   the same problem editor-entry.js has with the twenty hand-written
   articles, and it gets the same answer: MedCareImport.fromPage() reads
   the deployed page and hands back its prose, split by language and
   sanitised.

   Two rules, both borrowed from the entry form because both matter:

     an import never overwrites stored text
     an import never saves

   The screen fills, says where the text came from, and waits. Until Save
   is pressed the row is untouched and the public page is unchanged.

   ------------------------------------------------------------
   WHAT SURVIVES THE TRIP, AND WHAT DOES NOT

   The allowlist in sanitize-html.js permits semantic prose and no
   classes: p, h2-h4, lists, links, strong, em. It does not permit div or
   span, so the site's own furniture — callout boxes, the feature grid on
   the About page, the setting cards on the Cookies page — cannot be
   stored in a body and does not come back from an import.

   That is the allowlist working, not failing. Those pieces stay in the
   HTML file, outside the editable region, and keep their styling; what
   this screen edits is the prose between them. The note on the screen
   says so, because an admin who pastes a layout in and watches it
   flatten deserves to have been told first.
   ============================================================ */

(function () {
  'use strict';

  var ad       = window.MedCareAdmin;
  var auth     = window.MedCareAuth;
  var sanitize = window.MedCareSanitize;
  var rich     = window.MedCareRichText;

  var listEl = document.getElementById('pagesList');
  if (!listEl || !ad) { return; }

  var msgEl     = document.getElementById('pagesMsg');
  var emptyEl   = document.getElementById('pagesEmpty');
  var panelEl   = document.getElementById('pagesPanel');
  var titleEl   = document.getElementById('pageTitle');
  var nameEl    = document.getElementById('pageName');
  var viewEl    = document.getElementById('pageView');
  var stateEl   = document.getElementById('pageState');
  var enHost    = document.getElementById('pageBodyEn');
  var myHost    = document.getElementById('pageBodyMy');
  var importEl  = document.getElementById('pageImport');
  var importedEl= document.getElementById('pageImported');
  var saveEl    = document.getElementById('pageSave');
  var clearEl   = document.getElementById('pageClear');
  var roEl      = document.getElementById('pagesReadonly');

  var rows    = [];
  var current = null;          // the row being edited
  var editors = {};            // 'en' | 'my' -> richtext handle
  var dirty   = false;
  var canEdit = false;         // set once the role is known

  /* ---------- The list ---------- */

  /* 'database' or 'file', said the same way here and in the migration's
     checks query, so the two can be read against each other. */
  function source(row) {
    var en = row.body && row.body.trim();
    var my = row.body_my && row.body_my.trim();
    return (en || my) ? 'database' : 'file';
  }

  function draw() {
    listEl.innerHTML = '';
    rows.forEach(function (row) {
      var live = source(row) === 'database';
      var btn  = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mc-admin-row' + (current && current.slug === row.slug ? ' is-open' : '');
      btn.setAttribute('data-slug', row.slug);
      btn.innerHTML =
        '<span class="mc-admin-row-main">' +
          '<span class="mc-admin-row-name">' + ad.esc(row.title || row.slug) + '</span>' +
          '<span class="mc-admin-row-meta">' +
            ad.esc(row.href) + ' · ' +
            (live ? 'showing the database' : 'showing the page’s own text') +
            (row.updated_at ? ' · ' + ad.when(row.updated_at) : '') +
          '</span>' +
        '</span>' +
        '<span class="mc-admin-pill">' + (live ? 'Edited' : 'As deployed') + '</span>';
      btn.addEventListener('click', function () { open(row.slug); });
      listEl.appendChild(btn);
    });
  }

  /* ---------- Opening one ---------- */

  function open(slug) {
    var row = rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) { return; }

    if (dirty && !window.confirm('This page has changes you have not saved. Leave them?')) {
      return;
    }

    current = row;
    dirty = false;
    ad.message(msgEl, null, '');
    if (importedEl) { importedEl.hidden = true; }

    if (emptyEl) { emptyEl.hidden = true; }
    panelEl.hidden = false;

    nameEl.textContent = row.title || row.slug;
    titleEl.value = row.title || '';
    viewEl.href = '../' + row.href;
    setState(row);
    draw();

    /* Quill is fetched on demand and the two editors are made once, then
       refilled. Making a new pair per page would leave the old ones in
       the DOM holding text nobody can see but the browser still keeps. */
    ensureEditors().then(function () {
      editors.en.setHTML(sanitize.clean(row.body || ''));
      editors.my.setHTML(sanitize.clean(row.body_my || ''));
      applyRole();
      maybeImport(row);
    })['catch'](function (err) {
      ad.message(msgEl, 'error', ad.describeError(err, 'the editor'));
    });
  }

  function setState(row) {
    if (!stateEl) { return; }
    var live = source(row) === 'database';
    stateEl.textContent = live
      ? 'Readers are seeing this text.'
      : 'Readers are seeing the text written into ' + row.href + '. Saving something here replaces it.';
    stateEl.className = 'mc-admin-hint' + (live ? '' : ' mc-admin-hint-inline');
  }

  function ensureEditors() {
    if (editors.en && editors.my) { return Promise.resolve(); }
    if (!rich) { return Promise.reject(new Error('The rich text editor did not load.')); }
    return Promise.all([
      rich.create(enHost, { placeholder: 'The page in English…', onChange: touch }),
      rich.create(myHost, { placeholder: 'The page in Burmese…',  onChange: touch })
    ]).then(function (made) {
      editors.en = made[0];
      editors.my = made[1];
    });
  }

  function touch() {
    dirty = true;
    if (saveEl && canEdit) { saveEl.disabled = false; }
  }

  /* ---------- The first fill ---------- */

  /* Same three conditions as editor-entry.js, and for the same reasons:
     there must be a page to read, the row must be empty, and the boxes
     must still be empty when the download lands — a slow fetch must not
     land on top of something somebody typed while waiting for it. */
  /* row.href is passed BARE. fromPage() resolves it itself with a '../'
     because every screen that calls it sits one folder deep, and its
     siteRelative() guard rejects any path containing '..' outright — so
     prefixing one here does not double up, it fails the guard and the
     import returns null without saying why. */
  function maybeImport(row) {
    if (!window.MedCareImport || !row.href) { return; }
    if ((row.body && row.body.trim()) || (row.body_my && row.body_my.trim())) { return; }

    window.MedCareImport.fromPage(row.href).then(function (found) {
      if (!found || current !== row) { return; }
      if (editors.en.getText() || editors.my.getText()) { return; }

      var en = found.en && sanitize.textOf(found.en) ? found.en : '';
      var my = found.my && sanitize.textOf(found.my) ? found.my : '';
      if (!en && !my) { return; }

      editors.en.setHTML(en);
      editors.my.setHTML(my);

      if (importedEl) {
        importedEl.textContent =
          'This is the text currently on ' + row.href +
          '. Nothing is saved until you press Save.';
        importedEl.hidden = false;
      }
      /* Deliberately not marked dirty: setHTML does not fire onChange,
         and an import the admin has not touched is not an edit. Save
         stays available so they can adopt it in one press. */
      if (saveEl && canEdit) { saveEl.disabled = false; }
    })['catch'](function () {
      /* A page that will not fetch is not an error worth a red bar: the
         boxes are simply empty and the admin can write into them. */
    });
  }

  /* ---------- Who may save ---------- */

  function applyRole() {
    if (saveEl)  { saveEl.hidden = !canEdit; }
    if (clearEl) { clearEl.hidden = !canEdit; }
    if (importEl){ importEl.hidden = !canEdit; }
    if (titleEl) { titleEl.disabled = !canEdit; }
    if (roEl)    { roEl.hidden = canEdit; }
    if (editors.en) { editors.en.setEnabled(canEdit); }
    if (editors.my) { editors.my.setEnabled(canEdit); }
  }

  /* ---------- Saving ---------- */

  function save() {
    if (!current || !canEdit) { return; }

    var body   = editors.en ? editors.en.getHTML() : '';
    var bodyMy = editors.my ? editors.my.getHTML() : '';

    /* Quill leaves '<p><br></p>' behind when a box is cleared. Stored,
       that is prose as far as any length test is concerned and blank as
       far as a reader is concerned — the exact combination that would
       replace a page with nothing. Normalise it to empty, which the
       public side already reads as "show the file". */
    if (!sanitize.textOf(body))   { body = ''; }
    if (!sanitize.textOf(bodyMy)) { bodyMy = ''; }

    var fields = { title: (titleEl.value || '').trim(), body: body, body_my: bodyMy };

    saveEl.disabled = true;
    ad.message(msgEl, null, '');

    ad.savePage(current.slug, fields).then(function (saved) {
      rows = rows.map(function (r) { return r.slug === saved.slug ? saved : r; });
      current = saved;
      dirty = false;
      if (importedEl) { importedEl.hidden = true; }
      setState(saved);
      draw();
      ad.message(msgEl, 'ok',
        source(saved) === 'database'
          ? 'Saved. ' + saved.href + ' now shows this text.'
          : 'Saved. Both boxes are empty, so ' + saved.href + ' shows its own text again.');
    })['catch'](function (err) {
      saveEl.disabled = false;
      ad.message(msgEl, 'error', ad.describeError(err, 'this page'));
    });
  }

  /* Emptying both boxes is how a page is handed back to its file. It is
     the closest thing to a revert this screen has, and it is worth a
     confirm: the text being removed may be the only copy of an edit. */
  function clearBoth() {
    if (!current || !canEdit) { return; }
    if (!window.confirm(
          'Empty both boxes?\n\n' + current.href + ' will go back to showing the text ' +
          'written into the file. Press Save afterwards to make that happen.')) { return; }
    editors.en.setHTML('');
    editors.my.setHTML('');
    touch();
  }

  if (saveEl)   { saveEl.addEventListener('click', save); }
  if (clearEl)  { clearEl.addEventListener('click', clearBoth); }
  if (importEl) {
    importEl.addEventListener('click', function () {
      if (!current) { return; }
      window.MedCareImport.fromPage(current.href).then(function (found) {
        if (!found) {
          ad.message(msgEl, 'error', 'Could not read ' + current.href + '.');
          return;
        }
        editors.en.setHTML(found.en || '');
        editors.my.setHTML(found.my || '');
        touch();
        ad.message(msgEl, 'ok', 'Read from ' + current.href + '. Nothing is saved until you press Save.');
      })['catch'](function (err) {
        ad.message(msgEl, 'error', ad.describeError(err, current.href));
      });
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (!dirty) { return; }
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------- Start ---------- */

  function start() {
    ad.loadPages().then(function (data) {
      rows = data;
      if (!rows.length) {
        ad.message(msgEl, 'error',
          'No pages are set up. Run supabase_footer_pages.sql in the Supabase SQL editor.');
        return;
      }
      draw();
    })['catch'](function (err) {
      ad.message(msgEl, 'error', ad.describeError(err, 'the pages'));
    });
  }

  /* The role decides what is drawn; the database decides what is
     allowed. onChange rather than a single read, so a session that
     resolves after this file runs still lands on the right state. */
  if (auth) {
    auth.onChange(function (user, role) {
      canEdit = role === 'admin';
      applyRole();
    });
  }
  start();
})();
