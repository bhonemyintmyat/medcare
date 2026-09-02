/* ============================================================
   MedCare — one entry (editor/entry.html)

     entry.html?type=disease            -> a new one
     entry.html?type=article&id=7       -> that one

   The form is built from MedCareEditor.TYPES rather than written out in
   the HTML. Three kinds of content sharing one screen is the reason:
   three hand-written forms are three places to forget the source field,
   and the fourth kind of content would be a fourth.

   Three things here are worth reading before changing them:

     * Validation runs as you type and again before saving, and neither
       run decides anything. The database has the same rules, and it is
       the one that refuses. What this buys is being told about a bad
       source URL while you are still looking at the field, instead of
       after you press Save.

     * The Burmese field sits beside its English rather than in a
       separate tab, because a translation is written while looking at
       what it translates.

     * Nothing is saved as you go. An autosave that publishes half a
       sentence about a disease is worse than losing the sentence, so
       leaving with unsaved work asks first and the answer can be no.
   ============================================================ */

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

  // The reported issue, when this page was opened from the queue.
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

  // Where imported body text came from, when it was imported.
  var importedEl     = document.getElementById('entryImported');
  var importedTextEl = document.getElementById('entryImportedText');

  var row   = null;     // what the database last told us this row is
  var dirty = false;

  /* field name -> the handle MedCareRichText.create() resolves to. Quill
     is fetched on demand, so between build() and that promise settling
     there is a real window in which a body field has no editor behind
     it. valueOf() below is written for that window. */
  var richtexts = {};

  /* True while build() is laying the form out. wire() finishes by calling
     its own input handler once, to set the character counters and the
     icon preview from the starting values — and without this flag that
     first call would report the form as edited before anybody had typed
     in it, arming the "unsaved changes" warning on a form nobody has
     touched. */
  var building = false;

  backBtn.setAttribute('href', 'content.html?type=' + type);
  document.title = (id ? 'Edit' : 'New') + ' ' + cfg.label.toLowerCase() + ' — MedCare';

  /* ================================================================
     Building the fields
     ================================================================ */

  function fieldId(field) { return 'f_' + field.name; }

  /* Does this select hold something it cannot offer? True only of a
     value that is really there: '' is the "Choose…" option, not a
     spelling that has gone missing. */
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
    /* maxlength is set ABOVE the real limit on purpose. A hard stop at
       the limit silently swallows the end of a pasted sentence and the
       person never learns why; letting it overflow and marking it red
       tells them there is too much and by how much. */

    switch (field.type) {
      case 'textarea':
        return '<div class="mc-auth-field"><textarea ' + common + ' rows="3">' +
               ed.esc(value) + '</textarea></div>';

      /* A select whose stored value is not one of its options gets that
         value back as an option of its own, at the top and marked.
         Townships are why: the field was free text until the list of 44
         replaced it, so rows exist spelled "Mayangon" where the list
         says "Mayangone". A plain select would show such a row as
         "Choose…" and rewrite it to '' or to whatever was picked the
         next time anybody saved the phone number — an edit nobody made,
         to a field nobody looked at. Kept instead, and offListNote()
         says out loud that it wants fixing. */
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

      /* The host Quill mounts into. Deliberately NOT an input: the value
         lives in the Quill instance, and valueOf() knows to ask the
         handle rather than read .value off this element. It keeps the
         f_<name> id so control() and the error/label plumbing that
         everything else uses still find it. */
      case 'richtext':
        return '<div class="mc-ed-rt" data-rt="' + field.name + '">' +
                 '<div class="mc-ed-rt-loading" data-rt-loading>' +
                   '<i class="bi bi-hourglass-split"></i> Loading the editor…' +
                 '</div>' +
                 '<div id="' + fieldId(field) + '" class="mc-ed-rt-host"></div>' +
               '</div>';

      /* An image field is a text input with a dropzone wrapped round it.
         The input keeps the f_<name> id and stays the single source of
         truth, so valueOf(), validate() and the read-only lock all work
         on it unchanged - the dropzone and the library picker are two
         ways of typing into the same box. Pasting a path still works,
         which matters when somebody has a URL and no file. */
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

        // The icon field draws what it names, beside the box.
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
      // The label is inside the control, so the header would repeat it.
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

  /* The second box for a value that has to be typed twice. It exists in
     the markup from the start but stays hidden until the value actually
     changes: asking somebody to retype a phone number they have not
     touched is how you teach them to copy and paste it, which defeats
     the entire point of asking twice. */
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

      // An English field and its Burmese partner share a row.
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
    // The old handles point at elements that are about to be replaced.
    richtexts = {};
    hostEl.innerHTML = html;
    cfg.fields.forEach(wire);
    refreshIcon();
    refreshThumbs();
    building = false;
    markClean();
  }

  /* ================================================================
     Reading the form back
     ================================================================ */

  function control(name) { return hostEl.querySelector('#f_' + name); }

  function valueOf(field) {
    /* Asked of the Quill handle, not of the DOM. And if the handle is
       not there yet - the library is still downloading, or failed to -
       the answer is what the row already held, NEVER ''. Returning empty
       here would let a quick Save silently wipe an article that is
       merely not on screen yet. */
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
    // An empty optional field is NULL, not ''. Two ways to say "nothing"
    // in one column is how you end up with `where thumb is not null`
    // returning rows with no thumbnail.
    return v === '' ? (field.required ? '' : null) : v;
  }

  function collect() {
    var out = {};
    cfg.fields.forEach(function (field) { out[field.name] = valueOf(field); });
    return out;
  }

  /* ================================================================
     Validation — a courtesy, not a gate. See the file header.
     ================================================================ */

  function fieldError(field, value) {
    if (field.required && (value === '' || value === null || value === undefined)) {
      return 'This one is needed.';
    }
    /* A body is measured in what a reader sees. Counting its markup
       would make a bolded word cost seventeen characters and turn the
       limit into a lottery. */
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

  /* Said in amber, not in red, and deliberately not a fieldError: a
     township spelled the old way is a row to correct, not a row to
     freeze. Making it an error would gate Save, and the save being
     gated would be somebody trying to fix a hospital's phone number at
     eleven at night and being told they may not until they have also
     decided what "Mayangon" was meant to say. */
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

  /* ================================================================
     Live behaviour on individual fields
     ================================================================ */

  function wire(field) {
    // Its value does not live in an input, so none of the plumbing
    // below applies to it.
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
        // Silent until it matters. See the note in editor.css.
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

      // Clear a shown error the moment it stops being true, but do not
      // start showing one while somebody is still typing the value.
      var wrap = hostEl.querySelector('[data-field="' + field.name + '"]');
      if (wrap.classList.contains('is-bad') && !fieldError(field, valueOf(field))) {
        showError(field, null);
      }
    }

    el.addEventListener('input', onInput);
    el.addEventListener('change', onInput);
    // Check on the way out, when the value is finished.
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

  /* ================================================================
     The body editor
     ================================================================ */

  /* One Quill per body field, created after the library arrives. The
     handle goes into `richtexts` so valueOf() can reach it; until then
     the loading strip stands in its place, because an empty grey box
     that will become an editor in 400ms reads as a broken form. */
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
      // Counted in words a reader sees, not in markup. <strong> is not
      // something anybody budgets for.
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

      /* The toolbar's image button borrows the same library picker the
         cover-image field uses, so there is one way to choose an image
         on this screen rather than two that behave differently. */
      onImage: function (insert) {
        openLibrary(function (url) { insert(url); });
      }
    }).then(function (handle) {
      richtexts[field.name] = handle;
      if (loadingEl) { loadingEl.remove(); }
      handle.setHTML(row && row[field.name] != null ? row[field.name] : '');
      handle.setEnabled(!isLocked());
      count();

      /* ---------- Nothing in the row, but a page on disk ----------
         Every article and disease here still lives as a hand-written
         file, with the row holding only the card and an `href`. So an
         empty `body` is the normal case rather than the exception, and
         showing an empty box for a page that plainly has words on it
         makes the editor look broken for exactly the twenty entries
         that already exist. Read them back instead.

         Three conditions, and all of them matter:

           row && row.href   there is a page to read
           stored is empty   an import NEVER overwrites stored text
           getText() empty   still true when the download lands, because
                             a slow fetch must not wipe out a sentence
                             somebody typed while waiting for it

         Filled through setHTML, which Quill applies silently, so the
         form does not come up already claiming unsaved changes. The
         note says the text is not saved until Save is pressed - which
         is the honest description of what has happened. */
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
      /* A body field that will not load is not a reason to lose the rest
         of the form, but it must not look like an empty article either -
         valueOf() keeps returning the stored value, and this says why
         the box is not there. */
      if (loadingEl) {
        loadingEl.className = 'mc-ed-error';
        loadingEl.removeAttribute('hidden');
        loadingEl.textContent = err && err.message
          ? err.message
          : 'The text editor could not be loaded. Your existing text is safe and will not be overwritten.';
      }
    });
  }

  /* ================================================================
     The cover-image dropzone
     ================================================================ */

  /* Drag a file on, or click to choose one. Either way it goes to the
     same bucket the media library uses, through the same size and type
     checks - see the note on those helpers in editor-api.js - and the
     resulting path is typed into the field's own text input, which
     remains the single source of truth. */
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
          /* The bucket returns an absolute URL. Stored as-is rather than
             trimmed to a path, because the reader pages and this form sit
             at different depths and a relative path would have to mean
             something different in each. */
          input.value = res.url;
          markDirty();
          refreshThumbs();
          showError(field, null);
        })
        .catch(function (err) {
          busy(false);
          // uploadImage rejects with a sentence already written for a
          // person when the file is the problem; anything else is the
          // network or the bucket.
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
      // The zone is a div with role=button, so it has to answer to the
      // keys a real button would.
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zone.click(); }
    });
    fileIn.addEventListener('change', function () {
      take(fileIn.files[0]);
      fileIn.value = '';        // so choosing the same file twice fires again
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
        // Relative paths in the table are relative to the site root, and
        // this page is one directory down.
        var url = /^https?:\/\//i.test(src) ? src : '../' + src.replace(/^\/+/, '');
        box.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        box.innerHTML = '';
      } else {
        box.style.backgroundImage = '';
        box.innerHTML = '<i class="bi bi-image"></i>';
      }
    });
  }

  /* ================================================================
     Picking an image out of the bucket
     ================================================================ */

  hostEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pick]');
    if (btn) { pickImage(btn.getAttribute('data-pick')); }
  });

  /* Writes the chosen address into a field. The library itself does not
     know about fields - see openLibrary() below - because the body
     editor's image button needs the same picker and has no field to
     write to. */
  function pickImage(fieldName) {
    openLibrary(function (url) {
      control(fieldName).value = url;
      markDirty();
      refreshThumbs();
    });
  }

  /* onPick(url) is called with the public address of whatever was
     chosen, and the dialog closes itself. Called with nothing if the
     person cancels - the callback simply never runs. */
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

  /* ================================================================
     Dirty state
     ================================================================ */

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

  /* ================================================================
     The lock on a live row
     ================================================================ */

  /* A published row is not an editor's to edit in place — the trigger in
     supabase_publish_approval.sql refuses it. Rather than let somebody
     type a page of corrections and then hand them a 42501, the fields go
     read-only and Save is replaced by the reason and the way out.

     Disabling rather than hiding the fields is deliberate: the editor
     came here to read the page as much as to change it, and a form that
     vanishes when you lack write access is harder to work with than one
     that is visibly locked. */
  /* Asked by the dropzone and the body editor as well as by applyLock(),
     both of which are wired before or after it runs and need the same
     answer. */
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
      /* Media pickers and the like live inside the field host and would
         otherwise stay clickable, offering to change a row that cannot
         be saved. */
      el.disabled = !!locked;
    });

    /* Quill is not an input and ignores `disabled`; it has to be told.
       Any body editor still downloading picks this up instead when its
       promise settles - see wireRichText(). */
    Object.keys(richtexts).forEach(function (name) {
      richtexts[name].setEnabled(!locked);
    });

    /* The dropzone is a div, so it too would stay droppable. take()
       re-checks isLocked() as well, because a file can be dropped
       between a status change and this running. */
    hostEl.querySelectorAll('[data-drop-zone]').forEach(function (zone) {
      zone.classList.toggle('is-locked', !!locked);
    });
  }

  /* The button inside the lock notice. It is the published -> draft move
     and nothing else, routed through the same handler the workflow strip
     uses so the confirmation and the error handling are not written
     twice. */
  unlockBtn.addEventListener('click', function () {
    var btn = wfActs.querySelector('[data-move="draft"]');
    if (btn) { btn.click(); return; }
    ed.message(msgEl, 'error',
      'This row cannot be taken off the site from here. Reload the page and try again.');
  });

  /* ================================================================
     The workflow strip
     ================================================================ */

  function drawWorkflow() {
    if (!row) { wfEl.hidden = true; return; }
    wfEl.hidden = false;

    var status = ed.STATUSES[row.status] ? row.status : 'draft';
    wfPill.innerHTML = ed.statusPill(status);

    /* The status hint, plus — for an editor looking at a row only an
       admin can move on — why the button they expected is not there. A
       missing control with no explanation is read as a broken page, and
       the person's next move is to file a bug rather than to submit the
       page for review. */
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
    if (!spec) { return; }     // not a move this person has, so not one to attempt
    var title = row[cfg.titleField] || 'this entry';

    /* Changing status with unsaved edits in the boxes would publish the
       saved version and silently leave the new text behind — which reads
       as the change having been published when it has not. */
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
        applyLock();      // taking it off the site is what unlocks the fields
        drawTouched();
        /* The draft message is different for an editor because for them
           it is the moment the form unlocks, which is the thing they
           came here to do. An admin was never locked out. */
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

  /* ================================================================
     Where the body text came from
     ================================================================ */

  /* Said once, however many body fields were filled. Two notes for the
     English and the Burmese of the same page would be two ways of saying
     the same sentence. */
  function noteImported(href) {
    if (!importedEl || !importedEl.hidden) { return; }
    importedTextEl.innerHTML =
      'The text below was read out of <b>' + ed.esc(href) + '</b>, the page this ' +
      'entry points at. <b>Nothing is saved yet.</b> Check it, then press Save to ' +
      'move it into the database - after that the reader page is served from here ' +
      'rather than from the file.';
    importedEl.hidden = false;
  }

  /* ================================================================
     The reported issue
     ================================================================ */

  /* Loaded on its own rather than with the entry: a report that cannot
     be read is not a reason to refuse to open the page it is about. The
     staff select policy is what allows this at all - an editor matches
     "Staff read every report", a plain account would see nothing. */
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

    // Reader-supplied. textContent, never innerHTML.
    repReasonEl.textContent = r.reason || '';
    if (r.detail) {
      repDetailEl.textContent = r.detail;
      repDetailEl.hidden = false;
    }

    repMetaEl.textContent = closed
      ? 'Filed ' + ed.when(r.created_at) + ' · already ' +
        (r.status === 'dismissed' ? 'rejected' : 'resolved')
      : 'Filed ' + ed.when(r.created_at) + ' · still open';

    /* An already-closed report is left on screen rather than hidden. The
       editor followed a link to it and deserves to be told what happened
       to it, and the note somebody wrote is the most useful thing on the
       page for whoever arrives second. */
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

  /* Bootstrap's alert CSS is loaded here; its JS bundle is not, so
     data-bs-dismiss would silently do nothing. */
  if (repCloseEl) {
    repCloseEl.addEventListener('click', function () { repEl.hidden = true; });
  }

  /* The note is required, and that is a deliberate cost. The queue is
     small and the temptation to clear it with a row of clicks is real; a
     sentence is what makes somebody decide rather than tidy. It is also
     the only record of what was done - see the header of
     editor-reports.js, which asks for the same thing at the same
     moment. */
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

  /* status and resolution_note are the only two columns `authenticated`
     holds an UPDATE grant on, so this payload is not a matter of
     tidiness - adding a third would fail the whole statement before RLS
     was consulted. resolved_by and resolved_at are set by a trigger from
     the verified token, which is why they are absent and why they cannot
     be made to lie.

     .select() is what tells success from a silent refusal: an account
     without the staff role gets 200 and an EMPTY array, because the
     grant let the statement run and RLS then matched no rows. */
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

  /* ================================================================
     Saving
     ================================================================ */

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Which button was pressed. Both are type=submit on the same form so
       there is one save path; only what happens after it differs.
       e.submitter is not in older Safari, and the fallback of "a report
       is attached, so they must have meant resolve" would be wrong - it
       would resolve on a plain Save. Falling back to NOT resolving is
       the safe direction: the worst case is an editor pressing the
       button again. */
    var alsoResolve = !!(e.submitter && e.submitter.id === 'entrySaveResolve') &&
                      !!reportRow && reportRow.status === 'open';

    /* Checked before the row is saved, not after. Refusing the note when
       the entry is already written would leave the editor looking at a
       saved page and an error about something else. */
    var note = null;
    if (alsoResolve) {
      note = reportNoteOk();
      if (!note) { return; }
    }

    /* The fields are disabled and the button is gone, so this should be
       unreachable on a live row. Checked anyway: a form can still be
       submitted by other routes, and the failure mode without this is a
       42501 from the database rather than a sentence that explains. */
    if (row && !ed.canEditNow(row.status, guard.isAdmin())) {
      ed.message(msgEl, 'error', ed.lockedNote(row.status, guard.isAdmin()));
      return;
    }

    var bad = validate(false);
    if (bad) {
      var el = control(bad.name);
      if (el) {
        // A body field's control is the div Quill mounted into, and a
        // div does not take focus. Ask the editor instead, or the form
        // scrolls to the problem and leaves the cursor elsewhere.
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
        /* Put the id in the URL so a reload reopens the row that now
           exists rather than a blank form — pressing Save twice on a new
           entry should not make two of it. pushState, because this IS a
           different place: the entry has become a thing with an address. */
        window.history.replaceState(null, '', 'entry.html?type=' + type + '&id=' + id +
          (reportId ? '&report=' + encodeURIComponent(reportId) : ''));
        headingEl.textContent = cfg.label;
        ed.message(msgEl, 'ok',
          'Saved as a draft. It is not on the public site until somebody publishes it.');
      } else {
        ed.message(msgEl, 'ok', 'Saved.');
      }

      /* Rebuild from what came back rather than re-wiring what is on
         screen. Re-wiring would add a second set of listeners to the same
         elements on every save, and it would leave the type-it-twice boxes
         comparing against the OLD value — so the next edit of a phone
         number would not ask for confirmation. Redrawing throws the stale
         listeners away with the nodes and re-seats every baseline on the
         row the database now holds. */
      build(row);      // build() ends by marking the form clean

      /* The page is saved. Only now is the report closed, and in this
         order on purpose: a report marked resolved against a correction
         that failed to save is a lie in the audit trail, and the next
         person reads that trail to decide whether to trust the page. */
      if (alsoResolve) {
        return closeReport(note).then(function () {
          ed.message(msgEl, 'ok', 'Saved, and the report is closed.');
        }, function (err) {
          /* Caught here rather than falling through to the handler
             below, which would say the entry could not be saved. It
             was saved — that already happened and it stands. Only the
             report is still open, and saying anything else would put
             the editor to work redoing an edit that is already in the
             database. */
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

  /* ================================================================
     Start
     ================================================================ */

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
      applyLock();          // after build(), which creates the fields it disables
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
