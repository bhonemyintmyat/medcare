/* ============================================================
   MedCare — admin chrome
   Loaded on every admin page, after admin-guard.js and before the
   page's own script.

   This is the sidebar and topbar behaviour that every admin page
   shares: who you are, the way out, the drawer on a narrow screen, and
   which nav item is the current one. It is not the brief's "one file
   per page" — it is the part that would otherwise be copied into seven
   of them and drift apart by the third.

   It waits for MedCareAdminGuard.ready, which resolves only once an
   admin is confirmed. On any other outcome the page is already on its
   way elsewhere and there is no chrome worth filling in.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  if (!guard) { return; }          // guard missing: the page stays blank, by design

  var shell   = document.getElementById('adminShell');
  var burger  = document.getElementById('adminBurger');
  var whoEl   = document.getElementById('adminWho');
  var signOut = document.getElementById('adminSignOut');

  /* ---------- Who you are ----------
     Both elements are absent on the editor desk, which ends its topbar
     with the account menu auth.js builds instead: the name is in the
     trigger and signing out is a row in the panel. The admin area still
     carries the pill and the button, so this stays. */
  guard.ready.then(function () {
    if (whoEl) {
      whoEl.textContent = guard.displayName();
      // The email is the account's real identity even when a display
      // name is shown, so it stays reachable on hover.
      var user = guard.getUser();
      if (user) { whoEl.parentNode.setAttribute('title', user.email); }
    }
  });

  /* ---------- The way out ---------- */
  if (signOut) {
    signOut.addEventListener('click', function () {
      signOut.disabled = true;
      guard.signOut();
    });
  }

  /* ---------- The other way out ----------
     Admins own their accounts as much as readers do, and the control
     that lets a reader close theirs hangs off the navbar — which the
     admin area does not have. Without this, an admin would have to
     leave the area, find a public page and open a menu there to do
     something about their own account.

     Injected rather than added to the admin HTML files, for the same
     reason the account menu is injected into the public ones. The
     dialog itself lives in auth.js: one wording, one confirmation, one
     list of what a deletion takes, wherever it is opened from. */
  (function addLeaveForGood() {
    // The editor desk does not need it: its topbar carries the account
    // menu, and "Delete your account" is already a row in there. Adding
    // this would be the same dialog twice on one screen.
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

  /* ---------- Which page is this ----------
     Set here rather than hard-coded into each file: a page carrying its
     own aria-current is one more chance to point at the wrong link
     after a rename. */
  (function markCurrent() {
    var here = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.mc-admin-nav a');
    Array.prototype.forEach.call(links, function (a) {
      var target = a.getAttribute('href').split('/').pop().split('?')[0];
      if (target === here) { a.setAttribute('aria-current', 'page'); }
      else { a.removeAttribute('aria-current'); }
    });
  })();

  /* ---------- The drawer ----------
     Only reachable below 992px, where admin.css turns the sidebar into
     an off-canvas panel. Everything here is a no-op on a wide screen. */
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

    // Following a link closes the drawer behind you. Without this the
    // next page can inherit a scroll-locked, half-open feeling on the
    // browsers that keep the class through a same-origin navigation.
    shell.addEventListener('click', function (e) {
      if (e.target.closest('.mc-admin-nav a')) { setOpen(false); }
    });

    // Dragging the window back to desktop width leaves .is-open stuck on
    // a sidebar that is no longer a drawer.
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 992px)');
      var onWide = function (m) { if (m.matches) { setOpen(false); } };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }

})();
