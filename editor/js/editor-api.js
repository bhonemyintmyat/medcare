/* ============================================================
   MedCare — the editor area's shared vocabulary
   Loaded on every editor page, after editor-guard.js and before the
   page's own script.

   Three things live here, and they are here because the alternative is
   the same answer written slightly differently on five screens:

     1. TYPES — what a disease, an article and a hospital ARE: their
        table, their columns, and which of those columns a person fills
        in. The list page, the form page and the desk all read this, so
        adding a field is one edit in one object.

     2. The workflow — which status may become which, and what the
        button for that transition says.

     3. Talking to the database — one save path, one error translator,
        one set of escapes. Every screen's failure message comes from
        the same function, so "the database refused this" reads the same
        way whichever screen you were on when it happened.

   What is NOT here: any check that decides whether a write is allowed.
   Everything below decides what to DRAW. RLS decides what happens.
   ============================================================ */

(function () {
  'use strict';

  var db = window.supabaseClient;

  /* ================================================================
     1. WHAT THE CONTENT IS
     ================================================================
     `fields` is the form, top to bottom. `columns` is the list table.
     A field's `name` is its column name, so a row from the database and
     the form state are the same shape and nothing has to be mapped.

     type:
       text | textarea | url | tel | number | select | checkbox | image
     my: true marks the Burmese half of a pair. The form groups those
       beneath their English partner instead of listing them apart,
       because a translation is edited while looking at its source.
     ================================================================ */

  var TYPES = {
    disease: {
      table: 'diseases',
      label: 'Disease',
      plural: 'Diseases',
      icon: 'bi-virus',
      titleField: 'name',
      subField: 'tag',
      /* The disease PAGES are hand-written HTML in diseases/. This row
         is the card that links to one, so `href` points at a file that
         has to exist — there is no CMS behind it yet. The form says so
         rather than letting somebody publish a card to a 404. */
      hrefHint: 'Path to the page this card opens, e.g. diseases/dengue.html. The file has to exist in the repository.',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 120,
          hint: 'As a reader would say it. "Dengue fever", not "Dengue (DENV)".' },
        { name: 'desc', label: 'Short description', type: 'textarea', required: true, max: 400,
          hint: 'One or two plain sentences for the card. No jargon, no numbers a reader cannot act on.' },
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
          hint: 'Pick from the media library, or paste a path. Leave empty and the card shows its category colour.' },
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
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 160 },
        { name: 'type', label: 'Type', type: 'select', required: true,
          options: [
            { value: 'general',    text: 'General hospital' },
            { value: 'specialist', text: 'Specialist hospital' },
            { value: 'clinic',     text: 'Clinic' }
          ] },
        { name: 'township', label: 'Township', type: 'text', required: true, max: 120,
          hint: 'Spelled the way the township filter on hospitals.html spells it, or it will not group.' },
        { name: 'address', label: 'Address', type: 'textarea', required: true, max: 400 },
        { name: 'phone', label: 'Phone', type: 'tel', max: 60, confirm: true,
          hint: 'Typed twice. A wrong number here sends somebody to the wrong place while they are frightened.' },
        { name: 'hours', label: 'Opening hours', type: 'text', max: 120,
          placeholder: 'Mon–Fri 8:00–17:00' },
        { name: 'er', label: 'Has a 24-hour emergency room', type: 'checkbox',
          hint: 'This is the "24h ER" filter on hospitals.html. Only tick it if you have checked.' }
      ],
      columns: ['name', 'type', 'township']
    }
  };

  /* ================================================================
     2. THE WORKFLOW
     ================================================================
     draft -> pending -> published, and archived off to the side.

     `archived` is the brief's soft-delete. It is a separate status
     rather than a trip back to draft, because a draft is on its way
     onto the site and an archived page has been taken off it — and six
     months later the difference is the only thing that explains why a
     page is missing. See supabase_editor.sql, section 1.

     No transition here removes a row. There is no editor DELETE policy
     on any table, so hard-delete is not a button that is hidden — it is
     a request Postgres refuses.
     ================================================================ */

  var STATUSES = {
    draft:     { label: 'Draft',     hint: 'Only staff can see this.' },
    pending:   { label: 'Pending',   hint: 'Waiting for review. Still invisible to readers.' },
    published: { label: 'Published', hint: 'Live on the public site.' },
    archived:  { label: 'Archived',  hint: 'Taken off the site. Nothing is deleted.' }
  };

  /* From each status, what you may do next, in the order the buttons
     should appear. `primary` gets the filled button; the rest are
     ghosts. `confirm` means the action asks first — everything that
     changes what the public sees does.

     `admin: true` marks a transition INTO published. Those are refused
     by the guard_publish trigger for anybody but an admin, so showing
     the button to an editor would be offering them a 403. movesFrom()
     below is what filters them out; nothing reads this table directly.

     Note which way the asymmetry runs. Publishing needs an admin;
     unpublishing does not. An editor who thinks a live page is wrong
     should be able to take it down at once and argue about it
     afterwards, and needing to find an admin first is how a wrong page
     stays up all weekend.

     That asymmetry is also the repair route. An editor cannot edit a
     published row in place — see canEditNow() below — so 'Back to draft'
     is not just a status change, it is how they get at the text. Both
     moves out of published are theirs for that reason. */
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
      /* Two names for one move, because it means two different things.
         To an admin it is housekeeping: take this back to draft. To an
         editor it is the only way to reach the text of a live page, so
         it is named after what they are trying to do. */
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

  /* The moves this person may actually make from `status`. Every screen
     asks this rather than reading TRANSITIONS, so "who may publish" is
     one decision in one place.

     It decides what to DRAW. The trigger is what refuses. Delete this
     filter and an editor gets a Publish button that returns 42501. */
  function movesFrom(status, isAdmin) {
    return (TRANSITIONS[status] || []).filter(function (m) {
      return isAdmin || !m.admin;
    }).map(function (m) {
      /* A copy, never the table row itself — callers read .label off
         these and one careless assignment would rename the button for
         every screen in the session. */
      var out = {};
      Object.keys(m).forEach(function (k) { out[k] = m[k]; });
      if (!isAdmin && m.editorLabel) { out.label = m.editorLabel; }
      return out;
    });
  }

  /* What to tell an editor who is looking at a pending row and wondering
     why there is no Publish button. Silence here reads as a bug.

     Full sentences, for the form, which has room for them. The list and
     the emergency cards say something shorter in a pill and do not call
     this — a sentence per row turns a list into prose, and the emergency
     table has no review step for the 'draft' wording to refer to. That
     divergence is deliberate; don't collapse it. */
  function waitingNote(status, isAdmin) {
    if (isAdmin) { return ''; }
    if (status === 'pending')  { return 'An admin publishes this. It is in their queue.'; }
    if (status === 'draft')    { return 'Submit it for review when it is ready — an admin publishes it.'; }
    if (status === 'archived') { return 'An admin puts this back on the site.'; }
    return '';
  }

  /* ---------------- Editing a live row ----------------
     supabase_publish_approval.sql refuses an editor's UPDATE to a row
     that is published and stays published: changing what a reader
     already sees is the same act as publishing, and approval that can be
     walked around by rewriting an existing page is not approval.

     So a published row is READ-ONLY to an editor. Not "saves and fails"
     — the fields are disabled and the Save button is gone, because a
     form that accepts typing for ten minutes and then returns 42501 is
     worse than one that never invited it.

     canEditNow() decides; lockedNote() says why. Every screen with a
     Save button asks both. Relax the rule in the SQL and you must relax
     it here too — see section 4 of that file. */
  function canEditNow(status, isAdmin) {
    return isAdmin || status !== 'published';
  }

  function lockedNote(status, isAdmin) {
    if (canEditNow(status, isAdmin)) { return ''; }
    return 'This page is live, so it is not yours to edit in place. ' +
           'Take it off the site and it becomes editable again — the text is kept, ' +
           'and an admin puts it back when you are done.';
  }

  /* ================================================================
     3. SMALL THINGS EVERY SCREEN NEEDS
     ================================================================ */

  function esc(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Dates are printed in the reader's own locale rather than a fixed
     format: the only question anyone asks of this column is "was that
     before or after the thing I remember", and their own format is the
     one they can answer it in without thinking. */
  function when(iso) {
    if (!iso) { return '—'; }
    var d = new Date(iso);
    if (isNaN(d)) { return '—'; }
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
           ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /* The same rule as public.is_approved_source(), so a bad source is
     caught while the person is still looking at the field rather than
     coming back as a constraint violation after they hit Save. The
     database check is the one that counts; this one is the courtesy.
     If the SQL widens, widen this too — they are a pair. */
  var APPROVED_SOURCE = /^https:\/\/([a-z0-9-]+\.)*(who\.int|mohs\.gov\.mm|moh\.gov\.mm)(\/|$)/i;

  function sourceLooksApproved(url) {
    return !url || APPROVED_SOURCE.test(url.trim());
  }

  /* Supabase hands back Postgres's own words, which are precise and
     mean nothing to the person who just pressed Save. This turns the
     handful we can actually provoke into sentences that say what to do.
     Anything unrecognised keeps its original message rather than being
     flattened into "something went wrong" — a message we cannot explain
     is still more use than one we made up. */
  function describeError(error, what) {
    if (!error) { return ''; }
    var code = error.code || '';
    var msg  = error.message || '';
    var noun = what || 'this';

    /* The trigger's own exceptions come back as 42501 with the message
       it raised, so they have to be matched before the generic
       permission case below swallows them into "your session may have
       expired" — which would be a confusing thing to read after
       pressing a button that was never yours to press. */
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

  /* One message strip per screen, in the place the screen keeps it.
     Errors stay until something replaces them; confirmations clear
     themselves, because a green bar that outlives the thing it is
     describing starts lying about the state of the page. */
  function message(el, kind, text) {
    if (!el) { return; }
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.className = 'mc-admin-msg mc-admin-msg--' + (kind === 'ok' ? 'ok' : 'error');
    el.textContent = text;
    el.hidden = false;
    // Errors are announced; a confirmation is not worth interrupting for.
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

  /* Who last touched this row, and when. Names come from a single
     profiles lookup per screen rather than a join, because the anon
     client cannot join to profiles under its own RLS and a per-row
     query would be one request per line of the table. */
  function touched(row, names) {
    var who = row.updated_by && names && names[row.updated_by];
    return '<span class="mc-touched">' +
             (who ? 'Last changed by <b>' + esc(who) + '</b> ' : 'Last changed ') +
             esc(when(row.updated_at)) +
           '</span>';
  }

  /* One request, every name the screen will need. Editors have no
     policy granting them a general read of `profiles`, so this comes
     back empty for them and every "Last changed by" falls back to the
     date alone. That is the intended outcome, not a bug to work around:
     the brief says an editor cannot reach user accounts, and this is
     what that looks like from inside the UI. */
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

  /* ---------- Reading and writing content ---------- */

  function listRows(type, options) {
    var cfg = TYPES[type];
    var q = db.from(cfg.table).select('*');

    if (options && options.status) { q = q.eq('status', options.status); }

    // Newest change first: on an editing screen the row you want is
    // almost always the one you touched last.
    return q.order('updated_at', { ascending: false }).limit(500);
  }

  function getRow(type, id) {
    return db.from(TYPES[type].table).select('*').eq('id', id).single();
  }

  /* Insert and update are one function because the caller's question is
     "save this", not "which verb". The difference that matters is that
     a new row carries created_by — the insert policy checks it against
     the token, so omitting it is a 403 rather than a null column. */
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

  /* ---------- The dialog ----------
     Every state change that a reader would notice is confirmed, and the
     confirmation names the row. "Unpublish Dengue fever?" is a question
     somebody can answer; "Are you sure?" is one they cannot, and it is
     the reason people learn to click through these without reading.

     Reuses .mc-modal from styles.css. Resolves true or false, and
     restores focus to whatever opened it — an editor working down a
     list with the keyboard should not be dropped at the top of the page
     after every action. */
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

  /* ---------- Leaving with unsaved work ----------
     The form screen arms this. It is deliberately the browser's own
     dialog rather than a nicer one of ours: ours cannot stop a
     navigation, and a prettier warning that does not actually prevent
     the loss is worse than the ugly one that does. */
  function guardUnsaved(isDirty) {
    window.addEventListener('beforeunload', function (e) {
      if (!isDirty()) { return; }
      e.preventDefault();
      e.returnValue = '';    // the wording is the browser's; ours is ignored
    });
  }

  window.MedCareEditor = {
    TYPES: TYPES,
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

    listRows: listRows,
    getRow: getRow,
    saveRow: saveRow,
    setStatus: setStatus,

    confirmDialog: confirmDialog,
    guardUnsaved: guardUnsaved
  };

})();
