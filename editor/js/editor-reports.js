/* ============================================================
   MedCare — the report queue (editor/reports.html)

   A report is a reader saying "this page is wrong". Triage is therefore
   an editor's job and not an admin's: the person who can fix the page is
   the person who should read the complaint about it.

   WHAT CLOSING A REPORT REQUIRES, AND WHY

   A note. Both Resolve and Reject ask for one and neither will submit
   without it. The queue is small and the temptation to clear it with a
   row of Resolve clicks is real; a mandatory sentence is what makes
   somebody decide rather than tidy. It is also the only record of what
   was done — the next person to be told this page is wrong reads it, and
   "resolved" on its own tells them nothing they can use.

   WHAT THE DATABASE RECORDS AND THE BROWSER CANNOT

   resolved_by and resolved_at are set by a trigger from the verified
   token, and are not in the column grant. So who closed a report and
   when is not something this page could get wrong or be made to lie
   about. It sends the status and the note; the rest is Postgres.

   WHAT IS NOT HERE

   No delete. There is no delete policy on `reports` for anybody, and a
   reader telling us we published something dangerous does not get to be
   made to disappear from a UI. Rejecting one is a decision with a name
   and a reason attached, which is the honest version of the same button.

   No reporter's name or email. `profiles` is not readable by an editor,
   so the queue shows what was said and not who said it. That is the
   brief's line about user accounts, and this is what it looks like from
   the inside: it turns out you can triage perfectly well without it.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  if (!guard || !ed) { return; }

  var hostEl    = document.getElementById('repHost');
  var msgEl     = document.getElementById('repMsg');
  var countEl   = document.getElementById('repCount');
  var searchEl  = document.getElementById('repSearch');
  var filtersEl = document.getElementById('repFilters');

  /* The reports table stores target_type as free text so a new kind of
     reportable thing needs no migration. This is the map from that text
     to something this area can open. Anything not in it still shows in
     the queue — it just has no link. */
  var TARGETS = {
    disease:  'disease',
    diseases: 'disease',
    article:  'article',
    articles: 'article',
    hospital: 'hospital',
    hospitals: 'hospital'
  };

  var state = {
    rows: [],
    titles: {},        // "disease:12" -> "Dengue fever"
    names: {},
    status: 'open',
    query: ''
  };

  filtersEl.querySelectorAll('.mc-chip').forEach(function (chip) {
    chip.classList.toggle('is-active', (chip.getAttribute('data-status') || '') === state.status);
  });

  /* ---------- What is being reported ----------
     One query per content table for the ids actually referenced, rather
     than one per report. A queue of forty reports about the same disease
     page is one row fetched, not forty. */
  function loadTitles(rows) {
    var wanted = {};
    rows.forEach(function (r) {
      var type = TARGETS[String(r.target_type || '').toLowerCase()];
      if (!type || !r.target_id) { return; }
      (wanted[type] = wanted[type] || []).push(r.target_id);
    });

    var types = Object.keys(wanted);
    if (!types.length) { return Promise.resolve({}); }

    return Promise.all(types.map(function (type) {
      var cfg = ed.TYPES[type];
      return db.from(cfg.table).select('id, ' + cfg.titleField + ', status')
        .in('id', wanted[type])
        .then(function (res) {
          var out = {};
          (res.data || []).forEach(function (row) {
            out[type + ':' + row.id] = { title: row[cfg.titleField], status: row.status };
          });
          return out;
        })
        .catch(function () { return {}; });
    })).then(function (parts) {
      return parts.reduce(function (all, part) { return Object.assign(all, part); }, {});
    });
  }

  function targetHtml(row) {
    var type = TARGETS[String(row.target_type || '').toLowerCase()];
    var key  = type + ':' + row.target_id;
    var hit  = state.titles[key];

    if (!type) {
      return '<span class="mc-ed-report-target">' +
               '<i class="bi bi-question-circle"></i> ' +
               ed.esc(row.target_type || 'unknown') + ' #' + ed.esc(row.target_id) +
             '</span>';
    }

    if (!hit) {
      /* The row it points at is gone, or was never there. Worth saying
         rather than hiding: a report about a page that no longer exists
         is one you can usually close, and knowing that is the whole
         decision. */
      return '<span class="mc-ed-report-target">' +
               '<i class="bi bi-slash-circle"></i> ' +
               ed.esc(ed.TYPES[type].label) + ' #' + ed.esc(row.target_id) +
               ' — no longer in the database' +
             '</span>';
    }

    return '<span class="mc-ed-report-target">' +
             '<i class="bi ' + ed.TYPES[type].icon + '"></i> ' +
             '<a href="entry.html?type=' + type + '&id=' + row.target_id + '">' +
               ed.esc(hit.title) + '</a> ' +
             ed.statusPill(hit.status) +
           '</span>';
  }

  function rowHtml(row) {
    var open = row.status === 'open';

    return '<div class="mc-report-row" data-report="' + row.id + '">' +

             '<div class="mc-report-row-head">' +
               '<span class="mc-report-item">' + targetHtml(row) + '</span>' +
               ed.statusPill(row.status === 'dismissed' ? 'dismissed' : row.status) +
             '</div>' +

             '<div class="mc-report-reason">' + ed.esc(row.reason) + '</div>' +

             (row.detail
               ? '<div class="mc-report-reason" style="background:#fff;border:1px solid var(--mc-border)">' +
                   ed.esc(row.detail) + '</div>'
               : '') +

             (row.resolution_note
               ? '<div class="mc-ed-report-note' +
                   (row.status === 'dismissed' ? ' mc-ed-report-note--dismissed' : '') + '">' +
                   '<strong>' + (row.status === 'dismissed' ? 'Rejected' : 'Resolved') + ':</strong> ' +
                   ed.esc(row.resolution_note) +
                 '</div>'
               : '') +

             '<div class="mc-report-foot">' +
               '<span class="mc-report-meta">' +
                 '<i class="bi bi-clock"></i> Filed ' + ed.esc(ed.when(row.created_at)) +
                 (row.resolved_at
                   ? ' · closed ' + ed.esc(ed.when(row.resolved_at)) +
                     (row.resolved_by && state.names[row.resolved_by]
                       ? ' by ' + ed.esc(state.names[row.resolved_by]) : '')
                   : '') +
               '</span>' +
               '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
                 (open
                   ? '<button type="button" class="mc-auth-btn" data-close-as="resolved">' +
                       '<i class="bi bi-check-lg"></i> Resolve</button>' +
                     '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close-as="dismissed">' +
                       'Reject</button>'
                   : '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-reopen>' +
                       'Reopen</button>') +
               '</div>' +
             '</div>' +

             '<div class="mc-ed-report-form" data-form hidden>' +
               '<label class="mc-auth-label" for="note_' + row.id + '" data-note-label></label>' +
               '<textarea id="note_' + row.id + '" data-note rows="2"></textarea>' +
               '<p class="mc-ed-error" data-note-error hidden></p>' +
               '<div class="mc-ed-report-acts">' +
                 '<button type="button" class="mc-auth-btn" data-confirm>Save and close it</button>' +
                 '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-cancel>Cancel</button>' +
               '</div>' +
             '</div>' +

           '</div>';
  }

  function visible() {
    var q = state.query.trim().toLowerCase();
    return state.rows.filter(function (row) {
      if (state.status && row.status !== state.status) { return false; }
      if (!q) { return true; }
      return String(row.reason || '').toLowerCase().indexOf(q) !== -1 ||
             String(row.detail || '').toLowerCase().indexOf(q) !== -1 ||
             String(row.resolution_note || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function draw() {
    var rows = visible();

    if (!rows.length) {
      var clear = state.status === 'open' && !state.query;
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi ' +
            (clear ? 'bi-check2-circle' : 'bi-funnel') + '"></i></span>' +
          '<h2>' + (clear ? 'The queue is clear' : 'Nothing matches') + '</h2>' +
          '<p>' + (clear
            ? 'No reader is currently waiting to hear that something was wrong.'
            : 'No report matches what you have filtered to.') + '</p>' +
        '</div>';
      countEl.textContent = '';
      return;
    }

    hostEl.innerHTML = rows.map(rowHtml).join('');

    var open = state.rows.filter(function (r) { return r.status === 'open'; }).length;
    countEl.textContent = rows.length + ' shown · ' +
      (open ? open + ' still open' : 'none open');
  }

  /* ---------- Closing one ---------- */

  function card(id) { return hostEl.querySelector('[data-report="' + id + '"]'); }

  hostEl.addEventListener('click', function (e) {
    var wrap = e.target.closest('[data-report]');
    if (!wrap) { return; }
    var id  = wrap.getAttribute('data-report');
    var row = state.rows.filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row) { return; }

    var form = wrap.querySelector('[data-form]');

    var opener = e.target.closest('[data-close-as]');
    if (opener) {
      var as = opener.getAttribute('data-close-as');
      form.setAttribute('data-as', as);
      form.hidden = false;
      wrap.querySelector('[data-note-label]').textContent = as === 'resolved'
        ? 'What was done about it? Whoever reads the next report about this page sees this.'
        : 'Why is this being rejected? The reader is not told, but the team is.';
      wrap.querySelector('[data-note]').focus();
      return;
    }

    if (e.target.closest('[data-cancel]')) {
      form.hidden = true;
      wrap.querySelector('[data-note]').value = '';
      wrap.querySelector('[data-note-error]').hidden = true;
      return;
    }

    if (e.target.closest('[data-confirm]')) {
      var note = wrap.querySelector('[data-note]').value.trim();
      var err  = wrap.querySelector('[data-note-error]');

      if (note.length < 4) {
        err.innerHTML = '<i class="bi bi-exclamation-circle"></i>' +
                        '<span>Say what happened, even briefly. This is the only record of it.</span>';
        err.hidden = false;
        return;
      }
      err.hidden = true;
      close(row, form.getAttribute('data-as'), note, wrap);
      return;
    }

    if (e.target.closest('[data-reopen]')) {
      /* Reopening clears resolved_by and resolved_at — the trigger does
         it, not this code. The note is deliberately left in place: it is
         the history of what was tried, and the reason somebody is
         reopening it is usually that the note was not enough. */
      close(row, 'open', row.resolution_note, wrap);
    }
  });

  function close(row, status, note, wrap) {
    wrap.querySelectorAll('button').forEach(function (b) { b.disabled = true; });

    db.from('reports')
      .update({ status: status, resolution_note: note || null })
      .eq('id', row.id).select().single()
      .then(function (res) {
        if (res.error) { throw res.error; }
        var i = state.rows.indexOf(row);
        state.rows[i] = res.data;
        return ed.loadNames([res.data.resolved_by]).then(function (more) {
          Object.assign(state.names, more);
          draw();
          ed.message(msgEl, 'ok',
            status === 'open' ? 'Report reopened.' :
            status === 'resolved' ? 'Marked resolved.' : 'Rejected.');
        });
      })
      .catch(function (err) {
        wrap.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
        ed.message(msgEl, 'error', ed.describeError(err, 'reports'));
      });
  }

  /* ---------- Filters ---------- */

  filtersEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.mc-chip');
    if (!chip) { return; }
    state.status = chip.getAttribute('data-status') || '';
    filtersEl.querySelectorAll('.mc-chip').forEach(function (c) {
      c.classList.toggle('is-active', c === chip);
    });
    draw();
  });

  var typing;
  searchEl.addEventListener('input', function () {
    window.clearTimeout(typing);
    typing = window.setTimeout(function () { state.query = searchEl.value; draw(); }, 120);
  });

  /* ---------- Start ---------- */

  guard.ready.then(function () {
    db.from('reports').select('*').order('created_at', { ascending: false }).limit(400)
      .then(function (res) {
        if (res.error) { throw res.error; }
        state.rows = res.data || [];
        return Promise.all([
          loadTitles(state.rows),
          ed.loadNames(state.rows.map(function (r) { return r.resolved_by; }))
        ]);
      })
      .then(function (out) {
        state.titles = out[0];
        state.names  = out[1];
        draw();
      })
      .catch(function (err) {
        hostEl.innerHTML =
          '<div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not open the queue</h2>' +
            '<p>' + ed.esc(ed.describeError(err, 'reports')) + '</p>' +
            '<p class="mc-admin-hint" style="margin-top:.6rem">Reports were admin-only until ' +
               'section 4 of supabase_editor.sql; if that has not been run, this is why.</p>' +
          '</div>';
        countEl.textContent = '';
      });
  });

})();
