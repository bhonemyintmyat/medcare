(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  if (!guard || !ed) { return; }

  var params = new URLSearchParams(window.location.search);
  var type   = ed.TYPES[params.get('type')] ? params.get('type') : 'disease';
  var cfg    = ed.TYPES[type];
  var id     = params.get('id') || null;

  var formEl     = document.getElementById('entryForm');
  var hostEl     = document.getElementById('fieldHost');
  var msgEl      = document.getElementById('entryMsg');
  var headingEl  = document.getElementById('entryHeading');
  var subEl      = document.getElementById('entrySub');
  var saveBtn    = document.getElementById('entrySave');
  var backBtn    = document.getElementById('entryBack');
  var dirtyEl    = document.getElementById('entryDirty');
  var touchedEl  = document.getElementById('entryTouched');
  var wfEl       = document.getElementById('workflow');
  var wfPill     = document.getElementById('workflowPill');
  var wfHint     = document.getElementById('workflowHint');
  var wfActs     = document.getElementById('workflowActs');
  var lockEl     = document.getElementById('entryLocked');
  var lockText   = document.getElementById('entryLockedText');
  var unlockBtn  = document.getElementById('entryUnlock');

  var reportId    = params.get('report');
  var reportRow   = null;
  var repEl       = document.getElementById('entryReport');
  var repCatEl    = document.getElementById('entryReportCat');
  var repReasonEl = document.getElementById('entryReportReason');
  var repDetailEl = document.getElementById('entryReportDetail');
  var repMetaEl   = document.getElementById('entryReportMeta');
  var repNoteEl   = document.getElementById('entryReportNote');
  var repErrEl    = document.getElementById('entryReportNoteError');
  var repCloseEl  = document.getElementById('entryReportClose');
  var resolveBtn  = document.getElementById('entrySaveResolve');

  var importedEl     = document.getElementById('entryImported');
  var importedTextEl = document.getElementById('entryImportedText');

  var row   = null;
  var dirty = false;

  var richtexts = {};

  var building = false;

  backBtn.setAttribute('href', 'content.html?type=' + type);
  document.title = (id ? 'Edit' : 'New') + ' ' + cfg.label.toLowerCase() + ' — MedCare';

  function fieldId(field) { return 'f_' + field.name; }

  function offList(field, value) {
    if (field.type !== 'select' || value === '' || value === null || value === undefined) {
      return false;
    }
    return !(field.options || []).some(function (o) {
      return String(typeof o === 'string' ? o : o.value) === String(value);
    });
  }

  function controlHtml(field, value) {
    var common = 'id="' + fieldId(field) + '" name="' + field.name + '"' +
                 (field.max ? ' maxlength="' + (field.max + 40) + '"' : '') +
                 (field.placeholder ? ' placeholder="' + ed.esc(field.placeholder) + '"' : '');

    switch (field.type) {
      case 'textarea':
        return '<div class="mc-auth-field"><textarea ' + common + ' rows="3">' +
               ed.esc(value) + '</textarea></div>';

      case 'select':
        var opts = (field.options || []).map(function (o) {
          var v = typeof o === 'string' ? o : o.value;
          var t = typeof o === 'string' ? o : o.text;
          return '<option value="' + ed.esc(v) + '"' +
                 (String(value) === String(v) ? ' selected' : '') + '>' + ed.esc(t) + '</option>';
        }).join('');
        var strayOpt = offList(field, value)
          ? '<option value="' + ed.esc(value) + '" selected>' + ed.esc(value) +
            ' — not on the list</option>'
          : '';
        return '<div class="mc-auth-field"><select ' + common + '>' +
                 '<option value="">Choose…</option>' + strayOpt + opts +
               '</select></div>';

      case 'checkbox':
        return '<div class="form-check" style="padding-left:1.7rem">' +
                 '<input class="form-check-input" type="checkbox" ' + common +
                   (value ? ' checked' : '') + '>' +
                 '<label class="form-check-label" for="' + fieldId(field) + '" ' +
                   'style="font-size:.94rem;cursor:pointer">' + ed.esc(field.label) + '</label>' +
               '</div>';

      case 'richtext':
        return '<div class="mc-ed-rt" data-rt="' + field.name + '">' +
                 '<div class="mc-ed-rt-loading" data-rt-loading>' +
                   '<i class="bi bi-hourglass-split"></i> Loading the editor…' +
                 '</div>' +
                 '<div id="' + fieldId(field) + '" class="mc-ed-rt-host"></div>' +
               '</div>';

      case 'image':
        return '<div class="mc-ed-drop" data-drop="' + field.name + '">' +
                 '<div class="mc-ed-drop-zone" data-drop-zone tabindex="0" role="button" ' +
                      'aria-label="Drop an image here, or press Enter to choose a file">' +
                   '<span class="mc-ed-drop-preview" data-drop-preview>' +
                     '<i class="bi bi-image"></i>' +
                   '</span>' +
                   '<span class="mc-ed-drop-words">' +
                     '<b data-drop-title>Drag an image here</b>' +
                     '<small data-drop-sub>or choose a file. JPEG, PNG, WebP or AVIF, up to 3 MB.</small>' +
                   '</span>' +
                   '<input type="file" hidden data-drop-input ' +
                     'accept="image/jpeg,image/png,image/webp,image/avif">' +
                 '</div>' +
                 '<div class="mc-ed-drop-bar" data-drop-bar hidden><span></span></div>' +
                 '<p class="mc-ed-error" data-drop-error hidden></p>' +
                 '<div class="mc-ed-drop-path">' +
                   '<div class="mc-auth-field"><input type="text" ' + common +
                     ' value="' + ed.esc(value) + '" autocomplete="off"></div>' +
                   '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-pick="' +
                     field.name + '"><i class="bi bi-images"></i> Library</button>' +
                 '</div>' +
               '</div>';

      default:
        var input = '<div class="mc-auth-field"><input type="' +
                    (field.type === 'url' ? 'url' : field.type === 'tel' ? 'tel' : 'text') +
                    '" ' + common + ' value="' + ed.esc(value) + '" autocomplete="off"></div>';

        if (field.name === 'icon') {
          return '<div class="mc-ed-icon-row">' +
                   '<div>' + input + '</div>' +
                   '<span class="mc-ed-icon-preview" data-icon-preview><i class="bi"></i></span>' +
                 '</div>';
        }
        return input;
    }
  }

  function fieldHtml(field, value) {
    if (field.type === 'checkbox') {

      return '<div class="mc-ed-field" data-field="' + field.name + '">' +
               controlHtml(field, value) +
               (field.hint ? '<p class="mc-admin-hint">' + ed.esc(field.hint) + '</p>' : '') +
               '<p class="mc-ed-error" hidden></p>' +
             '</div>';
    }

    return '<div class="mc-ed-field' + (field.my ? ' mc-ed-field--my' : '') +
             '" data-field="' + field.name + '">' +
             '<div class="mc-ed-label-row">' +
               '<label class="mc-auth-label" for="' + fieldId(field) + '">' + ed.esc(field.label) + '</label>' +
               (field.required
                 ? '<span class="mc-ed-req">Required</span>'
                 : '<span class="mc-ed-optional">Optional</span>') +
               (field.max ? '<span class="mc-ed-count-chars" data-chars></span>' : '') +
             '</div>' +
             controlHtml(field, value) +
             (field.hint ? '<p class="mc-admin-hint">' + ed.esc(field.hint) + '</p>' : '') +
             (field.type === 'select' ? '<p class="mc-ed-stray" data-stray hidden></p>' : '') +
             '<p class="mc-ed-error" hidden></p>' +
             confirmHtml(field) +
           '</div>';
  }

  function confirmHtml(field) {
    if (!field.confirm) { return ''; }
    return '<div class="mc-confirm-field" data-confirm-for="' + field.name + '" hidden ' +
             'style="margin-top:.9rem">' +
             '<label class="mc-auth-label" for="c_' + field.name + '">' +
               'Type the new ' + ed.esc(field.label.toLowerCase()) + ' again' +
             '</label>' +
             '<div class="mc-auth-field">' +
               '<input type="' + (field.type === 'tel' ? 'tel' : 'text') + '" id="c_' + field.name +
                 '" autocomplete="off" data-confirm>' +
             '</div>' +
             '<p class="mc-ed-error" data-confirm-error hidden></p>' +
           '</div>';
  }

  function build(values) {
    var html = '';
    var fields = cfg.fields;

    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var next  = fields[i + 1];

      if (next && next.my && !field.my) {
        html += '<div class="mc-ed-pair">' +
                  fieldHtml(field, values[field.name]) +
                  fieldHtml(next,  values[next.name]) +
                '</div>';
        i++;
        continue;
      }
      html += fieldHtml(field, values[field.name]);
    }

    building = true;

    richtexts = {};
    hostEl.innerHTML = html;
    cfg.fields.forEach(wire);
    refreshIcon();
    refreshThumbs();
    building = false;
    markClean();
  }

  function control(name) { return hostEl.querySelector('#f_' + name); }

  function valueOf(field) {

    if (field.type === 'richtext') {
      var rt = richtexts[field.name];
      if (!rt) { return row && row[field.name] != null ? row[field.name] : null; }
      var html = rt.getHTML();
      return html === '' ? null : html;
    }

    var el = control(field.name);
    if (!el) { return null; }
    if (field.type === 'checkbox') { return el.checked; }
    var v = el.value.trim();

    return v === '' ? (field.required ? '' : null) : v;
  }

  function collect() {
    var out = {};
    cfg.fields.forEach(function (field) { out[field.name] = valueOf(field); });
    return out;
  }

  function fieldError(field, value) {
    if (field.required && (value === '' || value === null || value === undefined)) {
      return 'This one is needed.';
    }

    var measured = field.type === 'richtext' && value
      ? window.MedCareRichText.textOf(value)
      : value;

    if (field.max && measured && String(measured).length > field.max) {
      var over = String(measured).length - field.max;
      return 'Too long by ' + over + ' character' + (over === 1 ? '' : 's') + '.';
    }
    if (field.type === 'url' && value && !ed.sourceLooksApproved(value)) {
      return 'Sources have to be WHO (who.int) or the Myanmar Ministry of Health ' +
             '(mohs.gov.mm). The database will refuse anything else.';
    }
    if (field.name === 'href' && value && /^https?:\/\//i.test(value)) {
      return 'This is a path inside the site, not a full address — "diseases/dengue.html".';
    }
    return null;
  }

  function confirmError(field) {
    if (!field.confirm) { return null; }
    var box = hostEl.querySelector('[data-confirm-for="' + field.name + '"]');
    if (!box || box.hidden) { return null; }
    var typed = box.querySelector('[data-confirm]').value.trim();
    var value = String(valueOf(field) || '');
    if (typed !== value) { return 'The two do not match.'; }
    return null;
  }

  function showError(field, text) {
    var wrap = hostEl.querySelector('[data-field="' + field.name + '"]');
    if (!wrap) { return; }
    var p = wrap.querySelector('.mc-ed-error');
    wrap.classList.toggle('is-bad', !!text);
    if (text) {
      p.innerHTML = '<i class="bi bi-exclamation-circle"></i><span>' + ed.esc(text) + '</span>';
      p.hidden = false;
    } else {
      p.hidden = true; p.textContent = '';
    }
  }

  function offListNote(field) {
    var wrap = hostEl.querySelector('[data-field="' + field.name + '"]');
    var p = wrap && wrap.querySelector('[data-stray]');
    if (!p) { return; }

    var el = control(field.name);
    var value = el ? el.value : '';
    if (!offList(field, value)) { p.hidden = true; p.textContent = ''; return; }

    p.innerHTML = '<i class="bi bi-exclamation-triangle"></i><span>' +
      ed.esc('“' + value + '” is not one of the choices here — an older spelling, most ' +
             'likely. It is kept, so saving cannot quietly change it, but it will go on ' +
             'grouping on its own in the public filters until somebody picks the right one.') +
      '</span>';
    p.hidden = false;
  }

  function validate(quiet) {
    var firstBad = null;

    cfg.fields.forEach(function (field) {
      var problem = fieldError(field, valueOf(field)) || confirmError(field);
      if (!quiet) { showError(field, problem); }
      if (problem && !firstBad) { firstBad = field; }
    });

    return firstBad;
  }

  function wire(field) {

    if (field.type === 'richtext') { wireRichText(field); return; }

    var el = control(field.name);
    if (!el) { return; }

    if (field.type === 'image') { wireDropzone(field); }

    var counter = hostEl.querySelector('[data-field="' + field.name + '"] [data-chars]');
    var confirmBox = hostEl.querySelector('[data-confirm-for="' + field.name + '"]');
    var original = row ? (row[field.name] == null ? '' : String(row[field.name])) : '';

    function onInput() {
      markDirty();

      if (counter && field.max) {
        var len = el.value.length;

        if (len > field.max) {
          counter.textContent = (len - field.max) + ' over';
          counter.setAttribute('data-over', 'true');
          counter.removeAttribute('data-near');
        } else if (len > field.max * 0.85) {
          counter.textContent = (field.max - len) + ' left';
          counter.setAttribute('data-near', 'true');
          counter.removeAttribute('data-over');
        } else {
          counter.textContent = '';
          counter.removeAttribute('data-near');
          counter.removeAttribute('data-over');
        }
      }

      if (confirmBox) {
        var changed = el.value.trim() !== original.trim();
        if (confirmBox.hidden === changed) {
          confirmBox.hidden = !changed;
          if (!changed) { confirmBox.querySelector('[data-confirm]').value = ''; }
        }
      }

      if (field.name === 'icon')   { refreshIcon(); }
      if (field.type === 'image')  { refreshThumbs(); }
      if (field.type === 'select') { offListNote(field); }

      var wrap = hostEl.querySelector('[data-field="' + field.name + '"]');
      if (wrap.classList.contains('is-bad') && !fieldError(field, valueOf(field))) {
        showError(field, null);
      }
    }

    el.addEventListener('input', onInput);
    el.addEventListener('change', onInput);

    el.addEventListener('blur', function () {
      showError(field, fieldError(field, valueOf(field)) || confirmError(field));
    });

    if (confirmBox) {
      confirmBox.querySelector('[data-confirm]').addEventListener('input', function () {
        markDirty();
        var p = confirmBox.querySelector('[data-confirm-error]');
        var problem = confirmError(field);
        if (problem) {
          p.innerHTML = '<i class="bi bi-exclamation-circle"></i><span>' + ed.esc(problem) + '</span>';
          p.hidden = false;
        } else {
          p.hidden = true;
        }
      });
    }

    onInput();
  }

  function refreshIcon() {
    var el = control('icon');
    var preview = hostEl.querySelector('[data-icon-preview] i');
    if (!el || !preview) { return; }
    var name = el.value.trim();
    preview.className = 'bi ' + (name || 'bi-question-lg');
    preview.parentNode.classList.toggle('is-empty', !name);
  }

  function wireRichText(field) {
    var host = control(field.name);
    var wrap = hostEl.querySelector('[data-rt="' + field.name + '"]');
    if (!host || !wrap || !window.MedCareRichText) { return; }

    var loadingEl = wrap.querySelector('[data-rt-loading]');
    var counter   = hostEl.querySelector('[data-field="' + field.name + '"] [data-chars]');

    function count() {
      if (!counter || !field.max) { return; }
      var rt = richtexts[field.name];
      var len = rt ? rt.getText().length : 0;

      if (len > field.max) {
        counter.textContent = (len - field.max) + ' over';
        counter.setAttribute('data-over', 'true');
        counter.removeAttribute('data-near');
      } else if (len > field.max * 0.85) {
        counter.textContent = (field.max - len) + ' left';
        counter.setAttribute('data-near', 'true');
        counter.removeAttribute('data-over');
      } else {
        counter.textContent = '';
        counter.removeAttribute('data-near');
        counter.removeAttribute('data-over');
      }
    }

    window.MedCareRichText.create(host, {
      placeholder: field.placeholder || 'Write the article here…',
      onChange: function () { markDirty(); count(); },

      onImage: function (insert) {
        openLibrary(function (url) { insert(url); });
      }
    }).then(function (handle) {
      richtexts[field.name] = handle;
      if (loadingEl) { loadingEl.remove(); }
      handle.setHTML(row && row[field.name] != null ? row[field.name] : '');
      handle.setEnabled(!isLocked());
      count();

      var stored = row && row[field.name];
      if (!window.MedCareImport || !row || !row.href) { return; }
      if (stored && String(stored).trim()) { return; }

      window.MedCareImport.fromPage(row.href).then(function (found) {
        if (!found) { return; }
        var html = field.my ? found.my : found.en;
        if (!html || !window.MedCareSanitize.textOf(html)) { return; }
        if (handle.getText()) { return; }

        handle.setHTML(html);
        count();
        noteImported(row.href);
      });
    }).catch(function (err) {

      if (loadingEl) {
        loadingEl.className = 'mc-ed-error';
        loadingEl.removeAttribute('hidden');
        loadingEl.textContent = err && err.message
          ? err.message
          : 'The text editor could not be loaded. Your existing text is safe and will not be overwritten.';
      }
    });
  }

  function wireDropzone(field) {
    var wrap = hostEl.querySelector('[data-drop="' + field.name + '"]');
    var input = control(field.name);
    if (!wrap || !input) { return; }

    var zone    = wrap.querySelector('[data-drop-zone]');
    var fileIn  = wrap.querySelector('[data-drop-input]');
    var bar     = wrap.querySelector('[data-drop-bar]');
    var errEl   = wrap.querySelector('[data-drop-error]');
    var titleEl = wrap.querySelector('[data-drop-title]');

    function say(text) {
      if (!errEl) { return; }
      errEl.hidden = !text;
      errEl.textContent = text || '';
    }

    function busy(on) {
      if (bar) { bar.hidden = !on; }
      zone.classList.toggle('is-busy', !!on);
      if (titleEl) { titleEl.textContent = on ? 'Uploading…' : 'Drag an image here'; }
    }

    function take(file) {
      if (!file) { return; }
      if (isLocked()) { say('This page is live, so its image cannot be changed here.'); return; }

      say(null);
      busy(true);
      ed.uploadImage(file)
        .then(function (res) {
          busy(false);

          input.value = res.url;
          markDirty();
          refreshThumbs();
          showError(field, null);
        })
        .catch(function (err) {
          busy(false);

          say(err && err.message ? err.message : ed.describeError(err, 'the image library'));
        });
    }

    ['dragenter', 'dragover'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) {
        e.preventDefault();
        if (!isLocked()) { zone.classList.add('is-over'); }
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) {
        e.preventDefault();
        zone.classList.remove('is-over');
      });
    });
    zone.addEventListener('drop', function (e) {
      take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });

    zone.addEventListener('click', function () { if (!isLocked()) { fileIn.click(); } });
    zone.addEventListener('keydown', function (e) {

      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zone.click(); }
    });
    fileIn.addEventListener('change', function () {
      take(fileIn.files[0]);
      fileIn.value = '';
    });
  }

  function refreshThumbs() {
    cfg.fields.forEach(function (field) {
      if (field.type !== 'image') { return; }
      var el = control(field.name);
      var box = hostEl.querySelector('[data-drop="' + field.name + '"] [data-drop-preview]');
      if (!el || !box) { return; }
      var src = el.value.trim();
      if (src) {

        var url = /^https?:\/\//i.test(src) ? src : '../' + src.replace(/^\/+/, '');
        box.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        box.innerHTML = '';
      } else {
        box.style.backgroundImage = '';
        box.innerHTML = '<i class="bi bi-image"></i>';
      }
    });
  }

  hostEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pick]');
    if (btn) { pickImage(btn.getAttribute('data-pick')); }
  });

  function pickImage(fieldName) {
    openLibrary(function (url) {
      control(fieldName).value = url;
      markDirty();
      refreshThumbs();
    });
  }

  function openLibrary(onPick) {
    var host = document.createElement('div');
    host.className = 'mc-modal is-open';
    host.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-label="Choose an image" ' +
           'style="max-width:640px;text-align:left">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<h2 style="text-align:left">Choose an image</h2>' +
        '<div id="pickHost"><div class="mc-skeleton" aria-hidden="true"><span></span><span></span></div></div>' +
      '</div>';
    document.body.appendChild(host);

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { host.remove(); return; }
      var tile = e.target.closest('[data-path]');
      if (tile) {
        var url = tile.getAttribute('data-path');
        host.remove();
        onPick(url);
      }
    });

    db.storage.from('content-images').list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(function (res) {
        var box = host.querySelector('#pickHost');
        var files = (res.data || []).filter(function (f) { return f.id; });

        if (res.error || !files.length) {
          box.innerHTML =
            '<div class="mc-state mc-state--empty">' +
              '<span class="mc-state-ico"><i class="bi bi-images"></i></span>' +
              '<h2>Nothing in the library yet</h2>' +
              '<p>' + (res.error
                ? ed.esc(ed.describeError(res.error, 'the image library'))
                : 'Upload an image first and it will appear here.') + '</p>' +
              '<a class="mc-auth-btn" href="media.html">Go to Images</a>' +
            '</div>';
          return;
        }

        box.innerHTML = '<div class="mc-ed-media">' + files.map(function (f) {
          var url = db.storage.from('content-images').getPublicUrl(f.name).data.publicUrl;
          return '<button type="button" class="mc-ed-media-item" data-path="' + ed.esc(url) + '" ' +
                   'style="border:1px solid var(--mc-border);background:#fff;padding:0;text-align:left;cursor:pointer">' +
                   '<span class="mc-ed-media-shot" style="display:block;background-image:url(&quot;' +
                     ed.esc(url) + '&quot;)"></span>' +
                   '<span class="mc-ed-media-body"><span class="mc-ed-media-name">' +
                     ed.esc(f.name) + '</span></span>' +
                 '</button>';
        }).join('') + '</div>';
      });
  }

  function markDirty() {
    if (building || dirty) { return; }
    dirty = true;
    dirtyEl.hidden = false;
  }

  function markClean() {
    dirty = false;
    dirtyEl.hidden = true;
  }

  ed.guardUnsaved(function () { return dirty; });

  function isLocked() {
    return !!(row && !ed.canEditNow(row.status, guard.isAdmin()));
  }

  function applyLock() {
    var locked = isLocked();

    lockEl.hidden = !locked;
    saveBtn.hidden = !!locked;
    saveBtn.disabled = !!locked;

    if (locked) { lockText.textContent = ed.lockedNote(row.status, guard.isAdmin()); }

    hostEl.querySelectorAll('input, textarea, select, button').forEach(function (el) {

      el.disabled = !!locked;
    });

    Object.keys(richtexts).forEach(function (name) {
      richtexts[name].setEnabled(!locked);
    });

    hostEl.querySelectorAll('[data-drop-zone]').forEach(function (zone) {
      zone.classList.toggle('is-locked', !!locked);
    });
  }

  unlockBtn.addEventListener('click', function () {
    var btn = wfActs.querySelector('[data-move="draft"]');
    if (btn) { btn.click(); return; }
    ed.message(msgEl, 'error',
      'This row cannot be taken off the site from here. Reload the page and try again.');
  });

  function drawWorkflow() {
    if (!row) { wfEl.hidden = true; return; }
    wfEl.hidden = false;

    var status = ed.STATUSES[row.status] ? row.status : 'draft';
    wfPill.innerHTML = ed.statusPill(status);

    var waiting = ed.waitingNote(status, guard.isAdmin());
    wfHint.textContent = ed.STATUSES[status].hint + (waiting ? ' ' + waiting : '');

    wfActs.innerHTML = ed.movesFrom(status, guard.isAdmin()).map(function (m) {
      return '<button type="button" class="mc-auth-btn' +
               (m.danger ? ' mc-auth-btn--danger' : (m.primary ? '' : ' mc-auth-btn--ghost')) +
               '" data-move="' + m.to + '">' + ed.esc(m.label) + '</button>';
    }).join('');
  }

  wfActs.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-move]');
    if (!btn) { return; }

    var to = btn.getAttribute('data-move');
    var spec = ed.movesFrom(row.status, guard.isAdmin())
                 .filter(function (m) { return m.to === to; })[0];
    if (!spec) { return; }
    var title = row[cfg.titleField] || 'this entry';

    if (dirty) {
      ed.message(msgEl, 'error',
        'Save your changes first — otherwise this would publish the version that is ' +
        'in the database, not the one on your screen.');
      return;
    }

    var ask = spec && spec.confirm
      ? ed.confirmDialog({
          title: spec.label + ' “' + title + '”?',
          body: spec.confirm,
          go: spec.label,
          danger: !!spec.danger
        })
      : Promise.resolve(true);

    ask.then(function (yes) {
      if (!yes) { return; }
      wfActs.querySelectorAll('button').forEach(function (b) { b.disabled = true; });

      ed.setStatus(type, row.id, to).then(function (res) {
        if (res.error) { throw res.error; }
        row = res.data;
        drawWorkflow();
        applyLock();
        drawTouched();

        ed.message(msgEl, 'ok', (to === 'draft' && !guard.isAdmin())
          ? 'Off the site, and yours to edit. Submit it for review when you are done.'
          : 'Now ' + ed.STATUSES[to].label.toLowerCase() + '.');
      }).catch(function (err) {
        drawWorkflow();
        applyLock();
        ed.message(msgEl, 'error', ed.describeError(err, 'this ' + cfg.label.toLowerCase()));
      });
    });
  });

  function drawTouched() {
    if (!row) { touchedEl.hidden = true; return; }
    ed.loadNames([row.created_by, row.updated_by]).then(function (names) {
      var made = row.created_by && names[row.created_by];
      var last = row.updated_by && names[row.updated_by];
      touchedEl.hidden = false;
      touchedEl.innerHTML =
        (made ? 'Written by <b>' + ed.esc(made) + '</b>. ' : '') +
        'Last changed ' + (last ? 'by <b>' + ed.esc(last) + '</b> ' : '') +
        ed.esc(ed.when(row.updated_at)) + '.';
    });
  }

  function noteImported(href) {
    if (!importedEl || !importedEl.hidden) { return; }
    importedTextEl.innerHTML =
      'The text below was read out of <b>' + ed.esc(href) + '</b>, the page this ' +
      'entry points at. <b>Nothing is saved yet.</b> Check it, then press Save to ' +
      'move it into the database - after that the reader page is served from here ' +
      'rather than from the file.';
    importedEl.hidden = false;
  }

  function loadReport() {
    if (!reportId || !/^\d+$/.test(String(reportId)) || !repEl) { return; }

    db.from('reports').select('*').eq('id', reportId).maybeSingle()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data) { return; }
        reportRow = res.data;
        drawReport();
      })
      .catch(function (err) {
        console.warn('[MedCare] Could not load report #' + reportId + ':', err);
      });
  }

  var CATEGORY_LABELS = {
    inaccuracy:  'Medical inaccuracy',
    typo:        'Typo',
    broken_link: 'Broken link',
    other:       'Other'
  };

  function drawReport() {
    var r = reportRow;
    var closed = r.status !== 'open';

    repCatEl.textContent = CATEGORY_LABELS[r.category] || r.category || 'Other';
    repCatEl.className = 'mc-admin-pill mc-report-cat mc-report-cat--' + (r.category || 'other');

    repReasonEl.textContent = r.reason || '';
    if (r.detail) {
      repDetailEl.textContent = r.detail;
      repDetailEl.hidden = false;
    }

    repMetaEl.textContent = closed
      ? 'Filed ' + ed.when(r.created_at) + ' · already ' +
        (r.status === 'dismissed' ? 'rejected' : 'resolved')
      : 'Filed ' + ed.when(r.created_at) + ' · still open';

    if (closed) {
      repEl.classList.add('is-resolved');
      repNoteEl.value = r.resolution_note || '';
      repNoteEl.disabled = true;
      repNoteEl.previousElementSibling.textContent = 'What was done about it';
      resolveBtn.hidden = true;
    } else {
      resolveBtn.hidden = false;
    }

    repEl.hidden = false;
  }

  if (repCloseEl) {
    repCloseEl.addEventListener('click', function () { repEl.hidden = true; });
  }

  function reportNoteOk() {
    var note = repNoteEl.value.trim();
    if (note.length >= 4) {
      repErrEl.hidden = true;
      return note;
    }
    repErrEl.textContent = 'Say what you did about it before closing the report.';
    repErrEl.hidden = false;
    repEl.hidden = false;
    repNoteEl.focus();
    repNoteEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return null;
  }

  function closeReport(note) {
    return db.from('reports')
      .update({ status: 'resolved', resolution_note: note })
      .eq('id', reportRow.id)
      .select()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data || !res.data.length) {
          throw new Error('The database did not permit that change.');
        }
        reportRow = res.data[0];
        drawReport();
        return reportRow;
      });
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();

    var alsoResolve = !!(e.submitter && e.submitter.id === 'entrySaveResolve') &&
                      !!reportRow && reportRow.status === 'open';

    var note = null;
    if (alsoResolve) {
      note = reportNoteOk();
      if (!note) { return; }
    }

    if (row && !ed.canEditNow(row.status, guard.isAdmin())) {
      ed.message(msgEl, 'error', ed.lockedNote(row.status, guard.isAdmin()));
      return;
    }

    var bad = validate(false);
    if (bad) {
      var el = control(bad.name);
      if (el) {

        var rt = richtexts[bad.name];
        if (rt) { rt.focus(); } else { el.focus(); }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      ed.message(msgEl, 'error', 'Some fields need another look before this can be saved.');
      return;
    }

    var values = collect();
    saveBtn.disabled = true;
    ed.message(msgEl, null);

    ed.saveRow(type, id, values, guard.getUser().id).then(function (res) {
      if (res.error) { throw res.error; }
      var wasNew = !id;
      row = res.data;
      id = String(row.id);
      markClean();
      drawWorkflow();
      drawTouched();
      saveBtn.disabled = false;

      if (wasNew) {

        window.history.replaceState(null, '', 'entry.html?type=' + type + '&id=' + id +
          (reportId ? '&report=' + encodeURIComponent(reportId) : ''));
        headingEl.textContent = cfg.label;
        ed.message(msgEl, 'ok',
          'Saved as a draft. It is not on the public site until somebody publishes it.');
      } else {
        ed.message(msgEl, 'ok', 'Saved.');
      }

      build(row);

      if (alsoResolve) {
        return closeReport(note).then(function () {
          ed.message(msgEl, 'ok', 'Saved, and the report is closed.');
        }, function (err) {

          console.error('[MedCare] Could not close report #' + reportRow.id + ':', err);
          ed.message(msgEl, 'error',
            'Your changes are saved, but the report could not be closed. ' +
            'Try the button again, or close it from the reports queue.');
        });
      }

    }).catch(function (err) {
      saveBtn.disabled = false;
      ed.message(msgEl, 'error', ed.describeError(err, 'this ' + cfg.label.toLowerCase()));
    });
  });

  guard.ready.then(function () {
    loadReport();

    if (!id) {
      headingEl.textContent = 'New ' + cfg.label.toLowerCase();
      subEl.textContent = 'It saves as a draft. Nobody outside the team sees it until it is published.';
      var blank = {};
      cfg.fields.forEach(function (f) { blank[f.name] = f.type === 'checkbox' ? false : ''; });
      build(blank);
      wfEl.hidden = true;
      return;
    }

    headingEl.textContent = cfg.label;
    subEl.textContent = cfg.hrefHint || '';

    ed.getRow(type, id).then(function (res) {
      if (res.error) { throw res.error; }
      row = res.data;
      headingEl.textContent = row[cfg.titleField] || cfg.label;
      build(row);
      drawWorkflow();
      applyLock();
      drawTouched();
      markClean();
    }).catch(function (err) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--error">' +
          '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
          '<h2>Could not open this ' + ed.esc(cfg.label.toLowerCase()) + '</h2>' +
          '<p>' + ed.esc(ed.describeError(err, 'this ' + cfg.label.toLowerCase())) + '</p>' +
          '<a class="mc-auth-btn" href="content.html?type=' + type + '">Back to the list</a>' +
        '</div>';
      saveBtn.disabled = true;
    });
  });

})();
