(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  if (!guard) { return; }

  var shell   = document.getElementById('adminShell');
  var burger  = document.getElementById('adminBurger');
  var whoEl   = document.getElementById('adminWho');
  var signOut = document.getElementById('adminSignOut');

  guard.ready.then(function () {
    if (whoEl) {
      whoEl.textContent = guard.displayName();

      var user = guard.getUser();
      if (user) { whoEl.parentNode.setAttribute('title', user.email); }
    }
  });

  if (signOut) {
    signOut.addEventListener('click', function () {
      signOut.disabled = true;
      guard.signOut();
    });
  }

  (function addLeaveForGood() {

    if (/\/editor\//.test(window.location.pathname)) { return; }

    var foot = document.querySelector('.mc-admin-side-foot');
    var auth = window.MedCareAuth;
    if (!foot || !auth || !auth.openDeleteAccountDialog) { return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'adminDeleteAccount';
    btn.className = 'mc-admin-side-danger';
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="10.2" cy="8.4" r="3.4"></circle>' +
        '<path d="M4 20a6.2 6.2 0 0 1 10.6-4.4"></path>' +
        '<path d="M16.4 16.4l4.2 4.2M20.6 16.4l-4.2 4.2"></path>' +
      '</svg><span>Delete your account</span>';

    btn.addEventListener('click', function () { auth.openDeleteAccountDialog(); });
    foot.appendChild(btn);
  })();

  (function markCurrent() {
    var here = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.mc-admin-nav a');
    Array.prototype.forEach.call(links, function (a) {
      var target = a.getAttribute('href').split('/').pop().split('?')[0];
      if (target === here) { a.setAttribute('aria-current', 'page'); }
      else { a.removeAttribute('aria-current'); }
    });
  })();

  if (shell && burger) {
    var backdrop = shell.querySelector('[data-shell-close]');

    function setOpen(open) {
      shell.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Hide admin sections' : 'Show admin sections');
      if (!open) { burger.focus(); }
    }

    burger.addEventListener('click', function () {
      setOpen(!shell.classList.contains('is-open'));
    });

    if (backdrop) {
      backdrop.addEventListener('click', function () { setOpen(false); });
    }

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && shell.classList.contains('is-open')) {
        setOpen(false);
      }
    });

    shell.addEventListener('click', function (e) {
      if (e.target.closest('.mc-admin-nav a')) { setOpen(false); }
    });

    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 992px)');
      var onWide = function (m) { if (m.matches) { setOpen(false); } };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }

})();
