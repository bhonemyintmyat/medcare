(function () {
  'use strict';

  var db = window.supabaseClient;

  var TOWNSHIPS = [
    'Ahlone', 'Bahan', 'Botahtaung', 'Cocokyun', 'Dagon', 'Dagon Seikkan',
    'Dala', 'Dawbon', 'East Dagon', 'Hlaing', 'Hlaing Tharyar', 'Hmawbi',
    'Htantabin', 'Insein', 'Kamayut', 'Kawhmu', 'Kayan', 'Kungyangon',
    'Kyauktada', 'Kyauktan', 'Kyeemyindaing', 'Lanmadaw', 'Latha',
    'Mayangone', 'Mingala Taungnyunt', 'Mingaladon', 'North Dagon',
    'North Okkalapa', 'Pabedan', 'Pazundaung', 'Sanchaung',
    'Seikgyikanaungto', 'Seikkan', 'Shwe Pyi Thar', 'South Dagon',
    'South Okkalapa', 'Taikkyi', 'Tamwe', 'Thaketa', 'Thanlyin',
    'Thingangyun', 'Thongwa', 'Twantay', 'Yankin'
  ];

  var TYPES = {
    disease: {
      table: 'diseases',
      label: 'Disease',
      plural: 'Diseases',
      icon: 'bi-virus',
      titleField: 'name',
      subField: 'tag',

      hrefHint: 'Path to the page this card opens, e.g. diseases/dengue.html. The file has to exist in the repository.',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 120,
          hint: 'As a reader would say it. "Dengue fever", not "Dengue (DENV)".' },

        { name: 'name_my', label: 'Name (Burmese)', type: 'text', max: 160, my: true,
          hint: 'Leave empty and readers in Burmese see the English name.' },
        { name: 'desc', label: 'Short description', type: 'textarea', required: true, max: 400,
          hint: 'One or two plain sentences for the card. No jargon, no numbers a reader cannot act on.' },
        { name: 'desc_my', label: 'Short description (Burmese)', type: 'textarea', max: 500, my: true },
        { name: 'tag', label: 'Tag', type: 'select', required: true,
          options: ['Chronic', 'Infectious', 'Respiratory', 'Maternal'],
          hint: 'The single word printed on the card.' },
        { name: 'cat', label: 'Filter categories', type: 'text', required: true, max: 120,
          hint: 'Space-separated, lowercase — "infectious respiratory". These drive the filter chips on common-diseases.html.' },
        { name: 'icon', label: 'Icon', type: 'text', required: true, max: 60,
          placeholder: 'bi-heart-pulse',
          hint: 'A Bootstrap Icons name. The preview beside the field is what a reader will see.' },
        { name: 'href', label: 'Page link', type: 'text', required: true, max: 200,
          placeholder: 'diseases/dengue.html' },
        { name: 'cover_image', label: 'Cover image', type: 'image', max: 400,
          hint: 'Drag one in, or choose from the library. It heads the page.' },
        { name: 'body', label: 'The page itself', type: 'richtext', max: 20000,
          placeholder: 'What it is, how it spreads, what to do…',
          hint: 'The long-form text. Headings, lists and links only; how it looks is ' +
                'decided by the page, not here.' },
        { name: 'body_my', label: 'The page itself (Burmese)', type: 'richtext', max: 24000, my: true },
        { name: 'source_url', label: 'Source', type: 'url', max: 400,
          placeholder: 'https://www.who.int/…',
          hint: 'WHO or Myanmar Ministry of Health only. The database refuses anything else.' }
      ],
      columns: ['name', 'tag', 'cat']
    },

    article: {
      table: 'articles',
      label: 'Article',
      plural: 'Articles',
      icon: 'bi-journal-text',
      titleField: 'title',
      subField: 'cat',
      hrefHint: 'Path to the article page, e.g. sleep.html. The file has to exist in the repository.',
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true, max: 160 },
        { name: 'title_my', label: 'Title (Burmese)', type: 'text', max: 200, my: true },
        { name: 'excerpt', label: 'Excerpt', type: 'textarea', required: true, max: 400,
          hint: 'The two lines under the title on the article card.' },
        { name: 'excerpt_my', label: 'Excerpt (Burmese)', type: 'textarea', max: 500, my: true },
        { name: 'cat', label: 'Category', type: 'text', required: true, max: 60,
          hint: 'One word, lowercase — it becomes a filter chip on articles.html.' },
        { name: 'href', label: 'Page link', type: 'text', required: true, max: 200,
          placeholder: 'sleep.html' },
        { name: 'thumb', label: 'Thumbnail', type: 'image', max: 400,
          hint: 'The small image on the article card. Leave empty and the card shows its category colour.' },
        { name: 'cover_image', label: 'Cover image', type: 'image', max: 400,
          hint: 'The wide image at the top of the article itself. Often the thumbnail again, larger.' },
        { name: 'body', label: 'The article', type: 'richtext', max: 20000,
          placeholder: 'Write the article here…',
          hint: 'Headings, lists and links only; how it looks is decided by the page.' },
        { name: 'body_my', label: 'The article (Burmese)', type: 'richtext', max: 24000, my: true },
        { name: 'byline', label: 'Byline', type: 'text', max: 120 },
        { name: 'byline_my', label: 'Byline (Burmese)', type: 'text', max: 160, my: true },
        { name: 'source_url', label: 'Source', type: 'url', max: 400,
          placeholder: 'https://www.who.int/…',
          hint: 'WHO or Myanmar Ministry of Health only. The database refuses anything else.' }
      ],
      columns: ['title', 'cat', 'byline']
    },

    hospital: {
      table: 'hospitals',
      label: 'Hospital',
      plural: 'Hospitals',
      icon: 'bi-hospital',
      titleField: 'name',
      subField: 'township',

      townField: 'township',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 160 },
        { name: 'type', label: 'Type', type: 'select', required: true,
          options: [
            { value: 'general',    text: 'General hospital' },
            { value: 'specialist', text: 'Specialist hospital' },
            { value: 'clinic',     text: 'Clinic' }
          ] },

        { name: 'township', label: 'Township', type: 'select', required: true,
          options: TOWNSHIPS,
          hint: 'Yangon Region only. The filter on hospitals.html groups by exactly this.' },
        { name: 'address', label: 'Address', type: 'textarea', required: true, max: 400 },
        { name: 'phone', label: 'Phone', type: 'tel', max: 60, confirm: true,
          hint: 'Typed twice. A wrong number here sends somebody to the wrong place while they are frightened.' },
        { name: 'hours', label: 'Opening hours', type: 'text', max: 120,
          placeholder: 'Mon–Fri 8:00–17:00' },
        { name: 'er', label: 'Has a 24-hour emergency room', type: 'checkbox',
          hint: 'This is the "24h ER" filter on hospitals.html. Only tick it if you have checked.' }
      ],
      columns: ['name', 'type', 'township']
    },

    pharmacy: {
      table: 'pharmacies',
      label: 'Pharmacy',
      plural: 'Pharmacies',
      icon: 'bi-capsule',
      titleField: 'name',
      subField: 'township',
      townField: 'township',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 160,
          hint: 'Include the branch if it is one of a chain — "City Mart Pharmacy — Junction City".' },
        { name: 'type', label: 'Type', type: 'select', required: true,
          options: [
            { value: 'chain',       text: 'Chain pharmacy' },
            { value: 'independent', text: 'Independent' },
            { value: 'hospital',    text: 'Hospital pharmacy' },
            { value: 'clinic',      text: 'Clinic pharmacy' }
          ] },

        { name: 'township', label: 'Township', type: 'select', required: true,
          options: TOWNSHIPS,
          hint: 'Yangon Region only. The filter on pharmacy.html groups by exactly this.' },
        { name: 'address', label: 'Address', type: 'textarea', required: true, max: 400 },
        { name: 'phone', label: 'Phone', type: 'tel', max: 60, confirm: true,
          hint: 'Typed twice. Somebody rings this to ask whether a medicine is in stock before they travel for it.' },
        { name: 'hours', label: 'Opening hours', type: 'text', max: 120,
          placeholder: 'Daily, 9:00–21:00' },
        { name: 'open24', label: 'Open 24 hours', type: 'checkbox',
          hint: 'The "Open 24 hours" filter on pharmacy.html. Only tick it if you have checked.' },
        { name: 'delivery', label: 'Delivers to your home', type: 'checkbox',
          hint: 'The "Home delivery" filter on pharmacy.html.' }
      ],
      columns: ['name', 'type', 'township']
    }
  };

  var STATUSES = {
    draft:     { label: 'Draft',     hint: 'Only staff can see this.' },
    pending:   { label: 'Pending',   hint: 'Waiting for review. Still invisible to readers.' },
    published: { label: 'Published', hint: 'Live on the public site.' },
    archived:  { label: 'Archived',  hint: 'Taken off the site. Nothing is deleted.' }
  };

  var TRANSITIONS = {
    draft: [
      { to: 'pending',   label: 'Submit for review', primary: true },
      { to: 'published', label: 'Publish', admin: true,
        confirm: 'This puts the page on the public site straight away, skipping review.' }
    ],
    pending: [
      { to: 'published', label: 'Publish', primary: true, admin: true,
        confirm: 'This puts the page on the public site straight away.' },
      { to: 'draft',     label: 'Send back to draft' }
    ],
    published: [
      { to: 'archived',  label: 'Unpublish', danger: true,
        confirm: 'This takes the page off the public site. The row is kept and can be published again — nothing is deleted.' },

      { to: 'draft',     label: 'Back to draft',
        editorLabel: 'Take off the site to edit',
        confirm: 'This takes the page off the public site so you can change it. The text is kept, and an admin publishes it again when you are done.' }
    ],
    archived: [
      { to: 'draft',     label: 'Restore to draft', primary: true },
      { to: 'published', label: 'Publish again', admin: true,
        confirm: 'This puts the page back on the public site.' }
    ]
  };

  function movesFrom(status, isAdmin) {
    return (TRANSITIONS[status] || []).filter(function (m) {
      return isAdmin || !m.admin;
    }).map(function (m) {

      var out = {};
      Object.keys(m).forEach(function (k) { out[k] = m[k]; });
      if (!isAdmin && m.editorLabel) { out.label = m.editorLabel; }
      return out;
    });
  }

  function waitingNote(status, isAdmin) {
    if (isAdmin) { return ''; }
    if (status === 'pending')  { return 'An admin publishes this. It is in their queue.'; }
    if (status === 'draft')    { return 'Submit it for review when it is ready — an admin publishes it.'; }
    if (status === 'archived') { return 'An admin puts this back on the site.'; }
    return '';
  }

  function canEditNow(status, isAdmin) {
    return isAdmin || status !== 'published';
  }

  function lockedNote(status, isAdmin) {
    if (canEditNow(status, isAdmin)) { return ''; }
    return 'This page is live, so it is not yours to edit in place. ' +
           'Take it off the site and it becomes editable again — the text is kept, ' +
           'and an admin puts it back when you are done.';
  }

  function esc(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function when(iso) {
    if (!iso) { return '—'; }
    var d = new Date(iso);
    if (isNaN(d)) { return '—'; }
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
           ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  var APPROVED_SOURCE = /^https:\/\/([a-z0-9-]+\.)*(who\.int|mohs\.gov\.mm|moh\.gov\.mm)(\/|$)/i;

  function sourceLooksApproved(url) {
    return !url || APPROVED_SOURCE.test(url.trim());
  }

  var IMAGE_BUCKET = 'content-images';
  var IMAGE_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  var MAX_IMAGE_BYTES = 3 * 1024 * 1024;

  function imageUrl(name) {
    return db.storage.from(IMAGE_BUCKET).getPublicUrl(name).data.publicUrl;
  }

  function safeImageName(original) {
    var dot  = original.lastIndexOf('.');
    var stem = (dot === -1 ? original : original.slice(0, dot))
                 .toLowerCase()
                 .replace(/[^a-z0-9]+/g, '-')
                 .replace(/^-+|-+$/g, '')
                 .slice(0, 60) || 'image';
    var ext  = (dot === -1 ? 'jpg' : original.slice(dot + 1)).toLowerCase().replace(/[^a-z0-9]/g, '');
    return stem + '-' + Date.now().toString(36) + '.' + ext;
  }

  function rejectImage(file) {
    if (IMAGE_TYPES.indexOf(file.type) === -1) {
      return 'That is a ' + (file.type || 'file of unknown type') +
             '. Images have to be JPEG, PNG, WebP or AVIF.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'That file is ' + (file.size / 1024 / 1024).toFixed(1) +
             ' MB. The limit is 3 MB - resize it and try again.';
    }
    return null;
  }

  function uploadImage(file) {
    var bad = rejectImage(file);
    if (bad) { return Promise.reject(new Error(bad)); }

    var name = safeImageName(file.name);
    return db.storage.from(IMAGE_BUCKET).upload(name, file, {
      cacheControl: '3600', upsert: false
    }).then(function (res) {
      if (res.error) { throw res.error; }
      return { name: name, url: imageUrl(name) };
    });
  }

  function describeError(error, what) {
    if (!error) { return ''; }
    var code = error.code || '';
    var msg  = error.message || '';
    var noun = what || 'this';

    if (/publish_requires_admin/.test(msg)) {
      return 'Only an admin can publish. Submit it for review instead and it goes into their queue.';
    }
    if (/live_edit_requires_admin/.test(msg)) {
      return 'This page is live, and a live page is not edited in place. Take it off the site ' +
             'first — the text is kept — or ask an admin to make the change.';
    }
    if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
      return 'The database refused that. Your account may not have rights over ' + noun +
             ', or your session may have expired — reload the page and try once more.';
    }
    if (code === '23505' || /duplicate key/i.test(msg)) {
      return 'Something with that page link already exists. Every entry needs its own.';
    }
    if (code === '23514' && /source/i.test(msg)) {
      return 'That source is not one the site accepts. It has to be a WHO or Myanmar Ministry of Health address.';
    }
    if (code === '23514' && /status/i.test(msg)) {
      return 'That status is not one this table allows. If you have not run supabase_editor.sql yet, "archived" will be refused.';
    }
    if (code === '23514') {
      return 'One of the values does not meet a rule the database enforces: ' + msg;
    }
    if (code === '23502') {
      return 'A required field is empty.';
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      return 'Could not reach the database. Check your connection — nothing was saved.';
    }
    return msg || 'The database refused that, without saying why.';
  }

  function message(el, kind, text) {
    if (!el) { return; }
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.className = 'mc-admin-msg mc-admin-msg--' + (kind === 'ok' ? 'ok' : 'error');
    el.textContent = text;
    el.hidden = false;

    el.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
    if (kind === 'ok') {
      window.clearTimeout(el._mcTimer);
      el._mcTimer = window.setTimeout(function () {
        el.hidden = true; el.textContent = '';
      }, 6000);
    }
  }

  function statusPill(status) {
    var s = STATUSES[status] ? status : 'draft';
    return '<span class="mc-admin-pill mc-status mc-status--' + s + '">' +
             esc(STATUSES[s].label) +
           '</span>';
  }

  function touched(row, names) {
    var who = row.updated_by && names && names[row.updated_by];
    return '<span class="mc-touched">' +
             (who ? 'Last changed by <b>' + esc(who) + '</b> ' : 'Last changed ') +
             esc(when(row.updated_at)) +
           '</span>';
  }

  function loadNames(ids) {
    var wanted = [];
    (ids || []).forEach(function (id) {
      if (id && wanted.indexOf(id) === -1) { wanted.push(id); }
    });
    if (!wanted.length || !db) { return Promise.resolve({}); }

    return db.from('profiles').select('id, display_name, full_name').in('id', wanted)
      .then(function (res) {
        var out = {};
        (res.data || []).forEach(function (p) {
          out[p.id] = p.display_name || p.full_name || '';
        });
        return out;
      })
      .catch(function () { return {}; });
  }

  function listRows(type, options) {
    var cfg = TYPES[type];
    var q = db.from(cfg.table).select('*');

    if (options && options.status) { q = q.eq('status', options.status); }

    return q.order('updated_at', { ascending: false }).limit(500);
  }

  function getRow(type, id) {
    return db.from(TYPES[type].table).select('*').eq('id', id).single();
  }

  function saveRow(type, id, values, userId) {
    var cfg = TYPES[type];
    if (id) {
      return db.from(cfg.table).update(values).eq('id', id).select().single();
    }
    var fresh = Object.assign({}, values, { created_by: userId });
    return db.from(cfg.table).insert(fresh).select().single();
  }

  function setStatus(type, id, status) {
    return db.from(TYPES[type].table).update({ status: status }).eq('id', id).select().single();
  }

  function confirmDialog(opts) {
    var opener = document.activeElement;

    var host = document.createElement('div');
    host.className = 'mc-modal is-open';
    host.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mcConfirmTitle">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Cancel">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div class="mc-modal-ico ' + (opts.danger ? 'mc-modal-ico--muted' : 'mc-modal-ico--ok') + '">' +
          '<i class="bi ' + (opts.danger ? 'bi-eye-slash' : 'bi-check2-circle') + '"></i></div>' +
        '<h2 id="mcConfirmTitle">' + esc(opts.title) + '</h2>' +
        '<p class="mc-modal-sub">' + esc(opts.body) + '</p>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
          '<button type="button" class="mc-auth-btn" data-go>' + esc(opts.go || 'Confirm') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(host);
    var goBtn = host.querySelector('[data-go]');
    goBtn.focus();

    return new Promise(function (resolve) {
      function finish(answer) {
        document.removeEventListener('keydown', onKey);
        host.remove();
        if (opener && opener.focus) { opener.focus(); }
        resolve(answer);
      }
      function onKey(e) {
        if (e.key === 'Escape' || e.key === 'Esc') { finish(false); }
      }
      host.addEventListener('click', function (e) {
        if (e.target.closest('[data-go]'))   { finish(true);  return; }
        if (e.target.closest('[data-close]')) { finish(false); }
      });
      document.addEventListener('keydown', onKey);
    });
  }

  function guardUnsaved(isDirty) {
    window.addEventListener('beforeunload', function (e) {
      if (!isDirty()) { return; }
      e.preventDefault();
      e.returnValue = '';
    });
  }

  window.MedCareEditor = {
    TYPES: TYPES,
    TOWNSHIPS: TOWNSHIPS,
    STATUSES: STATUSES,
    TRANSITIONS: TRANSITIONS,
    movesFrom: movesFrom,
    waitingNote: waitingNote,
    canEditNow: canEditNow,
    lockedNote: lockedNote,

    esc: esc,
    when: when,
    message: message,
    statusPill: statusPill,
    touched: touched,
    loadNames: loadNames,
    describeError: describeError,
    sourceLooksApproved: sourceLooksApproved,

    IMAGE_BUCKET: IMAGE_BUCKET,
    IMAGE_TYPES: IMAGE_TYPES,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
    imageUrl: imageUrl,
    safeImageName: safeImageName,
    rejectImage: rejectImage,
    uploadImage: uploadImage,

    listRows: listRows,
    getRow: getRow,
    saveRow: saveRow,
    setStatus: setStatus,

    confirmDialog: confirmDialog,
    guardUnsaved: guardUnsaved
  };

})();
