/* ============================================================
   MedCare — emergency numbers (editor/emergency.html)

   The highest-consequence screen in this area. Correcting a number,
   adding a service, and deciding which services are on the public page.

   WHY ADDING IS HERE, WHEN IT ONCE WAS NOT

   supabase_editor.sql section 3 gave editors UPDATE and left INSERT with
   admins, on the reasoning that adding a service changes what the
   emergency page IS and is never as urgent as fixing a wrong number.
   Then the admin area was scoped down and stopped having an emergency
   screen at all — at which point "INSERT is admin-only" stopped being a
   safeguard and became a table nobody on the site could add a row to.
   supabase_admin_scope.sql moves INSERT here and says so.

   What replaces the role gate is the workflow already on the table. A
   new service is born 'draft', the public policy serves 'published' and
   nothing else, so a half-typed number is invisible until somebody
   deliberately publishes it.

   AND THE SECOND PAIR OF HANDS

   For a while that WAS one pair of hands: the editor who typed a number
   could publish it. supabase_publish_approval.sql closed that. Every
   transition into 'published' now needs an admin, on this table as on
   the other three, so a new emergency number is written by one person
   and put in front of readers by another.

   Which is why the two buttons on a card are not symmetrical, and must
   not be made so. Publishing is an admin's. Taking a number OFF the
   page is any editor's, immediately — the editor who has just learned
   that an ambulance line is dead should not be looking for an admin
   before they can act on it. Approval protects readers from things
   appearing; nothing should stand between them and a wrong number
   disappearing.

   THE ONE THING IT STILL WILL NOT DO

   Delete. There is no editor DELETE policy on this table or any other,
   so removing a row for good is refused by Postgres rather than by the
   absence of a button. Unpublishing takes a service off the page and
   keeps the row.

   The number is typed twice, on a new row as much as a corrected one.
   That is a UI convention and it stops nothing determined; what makes
   the column safe to open is that nothing here can be destroyed and
   every change is stamped with who made it.
   ============================================================ */

