(function () {
  'use strict';

  var sanitize = window.MedCareSanitize;

  var cache = {};

  function siteRelative(href) {
    if (!href) { return null; }
    var v = String(href).trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) { return null; }
    if (v.charAt(0) === '/' || v.indexOf('//') === 0) { return null; }
    if (v.indexOf('..') !== -1) { return null; }
    return /^[a-z0-9._\-\/]+\.html?$/i.test(v) ? v : null;
  }

  var STRIP = [
    '.mc-sources',
    '.mc-report',
    '.mc-modal',
    '.mc-toast-wrap',
    '.mc-lang-note',
    '.mc-breadcrumb',

    '.mc-section-label',

    '.mc-setting',
    '.mc-feature',

    '[data-page-body]',
    'script', 'style', 'noscript',
    'form', 'iframe'
  ];

  var UNWRAP_FIRST = ['button', 'figcaption'];

  function unwrap(el) {
    var parent = el.parentNode;
    if (!parent) { return; }
    while (el.firstChild) { parent.insertBefore(el.firstChild, el); }
    parent.removeChild(el);
  }

  function extract(doc, lang) {

    var scope = doc.querySelector('[data-page-static]') ||
                doc.querySelector('.mc-detail-body .col-lg-8') ||
                doc.querySelector('.mc-detail-body') ||
                doc.querySelector('main');
    if (!scope) { return ''; }

    var copy = scope.cloneNode(true);

    STRIP.forEach(function (sel) {
      Array.prototype.forEach.call(copy.querySelectorAll(sel), function (n) {
        n.parentNode.removeChild(n);
      });
    });

    UNWRAP_FIRST.forEach(function (sel) {
      Array.prototype.forEach.call(copy.querySelectorAll(sel), unwrap);
    });

    var enCount = copy.querySelectorAll('.mc-en').length;
    var myCount = copy.querySelectorAll('.mc-my').length;
    if (lang === 'my' && !myCount) { return ''; }
    if (lang === 'en' && !enCount && myCount) { return ''; }

    var other = lang === 'my' ? '.mc-en' : '.mc-my';
    Array.prototype.forEach.call(copy.querySelectorAll(other), function (n) {
      n.parentNode.removeChild(n);
    });

    return sanitize.clean(copy.innerHTML);
  }

  function urlFor(href) {
    return new URL('../' + href, window.location.href).href;
  }

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

        var doc = new DOMParser().parseFromString(html, 'text/html');
        var out = { en: extract(doc, 'en'), my: extract(doc, 'my'), url: url };

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
