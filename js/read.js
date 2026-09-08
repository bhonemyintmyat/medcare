(function () {
  'use strict';

  var sanitize = window.MedCareSanitize;

  var params = new URLSearchParams(window.location.search);

  var KINDS = {
    disease: {
      table: 'diseases',
      title: 'name',
      titleMy: 'name_my',
      label: 'cat',
      tag: 'tag',
      icon: 'bi-virus',
      backHref: 'common-diseases.html',
      backEn: 'All diseases',
      backMy: 'ရောဂါအားလုံး',
      crumbEn: 'Common diseases',
      crumbMy: 'အဖြစ်များသော ရောဂါများ'
    },
    article: {
      table: 'articles',
      title: 'title',
      titleMy: 'title_my',
      label: 'cat',
      tag: 'cat',
      icon: 'bi-journal-text',
      backHref: 'articles.html',
      backEn: 'All articles',
      backMy: 'ဆောင်းပါးအားလုံး',
      crumbEn: 'Health articles',
      crumbMy: 'ကျန်းမာရေး ဆောင်းပါးများ'
    }
  };

  var kindName = KINDS[params.get('type')] ? params.get('type') : 'article';
  var kind     = KINDS[kindName];
  var id       = params.get('id');

  var stateEl   = document.getElementById('readState');
  var headEl    = document.getElementById('readHead');
  var articleEl = document.getElementById('readArticle');

  function el(id) { return document.getElementById(id); }

  function esc(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bi(en, my) {
    return '<span class="mc-en">' + esc(en) + '</span>' +
           '<span class="mc-my">' + esc(my || en) + '</span>';
  }

  function showState(icon, headingEn, headingMy, bodyEn, bodyMy, linkHref, linkEn, linkMy) {
    articleEl.hidden = true;
    headEl.hidden = true;
    stateEl.innerHTML =
      '<div class="mc-state mc-state--empty" style="margin:2rem 0">' +
        '<span class="mc-state-ico"><i class="bi ' + esc(icon) + '"></i></span>' +
        '<h2>' + bi(headingEn, headingMy) + '</h2>' +
        '<p>' + bi(bodyEn, bodyMy) + '</p>' +
        (linkHref
          ? '<a class="btn btn-mc-outline" href="' + esc(linkHref) + '">' +
              bi(linkEn, linkMy) + '</a>'
          : '') +
      '</div>';
  }

  function notFound() {
    document.title = 'Not found — MedCare';
    showState('bi-file-earmark-x',
      'This page is not here',
      'ဤစာမျက်နှာကို ရှာမတွေ့ပါ',
      'It may have been taken off the site, or the address may be wrong.',
      'ဤစာမျက်နှာကို ဖယ်ရှားထားခြင်း သို့မဟုတ် လိပ်စာမှားယွင်းနေခြင်း ဖြစ်နိုင်ပါသည်။',
      kind.backHref, kind.backEn, kind.backMy);
  }

  function failed() {
    document.title = 'Could not load — MedCare';
    showState('bi-wifi-off',
      'Could not load this page',
      'ဤစာမျက်နှာကို ဖွင့်၍ မရပါ',
      'Check your connection and try again.',
      'အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။',
      kind.backHref, kind.backEn, kind.backMy);
  }

  function siteRelative(href) {
    if (!href) { return null; }
    var v = String(href).trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) { return null; }
    if (v.charAt(0) === '/' || v.indexOf('//') === 0) { return null; }
    if (v.indexOf('..') !== -1) { return null; }
    return /^[a-z0-9._\-\/]+\.html?$/i.test(v) ? v : null;
  }

  function render(row) {
    var titleEn = row[kind.title] || '';
    var titleMy = kind.titleMy ? (row[kind.titleMy] || titleEn) : titleEn;

    document.title = titleEn + ' — MedCare';

    el('readCrumb').innerHTML =
      '<a href="index.html"><i class="bi bi-house"></i> ' + bi('Home', 'ပင်မစာမျက်နှာ') + '</a>' +
      '<i class="bi bi-chevron-right" style="font-size:.7rem"></i>' +
      '<a href="' + esc(kind.backHref) + '">' + bi(kind.crumbEn, kind.crumbMy) + '</a>' +
      '<i class="bi bi-chevron-right" style="font-size:.7rem"></i>' +
      '<span>' + bi(titleEn, titleMy) + '</span>';

    var iconEl = el('readIcon');
    iconEl.className = 'bi ' + (row.icon || kind.icon);

    var tagValue = row[kind.tag];
    if (tagValue) {
      el('readTag').hidden = false;
      el('readTag').textContent = tagValue;
    }
    el('readTitle').innerHTML = bi(titleEn, titleMy);
    headEl.hidden = false;

    var cover = row.cover_image;
    if (cover && sanitize.safeUrl(cover)) {
      el('readCover').setAttribute('src', cover);
      el('readCover').setAttribute('alt', titleEn);
      el('readFigure').hidden = false;
    }

    if (row.byline) {
      el('readBylineName').innerHTML = bi(row.byline, row.byline_my || row.byline);
      el('readByline').hidden = false;
    }

    var bodyEn = sanitize.clean(row.body || '');
    var bodyMy = sanitize.clean(row.body_my || '');

    var onlyOne = (bodyEn && !bodyMy) || (!bodyEn && bodyMy);
    el('readBodyEn').innerHTML = bodyEn || bodyMy;
    el('readBodyMy').innerHTML = bodyMy || bodyEn;

    if (onlyOne) {
      var note = document.createElement('p');
      note.className = 'mc-read-onelang';
      note.innerHTML = bodyMy
        ? '<span class="mc-en"><i class="bi bi-translate"></i> This page has been written in Burmese only.</span>' +
          '<span class="mc-my"></span>'
        : '<span class="mc-my"><i class="bi bi-translate"></i> ဤစာမျက်နှာကို အင်္ဂလိပ်ဘာသာဖြင့်သာ ရေးသားထားပါသည်။</span>' +
          '<span class="mc-en"></span>';
      articleEl.insertBefore(note, el('readBodyEn'));
    }

    var src = row.source_url && sanitize.safeUrl(row.source_url);
    if (src) {
      el('readSource').setAttribute('href', src);
      el('readSource').textContent = src.replace(/^https?:\/\//, '').split('/')[0];
      el('readSourceLine').hidden = false;
    }

    if (row.updated_at) {
      var when = new Date(row.updated_at);
      if (!isNaN(when)) {
        var month = when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        el('readReviewed').innerHTML =
          bi('Last reviewed: ' + month + ' · Reviewed by the MedCare medical editorial team.',
             'နောက်ဆုံး ပြန်လည်သုံးသပ်သည့်ရက် — ' + month + ' · MedCare ဆေးပညာ တည်းဖြတ်အဖွဲ့မှ စိစစ်ပြီး။');
      }
    }

    el('readBack').setAttribute('href', kind.backHref);
    el('readBackText').innerHTML = bi(kind.backEn, kind.backMy);

    stateEl.hidden = true;
    articleEl.hidden = false;

    window.MedCarePage = {
      kind: kindName,
      table: kind.table,
      id: Number(id),
      title: titleEn,
      titleMy: titleMy
    };
    document.dispatchEvent(new CustomEvent('medcare:page-rendered', {
      detail: window.MedCarePage
    }));
  }

  function load() {
    var db = window.supabaseClient;

    if (!sanitize) {

      failed();
      return;
    }
    if (!db) { failed(); return; }

    if (!id || !/^\d+$/.test(String(id))) { notFound(); return; }

    db.from(kind.table).select('*').eq('id', id).maybeSingle()
      .then(function (res) {

        if (res.error) { throw res.error; }

        if (!res.data) { notFound(); return; }

        var row = res.data;
        var hasBody = (row.body && row.body.trim()) || (row.body_my && row.body_my.trim());

        if (!hasBody) {
          var file = siteRelative(row.href);
          if (file) { window.location.replace(file); return; }
          notFound();
          return;
        }

        render(row);
      })
      .catch(function (err) {
        console.error('[MedCare] Could not load this page:', err);
        failed();
      });
  }

  load();

})();
