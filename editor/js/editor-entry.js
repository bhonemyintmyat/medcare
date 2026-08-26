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

  var row   = null;     // what the database last told us this row is
  var dirty = false;

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

      case 'select':
        var opts = (field.options || []).map(function (o) {
          var v = typeof o === 'string' ? o : o.value;
          var t = typeof o === 'string' ? o : o.text;
          return '<option value="' + ed.esc(v) + '"' +
                 (String(value) === String(v) ? ' selected' : '') + '>' + ed.esc(t) + '</option>';
        }).join('');
        return '<div class="mc-auth-field"><select ' + common + '>' +
                 '<option value="">Choose…</option>' + opts +
               '</select></div>';

      case 'checkbox':
        return '<div class="form-check" style="padding-left:1.7rem">' +
                 '<input class="form-check-input" type="checkbox" ' + common +
                   (value ? ' checked' : '') + '>' +
                 '<label class="form-check-label" for="' + fieldId(field) + '" ' +
                   'style="font-size:.94rem;cursor:pointer">' + ed.esc(field.label) + '</label>' +
               '</div>';

      case 'image':
        return '<div class="mc-ed-thumb-row">' +
                 '<div>' +
                   '<div class="mc-auth-field"><input type="text" ' + common +
                     ' value="' + ed.esc(value) + '" autocomplete="off"></div>' +
                   '<div style="display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap">' +
                     '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-pick="' +
                       field.name + '" style="font-size:.84rem;padding:.35rem .9rem">' +
                       '<i class="bi bi-images"></i> Choose from the library</button>' +
                     '<a class="mc-auth-btn mc-auth-btn--ghost" href="media.html" target="_blank" ' +
                       'style="font-size:.84rem;padding:.35rem .9rem">Upload a new one</a>' +
                   '</div>' +
                 '</div>' +
                 '<span class="mc-ed-thumb" data-thumb="' + field.name + '">' +
                   '<i class="bi bi-image"></i></span>' +
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
    if (field.max && value && String(value).length > field.max) {
      return 'Too long by ' + (String(value).length - field.max) +
             ' character' + (String(value).length - field.max === 1 ? '' : 's') + '.';
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
    var el = control(field.name);
    if (!el) { return; }

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

      if (field.name === 'icon')  { refreshIcon(); }
      if (field.type === 'image') { refreshThumbs(); }

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

  function refreshThumbs() {
    cfg.fields.forEach(function (field) {
      if (field.type !== 'image') { return; }
      var el = control(field.name);
      var box = hostEl.querySelector('[data-thumb="' + field.name + '"]');
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

  function pickImage(fieldName) {
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
        control(fieldName).value = tile.getAttribute('data-path');
        markDirty();
        refreshThumbs();
        host.remove();
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
  function applyLock() {
    var locked = row && !ed.canEditNow(row.status, guard.isAdmin());

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
     Saving
     ================================================================ */

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();

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
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
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
        window.history.replaceState(null, '', 'entry.html?type=' + type + '&id=' + id);
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

    }).catch(function (err) {
      saveBtn.disabled = false;
      ed.message(msgEl, 'error', ed.describeError(err, 'this ' + cfg.label.toLowerCase()));
    });
  });

  /* ================================================================
     Start
     ================================================================ */

  guard.ready.then(function () {
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
