

(function () {
  'use strict';

  var db = window.supabaseClient;

  var listEl, msgEl, countEl, filtersEl, refreshEl;
  var reportRows = [];
  var diseases = [];
  var filter = 'new';
  var started = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function message(text, kind) {
    if (!msgEl) { return; }
    msgEl.textContent = text;
    msgEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
    if (kind === 'ok') {
      window.setTimeout(function () { msgEl.style.display = 'none'; }, 4000);
    }
  }

  function explain(err) {
    if (!err) { return 'Something went wrong.'; }
    if (err.code === '42501') {

      return 'The database refused this change: your account does not have permission (RLS).';
    }
    return err.message || 'Something went wrong.';
  }

  function when(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d)) { return ''; }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
           ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  
  function itemLabel(r) {
    if (r.item_type === 'disease') {
      var hit = diseases.filter(function (d) { return d.id === r.item_id; })[0];
      if (hit) { return esc(hit.name); }
    }
    return esc(r.item_type) + ' #' + esc(r.item_id);
  }

  function loadDiseases() {
    return db.from('diseases').select('id,name').order('id')
      .then(function (res) { if (!res.error) { diseases = res.data || []; } })
      .catch(function () {  });
  }

  function loadReports() {
    if (!listEl) { return; }
    listEl.innerHTML = '<div class="mc-admin-loading">Loading reports…</div>';
    var q = db.from('reports').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') { q = q.eq('status', filter); }

    q.then(function (res) {
      if (res.error) { throw res.error; }
      reportRows = res.data || [];
      render();
      refreshCount();
    }).catch(function (err) {
      console.error('[MedCare] Could not load reports:', err);
      listEl.innerHTML = '<div class="mc-admin-loading">Could not load reports.</div>';
      message(explain(err));
    });
  }


  function refreshCount() {
    if (!countEl) { return; }
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'new')
      .then(function (res) {
        if (!res.error) { countEl.textContent = res.count == null ? '0' : res.count; }
      })
      .catch(function () {  });
  }

  function render() {
    if (!reportRows.length) {
      listEl.innerHTML = '<div class="mc-admin-loading">' +
        (filter === 'new' ? 'No new reports. Nothing waiting for you.'
                          : 'No reports match this filter.') + '</div>';
      return;
    }
    listEl.innerHTML = reportRows.map(function (r) {
      var reviewed = r.status === 'reviewed';
      return '<div class="mc-report-row" data-id="' + r.id + '">' +
        '<div class="mc-report-row-head">' +
          '<span class="mc-report-item"><i class="bi bi-file-medical"></i> ' + itemLabel(r) + '</span>' +
          '<span class="mc-admin-pill mc-report-status mc-report-status--' + esc(r.status) + '">' + esc(r.status) + '</span>' +
        '</div>' +

        '<div class="mc-report-reason">' + esc(r.reason) + '</div>' +
        '<div class="mc-report-foot">' +
          '<span class="mc-report-meta">' +
            '<i class="bi bi-clock"></i> ' + esc(when(r.created_at)) +
            ' · <span class="mc-report-type">' + esc(r.item_type) + '</span>' +
            ' · reporter ' + esc(String(r.user_id || 'unknown').slice(0, 8)) +
          '</span>' +
          '<button type="button" class="mc-auth-btn ' + (reviewed ? 'mc-auth-btn--ghost' : '') + '" ' +
            'data-report-act="' + (reviewed ? 'reopen' : 'review') + '" data-id="' + r.id + '">' +
            (reviewed ? 'Reopen' : 'Mark reviewed') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  
  function onListClick(e) {
    var btn = e.target.closest('[data-report-act]');
    if (!btn) { return; }
    var id = Number(btn.getAttribute('data-id'));
    var next = btn.getAttribute('data-report-act') === 'review' ? 'reviewed' : 'new';

    btn.disabled = true;
    btn.textContent = 'Saving…';

    db.from('reports').update({ status: next }).eq('id', id).select()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data || !res.data.length) {
          message('That report was not updated. The database did not permit the change.');
          btn.disabled = false;
          btn.textContent = next === 'reviewed' ? 'Mark reviewed' : 'Reopen';
          return;
        }
        message(next === 'reviewed' ? 'Report marked reviewed.' : 'Report reopened.', 'ok');
        loadReports();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not update report:', err);
        btn.disabled = false;
        btn.textContent = next === 'reviewed' ? 'Mark reviewed' : 'Reopen';
        message(explain(err));
      });
  }

  function onFilterClick(e) {
    var btn = e.target.closest('[data-status]');
    if (!btn) { return; }
    filter = btn.getAttribute('data-status');
    Array.prototype.forEach.call(filtersEl.children, function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    if (msgEl) { msgEl.style.display = 'none'; }
    loadReports();
  }

  window.MedCareReportsQueue = {

    start: function () {
      if (started || !db) { return; }
      listEl    = document.getElementById('reportList');
      if (!listEl) { return; }
      started   = true;
      msgEl     = document.getElementById('reportMsg');
      countEl   = document.getElementById('reportNewCount');
      filtersEl = document.getElementById('reportFilters');
      refreshEl = document.getElementById('reportRefresh');

      listEl.addEventListener('click', onListClick);
      if (filtersEl) { filtersEl.addEventListener('click', onFilterClick); }
      if (refreshEl) {
        refreshEl.addEventListener('click', function () {
          if (msgEl) { msgEl.style.display = 'none'; }
          loadReports();
        });
      }


      loadDiseases().then(loadReports, loadReports);
    },
    reload: function () { if (started) { loadReports(); } }
  };

})();
