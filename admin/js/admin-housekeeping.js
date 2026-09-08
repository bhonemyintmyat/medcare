(function () {
  'use strict';

  var ad = window.MedCareAdmin;
  var ed = window.MedCareEditor;
  var db = window.supabaseClient;
  if (!ad || !db || !document.getElementById('hkOwners')) { return; }

  var msgEl = document.getElementById('hkMsg');

  var TABLES = [
    { name: 'diseases',           kind: 'disease',   title: 'name',  href: true,  source: true },
    { name: 'articles',           kind: 'article',   title: 'title', href: true,  source: true },
    { name: 'hospitals',          kind: 'hospital',  title: 'name',  href: false, source: false },
    { name: 'emergency_contacts', kind: 'emergency', title: 'name',  href: false, source: true }
  ];

  function editHref(kind, id) {
    return '../editor/entry.html?type=' + encodeURIComponent(kind) + '&id=' + encodeURIComponent(id);
  }

  function render(hostId, countId, state, items, note) {
    var host  = document.getElementById(hostId);
    var count = document.getElementById(countId);
    if (!host) { return; }

    if (state === 'busy') {
      count.textContent = '…';
      count.className = 'mc-admin-count';
      host.innerHTML = '<p class="mc-admin-loading">Checking…</p>';
      return;
    }

    if (state === 'error') {
      count.textContent = '—';
      count.className = 'mc-admin-count';
      host.innerHTML = '<p class="mc-admin-msg mc-admin-msg--error">' + ad.esc(note) + '</p>';
      return;
    }

    count.textContent = String(items.length);
    count.className = 'mc-admin-count' + (items.length ? ' is-flagged' : '');

    var html = '';
    if (note) { html += '<p class="mc-admin-hint">' + note + '</p>'; }

    if (!items.length) {
      html += '<p class="mc-admin-hint mc-admin-hint-inline">' +
              '<i class="bi bi-check2"></i> Nothing to do.</p>';
      host.innerHTML = html;
      return;
    }

    html += '<div class="mc-admin-queue">';
    items.forEach(function (it) {
      html += '<div class="mc-admin-row">' +
                '<span class="mc-admin-row-main">' +
                  '<span class="mc-admin-row-name">' + ad.esc(it.title) + '</span>' +
                  '<span class="mc-admin-row-meta">' + ad.esc(it.meta) + '</span>' +
                '</span>' +
                (it.href
                  ? '<a class="mc-auth-btn mc-auth-btn--ghost" href="' + ad.esc(it.href) + '">' +
                    ad.esc(it.action || 'Open') + '</a>'
                  : '') +
              '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function checkOwners() {
    render('hkOwners', 'hkOwnersCount', 'busy');

    return Promise.all(TABLES.map(function (t) {
      return db.from(t.name)
        .select('id,' + t.title + ',updated_by,created_by,updated_at')
        .is('updated_by', null)
        .then(function (res) {
          if (res.error) { throw res.error; }
          return (res.data || []).map(function (row) {
            return {
              title: row[t.title] || ('#' + row.id),
              meta: t.name + ' · nobody recorded as having edited it' +
                    (row.created_by ? ' · created by an account that still exists' : ''),
              href: editHref(t.kind, row.id),
              action: 'Open'
            };
          });
        });
    })).then(function (lists) {
      var items = [].concat.apply([], lists);
      render('hkOwners', 'hkOwnersCount', 'done', items,
        'Rows nobody has saved through the editor. Content seeded by the ' +
        'migrations starts this way and stops appearing the first time it ' +
        'is edited; a row that <em>was</em> owned appears here when that ' +
        'account is deleted, because the column is cleared rather than the ' +
        'row removed.');
    })['catch'](function (err) {
      render('hkOwners', 'hkOwnersCount', 'error', null, ad.describeError(err, 'the content'));
    });
  }

  function fetchStatus(url) {
    return fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        if (r.ok) { return r.status; }
        return fetch(url, { method: 'GET', cache: 'no-store' }).then(function (g) { return g.status; });
      })
      ['catch'](function () { return 0; });
  }

  function inBatches(list, size, work) {
    var out = [];
    var i = 0;
    function next() {
      if (i >= list.length) { return Promise.resolve(out); }
      var slice = list.slice(i, i + size);
      i += size;
      return Promise.all(slice.map(work)).then(function (done) {
        out = out.concat(done);
        return next();
      });
    }
    return next();
  }

  function checkLinks() {
    render('hkLinks', 'hkLinksCount', 'busy');

    var withHref = TABLES.filter(function (t) { return t.href; });

    return Promise.all(withHref.map(function (t) {
      return db.from(t.name).select('id,' + t.title + ',href')
        .then(function (res) {
          if (res.error) { throw res.error; }
          return (res.data || []).map(function (row) {
            return { table: t, id: row.id, title: row[t.title] || ('#' + row.id), href: row.href };
          });
        });
    })).then(function (lists) {
      var rows = [].concat.apply([], lists).filter(function (r) { return r.href; });

      return inBatches(rows, 4, function (r) {
        return fetchStatus('../' + r.href).then(function (status) {
          return { row: r, status: status };
        });
      }).then(function (checked) {
        var bad = checked.filter(function (c) { return c.status !== 200; });
        var items = bad.map(function (c) {
          return {
            title: c.row.title,
            meta: c.row.table.name + ' · ' + c.row.href + ' · ' +
                  (c.status ? 'HTTP ' + c.status : 'the request did not complete'),
            href: editHref(c.row.table.kind, c.row.id),
            action: 'Open'
          };
        });
        render('hkLinks', 'hkLinksCount', 'done', items,
          'Each href fetched from this browser: ' + rows.length +
          ' checked. A link can be dead because the file was renamed, or ' +
          'because the row points somewhere it never should have.');
      });
    })['catch'](function (err) {
      render('hkLinks', 'hkLinksCount', 'error', null, ad.describeError(err, 'the links'));
    });
  }

  function checkSources() {
    render('hkSources', 'hkSourcesCount', 'busy');

    if (!ed || !ed.sourceLooksApproved) {
      render('hkSources', 'hkSourcesCount', 'error', null,
        'The editor rules did not load, so source URLs were not checked.');
      return Promise.resolve();
    }

    var withSource = TABLES.filter(function (t) { return t.source; });

    return Promise.all(withSource.map(function (t) {
      return db.from(t.name).select('id,' + t.title + ',source_url')
        .not('source_url', 'is', null)
        .then(function (res) {
          if (res.error) { throw res.error; }
          return (res.data || [])
            .filter(function (row) { return !ed.sourceLooksApproved(row.source_url); })
            .map(function (row) {
              return {
                title: row[t.title] || ('#' + row.id),
                meta: t.name + ' · ' + row.source_url,
                href: editHref(t.kind, row.id),
                action: 'Open'
              };
            });
        });
    })).then(function (lists) {
      var items = [].concat.apply([], lists);
      render('hkSources', 'hkSourcesCount', 'done', items,
        'Citations that are neither who.int nor mohs.gov.mm. The database ' +
        'refuses these on the way in, so anything here was saved before ' +
        'that rule existed and is worth reading before it is removed.');
    })['catch'](function (err) {
      render('hkSources', 'hkSourcesCount', 'error', null, ad.describeError(err, 'the sources'));
    });
  }

  function checkAccounts() {
    render('hkAccounts', 'hkAccountsCount', 'busy');

    return db.rpc('accounts_without_profile').then(function (res) {
      if (res.error) { throw res.error; }
      var items = (res.data || []).map(function (row) {
        return {
          title: row.email || row.id,
          meta: 'signed up ' + ad.when(row.created_at) + ' · no row in profiles, so no role',
          href: 'users.html',
          action: 'Accounts'
        };
      });
      render('hkAccounts', 'hkAccountsCount', 'done', items,
        'A profile is created by a database trigger the moment an account ' +
        'is, so this is normally empty. An account without one cannot be ' +
        'given a role from the accounts screen, because that screen lists ' +
        'profiles. Section 4 of supabase_auth.sql is the backfill.');
    })['catch'](function (err) {
      var missing = err && (err.code === 'PGRST202' || /accounts_without_profile/.test(err.message || ''));
      render('hkAccounts', 'hkAccountsCount', 'error', null,
        missing
          ? 'This check needs supabase_housekeeping.sql, which has not been run yet.'
          : ad.describeError(err, 'the accounts'));
    });
  }

  function runAll() {
    var btn = document.getElementById('hkRun');
    if (btn) { btn.disabled = true; }
    ad.message(msgEl, null, '');

    var stampEl = document.getElementById('hkStamp');
    if (stampEl) { stampEl.textContent = 'Checking…'; }

    Promise.all([checkOwners(), checkLinks(), checkSources(), checkAccounts()])
      .then(function () {
        if (stampEl) { stampEl.textContent = 'Last checked ' + ad.whenExact(new Date().toISOString()); }
      })
      ['catch'](function () {  })
      .then(function () { if (btn) { btn.disabled = false; } });
  }

  var runBtn = document.getElementById('hkRun');
  if (runBtn) { runBtn.addEventListener('click', runAll); }
  runAll();
})();
