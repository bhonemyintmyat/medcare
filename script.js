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
    { name: 'Workers’ Hospital (Yangon)', type: 'general', township: 'Yankin', address: 'New University Ave Rd, Yankin', phone: '01-550149', hours: 'Open 24 hours', er: false },
    {
    name: 'Hlaing Tharyar General Hospital',
    type: 'general',
    township: 'Hlaing Tharyar',
    address: 'Corner of Yangon-Pathein Road & Kyansittha Road, Ward       3, Hlaing Tharyar Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Victoria Hospital - Hlaing Tharyar',
    type: 'general',
    township: 'Hlaing Tharyar',
    address: 'Yangon-Pathein Road (Near FMI City), Hlaing Tharyar Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Asia Royal Clinic - Hlaing Tharyar',
    type: 'clinic',
    township: 'Hlaing Tharyar',
    address: 'Yangon-Pathein Road, Hlaing Tharyar Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'Workers\' Hospital - Hlaing Tharyar',
    type: 'general',
    township: 'Hlaing Tharyar',
    address: 'Industrial Zone Main Road, Hlaing Tharyar Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
	{
    name: 'Inya Lake Hospital & Medical Center / International SOS Clinic',
    type: 'specialist',
    township: 'Hlaing',
    address: 'No. 37, Kaba Aye Pagoda Road (Inya Lake Hotel Compound), Hlaing Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Kan Thar Yar Specialist Hospital',
    type: 'specialist',
    township: 'Hlaing',
    address: 'No. 87, Pyay Road (6 half Mile), Hlaing Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Insein General Hospital',
    type: 'general',
    township: 'Insein',
    address: 'Mingyi Road, Insein Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Aung San TB & Chest Hospital',
    type: 'specialist',
    township: 'Insein',
    address: 'Aung San Ward, Insein Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'Insein Maternal and Child Health Center',
    type: 'specialist',
    township: 'Insein',
    address: 'Near Mingyi Road, Insein Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Grand Hantha International Hospital',
    type: 'general',
    township: 'Kamayut',
    address: 'Corner of Nar Nat Taw Street and Lower Kyimyindaing Road, Kamayut Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'University Hospital / Yangon University Medical Centre',
    type: 'general',
    township: 'Kamayut',
    address: 'Yangon University Campus (Near University Avenue Road), Kamayut Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Yangon Central Women\'s Hospital',
    type: 'specialist',
    township: 'Lanmadaw',
    address: 'Min Ye Kyaw Swa Road, Lanmadaw Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Shwe La Min Hospital - Lanmadaw Branch',
    type: 'general',
    township: 'Lanmadaw',
    address: 'No. 15/19, Zawgyi Street, Lanmadaw Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Yangon General Hospital - YGH',
    type: 'general',
    township: 'Lanmadaw',
    address: 'Bogyoke Aung San Road (Latha/Lanmadaw Township Border), Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Yangon ENT Hospital',
    type: 'specialist',
    township: 'Lanmadaw',
    address: 'Corner of Ahlone Road and Min Ye Kyaw Swa Road (Lanmadaw/Ahlone Township Border), Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
	{
    name: 'Yangon General Hospital - YGH',
    type: 'general',
    township: 'Latha',
    address: 'Bogyoke Aung San Road, Latha Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Muslim Free Hospital',
    type: 'general',
    township: 'Pabedan',
    address: 'Maha Bandula Road, Pabedan Township (Near Latha Township), Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'OEC Polyclinic & Diagnostic Center',
    type: 'clinic',
    township: 'Latha',
    address: 'No. 91/93, Corner of Anawrahta Road and 20th Street, Latha Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'Win Ziwaka Diagnostic Center',
    type: 'clinic',
    township: 'Latha',
    address: 'No. 46, Bo Ywe Street (Lower Block), Latha Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Victoria Hospital',
    type: 'general',
    township: 'Mayangone',
    address: 'No. 68, Taw Win Road, 9th Ward, Mayangone Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Thamine General Hospital',
    type: 'general',
    township: 'Mayangone',
    address: 'No. 12/A, Yangon-Insein Road, Thamine Junction, Mayangone Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'Parami General Hospital',
    type: 'specialist',
    township: 'Mayangone',
    address: 'No. 60, Parami Road, Mayangone Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Kan Thar Yar Hospital',
    type: 'specialist',
    township: 'Mayangone',
    address: 'No. 87, Pyay Road (Near Inya Lake), Mayangone Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
	{
    name: 'Mingaladon Township Hospital',
    type: 'general',
    township: 'Mingaladon',
    address: 'Khayoung Street, near Pyay Road, Mingaladon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'No. 1 Defence Services General Hospital (1000 Bedded)',
    type: 'general',
    township: 'Mingaladon',
    address: 'Pyay Road, Mingaladon Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'No. 1 Defence Services Orthopaedic Hospital (500 Bedded)',
    type: 'specialist',
    township: 'Mingaladon',
    address: 'Pyay Road (Near No. 1 Military Hospital), Mingaladon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'No. 2 Defence Services General Hospital (500 Bedded)',
    type: 'general',
    township: 'Mingaladon',
    address: 'Pyay Road, Mingaladon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Pinlon Hospital',
    type: 'specialist',
    township: 'North Dagon',
    address: 'No. 21, Corner of Pinlon Main Road and Sayar San Road, 26th Ward, North Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'North Dagon General Hospital / Township Hospital',
    type: 'general',
    township: 'North Dagon',
    address: 'Bayint Naung Road, 32nd Ward, North Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'OSC Hospital - North Dagon / Dagon Seikkan Branch',
    type: 'specialist',
    township: 'North Dagon',
    address: 'Pyidaungsu Main Road, North Dagon / Dagon Seikkan Border, North Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
},
{
    name: 'North Okkalapa General and Teaching Hospital',
    type: 'general',
    township: 'North Okkalapa',
    address: 'Corner of Khemarthi Road and Thudhamma Road, (Kha) Ward, North Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'OSC Hospital - North Okkalapa',
    type: 'specialist',
    township: 'North Okkalapa',
    address: 'Thudhamma Main Road, (Sa) Ward, North Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Mel Hospital',
    type: 'specialist',
    township: 'North Okkalapa',
    address: 'Thudhamma Road, North Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Asia Royal Hospital',
    type: 'specialist',
    township: 'Sanchaung',
    address: 'No. 14, Baho Road, Sanchaung Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Sakura Hospital',
    type: 'general',
    township: 'Sanchaung',
    address: 'No. 21/23, Shin Saw Pu Road, Sanchaung Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Thukha Mingalar Medical & Diagnostic Center (Center 1)',
    type: 'clinic',
    township: 'Sanchaung',
    address: 'No. 147, Kyundaw Street, Myaytani Ward, Sanchaung Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'heal by Pun Hlaing Clinic - Sanchaung',
    type: 'clinic',
    township: 'Sanchaung',
    address: 'No. 31, Pyapon Street, Sanchaung Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'Yangon Children\'s Hospital',
    type: 'specialist',
    township: 'Sanchaung',
    address: 'Corner of Pyay Road and Ahlone Road, Sanchaung Township (Kamayut/Sanchaung Border), Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
	{
    name: 'Shwe Pyi Thar Township Hospital',
    type: 'general',
    township: 'Shwe Pyi Thar',
    address: 'No. 10 Ward, Shwe Pyi Thar Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'Workers\' Hospital - Shwe Pyi Thar',
    type: 'general',
    township: 'Shwe Pyi Thar',
    address: 'Industrial Zone Main Road, Shwe Pyi Thar Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
	{
    name: 'South Dagon Township Hospital',
    type: 'general',
    township: 'South Dagon',
    address: 'No. 57 Ward, Near Hlaing Zay Yar Road / Myawaddy Mingyi Road, South Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'OSC Hospital - South Dagon / Dagon Seikkan Branch',
    type: 'specialist',
    township: 'South Dagon',
    address: 'Pyidaungsu Main Road, No. 104 Ward (South Dagon / Dagon Seikkan Border), South Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Arogya Specialist Clinic & Medical Center',
    type: 'clinic',
    township: 'South Dagon',
    address: 'No. 56 Ward, Anawrahta Main Road, South Dagon Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'South Okkalapa Women and Children Hospital',
    type: 'specialist',
    township: 'South Okkalapa',
    address: 'Corner of Thamin Ba Yan Road and Thumingalar Road, 6th Ward, South Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Aryu International Hospital',
    type: 'general',
    township: 'South Okkalapa',
    address: 'No. 40, Kyaik Ka San Road (Near Thuwunna Roundabout), 1st Ward, South Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'SSC Specialist Hospital - South Okkalapa Branch',
    type: 'specialist',
    township: 'South Okkalapa',
    address: 'Thumingalar Main Road, 7th Ward, South Okkalapa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
	{
    name: 'Tamwe Township Hospital',
    type: 'general',
    township: 'Tamwe',
    address: 'Kyaikkasan Road, Tamwe Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'Aryu General Hospital',
    type: 'general',
    township: 'Tamwe',
    address: 'No. 137, Kyaikkasan Road, Tamwe Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Aslanta Hospital / SSC Hospital',
    type: 'specialist',
    township: 'Tamwe',
    address: 'No. 149, Kyaikkasan Road, Tamwe Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'No. 1 Workers\' Hospital - Tamwe',
    type: 'general',
    township: 'Tamwe',
    address: 'Kyaikkasan Road, Corner of Natmauk Road, Tamwe Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Thaketa General Hospital',
    type: 'general',
    township: 'Thaketa',
    address: '7/West Ward, Near Ayeyarwun Road, Thaketa Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: true
  },
  {
    name: 'OSC Hospital',
    type: 'specialist',
    township: 'Thaketa',
    address: 'No. 59/60, Ayeyarwun Main Road, 7/East Ward, Thaketa Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'SSC Women and Children Hospital - Thaketa Branch',
    type: 'specialist',
    township: 'Thaketa',
    address: 'Ayeyarwun Road, Thaketa Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
	{
    name: 'Thingangyun San Pya General Hospital',
    type: 'general',
    township: 'Thingangyun',
    address: 'Hlaing Zay Yar Road, 2nd Ward, Thingangyun Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'AYA Hospital',
    type: 'specialist',
    township: 'Thingangyun',
    address: 'No. 59/A, Lay Daung Kan Road, 2nd Ward, Thingangyun Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Pinlon Hospital',
    type: 'specialist',
    township: 'Thingangyun',
    address: 'Corner of Pinlon Road and Sayar San Road, 26th Ward (North Dagon / Thingangyun Border), Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Yankin Children\'s Hospital',
    type: 'specialist',
    township: 'Yankin',
    address: 'Kanbe Road, 16th Ward, Yankin Township, Yangon',
    phone: 'N/A',
    hours: 'Open 24 hours',
    er: true
  },
  {
    name: 'Specialist Hospital - Yankin / Yankin Chest Hospital',
    type: 'specialist',
    township: 'Yankin',
    address: 'Yankin Road, 1st Ward, Yankin Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  },
  {
    name: 'Melia Clinic & Specialist Clinics',
    type: 'clinic',
    township: 'Yankin',
    address: 'Kanbe Road / Near Kaba Aye Pagoda Road, Yankin Township, Yangon',
    phone: 'N/A',
    hours: 'Regular Hours',
    er: false
  }
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
