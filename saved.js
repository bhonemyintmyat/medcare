/* ============================================================
   MedCare — the reader's "Saved" page (saved.html)

   Load after supabase.js, auth.js and bookmarks.js:

     <script src="supabase.js" defer></script>
     <script src="auth.js" defer></script>
     <script src="bookmarks.js" defer></script>
     <script src="script.js" defer></script>
     <script src="saved.js" defer></script>

   Everything a person has saved, newest first, each with a way back to it
   and a way to un-save it. The un-save button is the very same
   <button data-bm> bookmarks.js draws everywhere else, so it is already
   wired — this file only has to remove the card once its row is gone.

   PRIVACY. This reads `bookmarks`, whose select policy returns only the
   signed-in reader's own rows; the embedded content comes back through
   the public "published" policies on each table. Staff have no policy
   here and see nothing. A signed-out visitor is shown a sign-in prompt,
   not an empty list — there is nothing to list, and the database would
   refuse the read anyway.
   ============================================================ */

(function () {
  'use strict';

  var db   = window.supabaseClient;
  var auth = window.MedCareAuth;

  var listEl   = document.getElementById('savedList');
  var emptyEl  = document.getElementById('savedEmpty');
  var authEl   = document.getElementById('savedSignedOut');
  var loadEl   = document.getElementById('savedLoading');
  var countEl  = document.getElementById('savedCount');
  var wordEl   = document.getElementById('savedWord');
  if (!listEl) { return; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function show(el, on) { if (el) { el.style.display = on ? '' : 'none'; } }

  /* How each kind of saved thing is drawn: its icon, the word on its
     badge, and where "Open" goes. Diseases and articles have a page of
     their own — read.html when the row carries a body, the hand-written
     file otherwise, the same rule pageHref() uses on the listings.
     Hospitals and pharmacies have no detail page, so "Open" drops the
     reader onto the directory with the name already in the search box. */
  var KINDS = {
    disease: {
      rel: 'diseases', icon: 'bi-virus', badge: 'Disease',
      title: function (r) { return { en: r.name, my: r.name_my || r.name }; },
      meta:  function (r) { return { en: r.desc || '', my: r.desc_my || r.desc || '' }; },
      open:  function (r) { return contentHref('disease', r, 'common-diseases.html'); }
    },
    article: {
      rel: 'articles', icon: 'bi-journal-text', badge: 'Article',
      title: function (r) { return { en: r.title, my: r.title_my || r.title }; },
      meta:  function (r) { return { en: r.excerpt || '', my: r.excerpt_my || r.excerpt || '' }; },
      open:  function (r) { return contentHref('article', r, 'articles.html'); }
    },
    hospital: {
      rel: 'hospitals', icon: 'bi-hospital', badge: 'Hospital',
      title: function (r) { return { en: r.name, my: r.name }; },
      meta:  function (r) { return { en: (r.township ? r.township + ' Township' : '') + (r.address ? ' · ' + r.address : ''), my: null }; },
      open:  function (r) { return 'hospitals.html?q=' + encodeURIComponent(r.name || ''); }
    },
    pharmacy: {
      rel: 'pharmacies', icon: 'bi-capsule', badge: 'Pharmacy',
      title: function (r) { return { en: r.name, my: r.name }; },
      meta:  function (r) { return { en: (r.township ? r.township + ' Township' : '') + (r.address ? ' · ' + r.address : ''), my: null }; },
      open:  function (r) { return 'pharmacy.html?q=' + encodeURIComponent(r.name || ''); }
    }
  };

  function contentHref(kind, row, fallback) {
    var hasBody = (row.body && String(row.body).trim()) ||
                  (row.body_my && String(row.body_my).trim());
    if (hasBody && row.id != null) {
      return 'read.html?type=' + kind + '&id=' + encodeURIComponent(row.id);
    }
    return esc(row.href || fallback);
  }

  function bilingual(pair) {
    if (!pair) { return ''; }
    if (pair.my == null) { return esc(pair.en); }
    return '<span class="mc-en">' + esc(pair.en) + '</span>' +
           '<span class="mc-my">' + esc(pair.my) + '</span>';
  }

  /* One bookmark row -> one card, or '' if the item behind it can no
     longer be read (archived, or hidden by a policy). The embedded
     resource is named after its table, so exactly one of these is set. */
  function cardHtml(row) {
    var kind = null, item = null;
    for (var k in KINDS) {
      if (KINDS.hasOwnProperty(k) && row[KINDS[k].rel]) { kind = k; item = row[KINDS[k].rel]; break; }
    }
    if (!kind || !item) { return ''; }
    var spec = KINDS[kind];
    var title = spec.title(item);
    var meta  = spec.meta(item);
    var save  = window.MedCareBookmarks
      ? window.MedCareBookmarks.button(kind, item.id, { variant: 'inline' }) : '';

    return '<article class="mc-saved-card" data-kind="' + esc(kind) + '" data-id="' + esc(item.id) + '">' +
      '<span class="mc-saved-ico"><i class="bi ' + spec.icon + '"></i></span>' +
      '<div class="mc-saved-body">' +
        '<span class="mc-saved-type">' + esc(spec.badge) + '</span>' +
        '<h3><a href="' + spec.open(item) + '">' + bilingual(title) + '</a></h3>' +
        (meta && meta.en ? '<p>' + bilingual(meta) + '</p>' : '') +
      '</div>' +
      '<div class="mc-saved-actions">' +
        '<a class="mc-directions mc-saved-open" href="' + spec.open(item) + '">' +
          '<i class="bi bi-box-arrow-up-right"></i> Open</a>' +
        save +
      '</div>' +
    '</article>';
  }

  function render(rows) {
    var cards = [];
    (rows || []).forEach(function (r) {
      var html = cardHtml(r);
      if (html) { cards.push(html); }
    });

    show(loadEl, false);
    show(authEl, false);

    if (!cards.length) {
      listEl.innerHTML = '';
      show(listEl, false);
      show(emptyEl, true);
      if (countEl) { countEl.textContent = '0'; }
      if (wordEl) { wordEl.textContent = 'items'; }
      return;
    }

    listEl.innerHTML = cards.join('');
    show(listEl, true);
    show(emptyEl, false);
    if (countEl) { countEl.textContent = String(cards.length); }
    if (wordEl) { wordEl.textContent = cards.length === 1 ? 'item' : 'items'; }
  }

  function load() {
    show(loadEl, true);
    show(listEl, false);
    show(emptyEl, false);
    show(authEl, false);

    db.from('bookmarks')
      .select(
        'id,created_at,' +
        'diseases(id,name,name_my,desc,desc_my,icon,tag,href,body,body_my),' +
        'articles(id,title,title_my,excerpt,excerpt_my,href,thumb,body,body_my),' +
        'hospitals(id,name,township,address,phone,type),' +
        'pharmacies(id,name,township,address,phone,type)')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { throw res.error; }
        render(res.data || []);
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load saved items:', err);
        show(loadEl, false);
        show(listEl, false);
        show(emptyEl, true);
      });
  }

  function signedOut() {
    show(loadEl, false);
    show(listEl, false);
    show(emptyEl, false);
    show(authEl, true);
  }

  /* Un-saving happens through the same button as everywhere else;
     bookmarks.js does the delete and announces it. When the item on a
     card is no longer saved, the card has served its purpose and goes —
     and if it was the last one, the empty state takes over. */
  document.addEventListener('medcare:bookmarks-changed', function () {
    if (!window.MedCareBookmarks) { return; }
    var cards = listEl.querySelectorAll('.mc-saved-card');
    var remaining = 0;
    Array.prototype.forEach.call(cards, function (card) {
      var kind = card.getAttribute('data-kind');
      var id   = card.getAttribute('data-id');
      if (!window.MedCareBookmarks.isSaved(kind, id)) {
        card.parentNode.removeChild(card);
      } else {
        remaining++;
      }
    });
    if (!remaining && listEl.querySelectorAll('.mc-saved-card').length === 0) {
      show(listEl, false);
      show(emptyEl, true);
      if (countEl) { countEl.textContent = '0'; }
      if (wordEl) { wordEl.textContent = 'items'; }
    } else if (countEl) {
      var n = listEl.querySelectorAll('.mc-saved-card').length;
      countEl.textContent = String(n);
      if (wordEl) { wordEl.textContent = n === 1 ? 'item' : 'items'; }
    }
  });

  if (!db || !auth) { signedOut(); return; }
  auth.ready.then(function () {
    if (auth.isSignedIn()) { load(); } else { signedOut(); }
  });

})();
