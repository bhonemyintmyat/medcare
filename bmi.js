
(function () {
  'use strict';

  var form = document.getElementById('bmiForm');
  if (!form) { return; }

  var el = function (id) { return document.getElementById(id); };

  var heightUnit    = el('heightUnit');
  var ftInContainer = el('ftInContainer');
  var singleWrap    = el('singleHeightContainer');
  var msg           = el('bmiMsg');
  var result        = el('bmiResult');

  var selectedGender = 'male';   // collected like the original; not used in the formula

  /* Both languages ship in the markup and CSS reveals the one html[lang]
     selects — the same bi() the article cards use, kept local so this
     file has no dependency on script.js beyond the language bar. */
  function bi(en, my) {
    return '<span class="mc-en">' + en + '</span><span class="mc-my">' + my + '</span>';
  }

  /* ---------- Gender toggle ---------- */
  var genderButtons = document.querySelectorAll('.mc-bmi-gender .mc-chip');
  Array.prototype.forEach.call(genderButtons, function (button) {
    button.addEventListener('click', function () {
      Array.prototype.forEach.call(genderButtons, function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      selectedGender = button.getAttribute('data-gender');
    });
  });

  /* ---------- Height unit switches which inputs show ----------
     Feet-and-inches is two boxes; centimetres and metres are one. */
  function syncHeightInputs() {
    var ft = heightUnit.value === 'ft';
    ftInContainer.style.display = ft ? 'flex' : 'none';
    singleWrap.style.display    = ft ? 'none' : 'block';
  }
  heightUnit.addEventListener('change', syncHeightInputs);
  syncHeightInputs();

  /* ---------- Messages ----------
     The original used alert(); the rest of this site answers a bad field
     with an inline line under the form, so this does too. */
  function showError(en, my) {
    if (!msg) { return; }
    msg.innerHTML = bi(en, my);
    msg.className = 'mc-auth-msg mc-auth-msg--error';
    msg.style.display = 'block';
  }
  function clearError() {
    if (!msg) { return; }
    msg.style.display = 'none';
    msg.innerHTML = '';
  }

  /* ---------- Height and weight in metric ---------- */
  function heightInMetres() {
    if (heightUnit.value === 'ft') {
      var feet   = parseFloat(el('feetInput').value) || 0;
      var inches = parseFloat(el('inchInput').value) || 0;
      if (feet <= 0 && inches <= 0) { return null; }
      return ((feet * 12) + inches) * 0.0254;
    }
    var v = parseFloat(el('heightSingle').value);
    if (isNaN(v) || v <= 0) { return null; }
    return heightUnit.value === 'cm' ? v / 100 : v;   // 'cm' or 'm'
  }

  function weightInKg() {
    var v = parseFloat(el('weight').value);
    if (isNaN(v) || v <= 0) { return null; }
    return el('weightUnit').value === 'lbs' ? v * 0.453592 : v;
  }

  /* ---------- Naming the band ----------
     Standard adult cut-offs, tidied so the boundaries meet with no gap
     the original left between 24.9/25 and 29.9/30. `pos` is where the
     reading sits on the 15–40 scale, as a percentage, for the marker. */
  function classify(bmi) {
    if (bmi < 18.5) {
      return { css: 'mc-bmi--under',  en: 'Underweight',  my: 'ဝိတ်နည်းပါသည်' };
    }
    if (bmi < 25) {
      return { css: 'mc-bmi--normal', en: 'Normal weight', my: 'ပုံမှန်' };
    }
    if (bmi < 30) {
      return { css: 'mc-bmi--over',   en: 'Overweight',    my: 'ဝိတ်လွန်နေပါသည်' };
    }
    return { css: 'mc-bmi--obese',    en: 'Obese',         my: 'အလွန်အမင်း ဝိတ်လွန်နေပါသည်' };
  }

  function scalePercent(bmi) {
    var pct = ((bmi - 15) / (40 - 15)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /* Whole years from a date of birth, or null. The field is optional and
     does not enter the formula — it only lets the result note whether the
     adult BMI bands apply to this reader. */
  function ageFrom(dob) {
    if (!dob) { return null; }
    var d = new Date(dob);
    if (isNaN(d.getTime())) { return null; }
    var now = new Date();
    if (d > now) { return null; }
    var years = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) { years--; }
    return years >= 0 && years < 130 ? years : null;
  }

  /* ---------- Submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var h = heightInMetres();
    if (h === null) {
      showError('Please enter your height correctly.', 'အရပ်အမြင့်ကို မှန်ကန်စွာ ထည့်သွင်းပေးပါ။');
      return;
    }
    var w = weightInKg();
    if (w === null) {
      showError('Please enter your weight correctly.', 'ကိုယ်အလေးချိန်ကို မှန်ကန်စွာ ထည့်သွင်းပေးပါ။');
      return;
    }

    var bmi = w / (h * h);
    var band = classify(bmi);

    el('bmiNumber').textContent = bmi.toFixed(1);
    el('bmiCategory').innerHTML = bi(band.en, band.my);
    el('bmiMarker').style.left = scalePercent(bmi) + '%';

    var age = ageFrom(el('dob').value);
    var ageEl = el('bmiAge');
    if (age !== null) {
      ageEl.innerHTML = bi('Age: ' + age, 'အသက်: ' + age + ' နှစ်') +
        (age < 20
          ? ' — ' + bi('these bands are for adults; a doctor reads a young person’s BMI against age.',
                       'ဤအဆင့်များသည် အရွယ်ရောက်ပြီးသူများအတွက်ဖြစ်ပြီး ငယ်ရွယ်သူ၏ BMI ကို ဆရာဝန်က အသက်နှင့်တွဲဖတ်ပါသည်။')
          : '');
      ageEl.style.display = 'block';
    } else {
      ageEl.style.display = 'none';
    }

    // The accent colour lives on the result box; swap the band class and
    // keep the base classes.
    result.className = 'mc-callout mc-callout--info mc-bmi-result ' + band.css;
    result.style.display = 'block';
    result.setAttribute('aria-hidden', 'false');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

})();
