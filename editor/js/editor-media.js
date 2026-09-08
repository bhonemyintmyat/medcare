

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  if (!guard || !ed) { return; }

  
  var BUCKET    = ed.IMAGE_BUCKET;
  var MAX_BYTES = ed.MAX_IMAGE_BYTES;
  var TYPES     = ed.IMAGE_TYPES;

  var hostEl     = document.getElementById('mediaHost');
  var msgEl      = document.getElementById('mediaMsg');
  var dropEl     = document.getElementById('dropZone');
  var pickBtn    = document.getElementById('pickBtn');
  var fileInput  = document.getElementById('fileInput');
  var replaceIn  = document.getElementById('replaceInput');
  var barEl      = document.getElementById('uploadBar');
  var searchEl   = document.getElementById('mediaSearch');

  var files = [];
  var query = '';
  var replacing = null;

  function publicUrl(name) {
    return db.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
  }

  function sizeOf(file) {
    var bytes = (file.metadata && file.metadata.size) || 0;
    if (!bytes) { return ''; }
    return bytes < 1024 * 1024
      ? Math.round(bytes / 1024) + ' KB'
      : (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  
  var safeName     = ed.safeImageName;
  var rejectReason = ed.rejectImage;

  
  function showBar(on) {
    barEl.hidden = !on;
    var fill = barEl.querySelector('span');
    if (!on) { fill.style.width = '0'; return; }
    fill.style.width = '15%';
    window.setTimeout(function () { fill.style.width = '70%'; }, 60);
  }

  function finishBar() {
    barEl.querySelector('span').style.width = '100%';
    window.setTimeout(function () { showBar(false); }, 350);
  }

  

  function upload(file) {
    var bad = rejectReason(file);
    if (bad) { ed.message(msgEl, 'error', bad); return; }

    var name = safeName(file.name);
    showBar(true);
    ed.message(msgEl, null);

    db.storage.from(BUCKET).upload(name, file, { cacheControl: '3600', upsert: false })
      .then(function (res) {
        finishBar();
        if (res.error) { throw res.error; }
        ed.message(msgEl, 'ok', 'Uploaded as ' + name + '. Its address is on the tile below.');
        return list();
      })
      .catch(function (err) {
        showBar(false);
        ed.message(msgEl, 'error', ed.describeError(err, 'the image library'));
      });
  }

  function replace(path, file) {
    var bad = rejectReason(file);
    if (bad) { ed.message(msgEl, 'error', bad); return; }

    ed.confirmDialog({
      title: 'Replace ' + path + '?',
      body: 'Every page using this image will show the new one. The old file is ' +
            'overwritten and cannot be got back from here.',
      go: 'Replace it',
      danger: true
    }).then(function (yes) {
      if (!yes) { return; }
      showBar(true);

      db.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: true })
        .then(function (res) {
          finishBar();
          if (res.error) { throw res.error; }
          ed.message(msgEl, 'ok',
            path + ' replaced. Browsers hold the old picture for up to an hour — if you ' +
            'still see it, that is a cache and not a failed upload.');
          return list();
        })
        .catch(function (err) {
          showBar(false);
          ed.message(msgEl, 'error', ed.describeError(err, 'the image library'));
        });
    });
  }

  

  function list() {
    return db.storage.from(BUCKET).list('', { limit: 300, sortBy: { column: 'created_at', order: 'desc' } })
      .then(function (res) {
        if (res.error) { throw res.error; }

        files = (res.data || []).filter(function (f) { return f.id; });
        draw();
      })
      .catch(function (err) {
        hostEl.innerHTML =
          '<div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not open the image library</h2>' +
            '<p>' + ed.esc(ed.describeError(err, 'the image library')) + '</p>' +
            '<p class="mc-admin-hint" style="margin-top:.6rem">If the bucket does not exist yet, ' +
               'it is created by section 6 of supabase_editor.sql.</p>' +
          '</div>';
      });
  }

  function draw() {
    var q = query.trim().toLowerCase();
    var shown = q
      ? files.filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; })
      : files;

    if (!files.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-images"></i></span>' +
          '<h2>Nothing here yet</h2>' +
          '<p>Images uploaded above appear here, with the address to paste into an ' +
             'article\'s thumbnail field.</p>' +
        '</div>';
      return;
    }

    if (!shown.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-search"></i></span>' +
          '<h2>No file matches “' + ed.esc(query) + '”</h2>' +
          '<p>There are ' + files.length + ' images in the library.</p>' +
        '</div>';
      return;
    }

    hostEl.innerHTML = '<div class="mc-ed-media">' + shown.map(function (f) {
      var url = publicUrl(f.name);
      return '<div class="mc-ed-media-item">' +
               '<div class="mc-ed-media-shot" style="background-image:url(&quot;' + ed.esc(url) + '&quot;)" ' +
                 'role="img" aria-label="' + ed.esc(f.name) + '"></div>' +
               '<div class="mc-ed-media-body">' +
                 '<div class="mc-ed-media-name">' + ed.esc(f.name) + '</div>' +
                 '<div class="mc-ed-media-meta">' + ed.esc(sizeOf(f)) +
                   (f.created_at ? ' · ' + ed.esc(ed.when(f.created_at)) : '') + '</div>' +
                 '<div class="mc-ed-media-acts">' +
                   '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" ' +
                     'data-copy="' + ed.esc(url) + '">Copy address</button>' +
                   '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" ' +
                     'data-replace="' + ed.esc(f.name) + '">Replace</button>' +
                 '</div>' +
               '</div>' +
             '</div>';
    }).join('') + '</div>';
  }

  

  pickBtn.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) { upload(fileInput.files[0]); }
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    dropEl.addEventListener(evt, function (e) {
      e.preventDefault();
      dropEl.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropEl.addEventListener(evt, function (e) {
      e.preventDefault();
      dropEl.classList.remove('is-over');
    });
  });
  dropEl.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) { upload(file); }
  });

  
  ['dragover', 'drop'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      if (!dropEl.contains(e.target)) { e.preventDefault(); }
    });
  });

  hostEl.addEventListener('click', function (e) {
    var copy = e.target.closest('[data-copy]');
    if (copy) {
      var url = copy.getAttribute('data-copy');
      var done = function () {
        var was = copy.textContent;
        copy.textContent = 'Copied';
        window.setTimeout(function () { copy.textContent = was; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          ed.message(msgEl, 'error', 'Could not copy. The address is ' + url);
        });
      } else {

        ed.message(msgEl, 'ok', url);
      }
      return;
    }

    var rep = e.target.closest('[data-replace]');
    if (rep) {
      replacing = rep.getAttribute('data-replace');
      replaceIn.click();
    }
  });

  replaceIn.addEventListener('change', function () {
    var file = replaceIn.files[0];
    if (file && replacing) { replace(replacing, file); }
    replaceIn.value = '';
    replacing = null;
  });

  var typing;
  searchEl.addEventListener('input', function () {
    window.clearTimeout(typing);
    typing = window.setTimeout(function () { query = searchEl.value; draw(); }, 120);
  });

  guard.ready.then(list);

})();
