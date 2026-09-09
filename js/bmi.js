
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

  var selectedGender = 'male';

  
  function bi(en, my) {
    return '<span class="mc-en">' + en + '</span><span class="mc-my">' + my + '</span>';
  }

  
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

  
  function syncHeightInputs() {
    var ft = heightUnit.value === 'ft';
    ftInContainer.style.display = ft ? 'flex' : 'none';
    singleWrap.style.display    = ft ? 'none' : 'block';
  }
  heightUnit.addEventListener('change', syncHeightInputs);
  syncHeightInputs();

  
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

  
  function heightInMetres() {
    if (heightUnit.value === 'ft') {
      var feet   = parseFloat(el('feetInput').value) || 0;
      var inches = parseFloat(el('inchInput').value) || 0;
      if (feet <= 0 && inches <= 0) { return null; }
      return ((feet * 12) + inches) * 0.0254;
    }
    var v = parseFloat(el('heightSingle').value);
    if (isNaN(v) || v <= 0) { return null; }
    return heightUnit.value === 'cm' ? v / 100 : v;
  }

  function weightInKg() {
    var v = parseFloat(el('weight').value);
    if (isNaN(v) || v <= 0) { return null; }
    return el('weightUnit').value === 'lbs' ? v * 0.453592 : v;
  }

  
  function classify(bmi) {
    if (bmi < 18.5) {
      return { key: 'under',  css: 'mc-bmi--under',  en: 'Underweight',  my: 'ဝိတ်နည်းပါသည်' };
    }
    if (bmi < 25) {
      return { key: 'normal', css: 'mc-bmi--normal', en: 'Normal weight', my: 'ပုံမှန်' };
    }
    if (bmi < 30) {
      return { key: 'over',   css: 'mc-bmi--over',   en: 'Overweight',    my: 'ဝိတ်လွန်နေပါသည်' };
    }
    return { key: 'obese',    css: 'mc-bmi--obese',  en: 'Obese',         my: 'အလွန်အမင်း ဝိတ်လွန်နေပါသည်' };
  }

  var ADVICE = {
    under: {
      icon: 'bi-arrow-up-circle',
      title: { en: 'What you can do', my: 'သင် ဘာလုပ်နိုင်သလဲ' },
      points: [
        { en: 'Build weight up slowly with nourishing food — rice, beans, eggs, nuts, milk and fish — rather than sugary or fried snacks.',
          my: 'သကြားများသော သို့မဟုတ် အဆီကြော်ထားသော အစားအစာများထက် အာဟာရပြည့်ဝသည့် ထမင်း၊ ပဲ၊ ကြက်ဥ၊ အခွံမာသီး၊ နို့နှင့် ငါးတို့ဖြင့် ကိုယ်အလေးချိန်ကို တဖြည်းဖြည်း တိုးပါ။' },
        { en: 'If a full plate feels like too much, eat smaller meals more often through the day.',
          my: 'တစ်ကြိမ်တည်း များများ မစားနိုင်ပါက တစ်နေ့တာအတွင်း အနည်းငယ်စီ အကြိမ်များများ စားပါ။' },
        { en: 'Keep moving. Gentle strength work helps the weight you gain go on as muscle.',
          my: 'ဆက်လက် လှုပ်ရှားပါ။ သွက်လက်သော ကြွက်သားလေ့ကျင့်ခန်းများက တိုးလာသော ကိုယ်အလေးချိန်ကို ကြွက်သားအဖြစ် ဖြစ်စေပါသည်။' },
        { en: 'Losing weight without trying, or staying underweight, is worth a doctor’s visit.',
          my: 'အလိုအလျောက် ကိုယ်အလေးချိန် ကျဆင်းခြင်း သို့မဟုတ် ဝိတ်နည်းနေဆဲဖြစ်ပါက ဆရာဝန်နှင့် ပြသသင့်ပါသည်။' }
      ]
    },
    normal: {
      icon: 'bi-check-circle',
      title: { en: 'Keeping it there', my: 'ဤအတိုင်း ထိန်းသိမ်းရန်' },
      points: [
        { en: 'You are in the healthy range. What you are already doing is working.',
          my: 'သင်သည် ကျန်းမာသော အဆင့်တွင် ရှိနေပါသည်။ လက်ရှိ လုပ်ဆောင်နေမှုများက အလုပ်ဖြစ်နေပါသည်။' },
        { en: 'Aim for about 30 minutes of activity on most days — walking counts.',
          my: 'နေ့စဉ်နီးပါး မိနစ် ၃၀ ခန့် လှုပ်ရှားမှု ပြုလုပ်ပါ — လမ်းလျှောက်ခြင်းလည်း အကျုံးဝင်ပါသည်။' },
        { en: 'Fill half the plate with vegetables and fruit, and keep sugary drinks occasional.',
          my: 'ပန်းကန်၏ တစ်ဝက်ကို ဟင်းသီးဟင်းရွက်နှင့် သစ်သီးများဖြင့် ဖြည့်ပြီး သကြားပါသော အချိုရည်များကို ရံဖန်ရံခါသာ သောက်ပါ။' },
        { en: 'Check your weight now and then rather than every day — it moves naturally.',
          my: 'ကိုယ်အလေးချိန်သည် သဘာဝအလျောက် ပြောင်းလဲတတ်သဖြင့် နေ့တိုင်းမဟုတ်ဘဲ ရံဖန်ရံခါသာ တိုင်းတာပါ။' }
      ]
    },
    over: {
      icon: 'bi-graph-down-arrow',
      title: { en: 'Small changes that help', my: 'အထောက်အကူဖြစ်စေမည့် ပြောင်းလဲမှုငယ်များ' },
      points: [
        { en: 'Steady small changes beat strict diets — they are the ones people keep.',
          my: 'တင်းကျပ်သော အစားလျှော့ခြင်းထက် တဖြည်းဖြည်းချင်း ပြောင်းလဲခြင်းက ပိုမိုရေရှည်ခံပါသည်။' },
        { en: 'Cutting sugary drinks is usually the single easiest change to make.',
          my: 'သကြားပါသော အချိုရည်များ လျှော့ချခြင်းသည် အလွယ်ကူဆုံး ပြောင်းလဲမှု ဖြစ်လေ့ရှိပါသည်။' },
        { en: 'Walk 30 minutes most days, and watch portion sizes rather than banning foods.',
          my: 'နေ့စဉ်နီးပါး မိနစ် ၃၀ လမ်းလျှောက်ပြီး အစားအစာများကို ရှောင်ခြင်းထက် စားသောက်မှု ပမာဏကို ထိန်းပါ။' },
        { en: 'Losing even 5–10% of your weight already improves blood pressure and blood sugar.',
          my: 'ကိုယ်အလေးချိန်၏ ၅–၁၀ ရာခိုင်နှုန်းမျှ လျှော့ချနိုင်ရုံဖြင့်ပင် သွေးပေါင်ချိန်နှင့် သွေးတွင်းသကြားဓာတ် ကောင်းမွန်လာပါသည်။' }
      ]
    },
    obese: {
      icon: 'bi-heart-pulse',
      title: { en: 'Worth talking to a doctor', my: 'ဆရာဝန်နှင့် တိုင်ပင်သင့်ပါသည်' },
      points: [
        { en: 'This range raises the risk of diabetes, high blood pressure and heart disease — all of which are manageable when caught early.',
          my: 'ဤအဆင့်သည် ဆီးချို၊ သွေးတိုးနှင့် နှလုံးရောဂါ ဖြစ်နိုင်ခြေကို မြင့်တက်စေပါသည် — အားလုံးမှာ စောစီးစွာ သိရှိပါက ထိန်းချုပ်နိုင်ပါသည်။' },
        { en: 'Ask a doctor or dietitian for a plan that fits your health and your daily life.',
          my: 'သင့်ကျန်းမာရေးနှင့် နေ့စဉ်ဘဝနှင့် ကိုက်ညီသော အစီအစဉ်တစ်ခုအတွက် ဆရာဝန် သို့မဟုတ် အာဟာရပညာရှင်နှင့် တိုင်ပင်ပါ။' },
        { en: 'Start with movement you can repeat — a daily walk beats an exercise plan you drop in a week.',
          my: 'ဆက်လက်လုပ်ဆောင်နိုင်သော လှုပ်ရှားမှုဖြင့် စတင်ပါ — တစ်ပတ်အတွင်း ရပ်လိုက်ရသော လေ့ကျင့်ခန်းအစီအစဉ်ထက် နေ့စဉ် လမ်းလျှောက်ခြင်းက ပိုကောင်းပါသည်။' },
        { en: 'Cut back on fried food and sugary drinks first; they are the biggest wins for the least effort.',
          my: 'အဆီကြော်များနှင့် သကြားပါသော အချိုရည်များကို ဦးစွာ လျှော့ပါ — အားစိုက်မှု အနည်းဆုံးဖြင့် အကျိုးအများဆုံး ရရှိပါသည်။' }
      ]
    }
  };

  var DISCLAIMER = {
    en: 'BMI is a general guide for adults and does not measure body fat, muscle or overall health. For advice about your weight, speak with a doctor.',
    my: 'BMI သည် အရွယ်ရောက်ပြီးသူများအတွက် အထွေထွေ ညွှန်ကိန်းသာဖြစ်ပြီး အဆီ၊ ကြွက်သား သို့မဟုတ် ကျန်းမာရေး အခြေအနေအလုံးစုံကို မတိုင်းတာပါ။ ကိုယ်အလေးချိန်နှင့်ပတ်သက်၍ ဆရာဝန်နှင့် တိုင်ပင်ပါ။'
  };

  function renderAdvice(band) {
    var box = el('bmiAdvice');
    if (!box) { return; }

    var a = ADVICE[band.key];
    var items = '';
    for (var i = 0; i < a.points.length; i++) {
      items += '<li>' + bi(a.points[i].en, a.points[i].my) + '</li>';
    }

    box.innerHTML =
      '<h3 class="mc-bmi-advice-title"><i class="bi ' + a.icon + '" aria-hidden="true"></i>' +
        bi(a.title.en, a.title.my) +
      '</h3>' +
      '<ul class="mc-bmi-advice-list">' + items + '</ul>' +
      '<p class="mc-bmi-advice-foot"><i class="bi bi-info-circle" aria-hidden="true"></i>' +
        bi(DISCLAIMER.en, DISCLAIMER.my) +
      '</p>';
  }

  function scalePercent(bmi) {
    var pct = ((bmi - 15) / (40 - 15)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  
  function ageFrom(value) {
    if (value === null || value === undefined) { return null; }
    var raw = String(value).trim();
    if (!raw) { return null; }
    if (!/^\d{1,3}$/.test(raw)) { return null; }
    var years = parseInt(raw, 10);
    return years >= 1 && years <= 120 ? years : null;
  }

  
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

    var age = ageFrom(el('age').value);
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


    renderAdvice(band);

    result.className = 'mc-callout mc-callout--info mc-bmi-result ' + band.css;
    result.style.display = 'block';
    result.setAttribute('aria-hidden', 'false');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

})();
