(function () {
  'use strict';

  /* ---------- Data ---------- */
  var diseases = [
    { name: 'Hypertension', icon: 'bi-heart-pulse', tag: 'Chronic', cat: 'chronic', href: 'https://www.nhs.uk/conditions/high-blood-pressure/', desc: 'High blood pressure often has no symptoms but raises the risk of stroke and heart disease over time. ' },
    { name: 'Diabetes', icon: 'bi-droplet-half', tag: 'Chronic', cat: 'chronic', href: 'https://www.nhs.uk/conditions/diabetes/', desc: 'A long-term condition where blood sugar levels are too high, manageable with diet, exercise, and medication.' },
    { name: 'Asthma', icon: 'bi-lungs', tag: 'Respiratory', cat: 'respiratory',href: 'https://www.nhs.uk/conditions/asthma/', desc: 'Airways narrow and swell, causing wheezing and shortness of breath — usually controlled with inhalers.' },
    { name: 'Dengue fever', icon: 'bi-bug', tag: 'Infectious', cat: 'infectious', href: 'hypertension.html', desc: 'A mosquito-borne viral illness common in the rainy season, causing high fever, body aches, and rash.' },
    { name: 'Tuberculosis (TB)', icon: 'bi-clipboard2-pulse', tag: 'Infectious', cat: 'infectious respiratory', href: 'hypertension.html', desc: 'A bacterial infection mainly affecting the lungs, treatable with a full course of antibiotics.' },
    { name: 'Malaria', icon: 'bi-thermometer-half', tag: 'Infectious', cat: 'infectious', href: 'hypertension.html', desc: 'A mosquito-borne parasitic disease that causes cyclic fever and chills; preventable with nets and repellents.' },
    { name: 'Hepatitis B', icon: 'bi-shield-plus', tag: 'Infectious', cat: 'infectious', href: 'hypertension.html', desc: 'A liver infection that can become long-term; a safe vaccine prevents it and testing catches it early.' },
    { name: 'Coronary heart disease', icon: 'bi-heart', tag: 'Chronic', cat: 'chronic', href: 'hypertension.html', desc: 'Narrowed arteries reduce blood flow to the heart and can cause chest pain or a heart attack.' },
    { name: 'Stroke', icon: 'bi-brain', tag: 'Chronic', cat: 'chronic', href: 'hypertension.html', desc: 'A sudden interruption of blood to the brain — act fast; call an ambulance if you notice F.A.S.T. signs.' },
    { name: 'Anemia', icon: 'bi-droplet', tag: 'Chronic', cat: 'chronic maternal', href: 'hypertension.html', desc: 'Low red blood cell counts cause fatigue and weakness; iron-rich foods and supplements often help.' },
    { name: 'Typhoid fever', icon: 'bi-cup-hot', tag: 'Infectious', cat: 'infectious', href: 'hypertension.html', desc: 'A bacterial infection spread through contaminated food or water — safe hygiene and vaccination help prevent it.' },
    { name: 'Pre-eclampsia', icon: 'bi-person-heart', tag: 'Maternal', cat: 'maternal', href: 'hypertension.html', desc: 'A pregnancy complication with high blood pressure — regular antenatal check-ups are essential.' }
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
  var pharmTypeMeta = [
    { id: 'chain', label: 'Chain pharmacy' },
    { id: 'independent', label: 'Independent' },
    { id: 'hospital', label: 'Hospital pharmacy' }
  ];
  var pharmServiceMeta = [
    { id: 'open24', label: 'Open 24 hours' },
    { id: 'delivery', label: 'Home delivery' }
  ];
  var articleCats = [
    { id: 'all', label: 'All' },
    { id: 'prevention', label: 'Prevention' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'maternal', label: 'Maternal care' },
    { id: 'chronic', label: 'Chronic care' },
    { id: 'wellness', label: 'Wellness' }
  ];
  // Article bodies are stored as blocks so one reader page (article.html) can
  // render any of them: { p: paragraph, h: heading, ul: bullet list }.
  var articles = [
    {
      id: 'dengue-rainy-season',
      title: 'Protecting your family from dengue during the rainy season',
      excerpt: 'Simple steps every household in Yangon can take to prevent mosquito breeding at home.',
      cat: 'prevention', catLabel: 'Monsoon health', thumb: '',
      author: 'Dr. Thiri Aung', read: '5 min read', date: 'Jul 22, 2026',
      body: [
        { p: 'Dengue spreads through the bite of the Aedes mosquito, which breeds in clean, still water close to where people live. In Yangon most bites happen during the day, so bed nets alone are not enough. The most effective protection is removing the water the mosquitoes breed in.' },
        { h: 'Check your home once a week' },
        { p: 'Aedes mosquitoes need only a bottle cap of water to lay eggs, and it takes about a week for those eggs to become biting adults. A weekly walk around the house breaks that cycle.' },
        { ul: [
          'Empty and scrub water storage jars, drums and buckets, then cover them tightly.',
          'Tip out saucers under flower pots, pet bowls and the tray behind the refrigerator.',
          'Clear blocked roof gutters and drains where rainwater collects.',
          'Turn over or throw away old tyres, tins and coconut shells in the yard.'
        ] },
        { h: 'Avoid bites during the day' },
        { ul: [
          'Wear long sleeves and long trousers, especially in the early morning and late afternoon.',
          'Use repellent on exposed skin, and fit screens on windows where you can.',
          'Let small children and anyone resting during the day sleep under a net.'
        ] },
        { h: 'Know the warning signs' },
        { p: 'Most people recover at home with rest and plenty of fluids. Paracetamol can be used for fever and pain. Do not take aspirin or ibuprofen, as they increase the risk of bleeding.' },
        { p: 'Go to a hospital straight away if you notice severe stomach pain, repeated vomiting, bleeding from the gums or nose, black stools, cold or clammy skin, restlessness, or if the person becomes very tired as the fever drops. These can be signs of severe dengue, which needs urgent care.' }
      ]
    },
    {
      id: 'eating-well-on-a-budget',
      title: 'Eating well on a Myanmar family budget',
      excerpt: 'Everyday foods from the market that support blood pressure, heart, and blood-sugar health.',
      cat: 'nutrition', catLabel: 'Nutrition', thumb: 'b',
      author: 'Ma Nilar, RD', read: '7 min read', date: 'Jul 19, 2026',
      body: [
        { p: 'Eating for your heart and blood sugar does not mean buying imported or expensive food. Most of what your body needs is already in the local market, and the cheapest items are often the most useful.' },
        { h: 'Build the plate around vegetables and pulses' },
        { p: 'Aim for half your plate to be vegetables, a quarter protein, and a quarter rice or another staple. Beans, chickpeas, lentils and tofu cost far less than meat and give you protein plus fibre, which slows the rise in blood sugar after a meal.' },
        { ul: [
          'Seasonal vegetables are cheapest and freshest — buy what is plentiful that week.',
          'Add pulses to curries and soups to stretch a small amount of meat further.',
          'Keep eggs on hand as an affordable, complete protein.'
        ] },
        { h: 'Cut back on salt without losing flavour' },
        { p: 'Most of the salt we eat comes from fish sauce, ngapi, stock cubes, instant noodles and packaged snacks rather than the salt shaker. Lowering it is one of the fastest ways to bring blood pressure down.' },
        { ul: [
          'Use half the fish sauce or stock you normally would, then taste before adding more.',
          'Build flavour with garlic, ginger, lemongrass, tamarind, lime and fresh herbs.',
          'Treat instant noodles and packaged snacks as occasional food, not daily food.'
        ] },
        { h: 'Choose better staples and fats' },
        { ul: [
          'Mix in brown or parboiled rice, or serve rice with plenty of vegetables and beans.',
          'Fry less often; steam, boil or grill where you can, and reuse cooking oil sparingly.',
          'Drink water or plain tea instead of sweetened drinks — sugary drinks add a lot of calories with no fullness.'
        ] },
        { p: 'Small, steady changes work better than strict diets. Changing one meal a day is enough to start.' }
      ]
    },
    {
      id: 'first-antenatal-visit',
      title: 'What to expect at your first antenatal visit',
      excerpt: 'A step-by-step guide for expecting mothers — what to bring, what to ask, and why it matters.',
      cat: 'maternal', catLabel: 'Maternal care', thumb: 'c',
      author: 'Dr. Khin Sandar', read: '6 min read', date: 'Jul 15, 2026',
      body: [
        { p: 'Your first antenatal visit should happen as early as possible in the pregnancy, ideally in the first three months. It sets a baseline for everything that follows and picks up problems while they are still easy to manage.' },
        { h: 'What to bring' },
        { ul: [
          'Any identity or health card you have, and records from earlier pregnancies.',
          'A list of medicines, supplements or traditional remedies you are taking.',
          'The date your last period started, if you remember it.',
          'A family member or friend if you would like support.'
        ] },
        { h: 'What usually happens' },
        { ul: [
          'Your weight, height and blood pressure are measured.',
          'Blood and urine tests check for anaemia, blood group, blood sugar, and infections such as hepatitis B, syphilis and HIV.',
          'The health worker estimates your due date and may arrange an ultrasound.',
          'You are offered iron and folic acid supplements, and a tetanus vaccination if it is due.'
        ] },
        { h: 'Questions worth asking' },
        { ul: [
          'Which warning signs should make me come back immediately?',
          'What should I be eating, and are my current medicines safe?',
          'Where should I plan to give birth, and how do I get there quickly if needed?',
          'When is my next visit?'
        ] },
        { h: 'Go back sooner if you notice' },
        { p: 'Bleeding, severe or constant headache, blurred vision, swelling of the face or hands, high fever, severe abdominal pain, or a noticeable drop in the baby’s movements later in pregnancy. Any of these needs same-day care.' },
        { p: 'Plan on at least eight antenatal visits across the pregnancy. Each one is short, and together they substantially reduce the risk to you and your baby.' }
      ]
    },
    {
      id: 'measure-blood-pressure-at-home',
      title: 'How to measure your blood pressure at home',
      excerpt: 'Home readings are more reliable than a single clinic check — if you take them the right way.',
      cat: 'chronic', catLabel: 'Chronic care', thumb: 'b',
      author: 'Dr. Aung Ko Latt', read: '4 min read', date: 'Jul 10, 2026',
      body: [
        { p: 'Blood pressure rises and falls through the day, so one reading at a clinic can be misleading. Measuring at home, in the same way each time, gives your health worker a much clearer picture.' },
        { h: 'Before you measure' },
        { ul: [
          'Avoid coffee, tea, smoking and exercise for 30 minutes beforehand.',
          'Empty your bladder — a full bladder raises the reading.',
          'Sit quietly for five minutes first.'
        ] },
        { h: 'How to sit' },
        { ul: [
          'Sit with your back supported and both feet flat on the floor; do not cross your legs.',
          'Rest your arm on a table so the cuff is level with your heart.',
          'Put the cuff on bare skin, not over a sleeve, snug enough for one finger to fit underneath.',
          'Stay still and do not talk while the machine is working.'
        ] },
        { h: 'What to record' },
        { p: 'Take two readings a minute apart and write down both, along with the date and time. Measure in the morning before medicine and again in the evening, for about a week before a clinic appointment.' },
        { h: 'What the numbers mean' },
        { p: 'For most adults a home reading below 135/85 is the usual target, but your own target may differ — ask your health worker. One high reading is not a diagnosis; the pattern over days is what matters.' },
        { p: 'Seek care the same day for a reading of 180/120 or above, especially with chest pain, breathlessness, severe headache, weakness on one side of the body or trouble speaking.' }
      ]
    },
    {
      id: 'safe-water-and-handwashing',
      title: 'Safe water and handwashing at home',
      excerpt: 'The two cheapest habits that prevent diarrhoea, typhoid and hepatitis A in the household.',
      cat: 'prevention', catLabel: 'Prevention', thumb: 'c',
      author: 'Ma Thida Win', read: '4 min read', date: 'Jul 5, 2026',
      body: [
        { p: 'Most stomach infections spread through water and unwashed hands. Handwashing with soap alone cuts diarrhoea cases dramatically, and it costs almost nothing.' },
        { h: 'Wash hands at the moments that matter' },
        { ul: [
          'Before preparing food, before eating, and before feeding a child.',
          'After using the toilet and after cleaning a child.',
          'After handling rubbish, animals or raw meat and fish.'
        ] },
        { p: 'Use soap and rub all surfaces — palms, backs, between the fingers, thumbs and nails — for about 20 seconds, then rinse with running water and air dry. Plain soap works as well as antibacterial soap.' },
        { h: 'Make drinking water safe' },
        { ul: [
          'Boil water and keep it at a rolling boil for one minute.',
          'Or treat it with chlorine tablets or drops, following the packet instructions.',
          'Store treated water in a clean, covered container and pour rather than dipping cups into it.'
        ] },
        { h: 'Handling food' },
        { ul: [
          'Wash fruit and vegetables with safe water, and peel where you can.',
          'Cook meat, fish and eggs thoroughly, and reheat leftovers until steaming hot.',
          'Keep raw and cooked food on separate boards and plates.'
        ] },
        { p: 'If someone has diarrhoea, keep giving fluids and oral rehydration solution. Seek care if there is blood in the stool, a high fever, repeated vomiting, or signs of dehydration such as sunken eyes, very little urine, or drowsiness — especially in young children and older adults.' }
      ]
    },
    {
      id: 'hot-season-heat-safety',
      title: 'Staying safe through the hot season',
      excerpt: 'Who is most at risk from heat, how to recognise heat exhaustion, and what to do first.',
      cat: 'wellness', catLabel: 'Wellness', thumb: '',
      author: 'Dr. Nyi Nyi Soe', read: '5 min read', date: 'Jun 28, 2026',
      body: [
        { p: 'Heat becomes dangerous long before anyone collapses. Outdoor workers, older adults, pregnant women, young children and people with heart, kidney or lung conditions are affected first.' },
        { h: 'Reduce the load on your body' },
        { ul: [
          'Drink water through the day rather than waiting until you feel thirsty.',
          'Do heavy work early in the morning or after sunset, and rest in shade regularly.',
          'Wear loose, light-coloured clothing and a hat outdoors.',
          'Never leave a child or an older person in a parked vehicle, even briefly.'
        ] },
        { h: 'Heat exhaustion — act early' },
        { p: 'Heavy sweating, cool clammy skin, headache, dizziness, nausea, weakness and muscle cramps. Move the person to a cool place, loosen clothing, cool the skin with damp cloths or a fan, and give sips of water or oral rehydration solution. They should feel better within about 30 minutes.' },
        { h: 'Heat stroke — a medical emergency' },
        { p: 'Very hot skin that may be dry, a body temperature above 40°C, confusion, slurred speech, seizures or loss of consciousness. Call an ambulance on 192 immediately. While waiting, move the person into shade, remove outer clothing and cool them aggressively with water and fanning. Do not give fluids by mouth to someone who is not fully awake.' },
        { p: 'If you take medicine for blood pressure or heart problems, ask your health worker whether your dose needs adjusting during the hottest months.' }
      ]
    }
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

  /* ---------- Health Articles listing page ---------- */
  var aGrid = byId('articleGrid');
  if (aGrid) {
    var aState = { query: param('q'), category: param('cat') || 'all' };
    var aSearch = byId('articleSearch');
    var aChips = byId('articleChips');
    var aCount = byId('articleCount');
    var aWord = byId('articleWord');
    var aEmpty = byId('articleEmpty');

    if (aSearch) { aSearch.value = aState.query; }

    articleCats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mc-chip';
      b.textContent = c.label;
      b.setAttribute('data-cat', c.id);
      b.addEventListener('click', function () { aState.category = c.id; renderArticles(); });
      aChips.appendChild(b);
    });

    var renderArticles = function () {
      var q = aState.query.trim().toLowerCase();
      var cat = aState.category;
      var filtered = articles.filter(function (a) {
        var hay = (a.title + ' ' + a.excerpt + ' ' + a.catLabel).toLowerCase();
        var nameMatch = !q || hay.indexOf(q) !== -1;
        var catMatch = cat === 'all' || a.cat === cat;
        return nameMatch && catMatch;
      });
      aGrid.innerHTML = filtered.map(function (a) {
        return '<div class="col-md-6 col-lg-4">' +
          '<a href="article.html?id=' + encodeURIComponent(a.id) + '" class="mc-article d-block text-decoration-none text-reset">' +
          '<div class="mc-article-thumb ' + a.thumb + '"><span class="badge-cat">' + esc(a.catLabel) + '</span></div>' +
          '<div class="mc-article-body">' +
          '<h3>' + esc(a.title) + '</h3>' +
          '<p>' + esc(a.excerpt) + '</p>' +
          '<div class="mc-article-meta"><span>' + esc(a.author) + '</span><span class="sep"></span>' +
          '<span>' + esc(a.read) + '</span><span class="sep"></span><span>' + esc(a.date) + '</span></div>' +
          '</div></a></div>';
      }).join('');
      aCount.textContent = filtered.length;
      aWord.textContent = filtered.length === 1 ? 'article' : 'articles';
      aEmpty.style.display = filtered.length === 0 ? 'block' : 'none';
      Array.prototype.forEach.call(aChips.children, function (b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
    };

    if (aSearch) {
      aSearch.addEventListener('input', function (e) { aState.query = e.target.value; renderArticles(); });
    }
    renderArticles();
  }

  /* ---------- Single article reader (article.html?id=…) ---------- */
  var artBody = byId('articleBody');
  if (artBody) {
    var wanted = param('id');
    var article = articles.filter(function (a) { return a.id === wanted; })[0];
    var artMain = byId('articleMain');
    var artMissing = byId('articleMissing');

    if (!article) {
      // Unknown or missing id — show the fallback instead of an empty shell.
      if (artMain) { artMain.style.display = 'none'; }
      if (artMissing) { artMissing.style.display = 'block'; }
    } else {
      document.title = article.title + ' — MedCare';
      byId('articleTag').textContent = article.catLabel;
      byId('articleTitle').textContent = article.title;
      byId('articleCrumb').textContent = article.title;
      byId('articleLede').textContent = article.excerpt;
      byId('articleByline').innerHTML =
        '<span>' + esc(article.author) + '</span><span class="sep"></span>' +
        '<span>' + esc(article.read) + '</span><span class="sep"></span>' +
        '<span>' + esc(article.date) + '</span>';

      artBody.innerHTML = article.body.map(function (block) {
        if (block.h) { return '<h2 class="mc-article-h2">' + esc(block.h) + '</h2>'; }
        if (block.ul) {
          return '<ul class="mc-list sym">' + block.ul.map(function (li) {
            return '<li><i class="bi bi-dot"></i><span>' + esc(li) + '</span></li>';
          }).join('') + '</ul>';
        }
        return '<p>' + esc(block.p) + '</p>';
      }).join('');

      // "More articles" — three others, newest first as authored.
      var more = byId('articleMore');
      if (more) {
        more.innerHTML = articles.filter(function (a) { return a.id !== article.id; })
          .slice(0, 3).map(function (a) {
            return '<div class="col-md-6 col-lg-4">' +
              '<a href="article.html?id=' + encodeURIComponent(a.id) + '" class="mc-article d-block text-decoration-none text-reset">' +
              '<div class="mc-article-thumb ' + a.thumb + '"><span class="badge-cat">' + esc(a.catLabel) + '</span></div>' +
              '<div class="mc-article-body"><h3>' + esc(a.title) + '</h3>' +
              '<div class="mc-article-meta"><span>' + esc(a.read) + '</span><span class="sep"></span><span>' + esc(a.date) + '</span></div>' +
              '</div></a></div>';
          }).join('');
      }
    }
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

    var pharmTowns = pharmacies.map(function (p) { return p.township; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();

    pTownship.innerHTML = '<option value="all">All townships</option>' +
      pharmTowns.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    if (pharmTowns.indexOf(pState.township) === -1) { pState.township = 'all'; }
    pTownship.value = pState.township;
    if (pSearch) { pSearch.value = pState.query; }
    pTownship.addEventListener('change', function (e) { pState.township = e.target.value; renderPharmacies(); });

    pharmTypeMeta.forEach(function (tm) {
      var count = pharmacies.filter(function (p) { return p.type === tm.id; }).length;
      var label = document.createElement('label');
      label.className = 'mc-check';
      label.innerHTML = '<input type="checkbox" checked><span>' + esc(tm.label) + '</span><span class="cnt">' + count + '</span>';
      var input = label.querySelector('input');
      input.setAttribute('data-type', tm.id);
      input.addEventListener('change', function () { pState.types[tm.id] = input.checked; renderPharmacies(); });
      pTypes.appendChild(label);
    });

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

    var renderPharmacies = function () {
      var q = pState.query.trim().toLowerCase();
      var filtered = pharmacies.filter(function (p) {
        var townOK = pState.township === 'all' || p.township === pState.township;
        var typeOK = !!pState.types[p.type];
        var svcOK = (!pState.services.open24 || p.open24) && (!pState.services.delivery || p.delivery);
        var hay = (p.name + ' ' + p.township + ' ' + p.address).toLowerCase();
        var searchOK = !q || hay.indexOf(q) !== -1;
        return townOK && typeOK && svcOK && searchOK;
      });
      var pharmTypeLabel = { chain: 'Chain pharmacy', independent: 'Independent', hospital: 'Hospital pharmacy' };
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
