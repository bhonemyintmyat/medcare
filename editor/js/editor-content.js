

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  if (!guard || !ed) { return; }

  var hostEl    = document.getElementById('listHost');
  var msgEl     = document.getElementById('listMsg');
  var countEl   = document.getElementById('listCount');
  var searchEl  = document.getElementById('listSearch');
  var townEl    = document.getElementById('listTown');
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
    town: cfg.townField ? (params.get('town') || '') : '',
    query: ''
  };

  
  (function markNav() {
    
    var NAV_TYPE = { hospital: 'hospital', pharmacy: 'pharmacy' };
    var here = 'content.html?type=' + (NAV_TYPE[type] || 'disease');
    document.querySelectorAll('.mc-admin-nav a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href.indexOf('content.html') === 0) {
        if (href === here) { a.setAttribute('aria-current', 'page'); }
        else { a.removeAttribute('aria-current'); }
      }
    });
  })();

  
  function retargetTabs() {
    tabsEl.querySelectorAll('a').forEach(function (a) {
      var tabType = a.getAttribute('data-type');
      if (tabType === type) { a.setAttribute('aria-current', 'page'); }
      else { a.removeAttribute('aria-current'); }
      
      var keepTown = state.town && ed.TYPES[tabType].townField;
      a.setAttribute('href', 'content.html?type=' + tabType +
        (state.status ? '&status=' + state.status : '') +
        (keepTown ? '&town=' + encodeURIComponent(state.town) : ''));
    });
  }

  retargetTabs();

  newBtn.setAttribute('href', 'entry.html?type=' + type);
  newLabel.textContent = 'New ' + cfg.label.toLowerCase();

  filtersEl.querySelectorAll('.mc-chip').forEach(function (chip) {
    chip.classList.toggle('is-active', (chip.getAttribute('data-status') || '') === state.status);
  });

  
  function buildTowns() {
    if (!townEl || !cfg.townField) { return; }

    var used = [];
    state.rows.forEach(function (row) {
      var t = row[cfg.townField];
      if (t && used.indexOf(t) === -1) { used.push(t); }
    });
    used.sort();

    var rest = ed.TOWNSHIPS.filter(function (t) { return used.indexOf(t) === -1; });

    function options(list) {
      return list.map(function (t) {
        return '<option value="' + ed.esc(t) + '">' + ed.esc(t) + '</option>';
      }).join('');
    }

    townEl.innerHTML =
      '<option value="">All townships</option>' +
      (used.length ? '<optgroup label="In this list">' + options(used) + '</optgroup>' : '') +
      (rest.length ? '<optgroup label="Elsewhere in Yangon">' + options(rest) + '</optgroup>' : '');

    
    if (state.town && used.indexOf(state.town) === -1 && rest.indexOf(state.town) === -1) {
      state.town = '';
      syncUrl();
      retargetTabs();
    }

    townEl.value = state.town;
    townEl.hidden = false;
  }

  

  function load() {
    return ed.listRows(type, {}).then(function (res) {
      if (res.error) { throw res.error; }
      state.rows = res.data || [];
      return ed.loadNames(state.rows.map(function (r) { return r.updated_by; }));
    }).then(function (names) {
      state.names = names;
      buildTowns();
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

  
  function countTabs() {
    Object.keys(ed.TYPES).forEach(function (t) {
      var pill = tabsEl.querySelector('[data-count="' + t + '"]');
      if (!pill) { return; }

      
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

  
  function visible() {
    var q = state.query.trim().toLowerCase();
    return state.rows.filter(function (row) {
      if (state.status && row.status !== state.status) { return false; }

      if (state.town && row[cfg.townField] !== state.town) { return false; }
      if (!q) { return true; }
      return Object.keys(row).some(function (k) {
        if (k === 'id' || k.slice(-3) === '_by' || k.slice(-3) === '_at') { return false; }
        var v = row[k];
        return v != null && String(v).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  

  function actionsFor(row) {
    var moves = ed.movesFrom(row.status, guard.isAdmin());

    
    var open  = ed.canEditNow(row.status, guard.isAdmin()) ? 'Edit' : 'View';
    var html = '<a class="mc-auth-btn mc-auth-btn--ghost" href="entry.html?type=' + type +
               '&id=' + row.id + '">' + open + '</a>';

    
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

  

  function move(id, to, button) {
    var row = state.rows.filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row) { return; }

    var spec = ed.movesFrom(row.status, guard.isAdmin())
                 .filter(function (m) { return m.to === to; })[0];
    if (!spec) { return; }
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
      state.town = '';
      state.query = '';
      searchEl.value = '';
      if (townEl) { townEl.value = ''; }
      filtersEl.querySelectorAll('.mc-chip').forEach(function (c) {
        c.classList.toggle('is-active', !c.getAttribute('data-status'));
      });
      syncUrl();
      retargetTabs();
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
    countTabs();
    retargetTabs();
  });

  
  function syncUrl() {
    var url = 'content.html?type=' + type +
              (state.status ? '&status=' + state.status : '') +
              (state.town ? '&town=' + encodeURIComponent(state.town) : '');
    window.history.replaceState(null, '', url);
  }

  
  if (townEl) {
    townEl.addEventListener('change', function () {
      state.town = townEl.value;
      syncUrl();
      retargetTabs();
      draw();
    });
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
