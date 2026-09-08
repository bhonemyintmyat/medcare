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

  var rows    = [];
  var current = null;
  var editors = {};
  var dirty   = false;
  var canEdit = false;

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

      if (saveEl && canEdit) { saveEl.disabled = false; }
    })['catch'](function () {

    });
  }

  function applyRole() {
    if (saveEl)  { saveEl.hidden = !canEdit; }
    if (clearEl) { clearEl.hidden = !canEdit; }
    if (importEl){ importEl.hidden = !canEdit; }
    if (titleEl) { titleEl.disabled = !canEdit; }
    if (editors.en) { editors.en.setEnabled(canEdit); }
    if (editors.my) { editors.my.setEnabled(canEdit); }
  }

  function save() {
    if (!current || !canEdit) { return; }

    var body   = editors.en ? editors.en.getHTML() : '';
    var bodyMy = editors.my ? editors.my.getHTML() : '';

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

  function words(handle) {
    var text = handle ? handle.getText() : '';
    return text ? text.length : 0;
  }

  function thousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function clearBoth() {
    if (!current || !canEdit) { return; }

    var enLen = words(editors.en);
    var myLen = words(editors.my);

    if (!enLen && !myLen) { return; }

    var ask = 'Empty both boxes?\n\n';

    if (myLen) {
      ask += 'The Burmese is ' + thousands(myLen) + ' characters and exists only here. ' +
             current.href + ' carries no Burmese, so “Read the page’s text” cannot ' +
             'bring it back — copy it somewhere first if you might want it again.\n\n';
    }
    if (enLen) {
      ask += 'The English can be read back from the file at any time.\n\n';
    }

    ask += current.href + ' will go back to showing the text written into the file. ' +
           'Press Save afterwards to make that happen.';

    if (!window.confirm(ask)) { return; }

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

        var en = sanitize.textOf(found.en || '') ? found.en : null;
        var my = sanitize.textOf(found.my || '') ? found.my : null;

        if (!en && !my) {
          ad.message(msgEl, 'error',
            'There is no prose in ' + current.href + ' to read. Nothing was changed.');
          return;
        }

        var changed = [];
        if (en) { editors.en.setHTML(en); changed.push('English'); }
        if (my) { editors.my.setHTML(my); changed.push('Burmese'); }

        var kept = [];
        if (!en && editors.en.getText()) { kept.push('English'); }
        if (!my && editors.my.getText()) { kept.push('Burmese'); }

        touch();
        ad.message(msgEl, 'ok',
          'Read the ' + changed.join(' and ') + ' from ' + current.href + '.' +
          (kept.length
            ? ' ' + kept.join(' and ') + ' is not in that file, so what you had is still here.'
            : '') +
          ' Nothing is saved until you press Save.');
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

  function start() {
    ad.loadPages().then(function (data) {
      rows = data;
      if (!rows.length) {
        ad.message(msgEl, 'error',
          'No pages are set up. Run supabase_footer_pages.sql in the Supabase SQL editor.');
        return;
      }
      draw();

      var wanted = new URLSearchParams(window.location.search).get('slug');
      if (wanted && rows.some(function (r) { return r.slug === wanted; })) {
        open(wanted);
      }
    })['catch'](function (err) {
      ad.message(msgEl, 'error', ad.describeError(err, 'the pages'));
    });
  }

  if (auth) {
    auth.onChange(function (user, role) {

      canEdit = role === 'editor' || role === 'admin';
      applyRole();
    });
  }
  start();
})();
