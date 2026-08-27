/* ============================================================
   MedCare — "Report Error" on a disease or an article

   Load after supabase.js and auth.js:

     <script src="supabase.js" defer></script>
     <script src="auth.js" defer></script>
     <script src="report.js" defer></script>

   TWO KINDS OF PAGE, ONE REPORT FORM

   This file has to work on two things that do not look alike:

     healthyfood.html      a hand-written file — every article and every
     diseases/tb.html      disease on the site today is one. Nothing on
                           the page says which database row it is, so the
                           page is identified by its own URL and looked
                           up against the `href` column.

     read.html?id=12       rendered from a row by read.js, which already
                           knows the id and the title and announces them
                           when the render succeeds.

   Both end up as the same three facts — item type, id, title — and
   everything below this point only ever sees those. That is the whole
   reason the second page cost a listener rather than a second file.

   Which of the two a page is decides itself, so adding the tag to a new
   hand-written article is the only step: no id to hard-code, and no
   second copy of this file that would drift from the first.

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

  /* ---------- The categories ----------
     Declared once. The `value` half must match the check constraint in
     supabase_report_categories.sql; the `label` half is what the reader
     reads. Adding a category means widening that constraint and adding
     a line here, in that order — a value this list offers but the
     constraint rejects would fail at submit with a 23514 the reader
     cannot do anything about. */
  var CATEGORIES = [
    { value: 'inaccuracy',  label: 'Medical inaccuracy',
      hint: 'A fact, dose, symptom or piece of advice looks wrong.' },
    { value: 'typo',        label: 'Typo',
      hint: 'A spelling, grammar or formatting mistake.' },
    { value: 'broken_link', label: 'Broken link',
      hint: 'A link goes nowhere, or to the wrong place.' },
    { value: 'other',       label: 'Other',
      hint: 'Something else about this page.' }
  ];

  var MIN_REASON = 10;    // matches the `reason` check constraint
  var MAX_REASON = 2000;

  /* target = { targetType, id, title } — the only thing the rest of the
     file knows about what is being reported. `targetType` and the id go
     into public.reports as target_type/target_id: the moderation
     migration in supabase_admin_schema.sql renamed those columns (and
     user_id -> reporter_id, status 'new' -> 'open'), so those are the
     names this file has to speak. */
  var target   = null;
  var existing = null;    // this reader's earlier report on it, if any

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     1. WORKING OUT WHAT THIS PAGE IS
     ============================================================ */

  /* read.html — read.js publishes the row it drew. Both the property and
     the event are read, because script order decides which one arrives:
     if read.js finished first the event is already gone and the property
     is there; if it has not finished yet the property is absent and the
     event is coming. Checking both means this file does not care which
     <script> tag comes first. */
  function fromReader() {
    function accept(page) {
      if (!page || !page.id) { return false; }
      target = {
        targetType: page.kind === 'disease' ? 'disease' : 'article',
        id: page.id,
        title: page.title || ''
      };
      mount();
      return true;
    }
    if (accept(window.MedCarePage)) { return; }
    document.addEventListener('medcare:page-rendered', function (e) {
      if (!target) { accept(e.detail); }
    });
  }

  /* A hand-written page — there is no slug router here: each article and
     each condition is its own file, and the `href` column holds exactly
     the path a listing would link to. So the page identifies itself by
     its own URL and looks up the matching row to get the numeric id that
     reports needs.

     The two tables store that path at different depths, because that is
     where the files actually sit:

       diseases.href   'diseases/tb.html'      -> last TWO segments
       articles.href   'healthyfood.html'      -> last ONE segment

     Reading the segments from the END rather than from the site root is
     what keeps this working if the site is ever served from a subfolder
     (github.io/medcare/, say) — nothing here depends on the pathname
     starting where the deployment happens to start. */
  function fromStaticPage() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var file  = parts.length ? parts[parts.length - 1] : '';

    // read.html is the other branch's page, and a directory index is not
    // an article. Neither should trigger a lookup.
    if (!/\.html?$/i.test(file)) { return false; }
    if (file.toLowerCase() === 'read.html') { return false; }

    var inDiseases = parts.length >= 2 && parts[parts.length - 2] === 'diseases';
    var spec = inDiseases
      ? { table: 'diseases', titleCol: 'name',  targetType: 'disease',
          href: parts.slice(-2).join('/') }
      : { table: 'articles', titleCol: 'title', targetType: 'article',
          href: file };

    db.from(spec.table).select('id,' + spec.titleCol)
      .eq('href', spec.href).maybeSingle()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data) {
          // Page not in the table yet — offer nothing rather than a
          // button that cannot work. Reports point at a row by id, and
          // there is no id to point at.
          console.warn('[MedCare] No ' + spec.table + ' row for "' + spec.href +
                       '"; report button not shown.');
          return;
        }
        target = {
          targetType: spec.targetType,
          id: res.data.id,
          title: res.data[spec.titleCol]
        };
        mount();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not identify this page:', err);
      });
    return true;
  }

  if (!fromStaticPage()) { fromReader(); }

  /* ============================================================
     2. THE BUTTON
     ============================================================ */

  function mount() {
    if (document.getElementById('reportOpen')) { return; }   // already mounted

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
        '<i class="bi bi-flag"></i> Report Error</button>';

    if (anchor.classList.contains('mc-sources')) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      anchor.appendChild(wrap);
    }
    document.getElementById('reportOpen').addEventListener('click', open);
  }

  /* ============================================================
     3. THE MODAL
     ============================================================ */

  var modal = null;
  var lastFocus = null;

  function isOpen() { return !!modal && modal.classList.contains('is-open'); }

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
      if (!isOpen()) { return; }
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') { keepFocusInside(e); }
    });
  }

  /* aria-modal tells a screen reader the rest of the page is inert; it
     does not stop Tab walking out into the page behind. With a radio
     group and a textarea in here that is now several tab stops of
     confusion, so the cycle is closed by hand. */
  function keepFocusInside(e) {
    var focusable = modal.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) { return; }
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
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
     `to anon` clause at all, and supabase_revoke_anon_writes.sql took
     the table-level INSERT away as well, so a logged-out request is
     refused by the database — verified: it comes back 42501, "new row
     violates row-level security policy". Deleting this branch in DevTools
     changes nothing except that the user sees a failure instead of an
     explanation. */
  function renderSignedOut() {
    // Depth matters: read.html lives at the site root, a disease page one
    // folder down, and the sign-in link has to work from both.
    var loginHref = window.location.pathname.indexOf('/diseases/') !== -1
      ? '../login.html' : 'login.html';

    body().innerHTML =
      '<div class="mc-modal-ico mc-modal-ico--muted"><i class="bi bi-person-lock"></i></div>' +
      '<h2 id="reportTitle">Please log in to report</h2>' +
      '<p class="mc-modal-sub">Reports are linked to an account so our editors ' +
        'can follow up. Signing in takes a moment.</p>' +
      '<div class="mc-modal-actions">' +
        '<a class="mc-auth-btn" href="' + esc(loginHref) + '">Sign in</a>' +
        '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Not now</button>' +
      '</div>';
  }

  /* Has this person already reported this page? They can read their own
     reports (and only their own) under the "Reporters read their own
     reports" policy, so this asks the database rather than guessing.
     Staff match the other select policy and see everything, which only
     makes this check more accurate for them, not less. */
  function checkExisting() {
    existing = null;
    return db.from('reports')
      .select('id,status,category,created_at')
      .eq('target_type', target.targetType)
      .eq('target_id', target.id)
      .order('id', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (!res.error && res.data && res.data.length) { existing = res.data[0]; }
      })
      .catch(function () { /* non-fatal: just show the form */ });
  }

  function categoryLabel(value) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].value === value) { return CATEGORIES[i].label; }
    }
    return 'Other';
  }

  function renderForm() {
    if (existing) {
      /* Three statuses, and the reader is owed a different sentence for
         each. 'dismissed' is the one worth saying plainly: an editor
         looked and decided nothing needed changing, and a reader told
         only that it was "handled" would reasonably sit waiting for a
         correction that is never going to come. */
      var stateLine =
        existing.status === 'resolved'  ? 'been <strong>resolved</strong> by our editors.' :
        existing.status === 'dismissed' ? 'been reviewed, and our editors did not find a change was needed.' :
                                          'not been reviewed yet.';
      body().innerHTML =
        '<div class="mc-modal-ico mc-modal-ico--ok"><i class="bi bi-check2-circle"></i></div>' +
        '<h2 id="reportTitle">You already reported this</h2>' +
        '<p class="mc-modal-sub">Your report about <strong>' + esc(target.title) + '</strong> ' +
          '(' + esc(categoryLabel(existing.category)) + ') has ' + stateLine +
        '</p>' +
        '<div class="mc-modal-actions">' +
          '<button type="button" class="mc-auth-btn" data-close>Close</button>' +
        '</div>';
      return;
    }

    /* The title is shown, not asked for. It is read-only because the
       reader is not choosing what they are reporting — the page they are
       on decided that, and `target_id` below comes from the same place.
       A field they could edit would imply otherwise. */
    var titleField =
      '<label class="mc-auth-label" for="reportItem">' +
        (target.targetType === 'disease' ? 'Disease' : 'Article') +
      '</label>' +
      '<div class="mc-auth-field mc-auth-field--static">' +
        '<i class="bi ' + (target.targetType === 'disease' ? 'bi-virus' : 'bi-journal-text') + '"></i>' +
        '<input id="reportItem" type="text" readonly ' +
          'value="' + esc(target.title) + '">' +
      '</div>';

    var options = CATEGORIES.map(function (c, i) {
      return '<label class="mc-radio">' +
        '<input type="radio" name="reportCategory" value="' + esc(c.value) + '"' +
          (i === 0 ? ' checked' : '') + '>' +
        '<span class="mc-radio-mark" aria-hidden="true"></span>' +
        '<span class="mc-radio-text">' +
          '<span class="mc-radio-label">' + esc(c.label) + '</span>' +
          '<span class="mc-radio-hint">' + esc(c.hint) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    body().innerHTML =
      '<h2 id="reportTitle">Report Error</h2>' +
      '<p class="mc-modal-sub">Tell our medical editorial team what looks wrong. ' +
        'The more specific you can be, the faster they can check it.</p>' +
      '<form id="reportForm" novalidate>' +
        titleField +
        '<fieldset class="mc-radio-group">' +
          '<legend class="mc-auth-label">What kind of problem is it?</legend>' +
          options +
        '</fieldset>' +
        '<label class="mc-auth-label" for="reportReason">Description</label>' +
        '<div class="mc-auth-field">' +
          '<textarea id="reportReason" rows="5" required ' +
            'minlength="' + MIN_REASON + '" maxlength="' + MAX_REASON + '" ' +
            'placeholder="Describe what is wrong, and what it should say if you know."></textarea>' +
        '</div>' +
        '<div class="mc-modal-msg" id="reportMsg" role="status" aria-live="polite" style="display:none"></div>' +
        '<div class="mc-modal-actions">' +
          '<button type="submit" class="mc-auth-btn" id="reportSubmit">Submit</button>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-close>Cancel</button>' +
        '</div>' +
      '</form>';

    var form = document.getElementById('reportForm');
    /* Not the read-only title: landing there would make the first thing
       the reader meets a box they cannot type in. */
    document.getElementById('reportReason').focus();
    form.addEventListener('submit', submit);
  }

  function message(text, kind) {
    var el = document.getElementById('reportMsg');
    if (!el) { return; }
    el.textContent = text;
    el.className = 'mc-modal-msg mc-modal-msg--' + (kind || 'error');
    el.style.display = 'block';
  }

  /* ============================================================
     4. SUBMITTING
     ============================================================ */

  function submit(e) {
    e.preventDefault();
    var ta  = document.getElementById('reportReason');
    var btn = document.getElementById('reportSubmit');
    var reason = ta.value.trim();

    var picked = modal.querySelector('input[name="reportCategory"]:checked');
    if (!picked) {
      message('Please choose what kind of problem this is.');
      return;
    }
    if (reason.length < MIN_REASON) {
      message('Please describe the problem in a little more detail (at least ' +
              MIN_REASON + ' characters).');
      ta.focus();
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

           with check (reporter_id = (select auth.uid()) and status = 'open')

       So sending reporter_id here is really a declaration of intent — the
       database independently checks it against the token and refuses
       anything else. (public.reports also defaults reporter_id to
       auth.uid(), so omitting it entirely would work too; sending it
       explicitly just makes the intent obvious at the call site.)

       status is deliberately omitted: the column default makes it 'open',
       and the policy requires 'open', so a report cannot be filed
       pre-marked as resolved or dismissed — which is what filing one
       straight into the "already dealt with" pile would amount to.

       category IS sent, and it is checked the other way round — not by a
       policy but by reports_category_check, which applies to every
       writer rather than to a role. A value outside the four comes back
       23514 and no row is written. */
    var user = auth.getUser();
    if (!user) { renderSignedOut(); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    db.from('reports').insert({
      target_type: target.targetType,
      target_id:   target.id,
      category:    picked.value,
      reason:      reason,
      reporter_id: user.id
    }).select().then(function (res) {
      if (res.error) { throw res.error; }
      /* RULE 2. The dialog has done its job, so it gets out of the way
         and the confirmation arrives as a toast instead. The reader is
         left looking at the page they were reading, not at a modal
         asking them to dismiss it.

         `existing` is updated from the row that came back, so reopening
         the dialog says "you already reported this" without another
         round trip. */
      existing = (res.data && res.data[0]) || null;
      close();
      toast('Thank you. Our medical editorial team will review this issue.');
    }).catch(function (err) {
      console.error('[MedCare] Report failed:', err);
      btn.disabled = false;
      btn.textContent = 'Submit';
      if (err && err.code === '42501') {
        // The database refused it. In practice this means the session
        // expired between opening the form and submitting.
        message('Your session has expired. Please sign in again to send this report.');
      } else if (err && err.code === '23514') {
        // A check constraint: the reason length or the category.
        message('That report could not be accepted. Please shorten your ' +
                'description and make sure a category is selected.');
      } else {
        message('Could not send your report. Please check your connection and try again.');
      }
    });
  }

  /* ============================================================
     5. THE TOAST
     ------------------------------------------------------------
     role="status" with aria-live="polite" rather than role="alert":
     this is a confirmation of something the reader just did, not an
     emergency, so it should be announced when the screen reader
     reaches a natural break rather than interrupting.

     It is dismissible and it also leaves on its own. Neither alone is
     enough — an auto-dismissing toast that cannot be dismissed wastes
     the time of someone who has already read it, and one that only
     dismisses by hand leaves litter on the page.
     ============================================================ */

  var toastWrap = null;

  function toast(text) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'mc-toast-wrap';
      document.body.appendChild(toastWrap);
    }

    var t = document.createElement('div');
    t.className = 'mc-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML =
      '<span class="mc-toast-ico"><i class="bi bi-check2-circle"></i></span>' +
      '<p class="mc-toast-text"></p>' +
      '<button type="button" class="mc-toast-x" aria-label="Dismiss">' +
        '<i class="bi bi-x-lg"></i></button>';
    t.querySelector('.mc-toast-text').textContent = text;
    toastWrap.appendChild(t);

    /* The element must be laid out in its "out" state before the class
       that transitions it in is added, otherwise the browser coalesces
       both states into one style recalculation and there is nothing to
       animate. Reading offsetHeight forces that layout synchronously.

       The obvious alternative — a double requestAnimationFrame — was
       what this did first, and it is wrong here: rAF does not run in a
       backgrounded tab. Submit the form, switch tabs, come back, and the
       toast is sitting there at opacity 0 having never been told to
       appear, while its dismiss timer counts down against a toast
       nobody can see. A forced reflow does not depend on the compositor
       running at all. */
    void t.offsetHeight;
    t.classList.add('is-in');

    var timer = window.setTimeout(dismiss, 6000);
    var gone  = false;

    function remove() {
      if (gone) { return; }
      gone = true;
      if (t.parentNode) { t.parentNode.removeChild(t); }
    }

    function dismiss() {
      window.clearTimeout(timer);
      if (gone || !t.parentNode) { return; }
      t.classList.remove('is-in');
      /* transitionend is the tidy signal, but it never fires if the
         reader has reduced motion on (no transition to end) or if the
         tab was backgrounded mid-animation. The timeout is the floor. */
      t.addEventListener('transitionend', remove);
      window.setTimeout(remove, 400);
    }

    t.querySelector('.mc-toast-x').addEventListener('click', dismiss);
  }

})();
