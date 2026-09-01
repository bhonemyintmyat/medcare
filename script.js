(function () {
  'use strict';

  /* ---------- Data ---------- */

  // Live disease list. Starts EMPTY and is filled in at runtime by
  // loadDiseases() from the Supabase `diseases` table. Because the fetch is
  // asynchronous, any code reading this must cope with it being [] at first.
  var diseases = [];

  // BACKUP of the original hard-coded list. Nothing reads this any more — it
  // is kept on purpose so the data is not lost while Supabase beds in.
  // To go back to it, either point renderDiseaseList() at `diseasesBackup`,
  // or see the one-line fallback note inside loadDiseases().
  var diseasesBackup = [
    { name: 'Hypertension', icon: 'bi-heart-pulse', tag: 'Chronic', cat: 'chronic', href: 'diseases/hypertension.html', desc: 'High blood pressure often has no symptoms but raises the risk of stroke and heart disease over time. ' },
    { name: 'Diabetes', icon: 'bi-droplet-half', tag: 'Chronic', cat: 'chronic', href: 'diseases/diabetes.html', desc: 'A long-term condition where blood sugar levels are too high, manageable with diet, exercise, and medication.' },
    { name: 'Asthma', icon: 'bi-lungs', tag: 'Respiratory', cat: 'respiratory',href: 'diseases/asthma.html', desc: 'Airways narrow and swell, causing wheezing and shortness of breath — usually controlled with inhalers.' },
    { name: 'Dengue fever', icon: 'bi-bug', tag: 'Infectious', cat: 'infectious', href: 'diseases/dengue.html', desc: 'A mosquito-borne viral illness common in the rainy season, causing high fever, body aches, and rash.' },
    { name: 'Tuberculosis (TB)', icon: 'bi-clipboard2-pulse', tag: 'Infectious', cat: 'infectious respiratory', href: 'diseases/tb.html', desc: 'A bacterial infection mainly affecting the lungs, treatable with a full course of antibiotics.' },
    { name: 'Malaria', icon: 'bi-thermometer-half', tag: 'Infectious', cat: 'infectious', href: 'diseases/malaria.html', desc: 'A mosquito-borne parasitic disease that causes cyclic fever and chills; preventable with nets and repellents.' },
    { name: 'Hepatitis B', icon: 'bi-shield-plus', tag: 'Infectious', cat: 'infectious', href: 'diseases/hepatitis.html', desc: 'A liver infection that can become long-term; a safe vaccine prevents it and testing catches it early.' },
    { name: 'Coronary heart disease', icon: 'bi-heart', tag: 'Chronic', cat: 'chronic', href: 'diseases/coronary.html', desc: 'Narrowed arteries reduce blood flow to the heart and can cause chest pain or a heart attack.' },
    { name: 'Stroke', icon: 'bi-brain', tag: 'Chronic', cat: 'chronic', href: 'diseases/stroke.html', desc: 'A sudden interruption of blood to the brain — act fast; call an ambulance if you notice F.A.S.T. signs.' },
    { name: 'Anemia', icon: 'bi-droplet', tag: 'Chronic', cat: 'chronic maternal', href: 'diseases/anemia.html', desc: 'Low red blood cell counts cause fatigue and weakness; iron-rich foods and supplements often help.' },
    { name: 'Typhoid fever', icon: 'bi-cup-hot', tag: 'Infectious', cat: 'infectious', href: 'diseases/typhoid.html', desc: 'A bacterial infection spread through contaminated food or water — safe hygiene and vaccination help prevent it.' },
    { name: 'Pre-eclampsia', icon: 'bi-person-heart', tag: 'Maternal', cat: 'maternal', href: 'diseases/eclampsia.html', desc: 'A pregnancy complication with high blood pressure — regular antenatal check-ups are essential.' }
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
    { name: 'Grand Hantha International Hospital', type: 'general', township: 'Kamayut', address: 'Corner of Nar Nat Taw Street and Lower Kyimyindaing Road, Kamayut Township, Yangon', phone: '01-9666141', hours: 'Open 24 hours', er: true },
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
    name: 'University Hospital / Yangon University Medical Centre',
    type: 'general',
    township: 'Kamayut',
    address: 'Yangon University Campus (Near University Avenue Road), Kamayut Township, Yangon',
    phone: '01513628',
    hours: 'Regular Hours',
    er: false
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
  /* Two different kinds of filter live in one list. General, specialist
     and clinic are what a place IS — exactly one of them is true of any
     row, and hospitals_type_check allows nothing else. "Emergency / ER"
     is a property a place of any type can also have. matchesType() below
     is where that difference is spent. */
  var typeMeta = [
    { id: 'general', label: 'General' },
    { id: 'specialist', label: 'Specialist' },
    { id: 'clinic', label: 'Clinic' },
    { id: 'emergency', label: 'Emergency / ER' }
  ];
  var pharmacies = [
    { name: 'City Mart Pharmacy — Junction City', type: 'chain', township: 'Pabedan', address: 'Junction City, Bogyoke Aung San Rd', phone: '01-9253000', hours: 'Daily, 9:00–21:00', open24: false, delivery: true },
    { name: 'AA Pharmacy', type: 'independent', township: 'Latha', address: 'Maha Bandula Rd, Latha', phone: '01-386455', hours: 'Open 24 hours', open24: true, delivery: false },
    { name: 'Yangon General Hospital Pharmacy', type: 'hospital', township: 'Latha', address: 'Bogyoke Aung San Rd, Latha', phone: '01-256112', hours: 'Open 24 hours', open24: true, delivery: false },
    { name: 'Ocean Pharmacy — Kamayut', type: 'chain', township: 'Kamayut', address: 'Pyay Rd, Kamayut', phone: '01-9666300', hours: 'Daily, 8:00–22:00', open24: false, delivery: true },
    { name: 'Shwe Pyi Tagon Drug Store', type: 'independent', township: 'Sanchaung', address: 'Baho Rd, Sanchaung', phone: '01-524378', hours: 'Daily, 8:00–21:00', open24: false, delivery: false },
    { name: 'Pun Hlaing Hospital Pharmacy', type: 'hospital', township: 'Hlaing Tharyar', address: 'Pun Hlaing Estate Ave, Hlaing Tharyar', phone: '01-3684323', hours: 'Open 24 hours', open24: true, delivery: false },
    { name: 'Gandamar Pharmacy', type: 'chain', township: 'Bahan', address: 'Kabar Aye Pagoda Rd, Bahan', phone: '01-546712', hours: 'Daily, 9:00–22:00', open24: false, delivery: true },
    { name: 'May Pharmacy', type: 'independent', township: 'Yankin', address: 'Sayarsan Rd, Yankin', phone: '01-578221', hours: 'Daily, 8:30–20:30', open24: false, delivery: false },
    { name: 'Sein Gay Har Pharmacy', type: 'chain', township: 'Dagon', address: 'Pyay Rd, Dagon', phone: '01-379155', hours: 'Open 24 hours', open24: true, delivery: true },
    { name: 'Thukha Drug Store', type: 'independent', township: 'Mayangone', address: 'Insein Rd, Mayangone', phone: '01-9669042', hours: 'Daily, 8:00–20:00', open24: false, delivery: false }
  ];
  /* `covers` is here because one chip does not always mean one value in
     the column. A pharmacy inside a clinic and one inside a hospital are
     the same thing to somebody choosing where to go — attached to a
     medical facility rather than standing on its own — so they share a
     filter. The column still tells them apart, and the card still prints
     which of the two it is; it is only the filter that groups them. */
  var pharmTypeMeta = [
    { id: 'chain',       label: 'Chain pharmacy',            covers: ['chain'] },
    { id: 'independent', label: 'Independent',               covers: ['independent'] },
    { id: 'hospital',    label: 'Hospital or clinic pharmacy', covers: ['hospital', 'clinic'] }
  ];

  /* Which chip owns a row's type. A type with no chip — one added to the
     database before this list learns about it — returns null and is left
     out of every count rather than silently landing in the first chip. */
  function pharmChipFor(type) {
    var hit = pharmTypeMeta.filter(function (tm) {
      return tm.covers.indexOf(type) !== -1;
    })[0];
    return hit ? hit.id : null;
  }
  var pharmServiceMeta = [
    { id: 'open24', label: 'Open 24 hours' },
    { id: 'delivery', label: 'Home delivery' }
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

  // Townships are needed on the home page (menu) and the hospitals page
  // (select). Recomputed rather than fixed, because `hospitals` below is
  // replaced by what the table says as soon as it answers.
  function townshipsOf(list) {
    return list.map(function (x) { return x.township; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  }
  var townValues = townshipsOf(hospitals);

  /* ---------- A directory, from its table ----------
     hospitals.html and pharmacy.html each shipped with a hard-coded list
     and each now takes the published rows from its table instead. Same
     shape as the articles listing further down, for the same reasons:

       * The list HAS to come from the table, or a hospital added in the
         editor is published into a page that cannot show it.

       * The shipped array stays as the fallback and is drawn first, so a
         slow database delays nothing and a failed request leaves the
         reader with the list they already had. For a page somebody opens
         to find a phone number, a slightly stale directory beats an
         error where the directory was.

       * .eq('status', 'published') is not redundant with RLS. The public
         policy serves published rows only, but the STAFF policy serves
         every row — so without this, an editor or an admin reading the
         public page would see draft entries a signed-out reader never
         would. This is a public listing; it shows what the public sees,
         whoever is looking.

       * .order('id') because Postgres promises no order without it, and
         a directory that reshuffles between loads is one you cannot scan
         twice.

     `map` turns a row into the shape the page's render function already
     expects, so nothing below this had to learn about columns. */
  function loadDirectory(table, map, apply) {
    var db = window.supabaseClient;
    // supabase.js sets this to null when the library or the keys are
    // missing; it already logged why. The shipped list stands.
    if (!db) { return; }

    db.from(table)
      .select('*')
      .eq('status', 'published')
      .order('id')
      .then(function (res) {
        // supabase-js does NOT throw on a database error — it resolves
        // with { data, error }. A missing table or a blocking policy
        // shows up here, not in .catch().
        if (res.error) { throw res.error; }
        var rows = res.data || [];
        // An empty table is far more likely to be a migration that has
        // not been run than a country with no hospitals in it. Keep what
        // is on screen.
        if (!rows.length) { return; }
        apply(rows.map(map));
      })
      .catch(function (err) {
        // Deliberately quiet on the page. The reader has a working list;
        // this is for whoever is looking at a console.
        console.error('[MedCare] Could not refresh ' + table + ' from Supabase:', err);
      });
  }

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

    // Unchanged from before: this is your original search + category filter and
    // card markup, untouched. It only ever runs once the data has arrived.
    var renderDiseaseList = function () {
      var q = dState.query.trim().toLowerCase();
      var cat = dState.category;
      var filtered = diseases.filter(function (d) {
        /* Searched across both languages regardless of which one is on
           screen. Somebody reading the Burmese page may still know the
           condition by its English name, and the reverse is true for a
           name that has no common English form. */
        var hay = [d.name, d.desc, d.name_my, d.desc_my]
                    .filter(Boolean).join(' ').toLowerCase();
        var nameMatch = !q || hay.indexOf(q) !== -1;
        var catMatch = cat === 'all' || d.cat.split(' ').indexOf(cat) !== -1;
        return nameMatch && catMatch;
      });
      dGrid.innerHTML = filtered.map(function (d) {
        /* Both languages ship in the markup and CSS reveals the one
           html[lang] selects, the same way the article cards do. The
           fallback is to the English rather than to an empty element:
           an untranslated card should read as English, not as a card
           with no name on it. */
        var nameMy = d.name_my || d.name;
        var descMy = d.desc_my || d.desc;
        return '<div class="col-md-6 col-lg-4">' +
          '<a href="' + pageHref('disease', d, 'common-diseases.html') + '" class="mc-disease">' +
          '<div class="mc-disease-icon"><i class="bi ' + d.icon + '"></i></div>' +
          '<span class="mc-disease-tag">' + esc(d.tag) + '</span>' +
          '<h3 class="mc-en">' + esc(d.name) + '</h3>' +
          '<h3 class="mc-my">' + esc(nameMy) + '</h3>' +
          '<p class="mc-en">' + esc(d.desc) + '</p>' +
          '<p class="mc-my">' + esc(descMy) + '</p>' +
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

    /* ---------- Loading / error states ----------
       The array was available the instant the script ran. A fetch is not, so
       the page now has three possible states instead of one. `dPhase` tracks
       which one we are in, and renderDiseases() picks the right view. */
    var dPhase = 'loading';   // 'loading' | 'ready' | 'error'

    // Shows a full-width panel in the grid, reusing the existing empty-state
    // styling so it matches the rest of the page.
    var showDiseasePanel = function (html) {
      dGrid.innerHTML = '<div class="col-12"><div class="mc-empty-simple" style="display:block">' + html + '</div></div>';
      dEmpty.style.display = 'none';
      dCount.textContent = '0';
      dWord.textContent = 'conditions';
    };

    var showDiseaseLoading = function () {
      showDiseasePanel(
        '<div class="spinner-border text-secondary" role="status" style="width:1.75rem;height:1.75rem;border-width:.2em"></div>' +
        '<div class="fw-semibold" style="color:var(--mc-text);font-size:1rem;margin:.6rem 0 .25rem">Loading conditions…</div>' +
        '<div>Fetching the latest list.</div>'
      );
    };

    var showDiseaseError = function () {
      showDiseasePanel(
        '<i class="bi bi-wifi-off"></i>' +
        '<div class="fw-semibold" style="color:var(--mc-text);font-size:1rem;margin-bottom:.25rem">Could not load conditions</div>' +
        '<div>Something went wrong fetching the list. Check your connection and try again.</div>' +
        '<button type="button" class="mc-chip" id="diseaseRetry" style="margin-top:.85rem">Try again</button>'
      );
      var retry = byId('diseaseRetry');
      if (retry) { retry.addEventListener('click', function () { loadDiseases(); }); }
    };

    // Everything that used to call renderDiseases() still does. It now decides
    // which of the three views to show, so the chips and the search box behave
    // sensibly even while the data is still in flight.
    var renderDiseases = function () {
      if (dPhase === 'loading') { showDiseaseLoading(); return; }
      if (dPhase === 'error') { showDiseaseError(); return; }
      renderDiseaseList();
    };

    /* ---------- The fetch ---------- */
    var loadDiseases = function () {
      dPhase = 'loading';
      renderDiseases();

      var db = window.supabaseClient;
      if (!db) {
        // supabase.js sets this to null when the library or the keys are
        // missing; it already logged why.
        dPhase = 'error';
        renderDiseases();
        return;
      }

      /* .eq('status', 'published') is not redundant with RLS, and it is
         the same guard the articles listing carries. The public policy
         serves published rows only, but the STAFF policy serves every
         row - so without this, an editor or admin who opens this public
         page sees draft disease cards a signed-out reader never would,
         and clicks through to a page the public cannot reach. This is a
         public listing; it shows what the public sees, whoever is
         looking.

         .order('id') matters too: without an explicit order Postgres
         makes no promise about row order, so the cards could shuffle
         between loads. */
      db.from('diseases')
        .select('*')
        .eq('status', 'published')
        .order('id')
        .then(function (res) {
          // supabase-js does NOT throw on a database error — it resolves with
          // { data, error }. A missing table or a blocking RLS policy shows up
          // here, not in .catch(), so this check has to be explicit.
          if (res.error) { throw res.error; }
          diseases = res.data || [];
          dPhase = 'ready';
          renderDiseases();
        })
        .catch(function (err) {
          // .catch() handles the other failure mode: the request never
          // completed at all (offline, DNS, CORS, project paused).
          console.error('[MedCare] Could not load diseases from Supabase:', err);
          // To fall back to the old hard-coded list instead of showing an
          // error, replace the next two lines with:
          //   diseases = diseasesBackup; dPhase = 'ready';
          dPhase = 'error';
          renderDiseases();
        });
    };

    if (dSearch) {
      dSearch.addEventListener('input', function (e) { dState.query = e.target.value; renderDiseases(); });
    }
    loadDiseases();
  }

  /* ---------- Where a row's page lives ----------
     A row has two possible pages and this is the one place that decides
     between them:

       body written in the editor  ->  read.html renders it
       href to a file in the repo  ->  that file, as it always was

     Body wins when there is one. The ten articles and ten diseases that
     shipped as hand-written files have no body, so they keep opening the
     pages they always did; anything written in the editor from now on
     gets the reader. Nothing had to be migrated for that to be true.

     The href is escaped here rather than at the call sites. It is
     editor-supplied and it goes straight into an attribute, which is
     exactly the shape of bug that gets missed when each caller is
     trusted to remember. */
  var pageHref = function (kind, row, fallback) {
    var hasBody = (row.body && String(row.body).trim()) ||
                  (row.body_my && String(row.body_my).trim());
    if (hasBody && row.id != null) {
      return 'read.html?type=' + kind + '&id=' + encodeURIComponent(row.id);
    }
    return esc(row.href || fallback);
  };

  /* ---------- Health articles listing (articles.html) ----------
     Each article lives in its own page and carries both languages, so the cards
     link straight to the file and render both titles behind .mc-en / .mc-my. */
  var myArticleCats = [
    { id: 'all', en: 'All', my: 'အားလုံး' },
    { id: 'prevention', en: 'Prevention', my: 'ကြိုတင်ကာကွယ်ရေး' },
    { id: 'nutrition', en: 'Nutrition', my: 'အာဟာရ' },
    { id: 'wellness', en: 'Wellness', my: 'ကျန်းမာသုခ' }
  ];
  var myArticles = [
    { href: 'healthyfood.html', cat: 'nutrition', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'images/healthyfood.jpg',
      title: 'Eating well for a healthier life',
      titleMy: 'ကျန်းမာရေးနှင့် ညီညွတ်သော အစားအသောက်များ',
      excerpt: 'Balanced, nourishing meals strengthen your immune system and help keep long-term illness away.',
      excerptMy: 'အာဟာရပြည့်ဝသော အစားအစာများကို မျှတစွာ စားသုံးခြင်းဖြင့် ကိုယ်ခံစွမ်းအားကို မြင့်တက်စေပြီး ရောဂါဘယများကို ကာကွယ်နိုင်ပါသည်။' },
    { href: 'mentalhealth.html', cat: 'wellness', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80',
      title: 'Managing stress and looking after your mental health',
      titleMy: 'စိတ်ဖိစီးမှု လျှော့ချခြင်းနှင့် စိတ်ကျန်းမာရေး',
      excerpt: 'Mindfulness and regular rest go a long way towards easing the pressures of everyday life.',
      excerptMy: 'နေ့စဉ်ဘဝတွင် ကြုံတွေ့နေရသော စိတ်ဖိစီးမှုများကို လျှော့ချရန်အတွက် တရားထိုင်ခြင်းနှင့် အပန်းဖြေခြင်းတို့က များစွာအထောက်အကူပြုပါသည်။' },
    { href: 'heartandex.html', cat: 'wellness', by: 'Dr. Aung Min', byMy: 'Dr. Aung Min',
      thumb: 'images/hearthealth.jpg',
      title: 'Physical activity and heart health',
      titleMy: 'ကိုယ်လက်လှုပ်ရှားမှုနှင့် နှလုံးကျန်းမာရေး',
      excerpt: 'About 30 minutes of walking or exercise a day strengthens the heart muscle and improves circulation.',
      excerptMy: 'တစ်နေ့လျှင် မိနစ် ၃၀ ခန့် လမ်းလျှောက်ခြင်း၊ လေ့ကျင့်ခန်းလုပ်ခြင်းသည် နှလုံးကြွက်သားများကို သန်စွမ်းစေပြီး သွေးလှည့်ပတ်မှုကို ကောင်းမွန်စေပါသည်။' },
    { href: 'sleep.html', cat: 'wellness', by: 'Dr. Aung Min', byMy: 'Dr. Aung Min',
      thumb: 'images/sleep%20copy.jpg',
      title: 'Why enough sleep matters',
      titleMy: 'လုံလောက်သော အိပ်စက်ချိန်၏ အရေးပါပုံ',
      excerpt: 'Sleeping well sharpens memory and restores the energy your body spends through the day.',
      excerptMy: 'ကောင်းမွန်စွာ အိပ်စက်ခြင်းက မှတ်ဉာဏ်စွမ်းရည်ကို တိုးတက်စေပြီး ခန္ဓာကိုယ်အားအင်ကို ပြန်လည်ပြည့်ဖြိုးစေပါသည်။' },
    { href: 'hydration.html', cat: 'wellness', by: 'Dr. May Thida', byMy: 'Dr. May Thida',
      thumb: 'images/hydration.jpg',
      title: 'The benefits of drinking enough water',
      titleMy: 'ရေလုံလောက်စွာ သောက်သုံးခြင်း၏ အကျိုးကျေးဇူးများ',
      excerpt: 'Water makes up most of the body and flushes out waste. Aim for at least eight glasses a day.',
      excerptMy: 'ရေသည် ခန္ဓာကိုယ်၏ အဓိက အစိတ်အပိုင်းဖြစ်ပြီး အဆိပ်အတောက်များကို ဖယ်ရှားပေးပါသည်။ တစ်နေ့လျှင် ရေ ၈ ခွက် အနည်းဆုံး သောက်သုံးသင့်ပါသည်။' },
    { href: 'eyehealth.html', cat: 'prevention', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'images/eyecare.jpg',
      title: 'Looking after your eyes in a screen-filled world',
      titleMy: 'မျက်စိကျန်းမာရေးအတွက် ဂရုစိုက်သင့်သည့် အချက်များ',
      excerpt: 'With so much time on phones and computers, the 20-20-20 rule is a simple way to ease eye strain.',
      excerptMy: 'ဖုန်းနှင့် ကွန်ပျူတာ အကြည့်များသည့် ယနေ့ခေတ်တွင် 20-20-20 rule ကို ကျင့်သုံးခြင်းဖြင့် မျက်စိညောင်းညာမှုကို လျှော့ချနိုင်ပါသည်။' },
    { href: 'oralhealth.html', cat: 'prevention', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80',
      title: 'Mouth and dental health',
      titleMy: 'ခံတွင်းနှင့် သွားကျန်းမာရေး',
      excerpt: 'Flossing matters as much as brushing, and a check-up every six months catches trouble early.',
      excerptMy: 'သွားတိုက်ခြင်းသာမက သွားကြားထိုးကြိုး (Floss) အသုံးပြုခြင်းသည်လည်း မရှိမဖြစ်လိုအပ်ပါသည်။ ခြောက်လတစ်ကြိမ် ပုံမှန်ပြသသင့်ပါသည်။' },
    { href: 'hygiene.html', cat: 'prevention', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'images/hygene.jpg',
      title: 'Personal hygiene and preventing infection',
      titleMy: 'တစ်ကိုယ်ရည် သန့်ရှင်းရေးနှင့် ရောဂါကာကွယ်ခြင်း',
      excerpt: 'Washing your hands properly and often is one of the cheapest, most effective ways to stop infection.',
      excerptMy: 'လက်ကို ဆပ်ပြာဖြင့် စနစ်တကျ မကြာခဏ ဆေးကြောခြင်းသည် ကူးစက်ရောဂါများကို ကာကွယ်ရန် အထိရောက်ဆုံး နည်းလမ်းတစ်ခု ဖြစ်ပါသည်။' },
    { href: 'posture.html', cat: 'wellness', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'images/posture.jpg',
      title: 'Good posture and back pain',
      titleMy: 'မှန်ကန်သော ကိုယ်နေဟန်ထားနှင့် ခါးနာခြင်း',
      excerpt: 'If you sit for work, how you hold your back and spine matters. Stretching keeps back pain away.',
      excerptMy: 'အထိုင်များသော အလုပ်လုပ်သူများအနေဖြင့် ခါးနှင့် ကျောရိုး အနေအထားမှန်ကန်ရန် ဂရုပြုသင့်ပါသည်။ အကြောဆန့် လေ့ကျင့်ခန်းများက ခါးနာခြင်းမှ ကင်းဝေးစေပါသည်။' },
    { href: 'medicalcheckup.html', cat: 'prevention', by: 'MedCare editorial team', byMy: 'MedCare တည်းဖြတ်အဖွဲ့',
      thumb: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
      title: 'Regular health check-ups',
      titleMy: 'ကျန်းမာရေး ပုံမှန်စစ်ဆေးခြင်း (Medical Checkup)',
      excerpt: 'Even with no symptoms, a check-up once a year finds problems while they are still easy to treat.',
      excerptMy: 'ရောဂါလက္ခဏာ မပြသော်လည်း တစ်နှစ်လျှင် တစ်ကြိမ်ခန့် ပုံမှန်စစ်ဆေးမှု ခံယူခြင်းဖြင့် ရောဂါများကို ကြိုတင်သိရှိနိုင်ပါသည်။' }
  ];

  var myCat = function (id) {
    return myArticleCats.filter(function (c) { return c.id === id; })[0] || { en: id, my: id };
  };
  // Both languages ship in the markup; CSS reveals the one html[lang] selects.
  var bi = function (en, my) {
    return '<span class="mc-en">' + esc(en) + '</span><span class="mc-my">' + esc(my) + '</span>';
  };
  // One card, used by the article grid and by the home page's Editor's picks,
  // so the two never drift apart.
  var myArticleCard = function (a) {
    var c = myCat(a.cat);
    return '<div class="col-md-6 col-lg-4">' +
      '<a href="' + pageHref('article', a, 'articles.html') + '" class="mc-article d-block text-decoration-none text-reset">' +
      '<div class="mc-article-thumb"><img src="' + esc(a.thumb) + '" alt="">' +
      '<span class="badge-cat">' + bi(c.en, c.my) + '</span></div>' +
      '<div class="mc-article-body">' +
      '<h3 class="mc-en">' + esc(a.title) + '</h3>' +
      '<h3 class="mc-my">' + esc(a.titleMy) + '</h3>' +
      '<p class="mc-en">' + esc(a.excerpt) + '</p>' +
      '<p class="mc-my">' + esc(a.excerptMy) + '</p>' +
      '<div class="mc-article-meta"><span>' + bi(a.by, a.byMy) + '</span></div>' +
      '</div></a></div>';
  };

  var myGrid = byId('myArticleGrid');
  if (myGrid) {
    var myState = { query: param('q'), category: param('cat') || 'all' };
    var mySearch = byId('myArticleSearch');
    var myChips = byId('myArticleChips');
    var myCount = byId('myArticleCount');
    var myEmpty = byId('myArticleEmpty');

    if (mySearch) { mySearch.value = myState.query; }

    myArticleCats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mc-chip';
      b.innerHTML = bi(c.en, c.my);
      b.setAttribute('data-cat', c.id);
      b.addEventListener('click', function () { myState.category = c.id; renderMyArticles(); });
      myChips.appendChild(b);
    });

    var renderMyArticles = function () {
      var q = myState.query.trim().toLowerCase();
      var cat = myState.category;
      var filtered = myArticles.filter(function (a) {
        // Search both languages, so either script finds the article.
        var c = myCat(a.cat);
        var hay = (a.title + ' ' + a.excerpt + ' ' + c.en + ' ' +
                   a.titleMy + ' ' + a.excerptMy + ' ' + c.my).toLowerCase();
        return (!q || hay.indexOf(q) !== -1) && (cat === 'all' || a.cat === cat);
      });
      myGrid.innerHTML = filtered.map(myArticleCard).join('');
      myCount.textContent = filtered.length;
      myEmpty.style.display = filtered.length === 0 ? 'block' : 'none';
      Array.prototype.forEach.call(myChips.children, function (b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
    };

    if (mySearch) {
      mySearch.addEventListener('input', function (e) { myState.query = e.target.value; renderMyArticles(); });
    }
    renderMyArticles();

    /* ---------- The same list, from the table ----------
       myArticles above is the list this page shipped with, and it is now
       a FALLBACK rather than the source. The ten rows in the `articles`
       table are the same ten articles - supabase_seed_articles.sql put
       them there - so until somebody writes an eleventh, both lists say
       the same thing and swapping one for the other changes nothing a
       reader can see.

       It has to come from the table, though, or an article written in
       the editor is published into a listing that cannot show it: the
       page would render, and no link would ever reach it.

       Drawn AFTER the shipped list has already rendered, so a slow
       database delays nothing. If the request fails the page keeps the
       list it drew, which is the right failure for a health site - ten
       articles that are slightly stale beat an error where the articles
       were. */
    var myDb = window.supabaseClient;
    if (myDb) {
      myDb.from('articles')
        .select('*')
        .eq('status', 'published')
        .order('id')
        .then(function (res) {
          if (res.error) { throw res.error; }
          var rows = res.data || [];
          if (!rows.length) { return; }   // keep what is on screen

          myArticles = rows.map(function (r) {
            return {
              id: r.id,
              href: r.href,
              body: r.body,
              body_my: r.body_my,
              cat: r.cat,
              thumb: r.thumb || r.cover_image || '',
              title: r.title || '',
              titleMy: r.title_my || r.title || '',
              excerpt: r.excerpt || '',
              excerptMy: r.excerpt_my || r.excerpt || '',
              by: r.byline || 'MedCare editorial team',
              byMy: r.byline_my || r.byline || 'MedCare တည်းဖြတ်အဖွဲ့'
            };
          });
          renderMyArticles();
        })
        .catch(function (err) {
          // Deliberately quiet on the page. The reader already has a
          // working list; this is for whoever is looking at a console.
          console.error('[MedCare] Could not refresh articles from Supabase:', err);
        });
    }
  }

  /* ---------- Editor's picks (index.html) ----------
     A hand-picked three drawn from the same article data as the articles
     page, one per category, so the home page cannot advertise a piece
     that does not exist. Edit the hrefs below to change the selection. */
  var featuredGrid = byId('featuredGrid');
  if (featuredGrid) {
    var featuredHrefs = ['healthyfood.html', 'heartandex.html', 'hygiene.html'];
    var featured = featuredHrefs.map(function (h) {
      return myArticles.filter(function (a) { return a.href === h; })[0];
    }).filter(Boolean);
    featuredGrid.innerHTML = featured.map(myArticleCard).join('');
  }

  /* ---------- Find Hospitals page ---------- */
  var hList = byId('hospList');
  if (hList) {
    var hState = {
      query: param('q'),
      township: param('town') || 'all',
      types: { general: true, specialist: true, clinic: true, emergency: true }
    };
    var hSearch = byId('hospSearch');
    var hTownship = byId('hospTownship');
    var hTypes = byId('hospTypes');
    var hCount = byId('hospCount');
    var hWord = byId('hospWord');
    var hEmpty = byId('hospEmpty');

    /* The sidebar is built FROM the data — the townships in the select and
       the number beside each type are both counted off the list. So both
       are functions rather than a run of statements: when the table
       answers and the list changes underneath them, they are built again
       rather than left describing the list that shipped. */
    var buildTownships = function () {
      hTownship.innerHTML = '<option value="all">All townships</option>' +
        townValues.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
      // Only honor ?town= if it matches a real township.
      if (townValues.indexOf(hState.township) === -1) { hState.township = 'all'; }
      hTownship.value = hState.township;
    };
    buildTownships();

    if (hSearch) { hSearch.value = hState.query; }

    hTownship.addEventListener('change', function (e) { hState.township = e.target.value; renderHospitals(); });

    var buildTypes = function () {
      hTypes.innerHTML = '';
      typeMeta.forEach(function (tm) {
        var count = tm.id === 'emergency'
          ? hospitals.filter(function (h) { return h.er; }).length
          : hospitals.filter(function (h) { return h.type === tm.id; }).length;
        var label = document.createElement('label');
        label.className = 'mc-check';
        label.innerHTML = '<input type="checkbox"><span>' + esc(tm.label) + '</span><span class="cnt">' + count + '</span>';
        var input = label.querySelector('input');
        input.setAttribute('data-type', tm.id);
        // Read back from the state, not hard-coded checked: a rebuild
        // happens after the reader may already have unticked something,
        // and silently re-ticking it would change what they are looking
        // at without them touching anything.
        input.checked = !!hState.types[tm.id];
        input.addEventListener('change', function () { hState.types[tm.id] = input.checked; renderHospitals(); });
        hTypes.appendChild(label);
      });
    };
    buildTypes();

    /* PLACE_TYPES is the guard that keeps the two kinds of filter apart.
       Without it this would be `t[h.type]`, and a row whose type column
       ever read 'emergency' would be matched by the ER tickbox instead of
       by a type of its own.

       The OR is deliberate and is how this page has always behaved:
       unticking Specialist still leaves a specialist hospital with an ER
       on screen, because somebody filtering for an emergency room is
       asking a question about the room, not about the building. */
    var PLACE_TYPES = { general: true, specialist: true, clinic: true };
    var matchesType = function (h) {
      var t = hState.types;
      var baseOK = PLACE_TYPES[h.type] === true && t[h.type] === true;
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
      var typeLabelMap = { general: 'General', specialist: 'Specialist', clinic: 'Clinic' };
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
      hState.types = { general: true, specialist: true, clinic: true, emergency: true };
      if (hSearch) { hSearch.value = ''; }
      hTownship.value = 'all';
      Array.prototype.forEach.call(hTypes.querySelectorAll('input'), function (i) { i.checked = true; });
      renderHospitals();
    };
    byId('hospClear').addEventListener('click', clearHospitals);
    byId('hospResetBtn').addEventListener('click', clearHospitals);

    renderHospitals();

    /* Now the real list. `phone` is nullable in the table and most rows
       have no number; the shipped array wrote 'N/A' for those, and the
       card markup below calls .replace() on it, so the coalesce is what
       keeps a null out of a method call. */
    loadDirectory('hospitals', function (r) {
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        township: r.township,
        address: r.address || '',
        phone: r.phone || 'N/A',
        hours: r.hours || '',
        er: !!r.er
      };
    }, function (rows) {
      hospitals = rows;
      townValues = townshipsOf(hospitals);
      buildTownships();
      buildTypes();
      renderHospitals();
      // The home page's town dropdown is drawn from the same list. It is
      // not on this page, so this is a no-op here; it matters on index.
      renderTownMenu();
    });
  }

  /* ---------- Find a Pharmacy page ---------- */
  var pList = byId('pharmList');
  if (pList) {
    var pState = {
      query: param('q'),
      township: param('town') || 'all',
      types: { chain: true, independent: true, hospital: true },
      // Services are opt-in filters: unchecked means "don't care".
      services: { open24: param('open24') === '1', delivery: false }
    };
    var pSearch = byId('pharmSearch');
    var pTownship = byId('pharmTownship');
    var pTypes = byId('pharmTypes');
    var pServices = byId('pharmServices');
    var pCount = byId('pharmCount');
    var pWord = byId('pharmWord');
    var pEmpty = byId('pharmEmpty');

    /* Same three counted-off-the-data controls as the hospitals sidebar,
       and functions for the same reason: the table's answer replaces the
       list they describe. See the note there. */
    var buildPharmTownships = function () {
      var pharmTowns = townshipsOf(pharmacies);
      pTownship.innerHTML = '<option value="all">All townships</option>' +
        pharmTowns.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
      if (pharmTowns.indexOf(pState.township) === -1) { pState.township = 'all'; }
      pTownship.value = pState.township;
    };
    buildPharmTownships();

    if (pSearch) { pSearch.value = pState.query; }
    pTownship.addEventListener('change', function (e) { pState.township = e.target.value; renderPharmacies(); });

    var buildPharmTypes = function () {
      pTypes.innerHTML = '';
      pharmTypeMeta.forEach(function (tm) {
        var count = pharmacies.filter(function (p) { return pharmChipFor(p.type) === tm.id; }).length;
        var label = document.createElement('label');
        label.className = 'mc-check';
        label.innerHTML = '<input type="checkbox"><span>' + esc(tm.label) + '</span><span class="cnt">' + count + '</span>';
        var input = label.querySelector('input');
        input.setAttribute('data-type', tm.id);
        input.checked = !!pState.types[tm.id];
        input.addEventListener('change', function () { pState.types[tm.id] = input.checked; renderPharmacies(); });
        pTypes.appendChild(label);
      });
    };
    buildPharmTypes();

    var buildPharmServices = function () {
      pServices.innerHTML = '';
      pharmServiceMeta.forEach(function (sm) {
        var count = pharmacies.filter(function (p) { return p[sm.id]; }).length;
        var label = document.createElement('label');
        label.className = 'mc-check';
        label.innerHTML = '<input type="checkbox"><span>' + esc(sm.label) + '</span><span class="cnt">' + count + '</span>';
        var input = label.querySelector('input');
        input.setAttribute('data-service', sm.id);
        input.checked = !!pState.services[sm.id];
        input.addEventListener('change', function () { pState.services[sm.id] = input.checked; renderPharmacies(); });
        pServices.appendChild(label);
      });
    };
    buildPharmServices();

    var renderPharmacies = function () {
      var q = pState.query.trim().toLowerCase();
      var filtered = pharmacies.filter(function (p) {
        var townOK = pState.township === 'all' || p.township === pState.township;
        var typeOK = !!pState.types[pharmChipFor(p.type)];
        var svcOK = (!pState.services.open24 || p.open24) && (!pState.services.delivery || p.delivery);
        var hay = (p.name + ' ' + p.township + ' ' + p.address).toLowerCase();
        var searchOK = !q || hay.indexOf(q) !== -1;
        return townOK && typeOK && svcOK && searchOK;
      });
      // The card names the row exactly, even though the filter groups the
      // last two: "Hospital pharmacy" and "Clinic pharmacy" are different
      // places to walk to.
      var pharmTypeLabel = {
        chain: 'Chain pharmacy',
        independent: 'Independent',
        hospital: 'Hospital pharmacy',
        clinic: 'Clinic pharmacy'
      };
      pList.innerHTML = filtered.map(function (p) {
        var tel = 'tel:' + p.phone.replace(/[^0-9+]/g, '');
        var maps = 'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(p.name + ', ' + p.address + ', Yangon');
        var chips = '';
        if (p.delivery) { chips += '<span class="mc-svc"><i class="bi bi-scooter"></i> Home delivery</span>'; }
        chips += '<span class="mc-svc"><i class="bi bi-file-earmark-medical"></i> Fills prescriptions</span>';
        return '<article class="mc-hosp">' +
          '<div class="mc-hosp-top"><div><h3>' + esc(p.name) + '</h3>' +
          '<span class="mc-hosp-type">' + esc(pharmTypeLabel[p.type] || 'Pharmacy') + '</span></div>' +
          (p.open24 ? '<span class="mc-badge-24"><i class="bi bi-clock-fill"></i> Open 24 hours</span>' : '') +
          '</div>' +
          '<div class="mc-hosp-meta">' +
          '<div class="mc-hosp-row"><i class="bi bi-geo-alt"></i><span>' + esc(p.township) + ' Township</span></div>' +
          '<div class="mc-hosp-row"><i class="bi bi-signpost-2"></i><span>' + esc(p.address) + '</span></div>' +
          '<div class="mc-hosp-row hours"><i class="bi bi-clock"></i><span class="open">' + esc(p.hours) + '</span></div>' +
          '</div>' +
          '<div class="mc-svc-row">' + chips + '</div>' +
          '<div class="mc-hosp-actions">' +
          '<a href="' + tel + '" class="mc-call"><i class="bi bi-telephone-fill"></i> ' + esc(p.phone) + '</a>' +
          '<a href="' + maps + '" class="mc-directions" target="_blank" rel="noopener"><i class="bi bi-map"></i> Directions</a>' +
          '</div></article>';
      }).join('');
      pCount.textContent = filtered.length;
      pWord.textContent = filtered.length === 1 ? 'pharmacy' : 'pharmacies';
      pEmpty.style.display = filtered.length === 0 ? 'block' : 'none';
    };

    if (pSearch) {
      pSearch.addEventListener('input', function (e) { pState.query = e.target.value; renderPharmacies(); });
    }

    var clearPharmacies = function () {
      pState.query = '';
      pState.township = 'all';
      pState.types = { chain: true, independent: true, hospital: true };
      pState.services = { open24: false, delivery: false };
      if (pSearch) { pSearch.value = ''; }
      pTownship.value = 'all';
      Array.prototype.forEach.call(pTypes.querySelectorAll('input'), function (i) { i.checked = true; });
      Array.prototype.forEach.call(pServices.querySelectorAll('input'), function (i) { i.checked = false; });
      renderPharmacies();
    };
    byId('pharmClear').addEventListener('click', clearPharmacies);
    byId('pharmResetBtn').addEventListener('click', clearPharmacies);

    renderPharmacies();

    // And the real list. Same nullable `phone` as hospitals.
    loadDirectory('pharmacies', function (r) {
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        township: r.township,
        address: r.address || '',
        phone: r.phone || 'N/A',
        hours: r.hours || '',
        open24: !!r.open24,
        delivery: !!r.delivery
      };
    }, function (rows) {
      pharmacies = rows;
      buildPharmTownships();
      buildPharmTypes();
      buildPharmServices();
      renderPharmacies();
    });
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
  /* Built from the real townships so each entry links to the hospitals
     page pre-filtered for that town — which means it is the hospitals
     list again, in menu form, and it goes stale the moment that list
     stops being the shipped array.

     A function declaration, not a var: the hospitals loader calls this
     after the table answers, and that call is written above this line.
     Hoisting is what makes that legal, and it is worth one sentence of
     explanation rather than moving working code around it. */
  function renderTownMenu() {
    var townMenu = document.querySelector('.mc-town-menu');
    if (!townMenu) { return; }
    townMenu.innerHTML = '<li><h6 class="dropdown-header">Filter by town</h6></li>' +
      '<li><a class="dropdown-item" data-town="all" href="hospitals.html"><i class="bi bi-pin-map me-2"></i>All towns</a></li>' +
      townValues.map(function (t) {
        return '<li><a class="dropdown-item" data-town="' + esc(t) + '" href="hospitals.html?town=' + encodeURIComponent(t) + '">' +
          '<i class="bi bi-pin-map me-2"></i>' + esc(t) + '</a></li>';
      }).join('');
  }
  renderTownMenu();

  /* The menu lives on the home page, where the hospitals list is never
     loaded, so it would otherwise show only the townships that shipped.
     One query, and only where the menu actually is. */
  if (document.querySelector('.mc-town-menu')) {
    loadDirectory('hospitals', function (r) { return { township: r.township }; },
      function (rows) {
        townValues = townshipsOf(rows);
        renderTownMenu();
      });
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

  /* ==================================================================
     Language toggle — English / Burmese
     ------------------------------------------------------------------
     The dictionary is keyed by the exact English text that appears on
     the page, so pages need no extra markup: we walk the DOM, look each
     piece of text up, and swap it. The original English is remembered
     per node so switching back is lossless. A MutationObserver re-runs
     the swap over anything the render functions draw later (disease
     cards, hospital results, and so on).
     ================================================================== */
  var MY = {
    /* --- navigation & shared chrome --- */
    'Home': 'ပင်မစာမျက်နှာ',
    'Common diseases': 'အဖြစ်များသောရောဂါများ',
    'Find Hospitals': 'ဆေးရုံရှာရန်',
    'Emergency': 'အရေးပေါ်',
    'Pharmacy': 'ဆေးဆိုင်',
    'Health articles': 'ကျန်းမာရေးဆောင်းပါးများ',
    'Emergency help': 'အရေးပေါ်အကူအညီ',
    'Search': 'ရှာဖွေရန်',
    'Learn more': 'ပိုမိုလေ့လာရန်',
    'Directions': 'လမ်းညွှန်',
    'Clear all': 'အားလုံးရှင်းရန်',
    'Clear all filters': 'စစ်ထုတ်မှုအားလုံး ရှင်းရန်',
    'Filters': 'စစ်ထုတ်မှုများ',
    'Township': 'မြို့နယ်',
    'All townships': 'မြို့နယ်အားလုံး',
    'Sources': 'အကိုးအကား',

    /* --- footer --- */
    'About': 'အကြောင်း',
    'Our editorial team': 'အယ်ဒီတာအဖွဲ့',
    'Review process': 'စိစစ်မှုလုပ်ငန်းစဉ်',
    'Contact us': 'ဆက်သွယ်ရန်',
    'Careers': 'အလုပ်အကိုင်',
    'Press': 'သတင်းမီဒီယာ',
    'Legal': 'ဥပဒေဆိုင်ရာ',
    'Terms of use': 'အသုံးပြုမှုစည်းကမ်းများ',
    'Privacy policy': 'ကိုယ်ရေးအချက်အလက်မူဝါဒ',
    'Cookie settings': 'Cookie ဆက်တင်များ',
    'Accessibility': 'အသုံးပြုနိုင်စွမ်း',
    'HIPAA notice': 'HIPAA အသိပေးချက်',
    'Trusted, plain-language health information reviewed by licensed medical professionals. Free for everyone, everywhere.':
      'လိုင်စင်ရ ဆေးပညာရှင်များ စိစစ်ထားသော ယုံကြည်စိတ်ချရပြီး နားလည်လွယ်သည့် ကျန်းမာရေးအချက်အလက်များ။ နေရာတိုင်း၊ လူတိုင်းအတွက် အခမဲ့။',
    'Information only — not a substitute for professional medical advice, diagnosis, or treatment.':
      'အချက်အလက်သာဖြစ်ပြီး ဆရာဝန်၏ အကြံဉာဏ်၊ ရောဂါရှာဖွေမှု သို့မဟုတ် ကုသမှုကို အစားထိုးနိုင်ခြင်း မရှိပါ။',
    '© 2026 MedCare. All rights reserved.': '© ၂၀၂၆ MedCare။ မူပိုင်ခွင့်အားလုံး ရယူထားပါသည်။',

    /* --- home --- */
    'Find a hospital': 'ဆေးရုံရှာရန်',
    'Towns': 'မြို့နယ်များ',
    'Filter by town': 'မြို့နယ်အလိုက် စစ်ထုတ်ရန်',
    'All towns': 'မြို့နယ်အားလုံး',
    'Search hospitals by name…': 'ဆေးရုံအမည်ဖြင့် ရှာရန်…',
    'Search hospitals': 'ဆေးရုံရှာဖွေရန်',
    'Search symptoms, conditions, or hospitals…': 'ရောဂါလက္ခဏာ၊ ရောဂါ သို့မဟုတ် ဆေးရုံ ရှာရန်…',
    'Popular:': 'ရေပန်းစားသည်များ −',
    'Explore MedCare': 'MedCare ကို လေ့လာရန်',
    'Where would you like to start?': 'ဘယ်ကနေ စတင်ချင်ပါသလဲ။',
    'Four quick ways to find the health information and care you need.':
      'လိုအပ်သော ကျန်းမာရေးအချက်အလက်နှင့် စောင့်ရှောက်မှုကို ရှာဖွေရန် လွယ်ကူသည့် နည်းလမ်းလေးမျိုး။',
    'Health Articles': 'ကျန်းမာရေးဆောင်းပါးများ',
    'Read plain-language guides on wellness, prevention, and daily health topics.':
      'ကျန်းမာရေး၊ ကာကွယ်ရေးနှင့် နေ့စဉ်ကျန်းမာရေးအကြောင်း နားလည်လွယ်သော လမ်းညွှန်များကို ဖတ်ရှုပါ။',
    'Common Diseases': 'အဖြစ်များသောရောဂါများ',
    'Learn symptoms, causes, and treatments for conditions common in Myanmar.':
      'မြန်မာနိုင်ငံတွင် အဖြစ်များသော ရောဂါများ၏ လက္ခဏာ၊ အကြောင်းရင်းနှင့် ကုသမှုများကို လေ့လာပါ။',
    'Emergency Contacts': 'အရေးပေါ်ဆက်သွယ်ရန်',
    'Ambulance, poison control, and 24/7 hotlines you can call right now.':
      'လူနာတင်ယာဉ်၊ အဆိပ်ဖြေဌာနနှင့် ၂၄ နာရီ ဖုန်းလိုင်းများကို ယခုပင် ခေါ်ဆိုနိုင်ပါသည်။',
    'Find Hospitals in Yangon': 'ရန်ကုန်ရှိ ဆေးရုံများ ရှာရန်',
    'Browse hospitals and clinics across Yangon townships by name or location.':
      'ရန်ကုန်မြို့နယ်များရှိ ဆေးရုံနှင့် ဆေးခန်းများကို အမည် သို့မဟုတ် တည်နေရာဖြင့် ရှာဖွေပါ။',
    'In a medical emergency, call 192 (ambulance) immediately.':
      'ဆေးဘက်ဆိုင်ရာ အရေးပေါ်အခြေအနေတွင် ၁၉၂ (လူနာတင်ယာဉ်) ကို ချက်ချင်း ခေါ်ပါ။',
    'Do not use this site for urgent or life-threatening conditions.':
      'အသက်အန္တရာယ်ရှိသော အရေးပေါ်အခြေအနေများအတွက် ဤဝဘ်ဆိုက်ကို အားမကိုးပါနှင့်။',
    'Editor’s picks': 'အယ်ဒီတာ ရွေးချယ်မှု',
    "Editor's picks": 'အယ်ဒီတာ ရွေးချယ်မှု',
    'Featured Articles': 'အထူးဆောင်းပါးများ',
    'All articles': 'ဆောင်းပါးအားလုံး',

    /* --- article cards / listing --- */
    'Search articles by title or topic…': 'ခေါင်းစဉ် သို့မဟုတ် အကြောင်းအရာဖြင့် ဆောင်းပါးရှာရန်…',
    'articles': 'ဆောင်းပါးများ',
    'article': 'ဆောင်းပါး',
    'No articles match your search': 'သင့်ရှာဖွေမှုနှင့် ကိုက်ညီသော ဆောင်းပါး မတွေ့ပါ',
    'Try a different word or clear the filters.': 'အခြားစကားလုံးဖြင့် ရှာကြည့်ပါ သို့မဟုတ် စစ်ထုတ်မှုကို ရှင်းလင်းပါ။',
    'Nutrition': 'အာဟာရ',
    'Maternal care': 'မိခင်စောင့်ရှောက်မှု',
    'Prevention': 'ကာကွယ်ရေး',
    'Wellness': 'ကျန်းမာသုခ',
    'Health article': 'ကျန်းမာရေးဆောင်းပါး',
    'World Health Organization (WHO)': 'ကမ္ဘာ့ကျန်းမာရေးအဖွဲ့ (WHO)',
    'Ministry of Health, Myanmar': 'ကျန်းမာရေးဝန်ကြီးဌာန၊ မြန်မာနိုင်ငံ',

    /* --- common diseases --- */
    'Learn about conditions that are frequently seen in Myanmar communities — their signs, causes, and when to seek care.':
      'မြန်မာ့လူ့အဖွဲ့အစည်းတွင် မကြာခဏတွေ့ရသော ရောဂါများ၏ လက္ခဏာ၊ အကြောင်းရင်းနှင့် ဆေးကုသမှု ခံယူသင့်သည့်အချိန်ကို လေ့လာပါ။',
    'Filter diseases by name…': 'ရောဂါအမည်ဖြင့် စစ်ထုတ်ရန်…',
    'All': 'အားလုံး',
    'Chronic': 'နာတာရှည်',
    'Infectious': 'ကူးစက်ရောဂါ',
    'Respiratory': 'အသက်ရှူလမ်းကြောင်း',
    'Maternal & child': 'မိခင်နှင့်ကလေး',
    'Maternal': 'မိခင်ကျန်းမာရေး',
    'conditions': 'ရောဂါများ',
    'condition': 'ရောဂါ',
    'No conditions match your search': 'သင့်ရှာဖွေမှုနှင့် ကိုက်ညီသော ရောဂါ မတွေ့ပါ',
    'Try a different name or clear the filters.': 'အခြားအမည်ဖြင့် ရှာကြည့်ပါ သို့မဟုတ် စစ်ထုတ်မှုကို ရှင်းလင်းပါ။',
    'Hypertension': 'သွေးတိုးရောဂါ',
    'Diabetes': 'ဆီးချိုရောဂါ',
    'Asthma': 'ပန်းနာရင်ကြပ်',
    'Dengue fever': 'သွေးလွန်တုပ်ကွေး',
    'Tuberculosis (TB)': 'တီဘီရောဂါ (အဆုတ်နာ)',
    'Malaria': 'ငှက်ဖျားရောဂါ',
    'Hepatitis B': 'အသည်းရောင် အသားဝါ ဘီ',
    'Coronary heart disease': 'နှလုံးသွေးကြောကျဉ်းရောဂါ',
    'Stroke': 'လေဖြတ်ခြင်း',
    'Anemia': 'သွေးအားနည်းရောဂါ',
    'Typhoid fever': 'အူရောင်ငန်းဖျား',
    'Pre-eclampsia': 'ကိုယ်ဝန်ဆောင် သွေးတိုးရောဂါ',
    'High blood pressure': 'သွေးတိုးရောဂါ',
    'High blood pressure often has no symptoms but raises the risk of stroke and heart disease over time.':
      'သွေးတိုးရောဂါသည် လက္ခဏာမပြတတ်သော်လည်း ကာလကြာလာသည်နှင့်အမျှ လေဖြတ်ခြင်းနှင့် နှလုံးရောဂါ ဖြစ်နိုင်ခြေကို မြင့်တက်စေသည်။',
    'A long-term condition where blood sugar levels are too high, manageable with diet, exercise, and medication.':
      'သွေးတွင်းသကြားဓာတ် မြင့်မားသော နာတာရှည်ရောဂါဖြစ်ပြီး အစားအသောက်၊ လေ့ကျင့်ခန်းနှင့် ဆေးဖြင့် ထိန်းညှိနိုင်သည်။',
    'Airways narrow and swell, causing wheezing and shortness of breath — usually controlled with inhalers.':
      'အသက်ရှူလမ်းကြောင်း ကျဉ်းပြီး ရောင်ရမ်းကာ ရင်ကြပ်ခြင်းနှင့် အသက်ရှူရခက်ခြင်း ဖြစ်စေသည် — များသောအားဖြင့် အသက်ရှူဆေးဖြင့် ထိန်းနိုင်သည်။',
    'A mosquito-borne viral illness common in the rainy season, causing high fever, body aches, and rash.':
      'မိုးရာသီတွင် အဖြစ်များသော ခြင်မှတစ်ဆင့် ကူးစက်သည့် ဗိုင်းရပ်စ်ရောဂါဖြစ်ပြီး ဖျားခြင်း၊ ကိုယ်လက်ကိုက်ခဲခြင်းနှင့် အနီစက်များ ထွက်ခြင်း ဖြစ်စေသည်။',
    'A bacterial infection mainly affecting the lungs, treatable with a full course of antibiotics.':
      'အဓိကအားဖြင့် အဆုတ်ကို ထိခိုက်စေသော ဘက်တီးရီးယားပိုးကူးစက်မှုဖြစ်ပြီး ပဋိဇီဝဆေးအပြည့်အဝ သောက်ခြင်းဖြင့် ပျောက်ကင်းနိုင်သည်။',
    'A mosquito-borne parasitic disease that causes cyclic fever and chills; preventable with nets and repellents.':
      'ခြင်မှတစ်ဆင့် ကူးစက်သည့် ကပ်ပါးပိုးရောဂါဖြစ်ပြီး အဖျားနှင့် ချမ်းတုန်ခြင်း အလှည့်ကျဖြစ်စေသည်။ ခြင်ထောင်နှင့် ခြင်ဆေးဖြင့် ကာကွယ်နိုင်သည်။',
    'A liver infection that can become long-term; a safe vaccine prevents it and testing catches it early.':
      'နာတာရှည်ဖြစ်နိုင်သော အသည်းရောင်ရောဂါဖြစ်ပြီး ကာကွယ်ဆေးဖြင့် ကာကွယ်နိုင်ကာ စစ်ဆေးမှုဖြင့် စောစီးစွာ သိရှိနိုင်သည်။',
    'Narrowed arteries reduce blood flow to the heart and can cause chest pain or a heart attack.':
      'သွေးကြောများ ကျဉ်းလာခြင်းကြောင့် နှလုံးသို့ သွေးစီးဆင်းမှု လျော့နည်းပြီး ရင်ဘတ်အောင့်ခြင်း သို့မဟုတ် နှလုံးရောဂါ ဖြစ်စေနိုင်သည်။',
    'A sudden interruption of blood to the brain — act fast; call an ambulance if you notice F.A.S.T. signs.':
      'ဦးနှောက်သို့ သွေးစီးဆင်းမှု ရုတ်တရက် ရပ်တန့်ခြင်းဖြစ်သည် — အမြန်လုပ်ဆောင်ပါ။ F.A.S.T. လက္ခဏာများ တွေ့ပါက လူနာတင်ယာဉ် ခေါ်ပါ။',
    'Low red blood cell counts cause fatigue and weakness; iron-rich foods and supplements often help.':
      'သွေးနီဥ နည်းပါးခြင်းကြောင့် မောပန်းခြင်းနှင့် အားနည်းခြင်း ဖြစ်စေသည်။ သံဓာတ်ကြွယ်ဝသော အစားအစာနှင့် ဖြည့်စွက်ဆေးများ အထောက်အကူဖြစ်သည်။',
    'A bacterial infection spread through contaminated food or water — safe hygiene and vaccination help prevent it.':
      'ညစ်ညမ်းသော အစားအစာ သို့မဟုတ် ရေမှတစ်ဆင့် ကူးစက်သည့် ဘက်တီးရီးယားရောဂါဖြစ်ပြီး သန့်ရှင်းရေးနှင့် ကာကွယ်ဆေးဖြင့် ကာကွယ်နိုင်သည်။',
    'A pregnancy complication with high blood pressure — regular antenatal check-ups are essential.':
      'ကိုယ်ဝန်ဆောင်စဉ် သွေးတိုးခြင်းကြောင့် ဖြစ်ပေါ်သော နောက်ဆက်တွဲပြဿနာဖြစ်ပြီး ပုံမှန် ကိုယ်ဝန်ဆောင်စစ်ဆေးမှု မရှိမဖြစ် လိုအပ်သည်။',

    /* --- hospitals --- */
    'Find hospitals': 'ဆေးရုံရှာရန်',
    'Search hospitals and clinics across Yangon townships. Filter by type or find one with a 24-hour emergency room near you.':
      'ရန်ကုန်မြို့နယ်များရှိ ဆေးရုံနှင့် ဆေးခန်းများကို ရှာဖွေပါ။ အမျိုးအစားအလိုက် စစ်ထုတ်ပါ သို့မဟုတ် ၂၄ နာရီ အရေးပေါ်ဌာနရှိသည့် ဆေးရုံကို ရှာပါ။',
    'Hospital type': 'ဆေးရုံအမျိုးအစား',
    'General': 'အထွေထွေ',
    'Specialist': 'အထူးကု',
    'Clinic': 'ဆေးခန်း',
    'Emergency / ER': 'အရေးပေါ်ဌာန',
    'Search by hospital name or area…': 'ဆေးရုံအမည် သို့မဟုတ် ဒေသဖြင့် ရှာရန်…',
    'hospitals': 'ဆေးရုံများ',
    'hospital': 'ဆေးရုံ',
    'found': 'တွေ့ရှိသည်',
    'ER available': 'အရေးပေါ်ဌာန ရှိသည်',
    'Open 24 hours': '၂၄ နာရီ ဖွင့်',
    'Mon–Fri, 8:00–16:00': 'တနင်္လာ–သောကြာ၊ ၈:၀၀–၁၆:၀၀',
    'No hospitals match your filters': 'သင့်စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ဆေးရုံ မတွေ့ပါ',
    'Try a different township, remove a hospital-type filter, or clear your search to see all hospitals in Yangon.':
      'အခြားမြို့နယ်ကို ရွေးပါ၊ ဆေးရုံအမျိုးအစား စစ်ထုတ်မှုကို ဖယ်ပါ သို့မဟုတ် ရန်ကုန်ရှိ ဆေးရုံအားလုံး ကြည့်ရန် ရှာဖွေမှုကို ရှင်းပါ။',

    /* --- townships (select options and card rows) --- */
    'Bahan': 'ဗဟန်း', 'Bahan Township': 'ဗဟန်းမြို့နယ်',
    'Dagon': 'ဒဂုံ', 'Dagon Township': 'ဒဂုံမြို့နယ်',
    'Hlaing': 'လှိုင်', 'Hlaing Township': 'လှိုင်မြို့နယ်',
    'Hlaing Tharyar': 'လှိုင်သာယာ', 'Hlaing Tharyar Township': 'လှိုင်သာယာမြို့နယ်',
    'Insein': 'အင်းစိန်', 'Insein Township': 'အင်းစိန်မြို့နယ်',
    'Kamayut': 'ကမာရွတ်', 'Kamayut Township': 'ကမာရွတ်မြို့နယ်',
    'Lanmadaw': 'လမ်းမတော်', 'Lanmadaw Township': 'လမ်းမတော်မြို့နယ်',
    'Latha': 'လသာ', 'Latha Township': 'လသာမြို့နယ်',
    'Mayangone': 'မရမ်းကုန်း', 'Mayangone Township': 'မရမ်းကုန်းမြို့နယ်',
    'Mingaladon': 'မင်္ဂလာဒုံ', 'Mingaladon Township': 'မင်္ဂလာဒုံမြို့နယ်',
    'North Dagon': 'မြောက်ဒဂုံ', 'North Dagon Township': 'မြောက်ဒဂုံမြို့နယ်',
    'North Okkalapa': 'မြောက်ဥက္ကလာပ', 'North Okkalapa Township': 'မြောက်ဥက္ကလာပမြို့နယ်',
    'Pabedan': 'ပန်းဘဲတန်း', 'Pabedan Township': 'ပန်းဘဲတန်းမြို့နယ်',
    'Sanchaung': 'စမ်းချောင်း', 'Sanchaung Township': 'စမ်းချောင်းမြို့နယ်',
    'Shwe Pyi Thar': 'ရွှေပြည်သာ', 'Shwe Pyi Thar Township': 'ရွှေပြည်သာမြို့နယ်',
    'South Dagon': 'တောင်ဒဂုံ', 'South Dagon Township': 'တောင်ဒဂုံမြို့နယ်',
    'South Okkalapa': 'တောင်ဥက္ကလာပ', 'South Okkalapa Township': 'တောင်ဥက္ကလာပမြို့နယ်',
    'Tamwe': 'တာမွေ', 'Tamwe Township': 'တာမွေမြို့နယ်',
    'Thaketa': 'သာကေတ', 'Thaketa Township': 'သာကေတမြို့နယ်',
    'Thingangyun': 'သင်္ဃန်းကျွန်း', 'Thingangyun Township': 'သင်္ဃန်းကျွန်းမြို့နယ်',
    'Yankin': 'ရန်ကင်း', 'Yankin Township': 'ရန်ကင်းမြို့နယ်',

    /* --- pharmacy --- */
    'Find a Pharmacy': 'ဆေးဆိုင်ရှာရန်',
    'Pharmacies and drug stores across Yangon townships. Filter for one that is open 24 hours or delivers to your home.':
      'ရန်ကုန်မြို့နယ်များရှိ ဆေးဆိုင်များ။ ၂၄ နာရီဖွင့်သော သို့မဟုတ် အိမ်အရောက်ပို့ဆောင်ပေးသော ဆိုင်များကို စစ်ထုတ်ရှာနိုင်ပါသည်။',
    'Pharmacy type': 'ဆေးဆိုင်အမျိုးအစား',
    'Chain pharmacy': 'ဆိုင်ခွဲများရှိ ဆေးဆိုင်',
    'Clinic pharmacy': 'ဆေးခန်းဆေးဆိုင်',
    'Hospital or clinic pharmacy': 'ဆေးရုံ သို့မဟုတ် ဆေးခန်း ဆေးဆိုင်',
    'Independent': 'ကိုယ်ပိုင်ဆေးဆိုင်',
    'Hospital pharmacy': 'ဆေးရုံဆေးဆိုင်',
    'Services': 'ဝန်ဆောင်မှုများ',
    'Home delivery': 'အိမ်အရောက် ပို့ဆောင်မှု',
    'Fills prescriptions': 'ဆေးညွှန်းအတိုင်း ထုတ်ပေးသည်',
    'Search by pharmacy name or area…': 'ဆေးဆိုင်အမည် သို့မဟုတ် ဒေသဖြင့် ရှာရန်…',
    'pharmacies': 'ဆေးဆိုင်များ',
    'pharmacy': 'ဆေးဆိုင်',
    'No pharmacies match your filters': 'သင့်စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ဆေးဆိုင် မတွေ့ပါ',
    'Try a different township, remove a service filter, or clear your search to see all pharmacies in Yangon.':
      'အခြားမြို့နယ်ကို ရွေးပါ၊ ဝန်ဆောင်မှုစစ်ထုတ်မှုကို ဖယ်ပါ သို့မဟုတ် ရန်ကုန်ရှိ ဆေးဆိုင်အားလုံး ကြည့်ရန် ရှာဖွေမှုကို ရှင်းပါ။',
    'Buying medicine safely': 'ဆေးဝါး လုံခြုံစွာ ဝယ်ယူခြင်း',
    'A pharmacist can advise on everyday remedies, but some medicines need a doctor first.':
      'ဆေးဝါးကျွမ်းကျင်သူသည် နေ့စဉ်သုံးဆေးများအတွက် အကြံပေးနိုင်သော်လည်း အချို့ဆေးများမှာ ဆရာဝန်နှင့် ဦးစွာ တိုင်ပင်ရန် လိုအပ်သည်။',
    'Antibiotics need a prescription. Taking them for colds and flu does not help, and it makes infections harder to treat later.':
      'ပဋိဇီဝဆေးများသည် ဆေးညွှန်း လိုအပ်သည်။ အအေးမိခြင်းနှင့် တုပ်ကွေးအတွက် သောက်ခြင်းသည် အကျိုးမရှိဘဲ နောင်တွင် ပိုးကုသရန် ပိုခက်စေသည်။',
    'Check the expiry date and that the packaging is sealed before you pay.':
      'ငွေမပေးမီ သက်တမ်းကုန်ဆုံးရက်နှင့် ထုပ်ပိုးမှု ကောင်းမကောင်းကို စစ်ဆေးပါ။',
    'Tell the pharmacist what else you take, including traditional medicines, so they can check for interactions.':
      'တိုင်းရင်းဆေးအပါအဝင် အခြားသောက်နေသည့် ဆေးများကို ဆေးဆိုင်ရှင်အား ပြောပြပါ။ ဆေးချင်း ဓာတ်တိုက်မှု ရှိမရှိ စစ်ဆေးနိုင်ရန်ဖြစ်သည်။',
    'Finish the full course your doctor prescribed, even once you feel better.':
      'သက်သာလာသည့်တိုင် ဆရာဝန်ညွှန်ကြားထားသော ဆေးကို အပြည့်အဝ သောက်ပါ။',

    /* --- emergency contacts --- */
    'In a life-threatening emergency, call immediately.':
      'အသက်အန္တရာယ်ရှိသော အရေးပေါ်အခြေအနေတွင် ချက်ချင်း ဖုန်းခေါ်ပါ။',
    'Emergency contacts': 'အရေးပေါ်ဆက်သွယ်ရန်',
    'Tap any number below to call. Keep this page saved on your phone so you can reach help fast.':
      'ခေါ်ဆိုရန် အောက်ပါနံပါတ်တစ်ခုကို နှိပ်ပါ။ အကူအညီ မြန်မြန်ရရှိရန် ဤစာမျက်နှာကို ဖုန်းတွင် သိမ်းထားပါ။',
    'Ambulance': 'လူနာတင်ယာဉ်',
    'Medical emergencies, serious injuries, and urgent hospital transport.':
      'ဆေးဘက်ဆိုင်ရာ အရေးပေါ်၊ ပြင်းထန်သော ဒဏ်ရာနှင့် အရေးပေါ် ဆေးရုံပို့ဆောင်မှု။',
    'Call ambulance': 'လူနာတင်ယာဉ် ခေါ်ရန်',
    'Fire Services': 'မီးသတ်ဌာန',
    'Fires, gas leaks, building collapse, and rescue situations.':
      'မီးလောင်မှု၊ ဓာတ်ငွေ့ယိုစိမ့်မှု၊ အဆောက်အအုံပြိုကျမှုနှင့် ကယ်ဆယ်ရေး အခြေအနေများ။',
    'Call fire services': 'မီးသတ်ဌာန ခေါ်ရန်',
    'Police': 'ရဲတပ်ဖွဲ့',
    'Crime, violence, road accidents, and any situation needing police help.':
      'ရာဇဝတ်မှု၊ အကြမ်းဖက်မှု၊ ယာဉ်မတော်တဆမှုနှင့် ရဲအကူအညီ လိုအပ်သည့် အခြေအနေများ။',
    'Call police': 'ရဲ ခေါ်ရန်',
    'Poison Control': 'အဆိပ်ဖြေဌာန',
    'Swallowed chemicals, medicine overdose, snake bites, or food poisoning.':
      'ဓာတုပစ္စည်း မျိုချမိခြင်း၊ ဆေးလွန်ကဲစွာ သောက်မိခြင်း၊ မြွေကိုက်ခြင်း သို့မဟုတ် အစားအစာ အဆိပ်သင့်ခြင်း။',
    'Call poison control': 'အဆိပ်ဖြေဌာန ခေါ်ရန်',
    'Other helplines': 'အခြား အကူအညီ ဖုန်းလိုင်းများ',
    'Support services available across Yangon and Myanmar.':
      'ရန်ကုန်နှင့် မြန်မာတစ်နိုင်ငံလုံးတွင် ရရှိနိုင်သော ဝန်ဆောင်မှုများ။',
    'Yangon General Hospital ER': 'ရန်ကုန်ဆေးရုံကြီး အရေးပေါ်ဌာန',
    'Public Health Hotline': 'ပြည်သူ့ကျန်းမာရေး ဖုန်းလိုင်း',
    'Mental Health Support': 'စိတ်ကျန်းမာရေး အကူအညီ',
    'Disaster & Rescue': 'သဘာဝဘေးနှင့် ကယ်ဆယ်ရေး',
    'Blood Bank (Yangon)': 'သွေးဘဏ် (ရန်ကုန်)',
    'Women & Child Helpline': 'အမျိုးသမီးနှင့် ကလေး အကူအညီလိုင်း',
    'What to say when you call': 'ဖုန်းခေါ်သည့်အခါ ပြောရမည့် အချက်များ',
    'State your exact location first — street, township, and a nearby landmark.':
      'သင်ရှိသည့် တည်နေရာအတိအကျကို ဦးစွာပြောပါ — လမ်း၊ မြို့နယ်နှင့် အနီးအနားရှိ မှတ်သားဖွယ်နေရာ။',
    'Say what happened and how many people are hurt.':
      'ဘာဖြစ်ခဲ့သည်နှင့် လူဘယ်နှစ်ဦး ဒဏ်ရာရသည်ကို ပြောပါ။',
    'Describe whether the person is breathing and conscious.':
      'လူနာသည် အသက်ရှူနေသလား၊ သတိရှိနေသလား ဖော်ပြပါ။',
    'Give your name and phone number, and stay on the line until told to hang up.':
      'သင့်အမည်နှင့် ဖုန်းနံပါတ်ကို ပေးပါ။ ဖုန်းချရန် မပြောမချင်း လိုင်းပေါ်တွင် စောင့်ပါ။',

    /* --- hypertension detail --- */
    'Chronic condition': 'နာတာရှည်ရောဂါ',
    'Symptoms': 'ရောဂါလက္ခဏာများ',
    "Do's": 'လုပ်သင့်သည်များ',
    'Do’s': 'လုပ်သင့်သည်များ',
    "Don'ts": 'မလုပ်သင့်သည်များ',
    'Don’ts': 'မလုပ်သင့်သည်များ',
    'When to see a doctor': 'ဆရာဝန်နှင့် ဘယ်အချိန် ပြသင့်သလဲ',
    'Hypertension, or high blood pressure, is a common long-term condition where the force of blood against the artery walls stays higher than normal.':
      'သွေးတိုးရောဂါဆိုသည်မှာ သွေးကြောနံရံများပေါ်သို့ သွေးဖိအားက ပုံမှန်ထက် မြင့်နေသော အဖြစ်များသည့် နာတာရှည်ရောဂါဖြစ်သည်။',
    'It usually causes no symptoms, which is why it is often called a "silent" condition. The good news is that it can be well managed — with regular check-ups, a balanced diet, and, when needed, medication, most people live full and active lives.':
      'များသောအားဖြင့် လက္ခဏာမပြသဖြင့် “တိတ်တဆိတ်ရောဂါ” ဟု ခေါ်ကြသည်။ ဝမ်းသာစရာမှာ ကောင်းစွာ ထိန်းညှိနိုင်ခြင်းဖြစ်သည် — ပုံမှန်ဆေးစစ်ခြင်း၊ မျှတသော အစားအသောက်နှင့် လိုအပ်ပါက ဆေးဝါးဖြင့် အများစုသည် ကျန်းမာစွာ နေထိုင်နိုင်ပါသည်။',
    'Hypertension — key facts, prevention, and management guidance.':
      'သွေးတိုးရောဂါ — အဓိကအချက်များ၊ ကာကွယ်ရေးနှင့် ထိန်းညှိမှု လမ်းညွှန်။',
    'National guidelines on non-communicable disease care and blood pressure management.':
      'မကူးစက်တတ်သောရောဂါ စောင့်ရှောက်မှုနှင့် သွေးပေါင်ချိန် ထိန်းညှိမှုဆိုင်ရာ အမျိုးသားအဆင့် လမ်းညွှန်ချက်များ။',
    'WHO Regional Office for South-East Asia': 'WHO အရှေ့တောင်အာရှ ဒေသဆိုင်ရာရုံး',
    'HEARTS technical package for cardiovascular disease management in primary care.':
      'အခြေခံကျန်းမာရေးစောင့်ရှောက်မှုတွင် နှလုံးသွေးကြောရောဂါ ထိန်းညှိရန် HEARTS နည်းပညာအစီအစဉ်။',
    'Last reviewed: July 2026 · Reviewed by the MedCare medical editorial team.':
      'နောက်ဆုံးစိစစ်သည့်ရက်− ၂၀၂၆ ဇူလိုင် · MedCare ဆေးပညာအယ်ဒီတာအဖွဲ့မှ စိစစ်ထားပါသည်။',
    'Most people have no symptoms. When blood pressure is very high, some may notice:':
      'အများစုမှာ လက္ခဏာမပြပါ။ သွေးပေါင်ချိန် အလွန်မြင့်သည့်အခါ အချို့တွင် အောက်ပါတို့ ခံစားရနိုင်သည်။',
    'Headaches, especially at the back of the head': 'ခေါင်းကိုက်ခြင်း၊ အထူးသဖြင့် ခေါင်းနောက်ပိုင်း',
    'Dizziness or a feeling of light-headedness': 'မူးဝေခြင်း သို့မဟုတ် ခေါင်းပေါ့သလို ခံစားရခြင်း',
    'Blurred or double vision': 'အမြင်ဝါးခြင်း သို့မဟုတ် နှစ်ထပ်မြင်ခြင်း',
    'Shortness of breath or chest discomfort': 'အသက်ရှူမဝခြင်း သို့မဟုတ် ရင်ဘတ်မသက်မသာဖြစ်ခြင်း',
    'Nosebleeds (uncommon)': 'နှာခေါင်းသွေးထွက်ခြင်း (ရှားပါးသည်)',
    'Older adults over 40 years old.': 'အသက် ၄၀ ကျော် သက်ကြီးရွယ်အိုများ။',
    'People with a family history of hypertension.':
      'မိသားစုတွင် သွေးတိုး မျိုးရိုးရှိသူများ။',
    "Individuals with a high-salt diet who don't have a helthy habits.":
      'ဆားငန်သော အစားအစာ များများ စားပြီး ကျန်းမာသော အလေ့အထ မရှိသူများ။',
    'People experiencing high stress levels.': 'စိတ်ဖိစီးမှု များပြားသူများ။',
    'Check your blood pressure regularly, at home or at a clinic.':
      'အိမ်တွင် သို့မဟုတ် ဆေးခန်းတွင် သွေးပေါင်ချိန်ကို ပုံမှန် တိုင်းပါ။',
    'Eat more vegetables, fruit, and whole grains; reduce salty foods.':
      'ဟင်းသီးဟင်းရွက်၊ သစ်သီးနှင့် အစေ့အဆန်များ ပိုစားပါ။ ဆားငန်သော အစားအစာ လျှော့ပါ။',
    'Stay physically active — aim for about 30 minutes most days.':
      'ကိုယ်လက်လှုပ်ရှားမှု ရှိပါစေ — နေ့စဉ်နီးပါး ၃၀ မိနစ်ခန့် ရည်မှန်းပါ။',
    'Take your prescribed medicines exactly as directed, every day.':
      'ညွှန်ကြားထားသည့်အတိုင်း ဆေးကို နေ့စဉ် မှန်မှန် သောက်ပါ။',
    'Keep a healthy weight and manage stress with rest and support.':
      'ကျန်းမာသော ကိုယ်အလေးချိန် ထိန်းပါ။ အနားယူခြင်းနှင့် အထောက်အပံ့ဖြင့် စိတ်ဖိစီးမှုကို ဖြေလျှော့ပါ။',
    "Don't stop your medication on your own, even if you feel well.":
      'နေကောင်းသည်ဟု ခံစားရသော်လည်း ဆေးကို ကိုယ်တိုင်သဘောနှင့် မရပ်ပါနှင့်။',
    "Don't add extra salt, fish sauce, or salty snacks to meals.":
      'အစားအစာတွင် ဆား၊ ငါးငံပြာရည် သို့မဟုတ် ဆားငန်မုန့်များ ထပ်မထည့်ပါနှင့်။',
    "Don't smoke, and limit alcohol as much as possible.":
      'ဆေးလိပ် မသောက်ပါနှင့်။ အရက်ကိုလည်း တတ်နိုင်သမျှ လျှော့ပါ။',
    "Don't ignore regular check-ups, even when you have no symptoms.":
      'လက္ခဏာမရှိသည့်တိုင် ပုံမှန်စစ်ဆေးမှုကို လျစ်လျူမရှုပါနှင့်။',
    "Don't rely on unproven remedies in place of medical care.":
      'ဆေးကုသမှုအစား အတည်မပြုရသေးသော နည်းလမ်းများကို အားမကိုးပါနှင့်။',
    'See a healthcare worker if your readings are often high, or seek care promptly if you notice any of these:':
      'သွေးပေါင်ချိန် မကြာခဏ မြင့်နေပါက ကျန်းမာရေးဝန်ထမ်းနှင့် ပြပါ။ အောက်ပါတို့ တွေ့ပါက ချက်ချင်း ဆေးကုသမှု ခံယူပါ။',
    'A very high reading (for example, 180/120 or above)':
      'အလွန်မြင့်သော အတိုင်းအတာ (ဥပမာ ၁၈၀/၁၂၀ သို့မဟုတ် အထက်)',
    'Severe headache with blurred vision or confusion':
      'ပြင်းထန်သော ခေါင်းကိုက်ခြင်းနှင့်အတူ အမြင်ဝါးခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်း',
    'Chest pain, difficulty breathing, or an irregular heartbeat':
      'ရင်ဘတ်အောင့်ခြင်း၊ အသက်ရှူရခက်ခြင်း သို့မဟုတ် နှလုံးခုန်နှုန်း မမှန်ခြင်း',
    'Weakness or numbness on one side of the body, or trouble speaking':
      'ကိုယ်တစ်ခြမ်း အားနည်းခြင်း သို့မဟုတ် ထုံကျဉ်ခြင်း၊ စကားပြောရ ခက်ခဲခြင်း',

    /* --- shared across every disease detail page --- */
    'Risk Groups': 'ဘယ်သူတွေမှာ အဖြစ်များလဲ',
    'Respiratory condition': 'အသက်ရှူလမ်းကြောင်းဆိုင်ရာ ရောဂါ',
    'Infectious disease': 'ကူးစက်ရောဂါ',
    'Maternal health': 'မိခင်ကျန်းမာရေး',

    /* --- diabetes detail --- */
    'Diabetes is a long-term condition in which the level of sugar (glucose) in the blood stays too high, because the body either does not make enough insulin or cannot use it properly.':
      'ဆီးချိုရောဂါဆိုသည်မှာ ခန္ဓာကိုယ်မှ အင်ဆူလင် လုံလောက်စွာ မထုတ်နိုင်ခြင်း သို့မဟုတ် ကောင်းစွာ အသုံးမပြုနိုင်ခြင်းကြောင့် သွေးတွင်း သကြားဓာတ် ပုံမှန်ထက် မြင့်နေသော နာတာရှည်ရောဂါ ဖြစ်သည်။',
    'Insulin is the hormone that moves sugar out of the blood and into the cells that need it for energy. When that process breaks down, sugar builds up in the bloodstream and, over years, can quietly damage the eyes, kidneys, nerves, and blood vessels. Diabetes cannot usually be cured, but it responds very well to daily care — balanced meals, regular movement, and medication when it is prescribed.':
      'အင်ဆူလင်သည် သွေးထဲမှ သကြားဓာတ်ကို စွမ်းအင်လိုအပ်သည့် ဆဲလ်များထဲသို့ ပို့ပေးသော ဟော်မုန်း ဖြစ်သည်။ ထိုလုပ်ငန်းစဉ် ချို့ယွင်းသွားပါက သကြားဓာတ်သည် သွေးထဲတွင် စုပုံလာပြီး နှစ်များကြာလာသည်နှင့်အမျှ မျက်စိ၊ ကျောက်ကပ်၊ အာရုံကြောနှင့် သွေးကြောများကို တိတ်တဆိတ် ထိခိုက်စေနိုင်သည်။ ဆီးချိုကို လုံးဝ ပျောက်ကင်းအောင် ကုသ၍ မရသော်လည်း မျှတသော အစားအသောက်၊ ပုံမှန် လှုပ်ရှားမှုနှင့် ညွှန်ကြားထားသည့် ဆေးဝါးဖြင့် ကောင်းစွာ ထိန်းညှိနိုင်ပါသည်။',
    'Symptoms can come on slowly over months, and some people notice very little at first:':
      'လက္ခဏာများသည် လများကြာမှ တဖြည်းဖြည်း ပေါ်လာတတ်ပြီး အချို့မှာ အစပိုင်းတွင် သိသာမှု နည်းပါသည်။',
    'Feeling thirsty much of the time, even after drinking':
      'ရေသောက်ပြီးသော်လည်း အမြဲလိုလို ရေငတ်နေခြင်း',
    'Passing urine often, especially waking at night to do so':
      'ဆီးခဏခဏ သွားခြင်း၊ အထူးသဖြင့် ညဘက် နိုးပြီး ဆီးသွားရခြင်း',
    'Feeling hungry constantly, even shortly after eating':
      'ထမင်းစားပြီး မကြာမီပင် ထပ်မံ ဆာလောင်နေခြင်း',
    'Losing weight without trying to': 'အကြောင်းမဲ့ ကိုယ်အလေးချိန် ကျဆင်းခြင်း',
    'Tiredness, blurred vision, or cuts that are slow to heal':
      'နွမ်းနယ်ခြင်း၊ အမြင်ဝါးခြင်း သို့မဟုတ် ဒဏ်ရာများ ကျက်ရန် ကြာခြင်း',
    'People with a parent or sibling who has diabetes.':
      'မိဘ သို့မဟုတ် မောင်နှမတွင် ဆီးချိုရှိသူများ။',
    'People who are overweight, particularly around the waist.':
      'အဝလွန်သူများ၊ အထူးသဖြင့် ခါးပတ်လည်တွင် အဆီများသူများ။',
    'Those who eat a lot of sugary food and sweetened drinks.':
      'အချိုစာနှင့် အချိုရည်များ များများ သုံးဆောင်သူများ။',
    'People who sit for most of the day and rarely exercise.':
      'တစ်နေ့တာ အများစု ထိုင်နေပြီး လေ့ကျင့်ခန်း မလုပ်သူများ။',
    'Check your blood sugar as often as your clinic advises.':
      'ဆေးခန်းမှ ညွှန်ကြားသည့်အတိုင်း သွေးတွင်း သကြားဓာတ်ကို ပုံမှန် စစ်ဆေးပါ။',
    'Fill half your plate with vegetables and choose whole grains over white rice where you can.':
      'ပန်းကန်၏ တစ်ဝက်ကို ဟင်းသီးဟင်းရွက်ဖြင့် ဖြည့်ပါ။ ဖြစ်နိုင်ပါက ဆန်ဖြူအစား အစေ့အဆန်များကို ရွေးပါ။',
    'Walk or move for about 30 minutes on most days of the week.':
      'တစ်ပတ်လျှင် နေ့အများစုတွင် ၃၀ မိနစ်ခန့် လမ်းလျှောက်ပါ သို့မဟုတ် လှုပ်ရှားပါ။',
    'Take your tablets or insulin exactly as prescribed, at the same times each day.':
      'ဆေးလုံး သို့မဟုတ် အင်ဆူလင်ကို ညွှန်ကြားထားသည့်အတိုင်း နေ့စဉ် အချိန်မှန်မှန် သုံးပါ။',
    'Look at your feet every day for cuts, blisters, or numbness.':
      'ခြေထောက်များတွင် ဒဏ်ရာ၊ ရေဖုံး သို့မဟုတ် ထုံကျဉ်မှု ရှိမရှိ နေ့စဉ် စစ်ဆေးပါ။',
    "Don't skip meals or skip your medicine — both can send your sugar dangerously low.":
      'အစားအစာကိုဖြစ်စေ ဆေးကိုဖြစ်စေ မလွတ်ပါစေနှင့် — နှစ်မျိုးလုံးက သွေးတွင်း သကြားဓာတ်ကို အန္တရာယ်ရှိလောက်အောင် နည်းသွားစေနိုင်သည်။',
    "Don't drink sweetened tea, soft drinks, or energy drinks between meals.":
      'အစားအစာကြားတွင် ချိုသော လက်ဖက်ရည်၊ အအေးဘူး သို့မဟုတ် အားဖြည့်အချိုရည်များ မသောက်ပါနှင့်။',
    "Don't walk barefoot, indoors or outside.":
      'အိမ်တွင်းဖြစ်စေ အပြင်ဖြစ်စေ ခြေဗလာ မလျှောက်ပါနှင့်။',
    "Don't stop treatment because your readings have improved.":
      'အတိုင်းအတာ ကောင်းလာသည်ဟုဆိုကာ ကုသမှုကို မရပ်ပါနှင့်။',
    "Don't ignore a wound that isn't healing after a few days.":
      'ရက်အနည်းငယ်ကြာသည်အထိ မကျက်သေးသော ဒဏ်ရာကို လျစ်လျူမရှုပါနှင့်။',
    'Have your blood sugar checked if you notice the symptoms above, and seek care promptly for any of these:':
      'အထက်ပါ လက္ခဏာများ တွေ့ပါက သွေးတွင်း သကြားဓာတ် စစ်ဆေးပါ။ အောက်ပါတို့ ဖြစ်ပါက ချက်ချင်း ဆေးကုသမှု ခံယူပါ။',
    'Blood sugar that is very high, or very low with shaking, sweating, and confusion':
      'သွေးတွင်း သကြားဓာတ် အလွန်မြင့်ခြင်း၊ သို့မဟုတ် အလွန်နည်းပြီး တုန်ခြင်း၊ ချွေးထွက်ခြင်းနှင့် စိတ်ရှုပ်ထွေးခြင်း',
    'A cut, sore, or ulcer — especially on the foot — that will not heal':
      'မကျက်သော ဒဏ်ရာ သို့မဟုတ် အနာ — အထူးသဖြင့် ခြေထောက်ပေါ်တွင်',
    'Numbness, tingling, or burning in the hands or feet':
      'လက်ခြေများတွင် ထုံကျဉ်ခြင်း၊ ကျိန်းစပ်ခြင်း သို့မဟုတ် ပူလောင်ခြင်း',
    'Sudden blurred vision, or breath that smells fruity with heavy breathing and vomiting':
      'ရုတ်တရက် အမြင်ဝါးခြင်း၊ သို့မဟုတ် ထွက်သက်တွင် အသီးနံ့ရပြီး အသက်ပြင်းပြင်းရှူကာ အန်ခြင်း',
    'Diabetes — key facts, types, complications, and prevention.':
      'ဆီးချိုရောဂါ — အဓိကအချက်များ၊ အမျိုးအစားများ၊ နောက်ဆက်တွဲ ဆိုးကျိုးများနှင့် ကာကွယ်ရေး။',
    'National guidelines on non-communicable disease care and diabetes services.':
      'မကူးစက်တတ်သောရောဂါ စောင့်ရှောက်မှုနှင့် ဆီးချို ဝန်ဆောင်မှုဆိုင်ရာ အမျိုးသားအဆင့် လမ်းညွှန်ချက်များ။',
    'Diabetes prevention and management in primary health care across the region.':
      'ဒေသတွင်း အခြေခံကျန်းမာရေး စောင့်ရှောက်မှုတွင် ဆီးချို ကာကွယ်ရေးနှင့် ထိန်းညှိမှု။',

    /* --- asthma detail --- */
    'Asthma is a long-term condition in which the airways become inflamed and narrow, making it harder to move air in and out of the lungs.':
      'ပန်းနာရင်ကြပ်ဆိုသည်မှာ အသက်ရှူလမ်းကြောင်းများ ရောင်ရမ်းကျဉ်းမြောင်းလာပြီး အဆုတ်အတွင်းသို့ လေဝင်လေထွက် ခက်ခဲစေသော နာတာရှည်ရောဂါ ဖြစ်သည်။',
    'The narrowing usually comes and goes. Something in the environment — dust, smoke, pollen, cold air, or a chest infection — irritates the airways, the muscles around them tighten, and breathing suddenly becomes difficult. Between these flare-ups many people feel completely well. With the right inhalers and by learning your own triggers, asthma can be controlled well enough to work, study, and exercise normally.':
      'ကျဉ်းမြောင်းမှုသည် အလှည့်ကျ ဖြစ်လိုက်ပျောက်လိုက် ရှိတတ်သည်။ ဖုန်၊ မီးခိုး၊ ပန်းဝတ်မှုံ၊ အေးသောလေ သို့မဟုတ် ရင်ခေါင်းပိုးဝင်ခြင်းက အသက်ရှူလမ်းကြောင်းကို လှုံ့ဆော်လိုက်သောအခါ ပတ်လည်ရှိ ကြွက်သားများ တင်းလာပြီး အသက်ရှူရ ရုတ်တရက် ခက်ခဲသွားသည်။ ထိုသို့ ပြင်းထန်ချိန်များ အကြားတွင် အများစုမှာ ပုံမှန်အတိုင်း နေကောင်းကြသည်။ သင့်တော်သော ရှူဆေးများနှင့် မိမိ၏ လှုံ့ဆော်အကြောင်းရင်းများကို သိရှိထားခြင်းဖြင့် အလုပ်၊ ကျောင်းနှင့် လေ့ကျင့်ခန်းကို ပုံမှန်အတိုင်း လုပ်နိုင်အောင် ထိန်းညှိနိုင်ပါသည်။',
    'Symptoms are often worse at night, in the early morning, or after exercise:':
      'လက္ခဏာများသည် ညဘက်၊ နံနက်စောစော သို့မဟုတ် လေ့ကျင့်ခန်းလုပ်ပြီးချိန်တွင် ပိုဆိုးလေ့ရှိသည်။',
    'Shortness of breath, or feeling unable to catch your breath':
      'အသက်ရှူမဝခြင်း သို့မဟုတ် အသက်ရှူမမီသလို ခံစားရခြင်း',
    'Wheezing — a whistling sound when breathing out':
      'ထွက်သက်တွင် တရွှီးရွှီး အသံမြည်ခြင်း',
    'A dry cough that keeps returning, often at night':
      'ခဏခဏ ပြန်ဖြစ်တတ်သော ချောင်းခြောက်ဆိုးခြင်း၊ အများအားဖြင့် ညဘက်',
    'Tightness in the chest, as though it is being squeezed':
      'ရင်ဘတ်ကို ဖိညှစ်ထားသကဲ့သို့ ကျပ်တည်းခြင်း',
    'Waking from sleep because of coughing or breathlessness':
      'ချောင်းဆိုးခြင်း သို့မဟုတ် မောဟိုက်ခြင်းကြောင့် အိပ်ရာမှ နိုးလာခြင်း',
    'People with allergies, eczema, or hay fever.':
      'ဓာတ်မတည့်ခြင်း၊ အရေပြားယားနာ သို့မဟုတ် နှာစေးနာ ရှိသူများ။',
    'Those with a family history of asthma or allergy.':
      'မိသားစုတွင် ပန်းနာ သို့မဟုတ် ဓာတ်မတည့်မှု မျိုးရိုးရှိသူများ။',
    'People regularly exposed to dust, cooking smoke, or tobacco smoke.':
      'ဖုန်၊ ထမင်းချက်မီးခိုး သို့မဟုတ် ဆေးလိပ်ငွေ့နှင့် မကြာခဏ ထိတွေ့သူများ။',
    'Children, in whom asthma often begins early in life.':
      'ကလေးများ — ပန်းနာသည် ငယ်စဉ်ကတည်းက စတင်တတ်သည်။',
    'Carry your reliever inhaler with you at all times.':
      'သက်သာစေသော ရှူဆေးကို အမြဲ ယူဆောင်သွားပါ။',
    'Use your preventer inhaler every day, even when you feel fine.':
      'နေကောင်းသည်ဟု ခံစားရသော်လည်း ကာကွယ်ရှူဆေးကို နေ့စဉ် သုံးပါ။',
    'Learn what sets off your attacks and keep away from it.':
      'သင့်ရောဂါကို လှုံ့ဆော်သည့် အရာများကို သိအောင်လုပ်ပြီး ရှောင်ပါ။',
    'Wear a mask when sweeping, in dusty places, or on smoky roads.':
      'တံမြက်လှည်းသည့်အခါ၊ ဖုန်ထူသောနေရာနှင့် မီးခိုးများသော လမ်းများတွင် နှာခေါင်းစည်း တပ်ပါ။',
    'Ask your clinic to check your inhaler technique now and then.':
      'ရှူဆေး သုံးပုံသုံးနည်း မှန်မမှန် ဆေးခန်းတွင် အခါအားလျော်စွာ စစ်ဆေးခိုင်းပါ။',
    "Don't smoke, and don't stay in rooms where others are smoking.":
      'ဆေးလိပ် မသောက်ပါနှင့်။ သူများ ဆေးလိပ်သောက်နေသည့် အခန်းတွင်လည်း မနေပါနှင့်။',
    "Don't stop your preventer inhaler once symptoms settle.":
      'လက္ခဏာများ သက်သာသွားသည်နှင့် ကာကွယ်ရှူဆေးကို မရပ်ပါနှင့်။',
    "Don't wait out a bad attack at home hoping it will pass.":
      'ပြင်းထန်စွာ ဖြစ်ပွားချိန်တွင် အလိုလို ပျောက်လိမ့်မည်ဟု အိမ်တွင် မစောင့်ပါနှင့်။',
    "Don't keep using a reliever inhaler that has run out or expired.":
      'ကုန်သွားပြီး သို့မဟုတ် သက်တမ်းလွန်နေသော ရှူဆေးကို ဆက်မသုံးပါနှင့်။',
    "Don't burn incense, mosquito coils, or rubbish near someone with asthma.":
      'ပန်းနာရှိသူ အနီးတွင် နံ့သာချောင်း၊ ခြင်ဆေးခွေ သို့မဟုတ် အမှိုက် မီးမရှို့ပါနှင့်။',
    'See a healthcare worker if you need your reliever more than twice a week. Seek emergency care immediately if you notice any of these:':
      'တစ်ပတ်လျှင် နှစ်ကြိမ်ထက်ပို၍ သက်သာဆေး သုံးရပါက ကျန်းမာရေးဝန်ထမ်းနှင့် ပြပါ။ အောက်ပါတို့ တွေ့ပါက ချက်ချင်း အရေးပေါ် ကုသမှု ခံယူပါ။',
    'Breathlessness that does not improve after using the inhaler':
      'ရှူဆေး သုံးပြီးသော်လည်း မောဟိုက်မှု မသက်သာခြင်း',
    'Being too breathless to speak a full sentence, eat, or sleep':
      'စကားတစ်ကြောင်းလုံး မပြောနိုင်၊ မစားနိုင်၊ မအိပ်နိုင်အောင် မောဟိုက်ခြင်း',
    'Lips, tongue, or fingernails turning blue or grey':
      'နှုတ်ခမ်း၊ လျှာ သို့မဟုတ် လက်သည်းများ ပြာနှမ်း သို့မဟုတ် မီးခိုးရောင် ဖြစ်လာခြင်း',
    'The chest drawing in sharply with each breath, or drowsiness and confusion':
      'အသက်ရှူတိုင်း ရင်ဘတ် ပြင်းပြင်းထန်ထန် ချိုင့်ဝင်ခြင်း၊ သို့မဟုတ် ငိုက်မျဉ်းပြီး စိတ်ရှုပ်ထွေးခြင်း',
    'Asthma — key facts, common triggers, and treatment principles.':
      'ပန်းနာရင်ကြပ် — အဓိကအချက်များ၊ အဖြစ်များသော လှုံ့ဆော်အကြောင်းရင်းများနှင့် ကုသမှု အခြေခံများ။',
    'National guidance on chronic respiratory disease care and inhaler access.':
      'နာတာရှည် အသက်ရှူလမ်းကြောင်းရောဂါ စောင့်ရှောက်မှုနှင့် ရှူဆေး ရရှိရေးဆိုင်ရာ အမျိုးသားအဆင့် လမ်းညွှန်ချက်များ။',
    'Management of chronic respiratory conditions in primary care settings.':
      'အခြေခံကျန်းမာရေး စောင့်ရှောက်မှုတွင် နာတာရှည် အသက်ရှူလမ်းကြောင်းရောဂါ ထိန်းညှိမှု။',

    /* --- dengue fever detail --- */
    'Dengue is a viral illness spread by the bite of infected Aedes mosquitoes, which breed in clean, still water around the home and bite mostly in the daytime.':
      'သွေးလွန်တုပ်ကွေးသည် Aedes ခြင်ကျား ကိုက်ခြင်းမှတစ်ဆင့် ကူးစက်သော ဗိုင်းရပ်စ်ရောဂါ ဖြစ်သည်။ ထိုခြင်များသည် အိမ်ပတ်လည်ရှိ သန့်ရှင်းပြီး မငြိမ်မလှုပ်သော ရေတွင် ပေါက်ပွားပြီး နေ့ခင်းဘက်တွင် အများဆုံး ကိုက်တတ်သည်။',
    'Most people recover within a week with rest and plenty of fluids. A small number, however, become seriously ill at the point when the fever starts to fall — usually the third to seventh day — as fluid leaks from the blood vessels. That is why the days after the fever breaks need the closest watching, not the days of high fever.':
      'အများစုမှာ အနားယူပြီး ရေဓာတ် များများ သောက်ခြင်းဖြင့် တစ်ပတ်အတွင်း သက်သာလာသည်။ သို့သော် အနည်းငယ်မှာမူ အဖျားစတင် ကျဆင်းချိန် — အများအားဖြင့် တတိယနေ့မှ သတ္တမနေ့အတွင်း — တွင် သွေးကြောများမှ အရည်များ ယိုစိမ့်ထွက်ကာ ပြင်းထန်လာတတ်သည်။ ထို့ကြောင့် အဖျားပြင်းနေချိန်ထက် အဖျားကျပြီးနောက် ရက်များကို ပိုမို အနီးကပ် စောင့်ကြည့်ရန် လိုအပ်သည်။',
    'Symptoms usually begin suddenly, four to ten days after the mosquito bite:':
      'လက္ခဏာများသည် ခြင်ကိုက်ပြီး ၄ ရက်မှ ၁၀ ရက်အတွင်း ရုတ်တရက် စတင်လေ့ရှိသည်။',
    'A high fever that starts abruptly': 'ရုတ်တရက် စတင်သော အဖျားပြင်းခြင်း',
    'Severe headache, with aching pain behind the eyes':
      'ပြင်းထန်သော ခေါင်းကိုက်ခြင်းနှင့်အတူ မျက်လုံးနောက်ကွယ်တွင် အောင့်ခြင်း',
    'Deep muscle, joint, and bone pain':
      'ကြွက်သား၊ အဆစ်နှင့် အရိုးများ ပြင်းထန်စွာ ကိုက်ခဲခြင်း',
    'A red skin rash appearing after a few days':
      'ရက်အနည်းငယ်အကြာတွင် အနီရောင် အဖုအပိန့်များ ထွက်လာခြင်း',
    'Nausea, vomiting, and loss of appetite':
      'ပျို့ခြင်း၊ အန်ခြင်းနှင့် အစားအသောက် မဝင်စားခြင်း',
    'Young children, who can become seriously ill quickly.':
      'ကလေးငယ်များ — လျင်မြန်စွာ ပြင်းထန်လာနိုင်သည်။',
    'People living where mosquitoes are dense, especially in the rainy season.':
      'ခြင်ပေါများသည့် နေရာများတွင် နေထိုင်သူများ၊ အထူးသဖြင့် မိုးရာသီတွင်။',
    'Households storing water in open pots, tanks, or drums.':
      'အဖုံးမပါသော အိုး၊ ရေကန် သို့မဟုတ် ဒရမ်များဖြင့် ရေသိုလှောင်သည့် အိမ်ထောင်စုများ။',
    'Anyone who has had dengue before — a second infection is often more severe.':
      'ယခင်က သွေးလွန်တုပ်ကွေး ဖြစ်ဖူးသူများ — ဒုတိယအကြိမ် ကူးစက်မှုသည် ပို၍ ပြင်းထန်တတ်သည်။',
    'Cover, empty, scrub, and change stored water so mosquitoes cannot breed.':
      'ခြင်မပေါက်ပွားနိုင်စေရန် ရေကို ဖုံး၊ သွန်၊ ခတ်၊ စစ် လုပ်ပါ။',
    'Sleep under a mosquito net, including during daytime naps.':
      'နေ့ခင်းဘက် အိပ်စက်ချိန်အပါအဝင် ခြင်ထောင်ဖြင့် အိပ်ပါ။',
    'Use repellent and wear long sleeves in the early morning and late afternoon.':
      'နံနက်စောစောနှင့် ညနေပိုင်းတွင် ခြင်ဆေး လိမ်းပြီး လက်ရှည် ဝတ်ဆင်ပါ။',
    'Drink plenty of fluids — water, oral rehydration solution, or soup.':
      'ရေဓာတ် များများ သောက်ပါ — ရေ၊ ဓာတ်ဆား သို့မဟုတ် ဟင်းရည်။',
    'Use paracetamol for fever and watch closely as the fever falls.':
      'အဖျားအတွက် ပါရာစီတမော သုံးပြီး အဖျားကျချိန်တွင် အနီးကပ် စောင့်ကြည့်ပါ။',
    "Don't take aspirin or ibuprofen — they increase the risk of bleeding.":
      'အက်စပရင် သို့မဟုတ် အိုင်ဗျူပရိုဖင် မသောက်ပါနှင့် — သွေးထွက်နိုင်ခြေကို တိုးစေသည်။',
    "Don't assume recovery just because the fever has come down.":
      'အဖျားကျသွားရုံဖြင့် သက်သာပြီဟု မထင်ပါနှင့်။',
    "Don't leave water in flower pots, tyres, or buckets around the house.":
      'အိမ်ပတ်လည်ရှိ ပန်းအိုး၊ ကားတာယာနှင့် ရေပုံးများတွင် ရေ မထားပါနှင့်။',
    "Don't wait at home if there is bleeding or severe stomach pain.":
      'သွေးထွက်ခြင်း သို့မဟုတ် ဗိုက်ပြင်းထန်စွာ အောင့်ခြင်း ရှိပါက အိမ်တွင် မစောင့်ပါနှင့်။',
    "Don't take antibiotics for dengue — they do not work against viruses.":
      'သွေးလွန်တုပ်ကွေးအတွက် ပဋိဇီဝဆေး မသောက်ပါနှင့် — ဗိုင်းရပ်စ်ကို မသက်ရောက်ပါ။',
    'Go to a clinic or hospital straight away — especially between days three and seven of illness — if you notice any of these warning signs:':
      'အောက်ပါ သတိပေးလက္ခဏာများ တွေ့ပါက ချက်ချင်း ဆေးခန်း သို့မဟုတ် ဆေးရုံသို့ သွားပါ — အထူးသဖြင့် ဖျားပြီး တတိယနေ့မှ သတ္တမနေ့အတွင်း။',
    'Vomiting that will not stop, or being unable to keep fluids down':
      'မရပ်တန့်သော အန်ခြင်း၊ သို့မဟုတ် သောက်သမျှ ပြန်အန်ထွက်ခြင်း',
    'Bleeding from the gums or nose, or bruising easily under the skin':
      'သွားဖုံး သို့မဟုတ် နှာခေါင်းမှ သွေးထွက်ခြင်း၊ အရေပြားအောက်တွင် လွယ်ကူစွာ သွေးခြေဥခြင်း',
    'Severe pain in the abdomen': 'ဗိုက်ပြင်းထန်စွာ အောင့်ခြင်း',
    'Cold, clammy skin, restlessness, or sudden weakness after the fever drops':
      'အဖျားကျပြီးနောက် အရေပြား အေးစက်စေးထိုင်းခြင်း၊ မငြိမ်မသက် ဖြစ်ခြင်း သို့မဟုတ် ရုတ်တရက် နွမ်းလျခြင်း',
    'Dengue and severe dengue — transmission, warning signs, and clinical care.':
      'သွေးလွန်တုပ်ကွေးနှင့် ပြင်းထန်သော သွေးလွန်တုပ်ကွေး — ကူးစက်ပုံ၊ သတိပေးလက္ခဏာများနှင့် ဆေးကုသမှု။',
    'National dengue control programme and seasonal outbreak guidance.':
      'အမျိုးသားအဆင့် သွေးလွန်တုပ်ကွေး ထိန်းချုပ်ရေးအစီအစဉ်နှင့် ရာသီအလိုက် ကူးစက်မှု လမ်းညွှန်ချက်များ။',
    'Regional guidance on dengue prevention, vector control, and case management.':
      'သွေးလွန်တုပ်ကွေး ကာကွယ်ရေး၊ ခြင်ထိန်းချုပ်ရေးနှင့် လူနာ ကုသမှုဆိုင်ရာ ဒေသတွင်း လမ်းညွှန်ချက်များ။',

    /* --- tuberculosis detail --- */
    'Tuberculosis is an infection caused by the bacterium Mycobacterium tuberculosis, which usually settles in the lungs and spreads through the air when someone with active TB coughs or sneezes.':
      'တီဘီရောဂါသည် Mycobacterium tuberculosis ဘက်တီးရီးယားကြောင့် ဖြစ်ပွားပြီး အများအားဖြင့် အဆုတ်တွင် စွဲကပ်ကာ တီဘီရောဂါ ရှိသူ ချောင်းဆိုး နှာချေသည့်အခါ လေထဲမှတစ်ဆင့် ကူးစက်သည်။',
    'TB develops slowly, so people often carry it for weeks or months before seeking help. It is fully curable — but only with a complete course of antibiotics, usually six months or longer. Stopping early is the single biggest reason TB returns, and returns in a form that is far harder to treat.':
      'တီဘီသည် တဖြည်းဖြည်း ဖြစ်ပွားသောကြောင့် အများစုမှာ ဆေးကုသမှု မခံယူမီ ရက်သတ္တပတ် သို့မဟုတ် လများစွာ ရောဂါပိုးကို သယ်ဆောင်နေတတ်သည်။ ပဋိဇီဝဆေးကို အများအားဖြင့် ခြောက်လ သို့မဟုတ် ထို့ထက်ပို၍ ပြည့်ပြည့်စုံစုံ သောက်ပါက လုံးဝ ပျောက်ကင်းနိုင်သည်။ ဆေးကို စောစီးစွာ ရပ်လိုက်ခြင်းသည် တီဘီ ပြန်ဖြစ်ရသည့် အဓိကအကြောင်းရင်း ဖြစ်ပြီး ပြန်ဖြစ်ပါက ကုသရန် များစွာ ခက်ခဲသည်။',
    'Symptoms build up gradually, which is why TB is often mistaken for an ordinary cough at first:':
      'လက္ခဏာများ တဖြည်းဖြည်း တိုးလာသောကြောင့် အစပိုင်းတွင် သာမန် ချောင်းဆိုးဟု မှတ်ယူတတ်ကြသည်။',
    'A cough lasting more than two weeks': 'နှစ်ပတ်ထက်ပို၍ ချောင်းဆိုးခြင်း',
    'Coughing up sputum, sometimes streaked with blood':
      'သလိပ် ထွက်ခြင်း၊ တစ်ခါတစ်ရံ သွေးပါခြင်း',
    'Sweating heavily at night, enough to soak the bedding':
      'ညဘက် အိပ်ရာခင်း စိုစွတ်လောက်အောင် ချွေးများစွာ ထွက်ခြင်း',
    'A mild fever that returns each afternoon or evening':
      'နေ့လယ် သို့မဟုတ် ညနေတိုင်း ပြန်ဖြစ်တတ်သော အဖျားငွေ့ငွေ့',
    'Losing weight and appetite over several weeks':
      'ရက်သတ္တပတ်များစွာအတွင်း ကိုယ်အလေးချိန်နှင့် အစားအသောက် ကျဆင်းလာခြင်း',
    'People with weakened immunity, including those living with HIV or diabetes.':
      'ခံအားနည်းသူများ၊ HIV သို့မဟုတ် ဆီးချိုရှိသူများ အပါအဝင်။',
    'Household members and close contacts of someone with active TB.':
      'တီဘီရောဂါ ရှိသူနှင့် အတူနေ မိသားစုဝင်များနှင့် နီးကပ်စွာ ထိတွေ့သူများ။',
    'Smokers, and people exposed to heavy indoor smoke.':
      'ဆေးလိပ်သောက်သူများနှင့် အိမ်တွင်း မီးခိုးထူထပ်စွာ ရှူရှိုက်ရသူများ။',
    'Those living or working in crowded, poorly ventilated spaces.':
      'လူစည်ကားပြီး လေဝင်လေထွက် မကောင်းသည့် နေရာများတွင် နေထိုင် သို့မဟုတ် အလုပ်လုပ်သူများ။',
    'Finish the whole course of treatment, even after you start feeling better.':
      'နေကောင်းလာသည့်တိုင် ဆေးကုသမှုကို အပြည့်အဝ ပြီးဆုံးအောင် ယူပါ။',
    'Make sure children receive the BCG vaccination.':
      'ကလေးများ BCG ကာကွယ်ဆေး ရရှိအောင် ဆောင်ရွက်ပါ။',
    'Open windows and doors to keep rooms well ventilated.':
      'အခန်းများ လေဝင်လေထွက် ကောင်းစေရန် ပြတင်းပေါက်နှင့် တံခါးများ ဖွင့်ထားပါ။',
    'Cover your mouth and nose when coughing or sneezing.':
      'ချောင်းဆိုး နှာချေသည့်အခါ ပါးစပ်နှင့် နှာခေါင်းကို အုပ်ပါ။',
    'Ask everyone in the household to be screened if one person is diagnosed.':
      'တစ်ဦးဦး ရောဂါတွေ့ပါက အိမ်ထောင်စုဝင် အားလုံးကို စစ်ဆေးခိုင်းပါ။',
    "Don't stop the antibiotics early — TB can come back resistant to treatment.":
      'ပဋိဇီဝဆေးကို စောစီးစွာ မရပ်ပါနှင့် — တီဘီသည် ဆေးယဉ်ပါးပြီး ပြန်ဖြစ်နိုင်သည်။',
    "Don't spit in public places.": 'အများပြည်သူ နေရာများတွင် တံတွေး မထွေးပါနှင့်။',
    "Don't share a closed, unventilated room while you are still infectious.":
      'ရောဂါပိုး ကူးစက်နိုင်သေးချိန်တွင် လေဝင်လေထွက်မရှိသော အခန်းပိတ်တွင် အတူ မနေပါနှင့်။',
    "Don't smoke — it slows healing of the lungs.":
      'ဆေးလိပ် မသောက်ပါနှင့် — အဆုတ် ပြန်လည်ကောင်းမွန်မှုကို နှေးကွေးစေသည်။',
    "Don't hide the diagnosis from your family; they may need testing too.":
      'ရောဂါတွေ့ရှိမှုကို မိသားစုထံမှ မဖုံးကွယ်ပါနှင့် — သူတို့လည်း စစ်ဆေးရန် လိုနိုင်သည်။',
    'TB testing is free at public clinics in Myanmar. Get checked if you notice any of these:':
      'မြန်မာနိုင်ငံရှိ အစိုးရဆေးခန်းများတွင် တီဘီစစ်ဆေးမှုကို အခမဲ့ ရရှိနိုင်သည်။ အောက်ပါတို့ တွေ့ပါက စစ်ဆေးပါ။',
    'A cough that has lasted longer than two weeks':
      'နှစ်ပတ်ထက်ပိုကြာသည့် ချောင်းဆိုးခြင်း',
    'Blood in the sputum, at any time': 'သလိပ်တွင် သွေးပါခြင်း၊ မည်သည့်အချိန်မဆို',
    'Night sweats and weight loss without an obvious cause':
      'အကြောင်းရင်း မသိဘဲ ညဘက် ချွေးထွက်ခြင်းနှင့် ကိုယ်အလေးချိန် ကျခြင်း',
    'Chest pain, or breathlessness that is getting worse':
      'ရင်ဘတ်အောင့်ခြင်း သို့မဟုတ် ပိုဆိုးလာသော မောဟိုက်ခြင်း',
    'Tuberculosis — transmission, diagnosis, and treatment guidance.':
      'တီဘီရောဂါ — ကူးစက်ပုံ၊ ရောဂါရှာဖွေမှုနှင့် ကုသမှု လမ်းညွှန်။',
    'National Tuberculosis Programme — free screening, diagnosis, and treatment services.':
      'အမျိုးသားအဆင့် တီဘီရောဂါ တိုက်ဖျက်ရေးအစီအစဉ် — အခမဲ့ စစ်ဆေးမှု၊ ရောဂါရှာဖွေမှုနှင့် ကုသမှု ဝန်ဆောင်မှုများ။',
    'Regional TB control strategy and drug-resistant TB management.':
      'ဒေသတွင်း တီဘီ ထိန်းချုပ်ရေး မဟာဗျူဟာနှင့် ဆေးယဉ်ပါး တီဘီ ကုသမှု။',

    /* --- malaria detail --- */
    'Malaria is caused by a parasite passed to people through the bite of an infected female Anopheles mosquito, which feeds mainly between dusk and dawn.':
      'ငှက်ဖျားရောဂါသည် ရောဂါပိုးရှိသော အနောဖလင်း ခြင်မ ကိုက်ခြင်းမှတစ်ဆင့် ကူးစက်သော ကပ်ပါးပိုးကြောင့် ဖြစ်သည်။ ထိုခြင်များသည် နေဝင်ချိန်မှ အရုဏ်တက်ချိန်အထိ အဓိက ကိုက်တတ်သည်။',
    'The parasite multiplies in the liver and then in the red blood cells, which is what produces the familiar pattern of shivering chills followed by fever and drenching sweats. Malaria is both preventable and curable, but it can turn severe within a day or two, so a fever after travel to a forested or border area should always be tested rather than waited out.':
      'ကပ်ပါးပိုးသည် အသည်းတွင် ပွားများပြီး ထို့နောက် သွေးနီဥများအတွင်း ဆက်လက် ပွားများသည်။ ထို့ကြောင့် ချမ်းတုန်ခြင်း၊ ဖျားခြင်းနှင့် ချွေးရွှဲစိုခြင်း ဟူသော ပုံစံ ဖြစ်ပေါ်လာသည်။ ငှက်ဖျားကို ကာကွယ်နိုင်သလို ကုသ၍လည်း ပျောက်ကင်းနိုင်သည်။ သို့သော် တစ်ရက်နှစ်ရက်အတွင်း ပြင်းထန်လာနိုင်သဖြင့် တောတောင် သို့မဟုတ် နယ်စပ်ဒေသ သွားရောက်ပြီးနောက် ဖျားပါက စောင့်ဆိုင်းမနေဘဲ အမြဲ စစ်ဆေးသင့်သည်။',
    'Symptoms usually appear 10 to 15 days after the bite and often come in cycles:':
      'လက္ခဏာများသည် ခြင်ကိုက်ပြီး ၁၀ ရက်မှ ၁၅ ရက်အကြာတွင် ပေါ်လာလေ့ရှိပြီး အလှည့်ကျ ဖြစ်တတ်သည်။',
    'Shivering chills that make the whole body shake':
      'တစ်ကိုယ်လုံး တုန်ခါလောက်အောင် ချမ်းစိမ့်စိမ့် ဖြစ်ခြင်း',
    'High fever following the chills': 'ချမ်းတုန်ပြီးနောက် အဖျားပြင်းလာခြင်း',
    'Heavy sweating as the fever falls': 'အဖျားကျချိန်တွင် ချွေးများစွာ ထွက်ခြင်း',
    'Headache and aching muscles': 'ခေါင်းကိုက်ခြင်းနှင့် ကြွက်သားများ ကိုက်ခဲခြင်း',
    'Nausea, vomiting, and general weakness':
      'ပျို့ခြင်း၊ အန်ခြင်းနှင့် တစ်ကိုယ်လုံး နွမ်းနယ်ခြင်း',
    'People living in forested, hilly, or border areas where malaria is endemic.':
      'ငှက်ဖျား အဖြစ်များသည့် တောတောင်၊ တောင်ကုန်းနှင့် နယ်စပ်ဒေသများတွင် နေထိုင်သူများ။',
    'Travellers, loggers, miners, and farmers who stay overnight in the forest.':
      'တောအတွင်း ညအိပ်တည်းခိုသည့် ခရီးသွားများ၊ သစ်ထုတ်လုပ်သားများ၊ သတ္တုတွင်းလုပ်သားများနှင့် တောင်သူများ။',
    'Pregnant women, in whom malaria is more dangerous for mother and baby.':
      'ကိုယ်ဝန်ဆောင်မိခင်များ — မိခင်နှင့် ကလေးအတွက် ပိုမို အန္တရာယ်ရှိသည်။',
    'Young children, who can deteriorate very quickly.':
      'ကလေးငယ်များ — အလွန်လျင်မြန်စွာ ဆိုးရွားလာနိုင်သည်။',
    'Sleep under an insecticide-treated mosquito net every night.':
      'ညတိုင်း ဆေးစိမ် ခြင်ထောင်ဖြင့် အိပ်ပါ။',
    'Apply repellent and cover your arms and legs after dark.':
      'နေဝင်ပြီးနောက် ခြင်ဆေး လိမ်းပြီး လက်ခြေများကို ဖုံးအုပ်ထားပါ။',
    'Take preventive medication if your doctor advises it before travelling to an endemic area.':
      'ငှက်ဖျားဒေသသို့ မသွားမီ ဆရာဝန် ညွှန်ကြားပါက ကြိုတင်ကာကွယ်ဆေး သောက်ပါ။',
    'Get a blood test for any fever within a month of visiting a malaria area.':
      'ငှက်ဖျားဒေသ သွားပြီး တစ်လအတွင်း ဖျားပါက သွေးစစ်ပါ။',
    'Complete the full course of anti-malarial tablets you are given.':
      'ရရှိသည့် ငှက်ဖျားဆေးလုံးများကို အပြည့်အဝ သောက်ပါ။',
    "Don't treat a fever as ordinary flu if you have been in a malaria area.":
      'ငှက်ဖျားဒေသ ရောက်ဖူးပါက အဖျားကို သာမန် တုပ်ကွေးဟု မမှတ်ယူပါနှင့်။',
    "Don't buy anti-malarial tablets without a confirmed test result.":
      'စစ်ဆေးမှု အဖြေ အတည်မပြုရသေးဘဲ ငှက်ဖျားဆေး မဝယ်သောက်ပါနှင့်။',
    "Don't stop the tablets once the fever settles — the parasite may still be there.":
      'အဖျားကျသည်နှင့် ဆေးမရပ်ပါနှင့် — ကပ်ပါးပိုး ကျန်နေနိုင်သေးသည်။',
    "Don't sleep outdoors without a net, even for one night.":
      'တစ်ညမျှပင် ခြင်ထောင်မပါဘဲ အပြင်တွင် မအိပ်ပါနှင့်။',
    "Don't delay care for a child or pregnant woman with fever.":
      'ဖျားနေသော ကလေး သို့မဟုတ် ကိုယ်ဝန်ဆောင်အတွက် ကုသမှုကို မဆိုင်းငံ့ပါနှင့်။',
    'Get a malaria test for any fever after being in an endemic area. Seek emergency care immediately for any of these:':
      'ငှက်ဖျားဒေသ ရောက်ပြီးနောက် ဖျားပါက ငှက်ဖျားစစ်ပါ။ အောက်ပါတို့ ဖြစ်ပါက ချက်ချင်း အရေးပေါ် ကုသမှု ခံယူပါ။',
    'High fever with severe chills that keeps returning':
      'ချမ်းတုန်ခြင်းနှင့်အတူ ခဏခဏ ပြန်ဖြစ်သော အဖျားပြင်းခြင်း',
    'Confusion, strange behaviour, or difficulty waking — signs of cerebral malaria':
      'စိတ်ရှုပ်ထွေးခြင်း၊ ဂယောင်ဂတမ်း ပြောခြင်း သို့မဟုတ် နိုးရန် ခက်ခဲခြင်း — ဦးနှောက်ငှက်ဖျား လက္ခဏာများ',
    'Fits or convulsions': 'တက်ခြင်း သို့မဟုတ် တုန်တက်ခြင်း',
    'Yellow eyes, very dark urine, or passing little urine':
      'မျက်လုံးဝါခြင်း၊ ဆီးအရောင် အလွန်ရင့်ခြင်း သို့မဟုတ် ဆီးနည်းခြင်း',
    'Malaria — transmission, prevention, diagnosis, and treatment.':
      'ငှက်ဖျားရောဂါ — ကူးစက်ပုံ၊ ကာကွယ်ရေး၊ ရောဂါရှာဖွေမှုနှင့် ကုသမှု။',
    'National Malaria Control Programme — testing, treatment, and bed net distribution.':
      'အမျိုးသားအဆင့် ငှက်ဖျား ထိန်းချုပ်ရေးအစီအစဉ် — စစ်ဆေးမှု၊ ကုသမှုနှင့် ခြင်ထောင် ဖြန့်ဝေမှု။',
    'Regional malaria elimination strategy and artemisinin resistance monitoring.':
      'ဒေသတွင်း ငှက်ဖျား ပပျောက်ရေး မဟာဗျူဟာနှင့် ဆေးယဉ်ပါးမှု စောင့်ကြည့်ရေး။',

    /* --- hepatitis B detail --- */
    'Hepatitis B is a viral infection of the liver, spread through infected blood and body fluids — most often from mother to baby at birth, through unsterile needles, or through unprotected sex.':
      'အသည်းရောင် အသားဝါ ဘီသည် သွေးနှင့် ခန္ဓာကိုယ်အရည်များမှတစ်ဆင့် ကူးစက်သော အသည်း ဗိုင်းရပ်စ် ပိုးဝင်ခြင်း ဖြစ်သည် — အများအားဖြင့် မွေးဖွားစဉ် မိခင်မှ ကလေးသို့၊ မသန့်ရှင်းသော ဆေးထိုးအပ်မှတစ်ဆင့် သို့မဟုတ် ကာကွယ်မှုမဲ့ လိင်ဆက်ဆံမှုမှတစ်ဆင့် ကူးစက်သည်။',
    'Many people carry the virus for years without feeling unwell, while it quietly scars the liver. Left unchecked it can lead to cirrhosis or liver cancer, which is why testing matters even when you feel healthy. A safe and effective vaccine prevents it, and long-term medication can keep chronic infection under control.':
      'အများစုမှာ နှစ်များစွာ ဗိုင်းရပ်စ်ပိုးကို သယ်ဆောင်ထားသော်လည်း မကျန်းမမာဟု မခံစားရဘဲ အသည်းကို တိတ်တဆိတ် ထိခိုက်စေသည်။ မစစ်ဆေးဘဲ ထားပါက အသည်းခြောက်ခြင်း သို့မဟုတ် အသည်းကင်ဆာအထိ ဖြစ်နိုင်သဖြင့် ကျန်းမာသည်ဟု ခံစားရချိန်တွင်ပင် စစ်ဆေးရန် အရေးကြီးသည်။ ဘေးကင်းပြီး ထိရောက်သော ကာကွယ်ဆေးဖြင့် ကာကွယ်နိုင်ပြီး ရေရှည် ဆေးဝါးဖြင့် နာတာရှည် ပိုးဝင်မှုကို ထိန်းချုပ်ထားနိုင်သည်။',
    'Early infection often causes no symptoms at all. When they do appear, they may include:':
      'အစပိုင်း ပိုးဝင်ချိန်တွင် လက္ခဏာ လုံးဝ မပြတတ်ပါ။ ပေါ်လာပါက အောက်ပါတို့ ဖြစ်နိုင်သည်။',
    'Yellowing of the skin and the whites of the eyes (jaundice)':
      'အသားနှင့် မျက်လုံးအဖြူသား ဝါလာခြင်း (အသားဝါ)',
    'Urine that is unusually dark': 'ဆီးအရောင် ပုံမှန်ထက် ရင့်ခြင်း',
    'Pain or fullness in the upper right side of the abdomen':
      'ဗိုက်ညာဘက် အပေါ်ပိုင်းတွင် နာကျင်ခြင်း သို့မဟုတ် ဖင့်နေခြင်း',
    /* 'Nausea, vomiting, and loss of appetite' is shared with the dengue block above. */
    'Tiredness that does not lift with rest':
      'အနားယူသော်လည်း မပျောက်သော ပင်ပန်းနွမ်းနယ်ခြင်း',
    'Babies born to mothers who carry the virus.':
      'ဗိုင်းရပ်စ်ပိုး သယ်ဆောင်ထားသော မိခင်များမှ မွေးဖွားသည့် ကလေးများ။',
    'Anyone who has received an injection or tattoo with reused needles.':
      'ပြန်သုံးထားသော အပ်ဖြင့် ဆေးထိုးခံရသူ သို့မဟုတ် ဆေးမင်ကြောင် ထိုးသူများ။',
    'People with unprotected sex or multiple partners.':
      'ကာကွယ်မှုမဲ့ လိင်ဆက်ဆံသူများ သို့မဟုတ် လိင်ဖော်ပေါင်းများသူများ။',
    'Household members of someone with hepatitis B, and healthcare workers.':
      'အသည်းရောင် အသားဝါ ဘီ ရှိသူနှင့် အတူနေသူများနှင့် ကျန်းမာရေးဝန်ထမ်းများ။',
    'Get vaccinated — and make sure newborns receive the birth dose on time.':
      'ကာကွယ်ဆေး ထိုးပါ — မွေးကင်းစကလေးများ မွေးဖွားချိန် ကာကွယ်ဆေးကို အချိန်မီ ရရှိအောင် ဆောင်ရွက်ပါ။',
    'Insist on new, single-use needles for any injection, piercing, or tattoo.':
      'ဆေးထိုးခြင်း၊ နားဖောက်ခြင်း သို့မဟုတ် ဆေးမင်ကြောင်ထိုးခြင်း မှန်သမျှတွင် တစ်ခါသုံး အပ်အသစ်ကိုသာ တောင်းဆိုပါ။',
    'Use condoms, and ask your partner to be tested and vaccinated.':
      'ကွန်ဒုံး သုံးပါ။ လိင်ဖော်အား စစ်ဆေးပြီး ကာကွယ်ဆေး ထိုးရန် ပြောပါ။',
    'Have regular liver check-ups if you are a carrier.':
      'ပိုးသယ်ဆောင်သူ ဖြစ်ပါက အသည်းကို ပုံမှန် စစ်ဆေးပါ။',
    'Tell any doctor or dentist treating you that you have hepatitis B.':
      'ကုသပေးမည့် ဆရာဝန် သို့မဟုတ် သွားဆရာဝန်အား အသည်းရောင် အသားဝါ ဘီ ရှိကြောင်း ပြောပါ။',
    "Don't share razors, toothbrushes, or nail clippers.":
      'မုတ်ဆိတ်ရိတ်ဓား၊ သွားတိုက်တံ သို့မဟုတ် လက်သည်းညှပ် မမျှဝေသုံးပါနှင့်။',
    "Don't drink alcohol — it adds to the damage the virus is already doing.":
      'အရက် မသောက်ပါနှင့် — ဗိုင်းရပ်စ်၏ ထိခိုက်မှုအပေါ် ထပ်ဆင့် ပိုဆိုးစေသည်။',
    "Don't take herbal remedies or painkillers without asking about your liver first.":
      'သင့်အသည်းအခြေအနေကို မမေးမြန်းဘဲ ဆေးဖက်ဝင်အပင်ဆေးများ သို့မဟုတ် အကိုက်အခဲပျောက်ဆေး မသောက်ပါနှင့်။',
    "Don't assume you are safe because you feel well; get tested.":
      'နေကောင်းသည်ဟု ခံစားရရုံဖြင့် ဘေးကင်းသည်ဟု မထင်ပါနှင့် — စစ်ဆေးပါ။',
    "Don't stop antiviral medication on your own.":
      'ဗိုင်းရပ်စ်ပိုးသတ်ဆေးကို ကိုယ်တိုင်သဘောနှင့် မရပ်ပါနှင့်။',
    'Ask for a hepatitis B test if you have any of the risk factors above. Seek care promptly if you notice:':
      'အထက်ပါ အန္တရာယ်အချက်များ ရှိပါက အသည်းရောင် အသားဝါ ဘီ စစ်ဆေးမှု တောင်းဆိုပါ။ အောက်ပါတို့ တွေ့ပါက ချက်ချင်း ဆေးကုသမှု ခံယူပါ။',
    'Yellowing of the eyes or skin': 'မျက်လုံး သို့မဟုတ် အသား ဝါလာခြင်း',
    'Persistent pain in the upper right abdomen':
      'ဗိုက်ညာဘက် အပေါ်ပိုင်းတွင် ဆက်တိုက် နာကျင်ခြင်း',
    'Severe tiredness that lasts for weeks':
      'ရက်သတ္တပတ်များစွာ ကြာမြင့်သော ပြင်းထန်သည့် နွမ်းနယ်ခြင်း',
    'Swelling of the abdomen or legs, vomiting blood, or confusion':
      'ဗိုက် သို့မဟုတ် ခြေထောက် ဖောရောင်ခြင်း၊ သွေးအန်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်း',
    'Hepatitis B — transmission, vaccination, and long-term management.':
      'အသည်းရောင် အသားဝါ ဘီ — ကူးစက်ပုံ၊ ကာကွယ်ဆေးထိုးခြင်းနှင့် ရေရှည် ထိန်းညှိမှု။',
    'National hepatitis programme and the routine childhood immunisation schedule.':
      'အမျိုးသားအဆင့် အသည်းရောင်ရောဂါ အစီအစဉ်နှင့် ကလေးသူငယ် ပုံမှန် ကာကွယ်ဆေးထိုး အချိန်ဇယား။',
    'Regional action plan on viral hepatitis and mother-to-child transmission.':
      'ဗိုင်းရပ်စ် အသည်းရောင်ရောဂါနှင့် မိခင်မှ ကလေးသို့ ကူးစက်မှုဆိုင်ရာ ဒေသတွင်း လုပ်ငန်းစီမံချက်။',

    /* --- coronary heart disease detail --- */
    'Coronary heart disease develops when fatty deposits, called plaque, build up inside the arteries that supply the heart muscle, narrowing them and reducing blood flow.':
      'နှလုံးသွေးကြောကျဉ်းရောဂါသည် နှလုံးကြွက်သားသို့ သွေးပို့ပေးသည့် သွေးလွှတ်ကြောများအတွင်း အဆီဂျီးများ စုပုံလာပြီး သွေးကြောများ ကျဉ်းမြောင်းကာ သွေးစီးဆင်းမှု လျော့နည်းလာသောအခါ ဖြစ်ပွားသည်။',
    'For a long time this causes nothing at all. Then, as the narrowing worsens, the heart begins to run short of oxygen during effort — climbing stairs, carrying loads, walking uphill — and that shortage is felt as chest pain. If a plaque tears and a clot blocks the artery completely, the result is a heart attack. Much of the risk can be lowered by treating blood pressure, sugar, and cholesterol, and by stopping smoking.':
      'ကာလကြာရှည်စွာ လက္ခဏာ လုံးဝ မပြတတ်ပါ။ ကျဉ်းမြောင်းမှု ပိုဆိုးလာသောအခါ လှေကားတက်ခြင်း၊ ဝန်ထမ်းခြင်း၊ ကုန်းတက်လမ်းလျှောက်ခြင်းကဲ့သို့ အားစိုက်ရချိန်တွင် နှလုံးသည် အောက်ဆီဂျင် လိုအပ်လာပြီး ထိုချို့တဲ့မှုကို ရင်ဘတ်အောင့်ခြင်းအဖြစ် ခံစားရသည်။ အဆီဂျီး ကွဲအက်ပြီး သွေးခဲက သွေးကြောကို လုံးဝ ပိတ်ဆို့သွားပါက နှလုံးဖောက်ခြင်း ဖြစ်သည်။ သွေးပေါင်ချိန်၊ သကြားဓာတ်နှင့် ကိုလက်စထရော ကုသခြင်းနှင့် ဆေးလိပ်ဖြတ်ခြင်းဖြင့် အန္တရာယ် အများစုကို လျှော့ချနိုင်သည်။',
    'Symptoms typically appear during exertion or stress and ease with rest:':
      'လက္ခဏာများသည် အားစိုက်ချိန် သို့မဟုတ် စိတ်ဖိစီးချိန်တွင် ပေါ်လာပြီး အနားယူပါက သက်သာလေ့ရှိသည်။',
    'Chest pain, tightness, or a heavy pressing feeling (angina)':
      'ရင်ဘတ်အောင့်ခြင်း၊ ကျပ်တည်းခြင်း သို့မဟုတ် လေးလံစွာ ဖိထားသလို ခံစားရခြင်း',
    'Pain spreading to the left arm, shoulder, neck, or jaw':
      'ဘယ်ဘက်လက်မောင်း၊ ပခုံး၊ လည်ပင်း သို့မဟုတ် မေးရိုးသို့ နာကျင်မှု ကူးစက်ခြင်း',
    'Breathlessness on climbing stairs or walking uphill':
      'လှေကားတက်ခြင်း သို့မဟုတ် ကုန်းတက်လမ်းလျှောက်ခြင်းတွင် မောဟိုက်ခြင်း',
    'Unusual tiredness with light activity':
      'အလုပ်ပေါ့ပေါ့လုပ်ရုံဖြင့် ပုံမှန်မဟုတ်သော ပင်ပန်းနွမ်းနယ်ခြင်း',
    'Cold sweat, nausea, or light-headedness':
      'ချွေးစိမ့်ထွက်ခြင်း၊ ပျို့ခြင်း သို့မဟုတ် ခေါင်းပေါ့သလို ခံစားရခြင်း',
    'Older adults, and people with a family history of heart disease.':
      'အသက်ကြီးသူများနှင့် မိသားစုတွင် နှလုံးရောဂါ မျိုးရိုးရှိသူများ။',
    'Smokers, including those exposed to smoke at home or work.':
      'ဆေးလိပ်သောက်သူများ၊ အိမ် သို့မဟုတ် အလုပ်တွင် ဆေးလိပ်ငွေ့ ရှူရှိုက်ရသူများ အပါအဝင်။',
    'People with high blood pressure, diabetes, or high cholesterol.':
      'သွေးတိုး၊ ဆီးချို သို့မဟုတ် ကိုလက်စထရော မြင့်သူများ။',
    'Those eating a lot of fried and fatty food, with little physical activity.':
      'အဆီများပြီး ကြော်လှော်ထားသော အစားအစာ များများစားကာ ကိုယ်လက်လှုပ်ရှားမှု နည်းသူများ။',
    'Stop smoking — the benefit to your heart begins within weeks.':
      'ဆေးလိပ် ဖြတ်ပါ — သင့်နှလုံးအတွက် အကျိုးကျေးဇူးသည် ရက်သတ္တပတ်အနည်းငယ်အတွင်း စတင်သည်။',
    'Choose grilled, steamed, or boiled food over fried, and cut back on oil.':
      'ကြော်ထားသည့်အစား ကင်ထား၊ ပေါင်းထား သို့မဟုတ် ပြုတ်ထားသော အစားအစာကို ရွေးပြီး ဆီကို လျှော့ပါ။',
    'Keep blood pressure, blood sugar, and cholesterol at your target levels.':
      'သွေးပေါင်ချိန်၊ သွေးတွင်းသကြားဓာတ်နှင့် ကိုလက်စထရောကို ရည်မှန်းချက် အဆင့်တွင် ထိန်းထားပါ။',
    'Walk briskly for about 30 minutes on most days, as your doctor allows.':
      'ဆရာဝန် ခွင့်ပြုသလောက် နေ့အများစုတွင် ၃၀ မိနစ်ခန့် သွက်သွက်လက်လက် လမ်းလျှောက်ပါ။',
    'Take your heart medicines every day, exactly as prescribed.':
      'နှလုံးဆေးများကို ညွှန်ကြားထားသည့်အတိုင်း နေ့စဉ် သောက်ပါ။',
    "Don't ignore chest pain, however brief, and don't drive yourself to hospital with it.":
      'ခဏတာမျှသာ ဖြစ်စေကာမူ ရင်ဘတ်အောင့်ခြင်းကို လျစ်လျူမရှုပါနှင့်။ ကိုယ်တိုင် ကားမောင်းပြီး ဆေးရုံ မသွားပါနှင့်။',
    "Don't smoke or chew tobacco.": 'ဆေးလိပ် မသောက်ပါနှင့်၊ ဆေးရွက်ကြီးလည်း မဝါးပါနှင့်။',
    "Don't eat heavily salted or deep-fried food regularly.":
      'ဆားငန်လွန်းသော သို့မဟုတ် ဆီနစ်ကြော်ထားသော အစားအစာများကို ပုံမှန် မစားပါနှင့်။',
    "Don't begin hard exercise without asking your doctor first.":
      'ဆရာဝန်နှင့် တိုင်ပင်ခြင်းမပြုဘဲ ပြင်းထန်သော လေ့ကျင့်ခန်း မစတင်ပါနှင့်။',
    "Don't stop your blood pressure or cholesterol tablets once you feel well.":
      'နေကောင်းလာသည်နှင့် သွေးတိုး သို့မဟုတ် ကိုလက်စထရော ဆေးလုံးများကို မရပ်ပါနှင့်။',
    'Call an ambulance immediately — this is a medical emergency — if you or someone near you has:':
      'သင် သို့မဟုတ် အနီးအနားရှိ တစ်စုံတစ်ဦးတွင် အောက်ပါတို့ ဖြစ်ပါက ချက်ချင်း လူနာတင်ယာဉ် ခေါ်ပါ — ဤသည်မှာ အရေးပေါ် အခြေအနေ ဖြစ်သည်။',
    'Sudden severe chest pain or crushing pressure lasting more than a few minutes':
      'ရုတ်တရက် ရင်ဘတ် ပြင်းထန်စွာ အောင့်ခြင်း သို့မဟုတ် မိနစ်အနည်းငယ်ထက်ပိုကြာအောင် ဖိညှစ်ခံရသလို ခံစားရခြင်း',
    'Chest pain together with cold sweating and extreme breathlessness':
      'ရင်ဘတ်အောင့်ခြင်းနှင့်အတူ ချွေးစိမ့်ထွက်ပြီး အလွန်အမင်း မောဟိုက်ခြင်း',
    'Pain spreading into the arm, neck, or jaw with nausea or vomiting':
      'လက်မောင်း၊ လည်ပင်း သို့မဟုတ် မေးရိုးသို့ နာကျင်မှု ကူးစက်ပြီး ပျို့အန်ခြင်း',
    'Collapse, fainting, or a very irregular heartbeat':
      'လဲကျခြင်း၊ မေ့မြောခြင်း သို့မဟုတ် နှလုံးခုန်နှုန်း အလွန်မမှန်ခြင်း',
    'Cardiovascular diseases — risk factors, warning signs, and prevention.':
      'နှလုံးသွေးကြောရောဂါများ — အန္တရာယ်အချက်များ၊ သတိပေးလက္ခဏာများနှင့် ကာကွယ်ရေး။',
    'National guidelines on non-communicable disease and cardiovascular risk management.':
      'မကူးစက်တတ်သောရောဂါနှင့် နှလုံးသွေးကြော အန္တရာယ် ထိန်းညှိမှုဆိုင်ရာ အမျိုးသားအဆင့် လမ်းညွှန်ချက်များ။',

    /* --- stroke detail --- */
    'A stroke happens when the blood supply to part of the brain is suddenly cut off — either by a clot blocking an artery, or by a vessel bursting and bleeding into the brain.':
      'လေဖြတ်ခြင်းသည် ဦးနှောက်တစ်စိတ်တစ်ပိုင်းသို့ သွေးစီးဆင်းမှု ရုတ်တရက် ပြတ်တောက်သွားသောအခါ ဖြစ်ပွားသည် — သွေးခဲက သွေးကြောကို ပိတ်ဆို့ခြင်း သို့မဟုတ် သွေးကြောပေါက်ပြီး ဦးနှောက်အတွင်း သွေးယိုခြင်းကြောင့် ဖြစ်သည်။',
    'Brain cells begin to die within minutes of losing their blood supply, so a stroke is always an emergency. Treatment that can dissolve a clot or stop a bleed works best in the first few hours, which is why recognising the signs and calling for help immediately matters more than anything else. Most strokes can be prevented by controlling blood pressure and stopping smoking.':
      'သွေးမရောက်သည့် မိနစ်အနည်းငယ်အတွင်းမှာပင် ဦးနှောက်ဆဲလ်များ စတင် သေဆုံးသောကြောင့် လေဖြတ်ခြင်းသည် အမြဲတမ်း အရေးပေါ် အခြေအနေ ဖြစ်သည်။ သွေးခဲပျော်စေသော သို့မဟုတ် သွေးယိုမှု ရပ်တန့်စေသော ကုသမှုသည် ပထမ နာရီအနည်းငယ်အတွင်း အထိရောက်ဆုံး ဖြစ်သည်။ ထို့ကြောင့် လက္ခဏာများကို သိရှိပြီး ချက်ချင်း အကူအညီ ခေါ်ခြင်းသည် အရေးအကြီးဆုံး ဖြစ်သည်။ လေဖြတ်မှု အများစုကို သွေးပေါင်ချိန် ထိန်းချုပ်ခြင်းနှင့် ဆေးလိပ်ဖြတ်ခြင်းဖြင့် ကာကွယ်နိုင်သည်။',
    'Symptoms (F.A.S.T.)': 'ရောဂါလက္ခဏာများ (F.A.S.T.)',
    'Stroke signs come on suddenly, without warning. Remember the word F.A.S.T.:':
      'လေဖြတ်ခြင်း၏ လက္ခဏာများသည် ကြိုတင်သတိပေးမှုမရှိဘဲ ရုတ်တရက် ပေါ်လာသည်။ F.A.S.T. ဟူသော စကားလုံးကို မှတ်ထားပါ။',
    'F — Face:': 'F — မျက်နှာ −',
    'one side of the face droops, or the smile is uneven':
      'မျက်နှာ တစ်ဖက် ကျဆင်းသွားခြင်း သို့မဟုတ် အပြုံး မညီညာခြင်း',
    'A — Arm:': 'A — လက်မောင်း −',
    'one arm or leg is weak or numb and cannot be raised':
      'လက် သို့မဟုတ် ခြေထောက် တစ်ဖက် အားနည်း သို့မဟုတ် ထုံကျဉ်ပြီး မမြှောက်နိုင်ခြင်း',
    'S — Speech:': 'S — အပြောအဆို −',
    'speech is slurred, or the person cannot find words':
      'စကား ဗလုံးဗထွေး ဖြစ်ခြင်း သို့မဟုတ် စကားလုံး ရှာမရခြင်း',
    'T — Time:': 'T — အချိန် −',
    'call for emergency help at once and note when symptoms began':
      'ချက်ချင်း အရေးပေါ် အကူအညီ ခေါ်ပြီး လက္ခဏာ စတင်သည့်အချိန်ကို မှတ်ထားပါ',
    'Other signs: sudden severe headache, loss of balance, or blurred vision':
      'အခြားလက္ခဏာများ − ရုတ်တရက် ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ မျှခြေ မထိန်းနိုင်ခြင်း သို့မဟုတ် အမြင်ဝါးခြင်း',
    'People with high blood pressure — by far the biggest single cause.':
      'သွေးတိုးရှိသူများ — အဓိကအကျဆုံး အကြောင်းရင်း ဖြစ်သည်။',
    'Those with diabetes, heart disease, or an irregular heartbeat.':
      'ဆီးချို၊ နှလုံးရောဂါ သို့မဟုတ် နှလုံးခုန်နှုန်း မမှန်သူများ။',
    'Older adults, and anyone with high cholesterol.':
      'အသက်ကြီးသူများနှင့် ကိုလက်စထရော မြင့်သူများ။',
    'Smokers, and people who drink heavily.':
      'ဆေးလိပ်သောက်သူများနှင့် အရက် အလွန်အကျွံ သောက်သူများ။',
    'Call an ambulance the moment you notice any F.A.S.T. sign.':
      'F.A.S.T. လက္ခဏာ တစ်ခုခု တွေ့သည်နှင့် ချက်ချင်း လူနာတင်ယာဉ် ခေါ်ပါ။',
    'Note the exact time symptoms started — treatment depends on it.':
      'လက္ခဏာ စတင်သည့် အချိန်အတိအကျကို မှတ်ထားပါ — ကုသမှုသည် ထိုအချိန်အပေါ် မူတည်သည်။',
    'Keep your blood pressure checked and treated.':
      'သွေးပေါင်ချိန်ကို ပုံမှန် စစ်ဆေးပြီး ကုသထားပါ။',
    'Stop smoking, cut down salt, and stay physically active.':
      'ဆေးလိပ် ဖြတ်ပါ၊ ဆား လျှော့ပါ၊ ကိုယ်လက်လှုပ်ရှားမှု ရှိပါစေ။',
    'Start rehabilitation exercises early if a stroke has already happened.':
      'လေဖြတ်ပြီးဖြစ်ပါက ပြန်လည်သန်စွမ်းရေး လေ့ကျင့်ခန်းများကို စောစီးစွာ စတင်ပါ။',
    "Don't wait to see whether the weakness passes — every minute counts.":
      'အားနည်းမှု ပျောက်မပျောက် စောင့်မကြည့်ပါနှင့် — တစ်မိနစ်ချင်းစီ အရေးကြီးသည်။',
    "Don't give food, drink, or tablets to someone who may be having a stroke; they can choke.":
      'လေဖြတ်နိုင်ဖွယ်ရှိသူအား အစားအစာ၊ အရည် သို့မဟုတ် ဆေးလုံး မကျွေးပါနှင့် — လည်ချောင်း ပိတ်နိုင်သည်။',
    "Don't massage, pinch, or apply traditional remedies instead of going to hospital.":
      'ဆေးရုံသွားမည့်အစား နှိပ်နယ်ခြင်း၊ ဆွဲညှစ်ခြင်း သို့မဟုတ် ရိုးရာနည်းလမ်းများ မသုံးပါနှင့်။',
    "Don't stop blood pressure medication once you feel fine.":
      'နေကောင်းလာသည်နှင့် သွေးတိုးဆေးကို မရပ်ပါနှင့်။',
    "Don't ignore brief weakness or slurred speech that resolves — it is a warning.":
      'ခဏတာ အားနည်းခြင်း သို့မဟုတ် စကားဗလုံးဗထွေးဖြစ်ပြီး ပြန်ကောင်းသွားခြင်းကို လျစ်လျူမရှုပါနှင့် — ၎င်းသည် သတိပေးချက် ဖြစ်သည်။',
    'Any of these means calling emergency services immediately — do not wait until morning:':
      'အောက်ပါတို့ တစ်ခုခု ဖြစ်ပါက ချက်ချင်း အရေးပေါ် ဝန်ဆောင်မှုကို ခေါ်ပါ — မနက်ဖြန်အထိ မစောင့်ပါနှင့်။',
    'Sudden drooping on one side of the face': 'ရုတ်တရက် မျက်နှာ တစ်ဖက် ကျဆင်းသွားခြင်း',
    'Sudden weakness or numbness in one arm or leg':
      'ရုတ်တရက် လက် သို့မဟုတ် ခြေထောက် တစ်ဖက် အားနည်းခြင်း သို့မဟုတ် ထုံကျဉ်ခြင်း',
    'Sudden difficulty speaking or understanding others':
      'ရုတ်တရက် စကားပြောရ ခက်ခဲခြင်း သို့မဟုတ် သူတစ်ပါး ပြောသည်ကို နားမလည်ခြင်း',
    'Sudden loss of vision, severe headache, or loss of balance and consciousness':
      'ရုတ်တရက် အမြင်အာရုံ ဆုံးရှုံးခြင်း၊ ပြင်းထန်သော ခေါင်းကိုက်ခြင်း သို့မဟုတ် မျှခြေနှင့် သတိလစ်ခြင်း',
    'Stroke and cardiovascular disease — warning signs, risk factors, and prevention.':
      'လေဖြတ်ခြင်းနှင့် နှလုံးသွေးကြောရောဂါ — သတိပေးလက္ခဏာများ၊ အန္တရာယ်အချက်များနှင့် ကာကွယ်ရေး။',
    'National guidelines on stroke care, emergency referral, and rehabilitation.':
      'လေဖြတ်ရောဂါ စောင့်ရှောက်မှု၊ အရေးပေါ် လွှဲပြောင်းမှုနှင့် ပြန်လည်သန်စွမ်းရေးဆိုင်ရာ အမျိုးသားအဆင့် လမ်းညွှန်ချက်များ။',
    'HEARTS technical package and regional stroke prevention guidance.':
      'HEARTS နည်းပညာအစီအစဉ်နှင့် ဒေသတွင်း လေဖြတ်ခြင်း ကာကွယ်ရေး လမ်းညွှန်ချက်များ။',

    /* --- anemia detail --- */
    'Anemia means the blood does not have enough healthy red blood cells, or enough haemoglobin inside them, to carry oxygen around the body.':
      'သွေးအားနည်းရောဂါဆိုသည်မှာ ခန္ဓာကိုယ်တစ်ဝှမ်း အောက်ဆီဂျင် သယ်ဆောင်ရန် လိုအပ်သော ကျန်းမာသည့် သွေးနီဥများ သို့မဟုတ် ၎င်းတို့အတွင်းရှိ ဟေမိုဂလိုဘင် မလုံလောက်ခြင်း ဖြစ်သည်။',
    'Because every organ depends on that oxygen, the first sign is usually simple tiredness — often put down to overwork or lack of sleep. The most common cause here is a shortage of iron, from a diet low in iron-rich food, from heavy monthly periods, or from the extra demands of pregnancy. Once the cause is found, anemia usually improves well with diet, supplements, or treatment of the underlying problem.':
      'ကိုယ်တွင်းအင်္ဂါ အားလုံးသည် ထိုအောက်ဆီဂျင်ကို မှီခိုသောကြောင့် ပထမဆုံး လက္ခဏာမှာ ပင်ပန်းနွမ်းနယ်ခြင်း ဖြစ်လေ့ရှိပြီး အလုပ်ပင်ပန်းလွန်းသည် သို့မဟုတ် အိပ်ရေးမဝဟု ထင်မှတ်တတ်ကြသည်။ အဖြစ်များဆုံး အကြောင်းရင်းမှာ သံဓာတ် ချို့တဲ့ခြင်း ဖြစ်ပြီး သံဓာတ်ပါသော အစားအစာ နည်းခြင်း၊ ဓမ္မတာ သွေးဆင်းများခြင်း သို့မဟုတ် ကိုယ်ဝန်ဆောင်ချိန် လိုအပ်ချက် များပြားခြင်းတို့ကြောင့် ဖြစ်သည်။ အကြောင်းရင်း တွေ့ရှိပါက အစားအသောက်၊ အားဆေးများ သို့မဟုတ် မူလရောဂါကို ကုသခြင်းဖြင့် ကောင်းစွာ သက်သာလာတတ်သည်။',
    'Mild anemia may cause almost nothing. As it deepens, you may notice:':
      'အပျော့စား သွေးအားနည်းမှုတွင် လက္ခဏာ မရှိသလောက် ဖြစ်နိုင်သည်။ ပိုဆိုးလာသည်နှင့်အမျှ အောက်ပါတို့ ခံစားရနိုင်သည်။',
    'Tiredness and weakness that rest does not fix':
      'အနားယူသော်လည်း မပျောက်သော ပင်ပန်းနွမ်းနယ်ခြင်းနှင့် အားနည်းခြင်း',
    'Dizziness or light-headedness, especially on standing up':
      'မူးဝေခြင်း သို့မဟုတ် ခေါင်းပေါ့ခြင်း၊ အထူးသဖြင့် ထရပ်လိုက်သည့်အခါ',
    'Pale skin, and pale lips, gums, or inner eyelids':
      'အသားအရေ ဖျော့တော့ခြင်း၊ နှုတ်ခမ်း၊ သွားဖုံးနှင့် မျက်ခွံအတွင်းသား ဖြူဖျော့ခြင်း',
    'Getting breathless with ordinary activity':
      'သာမန် လှုပ်ရှားမှုဖြင့်ပင် မောဟိုက်ခြင်း',
    'Cold hands and feet, headaches, or a fast heartbeat':
      'လက်ခြေ အေးစက်ခြင်း၊ ခေါင်းကိုက်ခြင်း သို့မဟုတ် နှလုံးခုန်မြန်ခြင်း',
    'Women of childbearing age, particularly with heavy periods.':
      'သားဖွားနိုင်သည့် အရွယ် အမျိုးသမီးများ၊ အထူးသဖြင့် ဓမ္မတာ သွေးဆင်းများသူများ။',
    'Pregnant women, whose iron needs rise sharply.':
      'ကိုယ်ဝန်ဆောင်မိခင်များ — သံဓာတ် လိုအပ်ချက် သိသိသာသာ တိုးလာသည်။',
    'Young children and adolescents during growth spurts.':
      'ကြီးထွားမှု မြန်ဆန်ချိန်ရှိ ကလေးငယ်များနှင့် ဆယ်ကျော်သက်များ။',
    'People with a poor diet, worm infection, or long-term blood loss.':
      'အာဟာရ ချို့တဲ့သူများ၊ သန်ကောင်ရှိသူများ သို့မဟုတ် ရေရှည် သွေးဆုံးရှုံးနေသူများ။',
    'Eat iron-rich foods: meat, liver, fish, beans, and dark green leafy vegetables.':
      'သံဓာတ် ကြွယ်ဝသော အစားအစာများ စားပါ − အသား၊ အသည်း၊ ငါး၊ ပဲမျိုးစုံနှင့် အစိမ်းရင့်ရောင် အရွက်များ။',
    'Add vitamin C — a lime, orange, or tomato with meals helps you absorb iron.':
      'ဗီတာမင် C ဖြည့်ပါ — ထမင်းနှင့်အတူ သံပုရာ၊ လိမ္မော် သို့မဟုတ် ခရမ်းချဉ်သီး စားပါက သံဓာတ် စုပ်ယူမှု ပိုကောင်းသည်။',
    'Take iron tablets for the full period advised, not just until you feel better.':
      'သံဓာတ်ဆေးလုံးများကို နေကောင်းသည်အထိသာမက ညွှန်ကြားထားသည့် ကာလ အပြည့် သောက်ပါ။',
    'Have a blood test in pregnancy and at antenatal visits.':
      'ကိုယ်ဝန်ဆောင်စဉ်နှင့် ကိုယ်ဝန်ဆောင် ပြသချိန်များတွင် သွေးစစ်ပါ။',
    'Take deworming treatment if your health worker recommends it.':
      'ကျန်းမာရေးဝန်ထမ်းက ညွှန်ကြားပါက သန်ချဆေး သောက်ပါ။',
    "Don't drink strong tea or coffee with meals — they block iron absorption.":
      'ထမင်းနှင့်အတူ လက်ဖက်ရည်ကြမ်း သို့မဟုတ် ကော်ဖီ မသောက်ပါနှင့် — သံဓာတ် စုပ်ယူမှုကို ပိတ်ဆို့သည်။',
    "Don't dismiss constant tiredness as simply overwork.":
      'အမြဲ ပင်ပန်းနေခြင်းကို အလုပ်များလွန်း၍ဟု လွယ်လွယ် မမှတ်ယူပါနှင့်။',
    "Don't take iron tablets long-term without a blood test confirming you need them.":
      'သွေးစစ်ချက်ဖြင့် အတည်မပြုရသေးဘဲ သံဓာတ်ဆေးလုံးများကို ရေရှည် မသောက်ပါနှင့်။',
    "Don't ignore heavy periods or blood in the stool.":
      'ဓမ္မတာ သွေးဆင်းများခြင်း သို့မဟုတ် ဝမ်းတွင် သွေးပါခြင်းကို လျစ်လျူမရှုပါနှင့်။',
    "Don't stand up suddenly if you feel faint.":
      'မူးဝေသလို ခံစားရပါက ရုတ်တရက် မထရပ်ပါနှင့်။',
    'Ask for a simple blood test if tiredness and paleness last more than a few weeks, and seek care promptly if you have:':
      'ပင်ပန်းနွမ်းနယ်ခြင်းနှင့် အသားဖျော့ခြင်း ရက်သတ္တပတ်အနည်းငယ်ထက် ကြာပါက သွေးစစ်ခိုင်းပါ။ အောက်ပါတို့ ဖြစ်ပါက ချက်ချင်း ဆေးကုသမှု ခံယူပါ။',
    'Fainting spells or repeated dizziness':
      'မေ့လဲခြင်း သို့မဟုတ် ထပ်ခါထပ်ခါ မူးဝေခြင်း',
    'Severe weakness, or breathlessness while sitting still':
      'ပြင်းထန်သော အားနည်းခြင်း သို့မဟုတ် ငြိမ်ငြိမ်ထိုင်နေစဉ်ပင် မောဟိုက်ခြင်း',
    'A racing or pounding heartbeat with chest discomfort':
      'နှလုံးခုန် မြန်ခြင်း သို့မဟုတ် ပြင်းထန်စွာ ခုန်ခြင်းနှင့်အတူ ရင်ဘတ် မသက်မသာ ဖြစ်ခြင်း',
    'Black or bloody stools, or unusually heavy menstrual bleeding':
      'ဝမ်း အနက်ရောင် သို့မဟုတ် သွေးပါခြင်း၊ သို့မဟုတ် ဓမ္မတာ သွေးဆင်း ပုံမှန်ထက် များလွန်းခြင်း',
    'Anaemia — causes, consequences, and iron supplementation guidance.':
      'သွေးအားနည်းရောဂါ — အကြောင်းရင်းများ၊ ဆိုးကျိုးများနှင့် သံဓာတ် ဖြည့်စွက်မှု လမ်းညွှန်။',
    'National nutrition programme, iron-folate supplementation, and maternal health services.':
      'အမျိုးသားအဆင့် အာဟာရအစီအစဉ်၊ သံဓာတ်နှင့် ဖောလိတ် ဖြည့်စွက်မှုနှင့် မိခင်ကျန်းမာရေး ဝန်ဆောင်မှုများ။',
    'Regional guidance on anaemia reduction in women and children.':
      'အမျိုးသမီးများနှင့် ကလေးများတွင် သွေးအားနည်းမှု လျှော့ချရေးဆိုင်ရာ ဒေသတွင်း လမ်းညွှန်ချက်များ။',

    /* --- typhoid fever detail --- */
    'Typhoid fever is an infection caused by the bacterium Salmonella Typhi, which spreads through food and drinking water contaminated by human waste.':
      'တိုက်ဖွိုက်ရောဂါသည် Salmonella Typhi ဘက်တီးရီးယားကြောင့် ဖြစ်ပွားပြီး လူ့မစင်ဖြင့် ညစ်ညမ်းသော အစားအစာနှင့် သောက်ရေမှတစ်ဆင့် ကူးစက်သည်။',
    'Unlike most fevers, typhoid builds up step by step: a low fever in the first days that climbs higher each evening, along with headache, stomach pain, and deep weakness. It responds well to antibiotics, but if it is left untreated the infection can damage the wall of the intestine, so a fever lasting more than three days deserves a proper test rather than guesswork.':
      'အခြားအဖျားများနှင့် မတူဘဲ တိုက်ဖွိုက်သည် တဆင့်ချင်း တိုးလာသည် − ပထမရက်များတွင် အဖျားနည်းနည်းဖြစ်ပြီး ညနေတိုင်း ပိုမြင့်လာကာ ခေါင်းကိုက်ခြင်း၊ ဗိုက်အောင့်ခြင်းနှင့် အလွန်အမင်း နွမ်းနယ်ခြင်းတို့ ပါလာသည်။ ပဋိဇီဝဆေးဖြင့် ကောင်းစွာ သက်သာသော်လည်း ကုသမှု မခံယူပါက အူနံရံကို ထိခိုက်စေနိုင်သည်။ ထို့ကြောင့် သုံးရက်ထက်ပိုကြာသော အဖျားကို မှန်းဆခြင်းမပြုဘဲ စနစ်တကျ စစ်ဆေးသင့်သည်။',
    'Symptoms usually appear one to three weeks after exposure and worsen gradually:':
      'လက္ခဏာများသည် ရောဂါပိုးနှင့် ထိတွေ့ပြီး တစ်ပတ်မှ သုံးပတ်အတွင်း ပေါ်လာပြီး တဖြည်းဖြည်း ပိုဆိုးလာသည်။',
    'A fever that rises higher day by day and stays for a week or more':
      'တစ်နေ့ထက်တစ်နေ့ ပိုမြင့်လာပြီး တစ်ပတ် သို့မဟုတ် ထို့ထက်ပို ကြာသော အဖျား',
    'Stomach pain, bloating, and tenderness':
      'ဗိုက်အောင့်ခြင်း၊ ဗိုက်အောင့်ဖင့်ခြင်းနှင့် ထိလျှင် နာခြင်း',
    'Constipation in adults, or diarrhoea in children':
      'လူကြီးများတွင် ဝမ်းချုပ်ခြင်း၊ ကလေးများတွင် ဝမ်းလျှောခြင်း',
    'Persistent headache and loss of appetite':
      'ဆက်တိုက် ခေါင်းကိုက်ခြင်းနှင့် အစားအသောက် မဝင်စားခြင်း',
    'Marked weakness, and sometimes nosebleeds':
      'သိသိသာသာ နွမ်းနယ်ခြင်းနှင့် တစ်ခါတစ်ရံ နှာခေါင်းသွေးယိုခြင်း',
    'People without a reliable supply of safe drinking water.':
      'သန့်ရှင်းသော သောက်သုံးရေ မှန်မှန် မရရှိသူများ။',
    'Those who often eat street food prepared in unhygienic conditions.':
      'သန့်ရှင်းမှု မရှိသည့် အခြေအနေတွင် ပြင်ဆင်ထားသော လမ်းဘေးစားသောက်ဆိုင်များကို မကြာခဏ စားသုံးသူများ။',
    'Communities with poor sanitation or flooding.':
      'မိလ္လာစနစ် ညံ့ဖျင်းသော သို့မဟုတ် ရေကြီးတတ်သော ရပ်ရွာများ။',
    'Household contacts of someone recently ill with typhoid.':
      'မကြာသေးမီက တိုက်ဖွိုက်ဖြစ်ခဲ့သူနှင့် အတူနေ မိသားစုဝင်များ။',
    'Drink only boiled or properly treated water.':
      'ကျိုချက်ထားသော သို့မဟုတ် စနစ်တကျ သန့်စင်ထားသော ရေကိုသာ သောက်ပါ။',
    'Eat food that is freshly cooked and still hot.':
      'အသစ်ချက်ထားပြီး ပူနွေးနေဆဲ အစားအစာကို စားပါ။',
    'Wash your hands with soap before eating and after using the toilet.':
      'မစားမီနှင့် အိမ်သာသုံးပြီးနောက် ဆပ်ပြာဖြင့် လက်ဆေးပါ။',
    'Ask about the typhoid vaccine, especially for children.':
      'တိုက်ဖွိုက် ကာကွယ်ဆေးအကြောင်း မေးမြန်းပါ၊ အထူးသဖြင့် ကလေးများအတွက်။',
    'Finish the whole antibiotic course your doctor prescribes.':
      'ဆရာဝန် ညွှန်ကြားထားသော ပဋိဇီဝဆေးကို အပြည့်အဝ သောက်ပါ။',
    "Don't drink untreated water or take ice from an unknown source.":
      'သန့်စင်မထားသော ရေ မသောက်ပါနှင့်။ မည်သည့်နေရာမှ လာသည် မသိသော ရေခဲကိုလည်း မသုံးပါနှင့်။',
    "Don't eat raw salads or peeled fruit washed in unsafe water.":
      'မသန့်သော ရေဖြင့် ဆေးထားသည့် အသုပ်စိမ်းများနှင့် အခွံနွှာထားသော သစ်သီးများ မစားပါနှင့်။',
    "Don't buy antibiotics over the counter and stop when the fever settles.":
      'ဆေးဆိုင်တွင် ကိုယ်တိုင် ပဋိဇီဝဆေး ဝယ်သောက်ပြီး အဖျားကျသည်နှင့် မရပ်ပါနှင့်။',
    "Don't prepare food for others while you are ill or just recovering.":
      'ဖျားနာနေချိန် သို့မဟုတ် ခုမှ သက်သာစ ကာလတွင် သူတစ်ပါးအတွက် အစားအစာ မပြင်ဆင်ပါနှင့်။',
    "Don't let a fever run past three days without getting it checked.":
      'အဖျားကို သုံးရက်ကျော်သည်အထိ မစစ်ဆေးဘဲ မထားပါနှင့်။',
    'See a healthcare worker for any fever lasting more than three days, and go to hospital urgently if you notice:':
      'သုံးရက်ထက်ပိုကြာသော အဖျားအတွက် ကျန်းမာရေးဝန်ထမ်းနှင့် ပြပါ။ အောက်ပါတို့ တွေ့ပါက အမြန် ဆေးရုံသို့ သွားပါ။',
    'High fever that persists for several days despite treatment':
      'ကုသသော်လည်း ရက်များစွာ မကျသော အဖျားပြင်းခြင်း',
    'Severe abdominal pain, or a stomach that becomes hard and swollen':
      'ဗိုက် ပြင်းထန်စွာ အောင့်ခြင်း သို့မဟုတ် ဗိုက် မာတောင့်ပြီး ဖောရောင်လာခြင်း',
    'Blood in the stools, or black tarry stools':
      'ဝမ်းတွင် သွေးပါခြင်း သို့မဟုတ် ဝမ်း အနက်ရောင် ကတ္တရာကဲ့သို့ ဖြစ်ခြင်း',
    'Confusion, drowsiness, or being unable to keep fluids down':
      'စိတ်ရှုပ်ထွေးခြင်း၊ ငိုက်မျဉ်းခြင်း သို့မဟုတ် သောက်သမျှ ပြန်အန်ထွက်ခြင်း',
    'Typhoid — transmission, symptoms, vaccination, and treatment.':
      'တိုက်ဖွိုက်ရောဂါ — ကူးစက်ပုံ၊ လက္ခဏာများ၊ ကာကွယ်ဆေးထိုးခြင်းနှင့် ကုသမှု။',
    'Water, sanitation and hygiene guidance and communicable disease control.':
      'ရေ၊ မိလ္လာနှင့် သန့်ရှင်းရေး လမ်းညွှန်ချက်များနှင့် ကူးစက်ရောဂါ ထိန်းချုပ်ရေး။',
    'Regional guidance on enteric fever, safe water, and antimicrobial resistance.':
      'အူလမ်းကြောင်း အဖျားရောဂါ၊ ဘေးကင်းသောရေနှင့် ဆေးယဉ်ပါးမှုဆိုင်ရာ ဒေသတွင်း လမ်းညွှန်ချက်များ။',

    /* --- pre-eclampsia detail --- */
    'Pre-eclampsia is a complication of pregnancy in which blood pressure rises after about 20 weeks, usually together with protein in the urine.':
      'ကိုယ်ဝန်ဆောင် သွေးတိုးရောဂါဆိုသည်မှာ ကိုယ်ဝန် ရက်သတ္တပတ် ၂၀ ခန့် နောက်ပိုင်းတွင် သွေးဖိအား မြင့်တက်လာပြီး အများအားဖြင့် ဆီးတွင် ပရိုတင်း ပါလာသည့် ကိုယ်ဝန်ဆောင် နောက်ဆက်တွဲ ပြဿနာ ဖြစ်သည်။',
    "It affects the mother's blood vessels and can reduce the blood supply reaching the baby. Many women feel entirely well while it develops, which is exactly why antenatal visits check blood pressure and urine every time. Caught early it can be watched and managed safely; left unrecognised it can progress to eclampsia, in which the mother has seizures. The only complete cure is the birth of the baby, and the timing of that is a decision for the medical team.":
      'ဤရောဂါသည် မိခင်၏ သွေးကြောများကို ထိခိုက်စေပြီး ကလေးထံ ရောက်ရှိသည့် သွေးကို လျော့နည်းစေနိုင်သည်။ ဖြစ်ပွားနေချိန်တွင် အမျိုးသမီးများစွာမှာ လုံးဝ နေကောင်းသည်ဟု ခံစားရသောကြောင့် ကိုယ်ဝန်ဆောင် ပြသတိုင်း သွေးဖိအားနှင့် ဆီးကို စစ်ဆေးပေးခြင်း ဖြစ်သည်။ စောစီးစွာ တွေ့ရှိပါက ဘေးကင်းစွာ စောင့်ကြည့် ထိန်းညှိနိုင်သည်။ မသိရှိဘဲ ထားပါက မိခင်တွင် တက်ခြင်း ဖြစ်စေသော ပရီအက်ကလမ်ဆီးယား အဆင့်သို့ ရောက်နိုင်သည်။ လုံးဝ ပျောက်ကင်းစေသည့် တစ်ခုတည်းသော နည်းလမ်းမှာ ကလေး မွေးဖွားခြင်းဖြစ်ပြီး မည်သည့်အချိန်တွင် မွေးမည်ကို ဆေးအဖွဲ့က ဆုံးဖြတ်ပါသည်။',
    'Early pre-eclampsia often has no symptoms and is found only at a check-up. Warning signs include:':
      'အစပိုင်းတွင် လက္ခဏာ မပြဘဲ ဆေးစစ်မှသာ တွေ့ရှိတတ်သည်။ သတိပေးလက္ခဏာများမှာ −',
    'Swelling of the hands, face, and feet, coming on quickly':
      'လက်၊ မျက်နှာနှင့် ခြေထောက်များ လျင်မြန်စွာ ဖောရောင်လာခြင်း',
    'A severe headache that does not go away':
      'မပျောက်သော ပြင်းထန်သည့် ခေါင်းကိုက်ခြင်း',
    'Blurred vision, flashing lights, or spots before the eyes':
      'အမြင်ဝါးခြင်း၊ အလင်းများ လက်နေခြင်း သို့မဟုတ် မျက်စိရှေ့တွင် အစက်များ မြင်ခြင်း',
    'Pain just below the ribs on the right side, or in the upper abdomen':
      'ညာဘက် နံရိုးအောက် သို့မဟုတ် ဗိုက်အထက်ပိုင်းတွင် နာကျင်ခြင်း',
    'Vomiting, or a sudden gain in weight over a few days':
      'အန်ခြင်း သို့မဟုတ် ရက်အနည်းငယ်အတွင်း ကိုယ်အလေးချိန် ရုတ်တရက် တက်လာခြင်း',
    'Women in their first pregnancy.': 'ပထမဆုံး ကိုယ်ဝန်ဆောင်သည့် အမျိုးသမီးများ။',
    'Mothers over the age of 35.': 'အသက် ၃၅ နှစ်အထက် မိခင်များ။',
    'Those carrying twins or triplets.':
      'အမြွှာ နှစ်ယောက် သို့မဟုတ် သုံးယောက် ကိုယ်ဝန်ဆောင်ထားသူများ။',
    'Women with existing high blood pressure, diabetes, kidney disease, or pre-eclampsia in an earlier pregnancy.':
      'သွေးတိုး၊ ဆီးချို၊ ကျောက်ကပ်ရောဂါ ရှိနှင့်ပြီးသူများ သို့မဟုတ် ယခင် ကိုယ်ဝန်တွင် သွေးတိုး ဖြစ်ဖူးသူများ။',
    'Attend every antenatal check-up, even when you feel perfectly well.':
      'လုံးဝ နေကောင်းသည်ဟု ခံစားရသော်လည်း ကိုယ်ဝန်ဆောင် ဆေးစစ်ချိန် တိုင်းသို့ သွားပါ။',
    'Have your blood pressure and urine checked at each visit.':
      'ပြသတိုင်း သွေးဖိအားနှင့် ဆီးကို စစ်ဆေးပါ။',
    'Rest when you can, and lie on your left side when resting.':
      'အားလပ်ချိန်တွင် အနားယူပါ။ အနားယူသည့်အခါ ဘယ်ဘက်စောင်း အိပ်ပါ။',
    'Report any headache, swelling, or vision change straight away.':
      'ခေါင်းကိုက်ခြင်း၊ ဖောရောင်ခြင်း သို့မဟုတ် အမြင်အာရုံ ပြောင်းလဲခြင်း ရှိပါက ချက်ချင်း အကြောင်းကြားပါ။',
    'Take the calcium or aspirin your doctor prescribes for prevention.':
      'ကာကွယ်ရန်အတွက် ဆရာဝန် ညွှန်ကြားထားသော ကယ်လ်ဆီယမ် သို့မဟုတ် အက်စပရင်ကို သောက်ပါ။',
    "Don't skip antenatal visits because the pregnancy feels normal.":
      'ကိုယ်ဝန်က ပုံမှန်ဟု ထင်ရသောကြောင့် ကိုယ်ဝန်ဆောင် ပြသချိန်များကို မလွတ်ပါစေနှင့်။',
    "Don't dismiss swelling of the face and hands as ordinary pregnancy swelling.":
      'မျက်နှာနှင့် လက်များ ဖောရောင်ခြင်းကို သာမန် ကိုယ်ဝန်ဆောင် ဖောရောင်မှုဟု မမှတ်ယူပါနှင့်။',
    "Don't take any medicine, herbal or otherwise, without asking your midwife or doctor.":
      'သားဖွားဆရာမ သို့မဟုတ် ဆရာဝန်နှင့် မတိုင်ပင်ဘဲ မည်သည့်ဆေးမဆို၊ ဆေးဖက်ဝင်အပင် ဆေးများပါ မသောက်ပါနှင့်။',
    "Don't plan a home delivery if you have been told your blood pressure is high.":
      'သွေးဖိအား မြင့်နေသည်ဟု ပြောခံရပါက အိမ်တွင် မွေးဖွားရန် မစီစဉ်ပါနှင့်။',
    "Don't wait until morning to report severe headache or blurred vision.":
      'ပြင်းထန်သော ခေါင်းကိုက်ခြင်း သို့မဟုတ် အမြင်ဝါးခြင်းကို မနက်ဖြန်အထိ မစောင့်ဘဲ အကြောင်းကြားပါ။',
    'Go to a hospital with maternity care immediately — this is an emergency for both mother and baby — if you have:':
      'အောက်ပါတို့ ဖြစ်ပါက သားဖွားဌာန ရှိသည့် ဆေးရုံသို့ ချက်ချင်း သွားပါ — မိခင်နှင့် ကလေး နှစ်ဦးစလုံးအတွက် အရေးပေါ် အခြေအနေ ဖြစ်သည်။',
    'A sudden severe headache that will not ease':
      'ရုတ်တရက် ဖြစ်ပေါ်လာပြီး မသက်သာသော ပြင်းထန်သည့် ခေါင်းကိုက်ခြင်း',
    'Blurred vision, flashing lights, or loss of vision':
      'အမြင်ဝါးခြင်း၊ အလင်းများ လက်နေခြင်း သို့မဟုတ် အမြင်အာရုံ ဆုံးရှုံးခြင်း',
    'Rapid swelling of the face and hands':
      'မျက်နှာနှင့် လက်များ လျင်မြန်စွာ ဖောရောင်လာခြင်း',
    "A fit or convulsion (eclampsia), or the baby's movements slowing or stopping":
      'တက်ခြင်း (အက်ကလမ်ဆီးယား) သို့မဟုတ် ကလေး၏ လှုပ်ရှားမှု နှေးလာခြင်း သို့မဟုတ် ရပ်သွားခြင်း',
    'Maternal health — recommendations on the prevention and treatment of pre-eclampsia and eclampsia.':
      'မိခင်ကျန်းမာရေး — ကိုယ်ဝန်ဆောင် သွေးတိုးနှင့် တက်ခြင်းရောဂါ ကာကွယ်ရေးနှင့် ကုသရေး အကြံပြုချက်များ။',
    'Antenatal care standards and maternal and reproductive health services.':
      'ကိုယ်ဝန်ဆောင် စောင့်ရှောက်မှု စံနှုန်းများနှင့် မိခင်နှင့် မျိုးဆက်ပွား ကျန်းမာရေး ဝန်ဆောင်မှုများ။',
    'Regional guidance on maternal mortality reduction and emergency obstetric care.':
      'မိခင် သေဆုံးမှု လျှော့ချရေးနှင့် အရေးပေါ် သားဖွား စောင့်ရှောက်မှုဆိုင်ရာ ဒေသတွင်း လမ်းညွှန်ချက်များ။',

    /* --- legal pages: headings and controls --------------------------
       The body text of these three pages is English only and says so
       through .mc-lang-note. Headings, the map gate, and the settings
       controls are translated, since those are interface, not prose. */
    'Terms of Use': 'အသုံးပြုမှု စည်းကမ်းချက်များ',
    'Privacy Policy': 'ကိုယ်ရေးအချက်အလက် မူဝါဒ',
    'Cookie Settings': 'ကွတ်ကီး ဆက်တင်များ',
    'The conditions under which MedCare is offered, and the limits of what this site can do for you.':
      'MedCare ကို မည်သည့်စည်းကမ်းဖြင့် ပေးအပ်သည်နှင့် ဤဝဘ်ဆိုက်က သင့်အတွက် လုပ်ပေးနိုင်သည့် အကန့်အသတ်များ။',
    'What MedCare knows about you, what it stores, and who else sees your visit.':
      'MedCare က သင့်အကြောင်း မည်သည်ကို သိသလဲ၊ မည်သည်ကို သိမ်းဆည်းသလဲနှင့် သင့်လာရောက်မှုကို အခြားမည်သူ မြင်နိုင်သလဲ။',
    'Exactly what this site keeps in your browser, and the controls to change it.':
      'ဤဝဘ်ဆိုက်က သင့်ဘရောက်ဆာတွင် သိမ်းထားသည့်အရာ အတိအကျနှင့် ၎င်းကို ပြောင်းလဲရန် ထိန်းချုပ်မှုများ။',
    'Your settings': 'သင့်ဆက်တင်များ',
    'Language preference': 'ဘာသာစကား ရွေးချယ်မှု',
    'Google Maps on the Find Hospitals page': 'ဆေးရုံရှာသည့် စာမျက်နှာရှိ Google Maps',
    'Forget this setting': 'ဤဆက်တင်ကို ဖျက်ရန်',
    'Load the map automatically': 'မြေပုံကို အလိုအလျောက် ဖွင့်ရန်',
    'Nothing stored': 'သိမ်းထားသည် မရှိပါ',
    'Stored — English': 'သိမ်းထားသည် — အင်္ဂလိပ်',
    'Stored — Burmese': 'သိမ်းထားသည် — မြန်မာ',
    'Allowed — the map loads automatically': 'ခွင့်ပြုထားသည် — မြေပုံ အလိုအလျောက် ပေါ်မည်',
    'Not allowed — the map waits for a click': 'ခွင့်မပြုထားပါ — မြေပုံသည် နှိပ်မှသာ ပေါ်မည်',
    'The map is loaded from Google, which may set cookies and will see your IP address.':
      'မြေပုံကို Google မှ ရယူသည်။ ၎င်းသည် ကွတ်ကီးများ ထားရှိနိုင်ပြီး သင့် IP လိပ်စာကို မြင်ရပါမည်။',
    'Load the map': 'မြေပုံ ဖွင့်ရန်',
    'MedCare is not medical care': 'MedCare သည် ဆေးကုသမှု မဟုတ်ပါ',
    'The short version': 'အကျဉ်းချုပ်',
    'MedCare sets no cookies': 'MedCare သည် ကွတ်ကီး မထားရှိပါ',
    'A note on shared devices': 'အတူတကွ သုံးသည့် ဖုန်း/ကွန်ပျူတာအတွက် မှတ်ချက်',
    'Related pages': 'ဆက်စပ် စာမျက်နှာများ',
    '— what we do and do not collect.': '— ကျွန်ုပ်တို့ စုဆောင်းသည်နှင့် မစုဆောင်းသည်များ။',
    '— what this site stores in your browser.':
      '— ဤဝဘ်ဆိုက်က သင့်ဘရောက်ဆာတွင် သိမ်းထားသည့်အရာများ။',
    '— the conditions for using the site.': '— ဝဘ်ဆိုက် အသုံးပြုမှု စည်းကမ်းချက်များ။',
    'Last updated: August 2026.': 'နောက်ဆုံး ပြင်ဆင်သည့်ရက် − ၂၀၂၆ ဩဂုတ်။',
    'Contact': 'ဆက်သွယ်ရန်',

    /* --- terms of use: body --- */
    'MedCare is a free health information website. By using it, you agree to the terms set out below.':
      'MedCare သည် အခမဲ့ ကျန်းမာရေး အချက်အလက် ဝဘ်ဆိုက် ဖြစ်သည်။ ၎င်းကို အသုံးပြုခြင်းဖြင့် အောက်ဖော်ပြပါ စည်းကမ်းချက်များကို သဘောတူသည်ဟု မှတ်ယူပါမည်။',
    'Everything on this site is general information for the public. It is not a diagnosis, a prescription, or personal medical advice, and it cannot take the place of a consultation with a qualified health worker who can examine you.':
      'ဤဝဘ်ဆိုက်ရှိ အရာအားလုံးသည် အများပြည်သူအတွက် အထွေထွေ အချက်အလက်များသာ ဖြစ်သည်။ ရောဂါရှာဖွေချက်၊ ဆေးညွှန်း သို့မဟုတ် တစ်ဦးချင်း ဆေးပညာ အကြံပြုချက် မဟုတ်ပါ။ သင့်ကို စစ်ဆေးပေးနိုင်သည့် အရည်အချင်းပြည့်မီသော ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ခြင်းအစား အစားထိုး၍ မရပါ။',
    'If you think you are having a medical emergency, do not spend time reading. Go to the nearest hospital or call an ambulance.':
      'အရေးပေါ် ဖြစ်နေသည်ဟု ထင်ပါက စာဖတ်၍ အချိန်မကုန်ပါစေနှင့်။ အနီးဆုံး ဆေးရုံသို့ သွားပါ သို့မဟုတ် လူနာတင်ယာဉ် ခေါ်ပါ။',
    'Who we are': 'ကျွန်ုပ်တို့ မည်သူများလဲ',
    'MedCare is a student project, built and maintained by a five-person team as coursework. It is offered free of charge, with no advertising and no commercial sponsor. It is not a hospital, a clinic, a pharmacy, or a registered healthcare provider, and no doctor–patient relationship is created by your use of it.':
      'MedCare သည် ကျောင်းသား စီမံကိန်းတစ်ခု ဖြစ်ပြီး ငါးဦးပါ အဖွဲ့တစ်ဖွဲ့မှ သင်တန်းလုပ်ငန်းအဖြစ် တည်ဆောက် ထိန်းသိမ်းထားသည်။ ကြော်ငြာမပါ၊ စီးပွားရေး ကမကထပြုသူ မရှိဘဲ အခမဲ့ ပေးအပ်ထားပါသည်။ ဆေးရုံ၊ ဆေးခန်း၊ ဆေးဆိုင် သို့မဟုတ် မှတ်ပုံတင်ထားသော ကျန်းမာရေး ဝန်ဆောင်မှုပေးသူ မဟုတ်ပါ။ ၎င်းကို အသုံးပြုခြင်းဖြင့် ဆရာဝန်နှင့် လူနာ ဆက်ဆံရေး မဖြစ်ပေါ်ပါ။',
    'Using the site': 'ဝဘ်ဆိုက် အသုံးပြုခြင်း',
    'You may read, print, and share our pages for your own personal, non-commercial use, and for teaching or community health education, as long as you keep the content intact and credit MedCare as the source.':
      'အကြောင်းအရာကို မပြောင်းလဲဘဲ ထားပြီး MedCare ကို ရင်းမြစ်အဖြစ် ဖော်ပြပါက ကိုယ်ပိုင် စီးပွားဖြစ်မဟုတ်သော အသုံးပြုမှု၊ သင်ကြားရေး သို့မဟုတ် ရပ်ရွာ ကျန်းမာရေး ပညာပေးအတွက် ကျွန်ုပ်တို့၏ စာမျက်နှာများကို ဖတ်ရှု၊ ပုံနှိပ်၊ မျှဝေနိုင်ပါသည်။',
    'You agree not to:': 'အောက်ပါတို့ကို မပြုလုပ်ရန် သဘောတူပါသည် −',
    'Present our content as your own, or as the advice of a licensed clinician.':
      'ကျွန်ုပ်တို့၏ အကြောင်းအရာကို ကိုယ်ပိုင်အဖြစ် သို့မဟုတ် လိုင်စင်ရ ဆရာဝန်၏ အကြံပြုချက်အဖြစ် မဖော်ပြရန်။',
    'Alter the medical content and continue to attribute it to MedCare.':
      'ဆေးပညာ အကြောင်းအရာကို ပြင်ဆင်ပြီးနောက် MedCare မှဟု ဆက်လက် ဖော်ပြခြင်း မပြုရန်။',
    'Sell the content, or place it behind a paywall.':
      'အကြောင်းအရာကို ရောင်းချခြင်း သို့မဟုတ် ငွေပေးမှသာ ဖတ်ရသည့် စနစ်ဖြင့် ထားရှိခြင်း မပြုရန်။',
    'Attempt to disrupt the site, or use automated tools to overload it.':
      'ဝဘ်ဆိုက်ကို အနှောင့်အယှက်ပေးရန် သို့မဟုတ် အလိုအလျောက် ကိရိယာများဖြင့် ဝန်ပိုစေရန် မကြိုးပမ်းရန်။',
    'Accuracy and limits of the information': 'အချက်အလက်၏ တိကျမှုနှင့် အကန့်အသတ်များ',
    'Our disease and article pages are written in plain language from public health sources, and each page lists the sources it draws on. We review them periodically and show the date of the last review at the foot of each page.':
      'ကျွန်ုပ်တို့၏ ရောဂါနှင့် ဆောင်းပါး စာမျက်နှာများကို အများပြည်သူ ကျန်းမာရေး ရင်းမြစ်များမှ ရိုးရှင်းသော ဘာသာစကားဖြင့် ရေးသားထားပြီး စာမျက်နှာတိုင်းတွင် ကိုးကားသည့် ရင်းမြစ်များကို ဖော်ပြထားသည်။ အခါအားလျော်စွာ ပြန်လည် စိစစ်ပြီး နောက်ဆုံး စိစစ်သည့်ရက်ကို စာမျက်နှာအောက်ခြေတွင် ဖော်ပြပါသည်။',
    'Even so, medical knowledge changes, and general guidance cannot account for your age, your other conditions, the medicines you already take, or whether you are pregnant. Information here may be incomplete or out of date by the time you read it. Always confirm anything that affects a decision about your health with a health worker.':
      'သို့သော်လည်း ဆေးပညာ အသိပညာသည် ပြောင်းလဲနေပြီး အထွေထွေ လမ်းညွှန်ချက်များက သင့်အသက်၊ သင့်တွင်ရှိသည့် အခြားရောဂါများ၊ သောက်နေဆဲ ဆေးများ သို့မဟုတ် ကိုယ်ဝန်ရှိမရှိကို ထည့်သွင်း စဉ်းစားနိုင်ခြင်း မရှိပါ။ ဤနေရာရှိ အချက်အလက်များသည် သင်ဖတ်ချိန်တွင် မပြည့်စုံ သို့မဟုတ် ခေတ်မမီတော့ဘဲ ဖြစ်နေနိုင်သည်။ သင့်ကျန်းမာရေး ဆုံးဖြတ်ချက်ကို သက်ရောက်စေမည့် အရာမှန်သမျှကို ကျန်းမာရေးဝန်ထမ်းနှင့် အမြဲ အတည်ပြုပါ။',
    'Drug names, dosages, and treatment schedules are described only in general terms. Never start, stop, or change a medicine on the strength of what you read here.':
      'ဆေးအမည်များ၊ ဆေးပမာဏနှင့် ကုသမှု အချိန်ဇယားများကို အထွေထွေအားဖြင့်သာ ဖော်ပြထားသည်။ ဤနေရာတွင် ဖတ်ရသည်ကို အခြေခံ၍ ဆေးတစ်မျိုးမျိုးကို စတင်ခြင်း၊ ရပ်ခြင်း သို့မဟုတ် ပြောင်းလဲခြင်း လုံးဝ မပြုပါနှင့်။',
    'Hospital, pharmacy, and emergency listings': 'ဆေးရုံ၊ ဆေးဆိုင်နှင့် အရေးပေါ် စာရင်းများ',
    'The directories of hospitals, pharmacies, and emergency numbers are compiled from public sources and checked by our team. Opening hours, phone numbers, and services change frequently and without notice. Treat every listing as a starting point, and telephone ahead before travelling — particularly at night or in an emergency.':
      'ဆေးရုံ၊ ဆေးဆိုင်နှင့် အရေးပေါ် ဖုန်းနံပါတ် စာရင်းများကို အများပြည်သူ ရင်းမြစ်များမှ စုစည်းပြီး ကျွန်ုပ်တို့ အဖွဲ့မှ စိစစ်ထားသည်။ ဖွင့်ချိန်၊ ဖုန်းနံပါတ်နှင့် ဝန်ဆောင်မှုများသည် ကြိုတင် အသိပေးခြင်းမရှိဘဲ မကြာခဏ ပြောင်းလဲတတ်သည်။ စာရင်းတိုင်းကို အစပြုချက်အဖြစ်သာ မှတ်ယူပြီး မသွားမီ ဖုန်းဖြင့် ကြိုတင် စုံစမ်းပါ — အထူးသဖြင့် ညဘက် သို့မဟုတ် အရေးပေါ် အခြေအနေတွင်။',
    'Listing a facility is not a recommendation or an endorsement of it, and we have no commercial relationship with any facility named on this site.':
      'ဆေးခန်း/ဆေးရုံ တစ်ခုကို စာရင်းတွင် ဖော်ပြခြင်းသည် အကြံပြုခြင်း သို့မဟုတ် ထောက်ခံခြင်း မဟုတ်ပါ။ ဤဝဘ်ဆိုက်တွင် ဖော်ပြထားသော မည်သည့်နေရာနှင့်မျှ စီးပွားရေး ဆက်နွှယ်မှု မရှိပါ။',
    'Links to other websites': 'အခြား ဝဘ်ဆိုက်များသို့ လင့်ခ်များ',
    'We link to organisations such as the World Health Organization and the Ministry of Health so you can read the primary source. Those sites are not under our control. We are not responsible for their content, their accuracy, or how they handle your data — their own terms and privacy policies apply once you follow the link.':
      'မူရင်း ရင်းမြစ်ကို ဖတ်နိုင်ရန် ကမ္ဘာ့ကျန်းမာရေးအဖွဲ့နှင့် ကျန်းမာရေးဝန်ကြီးဌာန ကဲ့သို့သော အဖွဲ့အစည်းများသို့ လင့်ခ် ချိတ်ထားပါသည်။ ထိုဝဘ်ဆိုက်များသည် ကျွန်ုပ်တို့၏ ထိန်းချုပ်မှုအောက်တွင် မရှိပါ။ ၎င်းတို့၏ အကြောင်းအရာ၊ တိကျမှု သို့မဟုတ် သင့်အချက်အလက်ကို မည်သို့ ကိုင်တွယ်သည်အတွက် ကျွန်ုပ်တို့ တာဝန်မယူပါ — လင့်ခ်ကို နှိပ်လိုက်သည်နှင့် ၎င်းတို့၏ စည်းကမ်းနှင့် မူဝါဒများ သက်ရောက်ပါမည်။',
    'Availability': 'ဝန်ဆောင်မှု ရရှိနိုင်မှု',
    'We offer the site as it is. We do not promise that it will always be reachable, free of errors, or uninterrupted, and we may change, move, or remove any page at any time. As a student project, MedCare may be taken offline at the end of the course.':
      'ဤဝဘ်ဆိုက်ကို ရှိသည့်အတိုင်း ပေးအပ်ပါသည်။ အမြဲတမ်း ဝင်ရောက်နိုင်မည်၊ အမှားကင်းမည် သို့မဟုတ် ပြတ်တောက်မှု မရှိမည်ဟု ကတိမပြုပါ။ မည်သည့် စာမျက်နှာကိုမဆို အချိန်မရွေး ပြောင်းလဲ၊ ရွှေ့ပြောင်း သို့မဟုတ် ဖယ်ရှားနိုင်ပါသည်။ ကျောင်းသား စီမံကိန်း ဖြစ်သဖြင့် သင်တန်းပြီးဆုံးချိန်တွင် MedCare ကို ပိတ်သိမ်းနိုင်ပါသည်။',
    'Liability': 'တာဝန်ခံမှု',
    'To the fullest extent permitted by law, the MedCare team accepts no liability for any loss, injury, or harm arising from reliance on the information on this site, from any inaccuracy in it, or from the site being unavailable. Your use of MedCare, and any decision you make on the basis of it, is your own responsibility.':
      'ဥပဒေက ခွင့်ပြုသည့် အတိုင်းအတာ အပြည့်အဝအထိ — ဤဝဘ်ဆိုက်ရှိ အချက်အလက်ကို အားကိုးခြင်းကြောင့်ဖြစ်စေ၊ ၎င်းတွင် မတိကျမှုကြောင့်ဖြစ်စေ၊ ဝဘ်ဆိုက် အသုံးမပြုနိုင်ခြင်းကြောင့်ဖြစ်စေ ပေါ်ပေါက်လာသည့် ဆုံးရှုံးမှု၊ ထိခိုက်မှု သို့မဟုတ် နစ်နာမှု မှန်သမျှအတွက် MedCare အဖွဲ့မှ တာဝန်မယူပါ။ MedCare ကို အသုံးပြုခြင်းနှင့် ၎င်းအပေါ် အခြေခံ၍ ချမှတ်သည့် ဆုံးဖြတ်ချက် မှန်သမျှသည် သင့်တာဝန်သာ ဖြစ်ပါသည်။',
    'Nothing in these terms limits any liability that cannot lawfully be limited.':
      'ဥပဒေအရ ကန့်သတ်၍ မရသော တာဝန်ခံမှုကို ဤစည်းကမ်းချက်များက ကန့်သတ်ခြင်း မရှိပါ။',
    'Content that belongs to others': 'အခြားသူများ ပိုင်ဆိုင်သည့် အကြောင်းအရာများ',
    'The MedCare name, page designs, and written content belong to the MedCare team. Photographs are used under the licences granted by their sources. Icons and page framework come from Bootstrap and Bootstrap Icons under their own open-source licences. If you believe material on this site infringes your rights, write to us and we will remove it while we look into it.':
      'MedCare အမည်၊ စာမျက်နှာ ဒီဇိုင်းများနှင့် ရေးသားထားသော အကြောင်းအရာများသည် MedCare အဖွဲ့ ပိုင်ဆိုင်သည်။ ဓာတ်ပုံများကို ၎င်းတို့၏ ရင်းမြစ်များမှ ခွင့်ပြုထားသည့် လိုင်စင်အရ အသုံးပြုထားပါသည်။ သင်္ကေတများနှင့် စာမျက်နှာ မူဘောင်ကို Bootstrap နှင့် Bootstrap Icons မှ ၎င်းတို့၏ ပွင့်လင်း အရင်းအမြစ် လိုင်စင်များအရ ရယူထားသည်။ ဤဝဘ်ဆိုက်ရှိ အရာတစ်ခုခုက သင့်အခွင့်အရေးကို ချိုးဖောက်သည်ဟု ယူဆပါက ကျွန်ုပ်တို့ထံ အကြောင်းကြားပါ။ စစ်ဆေးနေစဉ်အတွင်း ၎င်းကို ဖယ်ရှားပေးပါမည်။',
    'Changes to these terms': 'ဤစည်းကမ်းချက်များ ပြောင်းလဲခြင်း',
    'We may update these terms as the site develops. The version published here is the one that applies, and the date below shows when it last changed. Continuing to use MedCare after a change means you accept the revised terms.':
      'ဝဘ်ဆိုက် တိုးတက်လာသည်နှင့်အမျှ ဤစည်းကမ်းချက်များကို ပြင်ဆင်နိုင်ပါသည်။ ဤနေရာတွင် ဖော်ပြထားသည့် မူသည် သက်ရောက်မှုရှိသော မူဖြစ်ပြီး အောက်ပါရက်စွဲက နောက်ဆုံး ပြောင်းလဲသည့်အချိန်ကို ပြသည်။ ပြောင်းလဲပြီးနောက် MedCare ကို ဆက်လက် အသုံးပြုခြင်းသည် ပြင်ဆင်ထားသော စည်းကမ်းများကို လက်ခံသည်ဟု ဆိုလိုပါသည်။',
    'Questions about these terms, corrections to a page, or a request to remove material can be sent to the team.':
      'ဤစည်းကမ်းချက်များနှင့် ပတ်သက်သည့် မေးခွန်းများ၊ စာမျက်နှာ ပြင်ဆင်ချက်များ သို့မဟုတ် အကြောင်းအရာ ဖယ်ရှားပေးရန် တောင်းဆိုချက်များကို အဖွဲ့ထံ ပေးပို့နိုင်ပါသည်။',

    /* --- privacy policy: body --- */
    'Looking up a health condition is private. MedCare is built so that you can do it without telling us who you are.':
      'ကျန်းမာရေး အခြေအနေတစ်ခုကို ရှာဖွေခြင်းသည် ကိုယ်ရေးကိုယ်တာ ကိစ္စဖြစ်သည်။ သင်မည်သူဖြစ်ကြောင်း ကျွန်ုပ်တို့အား မပြောဘဲ ရှာဖွေနိုင်စေရန် MedCare ကို တည်ဆောက်ထားပါသည်။',
    'We have no accounts, no sign-up, no contact forms, and no analytics. We do not ask for your name, and we have no database of visitors. Everything you type into a search box stays inside your own browser. We set no cookies of our own.':
      'အကောင့်များ မရှိ၊ စာရင်းသွင်းရန် မရှိ၊ ဆက်သွယ်ရန် ဖောင်များ မရှိ၊ ခွဲခြမ်းစိတ်ဖြာမှု ကိရိယာများလည်း မရှိပါ။ သင့်အမည်ကို မမေးပါ။ လာရောက်သူများ၏ ဒေတာဘေ့စ်လည်း မရှိပါ။ ရှာဖွေရေး အကွက်တွင် ရိုက်ထည့်သမျှသည် သင့်ဘရောက်ဆာ အတွင်း၌သာ ရှိနေပါသည်။ ကျွန်ုပ်တို့၏ ကိုယ်ပိုင် ကွတ်ကီးများ မထားရှိပါ။',
    'What we do not collect': 'ကျွန်ုပ်တို့ မစုဆောင်းသည်များ',
    'MedCare has no user accounts and no way to register. We do not ask for, and cannot receive, your name, age, phone number, email address, or any detail of your health. There is no form on this site that sends anything to us.':
      'MedCare တွင် အသုံးပြုသူ အကောင့်များ မရှိသလို စာရင်းသွင်းရန် နည်းလမ်းလည်း မရှိပါ။ သင့်အမည်၊ အသက်၊ ဖုန်းနံပါတ်၊ အီးမေးလ်လိပ်စာ သို့မဟုတ် သင့်ကျန်းမာရေး အသေးစိတ် မည်သည်ကိုမျှ မတောင်းပါ၊ လက်ခံ၍လည်း မရပါ။ ဤဝဘ်ဆိုက်တွင် ကျွန်ုပ်တို့ထံ တစ်စုံတစ်ရာ ပေးပို့သည့် ဖောင် မရှိပါ။',
    'We do not run advertising, and we do not use analytics or tracking services of any kind. No advertising network is given access to your visit.':
      'ကြော်ငြာများ မလုပ်ဆောင်ပါ။ ခွဲခြမ်းစိတ်ဖြာမှု သို့မဟုတ် ခြေရာခံသည့် ဝန်ဆောင်မှု မည်သည့်အမျိုးအစားကိုမျှ မသုံးပါ။ မည်သည့် ကြော်ငြာကွန်ရက်ကိုမျှ သင့်လာရောက်မှုအား ဝင်ရောက်ကြည့်ရှုခွင့် မပေးပါ။',
    'Searching and filtering': 'ရှာဖွေခြင်းနှင့် စစ်ထုတ်ခြင်း',
    'The search boxes on the diseases, hospitals, pharmacy, and article pages work entirely inside your browser. What you type is matched against a list already loaded on the page. It is never sent to us or to anyone else, and it is not saved after you close the page.':
      'ရောဂါများ၊ ဆေးရုံများ၊ ဆေးဆိုင်နှင့် ဆောင်းပါး စာမျက်နှာများရှိ ရှာဖွေရေး အကွက်များသည် သင့်ဘရောက်ဆာ အတွင်း၌သာ လုံးဝ အလုပ်လုပ်သည်။ သင်ရိုက်ထည့်သည်ကို စာမျက်နှာပေါ်တွင် ရှိပြီးသား စာရင်းနှင့် တိုက်ဆိုင်စစ်ဆေးပါသည်။ ကျွန်ုပ်တို့ထံ သို့မဟုတ် အခြားမည်သူ့ထံမျှ လုံးဝ မပေးပို့ပါ။ စာမျက်နှာ ပိတ်ပြီးနောက် သိမ်းဆည်းထားခြင်းလည်း မရှိပါ။',
    'What is stored on your device': 'သင့်စက်ပစ္စည်းတွင် သိမ်းဆည်းထားသည်များ',
    "MedCare stores one thing, and only if you choose a language: your preference for English or Burmese, kept in your browser's local storage so the site opens in the same language next time. It is a single setting, held on your own device, readable only by this site, and never transmitted to us.":
      'MedCare သည် တစ်ခုတည်းကိုသာ သိမ်းဆည်းပြီး ၎င်းမှာလည်း သင် ဘာသာစကား ရွေးချယ်မှသာ ဖြစ်သည် − အင်္ဂလိပ် သို့မဟုတ် မြန်မာ ရွေးချယ်မှုကို သင့်ဘရောက်ဆာ၏ local storage တွင် သိမ်းထားပြီး နောက်တစ်ကြိမ် ဝင်ရောက်ချိန်တွင် တူညီသော ဘာသာစကားဖြင့် ပွင့်စေရန် ဖြစ်သည်။ ၎င်းသည် ဆက်တင်တစ်ခုတည်းသာ ဖြစ်ပြီး သင့်စက်ပစ္စည်းပေါ်တွင်သာ ရှိကာ ဤဝဘ်ဆိုက်ကသာ ဖတ်နိုင်ပြီး ကျွန်ုပ်တို့ထံ လုံးဝ မပေးပို့ပါ။',
    'You can inspect and erase it at any time, or clear all site data in your browser.':
      '၎င်းကို အချိန်မရွေး စစ်ဆေးနိုင်၊ ဖျက်နိုင်ပါသည်။ သို့မဟုတ် ဘရောက်ဆာတွင် ဝဘ်ဆိုက် ဒေတာအားလုံးကို ရှင်းလင်းနိုင်ပါသည်။',
    'Others who see your visit': 'သင့်လာရောက်မှုကို မြင်နိုင်သည့် အခြားသူများ',
    "Like most websites, MedCare loads some files from other companies' servers. When your browser fetches a file, that company necessarily learns your IP address, roughly where you are, and which page requested it. We do not control what they do with that, and their privacy policies apply:":
      'ဝဘ်ဆိုက်အများစုကဲ့သို့ပင် MedCare သည် အချို့ ဖိုင်များကို အခြားကုမ္ပဏီများ၏ ဆာဗာမှ ရယူသည်။ သင့်ဘရောက်ဆာက ဖိုင်တစ်ခု ရယူသည့်အခါ ထိုကုမ္ပဏီသည် သင့် IP လိပ်စာ၊ သင်ရှိသည့် ခန့်မှန်း တည်နေရာနှင့် မည်သည့်စာမျက်နှာမှ တောင်းဆိုသည်ကို မလွှဲမရှောင်သာ သိရှိပါသည်။ ၎င်းတို့က မည်သို့ ဆက်လက် လုပ်ဆောင်သည်ကို ကျွန်ုပ်တို့ မထိန်းချုပ်နိုင်ဘဲ ၎င်းတို့၏ ကိုယ်ရေးအချက်အလက် မူဝါဒများ သက်ရောက်ပါသည် −',
    '— supply the typefaces, icons, and layout framework used on every page.':
      '— စာမျက်နှာတိုင်းတွင် သုံးသည့် စာလုံးပုံစံများ၊ သင်္ကေတများနှင့် အပြင်အဆင် မူဘောင်ကို ပေးသည်။',
    '— supplies the photographs used on the home page and article pages.':
      '— ပင်မစာမျက်နှာနှင့် ဆောင်းပါး စာမျက်နှာများတွင် သုံးသည့် ဓာတ်ပုံများကို ပေးသည်။',
    '— supplies the map embedded on the Find Hospitals page. This is the one place on the site where a third party may set cookies in your browser.':
      '— ဆေးရုံရှာသည့် စာမျက်နှာရှိ မြေပုံကို ပေးသည်။ ဤနေရာသည် တတိယအဖွဲ့တစ်ခုက သင့်ဘရောက်ဆာတွင် ကွတ်ကီး ထားရှိနိုင်သည့် ဝဘ်ဆိုက်ပေါ်ရှိ တစ်ခုတည်းသော နေရာ ဖြစ်သည်။',
    "Because the map is the most intrusive of these, we do not load it until you ask for it. You will see a placeholder with a button, and the map — and Google's cookies with it — arrive only after you click. Your choice is remembered, and you can change it at any time.":
      'မြေပုံသည် ဤအရာများထဲတွင် အထိရောက်ဆုံး ဝင်ရောက်စွက်ဖက်သူ ဖြစ်သောကြောင့် သင် တောင်းဆိုမှသာ ရယူပါသည်။ ခလုတ်တစ်ခုပါသော နေရာလွတ်ကို မြင်ရမည်ဖြစ်ပြီး မြေပုံနှင့် ၎င်းနှင့်အတူ Google ၏ ကွတ်ကီးများသည် သင်နှိပ်ပြီးမှသာ ရောက်ရှိလာမည်။ သင့်ရွေးချယ်မှုကို မှတ်ထားပြီး အချိန်မရွေး ပြောင်းလဲနိုင်ပါသည်။',
    'Links to other sites': 'အခြား ဝဘ်ဆိုက်များသို့ လင့်ခ်များ',
    'Our source lists link to organisations such as the World Health Organization and the Ministry of Health. Once you follow a link you are on their site, under their privacy policy, and we no longer have any part in it.':
      'ကျွန်ုပ်တို့၏ ကိုးကားစာရင်းများသည် ကမ္ဘာ့ကျန်းမာရေးအဖွဲ့နှင့် ကျန်းမာရေးဝန်ကြီးဌာန ကဲ့သို့သော အဖွဲ့အစည်းများသို့ လင့်ခ် ချိတ်ထားသည်။ လင့်ခ်ကို နှိပ်လိုက်သည်နှင့် သင်သည် ၎င်းတို့၏ ဝဘ်ဆိုက်ပေါ်တွင် ၎င်းတို့၏ မူဝါဒအောက်၌ ရှိနေပြီး ကျွန်ုပ်တို့ မပါဝင်တော့ပါ။',
    'Server logs': 'ဆာဗာ မှတ်တမ်းများ',
    'MedCare is published as static pages. Whoever hosts them may keep ordinary server logs — IP address, time, and page requested — as part of running the service. We do not add to those logs, do not analyse them, and do not use them to build any profile of you.':
      'MedCare ကို ပုံသေ စာမျက်နှာများအဖြစ် ထုတ်ဝေထားသည်။ ၎င်းတို့ကို လက်ခံထားသူသည် ဝန်ဆောင်မှု လည်ပတ်ရေး အစိတ်အပိုင်းအဖြစ် သာမန် ဆာဗာမှတ်တမ်းများ — IP လိပ်စာ၊ အချိန်နှင့် တောင်းဆိုသည့် စာမျက်နှာ — ကို သိမ်းထားနိုင်သည်။ ကျွန်ုပ်တို့သည် ထိုမှတ်တမ်းများသို့ ထပ်မထည့်ပါ၊ ခွဲခြမ်းစိတ်ဖြာခြင်းလည်း မပြုပါ၊ သင့်အကြောင်း ပရိုဖိုင် တည်ဆောက်ရန်လည်း မသုံးပါ။',
    'Children': 'ကလေးသူငယ်များ',
    'The site is written for a general audience, including families. Since we collect nothing, we hold no information about children any more than about anyone else.':
      'ဤဝဘ်ဆိုက်ကို မိသားစုများ အပါအဝင် အများပြည်သူအတွက် ရေးသားထားသည်။ ကျွန်ုပ်တို့ မည်သည်ကိုမျှ မစုဆောင်းသောကြောင့် အခြားမည်သူ့အကြောင်းမျှ မထားရှိသကဲ့သို့ ကလေးများ၏ အချက်အလက်ကိုလည်း မထားရှိပါ။',
    'Your rights': 'သင့်အခွင့်အရေးများ',
    'Rights to see, correct, or delete personal data depend on our holding some. We hold none — so there is nothing for us to show you, amend, or erase. The single language preference described above is on your device and entirely under your control.':
      'ကိုယ်ရေးအချက်အလက်ကို ကြည့်ရှုခွင့်၊ ပြင်ဆင်ခွင့် သို့မဟုတ် ဖျက်ခွင့်များသည် ကျွန်ုပ်တို့ထံတွင် အချက်အလက် ရှိမှသာ သက်ရောက်သည်။ ကျွန်ုပ်တို့ထံတွင် မည်သည်မျှ မရှိပါ — ထို့ကြောင့် သင့်အား ပြသရန်၊ ပြင်ဆင်ရန် သို့မဟုတ် ဖျက်ရန် မည်သည်မျှ မရှိပါ။ အထက်တွင် ဖော်ပြခဲ့သည့် ဘာသာစကား ရွေးချယ်မှု တစ်ခုတည်းသည် သင့်စက်ပစ္စည်းပေါ်တွင် ရှိပြီး လုံးဝ သင့်ထိန်းချုပ်မှုအောက်တွင် ရှိသည်။',
    'Changes to this policy': 'ဤမူဝါဒ ပြောင်းလဲခြင်း',
    'If we ever add a feature that collects anything, we will change this page before that feature goes live, and update the date below. Continuing to use MedCare after a change means you accept the revised policy.':
      'တစ်စုံတစ်ရာ စုဆောင်းသည့် လုပ်ဆောင်ချက်တစ်ခု ထည့်သွင်းမည်ဆိုပါက ထိုလုပ်ဆောင်ချက် စတင်အသုံးပြုမီ ဤစာမျက်နှာကို ပြောင်းလဲပြီး အောက်ပါရက်စွဲကို ပြင်ဆင်ပါမည်။ ပြောင်းလဲပြီးနောက် MedCare ကို ဆက်လက် အသုံးပြုခြင်းသည် ပြင်ဆင်ထားသော မူဝါဒကို လက်ခံသည်ဟု ဆိုလိုပါသည်။',
    'Questions about privacy can be sent to the team.':
      'ကိုယ်ရေးအချက်အလက်နှင့် ပတ်သက်သည့် မေးခွန်းများကို အဖွဲ့ထံ ပေးပို့နိုင်ပါသည်။',
    'Your browser keeps its own history of the pages you visit, and MedCare cannot clear it. On a shared or family phone, use a private browsing window if you would rather your visit left no trace.':
      'သင့်ဘရောက်ဆာသည် သင်ဝင်ကြည့်ခဲ့သည့် စာမျက်နှာများ၏ မှတ်တမ်းကို ကိုယ်ပိုင် သိမ်းထားပြီး MedCare က ၎င်းကို ရှင်းလင်း၍ မရပါ။ အတူတကွ သုံးသည့် သို့မဟုတ် မိသားစု ဖုန်းတွင် သင့်လာရောက်မှု ခြေရာမကျန်စေလိုပါက private browsing ဝင်းဒိုးကို အသုံးပြုပါ။',

    /* --- cookie settings: body --- */
    'There is no consent banner on this site because there is nothing to consent to. We use no advertising, no analytics, and no tracking. The two settings below are the only things stored on your device, and both are yours to change.':
      'သဘောတူရန် မည်သည်မျှ မရှိသောကြောင့် ဤဝဘ်ဆိုက်တွင် သဘောတူညီချက် ဘန်နာ မရှိပါ။ ကြော်ငြာ၊ ခွဲခြမ်းစိတ်ဖြာမှုနှင့် ခြေရာခံမှု မသုံးပါ။ အောက်ပါ ဆက်တင်နှစ်ခုသည် သင့်စက်ပစ္စည်းတွင် သိမ်းထားသည့် တစ်ခုတည်းသော အရာများဖြစ်ပြီး နှစ်ခုစလုံးကို သင် ပြောင်းလဲနိုင်ပါသည်။',
    "Remembers whether you chose English or Burmese, so the site opens the same way next time. It is kept in your browser's local storage under the name mc-lang, and is never sent to us.":
      'အင်္ဂလိပ် သို့မဟုတ် မြန်မာ ရွေးချယ်ခဲ့သည်ကို မှတ်ထားပြီး နောက်တစ်ကြိမ် ဝင်ရောက်ချိန်တွင် တူညီစွာ ပွင့်စေသည်။ သင့်ဘရောက်ဆာ၏ local storage တွင် mc-lang အမည်ဖြင့် သိမ်းထားပြီး ကျွန်ုပ်တို့ထံ လုံးဝ မပေးပို့ပါ။',
    'Checking…': 'စစ်ဆေးနေသည်…',
    'The hospital map is served by Google, which can set its own cookies and will see your IP address. We do not load it until you ask. Turning this on loads the map automatically from now on; it is the only third-party embed on the site.':
      'ဆေးရုံမြေပုံကို Google မှ ပေးပို့ပြီး ၎င်းသည် ကိုယ်ပိုင် ကွတ်ကီးများ ထားရှိနိုင်ကာ သင့် IP လိပ်စာကို မြင်ရပါမည်။ သင် တောင်းဆိုမှသာ ရယူပါသည်။ ဤအရာကို ဖွင့်ထားပါက ယခုမှစ၍ မြေပုံ အလိုအလျောက် ပေါ်လာမည်။ ၎င်းသည် ဝဘ်ဆိုက်ပေါ်ရှိ တစ်ခုတည်းသော တတိယအဖွဲ့ ထည့်သွင်းမှု ဖြစ်သည်။',
    'Why there is no cookie banner': 'ကွတ်ကီး ဘန်နာ မရှိရသည့် အကြောင်းရင်း',
    'Consent banners exist because most sites place cookies that follow you between pages and between websites, usually for advertising. MedCare places none. A banner asking permission for something we do not do would only add a click.':
      'ဝဘ်ဆိုက်အများစုသည် စာမျက်နှာအကြားနှင့် ဝဘ်ဆိုက်အကြား သင့်ကို လိုက်ခြေရာခံသည့် ကွတ်ကီးများကို အများအားဖြင့် ကြော်ငြာအတွက် ထားရှိသောကြောင့် သဘောတူညီချက် ဘန်နာများ ရှိလာခြင်း ဖြစ်သည်။ MedCare သည် မည်သည်မျှ မထားရှိပါ။ မလုပ်သည့်အရာအတွက် ခွင့်တောင်းသည့် ဘန်နာသည် နှိပ်ရသည့် အကြိမ်ရေ တိုးစေရုံသာ ဖြစ်ပါမည်။',
    'Local storage is not a cookie': 'Local storage သည် ကွတ်ကီး မဟုတ်ပါ',
    'The language setting uses local storage rather than a cookie. The practical difference is that a cookie is attached to every request your browser sends to the server, while local storage stays on your device and is read only by the page itself. Nothing about your language choice reaches us either way.':
      'ဘာသာစကား ဆက်တင်သည် ကွတ်ကီးအစား local storage ကို သုံးသည်။ လက်တွေ့ ကွာခြားချက်မှာ ကွတ်ကီးသည် သင့်ဘရောက်ဆာက ဆာဗာသို့ ပို့သည့် တောင်းဆိုမှုတိုင်းတွင် ပါသွားသော်လည်း local storage သည် သင့်စက်ပစ္စည်းပေါ်တွင်သာ ရှိပြီး စာမျက်နှာကိုယ်တိုင်ကသာ ဖတ်နိုင်ခြင်း ဖြစ်သည်။ မည်သည့်နည်းဖြင့်မဆို သင့်ဘာသာစကား ရွေးချယ်မှုအကြောင်း ကျွန်ုပ်တို့ထံ မရောက်ပါ။',
    'Files loaded from other companies': 'အခြားကုမ္ပဏီများမှ ရယူသည့် ဖိုင်များ',
    'Every page pulls fonts, icons, and layout styles from Google Fonts and jsDelivr, and photographs from Unsplash. Those requests do not create cookies here, but the companies serving them can see your IP address and which page asked. This is how nearly all websites are built; if you would rather avoid it entirely, a content blocker or a privacy-focused browser will stop the requests, and MedCare will still be readable without them.':
      'စာမျက်နှာတိုင်းသည် စာလုံးပုံစံများ၊ သင်္ကေတများနှင့် အပြင်အဆင်ကို Google Fonts နှင့် jsDelivr မှ၊ ဓာတ်ပုံများကို Unsplash မှ ရယူသည်။ ထိုတောင်းဆိုမှုများက ဤနေရာတွင် ကွတ်ကီး မဖန်တီးသော်လည်း ဝန်ဆောင်မှုပေးသည့် ကုမ္ပဏီများက သင့် IP လိပ်စာနှင့် မည်သည့်စာမျက်နှာမှ တောင်းဆိုသည်ကို မြင်နိုင်သည်။ ဝဘ်ဆိုက် အားလုံးနီးပါးကို ဤသို့ တည်ဆောက်ကြသည်။ လုံးဝ ရှောင်လိုပါက content blocker သို့မဟုတ် ကိုယ်ရေးလုံခြုံမှု အလေးထားသည့် ဘရောက်ဆာက ထိုတောင်းဆိုမှုများကို ပိတ်ပေးမည်ဖြစ်ပြီး ၎င်းတို့မပါဘဲလည်း MedCare ကို ဖတ်ရှုနိုင်ပါသည်။',
    'Clearing everything': 'အားလုံး ရှင်းလင်းခြင်း',
    'Use the buttons above, or clear site data for this domain in your browser settings. Either removes the settings completely — the site will simply open in English and ask again before loading the map.':
      'အထက်ပါ ခလုတ်များကို သုံးပါ သို့မဟုတ် ဘရောက်ဆာ ဆက်တင်တွင် ဤဒိုမိန်းအတွက် ဝဘ်ဆိုက် ဒေတာကို ရှင်းလင်းပါ။ နှစ်မျိုးလုံးက ဆက်တင်များကို လုံးဝ ဖယ်ရှားပေးသည် — ဝဘ်ဆိုက်သည် အင်္ဂလိပ်ဘာသာဖြင့် ပွင့်မည်ဖြစ်ပြီး မြေပုံ မရယူမီ ထပ်မံ မေးမြန်းပါမည်။',

    'Five students who researched, designed, and built MedCare together.':
      'အဖွဲ့ဝင်ငါးယောက်စုပေါင်းကာ အချက်အလက်များ ရှာဖွေ၊ ဒီဇိုင်းချကာ MedCare Website ကို တည်ဆောက်ထားပါသည်',
    'Team Lead & Developer':
      'အဖွဲ့ခေါင်းဆောင်နှင့် Developer',
    
    'Led the architecture and built the site\'s core — the page templates and the search and filtering.':
      'စနစ်တည်ဆောက်ပုံကို ဦးဆောင်ခဲ့ပြီး အဓိက အစိတ်အပိုင်းများကို တည်ဆောက်ထားပါသည်',

    'Disease Content': 'ရောဂါဆိုင်ရာ အချက်အလက်',
"Researched symptoms, do's and don'ts, and sources, and built the disease pages":
  'ရောဂါလက္ခဏာများ၊ လုပ်သင့်/မလုပ်သင့်သည့်အချက်များနှင့် ကိုးကားချက်များကို ရှာဖွေစုဆောင်းပြီး disease pages များကို တည်ဆောက်ခဲ့သည်။',

'Hospitals & Emergency': 'ဆေးရုံများနှင့် အရေးပေါ်',
'Compiled the Yangon hospital directory and verified the emergency contact numbers.':
  'ရန်ကုန်ဆေးရုံလိပ်စာစာရင်းကို စုစည်းပြီး အရေးပေါ်ဆက်သွယ်ရန်ဖုန်းနံပါတ်များကို စိစစ်အတည်ပြုခဲ့သည်။',

'Health Articles': 'ကျန်းမာရေးဆောင်းပါးများ',
'Wrote and edited the health articles and led the Burmese-language content.':
  'ကျန်းမာရေးဆောင်းပါးများကို ရေးသားတည်းဖြတ်ပြီး မြန်မာဘာသာ အကြောင်းအရာများကို ဦးဆောင်ဘာသာပြန်ခဲ့သည်။',

'Design & Testing': 'ဒီဇိုင်းနှင့် စမ်းသပ်ခြင်း',
'Owned visual consistency, ran usability testing, and checked the layout on mobile.':
  'အမြင်ပိုင်းဆိုင်ရာ တစ်သမတ်တည်းဖြစ်မှုကို တာဝန်ယူပြီး အသုံးပြုရလွယ်ကူမှု စမ်းသပ်မှုများ ပြုလုပ်ကာ မိုဘိုင်းပေါ်တွင် အပြင်အဆင်ကို စစ်ဆေးခဲ့သည်။',






    /* --- staff pages: admin dashboard and editor desk -------------
       Interface, not prose. Role VALUES (admin/editor/user) are left in
       English on purpose: a pill has to match what profiles.role holds,
       and so does anything inside <code>. */
    'Checking your permissions…': 'သင့်ခွင့်ပြုချက်များကို စစ်ဆေးနေသည်…',
    'One moment.': 'ခဏစောင့်ပါ။',
    'Signed in': 'ဝင်ရောက်ထားသည်',
    'Admin dashboard': 'အက်ဒမင် ထိန်းချုပ်ခန်း',
    'The site at a glance, and the one thing only an admin can do: decide who is a reader, who is an editor, and who is an admin.': 'ဝဘ်ဆိုက်၏ အနှစ်ချုပ်နှင့် အက်ဒမင်သာ လုပ်နိုင်သည့် တစ်ခုတည်းသော အရာ — မည်သူက ဖတ်ရှုသူ၊ မည်သူက အယ်ဒီတာ၊ မည်သူက အက်ဒမင် ဖြစ်မည်ကို ဆုံးဖြတ်ခြင်း။',
    "A role change takes effect on that person's next request.": "ရာထူး ပြောင်းလဲမှုသည် ထိုသူ၏ နောက်တစ်ကြိမ် တောင်းဆိုမှုတွင် စတင် အကျိုးသက်ရောက်သည်။",
    'Editors can add, edit, and delete every condition on the site and read every reader report. Grant it deliberately, and to as few accounts as the work needs.': 'အယ်ဒီတာများသည် ဝဘ်ဆိုက်ရှိ ရောဂါအားလုံးကို ထည့်သွင်း၊ ပြင်ဆင်၊ ဖျက်နိုင်ပြီး ဖတ်ရှုသူ တိုင်ကြားချက် အားလုံးကို ဖတ်နိုင်သည်။ ဂရုတစိုက် စဉ်းစားပြီးမှ ပေးပါ။ လိုအပ်သည့် အကောင့် အနည်းဆုံးကိုသာ ပေးပါ။',
    'Accounts': 'အကောင့်များ',
    'Everyone who has signed up': 'စာရင်းသွင်းထားသူ အားလုံး',
    'Staff': 'ဝန်ထမ်းများ',
    'Editors and admins': 'အယ်ဒီတာများနှင့် အက်ဒမင်များ',
    'Conditions published': 'ဖော်ပြထားသော ရောဂါများ',
    'Live on Common diseases': 'ရောဂါများ စာမျက်နှာတွင် ဖော်ပြနေသည်',
    'Reports waiting': 'စောင့်ဆိုင်းနေသော တိုင်ကြားချက်များ',
    'Reader-flagged, not yet checked': 'ဖတ်ရှုသူများ ထောက်ပြထားပြီး မစစ်ဆေးရသေးပါ',
    'People and roles': 'အသုံးပြုသူများနှင့် ရာထူးများ',
    'Account': 'အကောင့်',
    'Joined': 'ဝင်ရောက်သည့်ရက်',
    'Role': 'ရာထူး',
    'Admins': 'အက်ဒမင်များ',
    'Editors': 'အယ်ဒီတာများ',
    'Readers': 'ဖတ်ရှုသူများ',
    'you': 'သင်',
    'Save': 'သိမ်းရန်',
    'Refresh': 'ပြန်လည်ရယူရန်',
    'Edit': 'ပြင်ဆင်ရန်',
    'Filter by email, role, or id': 'အီးမေးလ်၊ ရာထူး သို့မဟုတ် id ဖြင့် စစ်ထုတ်ရန်',
    'Filter accounts': 'အကောင့်များ စစ်ထုတ်ရန်',
    'Filter by role': 'ရာထူးဖြင့် စစ်ထုတ်ရန်',
    'Filter reports': 'တိုင်ကြားချက်များ စစ်ထုတ်ရန်',
    'Changing a role here writes to': 'ဤနေရာတွင် ရာထူး ပြောင်းလဲခြင်းသည်',
    '. The database allows it only because your own row says': ' သို့ ရေးသွင်းသည်။ သင့်ကိုယ်ပိုင် အချက်အလက်တွင်',
    '— the same request from an editor is refused by RLS, not by this page.': 'ဟု ဖော်ပြထားသောကြောင့်သာ ဒေတာဘေ့စ်က ခွင့်ပြုခြင်း ဖြစ်သည် — အယ်ဒီတာထံမှ ထိုအတူ တောင်းဆိုမှုကို ဤစာမျက်နှာက မဟုတ်ဘဲ RLS က ငြင်းပယ်သည်။',
    'Editor desk': 'အယ်ဒီတာ လုပ်ငန်းခွင်',
    'Everything the editorial team works on, in one place: what readers have reported, and the conditions published on the site.': 'အယ်ဒီတာအဖွဲ့ လုပ်ဆောင်ရသည့် အရာအားလုံး တစ်နေရာတည်းတွင် — ဖတ်ရှုသူများ တိုင်ကြားထားသည်များနှင့် ဝဘ်ဆိုက်တွင် ဖော်ပြထားသော ရောဂါများ။',
    'You are editing what readers treat as medical guidance.': 'ဖတ်ရှုသူများက ဆေးပညာ လမ်းညွှန်အဖြစ် ယူဆသည့် အချက်အလက်များကို သင် ပြင်ဆင်နေခြင်း ဖြစ်သည်။',
    'Check every change against a trusted source first. Anything saved from these tools is live on the public site immediately.': 'ပြောင်းလဲမှု တိုင်းကို ယုံကြည်ရသော ရင်းမြစ်နှင့် အရင် တိုက်ဆိုင်စစ်ဆေးပါ။ ဤကိရိယာများမှ သိမ်းလိုက်သည့် အရာတိုင်းသည် အများပြည်သူ မြင်ရသည့် ဝဘ်ဆိုက်တွင် ချက်ချင်း ပေါ်မည်။',
    'Reports reviewed': 'စစ်ဆေးပြီး တိုင်ကြားချက်များ',
    'Closed by the team': 'အဖွဲ့မှ ပိတ်သိမ်းပြီး',
    'Newest condition': 'နောက်ဆုံး ထည့်သွင်းသည့် ရောဂါ',
    'Added to the site': 'ဝဘ်ဆိုက်တွင် ထည့်သွင်းပြီး',
    'Recently added': 'မကြာသေးမီက ထည့်သွင်းထားသည်များ',
    'View as a reader': 'ဖတ်ရှုသူအဖြစ် ကြည့်ရန်',
    'See the public Common diseases page exactly as a visitor does.': 'ရောဂါများ စာမျက်နှာကို လာရောက်သူ မြင်သည့်အတိုင်း အတိအကျ ကြည့်ရန်။',
    'Accounts, roles, and the site-wide numbers. Admins only.': 'အကောင့်များ၊ ရာထူးများနှင့် ဝဘ်ဆိုက်တစ်ခုလုံး၏ ကိန်းဂဏန်းများ။ အက်ဒမင်များသာ။',
    'The editorial hub: the report queue and what has changed on the site lately.': 'အယ်ဒီတာအဖွဲ့၏ ဗဟိုနေရာ — တိုင်ကြားချက် စာရင်းနှင့် မကြာသေးမီက ဝဘ်ဆိုက်တွင် ပြောင်းလဲထားသည်များ။',
    'Manage diseases': 'ရောဂါများ စီမံရန်',
    'Add a condition, fix a description, retire a page.': 'ရောဂါ တစ်ခု ထည့်ရန်၊ ဖော်ပြချက် ပြင်ရန်၊ စာမျက်နှာ ရုပ်သိမ်းရန်။',
    'Add a condition, fix a description, retire a page. Publishes straight to the live site.': 'ရောဂါ တစ်ခု ထည့်ရန်၊ ဖော်ပြချက် ပြင်ရန်၊ စာမျက်နှာ ရုပ်သိမ်းရန်။ အများမြင်ရသည့် ဝဘ်ဆိုက်သို့ တိုက်ရိုက် ရောက်သည်။',
    'Reports inbox': 'တိုင်ကြားချက် စာတိုက်ပုံး',
    'Every reader report, filterable, with the review history.': 'ဖတ်ရှုသူ တိုင်ကြားချက် အားလုံး၊ စစ်ထုတ်နိုင်ပြီး စစ်ဆေးမှု မှတ်တမ်းနှင့်အတူ။',
    'The full queue of reader reports, with filters and the review history.': 'ဖတ်ရှုသူ တိုင်ကြားချက် စာရင်း အပြည့်အစုံ၊ စစ်ထုတ်မှုများနှင့် စစ်ဆေးမှု မှတ်တမ်း အပါအဝင်။',
    'Reader reports': 'ဖတ်ရှုသူ တိုင်ကြားချက်များ',
    'New': 'အသစ်',
    'Reviewed': 'စစ်ဆေးပြီး',
    'Mark reviewed': 'စစ်ဆေးပြီးဟု မှတ်ရန်',
    'Reopen': 'ပြန်ဖွင့်ရန်',
    'Loading reports…': 'တိုင်ကြားချက်များ ရယူနေသည်…',
    'Could not load reports.': 'တိုင်ကြားချက်များ ရယူ၍ မရပါ။',
    'No new reports. Nothing waiting for you.': 'တိုင်ကြားချက် အသစ် မရှိပါ။ စောင့်ဆိုင်းနေသည် မရှိပါ။',
    'No reports match this filter.': 'ဤစစ်ထုတ်မှုနှင့် ကိုက်ညီသော တိုင်ကြားချက် မရှိပါ။',
    'Report marked reviewed.': 'တိုင်ကြားချက်ကို စစ်ဆေးပြီးဟု မှတ်လိုက်ပြီ။',
    'Report reopened.': 'တိုင်ကြားချက်ကို ပြန်ဖွင့်လိုက်ပြီ။',
    'Loading accounts…': 'အကောင့်များ ရယူနေသည်…',
    'Could not load accounts.': 'အကောင့်များ ရယူ၍ မရပါ။',
    'No account matches this filter.': 'ဤစစ်ထုတ်မှုနှင့် ကိုက်ညီသော အကောင့် မရှိပါ။',
    'No accounts yet.': 'အကောင့် မရှိသေးပါ။',
    'Loading conditions…': 'ရောဂါများ ရယူနေသည်…',
    'Could not load conditions.': 'ရောဂါများ ရယူ၍ မရပါ။',
    'No conditions yet. Add the first one in the disease manager.': 'ရောဂါ မရှိသေးပါ။ ပထမဆုံးတစ်ခုကို ရောဂါစီမံသည့် စာမျက်နှာတွင် ထည့်ပါ။',
    'Something went wrong.': 'တစ်ခုခု မှားယွင်းသွားသည်။',
    'The database refused this change: your account does not have permission (RLS).': 'ဒေတာဘေ့စ်က ဤပြောင်းလဲမှုကို ငြင်းပယ်သည် — သင့်အကောင့်တွင် ခွင့်ပြုချက် မရှိပါ (RLS)။',
    'Showing account ids only: profiles has no email column yet. Run supabase_admin.sql to add it.': 'အကောင့် id များကိုသာ ပြသနေသည် — profiles တွင် email ကော်လံ မရှိသေးပါ။ ထည့်ရန် supabase_admin.sql ကို run ပါ။',
    'Desk': 'လုပ်ငန်းခွင်',
    'Admin': 'အက်ဒမင်',
    'Sign in': 'ဝင်ရန်',
    'Sign out': 'ထွက်ရန်',
    'Admin Dashboard': 'အက်ဒမင် ထိန်းချုပ်ခန်း',
    'System Settings': 'စနစ် ဆက်တင်များ',
    'Security & MFA': 'လုံခြုံရေးနှင့် MFA',
    'Audit Logs': 'စစ်ဆေးမှု မှတ်တမ်းများ',
    'Manage Staff': 'ဝန်ထမ်းများ စီမံရန်',
    'Secure Log Out': 'လုံခြုံစွာ ထွက်ရန်',
    'Soon': 'မကြာမီ',

    /* --- sign in and create account ------------------------------
       Role VALUES stay in English here too: the note says an account
       starts as `user`, and that is the literal value in profiles.role.
       The example email and name in the placeholders are left alone. */
    'Sign in to MedCare': 'MedCare သို့ ဝင်ရန်',
    'An account is only needed for editorial tools. Reading health information never requires one.': 'အကောင့်သည် အယ်ဒီတာ ကိရိယာများအတွက်သာ လိုအပ်သည်။ ကျန်းမာရေး အချက်အလက် ဖတ်ရှုရန် အကောင့် မလိုပါ။',
    'You are signed in': 'သင် ဝင်ရောက်ထားပြီ ဖြစ်သည်',
    'Your role is': 'သင့်ရာထူးမှာ',
    'Go to the site': 'ဝဘ်ဆိုက်သို့ သွားရန်',
    'Create account': 'အကောင့် ဖွင့်ရန်',
    'Creating account…': 'အကောင့် ဖွင့်နေသည်…',
    'Signing in…': 'ဝင်ရောက်နေသည်…',
    'Full name': 'အမည်အပြည့်အစုံ',
    'what the site will call you': 'ဝဘ်ဆိုက်က သင့်ကို ခေါ်မည့် အမည်',
    'Email address': 'အီးမေးလ် လိပ်စာ',
    'Password': 'စကားဝှက်',
    'Confirm password': 'စကားဝှက် အတည်ပြုရန်',
    'Typed twice so a slip cannot lock you out of a new account.': 'အမှားတစ်ခုကြောင့် အကောင့်အသစ်ထဲ ပြန်မဝင်နိုင် ဖြစ်မသွားစေရန် နှစ်ကြိမ် ရိုက်ခိုင်းခြင်း ဖြစ်သည်။',
    'At least 6 characters': 'အနည်းဆုံး စာလုံး ၆ လုံး',
    'Your password': 'သင့်စကားဝှက်',
    'Type the same password again': 'တူညီသည့် စကားဝှက်ကို ထပ်ရိုက်ပါ',
    'Show password': 'စကားဝှက် ပြရန်',
    'Hide password': 'စကားဝှက် ဖျောက်ရန်',
    'Use the email and password you signed up with.': 'စာရင်းသွင်းစဉ်က သုံးခဲ့သည့် အီးမေးလ်နှင့် စကားဝှက်ကို သုံးပါ။',
    'Pick a password of at least 6 characters. Your account starts with the "user" role.': 'အနည်းဆုံး စာလုံး ၆ လုံးပါသော စကားဝှက် ရွေးပါ။ သင့်အကောင့်သည် "user" ရာထူးဖြင့် စတင်သည်။',
    'New accounts are always created as': 'အကောင့်အသစ်တိုင်းသည် ဤရာထူးဖြင့် စတင်သည် —',
    'Editor and admin roles are granted by a site administrator in the database — they can never be chosen at signup.': 'အယ်ဒီတာနှင့် အက်ဒမင် ရာထူးများကို ဒေတာဘေ့စ်ထဲတွင် ဝဘ်ဆိုက် စီမံသူက ပေးအပ်သည် — စာရင်းသွင်းချိန်တွင် ရွေးချယ်၍ မရပါ။',
    'Enter both your email address and password.': 'အီးမေးလ် လိပ်စာနှင့် စကားဝှက် နှစ်ခုစလုံး ထည့်ပါ။',
    'Enter your full name, as you would write it on a form.': 'ပုံစံစာရွက်တွင် ရေးသကဲ့သို့ သင့်အမည်အပြည့်အစုံကို ထည့်ပါ။',
    'Passwords need to be at least 6 characters long.': 'စကားဝှက်သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရမည်။',
    'The two passwords do not match. Type the same one twice.': 'စကားဝှက် နှစ်ခု မတူညီပါ။ တူညီသည့် တစ်ခုတည်းကို နှစ်ကြိမ် ရိုက်ပါ။',
    'Account created. Check your email for a confirmation link, then sign in.': 'အကောင့် ဖွင့်ပြီးပါပြီ။ အတည်ပြု လင့်ခ်အတွက် အီးမေးလ်ကို စစ်ဆေးပြီးမှ ဝင်ပါ။',
    'Could not reach the server. Check your connection and try again.': 'ဆာဗာသို့ မရောက်ပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်စမ်းပါ။',
    'Sign-in is unavailable because Supabase is not configured.': 'Supabase ကို ချိန်ညှိမထားသောကြောင့် ဝင်ရောက်၍ မရပါ။',
    'That did not work. Please try again.': 'မအောင်မြင်ပါ။ ထပ်စမ်းကြည့်ပါ။',
    'Invalid login credentials': 'အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားနေသည်။',
    'User already registered': 'ဤအီးမေးလ်ဖြင့် အကောင့် ရှိပြီး ဖြစ်သည်။',
    'Email not confirmed': 'အီးမေးလ်ကို အတည်ပြုရသေးပါ။',
    'Password should be at least 6 characters.': 'စကားဝှက်သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရမည်။',
    'Unable to validate email address: invalid format': 'အီးမေးလ် လိပ်စာ ပုံစံ မမှန်ပါ။',

    /* --- a forgotten password, and the way back in ----------------
       Two pages' worth: the recovery mode of the sign-in form, and
       reset-password.html at the far end of the emailed link. */
    'Forgot your password?': 'စကားဝှက် မေ့နေပါသလား။',
    'Back to sign in': 'ဝင်ရောက်ရန် စာမျက်နှာသို့ ပြန်သွားရန်',
    'Send a recovery link': 'ပြန်လည်ရယူရန် လင့်ခ် ပို့ရန်',
    'Sending…': 'ပို့နေသည်…',
    'Enter the address on your account. We will email a link that lets you pick a new password. It works once, and it expires within the hour.': 'သင့်အကောင့်၏ အီးမေးလ် လိပ်စာကို ထည့်ပါ။ စကားဝှက်အသစ် ရွေးနိုင်သည့် လင့်ခ်တစ်ခုကို အီးမေးလ်ဖြင့် ပို့ပေးမည်။ ၎င်းကို တစ်ကြိမ်သာ သုံးနိုင်ပြီး တစ်နာရီအတွင်း သက်တမ်းကုန်သည်။',
    'Enter the email address on your account.': 'သင့်အကောင့်၏ အီးမေးလ် လိပ်စာကို ထည့်ပါ။',
    'If that address has an account, a recovery link is on its way. Open it and you can choose a new password.': 'ထိုလိပ်စာဖြင့် အကောင့် ရှိပါက ပြန်လည်ရယူရန် လင့်ခ်ကို ပို့လိုက်ပါပြီ။ ၎င်းကို ဖွင့်ပြီး စကားဝှက်အသစ် ရွေးနိုင်သည်။',
    'A recovery link was requested very recently. Wait a minute, then try again.': 'ပြန်လည်ရယူရန် လင့်ခ်ကို ခုနကလေးတင် တောင်းခံထားသည်။ တစ်မိနစ်ခန့် စောင့်ပြီးမှ ထပ်စမ်းပါ။',
    'The recovery email could not be sent. That is a fault on our side, not yours — please try again shortly.': 'ပြန်လည်ရယူရန် အီးမေးလ်ကို ပို့၍ မရပါ။ ၎င်းသည် သင့်ဘက်မှ အမှား မဟုတ်ဘဲ ကျွန်ုပ်တို့ဘက်မှ ချွတ်ယွင်းချက် ဖြစ်သည် — ခဏနေ ထပ်စမ်းကြည့်ပါ။',

    'Choose a new password': 'စကားဝှက်အသစ် ရွေးရန်',
    'You reached this page from a recovery email. Set a password here and you are signed straight back in.': 'ပြန်လည်ရယူရန် အီးမေးလ်မှတစ်ဆင့် ဤစာမျက်နှာသို့ ရောက်လာခြင်း ဖြစ်သည်။ ဤနေရာတွင် စကားဝှက် သတ်မှတ်လိုက်လျှင် ချက်ချင်း ပြန်ဝင်ရောက်ပြီး ဖြစ်မည်။',
    'New password': 'စကားဝှက်အသစ်',
    'Checking your link': 'သင့်လင့်ခ်ကို စစ်ဆေးနေသည်',
    'Set a new password': 'စကားဝှက်အသစ် သတ်မှတ်ရန်',
    'Confirm new password': 'စကားဝှက်အသစ် အတည်ပြုရန်',
    'Typed twice so a slip cannot lock you out again.': 'အမှားတစ်ခုကြောင့် ထပ်မံ ပိတ်မိမသွားစေရန် နှစ်ကြိမ် ရိုက်ခိုင်းခြင်း ဖြစ်သည်။',
    'Save new password': 'စကားဝှက်အသစ် သိမ်းရန်',
    'Saving…': 'သိမ်းနေသည်…',
    'This link cannot be used': 'ဤလင့်ခ်ကို သုံး၍ မရပါ',
    'Recovery links expire, and each one works only once. Ask for a fresh link and open the newest email.': 'ပြန်လည်ရယူရန် လင့်ခ်များသည် သက်တမ်းကုန်တတ်ပြီး တစ်ခုလျှင် တစ်ကြိမ်သာ အလုပ်လုပ်သည်။ လင့်ခ်အသစ် တောင်းပြီး နောက်ဆုံးရ အီးမေးလ်ကို ဖွင့်ပါ။',
    'Password changed': 'စကားဝှက် ပြောင်းလဲပြီးပါပြီ',
    'You are signed in on this device with the new password.': 'ဤစက်ပစ္စည်းတွင် စကားဝှက်အသစ်ဖြင့် ဝင်ရောက်ထားပြီး ဖြစ်သည်။',
    'Your account': 'သင့်အကောင့်',
    'Changing a password does not change your role.': 'စကားဝှက် ပြောင်းခြင်းသည် သင့်ရာထူးကို မပြောင်းလဲစေပါ။',
    'Editor and admin roles are granted by a site administrator in the database, and a recovery link cannot touch them.': 'အယ်ဒီတာနှင့် အက်ဒမင် ရာထူးများကို ဒေတာဘေ့စ်ထဲတွင် ဝဘ်ဆိုက် စီမံသူက ပေးအပ်ပြီး ပြန်လည်ရယူရန် လင့်ခ်က ၎င်းတို့ကို မထိရောက်နိုင်ပါ။',

    'That recovery link has expired. Links last about an hour — ask for a new one and open the newest email.': 'ဤပြန်လည်ရယူရန် လင့်ခ် သက်တမ်းကုန်သွားပြီ။ လင့်ခ်များသည် တစ်နာရီခန့်သာ ခံသည် — အသစ်တစ်ခု တောင်းပြီး နောက်ဆုံးရ အီးမေးလ်ကို ဖွင့်ပါ။',
    'That recovery link is not valid any more. Each one works only once, so ask for a fresh link.': 'ဤပြန်လည်ရယူရန် လင့်ခ်ကို သုံး၍ မရတော့ပါ။ တစ်ခုလျှင် တစ်ကြိမ်သာ အလုပ်လုပ်သောကြောင့် လင့်ခ်အသစ် တောင်းပါ။',
    'That recovery link could not be used. Ask for a fresh one.': 'ဤပြန်လည်ရယူရန် လင့်ခ်ကို သုံး၍ မရပါ။ အသစ်တစ်ခု တောင်းပါ။',
    'Open this page from the link in your recovery email. Reaching it any other way leaves nothing to check.': 'ဤစာမျက်နှာကို ပြန်လည်ရယူရန် အီးမေးလ်ထဲရှိ လင့်ခ်မှတစ်ဆင့် ဖွင့်ပါ။ အခြားနည်းဖြင့် ရောက်လာလျှင် စစ်ဆေးစရာ မရှိပါ။',
    'Password recovery is unavailable because this site is not connected to its database.': 'ဤဝဘ်ဆိုက်သည် ဒေတာဘေ့စ်နှင့် မချိတ်ဆက်ထားသောကြောင့် စကားဝှက် ပြန်လည်ရယူ၍ မရပါ။',
    'Could not reach the server to check this link. Check your connection and open the link again.': 'ဤလင့်ခ်ကို စစ်ဆေးရန် ဆာဗာသို့ မရောက်ပါ။ ချိတ်ဆက်မှုကို စစ်ဆေးပြီး လင့်ခ်ကို ပြန်ဖွင့်ပါ။',
    'That is the password you already had. Choose a different one.': 'ဤစကားဝှက်မှာ ယခင်က သုံးနေသည့် စကားဝှက် ဖြစ်သည်။ အခြားတစ်ခု ရွေးပါ။',
    'The recovery link has expired while this page was open. Ask for a new one.': 'ဤစာမျက်နှာ ဖွင့်ထားစဉ်အတွင်း ပြန်လည်ရယူရန် လင့်ခ် သက်တမ်းကုန်သွားပြီ။ အသစ်တစ်ခု တောင်းပါ။',
    'The password could not be changed. Please try again.': 'စကားဝှက်ကို ပြောင်း၍ မရပါ။ ထပ်စမ်းကြည့်ပါ။',

    /* --- changing your own display name ---------------------------
       The menu is now every signed-in visitor's account control, so the
       role words below are the ones it shows as a subtitle. */
    'This is the name the site shows in place of your email address.': 'ဤအမည်ကို သင့်အီးမေးလ် လိပ်စာအစား ဝဘ်ဆိုက်တွင် ပြသမည် ဖြစ်သည်။',
    'Cancel': 'မလုပ်တော့ပါ',
    'Close': 'ပိတ်ရန်',
    'Editor': 'အယ်ဒီတာ',
    'Reader': 'ဖတ်ရှုသူ',
    'You have been signed out. Sign in again and try once more.': 'သင် ထွက်သွားပြီ ဖြစ်သည်။ ပြန်ဝင်ပြီး ထပ်စမ်းကြည့်ပါ။',

    /* --- display names ------------------------------------------
       No rules to explain here: any script, spaces, punctuation, and
       two people may share one. The Burmese says so too. */
    'Display name': 'ပြသမည့်အမည်',
    'Change your display name': 'ပြသမည့်အမည် ပြောင်းရန်',
    'Anything you like, in any language. Spaces and punctuation are fine.': 'သင်နှစ်သက်ရာ မည်သည့်ဘာသာစကားဖြင့်မဆို ရေးနိုင်သည်။ ကွက်လပ်နှင့် ပုဒ်ဖြတ်များလည်း ရပါသည်။',
    'Enter the name you would like to be called.': 'သင့်ကို ခေါ်စေလိုသည့် အမည်ကို ထည့်ပါ။',
    'Display names stop at 60 characters.': 'ပြသမည့်အမည်သည် စာလုံး ၆၀ ထက် မပိုရပါ။',
    'Display name changes are not switched on for this site yet.': 'ဤဝဘ်ဆိုက်တွင် ပြသမည့်အမည် ပြောင်းခြင်းကို မဖွင့်ရသေးပါ။',
    'The account could not be created. Please try again.': 'အကောင့် ဖန်တီး၍ မရပါ။ ထပ်စမ်းကြည့်ပါ။',

    /* --- admin area: shell, navigation and the guard ------------
       Every visible string in admin/. Page-specific ones are added as
       each page is built. Role VALUES stay English, as everywhere else. */
    'Overview': 'အနှစ်ချုပ်',
    'People': 'အသုံးပြုသူများ',
    'Users and roles': 'အသုံးပြုသူများနှင့် ရာထူးများ',
    'Content': 'အကြောင်းအရာ',
    'Diseases, articles, hospitals': 'ရောဂါများ၊ ဆောင်းပါးများ၊ ဆေးရုံများ',
    'Moderation': 'စိစစ်ရေး',
    'Reports': 'တိုင်ကြားချက်များ',
    'You': 'သင်',
    'Your profile': 'သင့်ပရိုဖိုင်',
    'Back to MedCare': 'MedCare သို့ ပြန်သွားရန်',
    'Show admin sections': 'အက်ဒမင် မီနူး ပြရန်',
    'Hide admin sections': 'အက်ဒမင် မီနူး ဖျောက်ရန်',
    'Everything an admin can reach, in one place.': 'အက်ဒမင် တစ်ဦး လက်လှမ်းမီသည့် အရာအားလုံး တစ်နေရာတည်းတွင်။',
    'Everything here is enforced by the database, not by this page.': 'ဤနေရာရှိ အရာအားလုံးကို ဤစာမျက်နှာက မဟုတ်ဘဲ ဒေတာဘေ့စ်က စိစစ်သည်။',
    'These screens decide what to show you. Row Level Security decides what anyone is allowed to do — including you, and including anyone who opens this page with the guard deleted.': 'ဤစာမျက်နှာများက သင့်ကို ဘာပြရမည်ကိုသာ ဆုံးဖြတ်သည်။ မည်သူ ဘာလုပ်ခွင့် ရှိသည်ကို Row Level Security က ဆုံးဖြတ်သည် — သင်လည်း အပါအဝင်၊ ကာကွယ်မှုကို ဖျက်ပြီး ဤစာမျက်နှာကို ဖွင့်သူလည်း အပါအဝင် ဖြစ်သည်။',
    'Who has an account, and what each of them may do. Role changes are confirmed by name before they are saved.': 'မည်သူ့တွင် အကောင့် ရှိသည်၊ တစ်ဦးချင်းစီ ဘာလုပ်နိုင်သည်ကို ကြည့်ရန်။ ရာထူး ပြောင်းလဲမှုကို မသိမ်းမီ အမည်ဖြင့် အတည်ပြုခိုင်းသည်။',
    'Diseases, articles and hospitals. Drafts stay invisible to the public until they are published.': 'ရောဂါများ၊ ဆောင်းပါးများနှင့် ဆေးရုံများ။ မူကြမ်းများကို ထုတ်ဝေသည်အထိ အများပြည်သူ မမြင်ရပါ။',
    'Ambulance, fire, police, poison control. A wrong number here is the worst thing this site can print, so each one is typed twice.': 'လူနာတင်ယာဉ်၊ မီးသတ်၊ ရဲနှင့် အဆိပ်ဖြေဌာန။ ဤနေရာတွင် နံပါတ် မှားခြင်းသည် ဤဝဘ်ဆိုက် ဖော်ပြနိုင်သည့် အဆိုးဆုံး အမှား ဖြစ်သဖြင့် တစ်ခုစီကို နှစ်ကြိမ် ရိုက်ခိုင်းသည်။',
    'What readers have flagged as wrong. Resolving or dismissing one needs a note saying why.': 'ဖတ်ရှုသူများက မှားနေသည်ဟု ထောက်ပြထားသည်များ။ ဖြေရှင်းခြင်း သို့မဟုတ် ပယ်ဖျက်ခြင်းအတွက် အကြောင်းပြချက် မှတ်ချက် လိုအပ်သည်။',
    'Your display name, your language, and your password.': 'သင့်ပြသမည့်အမည်၊ သင့်ဘာသာစကားနှင့် သင့်စကားဝှက်။',
    'What is not here': 'ဤနေရာတွင် မပါဝင်သည်များ',
    'No traffic charts, no visitor counts, no activity feed. This site does not record what anyone searched for or which disease page they opened — that is identifiable health data, and the way to keep it private is not to collect it. There is nothing to chart, and that is the intended state rather than a missing feature.': 'အသွားအလာ ဇယားများ၊ လာရောက်သူ အရေအတွက်များ၊ လှုပ်ရှားမှု မှတ်တမ်းများ မပါပါ။ ဤဝဘ်ဆိုက်သည် မည်သူက ဘာရှာဖွေသည်၊ မည်သည့် ရောဂါ စာမျက်နှာကို ဖွင့်ကြည့်သည်ကို မမှတ်တမ်းတင်ပါ — ၎င်းသည် တစ်ဦးချင်း ဖော်ထုတ်နိုင်သော ကျန်းမာရေး အချက်အလက် ဖြစ်ပြီး ကာကွယ်ရန် အကောင်းဆုံး နည်းလမ်းမှာ မစုဆောင်းခြင်း ဖြစ်သည်။ ထို့ကြောင့် ဇယားဆွဲစရာ မရှိခြင်းသည် ချို့ယွင်းချက် မဟုတ်ဘဲ ရည်ရွယ်ချက် ဖြစ်သည်။',
    'Admin area unavailable': 'အက်ဒမင် နေရာကို မရနိုင်ပါ',
    'This site is not connected to its database. See the console for details.': 'ဤဝဘ်ဆိုက်သည် ဒေတာဘေ့စ်နှင့် မချိတ်ဆက်ထားပါ။ အသေးစိတ်ကို console တွင် ကြည့်ပါ။',
    'Could not check your permissions': 'သင့်ခွင့်ပြုချက်များကို စစ်ဆေး၍ မရပါ',
    'The database did not answer. Check your connection and reload the page.': 'ဒေတာဘေ့စ်မှ အဖြေ မရပါ။ ချိတ်ဆက်မှုကို စစ်ဆေးပြီး စာမျက်နှာကို ပြန်ဖွင့်ပါ။',
  };

  var LANGS = { en: null, my: MY };
  var LANG_KEY = 'mc-lang';
  var currentLang = 'en';
  var busy = false;
  var origText = new WeakMap();      // Text node -> its original English
  var I18N_ATTRS = ['placeholder', 'aria-label', 'title'];

  function lookup(text) {
    var dict = LANGS[currentLang];
    if (!dict) { return null; }
    // Prose in the HTML is wrapped across source lines, so a text node
    // arrives carrying newlines and indentation. Collapse runs of
    // whitespace before looking up: without this, a sentence written over
    // three lines can never match its single-line key, which is why the
    // long notes on the staff pages went untranslated.
    var key = text.trim().replace(/\s+/g, ' ');
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : null;
  }

  function swapText(node) {
    var orig = origText.get(node);
    if (orig === undefined) { orig = node.data; origText.set(node, orig); }
    if (!orig.trim()) { return; }
    var hit = lookup(orig);
    // Replace only the trimmed word so surrounding spaces/newlines survive.
    var next = hit === null ? orig : orig.replace(orig.trim(), hit);
    if (node.data !== next) { node.data = next; }
  }

  function swapAttrs(el) {
    I18N_ATTRS.forEach(function (attr) {
      if (!el.hasAttribute(attr)) { return; }
      var store = 'data-i18n-' + attr;       // the English we started from
      var wrote = 'data-i18n-set-' + attr;   // what we last put there
      var orig  = el.getAttribute(store);
      var now   = el.getAttribute(attr);

      /* A script may have written a new value since the last pass — the
         login form swaps its password placeholder when you switch between
         signing in and signing up. The test is whether the value still
         matches what WE last wrote: if it does not, a script wrote it, and
         it becomes the new English original.

         Comparing against the translation instead would misfire the moment
         the language goes back to English, because by then the attribute
         holds Burmese and there is no dictionary left to recognise it
         with — the Burmese would be remembered as the original and stick. */
      if (orig === null || now !== el.getAttribute(wrote)) {
        orig = now;
        el.setAttribute(store, orig);
      }

      var hit = lookup(orig);
      var next = hit === null ? orig : hit;
      if (now !== next) { el.setAttribute(attr, next); }
      el.setAttribute(wrote, next);
    });
  }

  function walk(node) {
    if (node.nodeType === 3) { swapText(node); return; }
    if (node.nodeType !== 1) { return; }
    var tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') { return; }
    // The switcher itself always shows both languages verbatim.
    if (node.classList && node.classList.contains('mc-langbar')) { return; }
    /* Long-form content written in the editor. This walk is a phrase
       dictionary for the SITE's own wording - buttons, headings, the
       chrome - and running it over an article is how a sentence in the
       middle of a medical page silently becomes a different sentence
       because it happened to match a key. Article text carries its own
       translation in body_my; it does not need this one. */
    if (node.classList && node.classList.contains('mc-noi18n')) { return; }
    swapAttrs(node);
    for (var child = node.firstChild; child; child = child.nextSibling) { walk(child); }
  }

  function applyLang(lang) {
    currentLang = LANGS[lang] === undefined ? 'en' : lang;
    busy = true;
    document.documentElement.lang = currentLang;
    walk(document.body);
    busy = false;
    var bar = document.querySelector('.mc-langbar');
    if (bar) {
      bar.querySelectorAll('.mc-lang-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-lang') === currentLang ? 'true' : 'false');
      });
    }
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) { /* file:// or private mode */ }
  }

  // Build the bar here so every page gets it without duplicating markup.
  var langbar = document.createElement('div');
  langbar.className = 'mc-langbar';
  langbar.innerHTML =
    '<div class="container">' +
      '<span class="mc-langbar-label"><i class="bi bi-translate"></i> Language / ဘာသာစကား</span>' +
      '<div class="mc-lang" role="group" aria-label="Choose language">' +
        '<button class="mc-lang-btn" type="button" data-lang="en" aria-pressed="true">English</button>' +
        '<button class="mc-lang-btn" type="button" data-lang="my" aria-pressed="false">မြန်မာ</button>' +
      '</div>' +
    '</div>';
  document.body.insertBefore(langbar, document.body.firstChild);
  langbar.addEventListener('click', function (e) {
    var btn = e.target.closest('.mc-lang-btn');
    if (btn) { applyLang(btn.getAttribute('data-lang')); }
  });

  // Re-translate anything drawn after load (filtered cards, search results…).
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      if (busy || currentLang === 'en') { return; }
      busy = true;
      records.forEach(function (r) {
        if (r.type === 'characterData') { swapText(r.target); }
        // Placeholders and labels that a script rewrites after load would
        // otherwise stay in English: attribute changes are not childList
        // changes, so nothing used to notice them.
        if (r.type === 'attributes') { swapAttrs(r.target); }
        Array.prototype.forEach.call(r.addedNodes, walk);
      });
      busy = false;
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: I18N_ATTRS
    });
  }

  var saved = 'en';
  try { saved = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { /* ignore */ }
  applyLang(saved);

  /* ==================================================================
     The dictionary above, but editable
     ------------------------------------------------------------------
     MY is the shipped translation. It works, and it means a wrong
     Burmese sentence needs a developer, a commit and a deploy to fix —
     which is why some of them have been wrong for a while.

     public.translations is the same dictionary in the database, keyed by
     the same thing: the English source string. editor/translations.html
     writes to it. Everything below layers that table over the literal.

     The order matters and it is the file that loses. A key present in
     both takes the database's value, because that is the one somebody
     went and corrected. A key present only in the file keeps working, so
     an empty table changes nothing, and so does an unreachable one — the
     failure mode of this whole feature is "the translation is as good as
     it was yesterday", which is the only acceptable one for text a
     reader is relying on.

     Nothing here touches English. `en` has no dictionary by design.
     ================================================================== */

  /* What the editor screen lists. Handing over the live object rather
     than a copy is deliberate: merge() writes into the same one applyLang
     reads, so a saved string takes effect on the next switch without a
     reload. The screen only reads it. */
  window.MedCareI18n = {
    LANG_KEY: LANG_KEY,

    // Every key the site can translate, in the order they are written.
    keys: function () { return Object.keys(MY); },

    // What the shipped file says, before any database override.
    fromFile: function (key) {
      return Object.prototype.hasOwnProperty.call(MY, key) ? MY[key] : null;
    },

    current: function () { return currentLang; },

    /* rows: [{ en, my }]. A row with an empty `my` is a key somebody has
       started and not finished; it must NOT overwrite the file's value
       with a blank, or filling in half a form would take Burmese off the
       page. Ignored here, and flagged as unfinished on the editor
       screen. */
    merge: function (rows) {
      var changed = 0;
      (rows || []).forEach(function (row) {
        if (!row || !row.en) { return; }
        var value = row.my == null ? '' : String(row.my).trim();
        if (!value) { return; }
        if (MY[row.en] === value) { return; }
        MY[row.en] = value;
        changed++;
      });
      // Re-run only if the page is actually showing Burmese and
      // something moved. In English this is a no-op the reader would
      // still pay a full DOM walk for.
      if (changed && currentLang !== 'en') { applyLang(currentLang); }
      return changed;
    }
  };

  /* Fetched once per page load, after first paint, and never awaited by
     anything. If it is slow the page is already correct; if it fails the
     page stays correct. `translations` is world-readable, so this runs
     for signed-out visitors too — the whole point is that a fix reaches
     readers, not just staff. */
  (function loadTranslationOverrides() {
    var db = window.supabaseClient;
    if (!db) { return; }

    db.from('translations').select('en, my')
      .then(function (res) {
        if (res.error) {
          /* The commonest cause by far is supabase_editor.sql not having
             been run yet, which is a perfectly fine state for this site
             to be in. Logged, not surfaced: a reader is not owed a
             message about a table they have never heard of. */
          console.info('[MedCare] Translation overrides unavailable; using the built-in dictionary.',
                       res.error.message);
          return;
        }
        window.MedCareI18n.merge(res.data);
      })
      .catch(function () { /* offline; the built-in dictionary stands */ });
  })();


  /* ==================================================================
     Site state — the maintenance curtain and the site-wide notice
     ------------------------------------------------------------------
     Reads site_settings, keys 'maintenance' and 'notice', written by
     admin/maintenance.html. Both rows are world-readable on purpose: a
     visitor who is not signed in is exactly the visitor who needs to be
     told the site is closed.

     WHAT THIS IS. A curtain. It stops the PAGES being shown; it does not
     stop the data being read, because the policies that decide that have
     not changed and should not. Anybody who wants what is behind it can
     still ask the API. That is the right trade — maintenance mode exists
     so a reader does not act on a page that is half-rewritten, not to
     keep a secret — but it means nothing that must not be seen may ever
     be protected by this.

     IT FAILS OPEN. No database, no table, no network, a malformed row:
     every one of those leaves the site exactly as it was. A health site
     that hides itself because a fetch timed out has done more harm than
     the stale page it was trying to prevent, and "closed" is a state
     this code will only ever enter on a direct answer from the database
     saying so.

     WHERE IT NEVER RUNS. /admin/ and /editor/, which have guards of
     their own, and login.html. Curtaining the admin area would mean
     turning maintenance mode on locks you out of turning it off;
     curtaining the login page would mean the staff who are exempt from
     the curtain cannot sign in to become exempt.
     ================================================================== */
  (function siteState() {
    var path = window.location.pathname;
    if (/\/(admin|editor)\//.test(path)) { return; }

    var file  = (path.split('/').pop() || 'index.html').toLowerCase();
    var depth = path.indexOf('/diseases/') !== -1 ? '../' : '';

    var EMERGENCY_PAGE = 'emergency-contacts.html';
    var ALWAYS_OPEN    = ['login.html'];
    var CACHE_KEY      = 'mc-site-state';

    var state     = null;    // what the database last said, or null for "open"
    var role      = null;    // once auth.js has answered
    var roleKnown = false;

    /* Cached for one session so a second page load covers first and
       checks after, rather than flashing the site at somebody who has
       already been told it is closed. sessionStorage, not localStorage:
       a stale "closed" that outlives the browser tab would be a worse
       bug than the flash it prevents. */
    function readCache() {
      try {
        var raw = window.sessionStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
    function writeCache(value) {
      try { window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(value)); }
      catch (e) { /* private mode, or full: the fetch still decides */ }
    }

    function bar(id, className, iconClass, text, link) {
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        document.body.insertBefore(el, document.body.firstChild);
      }
      el.className = className;
      el.setAttribute('role', 'status');
      el.innerHTML = '<i class="bi ' + iconClass + '" aria-hidden="true"></i><span></span>';
      // textContent, never innerHTML: this string was typed into a form
      // by an admin, and an admin typing into a form is not a reason to
      // trust a string with the rest of the page.
      el.querySelector('span').textContent = text;
      if (link) {
        var a = document.createElement('a');
        a.href = link.href;
        a.textContent = link.text;
        a.style.marginLeft = '.5rem';
        el.querySelector('span').appendChild(a);
      }
      return el;
    }

    function drop(id) {
      var el = document.getElementById(id);
      if (el) { el.remove(); }
    }

    /* ---------- The notice ---------- */
    function renderNotice(n) {
      var text = n && n.enabled ? String(n.text || '').trim() : '';
      if (!text) { drop('mcSiteNotice'); return; }
      bar('mcSiteNotice',
          'mc-site-notice' + (n.tone === 'warning' ? ' mc-site-notice--warning' : ''),
          n.tone === 'warning' ? 'bi-exclamation-triangle' : 'bi-info-circle',
          text);
    }

    /* ---------- The curtain ---------- */
    function renderCurtain(m) {
      var closed = !!(m && m.enabled);

      if (!closed) {
        drop('mcCurtain');
        drop('mcCurtainStaff');
        drop('mcMaintenanceBar');
        document.body.style.overflow = '';
        return;
      }

      var message = String(m.message || '').trim() ||
                    'MedCare is being updated. Please check back shortly.';
      var emergencyOk = m.allow_emergency !== false;

      /* Staff see the site, and a bar saying nobody else can. Until
         auth.js answers, roleKnown is false and everybody is treated as
         a reader — the curtain goes up first and comes down a moment
         later for the people it does not apply to. That order is
         deliberate: the reader is the one it exists for. */
      var staff = roleKnown && (role === 'editor' || role === 'admin');

      var exempt = ALWAYS_OPEN.indexOf(file) !== -1 ||
                   (file === EMERGENCY_PAGE && emergencyOk);

      if (staff || exempt) {
        drop('mcCurtain');
        document.body.style.overflow = '';

        if (staff) {
          drop('mcMaintenanceBar');
          bar('mcCurtainStaff', 'mc-curtain-staff', 'bi-cone-striped',
              'This site is closed to the public. You can see it because you are signed in as staff.',
              role === 'admin'
                ? { href: depth + 'admin/maintenance.html', text: 'Reopen it' }
                : null);
        } else {
          drop('mcCurtainStaff');
          bar('mcMaintenanceBar', 'mc-site-notice mc-site-notice--warning', 'bi-cone-striped',
              file === EMERGENCY_PAGE
                ? 'The rest of MedCare is closed for maintenance. These numbers are still here.'
                : message);
        }
        return;
      }

      drop('mcCurtainStaff');
      drop('mcMaintenanceBar');

      var el = document.getElementById('mcCurtain');
      if (!el) {
        el = document.createElement('div');
        el.id = 'mcCurtain';
        el.className = 'mc-curtain';
        el.setAttribute('role', 'alertdialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'mcCurtainTitle');
        el.innerHTML =
          '<div class="mc-curtain-panel">' +
            '<div class="mc-curtain-ico"><i class="bi bi-tools" aria-hidden="true"></i></div>' +
            '<h1 id="mcCurtainTitle">MedCare is closed for maintenance</h1>' +
            '<p data-message></p>' +
            '<span class="mc-curtain-emergency" data-emergency hidden>' +
              'If this is an emergency, the phone numbers are still here.' +
              '<a class="mc-auth-btn" href="' + depth + EMERGENCY_PAGE + '">Emergency numbers</a>' +
            '</span>' +
            '<span class="mc-curtain-sign">You are seeing this because the site is being updated.</span>' +
          '</div>';
        document.body.appendChild(el);
      }

      el.querySelector('[data-message]').textContent = message;
      el.querySelector('[data-emergency]').hidden = !emergencyOk;

      // The page underneath is left intact and merely covered, so that
      // taking the curtain away — which is what happens the moment a
      // staff session is confirmed — puts the site back with nothing to
      // re-render. Its scrollbar is the only thing that has to go.
      document.body.style.overflow = 'hidden';
    }

    function render() {
      renderNotice(state && state.notice);
      renderCurtain(state && state.maintenance);
    }

    // Cover first, check after.
    state = readCache();
    if (state) { render(); }

    var db = window.supabaseClient;
    if (db) {
      db.from('site_settings').select('key,value').in('key', ['maintenance', 'notice'])
        .then(function (res) {
          if (res.error) {
            /* Commonest cause by far is supabase_admin_scope.sql not
               having been run, which is a perfectly fine state for this
               site to be in. Logged, not surfaced: a reader is not owed
               a message about a table they have never heard of. */
            console.info('[MedCare] Site settings unavailable; the site stays open.',
                         res.error.message);
            state = null;
            writeCache(null);
            render();
            return;
          }
          var next = { maintenance: null, notice: null };
          (res.data || []).forEach(function (row) { next[row.key] = row.value; });
          state = next;
          writeCache(next);
          render();
        })
        .catch(function () {
          // Offline. Fail open, and drop the cache so the next page load
          // does not put a curtain up on the strength of an old answer.
          state = null;
          writeCache(null);
          render();
        });
    } else {
      state = null;
      render();
    }

    if (window.MedCareAuth && window.MedCareAuth.ready) {
      window.MedCareAuth.ready.then(function () {
        role = window.MedCareAuth.getRole();
        roleKnown = true;
        render();
      });
    }
  })();

})();

document.addEventListener("DOMContentLoaded", () => {
  const filters = document.querySelector(".mc-filters");
  const map = document.querySelector(".hospital-map");

  const adjustMapStickyOffset = () => {
    if (!filters || !map) return;
    
    // Get the exact, real-time height of the filters box
    const filtersHeight = filters.offsetHeight;
    
    // Add extra padding (e.g., 20px) so the map doesn't touch the filters directly
    const spacing = 20; 
    
    // Set the CSS variable on the map element
    map.style.setProperty("--filters-height", `${filtersHeight + spacing}px`);
  };

  // Run immediately on page load
  adjustMapStickyOffset();

  // Re-calculate if the window changes size (mobile to desktop layout switches)
  window.addEventListener("resize", adjustMapStickyOffset);

  // OPTIONAL: If your #hospTypes choices load via AJAX later, 
  // call adjustMapStickyOffset() right after that data populates.
});

