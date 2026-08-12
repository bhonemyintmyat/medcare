/* ============================================================
   MedCare — manage diseases (editor/admin tool)
   Loaded only by manage-diseases.html, after auth.js.
   ============================================================ */

(function () {
  'use strict';

  var app = document.getElementById('adminApp');
  if (!app) { return; }

  var auth = window.MedCareAuth;
  var db   = window.supabaseClient;

  var checking  = document.getElementById('adminChecking');
  var form      = document.getElementById('diseaseForm');
  var formTitle = document.getElementById('formTitle');
  var submitBtn = document.getElementById('formSubmit');
  var cancelBtn = document.getElementById('formCancel');
  var listEl    = document.getElementById('adminList');
  var countEl   = document.getElementById('adminCount');
  var msgEl     = document.getElementById('adminMsg');
  var refresh   = document.getElementById('adminRefresh');
  var iconPrev  = document.getElementById('iconPreview');

  var f = {
    id:   document.getElementById('fId'),
    name: document.getElementById('fName'),
    desc: document.getElementById('fDesc'),
    tag:  document.getElementById('fTag'),
    cat:  document.getElementById('fCat'),
    icon: document.getElementById('fIcon'),
    href: document.getElementById('fHref')
  };

  var rows = [];

  /* ================================================================
     THE GUARD — CONVENIENCE ONLY, NOT SECURITY
     ----------------------------------------------------------------
     What the redirect below actually does: it stops a signed-in reader
     who wanders onto this URL from seeing a form that would only fail.
     That is a courtesy, nothing more.

     What it does NOT do: protect the data. Every line in this file runs
     on the visitor's own machine. Anyone can open DevTools, set a
     breakpoint, edit the source, or simply never load this page and
     POST to the REST API with curl. There is no client-side check
     anywhere that survives that.

     The real enforcement is the RLS policies on public.diseases:

         Staff can insert diseases  -> with check (my_role() in ('editor','admin'))
         Staff can update diseases  -> using + with check, same test
         Staff can delete diseases  -> using (my_role() in ('editor','admin'))

     Those run inside Postgres, after the JWT has been verified, on
     every single request. A user who deletes the redirect below still
     gets 42501 from the database — verified against the live project:
     a signed-in plain user was refused insert/update/delete, while an
     editor was allowed.

     Rule of thumb: JavaScript decides what to SHOW. The database
     decides what is ALLOWED. If you ever find yourself relying on this
     redirect to keep data safe, the policy is what needs fixing.
     ================================================================ */
  function guard() {
    if (!auth || !db) {
      checking.innerHTML = '<div class="container"><div class="mc-empty-simple" style="display:block">' +
        '<div class="fw-semibold">Supabase is not configured</div>' +
        '<div>See the console for details.</div></div></div>';
      return;
    }

    auth.ready.then(function () {
      if (!auth.isSignedIn()) {
        // Not logged in at all -> send to the login page.
        window.location.replace('login.html');
        return;
      }
      if (!auth.isStaff()) {
        // Signed in, but role is 'user'. Send them back to the site.
        // The database would refuse their writes regardless.
        window.location.replace('index.html');
        return;
      }
      checking.style.display = 'none';
      app.style.display = 'block';
      load();
      loadReports();
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function message(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
    msgEl.style.display = 'block';
    if (kind === 'ok') {
      window.setTimeout(function () { msgEl.style.display = 'none'; }, 4000);
    }
  }

  // Turns a Supabase error into something a human can act on.
  function explain(err) {
    if (!err) { return 'Something went wrong.'; }
    if (err.code === '42501') {
      // This is RLS refusing the write — the case the comment above
      // describes. Seeing it means the policies are doing their job.
      return 'The database refused this change: your account does not have permission (RLS).';
    }
    if (err.code === '23505') {
      return 'That link is already used by another condition. Links must be unique.';
    }
    if (err.code === '23514') {
      return 'A value failed a database check constraint.';
    }
    return err.message || 'Something went wrong.';
  }

  /* ---------- load + render ---------- */
  function load() {
    listEl.innerHTML = '<div class="mc-admin-loading">Loading…</div>';
    db.from('diseases').select('*').order('id')
      .then(function (res) {
        if (res.error) { throw res.error; }
        rows = res.data || [];
        render();
        fillDatalists();
        // Reports may have arrived first; re-render so they can show the
        // condition name rather than a bare id.
        if (reportRows.length) { renderReports(); }
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load diseases:', err);
        listEl.innerHTML = '<div class="mc-admin-loading">Could not load the list.</div>';
        message(explain(err));
      });
  }

  function render() {
    countEl.textContent = rows.length;
    if (!rows.length) {
      listEl.innerHTML = '<div class="mc-admin-loading">No conditions yet. Add the first one using the form.</div>';
      return;
    }
    listEl.innerHTML = rows.map(function (r) {
      return '<div class="mc-admin-row" data-id="' + r.id + '">' +
        '<div class="mc-admin-row-icon"><i class="bi ' + esc(r.icon) + '"></i></div>' +
        '<div class="mc-admin-row-main">' +
          '<div class="mc-admin-row-name">' + esc(r.name) + '</div>' +
          '<div class="mc-admin-row-meta">' +
            '<span class="mc-admin-pill">' + esc(r.tag) + '</span>' +
            '<span class="mc-admin-cat">' + esc(r.cat) + '</span>' +
          '</div>' +
          '<div class="mc-admin-row-href">' + esc(r.href) + '</div>' +
        '</div>' +
        '<div class="mc-admin-row-actions">' +
          '<button type="button" class="mc-admin-icon-btn" data-act="edit" data-id="' + r.id + '" title="Edit">' +
            '<i class="bi bi-pencil"></i></button>' +
          '<button type="button" class="mc-admin-icon-btn mc-admin-icon-btn--danger" data-act="del" data-id="' + r.id + '" title="Delete">' +
            '<i class="bi bi-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Suggestions come from what is already in the table, so the tool does
  // not hard-code a taxonomy that drifts from the data.
  function fillDatalists() {
    function unique(key, split) {
      var seen = {};
      rows.forEach(function (r) {
        var vals = split ? String(r[key] || '').split(/\s+/) : [String(r[key] || '')];
        vals.forEach(function (v) { if (v) { seen[v] = true; } });
      });
      return Object.keys(seen).sort();
    }
    function fill(id, values) {
      document.getElementById(id).innerHTML =
        values.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
    }
    fill('tagList',  unique('tag', false));
    fill('catList',  unique('cat', true));
    fill('iconList', unique('icon', false));
  }

  /* ---------- form ---------- */
  function setEditMode(row) {
    if (row) {
      f.id.value   = row.id;
      f.name.value = row.name;
      f.desc.value = row.desc;
      f.tag.value  = row.tag;
      f.cat.value  = row.cat;
      f.icon.value = row.icon;
      f.href.value = row.href;
      formTitle.textContent = 'Edit condition';
      submitBtn.textContent = 'Save changes';
      cancelBtn.style.display = '';
      window.scrollTo({ top: form.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
    } else {
      form.reset();
      f.id.value = '';
      formTitle.textContent = 'Add a condition';
      submitBtn.textContent = 'Add condition';
      cancelBtn.style.display = 'none';
    }
    updateIconPreview();
  }

  function updateIconPreview() {
    iconPrev.className = 'bi ' + (f.icon.value.trim() || 'bi-question-circle');
  }
  f.icon.addEventListener('input', updateIconPreview);

  cancelBtn.addEventListener('click', function () { setEditMode(null); clearMsg(); });
  function clearMsg() { msgEl.style.display = 'none'; }

  refresh.addEventListener('click', function () { clearMsg(); load(); });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) { return; }
    var id = Number(btn.getAttribute('data-id'));
    var row = rows.filter(function (r) { return r.id === id; })[0];
    if (!row) { return; }

    if (btn.getAttribute('data-act') === 'edit') {
      clearMsg();
      setEditMode(row);
      return;
    }

    if (!window.confirm('Delete "' + row.name + '"? This removes it from the live site immediately.')) { return; }
    btn.disabled = true;
    db.from('diseases').delete().eq('id', id)
      .then(function (res) {
        if (res.error) { throw res.error; }
        message('Deleted "' + row.name + '".', 'ok');
        if (Number(f.id.value) === id) { setEditMode(null); }
        load();
      })
      .catch(function (err) {
        console.error('[MedCare] Delete failed:', err);
        btn.disabled = false;
        message(explain(err));
      });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMsg();

    var payload = {
      name: f.name.value.trim(),
      desc: f.desc.value.trim(),
      tag:  f.tag.value.trim(),
      cat:  f.cat.value.trim().replace(/\s+/g, ' '),
      icon: f.icon.value.trim(),
      href: f.href.value.trim()
    };

    var missing = Object.keys(payload).filter(function (k) { return !payload[k]; });
    if (missing.length) {
      message('Please fill in every field. Missing: ' + missing.join(', ') + '.');
      return;
    }

    var editingId = f.id.value ? Number(f.id.value) : null;
    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? 'Saving…' : 'Adding…';

    var req = editingId
      ? db.from('diseases').update(payload).eq('id', editingId).select()
      : db.from('diseases').insert(payload).select();

    req.then(function (res) {
      if (res.error) { throw res.error; }
      // An empty array with no error means RLS filtered the row out:
      // the request was allowed to run but matched nothing.
      if (editingId && (!res.data || !res.data.length)) {
        message('Nothing was updated. The database did not permit this change.');
        return;
      }
      message(editingId ? 'Saved "' + payload.name + '".' : 'Added "' + payload.name + '".', 'ok');
      setEditMode(null);
      load();
    }).catch(function (err) {
      console.error('[MedCare] Save failed:', err);
      message(explain(err));
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = f.id.value ? 'Save changes' : 'Add condition';
    });
  });

  /* ================================================================
     READER REPORTS QUEUE
     ----------------------------------------------------------------
     Everything here leans on two policies from supabase_reports_rls.sql:

       "Staff can read all reports"      lets an editor see everyone's
                                         reports, where a plain user sees
                                         only their own. Same table, same
                                         query, different result set.

       "Staff can update report status"  lets an editor move a report
                                         through the workflow.

     And on one thing that is NOT a policy: UPDATE is granted on the
     `status` column alone, so this page physically cannot rewrite a
     reader's `reason` even if the code tried. RLS decides which rows;
     the column grant decides which columns.
     ================================================================ */

  var reportList    = document.getElementById('reportList');
  var reportMsgEl   = document.getElementById('reportMsg');
  var reportCountEl = document.getElementById('reportNewCount');
  var reportFilters = document.getElementById('reportFilters');
  var reportRefresh = document.getElementById('reportRefresh');

  var reportRows = [];
  var reportFilter = 'new';

  function reportMessage(text, kind) {
    reportMsgEl.textContent = text;
    reportMsgEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
    reportMsgEl.style.display = 'block';
    if (kind === 'ok') {
      window.setTimeout(function () { reportMsgEl.style.display = 'none'; }, 4000);
    }
  }

  function when(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d)) { return ''; }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
           ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /* reports.item_id is deliberately not a foreign key — the table it points
     at depends on item_type — so PostgREST cannot embed the disease for us.
     The join happens here instead, against the conditions this page has
     already loaded. */
  function itemLabel(r) {
    if (r.item_type === 'disease') {
      var hit = rows.filter(function (d) { return d.id === r.item_id; })[0];
      if (hit) { return esc(hit.name); }
    }
    return esc(r.item_type) + ' #' + esc(r.item_id);
  }

  function loadReports() {
    reportList.innerHTML = '<div class="mc-admin-loading">Loading reports…</div>';
    var q = db.from('reports').select('*').order('created_at', { ascending: false });
    if (reportFilter !== 'all') { q = q.eq('status', reportFilter); }

    q.then(function (res) {
      if (res.error) { throw res.error; }
      reportRows = res.data || [];
      renderReports();
      refreshNewCount();
    }).catch(function (err) {
      console.error('[MedCare] Could not load reports:', err);
      reportList.innerHTML = '<div class="mc-admin-loading">Could not load reports.</div>';
      reportMessage(explain(err));
    });
  }

  // Always counts outstanding reports, whatever filter is showing.
  function refreshNewCount() {
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'new')
      .then(function (res) {
        if (!res.error) { reportCountEl.textContent = res.count == null ? '0' : res.count; }
      })
      .catch(function () { /* the badge is cosmetic */ });
  }

  function renderReports() {
    if (!reportRows.length) {
      reportList.innerHTML = '<div class="mc-admin-loading">' +
        (reportFilter === 'new' ? 'No new reports. Nothing waiting for you.'
                                : 'No reports match this filter.') + '</div>';
      return;
    }
    reportList.innerHTML = reportRows.map(function (r) {
      var reviewed = r.status === 'reviewed';
      return '<div class="mc-report-row" data-id="' + r.id + '">' +
        '<div class="mc-report-row-head">' +
          '<span class="mc-report-item"><i class="bi bi-file-medical"></i> ' + itemLabel(r) + '</span>' +
          '<span class="mc-admin-pill mc-report-status mc-report-status--' + esc(r.status) + '">' + esc(r.status) + '</span>' +
        '</div>' +
        // Reader-supplied text: escaped, never inserted as markup.
        '<div class="mc-report-reason">' + esc(r.reason) + '</div>' +
        '<div class="mc-report-foot">' +
          '<span class="mc-report-meta">' +
            '<i class="bi bi-clock"></i> ' + esc(when(r.created_at)) +
            ' · reporter ' + esc(String(r.user_id || 'unknown').slice(0, 8)) +
          '</span>' +
          '<button type="button" class="mc-auth-btn ' + (reviewed ? 'mc-auth-btn--ghost' : '') + '" ' +
            'data-report-act="' + (reviewed ? 'reopen' : 'review') + '" data-id="' + r.id + '">' +
            (reviewed ? 'Reopen' : 'Mark reviewed') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  reportList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-report-act]');
    if (!btn) { return; }
    var id = Number(btn.getAttribute('data-id'));
    var next = btn.getAttribute('data-report-act') === 'review' ? 'reviewed' : 'new';

    btn.disabled = true;
    btn.textContent = 'Saving…';

    // Only `status` is sent — it is also the only column this role may
    // write, so adding anything else here would fail outright.
    db.from('reports').update({ status: next }).eq('id', id).select()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data || !res.data.length) {
          // Allowed to run, matched no rows: RLS filtered it out.
          reportMessage('That report was not updated. The database did not permit the change.');
          return;
        }
        reportMessage(next === 'reviewed' ? 'Report marked reviewed.' : 'Report reopened.', 'ok');
        loadReports();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not update report:', err);
        btn.disabled = false;
        btn.textContent = next === 'reviewed' ? 'Mark reviewed' : 'Reopen';
        reportMessage(explain(err));
      });
  });

  reportFilters.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-status]');
    if (!btn) { return; }
    reportFilter = btn.getAttribute('data-status');
    Array.prototype.forEach.call(reportFilters.children, function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    reportMsgEl.style.display = 'none';
    loadReports();
  });

  reportRefresh.addEventListener('click', function () {
    reportMsgEl.style.display = 'none';
    loadReports();
  });

  guard();
})();
