/* ============================================================
   MedCare — reading a hand-written page back into the editor

   THE PROBLEM THIS SOLVES

   Every article and disease on this site began as its own HTML file, and
   the database row next to it holds only the card: a title, an excerpt, a
   category, and an `href` pointing at the file. The `body` column is
   empty for all twenty of them.

   So opening one in the editor showed an empty body box. Not a bug in the
   editor — there genuinely was nothing in the row to show — but from the
   editor's chair it is indistinguishable from one, and it makes the
   editor useless for exactly the twenty pages that already exist.

   This module fetches the page the row points at and reads the prose back
   out of it, so the box opens with the article in it.

   WHAT IT TAKES, AND WHAT IT LEAVES

   The prose only. `.mc-detail-body .col-lg-8` is where every one of these
   pages keeps its article; the navbar, the footer, the breadcrumb and the
   "Report Error" block are outside it or removed by name.

   The cover image is deliberately dropped. It sits in a <figure> that the
   allowlist does not permit, and it belongs in the row's `cover_image`
   column rather than in the middle of its own body. Images inside the
   article survive, because they are in plain <div>s that unwrap.

   BOTH LANGUAGES, SEPARATED FIRST

   These pages ship English and Burmese together and let CSS reveal the
   one html[lang] selects: <p class="mc-en"> beside <p class="mc-my">.
   The row stores them apart, in `body` and `body_my`.

   The split therefore has to happen BEFORE sanitising, not after. The
   allowlist unwraps <span> and strips every class, so a sanitised copy
   has nothing left to tell the two languages apart — both would be one
   run-on document in two alphabets. Elements carrying neither class are
   language-neutral and are kept on both sides.

   NOTHING IS SAVED

   This fills the editor and stops. The row is untouched until somebody
   reads what appeared and presses Save, which is the point: importing is
   a suggestion, and the editor is the one who decides it is right.
   ============================================================ */

