(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  var i18n  = window.MedCareI18n;
  if (!guard || !ed) { return; }

  var hostEl    = document.getElementById('trHost');
  var msgEl     = document.getElementById('trMsg');
  var countEl   = document.getElementById('trCount');
  var searchEl  = document.getElementById('trSearch');
  var filtersEl = document.getElementById('trFilters');

  var params = new URLSearchParams(window.location.search);

  var state = {
    keys: [],
    rows: {},
    filter: params.get('filter') || '',
    query: ''
  };

  filtersEl.querySelectorAll('.mc-chip').forEach(function (chip) {
    chip.classList.toggle('is-active', (chip.getAttribute('data-filter') || '') === state.filter);
  });

  function resolve(key) {
    var row = state.rows[key];
    var fromDb = row && row.my != null ? String(row.my).trim() : '';
    if (fromDb) { return { value: fromDb, source: 'db', row: row }; }

    var fromFile = i18n ? i18n.fromFile(key) : null;
    fromFile = fromFile == null ? '' : String(fromFile).trim();
    if (fromFile) { return { value: fromFile, source: 'file', row: row }; }

    return { value: '', source: 'todo', row: row };
  }

  function itemHtml(key) {
    var found = resolve(key);
    var id = 'tr_' + Math.abs(hash(key));

    return '<div class="mc-ed-tr mc-ed-tr--' + found.source + '" data-key="' + ed.esc(key) + '">' +

             '<div class="mc-ed-tr-en">' +
               ed.esc(key) +
               '<p class="mc-ed-tr-where">' +
                 (found.source === 'db'   ? 'Edited here' :
                  found.source === 'file' ? 'From the shipped dictionary' :
                                            'No Burmese yet — readers see the English') +
                 (found.row && found.row.updated_at
                   ? ' · changed ' + ed.esc(ed.when(found.row.updated_at)) : '') +
               '</p>' +
             '</div>' +

             '<div class="mc-ed-tr-my">' +
               '<label class="visually-hidden" for="' + id + '">Burmese for “' + ed.esc(key) + '”</label>' +
               '<textarea id="' + id + '" data-my rows="2" ' +
                 'placeholder="Burmese translation">' + ed.esc(found.value) + '</textarea>' +
             '</div>' +

             '<div class="mc-ed-tr-foot">' +
               (found.source === 'file'
                 ? '<span class="mc-admin-hint" style="margin:0">Saving copies this into the ' +
                   'database, where it will override the file from then on.</span>' : '') +
               '<span class="mc-ed-tr-saved" data-saved hidden>' +
                 '<i class="bi bi-check-lg"></i> Saved</span>' +
               '<div style="margin-left:auto;display:flex;gap:.4rem">' +
                 '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-revert hidden>Undo</button>' +
                 '<button type="button" class="mc-auth-btn" data-save disabled>Save</button>' +
               '</div>' +
             '</div>' +

           '</div>';
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  }

  function matches(key) {
    var found = resolve(key);

    if (state.filter === 'todo' && found.source !== 'todo') { return false; }
    if (state.filter === 'db'   && found.source !== 'db')   { return false; }
    if (state.filter === 'file' && found.source !== 'file') { return false; }

    var q = state.query.trim().toLowerCase();
    if (!q) { return true; }
    return key.toLowerCase().indexOf(q) !== -1 ||
           found.value.toLowerCase().indexOf(q) !== -1;
  }

  function draw() {
    if (!state.keys.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--error">' +
          '<span class="mc-state-ico"><i class="bi bi-translate"></i></span>' +
          '<h2>No translatable strings found</h2>' +
          '<p>The key list comes from the dictionary in script.js, and this page ' +
             'could not read it. Check that script.js is loading — the console will say.</p>' +
        '</div>';
      countEl.textContent = '';
      return;
    }

    var shown = state.keys.filter(matches);

    if (!shown.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-check2-circle"></i></span>' +
          '<h2>Nothing matches</h2>' +
          '<p>' + (state.filter === 'todo'
            ? 'Every string has Burmese. That is the state this screen exists to reach.'
            : 'No string matches what you have filtered to.') + '</p>' +
        '</div>';
      countEl.textContent = '';
      return;
    }

    hostEl.innerHTML = shown.map(itemHtml).join('');

    var todo = state.keys.filter(function (k) { return resolve(k).source === 'todo'; }).length;
    countEl.textContent = shown.length + ' of ' + state.keys.length + ' strings' +
      (todo ? ' · ' + todo + ' still without Burmese' : ' · all translated');
  }

  function save(key, value, card) {
    var saveBtn = card.querySelector('[data-save]');
    var savedEl = card.querySelector('[data-saved]');
    var existing = state.rows[key];

    saveBtn.disabled = true;
    ed.message(msgEl, null);

    var write = existing
      ? db.from('translations').update({ my: value }).eq('en', key).select().single()
      : db.from('translations').insert({ en: key, my: value }).select().single();

    write.then(function (res) {
      if (res.error) { throw res.error; }
      state.rows[key] = res.data;

      if (i18n) { i18n.merge([res.data]); }

      savedEl.hidden = false;
      window.setTimeout(function () { savedEl.hidden = true; }, 2200);

      var fresh = document.createElement('div');
      fresh.innerHTML = itemHtml(key);
      card.replaceWith(fresh.firstChild);

    }).catch(function (err) {
      saveBtn.disabled = false;
      ed.message(msgEl, 'error', ed.describeError(err, 'translations'));
    });
  }

  hostEl.addEventListener('input', function (e) {
    var box = e.target.closest('[data-my]');
    if (!box) { return; }
    var card = box.closest('[data-key]');
    var key  = card.getAttribute('data-key');
    var was  = resolve(key).value;

    var changed = box.value.trim() !== was;
    card.querySelector('[data-save]').disabled = !changed;
    card.querySelector('[data-revert]').hidden = !changed;
  });

  hostEl.addEventListener('click', function (e) {
    var card = e.target.closest('[data-key]');
    if (!card) { return; }
    var key = card.getAttribute('data-key');

    if (e.target.closest('[data-revert]')) {
      card.querySelector('[data-my]').value = resolve(key).value;
      card.querySelector('[data-save]').disabled = true;
      card.querySelector('[data-revert]').hidden = true;
      return;
    }

    if (e.target.closest('[data-save]')) {
      var value = card.querySelector('[data-my]').value.trim();
      if (!value) {
        ed.message(msgEl, 'error',
          'An empty translation would leave readers on the English. Delete the key from ' +
          'script.js if the string is gone; leave this blank if it is not translated yet.');
        return;
      }
      save(key, value, card);
    }
  });

  filtersEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.mc-chip');
    if (!chip) { return; }
    state.filter = chip.getAttribute('data-filter') || '';
    filtersEl.querySelectorAll('.mc-chip').forEach(function (c) {
      c.classList.toggle('is-active', c === chip);
    });
    window.history.replaceState(null, '',
      'translations.html' + (state.filter ? '?filter=' + state.filter : ''));
    draw();
  });

  var typing;
  searchEl.addEventListener('input', function () {
    window.clearTimeout(typing);
    typing = window.setTimeout(function () { state.query = searchEl.value; draw(); }, 140);
  });

  guard.ready.then(function () {
    state.keys = i18n ? i18n.keys() : [];

    db.from('translations').select('*')
      .then(function (res) {
        if (res.error) {

          ed.message(msgEl, 'error',
            'The translations table could not be read, so nothing here can be saved yet. ' +
            'It is created by section 5 of supabase_editor.sql. (' + res.error.message + ')');
        } else {
          (res.data || []).forEach(function (row) { state.rows[row.en] = row; });
        }
        draw();
      })
      .catch(function (err) {
        ed.message(msgEl, 'error', ed.describeError(err, 'translations'));
        draw();
      });
  });

})();