(function () {
  'use strict';

  var guard = window.MedCareEditorGuard;
  var ed    = window.MedCareEditor;
  var db    = window.supabaseClient;
  if (!guard || !ed) { return; }

  var hostEl = document.getElementById('emHost');
  var msgEl  = document.getElementById('emMsg');
  var newEl  = document.getElementById('emNew');
  var addBtn = document.getElementById('emAdd');

  var rows  = [];
  var names = {};

  /* The columns edited on an existing row. `status` is not among them —
     it moves through the publish controls, which confirm separately —
     and neither is `icon`, which is a Bootstrap Icons name matching a
     design decision on the emergency page rather than anything somebody
     comes to this screen to fix. A new row gets a default icon it can
     keep for ever without looking wrong. */
  var EDITABLE = ['name', 'sub', 'phone', 'sort_order'];

  var NEW_ICON = 'bi-telephone-fill';

  function cardHtml(row) {
    var live = row.status === 'published';

    /* A live number is not an editor's to correct in place — the trigger
       refuses it, so the fields say so rather than accepting typing that
       cannot be saved. The way out is the "Take off the page" button
       that is already on this card. See section 4 of
       supabase_publish_approval.sql: this is the place where that rule
       costs the most, and where a carve-out would go if it is ever
       decided that a wrong number should be correctable in place. */
    var lock = !ed.canEditNow(row.status, guard.isAdmin());
    var dis  = lock ? ' disabled' : '';

    return '<div class="mc-admin-card" data-em="' + row.id + '" ' +
             'style="padding:1.25rem 1.35rem;box-shadow:none;margin-bottom:.85rem">' +

             '<div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:1.1rem">' +
               '<span class="mc-ed-row-ico"><i class="bi ' + ed.esc(row.icon || 'bi-telephone-fill') + '"></i></span>' +
               '<div style="flex:1;min-width:0">' +
                 '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem">' +
                   ed.esc(row.name) + '</div>' +
                 '<a href="tel:' + ed.esc(row.phone) + '" data-tel ' +
                    'style="font-size:1.15rem;font-weight:700;letter-spacing:.02em">' +
                   ed.esc(row.phone) + '</a>' +
               '</div>' +
               ed.statusPill(row.status) +
             '</div>' +

             (live ? '' :
               '<p class="mc-admin-msg mc-admin-msg--error" style="margin-bottom:1.1rem">' +
                 'This one is <strong>not</strong> on the public emergency page. Readers ' +
                 'cannot see it until it is published.' +
               '</p>') +

             (lock ?
               '<div class="mc-ed-locked" style="margin-bottom:1.1rem">' +
                 '<i class="bi bi-lock-fill"></i>' +
                 '<div><p>This number is on the public page, so it is not yours to change ' +
                   'in place. Take it off the page and it becomes editable — an admin puts ' +
                   'the corrected number back.</p></div>' +
               '</div>' : '') +

             '<div class="mc-ed-field">' +
               '<div class="mc-ed-label-row">' +
                 '<label class="mc-auth-label" for="em_name_' + row.id + '">Service</label>' +
               '</div>' +
               '<div class="mc-auth-field">' +
                 '<input type="text" id="em_name_' + row.id + '" data-f="name" ' +
                   'value="' + ed.esc(row.name) + '" autocomplete="off"' + dis + '>' +
               '</div>' +
             '</div>' +

             '<div class="mc-ed-field">' +
               '<div class="mc-ed-label-row">' +
                 '<label class="mc-auth-label" for="em_sub_' + row.id + '">When to call it</label>' +
               '</div>' +
               '<div class="mc-auth-field">' +
                 '<textarea id="em_sub_' + row.id + '" data-f="sub" rows="2"' + dis + '>' +
                   ed.esc(row.sub) + '</textarea>' +
               '</div>' +
               '<p class="mc-admin-hint">The line under the number. Say what to call it ' +
                 'for, in the words somebody would use while frightened.</p>' +
             '</div>' +

             '<div class="mc-ed-field mc-confirm-field">' +
               '<div class="mc-ed-label-row">' +
                 '<label class="mc-auth-label" for="em_phone_' + row.id + '">Number</label>' +
               '</div>' +
               '<div class="mc-auth-field">' +
                 '<input type="tel" id="em_phone_' + row.id + '" data-f="phone" ' +
                   'value="' + ed.esc(row.phone) + '" autocomplete="off"' + dis + '>' +
               '</div>' +
               '<div data-confirm-wrap hidden style="margin-top:.8rem">' +
                 '<label class="mc-auth-label" for="em_phone2_' + row.id + '">' +
                   'Type the new number again</label>' +
                 '<div class="mc-auth-field">' +
                   '<input type="tel" id="em_phone2_' + row.id + '" data-confirm autocomplete="off">' +
                 '</div>' +
                 '<p class="mc-ed-error" data-confirm-error hidden></p>' +
               '</div>' +
             '</div>' +

             '<div class="mc-ed-field">' +
               '<div class="mc-ed-label-row">' +
                 '<label class="mc-auth-label" for="em_order_' + row.id + '">Position on the page</label>' +
               '</div>' +
               '<div class="mc-auth-field" style="max-width:9rem">' +
                 '<input type="number" id="em_order_' + row.id + '" data-f="sort_order" ' +
                   'value="' + ed.esc(row.sort_order) + '" min="0" step="1"' + dis + '>' +
               '</div>' +
               '<p class="mc-admin-hint">Lower numbers come first. Ambulance belongs at the top.</p>' +
             '</div>' +

             '<div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;' +
                         'border-top:1px solid var(--mc-border);padding-top:.9rem">' +
               ed.touched(row, names) +
               '<div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap">' +
                 /* Taking a number OFF the page is any editor's to do, at
                    once. Putting one ON it is an admin's. Same asymmetry
                    as every other kind of content, and it matters more
                    here: an editor who has just learned that an ambulance
                    line is dead must not have to find an admin first. */
                 (live
                   ? '<button type="button" class="mc-auth-btn mc-auth-btn--danger" data-publish="archived">' +
                       'Take off the page</button>'
                   : guard.isAdmin()
                     ? '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-publish="published">' +
                         '<i class="bi bi-globe"></i> Publish</button>'
                     : '<span class="mc-ed-waiting"><i class="bi bi-hourglass-split"></i> ' +
                         'An admin publishes this</span>') +
                 (lock ? '' :
                   '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-reset hidden>' +
                     'Undo</button>' +
                   '<button type="button" class="mc-auth-btn" data-save disabled>' +
                     '<i class="bi bi-check-lg"></i> Save this number</button>') +
               '</div>' +
             '</div>' +

           '</div>';
  }

  function draw() {
    if (!rows.length) {
      hostEl.innerHTML =
        '<div class="mc-state mc-state--empty">' +
          '<span class="mc-state-ico"><i class="bi bi-telephone"></i></span>' +
          '<h2>No emergency numbers</h2>' +
          '<p>The table is empty. An admin adds the services; this screen is ' +
             'for correcting the ones that are already there.</p>' +
        '</div>';
      return;
    }
    hostEl.innerHTML = rows.map(cardHtml).join('');
    rows.forEach(wire);
  }

  function cardOf(id) { return hostEl.querySelector('[data-em="' + id + '"]'); }

  /* Wired separately from the rest of the card because a locked card
     has this button and nothing else: no Save, no Undo, no editable
     fields. Taking a number off the page is the one action that is
     always available to whoever is looking at it. */
  function wirePublish(card, row) {
    /* Publishing and unpublishing. Both confirm, and the confirmation
       names the service and the number rather than asking "are you
       sure" — the whole risk on this screen is somebody acting on a row
       they think is a different row.

       There is no button at all when an editor is looking at an
       unpublished row: publishing is an admin's, and the card says so in
       words where the button would have been. */
    var publishBtn = card.querySelector('[data-publish]');

    if (publishBtn) {
      publishBtn.addEventListener('click', function (e) {
        var to = e.currentTarget.getAttribute('data-publish');
        var live = to === 'published';

        ed.confirmDialog({
          title: live
            ? 'Put ' + row.name + ' on the emergency page?'
            : 'Take ' + row.name + ' off the emergency page?',
          body: live
            ? 'Readers will see ' + row.name + ' and dial ' + row.phone + '. Check the ' +
              'number against the service\'s own published one first.'
            : 'Readers will no longer see ' + row.name + ' or its number ' + row.phone + '. ' +
              'The row is kept and can be published again — but until it is, somebody ' +
              'looking for this service on the emergency page will not find it.',
          go: live ? 'Publish it' : 'Take it off',
          danger: !live
        }).then(function (yes) {
          if (!yes) { return; }
          e.currentTarget.disabled = true;

          db.from('emergency_contacts').update({ status: to }).eq('id', row.id).select().single()
            .then(function (res) {
              if (res.error) { throw res.error; }
              var i = rows.indexOf(row);
              rows[i] = res.data;
              card.outerHTML = cardHtml(rows[i]);
              wire(rows[i]);
              ed.message(msgEl, 'ok', rows[i].name +
                (live ? ' is now on the emergency page.' : ' has been taken off the emergency page.'));
            })
            .catch(function (err) {
              e.currentTarget.disabled = false;
              ed.message(msgEl, 'error', ed.describeError(err, 'emergency contacts'));
            });
        });
      });
  }
  }
  function wire(row) {
    var card = cardOf(row.id);
    if (!card) { return; }

    var saveBtn    = card.querySelector('[data-save]');
    var resetBtn   = card.querySelector('[data-reset]');
    var confirmBox = card.querySelector('[data-confirm-wrap]');
    var confirmIn  = card.querySelector('[data-confirm]');
    var confirmErr = card.querySelector('[data-confirm-error]');
    var telLink    = card.querySelector('[data-tel]');
    var phoneIn    = card.querySelector('[data-f="phone"]');

    /* A live number an editor may not correct in place. cardHtml() has
       already disabled the fields and left out Save and Undo, so there
       is nothing here to wire except the button that takes it off the
       page — which is how they make it editable. */
    if (!saveBtn) {
      wirePublish(card, row);
      return;
    }

    function current() {
      var out = {};
      EDITABLE.forEach(function (name) {
        var el = card.querySelector('[data-f="' + name + '"]');
        var v = el.value.trim();
        out[name] = name === 'sort_order' ? (v === '' ? 0 : Number(v)) : (v === '' ? null : v);
      });
      return out;
    }

    function changed() {
      var now = current();
      return EDITABLE.some(function (name) {
        var was = row[name] == null ? null : row[name];
        var is  = now[name];
        if (name === 'sort_order') { return Number(was || 0) !== Number(is || 0); }
        return String(was == null ? '' : was) !== String(is == null ? '' : is);
      });
    }

    function phoneChanged() {
      return phoneIn.value.trim() !== String(row.phone == null ? '' : row.phone).trim();
    }

    function refresh() {
      var dirty = changed();
      resetBtn.hidden = !dirty;

      var needsConfirm = phoneChanged();
      if (confirmBox.hidden === needsConfirm) {
        confirmBox.hidden = !needsConfirm;
        if (!needsConfirm) { confirmIn.value = ''; confirmErr.hidden = true; }
      }

      // What a reader's phone would actually dial, updated as it is
      // typed. A transposed digit is much easier to see here than in a
      // text box, because this is the shape it will be read in.
      if (telLink) {
        var v = phoneIn.value.trim();
        telLink.textContent = v || '—';
        telLink.setAttribute('href', 'tel:' + v);
      }

      var matches = !needsConfirm || confirmIn.value.trim() === phoneIn.value.trim();
      saveBtn.disabled = !dirty || !matches || !phoneIn.value.trim();
    }

    card.addEventListener('input', function () {
      confirmErr.hidden = true;
      refresh();
    });

    confirmIn.addEventListener('blur', function () {
      if (confirmBox.hidden || !confirmIn.value.trim()) { return; }
      var ok = confirmIn.value.trim() === phoneIn.value.trim();
      confirmErr.innerHTML = '<i class="bi bi-exclamation-circle"></i>' +
                             '<span>The two numbers do not match.</span>';
      confirmErr.hidden = ok;
    });


    wirePublish(card, row);

    resetBtn.addEventListener('click', function () {
      EDITABLE.forEach(function (name) {
        card.querySelector('[data-f="' + name + '"]').value = row[name] == null ? '' : row[name];
      });
      confirmIn.value = '';
      refresh();
    });

    saveBtn.addEventListener('click', function () {
      var next = current();

      ed.confirmDialog({
        title: 'Change the ' + row.name + ' number?',
        body: phoneChanged()
          ? 'This is the number readers will see and dial. It goes from ' +
            row.phone + ' to ' + next.phone + '.'
          : 'Saving the wording for ' + row.name + '. The number itself is unchanged.',
        go: 'Save it'
      }).then(function (yes) {
        if (!yes) { return; }
        saveBtn.disabled = true;

        db.from('emergency_contacts').update(next).eq('id', row.id).select().single()
          .then(function (res) {
            if (res.error) { throw res.error; }
            // Re-seat the card on what the database now holds, so the
            // "changed?" comparison is against reality rather than
            // against what we sent.
            var i = rows.indexOf(row);
            rows[i] = res.data;
            return ed.loadNames([res.data.updated_by]).then(function (more) {
              Object.assign(names, more);
              card.outerHTML = cardHtml(rows[i]);
              wire(rows[i]);
              ed.message(msgEl, 'ok', rows[i].name + ' saved.');
            });
          })
          .catch(function (err) {
            saveBtn.disabled = false;
            ed.message(msgEl, 'error', ed.describeError(err, 'emergency contacts'));
          });
      });
    });

    refresh();
  }

  /* ================================================================
     Adding a service
     ----------------------------------------------------------------
     Its own form above the list rather than a blank card inside it, so
     a number somebody is still typing never sits among the live ones and
     cannot be mistaken for one.

     It saves as a draft and says so. Publishing it is a second,
     separate decision made on the card it becomes — which is the same
     two-step every other kind of content on this site goes through, and
     the reason it is safe for one person to do both.
     ================================================================ */

  function openAddForm() {
    addBtn.disabled = true;
    newEl.innerHTML =
      '<div class="mc-admin-card" style="padding:1.25rem 1.35rem;box-shadow:none;' +
             'border-color:var(--mc-primary);margin-bottom:1.4rem">' +
        '<h2 style="font-size:1.05rem;margin-bottom:1.1rem">New service</h2>' +

        '<div class="mc-ed-field">' +
          '<div class="mc-ed-label-row">' +
            '<label class="mc-auth-label" for="new_name">Service</label>' +
            '<span class="mc-ed-req">Required</span>' +
          '</div>' +
          '<div class="mc-auth-field">' +
            '<input type="text" id="new_name" data-n="name" autocomplete="off" ' +
              'placeholder="Poison Control"></div>' +
        '</div>' +

        '<div class="mc-ed-field">' +
          '<div class="mc-ed-label-row">' +
            '<label class="mc-auth-label" for="new_sub">When to call it</label>' +
            '<span class="mc-ed-optional">Optional</span>' +
          '</div>' +
          '<div class="mc-auth-field">' +
            '<textarea id="new_sub" data-n="sub" rows="2" ' +
              'placeholder="Swallowed chemicals, medicine overdose, snake bites."></textarea>' +
          '</div>' +
        '</div>' +

        '<div class="mc-ed-field mc-confirm-field">' +
          '<div class="mc-ed-label-row">' +
            '<label class="mc-auth-label" for="new_phone">Number</label>' +
            '<span class="mc-ed-req">Required</span>' +
          '</div>' +
          '<div class="mc-auth-field">' +
            '<input type="tel" id="new_phone" data-n="phone" autocomplete="off"></div>' +
          '<div style="margin-top:.8rem">' +
            '<label class="mc-auth-label" for="new_phone2">Type the number again</label>' +
            '<div class="mc-auth-field">' +
              '<input type="tel" id="new_phone2" data-n-confirm autocomplete="off"></div>' +
            '<p class="mc-ed-error" data-n-error hidden></p>' +
          '</div>' +
        '</div>' +

        '<div class="mc-ed-field">' +
          '<div class="mc-ed-label-row">' +
            '<label class="mc-auth-label" for="new_order">Position on the page</label>' +
          '</div>' +
          '<div class="mc-auth-field" style="max-width:9rem">' +
            '<input type="number" id="new_order" data-n="sort_order" value="' +
              (rows.length + 1) + '" min="0" step="1"></div>' +
        '</div>' +

        '<p class="mc-admin-hint">It saves as a draft. Nobody outside the team sees it ' +
          'until you publish it from the card it becomes.</p>' +

        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;border-top:1px solid var(--mc-border);' +
                    'padding-top:.9rem">' +
          '<button type="button" class="mc-auth-btn" data-n-save disabled>' +
            '<i class="bi bi-check-lg"></i> Save as a draft</button>' +
          '<button type="button" class="mc-auth-btn mc-auth-btn--ghost" data-n-cancel>Cancel</button>' +
        '</div>' +
      '</div>';

    /* Listeners go on the card, not on #emNew. #emNew outlives every
       form drawn into it, so a listener left there would stack up one
       per open and each stale copy would keep a closure over inputs that
       are no longer in the document. */
    var card      = newEl.firstElementChild;
    var nameIn    = newEl.querySelector('[data-n="name"]');
    var phoneIn   = newEl.querySelector('[data-n="phone"]');
    var confirmIn = newEl.querySelector('[data-n-confirm]');
    var errEl     = newEl.querySelector('[data-n-error]');
    var saveBtn   = newEl.querySelector('[data-n-save]');

    function refresh() {
      var matches = phoneIn.value.trim() !== '' &&
                    confirmIn.value.trim() === phoneIn.value.trim();
      saveBtn.disabled = !nameIn.value.trim() || !matches;
    }

    card.addEventListener('input', function () { errEl.hidden = true; refresh(); });

    confirmIn.addEventListener('blur', function () {
      if (!confirmIn.value.trim()) { return; }
      var ok = confirmIn.value.trim() === phoneIn.value.trim();
      errEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>' +
                        '<span>The two numbers do not match.</span>';
      errEl.hidden = ok;
    });

    newEl.querySelector('[data-n-cancel]').addEventListener('click', closeAddForm);

    saveBtn.addEventListener('click', function () {
      var fresh = {
        name:       nameIn.value.trim(),
        sub:        newEl.querySelector('[data-n="sub"]').value.trim() || null,
        phone:      phoneIn.value.trim(),
        sort_order: Number(newEl.querySelector('[data-n="sort_order"]').value || 0),
        icon:       NEW_ICON,
        status:     'draft',
        // The insert policy checks this against the verified token, so
        // it is required rather than decorative — omitting it is a 403.
        created_by: guard.getUser().id
      };
      saveBtn.disabled = true;

      db.from('emergency_contacts').insert(fresh).select().single()
        .then(function (res) {
          if (res.error) { throw res.error; }
          rows.push(res.data);
          rows.sort(function (a, b) {
            return (a.sort_order - b.sort_order) || (a.id - b.id);
          });
          return ed.loadNames([res.data.updated_by]).then(function (more) {
            Object.assign(names, more);
            closeAddForm();
            draw();
            ed.message(msgEl, 'ok',
              fresh.name + ' saved as a draft. It is not on the emergency page until ' +
              'you publish it.');
          });
        })
        .catch(function (err) {
          saveBtn.disabled = false;
          ed.message(msgEl, 'error', ed.describeError(err, 'emergency contacts'));
        });
    });

    nameIn.focus();
  }

  function closeAddForm() {
    newEl.innerHTML = '';
    addBtn.disabled = false;
    addBtn.focus();
  }

  if (addBtn) { addBtn.addEventListener('click', openAddForm); }

  guard.ready.then(function () {
    db.from('emergency_contacts').select('*').order('sort_order', { ascending: true }).order('id')
      .then(function (res) {
        if (res.error) { throw res.error; }
        rows = res.data || [];
        return ed.loadNames(rows.map(function (r) { return r.updated_by; }));
      })
      .then(function (found) { names = found; draw(); })
      .catch(function (err) {
        hostEl.innerHTML =
          '<div class="mc-state mc-state--error">' +
            '<span class="mc-state-ico"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<h2>Could not load the emergency numbers</h2>' +
            '<p>' + ed.esc(ed.describeError(err, 'emergency contacts')) + '</p>' +
          '</div>';
      });
  });

})();
