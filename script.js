(function () {
  'use strict';

  /* ---------- Data ---------- */
  var diseases = [
    { name: 'Hypertension', icon: 'bi-heart-pulse', tag: 'Chronic', cat: 'chronic', href: 'hypertension.html', desc: 'High blood pressure often has no symptoms but raises the risk of stroke and heart disease over time.' },
    { name: 'Diabetes', icon: 'bi-droplet-half', tag: 'Chronic', cat: 'chronic', desc: 'A long-term condition where blood sugar levels are too high, manageable with diet, exercise, and medication.' },
    { name: 'Asthma', icon: 'bi-lungs', tag: 'Respiratory', cat: 'respiratory', desc: 'Airways narrow and swell, causing wheezing and shortness of breath — usually controlled with inhalers.' },
    { name: 'Dengue fever', icon: 'bi-bug', tag: 'Infectious', cat: 'infectious', desc: 'A mosquito-borne viral illness common in the rainy season, causing high fever, body aches, and rash.' },
    { name: 'Tuberculosis (TB)', icon: 'bi-clipboard2-pulse', tag: 'Infectious', cat: 'infectious respiratory', desc: 'A bacterial infection mainly affecting the lungs, treatable with a full course of antibiotics.' },
    { name: 'Malaria', icon: 'bi-thermometer-half', tag: 'Infectious', cat: 'infectious', desc: 'A mosquito-borne parasitic disease that causes cyclic fever and chills; preventable with nets and repellents.' },
    { name: 'Hepatitis B', icon: 'bi-shield-plus', tag: 'Infectious', cat: 'infectious', desc: 'A liver infection that can become long-term; a safe vaccine prevents it and testing catches it early.' },
    { name: 'Coronary heart disease', icon: 'bi-heart', tag: 'Chronic', cat: 'chronic', desc: 'Narrowed arteries reduce blood flow to the heart and can cause chest pain or a heart attack.' },
    { name: 'Stroke', icon: 'bi-brain', tag: 'Chronic', cat: 'chronic', desc: 'A sudden interruption of blood to the brain — act fast; call an ambulance if you notice F.A.S.T. signs.' },
    { name: 'Anemia', icon: 'bi-droplet', tag: 'Chronic', cat: 'chronic maternal', desc: 'Low red blood cell counts cause fatigue and weakness; iron-rich foods and supplements often help.' },
    { name: 'Typhoid fever', icon: 'bi-cup-hot', tag: 'Infectious', cat: 'infectious', desc: 'A bacterial infection spread through contaminated food or water — safe hygiene and vaccination help prevent it.' },
    { name: 'Pre-eclampsia', icon: 'bi-person-heart', tag: 'Maternal', cat: 'maternal', desc: 'A pregnancy complication with high blood pressure — regular antenatal check-ups are essential.' }
  ];
  var cats = [
    { id: 'all', label: 'All' },
    { id: 'chronic', label: 'Chronic' },
    { id: 'infectious', label: 'Infectious' },
    { id: 'respiratory', label: 'Respiratory' },
    { id: 'maternal', label: 'Maternal & child' }
  ];
  var hospitals = [
    { name: 'Yangon General Hospital', type: 'general', township: 'Latha', address: 'Bogyoke Aung San Rd, Latha', phone: '01-256112', hours: 'Open 24 hours', er: true },
    { name: 'North Okkalapa General Hospital', type: 'general', township: 'North Okkalapa', address: 'Thudhamma Rd, North Okkalapa', phone: '01-9699277', hours: 'Open 24 hours', er: true },
    { name: 'Yangon Children’s Hospital', type: 'specialist', township: 'Sanchaung', address: 'Halpin Rd, Sanchaung', phone: '01-222807', hours: 'Open 24 hours', er: true },
    { name: 'Central Women’s Hospital', type: 'specialist', township: 'Dagon', address: 'Min Ye Kyaw Swa Rd, Dagon', phone: '01-221015', hours: 'Open 24 hours', er: false },
    { name: 'Grand Hantha International Hospital', type: 'general', township: 'Kamayut', address: 'Pyay Rd, Kamayut', phone: '01-9666141', hours: 'Open 24 hours', er: true },
    { name: 'Pun Hlaing Siloam Hospital', type: 'general', township: 'Hlaing Tharyar', address: 'Pun Hlaing Estate Ave, Hlaing Tharyar', phone: '01-3684323', hours: 'Open 24 hours', er: true },
    { name: 'Yangon Eye, Ear, Nose & Throat Hospital', type: 'specialist', township: 'Lanmadaw', address: 'Lanmadaw St, Lanmadaw', phone: '01-224647', hours: 'Mon–Fri, 8:00–16:00', er: false },
    { name: 'Victoria Hospital', type: 'general', township: 'Kamayut', address: 'Kanbe Rd, Kamayut', phone: '01-9666141', hours: 'Open 24 hours', er: true },
    { name: 'Yankin Children Hospital', type: 'specialist', township: 'Yankin', address: 'Sayarsan Rd, Yankin', phone: '01-578140', hours: 'Open 24 hours', er: true },
    { name: 'Workers’ Hospital (Yangon)', type: 'general', township: 'Yankin', address: 'New University Ave Rd, Yankin', phone: '01-550149', hours: 'Open 24 hours', er: false }
  ];
  var typeMeta = [
    { id: 'general', label: 'General' },
    { id: 'specialist', label: 'Specialist' },
    { id: 'emergency', label: 'Emergency / ER' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function byId(id) { return document.getElementById(id); }
  function param(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  // Townships are needed on the home page (menu) and the hospitals page (select).
  var townValues = hospitals.map(function (h) { return h.township; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();

  /* ---------- Home: image slider ---------- */
  var slider = document.querySelector('.slider');
  if (slider) {
    var slides = slider.querySelectorAll('li');
    if (slides.length) {
      var activeSlide = 0;
      slides[activeSlide].classList.add('active');
      setInterval(function () {
        slides[activeSlide].classList.remove('active');
        activeSlide = (activeSlide + 1) % slides.length;
        slides[activeSlide].classList.add('active');
      }, 3500);
    }
  }

  /* ---------- Common Diseases page ---------- */
  var dGrid = byId('diseaseGrid');
  if (dGrid) {
    var dState = { query: param('q'), category: param('cat') || 'all' };
    var dSearch = byId('diseaseSearch');
    var dChips = byId('diseaseChips');
    var dCount = byId('diseaseCount');
    var dWord = byId('diseaseWord');
    var dEmpty = byId('diseaseEmpty');

    if (dSearch) { dSearch.value = dState.query; }

    cats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mc-chip';
      b.textContent = c.label;
      b.setAttribute('data-cat', c.id);
      b.addEventListener('click', function () { dState.category = c.id; renderDiseases(); });
      dChips.appendChild(b);
    });

    var renderDiseases = function () {
      var q = dState.query.trim().toLowerCase();
      var cat = dState.category;
      var filtered = diseases.filter(function (d) {
        var hay = (d.name + ' ' + d.desc).toLowerCase();
        var nameMatch = !q || hay.indexOf(q) !== -1;
        var catMatch = cat === 'all' || d.cat.split(' ').indexOf(cat) !== -1;
        return nameMatch && catMatch;
      });
      dGrid.innerHTML = filtered.map(function (d) {
        return '<div class="col-md-6 col-lg-4">' +
          '<a href="' + (d.href || 'common-diseases.html') + '" class="mc-disease">' +
          '<div class="mc-disease-icon"><i class="bi ' + d.icon + '"></i></div>' +
          '<span class="mc-disease-tag">' + esc(d.tag) + '</span>' +
          '<h3>' + esc(d.name) + '</h3>' +
          '<p>' + esc(d.desc) + '</p>' +
          '<span class="mc-disease-more">Learn more <i class="bi bi-arrow-right"></i></span>' +
          '</a></div>';
      }).join('');
      dCount.textContent = filtered.length;
      dWord.textContent = filtered.length === 1 ? 'condition' : 'conditions';
      dEmpty.style.display = filtered.length === 0 ? 'block' : 'none';
      Array.prototype.forEach.call(dChips.children, function (b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
    };

    if (dSearch) {
      dSearch.addEventListener('input', function (e) { dState.query = e.target.value; renderDiseases(); });
    }
    renderDiseases();
  }

  /* ---------- Find Hospitals page ---------- */
  var hList = byId('hospList');
  if (hList) {
    var hState = {
      query: param('q'),
      township: param('town') || 'all',
      types: { general: true, specialist: true, emergency: true }
    };
    var hSearch = byId('hospSearch');
    var hTownship = byId('hospTownship');
    var hTypes = byId('hospTypes');
    var hCount = byId('hospCount');
    var hWord = byId('hospWord');
    var hEmpty = byId('hospEmpty');

    hTownship.innerHTML = '<option value="all">All townships</option>' +
      townValues.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    // Only honor ?town= if it matches a real township.
    if (townValues.indexOf(hState.township) === -1) { hState.township = 'all'; }
    hTownship.value = hState.township;
    if (hSearch) { hSearch.value = hState.query; }

    hTownship.addEventListener('change', function (e) { hState.township = e.target.value; renderHospitals(); });

    typeMeta.forEach(function (tm) {
      var count = tm.id === 'emergency'
        ? hospitals.filter(function (h) { return h.er; }).length
        : hospitals.filter(function (h) { return h.type === tm.id; }).length;
      var label = document.createElement('label');
      label.className = 'mc-check';
      label.innerHTML = '<input type="checkbox" checked><span>' + esc(tm.label) + '</span><span class="cnt">' + count + '</span>';
      var input = label.querySelector('input');
      input.setAttribute('data-type', tm.id);
      input.addEventListener('change', function () { hState.types[tm.id] = input.checked; renderHospitals(); });
      hTypes.appendChild(label);
    });

    var matchesType = function (h) {
      var t = hState.types;
      var baseOK = (h.type === 'general' && t.general) || (h.type === 'specialist' && t.specialist);
      var erOK = t.emergency && h.er;
      return baseOK || erOK;
    };

    var renderHospitals = function () {
      var q = hState.query.trim().toLowerCase();
      var filtered = hospitals.filter(function (h) {
        var townOK = hState.township === 'all' || h.township === hState.township;
        var typeOK = matchesType(h);
        var hay = (h.name + ' ' + h.township + ' ' + h.address).toLowerCase();
        var searchOK = !q || hay.indexOf(q) !== -1;
        return townOK && typeOK && searchOK;
      });
      var typeLabelMap = { general: 'General', specialist: 'Specialist' };
      hList.innerHTML = filtered.map(function (h) {
        var tel = 'tel:' + h.phone.replace(/[^0-9+]/g, '');
        var maps = 'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(h.name + ', ' + h.address + ', Yangon');
        return '<article class="mc-hosp">' +
          '<div class="mc-hosp-top"><div><h3>' + esc(h.name) + '</h3>' +
          '<span class="mc-hosp-type">' + esc(typeLabelMap[h.type] || 'Hospital') + '</span></div>' +
          (h.er ? '<span class="mc-badge-er"><i class="bi bi-plus-circle-fill"></i> ER available</span>' : '') +
          '</div>' +
          '<div class="mc-hosp-meta">' +
          '<div class="mc-hosp-row"><i class="bi bi-geo-alt"></i><span>' + esc(h.township) + ' Township</span></div>' +
          '<div class="mc-hosp-row"><i class="bi bi-signpost-2"></i><span>' + esc(h.address) + '</span></div>' +
          '<div class="mc-hosp-row hours"><i class="bi bi-clock"></i><span class="open">' + esc(h.hours) + '</span></div>' +
          '</div>' +
          '<div class="mc-hosp-actions">' +
          '<a href="' + tel + '" class="mc-call"><i class="bi bi-telephone-fill"></i> ' + esc(h.phone) + '</a>' +
          '<a href="' + maps + '" class="mc-directions" target="_blank" rel="noopener"><i class="bi bi-map"></i> Directions</a>' +
          '</div></article>';
      }).join('');
      hCount.textContent = filtered.length;
      hWord.textContent = filtered.length === 1 ? 'hospital' : 'hospitals';
      hEmpty.style.display = filtered.length === 0 ? 'block' : 'none';
    };

    if (hSearch) {
      hSearch.addEventListener('input', function (e) { hState.query = e.target.value; renderHospitals(); });
    }

    var clearHospitals = function () {
      hState.query = '';
      hState.township = 'all';
      hState.types = { general: true, specialist: true, emergency: true };
      if (hSearch) { hSearch.value = ''; }
      hTownship.value = 'all';
      Array.prototype.forEach.call(hTypes.querySelectorAll('input'), function (i) { i.checked = true; });
      renderHospitals();
    };
    byId('hospClear').addEventListener('click', clearHospitals);
    byId('hospResetBtn').addEventListener('click', clearHospitals);

    renderHospitals();
  }

  /* ---------- Home: search shortcuts (navigate to the real pages) ---------- */
  var heroBtn = byId('heroSearchBtn');
  var heroInput = byId('heroSearch');
  if (heroBtn && heroInput) {
    var goDiseases = function () {
      var v = heroInput.value.trim();
      window.location.href = 'common-diseases.html' + (v ? '?q=' + encodeURIComponent(v) : '');
    };
    heroBtn.addEventListener('click', goDiseases);
    heroInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { goDiseases(); }
    });
  }

  var subGo = byId('subheaderGo');
  var subInput = byId('subheaderSearch');
  if (subGo && subInput) {
    var goHospitals = function () {
      var v = subInput.value.trim();
      window.location.href = 'hospitals.html' + (v ? '?q=' + encodeURIComponent(v) : '');
    };
    subGo.addEventListener('click', goHospitals);
    subInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { goHospitals(); }
    });
  }

  /* ---------- Home: town dropdown ---------- */
  // Build the menu from the real townships so each entry links to the
  // hospitals page pre-filtered for that town.
  var townMenu = document.querySelector('.mc-town-menu');
  if (townMenu) {
    townMenu.innerHTML = '<li><h6 class="dropdown-header">Filter by town</h6></li>' +
      '<li><a class="dropdown-item" data-town="all" href="hospitals.html"><i class="bi bi-pin-map me-2"></i>All towns</a></li>' +
      townValues.map(function (t) {
        return '<li><a class="dropdown-item" data-town="' + esc(t) + '" href="hospitals.html?town=' + encodeURIComponent(t) + '">' +
          '<i class="bi bi-pin-map me-2"></i>' + esc(t) + '</a></li>';
      }).join('');
  }

  /* ---------- Native dropdown / collapse / accordion (replaces the Bootstrap JS bundle) ---------- */
  // Dropdowns: toggle the Bootstrap `.show` class ourselves; close on outside
  // click or Escape. Bootstrap's CSS still styles/positions the open menu.
  function closeAllDropdowns(except) {
    document.querySelectorAll('.dropdown-menu.show').forEach(function (menu) {
      if (menu === except) { return; }
      menu.classList.remove('show');
      var dd = menu.closest('.dropdown');
      var t = dd && dd.querySelector('[data-bs-toggle="dropdown"]');
      if (t) { t.setAttribute('aria-expanded', 'false'); }
    });
  }
  document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var dd = toggle.closest('.dropdown');
      var menu = dd ? dd.querySelector('.dropdown-menu') : toggle.nextElementSibling;
      if (!menu) { return; }
      var willShow = !menu.classList.contains('show');
      closeAllDropdowns(menu);
      menu.classList.toggle('show', willShow);
      toggle.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function () { closeAllDropdowns(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAllDropdowns(null); }
  });

  // Collapse (navbar toggler) + accordion. `data-bs-parent` gives the accordion
  // its one-open-at-a-time behavior.
  document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.querySelector(toggle.getAttribute('data-bs-target') || '');
      if (!target) { return; }
      var willShow = !target.classList.contains('show');
      // In Bootstrap markup data-bs-parent sits on the target collapse, not the toggle.
      var parentSel = target.getAttribute('data-bs-parent') || toggle.getAttribute('data-bs-parent');
      if (parentSel && willShow) {
        var parent = document.querySelector(parentSel);
        if (parent) {
          parent.querySelectorAll('.collapse.show').forEach(function (c) {
            if (c === target) { return; }
            c.classList.remove('show');
            var sib = parent.querySelector('[data-bs-target="#' + c.id + '"]');
            if (sib) { sib.classList.add('collapsed'); sib.setAttribute('aria-expanded', 'false'); }
          });
        }
      }
      target.classList.toggle('show', willShow);
      toggle.classList.toggle('collapsed', !willShow);
      toggle.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    });
  });
})();
