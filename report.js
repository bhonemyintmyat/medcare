/* ============================================================
   MedCare — "Report inaccuracy" on a disease page
   Load after supabase.js and auth.js:

     <script src="../supabase.js" defer></script>
     <script src="../auth.js" defer></script>
     <script src="../report.js" defer></script>

   The modal is hand-built rather than a Bootstrap modal, because this
   site loads Bootstrap's CSS but not its JavaScript bundle — so
   data-bs-toggle would do nothing. It uses your existing tokens and
   needs no new dependency.
   ============================================================ */

(function () {
  'use strict';

  var db   = window.supabaseClient;
  var auth = window.MedCareAuth;
  if (!db) { return; }

  /* ---------- Which disease is this page? ----------
     There is no slug router here: each condition is its own static file,
     and the `href` column in the diseases table holds exactly that path
     ('diseases/tb.html'). So the page identifies itself by its own URL
     and looks up the matching row to get the numeric id that reports
     needs. Taking the last two segments keeps this working if the site
     is ever served from a subfolder. */
  var parts = window.location.pathname.split('/').filter(Boolean);
  var pagePath = parts.slice(-2).join('/');
  if (parts.length < 2 || parts[parts.length - 2] !== 'diseases') { return; }

  var disease = null;   // { id, name }
  var existing = null;  // this user's earlier report, if any

  db.from('diseases').select('id,name').eq('href', pagePath).maybeSingle()
    .then(function (res) {
      if (res.error) { throw res.error; }
      if (!res.data) {
        // Page not in the table yet — offer nothing rather than a button
        // that cannot work.
        console.warn('[MedCare] No diseases row for "' + pagePath + '"; report button not shown.');
        return;
      }
      disease = res.data;
      mount();
    })
    .catch(function (err) {
      console.error('[MedCare] Could not identify this disease:', err);
    });

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Button ---------- */
  function mount() {
    var anchor = document.querySelector('.mc-sources') ||
                 document.querySelector('.mc-detail-body .container');
    if (!anchor) { return; }

    var wrap = document.createElement('div');
    wrap.className = 'mc-report';
    wrap.innerHTML =
      '<div class="mc-report-text">' +
        '<strong>Spotted something wrong?</strong> ' +
        'Tell our editorial team and they will check it.' +
      '</div>' +
      '<button type="button" class="mc-report-btn" id="reportOpen">' +
        '<i class="bi bi-flag"></i> Report inaccuracy</button>';

    if (anchor.classList.contains('mc-sources')) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      anchor.appendChild(wrap);
    }
    document.getElementById('reportOpen').addEventListener('click', open);
  }

  /* ---------- Modal ---------- */
  var modal = null;
  var lastFocus = null;

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'mc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'reportTitle');
    modal.innerHTML =
      '<div class="mc-modal-backdrop" data-close></div>' +
      '<div class="mc-modal-panel">' +
        '<button type="button" class="mc-modal-x" data-close aria-label="Close">' +
          '<i class="bi bi-x-lg"></i></button>' +
        '<div id="reportBody"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) { close(); }
    });
  }

  function open() {
    if (!modal) { buildModal(); }
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderSignedOut();          // safe default until auth resolves
    auth.ready.then(function () {
      if (!auth.isSignedIn()) { renderSignedOut(); return; }
      checkExisting().then(renderForm);
    });
  }

  function close() {
    if (!modal) { return; }
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function body() { return document.getElementById('reportBody'); }

  /* ---------- Not signed in ----------
     RULE 1. This is the convenience half: an anonymous visitor is shown a
     prompt instead of a form they could not submit. It is NOT what keeps
     anonymous reports out. The insert policy on public.reports has no
     `to anon` clause at all, so a logged-out request is refused by the
     database — verified: it comes back 42501, "new row violates row-level
     security policy". Deleting this branch in DevTools changes nothing
     except that the user sees a failure instead of an explanation. */
  function renderSignedOut() {
    body().innerHTML =
      '<div class="mc-modal-ico mc-modal-ico--muted"><i class="bi bi-person-lock"></i></div>' +
      '<h2 id="reportTitle">Please log in to report</h2>' +
      '<p class="mc-modal-sub">Reports are linked to an account so our editors ' +
        'can follow up. Signing in takes a moment.</p>' +
      '<div class="mc-modal-actions">' +
        '<a class="mc-auth-btn" href="../login.html">Sign in</a>' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Not now</button>' +
      '</div>';
  }

  /* Has this person already reported this page? They can read their own
     reports (and only their own) under the "Users can read their own
     reports" policy, so this asks the database rather than guessing. */
  function checkExisting() {
    existing = null;
    return db.from('reports')
      .select('id,status,created_at')
      .eq('item_type', 'disease')
      .eq('item_id', disease.id)
      .order('id', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (!res.error && res.data && res.data.length) { existing = res.data[0]; }
      })
      .catch(function () { /* non-fatal: just show the form */ });
  }

  function renderForm() {
    if (existing) {
      body().innerHTML =
        '<div class="mc-modal-ico mc-modal-ico--ok"><i class="bi bi-check2-circle"></i></div>' +
        '<h2 id="reportTitle">You already reported this</h2>' +
        '<p class="mc-modal-sub">Your report about <strong>' + esc(disease.name) + '</strong> is ' +
          (existing.status === 'reviewed'
            ? 'marked <strong>reviewed</strong> by our editors.'
            : 'waiting to be reviewed.') +
        '</p>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn" data-close>Close</button>' +
        '</div>';
      return;
    }

    body().innerHTML =
      '<h2 id="reportTitle">Report inaccuracy</h2>' +
      '<p class="mc-modal-sub">What looks wrong on <strong>' + esc(disease.name) + '</strong>? ' +
        'Please be as specific as you can — it helps our editors check it faster.</p>' +
      '<form id="reportForm">' +
        '<label class="mc-auth-label" for="reportReason">Reason</label>' +
        '<div class="mc-auth-field">' +
          '<textarea id="reportReason" rows="5" required minlength="10" maxlength="2000" ' +
            'placeholder="Describe what is inaccurate, and what it should say if you know."></textarea>' +
        '</div>' +
        '<div class="mc-modal-msg" id="reportMsg" role="status" aria-live="polite" style="display:none"></div>' +
        '<div class="mc-modal-actions">' +
          '<button type="submit" class="mc-auth-btn" id="reportSubmit">Send report</button>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
        '</div>' +
      '</form>';

    var form = document.getElementById('reportForm');
    var ta = document.getElementById('reportReason');
    ta.focus();
    form.addEventListener('submit', submit);
  }

  function message(text, kind) {
    var el = document.getElementById('reportMsg');
    if (!el) { return; }
    el.textContent = text;
    el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
    el.style.display = 'block';
  }

  function submit(e) {
    e.preventDefault();
    var ta = document.getElementById('reportReason');
    var btn = document.getElementById('reportSubmit');
    var reason = ta.value.trim();

    if (reason.length < 10) {
      message('Please describe the problem in a little more detail (at least 10 characters).');
      return;
    }

    /* ---------- WHERE THE USER ID COMES FROM ----------
       auth.getUser() returns the user object from the session that
       supabase-js is holding — the same object the login call produced.
       `.id` on it is a UUID, and it is the same value as the primary key
       in auth.users and in your profiles table.

       It is NOT a value we invent or trust: the session also carries a
       signed JWT with that id in its `sub` claim, and supabase-js sends
       it on every request. Postgres reads it back out as auth.uid(),
       which is what the insert policy compares against:

           with check (user_id = (select auth.uid()) and status = 'new')

       So sending user_id here is really a declaration of intent — the
       database independently checks it against the token and refuses
       anything else. (public.reports also defaults user_id to auth.uid(),
       so omitting it entirely would work too; sending it explicitly just
       makes the intent obvious at the call site.)

       status is deliberately omitted: the column default makes it 'new',
       and the policy requires 'new', so a report cannot be filed
       pre-marked as reviewed. */
    var user = auth.getUser();
    if (!user) { renderSignedOut(); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    db.from('reports').insert({
      item_type: 'disease',
      item_id: disease.id,
      reason: reason,
      user_id: user.id
    }).select().then(function (res) {
      if (res.error) { throw res.error; }
      renderThanks();
    }).catch(function (err) {
      console.error('[MedCare] Report failed:', err);
      btn.disabled = false;
      btn.textContent = 'Send report';
      if (err && err.code === '42501') {
        // The database refused it. In practice this means the session
        // expired between opening the form and submitting.
        message('Your session has expired. Please sign in again to send this report.');
      } else {
        message('Could not send your report. Please check your connection and try again.');
      }
    });
  }

  /* RULE 2. Friendly confirmation, then close itself. */
  function renderThanks() {
    body().innerHTML =
      '<div class="mc-modal-ico mc-modal-ico--ok"><i class="bi bi-check2-circle"></i></div>' +
      '<h2 id="reportTitle">Thank you</h2>' +
      '<p class="mc-modal-sub">Your report has been sent to the MedCare editorial team. ' +
        'They review every report and will correct the page if needed.</p>' +
      '<div class="mc-modal-actions">' +
        '<button type="button" class="mc-auth-btn" data-close>Close</button>' +
      '</div>';
    window.setTimeout(function () {
      if (modal && modal.classList.contains('is-open')) { close(); }
    }, 4000);
  }

})();
