/* ============================================================
   MedCare — the content list (editor/content.html)

   One list, three kinds of thing. Which kind is in the URL rather than
   in a variable, so a tab is a real link: the back button works, a
   bookmark works, and "send me the pending articles" is a URL somebody
   can paste.

     content.html?type=article&status=pending

   The row actions are the workflow. They are here as well as on the
   form because the common shape of this job is going down a list
   publishing things that are already finished, and making somebody open
   and close six pages to do it is how the pending queue stops getting
   cleared.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  if (!guard || !ed) { return; }

  var hostEl    = document.getElementById('listHost');
  var msgEl     = document.getElementById('listMsg');
  var countEl   = document.getElementById('listCount');
  var searchEl  = document.getElementById('listSearch');
  var filtersEl = document.getElementById('statusFilters');
  var tabsEl    = document.getElementById('typeTabs');
  var newBtn    = document.getElementById('newEntry');
  var newLabel  = document.getElementById('newEntryLabel');

  var params = new URLSearchParams(window.location.search);
  var type   = ed.TYPES[params.get('type')] ? params.get('type') : 'disease';
  var cfg    = ed.TYPES[type];

  var state = {
    rows: [],
    names: {},
    status: params.get('status') || '',
    query: ''
  };

  /* ---------- The chrome this page has to fix ----------
     admin-shell.js marks the current nav item by comparing file names,
     and this area has two links to the same file with different query
     strings. Left alone, "Diseases and articles" and "Hospitals" would
     both light up. It runs before this file, so correcting it here is
     one pass rather than a special case inside the shared shell. */
  (function markNav() {
    var here = 'content.html?type=' + (type === 'hospital' ? 'hospital' : 'disease');
    document.querySelectorAll('.mc-admin-nav a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href.indexOf('content.html') === 0) {
        if (href === here) { a.setAttribute('aria-current', 'page'); }
        else { a.removeAttribute('aria-current'); }
      }
    });
  })();

  /* Carry the status filter across when you switch kind. Somebody
     clearing the pending queue wants the next tab's pending queue, not
     its whole table — that is the difference between this page being a
     review queue and being three separate lists.

     Re-run whenever the filter changes, or the hrefs go stale and the
     first tab click undoes the filter the person just set. Each tab's
     own type is read from data-type rather than parsed back out of the
     href it is about to be given. */
  function retargetTabs() {
    tabsEl.querySelectorAll('a').forEach(function (a) {
      var tabType = a.getAttribute('data-type');
      if (tabType === type) { a.setAttribute('aria-current', 'page'); }
      else { a.removeAttribute('aria-current'); }
      a.setAttribute('href', 'content.html?type=' + tabType +
        (state.status ? '&status=' + state.status : ''));
    });
  }

  retargetTabs();

  newBtn.setAttribute('href', 'entry.html?type=' + type);
  newLabel.textContent = 'New ' + cfg.label.toLowerCase();

  filtersEl.querySelectorAll('.mc-chip').forEach(function (chip) {
    chip.classList.toggle('is-active', (chip.getAttribute('data-status') || '') === state.status);
  });

  /* ---------- Reading ---------- */

  function load() {
    return ed.listRows(type, {}).then(function (res) {
      if (res.error) { throw res.error; }
      state.rows = res.data || [];
      return ed.loadNames(state.rows.map(function (r) { return r.updated_by; }));
    }).then(function (names) {
      state.names = names;
      draw();
      countTabs();
    }).catch(function (err) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--error">' +
          '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
          '<h2>Could not load the ' + ed.esc(cfg.plural.toLowerCase()) + '</h2>' +
          '<p>' + ed.esc(ed.describeError(err, cfg.plural.toLowerCase())) + '</p>' +
        '</div>';
      countEl.textContent = '';
    });
  }

  /* The other two tabs' totals. Cheap head-only counts, because all this
     needs is the number in the pill.

     They follow the status filter rather than always showing the table
     total, and that is what makes this page usable as a review queue: an
     admin who filters to pending sees at a glance that the work is three
     articles and no hospitals, instead of clicking every tab to find out.
     Recounted whenever the filter changes, for the same reason. */
  function countTabs() {
    Object.keys(ed.TYPES).forEach(function (t) {
      var pill = tabsEl.querySelector('[data-count="' + t + '"]');
      if (!pill) { return; }

      /* The current tab is already loaded in full; no need to ask again.
         Counted by status only, NOT through visible() — the search box
         must not change these numbers, or the two tabs that cannot be
         searched from here would silently disagree with this one. */
      if (t === type) {
        pill.textContent = state.status
          ? state.rows.filter(function (r) { return r.status === state.status; }).length
          : state.rows.length;
        return;
      }

      var q = window.supabaseClient
        .from(ed.TYPES[t].table).select('id', { count: 'exact', head: true });
      if (state.status) { q = q.eq('status', state.status); }

      q.then(function (res) { pill.textContent = res.error ? '' : (res.count || 0); })
       .catch(function () { pill.textContent = ''; });
    });
  }

  /* ---------- Filtering ----------
     Searching the whole row rather than named columns: an editor looking
     for "dengue" does not know or care whether it is in the name, the
     category or the link, and a search that misses because they guessed
     the wrong column teaches them not to use it. */
  function visible() {
    var q = state.query.trim().toLowerCase();
    return state.rows.filter(function (row) {
      if (state.status && row.status !== state.status) { return false; }
      if (!q) { return true; }
      return Object.keys(row).some(function (k) {
        if (k === 'id' || k.slice(-3) === '_by' || k.slice(-3) === '_at') { return false; }
        var v = row[k];
        return v != null && String(v).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  /* ---------- Drawing ---------- */

  function actionsFor(row) {
    var moves = ed.movesFrom(row.status, guard.isAdmin());

    /* A published row opens read-only for an editor, so the button says
       View. Promising Edit and delivering a locked form is the kind of
       small lie that makes people distrust the rest of the screen. */
    var open  = ed.canEditNow(row.status, guard.isAdmin()) ? 'Edit' : 'View';
    var html = '<a class="mc-auth-btn mc-auth-btn--ghost" href="entry.html?type=' + type +
               '&id=' + row.id + '">' + open + '</a>';

    /* Only the first move gets a button in the list. The rest are on the
       form, where there is room to explain them. A row of four buttons
       per line turns the list into a wall and makes the wrong one easy
       to hit. */
    var move = moves[0];
    if (move) {
      html += '<button type="button" class="mc-auth-btn' +
              (move.danger ? ' mc-auth-btn--danger' : (move.primary ? '' : ' mc-auth-btn--ghost')) +
              '" data-move="' + move.to + '" data-id="' + row.id + '">' +
              ed.esc(move.label) + '</button>';
    }
    return html;
  }

  function rowHtml(row) {
    var title = row[cfg.titleField] || '(untitled)';
    var sub   = cfg.subField ? row[cfg.subField] : '';

    var meta = [];
    if (sub) { meta.push('<span>' + ed.esc(sub) + '</span>'); }
    if (row.href) { meta.push('<code>' + ed.esc(row.href) + '</code>'); }
    meta.push(ed.touched(row, state.names));

    // Only on the rows where a Publish button is conspicuously absent.
    if (row.status === 'pending' && !guard.isAdmin()) {
      meta.push('<span class="mc-ed-waiting"><i class="bi bi-hourglass-split"></i> ' +
                'With an admin</span>');
    }

    return '<div class="mc-ed-row' + (row.status === 'archived' ? ' mc-ed-row--archived' : '') +
             '" data-row="' + row.id + '">' +
             '<span class="mc-ed-row-ico"><i class="bi ' + cfg.icon + '"></i></span>' +
             '<div class="mc-ed-row-title">' +
               '<a href="entry.html?type=' + type + '&id=' + row.id + '">' + ed.esc(title) + '</a>' +
               ed.statusPill(row.status) +
             '</div>' +
             '<div class="mc-ed-row-meta">' + meta.join('') + '</div>' +
             '<div class="mc-ed-row-actions">' + actionsFor(row) + '</div>' +
           '</div>';
  }

  function draw() {
    var rows = visible();

    if (!state.rows.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi ' + cfg.icon + '"></i></span>' +
          '<h2>No ' + ed.esc(cfg.plural.toLowerCase()) + ' yet</h2>' +
          '<p>Nothing has been written here. The first one starts as a draft and ' +
             'stays invisible to readers until somebody publishes it.</p>' +
          '<a class="mc-auth-btn" href="entry.html?type=' + type + '">' +
            'New ' + ed.esc(cfg.label.toLowerCase()) + '</a>' +
        '</div>';
      countEl.textContent = '';
      return;
    }

    if (!rows.length) {
      // An empty filter result is a different thing from an empty table,
      // and the way out of it is different too.
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-funnel"></i></span>' +
          '<h2>Nothing matches</h2>' +
          '<p>' + ed.esc(state.rows.length) + ' ' + ed.esc(cfg.plural.toLowerCase()) +
             ' exist, but none of them match what you have filtered to.</p>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-clear>Clear the filters</button>' +
        '</div>';
      countEl.textContent = '';
      return;
    }

    hostEl.innerHTML = '<div class="mc-ed-list">' + rows.map(rowHtml).join('') + '</div>';
    countEl.textContent = rows.length === state.rows.length
      ? rows.length + ' ' + (rows.length === 1 ? cfg.label.toLowerCase() : cfg.plural.toLowerCase())
      : rows.length + ' of ' + state.rows.length + ' shown';
  }

  /* ---------- Acting ---------- */

  function move(id, to, button) {
    var row = state.rows.filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row) { return; }

    var spec = ed.movesFrom(row.status, guard.isAdmin())
                 .filter(function (m) { return m.to === to; })[0];
    if (!spec) { return; }     // not a move this person has, so not one to attempt
    var title = row[cfg.titleField] || 'this entry';

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
      button.disabled = true;

      ed.setStatus(type, id, to).then(function (res) {
        if (res.error) { throw res.error; }
        // Update in place rather than reloading: the list can be long and
        // the person is working down it.
        row.status = res.data.status;
        row.updated_at = res.data.updated_at;
        row.updated_by = res.data.updated_by;
        draw();
        ed.message(msgEl, 'ok', '“' + title + '” is now ' + ed.STATUSES[to].label.toLowerCase() + '.');
      }).catch(function (err) {
        button.disabled = false;
        ed.message(msgEl, 'error', ed.describeError(err, 'this ' + cfg.label.toLowerCase()));
      });
    });
  }

  hostEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-move]');
    if (btn) { move(btn.getAttribute('data-id'), btn.getAttribute('data-move'), btn); return; }

    if (e.target.closest('[data-clear]')) {
      state.status = '';
      state.query = '';
      searchEl.value = '';
      filtersEl.querySelectorAll('.mc-chip').forEach(function (c) {
        c.classList.toggle('is-active', !c.getAttribute('data-status'));
      });
      syncUrl();
      draw();
    }
  });

  filtersEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.mc-chip');
    if (!chip) { return; }
    state.status = chip.getAttribute('data-status') || '';
    filtersEl.querySelectorAll('.mc-chip').forEach(function (c) {
      c.classList.toggle('is-active', c === chip);
    });
    syncUrl();
    draw();
    countTabs();      // the pills follow the filter — see countTabs()
    retargetTabs();
  });

  /* The filter goes in the URL so it survives a reload and can be sent to
     somebody. replaceState, not pushState: a filter is not a place, and
     six chip clicks should not be six presses of the back button to
     leave the page. */
  function syncUrl() {
    var url = 'content.html?type=' + type + (state.status ? '&status=' + state.status : '');
    window.history.replaceState(null, '', url);
  }

  var typing;
  searchEl.addEventListener('input', function () {
    window.clearTimeout(typing);
    typing = window.setTimeout(function () {
      state.query = searchEl.value;
      draw();
    }, 120);
  });

  guard.ready.then(load);

})();
