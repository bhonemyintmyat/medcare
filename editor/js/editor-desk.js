/* ============================================================
   MedCare — the editor desk (editor/index.html)

   A desk answers one question: what is waiting for me. So this screen
   is counts that are also links, and a list of what you touched last.

   What it is not is a dashboard. There are no charts here for the same
   reason there are none in the admin area: the site does not record what
   anybody read, so there is nothing to chart, and inventing something to
   fill the space would mean starting to collect it.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  if (!guard || !ed) { return; }

  var statsEl  = document.getElementById('deskStats');
  var recentEl = document.getElementById('deskRecent');
  var msgEl    = document.getElementById('deskMsg');
  var noteEl   = document.getElementById('deskAdminNote');

  var TYPES = ed.TYPES;

  /* A count query per table per status is nine round trips for five
     numbers. One `select('id, status')` per table is three, and the
     tables are small enough that the rows cost less than the requests.
     If a table ever outgrows that, this is where the count() queries go
     back in. */
  function tally() {
    var wanted = Object.keys(TYPES);

    return Promise.all(wanted.map(function (type) {
      return db.from(TYPES[type].table).select('id, status').then(function (res) {
        return { type: type, error: res.error, rows: res.data || [] };
      });
    })).then(function (results) {
      var counts = { draft: 0, pending: 0, published: 0, archived: 0 };
      var failed = [];

      results.forEach(function (r) {
        if (r.error) { failed.push(TYPES[r.type].plural.toLowerCase()); return; }
        r.rows.forEach(function (row) {
          if (counts[row.status] !== undefined) { counts[row.status]++; }
        });
      });

      return { counts: counts, failed: failed };
    });
  }

  function openReports() {
    return db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open')
      .then(function (res) { return res.error ? null : (res.count || 0); })
      .catch(function () { return null; });
  }

  /* How many keys still have no Burmese. The key list comes from
     script.js, and the overrides from the table, so this number is the
     same arithmetic the translations screen does — see the note there
     about a blank override not counting as a translation. */
  function missingTranslations() {
    var i18n = window.MedCareI18n;
    if (!i18n) { return Promise.resolve(null); }

    var keys = i18n.keys();
    return db.from('translations').select('en, my')
      .then(function (res) {
        var have = {};
        if (!res.error) {
          (res.data || []).forEach(function (row) {
            if (row.my && String(row.my).trim()) { have[row.en] = true; }
          });
        }
        var missing = 0;
        keys.forEach(function (key) {
          var fromFile = i18n.fromFile(key);
          if (!have[key] && !(fromFile && String(fromFile).trim())) { missing++; }
        });
        return missing;
      })
      .catch(function () { return null; });
  }

  /* Emergency numbers are not in tally() — that walks TYPES, which is
     the three things with a content list, and the emergency table has
     its own screen. But a number sitting unpublished is the highest-cost
     invisible thing on this site: somebody typed an ambulance line and
     readers cannot see it. So it is counted separately, and only shows
     up when it is not zero — a tile that reads 0 every day is furniture
     people stop seeing, which is the opposite of what this one is for. */
  function emergencyWaiting() {
    return db.from('emergency_contacts').select('id', { count: 'exact', head: true })
      .neq('status', 'published')
      .then(function (res) { return res.error ? null : (res.count || 0); })
      .catch(function () { return null; });
  }

  function stat(href, num, label, attention) {
    // A number we could not read is printed as a dash. A zero that is
    // really "the query failed" is the one wrong number on this screen
    // that would actually change what somebody does next.
    var shown = (num === null || num === undefined) ? '—' : num;
    return '<a class="mc-ed-stat' + (attention && num ? ' mc-ed-stat--attention' : '') + '" href="' + href + '">' +
             '<div class="mc-ed-stat-num">' + ed.esc(shown) + '</div>' +
             '<p class="mc-ed-stat-label">' + ed.esc(label) + '</p>' +
           '</a>';
  }

  function drawStats(data, reports, missing, emergency) {
    var c = data.counts;

    /* The pending count is the same number to both roles and a different
       sentence. To an editor it is work they have handed over; to an
       admin it is the queue only they can clear, and it is the one thing
       on this desk that is waiting specifically on them. */
    var pendingLabel = guard.isAdmin() ? 'Waiting for you to publish' : 'Awaiting review';

    statsEl.innerHTML =
      stat('content.html?type=disease&status=draft',     c.draft,     'Drafts') +
      stat('content.html?type=disease&status=pending',   c.pending,   pendingLabel, true) +
      stat('content.html?type=disease&status=published', c.published, 'Published') +
      stat('reports.html',                               reports,     'Open reports', true) +
      stat('translations.html?filter=todo',              missing,     'Strings without Burmese', true) +
      (emergency ? stat('emergency.html', emergency,
                        emergency === 1 ? 'Emergency number not on the page'
                                        : 'Emergency numbers not on the page', true) : '');

    if (data.failed.length) {
      ed.message(msgEl, 'error',
        'Could not read ' + data.failed.join(' or ') + '. The counts above are missing those. ' +
        'If you have not run supabase_editor.sql yet, that is the first thing to check.');
    }
  }

  /* The list is "what you touched last", not "what changed last": the
     desk is for picking work back up. `updated_by` is the right column
     for that — it is who touched it, which after an edit is you, and
     unlike created_by it survives somebody else's page becoming yours to
     fix. Falls back to everybody's recent changes when you have not
     edited anything yet, so a new editor's desk is not empty. */
  function recent(userId) {
    var wanted = Object.keys(TYPES);

    return Promise.all(wanted.map(function (type) {
      return db.from(TYPES[type].table)
        .select('*').order('updated_at', { ascending: false }).limit(12)
        .then(function (res) {
          return (res.data || []).map(function (row) {
            row._type = type;
            return row;
          });
        })
        .catch(function () { return []; });
    })).then(function (lists) {
      var all = [].concat.apply([], lists);
      var mine = all.filter(function (r) { return r.updated_by === userId; });
      var pick = mine.length ? mine : all;

      pick.sort(function (a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      return { rows: pick.slice(0, 6), yours: mine.length > 0 };
    });
  }

  function drawRecent(result) {
    if (!result.rows.length) {
      recentEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-pencil"></i></span>' +
          '<h2>Nothing here yet</h2>' +
          '<p>Once there are diseases, articles, hospitals or pharmacies in ' +
             'the database, the ones you touched most recently appear here.</p>' +
          '<a class="mc-auth-btn" href="entry.html?type=disease">Write the first one</a>' +
        '</div>';
      return;
    }

    var intro = result.yours
      ? ''
      : '<p class="mc-admin-hint">You have not edited anything yet, so this is what the ' +
        'team changed most recently.</p>';

    recentEl.innerHTML = intro + '<div class="mc-ed-list">' +
      result.rows.map(function (row) {
        var cfg   = TYPES[row._type];
        var title = row[cfg.titleField] || '(untitled)';
        return '<div class="mc-ed-row' + (row.status === 'archived' ? ' mc-ed-row--archived' : '') + '">' +
                 '<span class="mc-ed-row-ico"><i class="bi ' + cfg.icon + '"></i></span>' +
                 '<div class="mc-ed-row-title">' +
                   '<a href="entry.html?type=' + row._type + '&id=' + row.id + '">' + ed.esc(title) + '</a>' +
                   ed.statusPill(row.status) +
                 '</div>' +
                 '<div class="mc-ed-row-meta">' +
                   '<span>' + ed.esc(cfg.label) + '</span>' +
                   '<span>Changed ' + ed.esc(ed.when(row.updated_at)) + '</span>' +
                 '</div>' +
                 '<div class="mc-ed-row-actions">' +
                   '<a class="mc-auth-btn mc-auth-btn--ghost" href="entry.html?type=' + row._type + '&id=' + row.id + '">Open</a>' +
                 '</div>' +
               '</div>';
      }).join('') + '</div>';
  }

  guard.ready.then(function (who) {
    if (guard.isAdmin() && noteEl) { noteEl.hidden = false; }

    Promise.all([tally(), openReports(), missingTranslations(), emergencyWaiting()])
      .then(function (out) { drawStats(out[0], out[1], out[2], out[3]); })
      .catch(function (err) {
        statsEl.innerHTML = '';
        ed.message(msgEl, 'error', ed.describeError(err, 'the content tables'));
      });

    recent(who.user.id)
      .then(drawRecent)
      .catch(function (err) {
        recentEl.innerHTML =
          '<div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not read your recent work</h2>' +
            '<p>' + ed.esc(ed.describeError(err, 'the content tables')) + '</p>' +
          '</div>';
      });
  });

})();
