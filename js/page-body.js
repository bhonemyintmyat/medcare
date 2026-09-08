(function () {
  'use strict';

  var host = document.querySelector('[data-page-slug]');
  if (!host) { return; }

  var slug     = host.getAttribute('data-page-slug');
  var staticEl = host.querySelector('[data-page-static]');
  var enEl     = host.querySelector('[data-page-body="en"]');
  var myEl     = host.querySelector('[data-page-body="my"]');

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

      if (!sanitize.textOf(en) && !sanitize.textOf(my)) { return; }

      enEl.innerHTML = en || my;
      myEl.innerHTML = my || en;

      staticEl.hidden = true;
      enEl.hidden = false;
      myEl.hidden = false;
    })
    ['catch'](function (err) {

      if (window.console && console.warn) {
        console.warn('[MedCare] pages: showing the copy in ' + slug +
                     '.html; the database did not answer.',
                     err && err.message ? err.message : err);
      }
    });
})();
