(function () {
  'use strict';

  var api   = window.MedCareAdmin;
  var guard = window.MedCareAdminGuard;
  if (!api || !guard) { return; }

  var listEl = document.getElementById('staffList');
  var noteEl = document.getElementById('staffNote');
  if (!listEl) { return; }

  var esc = api.esc;

  var RANK = { admin: 0, editor: 1 };

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
