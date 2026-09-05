/* ============================================================
   MedCare — "Edit this page", for staff reading the public site

   An editor who spots a mistake while reading the site as a reader had
   no way through to the form. They had to remember the editor lives at
   /editor/, open the content list, find the row again by name, and
   click it — four steps to get to a page they were already looking at.
   This is that shortcut: one link, straight to the entry form for the
   row that produced this page.

   WHO SEES IT

   Staff — an editor or an admin. Everybody else gets nothing, and a
   signed-out visitor is not told the button exists.

   THIS IS A CONVENIENCE, NOT A PERMISSION

   The role behind this check lives in the browser: auth.js caches it so
   the header does not flicker on every page load, and a determined
   visitor can edit that cache in DevTools and make this link appear.

   That is fine, and it is worth being explicit about why. The link goes
   to a page the editor guard protects; that guard re-reads the role from
   the `profiles` table; and every write from the form is checked again
   by RLS in the database, which has never seen the browser's copy of
   anything. Forging the cache buys a visitor a link to a page that will
   refuse them.

   So: this file decides what to SHOW. It does not decide what is
   ALLOWED, and nothing here should ever be the only thing standing
   between a visitor and a write.

   WHERE IT GOES

   Beside "Report Error", because the two belong to the same moment —
   something on this page is wrong. A reader files a report; somebody
   who can fix it goes and fixes it.
   ============================================================ */

(function () {
  'use strict';

  var auth   = window.MedCareAuth;
  var target = window.MedCarePageTarget;
  if (!auth || !target) { return; }

  var LINK_ID = 'mcEditLink';

  /* How far this page sits below the site root, as a prefix. The
     articles are at the root and the conditions are one folder down, so
     a single hard-coded 'editor/entry.html' would 404 on exactly half
     the pages this script runs on. Derived from the URL rather than
     configured, so a page moving between the two needs no edit here. */
  function depth() {
    return window.location.pathname.indexOf('/diseases/') !== -1 ? '../' : '';
  }

  /* The address of the screen that edits this row. Two shapes, because
     the two kinds of page are edited in different places:

       article / disease   editor/entry.html?type=&id=   — the entry form
       page                editor/pages.html?slug=       — the footer pages

     entry.html reads `type` and `id` (see the header of
     editor-entry.js); pages.html reads `slug` and opens that row. Both
     are in the editor area, which admits editors and admins alike — an
     admin gets a Save button on the footer pages and an editor does
     not, and that is decided there rather than by which link was
     followed here. */
  function editHref(t) {
    if (t.kind === 'page') {
      return depth() + 'editor/pages.html?slug=' + encodeURIComponent(t.slug);
    }
    return depth() + 'editor/entry.html' +
           '?type=' + encodeURIComponent(t.kind) +
           '&id='   + encodeURIComponent(t.id);
  }

  /* ---------- Drawing it ----------
     An anchor rather than a button with a click handler. What this does
     IS navigation, so the element that means navigation is the right
     one: it gets middle-click and ctrl-click to a new tab for free,
     shows the destination in the status bar, and still works if the
     page's JavaScript fails after this point. A <button> would have to
     re-implement all of that badly. */
  function mount(t) {
    if (document.getElementById(LINK_ID)) { return; }

    /* Next to the report button when there is one — they are two
       answers to the same thought and they belong together. report.js
       may not have mounted yet, so failing that, the same anchor it
       uses. */
    var reportWrap = document.querySelector('.mc-report');
    var link = document.createElement('a');
    link.id = LINK_ID;
    link.className = 'mc-edit-link';
    link.href = editHref(t);
    link.innerHTML = '<i class="bi bi-pencil-square"></i> Edit this page';

    if (reportWrap) {
      reportWrap.appendChild(link);
      reportWrap.classList.add('has-edit');
      return;
    }

    /* .col-lg-8 before .container: the footer pages have no sources
       block, and appending to the container would hang the link off the
       full width of the page while every word above it sits in the
       narrower reading column. The article pages never reach this line
       — they match .mc-report or .mc-sources first — so their placement
       is unchanged. */
    var anchor = document.querySelector('.mc-sources') ||
                 document.querySelector('.mc-detail-body .col-lg-8') ||
                 document.querySelector('.mc-detail-body .container');
    if (!anchor) { return; }

    var wrap = document.createElement('div');
    wrap.className = 'mc-report has-edit';
    wrap.appendChild(link);

    if (anchor.classList.contains('mc-sources')) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      anchor.appendChild(wrap);
    }
  }

  function unmount() {
    var link = document.getElementById(LINK_ID);
    if (link && link.parentNode) { link.parentNode.removeChild(link); }
  }

  /* ---------- When to draw it ----------
     Two answers are needed and they arrive independently: which row this
     page is, and who is reading it. Waiting for both is what stops the
     link appearing for a moment before the role comes back and takes it
     away again.

     report.js mounts its button on the same tick this resolves, so the
     .mc-report wrapper is looked for after both promises have settled
     rather than at load time. */
  Promise.all([target.ready, auth.ready]).then(function (results) {
    var t = results[0];
    if (!t) { return; }

    function sync() {
      if (auth.isStaff()) { mount(t); } else { unmount(); }
    }

    sync();

    /* Signing out in another tab, or the role arriving late from the
       profiles table and disagreeing with the cached one. Either way the
       link should follow the answer rather than the guess. */
    auth.onChange(sync);
  });

})();
