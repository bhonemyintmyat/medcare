(function () {
  'use strict';

  var db = window.supabaseClient;

  var settle;
  var ready = new Promise(function (resolve) { settle = resolve; });

  var done = false;
  function finish(target) {
    if (done) { return; }
    done = true;
    settle(target || null);
  }

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

  function fromStaticPage() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var file  = parts.length ? parts[parts.length - 1] : '';

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