(function () {
  'use strict';

  var sanitize = window.MedCareSanitize;

  /* One fetch per page, however many body fields ask for it. An article
     has `body` and `body_my`, and both want the same document. */
  var cache = {};

  /* Only ever a path inside this site. `href` is editor-supplied, and an
     editor-supplied fetch target that accepts absolute URLs is a way to
     pull a stranger's markup into the editor and — one Save later — onto
     the public site. Same test read.js applies before redirecting to
     one of these files. */
  function siteRelative(href) {
    if (!href) { return null; }
    var v = String(href).trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) { return null; }   // any scheme
    if (v.charAt(0) === '/' || v.indexOf('//') === 0) { return null; }
    if (v.indexOf('..') !== -1) { return null; }
    return /^[a-z0-9._\-\/]+\.html?$/i.test(v) ? v : null;
  }

  /* Removed by name rather than by trying to describe what prose looks
     like. Everything here is chrome that lives inside the article column
     on at least one of these pages. */
  var STRIP = [
    '.mc-sources',      // the review date and the back link
    '.mc-report',       // the Report Error block, injected by report.js
    '.mc-modal',
    '.mc-toast-wrap',
    '.mc-lang-note',    // "this page is in English only"
    '.mc-breadcrumb',
    /* The disease pages print a standing label above their accordion —
       <p class="mc-section-label">Learn more</p>. It is a signpost for
       the widget underneath it, not a sentence about the condition, and
       once the accordion is flattened into headings it is a stray line
       of prose that says nothing. All twelve carry it. */
    '.mc-section-label',
    /* The footer pages (admin/pages.html) carry two things inside their
       article column that are furniture rather than prose, and that stay
       in the HTML file when the prose moves to the database:

         .mc-setting   the cookie page's live cards. Each one reports what
                       is on the reader's own device and carries the button
                       that clears it, so the words in it are a caption for
                       a control that would not come with them.
         .mc-feature   the panel of links on the About page. Sanitised it
                       is four headings and four stray links, which is not
                       what it says on the page.

       Both are outside the editable region on the public side. Taking
       them here as well means an import returns the same text that
       region shows, rather than text plus a flattened copy of the
       furniture around it. */
    '.mc-setting',
    '.mc-feature',
    /* The empty boxes page-body.js fills from the database. They are the
       DESTINATION of this import, not part of the page, and one of them
       carries .mc-my — so leaving them in makes the language test below
       count a translation that is not there, and the Burmese half of the
       import comes back holding the English text. Struck before anything
       is counted. */
    '[data-page-body]',
    'script', 'style', 'noscript',
    'form', 'iframe'
  ];

  /* Kept for their contents, not for themselves. <button> is here for a
     specific and easily-missed reason: the disease pages are built as
     Bootstrap accordions, and the section HEADING is the button —

         <h2 class="accordion-header">
           <button ...><span class="head-ico"><i></i></span>Symptoms</button>
         </h2>

     Deleting buttons as controls therefore deletes "Symptoms", "Risk
     Groups", "Do's" and "Don'ts", and the import comes back as a run of
     empty <h2>s over orphaned lists. The allowlist has no <button>
     either and removes unknown tags whole, children included, so the
     text has to be lifted out here before it gets that far.

     Anything genuinely interactive is inside a container this file
     already removes by name. */
  var UNWRAP_FIRST = ['button', 'figcaption'];

  function unwrap(el) {
    var parent = el.parentNode;
    if (!parent) { return; }
    while (el.firstChild) { parent.insertBefore(el.firstChild, el); }
    parent.removeChild(el);
  }

  function extract(doc, lang) {
    var scope = doc.querySelector('.mc-detail-body .col-lg-8') ||
                doc.querySelector('.mc-detail-body') ||
                doc.querySelector('main');
    if (!scope) { return ''; }

    var copy = scope.cloneNode(true);

    STRIP.forEach(function (sel) {
      Array.prototype.forEach.call(copy.querySelectorAll(sel), function (n) {
        n.parentNode.removeChild(n);
      });
    });

    // After the removals, so a button inside something being deleted is
    // deleted with it rather than having its text rescued first.
    UNWRAP_FIRST.forEach(function (sel) {
      Array.prototype.forEach.call(copy.querySelectorAll(sel), unwrap);
    });

    /* Was this language written at all? Three shapes exist on this site
       and they are not symmetrical:

         articles        .mc-en beside .mc-my throughout
         disease pages   NO language classes at all — English, unmarked
         (hypothetical)  .mc-my only

       So the two sides need different tests. Burmese is only ever
       Burmese if it is marked as such: no .mc-my means there is no
       translation, and returning the English for it would put English
       in `body_my` and make the row claim a translation nobody wrote.
       English is the default for unmarked text, so it gives way only
       when the page is explicitly marked as the other language.

       Empty is the truthful answer, and read.js already knows how to
       show a page that exists in one language. */
    var enCount = copy.querySelectorAll('.mc-en').length;
    var myCount = copy.querySelectorAll('.mc-my').length;
    if (lang === 'my' && !myCount) { return ''; }
    if (lang === 'en' && !enCount && myCount) { return ''; }

    // The other language goes before the allowlist erases the evidence.
    var other = lang === 'my' ? '.mc-en' : '.mc-my';
    Array.prototype.forEach.call(copy.querySelectorAll(other), function (n) {
      n.parentNode.removeChild(n);
    });

    return sanitize.clean(copy.innerHTML);
  }

  /* Resolved against the site root. entry.html lives in editor/, and the
     href in the row ('healthyfood.html', 'diseases/tb.html') is written
     from the root, so a bare fetch from this page would look one folder
     too deep. */
  function urlFor(href) {
    return new URL('../' + href, window.location.href).href;
  }

  /* Returns a promise for { en, my, url }, or for null when there is
     nothing to import. Never rejects: a page that cannot be read is a
     reason to leave the box empty, not to break the form around it. */
  function fromPage(href) {
    var path = siteRelative(href);
    if (!path || !sanitize) { return Promise.resolve(null); }
    if (cache[path]) { return cache[path]; }

    var url = urlFor(path);

    cache[path] = fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.text();
      })
      .then(function (html) {
        /* Parsed with DOMParser rather than assigned to a live element.
           The document it builds is inert: no <script> runs, no <img>
           is fetched, no stylesheet is applied. That matters when the
           thing being parsed is a whole page rather than a fragment. */
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var out = { en: extract(doc, 'en'), my: extract(doc, 'my'), url: url };

        // Nothing worth importing is the same answer as no page at all.
        return (sanitize.textOf(out.en) || sanitize.textOf(out.my)) ? out : null;
      })
      .catch(function (err) {
        console.warn('[MedCare] Could not read "' + path + '" back into the editor:', err);
        return null;
      });

    return cache[path];
  }

  window.MedCareImport = {
    fromPage: fromPage,
    siteRelative: siteRelative
  };

})();
