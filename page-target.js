/* ============================================================
   MedCare — which row is this page?

   Two features now need the same answer. "Report Error" needs a row id
   to file a report against, and the editor's "Edit" button needs one to
   build a link to entry.html. Both were about to ask the database the
   same question on the same page load.

   So the question is asked once, here, and the answer handed to whoever
   wants it:

       MedCarePageTarget.ready.then(function (target) {
         if (!target) { return; }        // not a page backed by a row
         target.kind    // 'article' | 'disease' | 'page'
         target.table   // 'articles' | 'diseases' | 'pages'
         target.id      // the numeric primary key — NOT set for 'page'
         target.slug    // the text key — ONLY set for 'page'
         target.title   // for whatever needs to name it on screen
       });

   A 'page' TARGET IS KEYED DIFFERENTLY, AND ON PURPOSE

   The footer pages live in public.pages, which is keyed by a text slug
   rather than by a generated id, because the slug is written into the
   HTML file as data-page-slug and has to stay legible in both places.
   So a 'page' target carries `slug` and no `id`.

   Any caller that needs a numeric id must therefore check `kind` first.
   Today that means report.js, which files against a numeric target and
   is not loaded on the footer pages — there is no editorial queue for
   the privacy policy. edit-link.js checks, and builds a different
   address for the two shapes.

   TWO WAYS A PAGE KNOWS WHAT IT IS

   read.html already knows — read.js drew the row and announces it. A
   hand-written page does not, and has to look itself up.

   THIS DECIDES NOTHING ABOUT PERMISSION

   It answers "what is this page", never "what may you do to it". The
   lookup runs as whoever is browsing, under the public select policy,
   and finding a row means the row is published, not that the visitor is
   staff. Callers do their own checking.
   ============================================================ */

(function () {
  'use strict';

  var db = window.supabaseClient;

  var settle;
  var ready = new Promise(function (resolve) { settle = resolve; });

  /* One resolve, whichever branch gets there first. A page is one thing,
     and a second answer would be a bug rather than an update. */
  var done = false;
  function finish(target) {
    if (done) { return; }
    done = true;
    settle(target || null);
  }

  /* ---------- read.html ----------
     read.js publishes the row it drew, as a property AND an event,
     because script order decides which one arrives: if read.js finished
     first the event is already gone and the property is there; if it
     has not finished yet the property is absent and the event is
     coming. Reading both means this file does not care which <script>
     tag comes first.

     Nothing is announced when the row was missing or the load failed,
     so on those pages this promise simply never settles and no caller
     mounts anything. That is the right outcome: there is no row to
     report on or edit. */
  function fromReader() {
    function accept(page) {
      if (!page || !page.id) { return false; }
      finish({
        kind:  page.kind === 'disease' ? 'disease' : 'article',
        table: page.kind === 'disease' ? 'diseases' : 'articles',
        id:    page.id,
        title: page.title || ''
      });
      return true;
    }
    if (accept(window.MedCarePage)) { return; }
    document.addEventListener('medcare:page-rendered', function (e) {
      accept(e.detail);
    });
  }

  /* ---------- a hand-written page ----------
     There is no slug router here: each article and each condition is its
     own file, and the `href` column holds exactly the path a listing
     would link to. So the page identifies itself by its own URL and
     looks up the matching row to get the numeric id.

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
      ? { table: 'diseases', titleCol: 'name',  kind: 'disease',
          href: parts.slice(-2).join('/') }
      : { table: 'articles', titleCol: 'title', kind: 'article',
          href: file };

    db.from(spec.table).select('id,' + spec.titleCol)
      .eq('href', spec.href).maybeSingle()
      .then(function (res) {
        if (res.error) { throw res.error; }
        if (!res.data) {
          /* Not every .html on this site is content. index.html, the
             listings, the legal pages and the whole editor area have no
             row and are not supposed to have one, so this is the normal
             answer for most of the site rather than a fault. */
          finish(null);
          return;
        }
        finish({
          kind:  spec.kind,
          table: spec.table,
          id:    res.data.id,
          title: res.data[spec.titleCol]
        });
      })
      .catch(function (err) {
        console.error('[MedCare] Could not identify this page:', err);
        finish(null);
      });
    return true;
  }

  /* ---------- a footer page ----------
     about, terms, privacy and cookies. These already say which row backs
     them, in the attribute page-body.js reads to decide whether to
     render from the database — so the answer is in the DOM and costs
     nothing to fetch. Deliberately no round trip: page-body.js is
     already asking public.pages for this exact row on this exact load,
     and a second query for a title nothing prints would be a request
     spent on nothing.

     Checked before the article lookup below, which would otherwise ask
     the articles table for href='privacy.html' and correctly find
     nothing. */
  function fromFooterPage() {
    var host = document.querySelector('[data-page-slug]');
    if (!host) { return false; }

    var slug = host.getAttribute('data-page-slug');
    if (!slug) { return false; }

    var h1 = document.querySelector('.mc-page-head h1');
    finish({
      kind:  'page',
      table: 'pages',
      slug:  slug,
      title: h1 ? h1.textContent.trim() : slug
    });
    return true;
  }

  if (!db) {
    finish(null);
  } else if (!fromFooterPage() && !fromStaticPage()) {
    fromReader();
  }

  window.MedCarePageTarget = { ready: ready };

})();
