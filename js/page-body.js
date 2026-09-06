/* ============================================================
   MedCare — the footer pages, rendered from the database

   Loaded by about.html, terms.html, privacy.html and cookies.html,
   after supabase.js, sanitize-html.js and script.js.

   WHAT IT DOES

   Each of those pages ships its prose in the file, inside

       <div data-page-static> … </div>

   and carries an empty pair of boxes next to it. If public.pages holds
   text for this page, the boxes are filled with it and the file's copy
   is hidden. If it does not, nothing happens and the reader sees the
   file — which is the normal state of a fresh database, not an error.

   THE FILE IS THE FALLBACK, AND IT IS NEVER REMOVED

   The static prose stays in the DOM, hidden, rather than being deleted.
   A page whose only copy of the privacy policy is in a fetch that might
   fail is a page that can show a reader nothing at all, and 'nothing at
   all' is the one outcome a privacy policy must not have. Hiding is
   also reversible: any failure below simply leaves it visible.

   So every path that is not 'the database answered, with prose in it'
   ends in the file's copy standing. No network, no Supabase client, a
   table that does not exist yet, an error, an empty row, a row that
   sanitises down to nothing — all of them mean 'show the file'.

   BOTH LANGUAGES

   The row stores English and Burmese apart, and the page shows the one
   html[lang] selects, exactly as read.js does for articles:

       <div class="mc-article-prose mc-noi18n mc-en" …>
       <div class="mc-article-prose mc-noi18n mc-my" …>

   mc-noi18n keeps script.js's phrase dictionary off long-form text —
   without it a sentence in a policy could be silently swapped for a
   dictionary entry that happened to match it.

   Where only one language has been written, that one stands in for
   both, which is what read.js does and for the same reason: showing a
   reader an empty page is worse than showing them the other language.

   IT IS SANITISED HERE TOO

   admin/pages.html sanitises on the way in. This sanitises again on the
   way out, because a column that a public page renders as HTML should
   not be trusted on the strength of the screen that normally writes it.
   ============================================================ */

(function () {
  'use strict';

  var host = document.querySelector('[data-page-slug]');
  if (!host) { return; }

  var slug     = host.getAttribute('data-page-slug');
  var staticEl = host.querySelector('[data-page-static]');
  var enEl     = host.querySelector('[data-page-body="en"]');
  var myEl     = host.querySelector('[data-page-body="my"]');

  /* A page missing any of its three parts is a page this cannot render
     safely — filling one box while another stays empty would show the
     reader half a policy. Leave the file's copy alone. */
  if (!staticEl || !enEl || !myEl) { return; }

  var db       = window.supabaseClient;
  var sanitize = window.MedCareSanitize;
  if (!db || !sanitize) { return; }

  db.from('pages')
    .select('body,body_my')
    .eq('slug', slug)
    .maybeSingle()
    .then(function (res) {
      if (res.error) { throw res.error; }

      var row = res.data;
      if (!row) { return; }

      var en = sanitize.clean(row.body || '');
      var my = sanitize.clean(row.body_my || '');

      /* textOf() rather than a length test: '<p></p>' is not empty as a
         string and is empty as prose, and adopting it would blank the
         page in exactly the way this file exists to prevent. */
      if (!sanitize.textOf(en) && !sanitize.textOf(my)) { return; }

      enEl.innerHTML = en || my;
      myEl.innerHTML = my || en;

      /* Swap only once both boxes hold something. Hiding the file's copy
         first would leave a gap if anything above threw. */
      staticEl.hidden = true;
      enEl.hidden = false;
      myEl.hidden = false;
    })
    ['catch'](function (err) {
      /* Deliberately quiet for the reader and loud in the console. The
         page is complete either way — there is nothing here to tell them
         that they would act on. */
      if (window.console && console.warn) {
        console.warn('[MedCare] pages: showing the copy in ' + slug +
                     '.html; the database did not answer.',
                     err && err.message ? err.message : err);
      }
    });
})();
