(function () {
  'use strict';

  var auth   = window.MedCareAuth;
  var target = window.MedCarePageTarget;
  if (!auth || !target) { return; }

  var LINK_ID = 'mcEditLink';

  function depth() {
    return window.location.pathname.indexOf('/diseases/') !== -1 ? '../' : '';
  }

  function editHref(t) {
    if (t.kind === 'page') {
      return depth() + 'editor/pages.html?slug=' + encodeURIComponent(t.slug);
    }
    return depth() + 'editor/entry.html' +
           '?type=' + encodeURIComponent(t.kind) +
           '&id='   + encodeURIComponent(t.id);
  }

  function mount(t) {
    if (document.getElementById(LINK_ID)) { return; }

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

  Promise.all([target.ready, auth.ready]).then(function (results) {
    var t = results[0];
    if (!t) { return; }

    function sync() {
      if (auth.isStaff()) { mount(t); } else { unmount(); }
    }

    sync();

    auth.onChange(sync);
  });

})();
