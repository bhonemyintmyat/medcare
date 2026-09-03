/* ============================================================
   MedCare — the admin overview's one live panel
   Loaded on admin/index.html, after admin-api.js.

   The overview is otherwise a page of links. This is the single thing
   on it that reads from the database: the people who run the site and
   how to reach them. An admin lands here first, and "who are the other
   editors and admins, and what is their email" is the question this
   page can answer without sending them into the accounts table and
   filtering it by hand.

   STAFF, not everyone. Readers are the bulk of the accounts and belong
   on users.html, where they can be searched and paged. Staff are few,
   they change rarely, and an admin has a standing reason to have their
   addresses in front of them — so this lists editors and admins only.

   It SHOWS; it does not decide. "Admins can read all profiles" is what
   makes loadAccounts return more than the caller's own row, and the
   email column is readable for the same reason. Delete the guard and
   open this page as a reader and the query returns one row — your own —
   because Postgres filters the rest out before the response is built.
   ============================================================ */

(function () {
  'use strict';

  var api   = window.MedCareAdmin;
  var guard = window.MedCareAdminGuard;
  if (!api || !guard) { return; }

  var listEl = document.getElementById('staffList');
  var noteEl = document.getElementById('staffNote');
  if (!listEl) { return; }

  var esc = api.esc;

  // Staff are shown admins-first, then editors, and alphabetically by
  // the name they are listed under within each — the order an admin
  // scans a short team in, not the joining order the accounts table uses.
  var RANK = { admin: 0, editor: 1 };

  /* Initials for the avatar, from whatever the person is listed as:
     "Su Myat Aung" -> SM, "lead@medcare..." -> LE. The same idea as the
     account menu's avatar in auth.js, kept here rather than shared
     because this file must not depend on the public navbar's script. */
  function initials(label) {
    var text = String(label || '').split('@')[0];
    var parts = text.split(/[\s._+-]+/).filter(Boolean);
    var out = parts.length > 1
      ? parts[0].charAt(0) + parts[1].charAt(0)
      : text.slice(0, 2);
    return (out || '?').toUpperCase();
  }

  function note(kind, text) {
    if (!noteEl) { return; }
    if (!text) { noteEl.hidden = true; noteEl.textContent = ''; return; }
    noteEl.hidden = false;
    noteEl.textContent = text;
    noteEl.className = 'mc-admin-msg mc-admin-msg--' + (kind || 'error');
  }

  function rowHtml(p, myId) {
    var isMe  = p.id === myId;
    var label = api.accountLabel(p);

    /* The email is the point of this panel, so it is a mailto link when
       we have one and a plain muted line when we do not — an admin whose
       address is missing is a thing worth seeing, not hiding. When the
       label already IS the email (no display name set), it is not
       repeated underneath. */
    var mail;
    if (p.email && p.email !== label) {
      mail = '<a class="mc-staff-mail" href="mailto:' + esc(p.email) + '">' +
               esc(p.email) + '</a>';
    } else if (p.email && p.email === label) {
      mail = '';
    } else {
      mail = '<span class="mc-staff-mail mc-staff-mail--none">No email on file</span>';
    }

    return '<li class="mc-staff-row">' +
      '<span class="mc-staff-avatar" aria-hidden="true">' + esc(initials(label)) + '</span>' +
      '<div class="mc-staff-who">' +
        '<div class="mc-staff-name">' +
          '<span class="mc-staff-name-text">' + esc(label) + '</span>' +
          (isMe ? '<span class="mc-people-you">you</span>' : '') +
        '</div>' +
        mail +
      '</div>' +
      api.rolePill(p.role) +
    '</li>';
  }

  function render(rows, myId, partial) {
    var staff = (rows || []).filter(function (p) {
      return p.role === 'editor' || p.role === 'admin';
    });

    staff.sort(function (a, b) {
      var ra = RANK[a.role], rb = RANK[b.role];
      if (ra !== rb) { return ra - rb; }
      return api.accountLabel(a).toLowerCase()
               .localeCompare(api.accountLabel(b).toLowerCase());
    });

    if (partial) {
      // The email column has not been migrated in yet: the panel would
      // be a list of names with "No email on file" against every one,
      // which is a worse answer than saying so once.
      note('warn', 'Staff email addresses are not available yet: the profiles ' +
                   'table has no email column. Run the display-name migration to ' +
                   'switch this on.');
    } else {
      note(null, '');
    }

    if (!staff.length) {
      listEl.innerHTML =
        '<li class="mc-staff-empty">No editors or admins yet. Grant a role on the ' +
        '<a href="permissions.html">roles and permissions</a> screen.</li>';
      return;
    }

    listEl.innerHTML = staff.map(function (p) { return rowHtml(p, myId); }).join('');
  }

  guard.ready.then(function () {
    var user = guard.getUser();
    var myId = user ? user.id : null;

    api.loadAccounts()
      .then(function (result) {
        render(result.rows, myId, result.partial);
      })
      .catch(function (err) {
        listEl.innerHTML = '';
        note('error', api.describeError(err, 'load the staff list'));
      });
  });

})();
