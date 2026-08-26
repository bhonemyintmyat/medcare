/* ============================================================
   MedCare — maintenance mode and the site-wide notice
   Loaded by admin/maintenance.html, after admin-guard.js,
   admin-shell.js and admin-api.js.

   Two settings, two forms, one table: site_settings, keys 'maintenance'
   and 'notice'. What reads them is the last block of script.js, on
   every public page.

   ------------------------------------------------------------
   THE ASYMMETRY, WHICH IS DELIBERATE

   Closing the site asks you to type a phrase. Reopening it is one
   click, from a button on the status card, with no confirmation at all.

   That is not an inconsistency. The two actions have opposite failure
   costs: closing by accident takes the health information away from
   everybody who needs it, and every second of hesitation before it is
   time well spent. Reopening by accident restores a working site. When
   somebody is standing at this screen at 2am trying to put the site
   back, the last thing that should be in their way is a form.

   The same reasoning is why unticking "keep the emergency numbers
   reachable" asks for a different, harder phrase than closing does: it
   is the one setting on this screen that can leave somebody holding a
   phone with nothing to dial.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareAdminGuard;
  var api   = window.MedCareAdmin;
  if (!guard || !api) { return; }

  var esc = api.esc;

  var msgEl    = document.getElementById('mtMsg');
  var statusEl = document.getElementById('mtStatus');

  // Maintenance form
  var mtForm      = document.getElementById('mtForm');
  var mtOpen      = document.getElementById('mtOpen');
  var mtClosed    = document.getElementById('mtClosed');
  var mtMessage   = document.getElementById('mtMessage');
  var mtCount     = document.getElementById('mtMessageCount');
  var mtEmergency = document.getElementById('mtEmergency');
  var mtEmWarn    = document.getElementById('mtEmergencyWarn');
  var mtPreview   = document.getElementById('mtPreview');
  var mtPrevMsg   = document.getElementById('mtPreviewMessage');
  var mtPrevEm    = document.getElementById('mtPreviewEmergency');
  var mtReset     = document.getElementById('mtReset');
  var mtSave      = document.getElementById('mtSave');

  // Notice form
  var ntForm    = document.getElementById('ntForm');
  var ntEnabled = document.getElementById('ntEnabled');
  var ntTone    = document.getElementById('ntTone');
  var ntText    = document.getElementById('ntText');
  var ntCount   = document.getElementById('ntTextCount');
  var ntPreview = document.getElementById('ntPreview');
  var ntPrevBar = document.getElementById('ntPreviewBar');
  var ntPrevTxt = document.getElementById('ntPreviewText');
  var ntReset   = document.getElementById('ntReset');
  var ntSave    = document.getElementById('ntSave');

  var DEFAULT_MESSAGE = 'MedCare is being updated. Please check back shortly.';

  /* `saved` is what the database last told us. The forms are the working
     copy. Everything that decides whether Save is enabled, and what the
     confirmation should ask, is a comparison between the two — so a
     failed write leaves the page describing the database rather than
     describing what somebody typed. */
  var saved = null;
  var names = {};
  var busy  = false;

  /* ---------------------------------------------------------------
     READING
     --------------------------------------------------------------- */

  function load() {
    return api.loadSettings(['maintenance', 'notice'])
      .then(function (rows) {
        saved = rows;
        return api.loadNames([rows.maintenance.updated_by, rows.notice.updated_by]);
      })
      .then(function (found) {
        names = found;
        fillForms();
        renderStatus();
      })
      .catch(function (err) {
        console.error('[MedCare] Could not read the site settings:', err);
        statusEl.innerHTML =
          '<div class="mc-admin-card"><div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not read the site settings</h2>' +
            '<p>' + esc(api.describeError(err, 'the site settings')) + '</p>' +
          '</div></div>';
        api.message(msgEl, 'error', api.describeError(err, 'the site settings'));
        disableForms();
      });
  }

  function disableForms() {
    [mtOpen, mtClosed, mtMessage, mtEmergency, mtSave, mtReset,
     ntEnabled, ntTone, ntText, ntSave, ntReset].forEach(function (el) {
      if (el) { el.disabled = true; }
    });
  }

  function touchedLine(key) {
    var row = saved[key];
    if (!row || row.missing || !row.updated_at) {
      return '<span class="mc-touched">Never changed from this screen</span>';
    }
    var who = row.updated_by && names[row.updated_by];
    return '<span class="mc-touched">' +
             (who ? 'Last changed by <b>' + esc(who) + '</b> ' : 'Last changed ') +
             esc(api.whenExact(row.updated_at)) +
           '</span>';
  }

  /* ---------------------------------------------------------------
     THE STATUS CARD
     ---------------------------------------------------------------
     The answer to "is the site up?", above everything else, in the two
     colours the rest of the admin area uses for the same question.
     --------------------------------------------------------------- */

  function renderStatus() {
    var m = saved.maintenance.value;
    var n = saved.notice.value;

    var noticeLine = n.enabled && String(n.text || '').trim()
      ? '<p class="mc-ad-status-sub">A ' + esc(n.tone === 'warning' ? 'warning' : 'notice') +
        ' banner is showing on every page.</p>'
      : '';

    if (m.enabled) {
      statusEl.innerHTML =
        '<div class="mc-admin-card mc-ad-status mc-ad-status--closed">' +
          '<div class="mc-ad-status-body">' +
            '<span class="mc-ad-status-ico"><i class="bi bi-cone-striped"></i></span>' +
            '<div>' +
              '<h2>The site is closed to the public</h2>' +
              '<p class="mc-ad-status-sub">' +
                'Readers are seeing the maintenance message. ' +
                (m.allow_emergency
                  ? 'The emergency numbers are still reachable.'
                  : '<strong>The emergency numbers are hidden too.</strong>') +
              '</p>' +
              noticeLine +
              touchedLine('maintenance') +
            '</div>' +
          '</div>' +
          '<button type="button" class="mc-auth-btn" data-reopen>' +
            '<i class="bi bi-door-open"></i> Reopen the site' +
          '</button>' +
        '</div>';
      return;
    }

    statusEl.innerHTML =
      '<div class="mc-admin-card mc-ad-status mc-ad-status--open">' +
        '<div class="mc-ad-status-body">' +
          '<span class="mc-ad-status-ico"><i class="bi bi-check-circle"></i></span>' +
          '<div>' +
            '<h2>The site is open</h2>' +
            '<p class="mc-ad-status-sub">Everybody sees MedCare as normal.</p>' +
            noticeLine +
            touchedLine('maintenance') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------------
     THE FORMS
     --------------------------------------------------------------- */

  function fillForms() {
    var m = saved.maintenance.value;
    mtOpen.checked   = !m.enabled;
    mtClosed.checked = !!m.enabled;
    mtMessage.value  = m.message || '';
    mtEmergency.checked = m.allow_emergency !== false;

    var n = saved.notice.value;
    ntEnabled.checked = !!n.enabled;
    ntTone.value      = n.tone === 'warning' ? 'warning' : 'info';
    ntText.value      = n.text || '';

    syncMaintenance();
    syncNotice();
  }

  function readMaintenance() {
    return {
      enabled: mtClosed.checked,
      message: mtMessage.value.trim(),
      allow_emergency: mtEmergency.checked
    };
  }

  function readNotice() {
    return {
      enabled: ntEnabled.checked,
      tone: ntTone.value === 'warning' ? 'warning' : 'info',
      text: ntText.value.trim()
    };
  }

  function same(a, b) {
    return Object.keys(a).every(function (k) { return a[k] === b[k]; });
  }

  /* Redraws everything that depends on the maintenance form: the counter,
     the emergency warning, the preview, and whether Save is live. */
  function syncMaintenance() {
    var next = readMaintenance();

    mtCount.textContent = mtMessage.value.length;

    // The warning is about the state being SAVED, not about the tickbox
    // in isolation: an unticked box on an open site changes nothing yet.
    mtEmWarn.hidden = !(next.enabled && !next.allow_emergency);

    mtPreview.hidden = !next.enabled;
    if (next.enabled) {
      mtPrevMsg.textContent = next.message || DEFAULT_MESSAGE;
      mtPrevEm.hidden = !next.allow_emergency;
    }

    var dirty = !same(next, saved.maintenance.value);
    mtSave.disabled = !dirty || busy;
    mtReset.disabled = !dirty || busy;
    mtSave.textContent = !dirty ? 'Saved'
      : (next.enabled && !saved.maintenance.value.enabled) ? 'Close the site'
      : (!next.enabled && saved.maintenance.value.enabled) ? 'Reopen the site'
      : 'Save';
  }

  function syncNotice() {
    var next = readNotice();

    ntCount.textContent = ntText.value.length;

    ntPreview.hidden = !next.text;
    if (next.text) {
      ntPrevTxt.textContent = next.text;
      ntPrevBar.className = 'mc-site-notice' +
        (next.tone === 'warning' ? ' mc-site-notice--warning' : '');
      ntPrevBar.querySelector('i').className =
        next.tone === 'warning' ? 'bi bi-exclamation-triangle' : 'bi bi-info-circle';
    }

    var dirty = !same(next, saved.notice.value);
    ntSave.disabled = !dirty || busy;
    ntReset.disabled = !dirty || busy;
    ntSave.textContent = dirty ? 'Save' : 'Saved';
  }

  /* ---------------------------------------------------------------
     WRITING
     --------------------------------------------------------------- */

  function write(key, value, okText) {
    busy = true;
    syncMaintenance();
    syncNotice();
    api.message(msgEl, 'ok', '');

    return api.saveSetting(key, value)
      .then(function (row) {
        saved[key] = {
          value: value,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
          missing: false
        };
        busy = false;
        return api.loadNames([row.updated_by]).then(function (found) {
          Object.keys(found).forEach(function (id) { names[id] = found[id]; });
          fillForms();
          renderStatus();
          api.message(msgEl, 'ok', okText);
        });
      })
      .catch(function (err) {
        busy = false;
        console.error('[MedCare] Could not save ' + key + ':', err);
        // The forms keep what was typed, so nothing has to be retyped;
        // `saved` is untouched, so Save stays live for another attempt.
        syncMaintenance();
        syncNotice();
        api.message(msgEl, 'error', api.describeError(err, 'that setting'));
      });
  }

  function saveMaintenance() {
    var next = readMaintenance();
    var was  = saved.maintenance.value;

    if (next.enabled && !next.message) {
      api.message(msgEl, 'error',
        'Write the message first. A reader who is turned away without being told ' +
        'why, or when to come back, assumes the site is broken for good.');
      mtMessage.focus();
      return;
    }

    var closing    = next.enabled && !was.enabled;
    var hidingNums = next.enabled && !next.allow_emergency &&
                     (!was.enabled || was.allow_emergency);

    var okText = !next.enabled
      ? 'The site is open again.'
      : closing
        ? 'The site is closed. Readers now see your message.'
        : 'Saved. The site stays closed.';

    /* Hiding the emergency numbers is asked about first and hardest,
       even when it happens in the same save as the closure: it is the
       part of the change that a reader could be harmed by. */
    if (hidingNums) {
      api.confirmByName({
        title: 'Hide the emergency numbers?',
        body: 'While the site is closed, somebody who opens MedCare looking for ' +
              'an ambulance, the fire service or poison control will get the ' +
              'maintenance message and no phone number at all.',
        expect: 'hide the numbers',
        go: 'Hide them',
        icon: 'bi-exclamation-octagon'
      }).then(function (yes) {
        if (yes) { write('maintenance', next, okText); }
      });
      return;
    }

    if (closing) {
      api.confirmByName({
        title: 'Close the public site?',
        body: 'Every public page will show your message instead of itself. ' +
              'Somebody looking up a symptom right now will not find it. ' +
              'Staff and the emergency numbers are unaffected.',
        expect: 'close the site',
        go: 'Close it',
        icon: 'bi-cone-striped'
      }).then(function (yes) {
        if (yes) { write('maintenance', next, okText); }
      });
      return;
    }

    write('maintenance', next, okText);
  }

  function saveNotice() {
    var next = readNotice();

    if (next.enabled && !next.text) {
      api.message(msgEl, 'error',
        'Write the notice first. Turned on with nothing in it, it is a coloured ' +
        'stripe across every page of the site.');
      ntText.focus();
      return;
    }

    write('notice', next,
      next.enabled ? 'The notice is showing on every page.' : 'The notice is off.');
  }

  /* ---------------------------------------------------------------
     WIRING
     --------------------------------------------------------------- */

  mtForm.addEventListener('input',  syncMaintenance);
  mtForm.addEventListener('change', syncMaintenance);
  mtForm.addEventListener('submit', function (e) {
    e.preventDefault();
    saveMaintenance();
  });
  mtReset.addEventListener('click', function () {
    fillForms();
    api.message(msgEl, 'ok', '');
  });

  ntForm.addEventListener('input',  syncNotice);
  ntForm.addEventListener('change', syncNotice);
  ntForm.addEventListener('submit', function (e) {
    e.preventDefault();
    saveNotice();
  });
  ntReset.addEventListener('click', function () {
    fillForms();
    api.message(msgEl, 'ok', '');
  });

  /* Reopening from the status card. No confirmation, and it does not
     touch the message or the emergency setting — it flips one field, so
     that closing the site again later says the same thing it said
     before without anybody having to retype it. */
  statusEl.addEventListener('click', function (e) {
    if (!e.target.closest('[data-reopen]')) { return; }
    var next = {
      enabled: false,
      message: saved.maintenance.value.message,
      allow_emergency: saved.maintenance.value.allow_emergency
    };
    write('maintenance', next, 'The site is open again.');
  });

  /* Leaving with something typed and unsaved. The browser's own dialog
     rather than a nicer one of ours: ours cannot stop a navigation, and
     a prettier warning that does not actually prevent the loss is worse
     than the ugly one that does. */
  window.addEventListener('beforeunload', function (e) {
    if (!saved || busy) { return; }
    if (same(readMaintenance(), saved.maintenance.value) &&
        same(readNotice(), saved.notice.value)) { return; }
    e.preventDefault();
    e.returnValue = '';
  });

  guard.ready.then(load);

})();
