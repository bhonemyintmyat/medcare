-- ============================================================
-- MedCare — hospitals, carried across from script.js
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql. Safe to re-run.
--
-- GENERATED, NOT TYPED. Every row below was read out of the hospitals
-- array in script.js and evaluated by JavaScript, so the names,
-- addresses and phone numbers are byte-for-byte what the site already
-- serves — including the typographic apostrophes in names like
-- Yangon Children's Hospital. Retyping 65 rows by hand is how a
-- township ends up misspelled or a digit ends up dropped.
--
-- They land as PUBLISHED because they are already live on the site.
-- created_by stays null, which is what marks a row as pre-dating the
-- editors: the stamp trigger fills it on every write from now on.
--
-- The phone numbers here are copied, NOT verified. They are the numbers
-- hospitals.html has been showing. Checking them against a current
-- source is worth doing before anyone relies on this table.
--
-- TWO THINGS THE SOURCE DATA CARRIES, both left visible rather than
-- quietly cleaned up:
--
--   * 54 of the 65 rows have no phone number. The array holds the
--     string "N/A" for them; that is stored here as NULL, because a
--     column holding "N/A" reads as something you could dial. Only
--     11 rows carry a real number.
--
--   * "Yangon Children's Hospital" appears TWICE for Sanchaung, with
--     two different addresses, and the two spellings differ only by
--     which apostrophe character they use. Both are inserted, because
--     both are on the live site today and picking a winner is an
--     editorial decision, not a migration one. Merge them in the admin
--     UI once it exists.
-- ============================================================

insert into public.hospitals (name, type, township, address, phone, hours, er, status)
select v.name, v.type, v.township, v.address, v.phone, v.hours, v.er, 'published'
from (values
  ('Yangon General Hospital', 'general', 'Latha', 'Bogyoke Aung San Rd, Latha', '01-256112', 'Open 24 hours', true),
  ('North Okkalapa General Hospital', 'general', 'North Okkalapa', 'Thudhamma Rd, North Okkalapa', '01-9699277', 'Open 24 hours', true),
  ('Yangon Children’s Hospital', 'specialist', 'Sanchaung', 'Halpin Rd, Sanchaung', '01-222807', 'Open 24 hours', true),
  ('Central Women’s Hospital', 'specialist', 'Dagon', 'Min Ye Kyaw Swa Rd, Dagon', '01-221015', 'Open 24 hours', false),
  ('Grand Hantha International Hospital', 'general', 'Kamayut', 'Corner of Nar Nat Taw Street and Lower Kyimyindaing Road, Kamayut Township, Yangon', '01-9666141', 'Open 24 hours', true),
  ('Pun Hlaing Siloam Hospital', 'general', 'Hlaing Tharyar', 'Pun Hlaing Estate Ave, Hlaing Tharyar', '01-3684323', 'Open 24 hours', true),
  ('Yangon Eye, Ear, Nose & Throat Hospital', 'specialist', 'Lanmadaw', 'Lanmadaw St, Lanmadaw', '01-224647', 'Mon–Fri, 8:00–16:00', false),
  ('Victoria Hospital', 'general', 'Kamayut', 'Kanbe Rd, Kamayut', '01-9666141', 'Open 24 hours', true),
  ('Yankin Children Hospital', 'specialist', 'Yankin', 'Sayarsan Rd, Yankin', '01-578140', 'Open 24 hours', true),
  ('Workers’ Hospital (Yangon)', 'general', 'Yankin', 'New University Ave Rd, Yankin', '01-550149', 'Open 24 hours', false),
  ('Hlaing Tharyar General Hospital', 'general', 'Hlaing Tharyar', 'Corner of Yangon-Pathein Road & Kyansittha Road, Ward       3, Hlaing Tharyar Township, Yangon', null, 'Open 24 hours', true),
  ('Asia Royal Clinic - Hlaing Tharyar', 'clinic', 'Hlaing Tharyar', 'Yangon-Pathein Road, Hlaing Tharyar Township, Yangon', null, 'Regular Hours', false),
  ('Workers'' Hospital - Hlaing Tharyar', 'general', 'Hlaing Tharyar', 'Industrial Zone Main Road, Hlaing Tharyar Township, Yangon', null, 'Open 24 hours', true),
  ('Inya Lake Hospital & Medical Center / International SOS Clinic', 'specialist', 'Hlaing', 'No. 37, Kaba Aye Pagoda Road (Inya Lake Hotel Compound), Hlaing Township, Yangon', null, 'Open 24 hours', true),
  ('Kan Thar Yar Specialist Hospital', 'specialist', 'Hlaing', 'No. 87, Pyay Road (6 half Mile), Hlaing Township, Yangon', null, 'Regular Hours', false),
  ('Insein General Hospital', 'general', 'Insein', 'Mingyi Road, Insein Township, Yangon', null, 'Open 24 hours', true),
  ('Aung San TB & Chest Hospital', 'specialist', 'Insein', 'Aung San Ward, Insein Township, Yangon', null, 'Regular Hours', false),
  ('University Hospital / Yangon University Medical Centre', 'general', 'Kamayut', 'Yangon University Campus (Near University Avenue Road), Kamayut Township, Yangon', '01513628', 'Regular Hours', false),
  ('Shwe La Min Hospital - Lanmadaw Branch', 'general', 'Lanmadaw', 'No. 15/19, Zawgyi Street, Lanmadaw Township, Yangon', null, 'Open 24 hours', true),
  ('Yangon General Hospital - YGH', 'general', 'Lanmadaw', 'Bogyoke Aung San Road (Latha/Lanmadaw Township Border), Yangon', null, 'Open 24 hours', true),
  ('Yangon ENT Hospital', 'specialist', 'Lanmadaw', 'Corner of Ahlone Road and Min Ye Kyaw Swa Road (Lanmadaw/Ahlone Township Border), Yangon', null, 'Regular Hours', true),
  ('Yangon General Hospital - YGH', 'general', 'Latha', 'Bogyoke Aung San Road, Latha Township, Yangon', null, 'Open 24 hours', true),
  ('Muslim Free Hospital', 'general', 'Pabedan', 'Maha Bandula Road, Pabedan Township (Near Latha Township), Yangon', null, 'Regular Hours', false),
  ('OEC Polyclinic & Diagnostic Center', 'clinic', 'Latha', 'No. 91/93, Corner of Anawrahta Road and 20th Street, Latha Township, Yangon', null, 'Regular Hours', false),
  ('Win Ziwaka Diagnostic Center', 'clinic', 'Latha', 'No. 46, Bo Ywe Street (Lower Block), Latha Township, Yangon', null, 'Regular Hours', false),
  ('Victoria Hospital', 'general', 'Mayangone', 'No. 68, Taw Win Road, 9th Ward, Mayangone Township, Yangon', null, 'Open 24 hours', true),
  ('Thamine General Hospital', 'general', 'Mayangone', 'No. 12/A, Yangon-Insein Road, Thamine Junction, Mayangone Township, Yangon', null, 'Regular Hours', true),
  ('Parami General Hospital', 'specialist', 'Mayangone', 'No. 60, Parami Road, Mayangone Township, Yangon', null, 'Open 24 hours', true),
  ('Kan Thar Yar Hospital', 'specialist', 'Mayangone', 'No. 87, Pyay Road (Near Inya Lake), Mayangone Township, Yangon', null, 'Open 24 hours', true),
  ('Mingaladon Township Hospital', 'general', 'Mingaladon', 'Khayoung Street, near Pyay Road, Mingaladon Township, Yangon', null, 'Regular Hours', true),
  ('No. 1 Defence Services General Hospital (1000 Bedded)', 'general', 'Mingaladon', 'Pyay Road, Mingaladon Township, Yangon', null, 'Open 24 hours', true),
  ('No. 1 Defence Services Orthopaedic Hospital (500 Bedded)', 'specialist', 'Mingaladon', 'Pyay Road (Near No. 1 Military Hospital), Mingaladon Township, Yangon', null, 'Regular Hours', false),
  ('No. 2 Defence Services General Hospital (500 Bedded)', 'general', 'Mingaladon', 'Pyay Road, Mingaladon Township, Yangon', null, 'Regular Hours', false),
  ('Pinlon Hospital', 'specialist', 'North Dagon', 'No. 21, Corner of Pinlon Main Road and Sayar San Road, 26th Ward, North Dagon Township, Yangon', null, 'Open 24 hours', true),
  ('North Dagon General Hospital / Township Hospital', 'general', 'North Dagon', 'Bayint Naung Road, 32nd Ward, North Dagon Township, Yangon', null, 'Regular Hours', true),
  ('OSC Hospital - North Dagon / Dagon Seikkan Branch', 'specialist', 'North Dagon', 'Pyidaungsu Main Road, North Dagon / Dagon Seikkan Border, North Dagon Township, Yangon', null, 'Open 24 hours', true),
  ('North Okkalapa General and Teaching Hospital', 'general', 'North Okkalapa', 'Corner of Khemarthi Road and Thudhamma Road, (Kha) Ward, North Okkalapa Township, Yangon', null, 'Open 24 hours', true),
  ('OSC Hospital - North Okkalapa', 'specialist', 'North Okkalapa', 'Thudhamma Main Road, (Sa) Ward, North Okkalapa Township, Yangon', null, 'Open 24 hours', true),
  ('Mel Hospital', 'specialist', 'North Okkalapa', 'Thudhamma Road, North Okkalapa Township, Yangon', null, 'Regular Hours', false),
  ('Asia Royal Hospital', 'specialist', 'Sanchaung', 'No. 14, Baho Road, Sanchaung Township, Yangon', null, 'Open 24 hours', true),
  ('Sakura Hospital', 'general', 'Sanchaung', 'No. 21/23, Shin Saw Pu Road, Sanchaung Township, Yangon', null, 'Open 24 hours', true),
  ('Thukha Mingalar Medical & Diagnostic Center (Center 1)', 'clinic', 'Sanchaung', 'No. 147, Kyundaw Street, Myaytani Ward, Sanchaung Township, Yangon', null, 'Regular Hours', false),
  ('heal by Pun Hlaing Clinic - Sanchaung', 'clinic', 'Sanchaung', 'No. 31, Pyapon Street, Sanchaung Township, Yangon', null, 'Regular Hours', false),
  ('Yangon Children''s Hospital', 'specialist', 'Sanchaung', 'Corner of Pyay Road and Ahlone Road, Sanchaung Township (Kamayut/Sanchaung Border), Yangon', null, 'Open 24 hours', true),
  ('Shwe Pyi Thar Township Hospital', 'general', 'Shwe Pyi Thar', 'No. 10 Ward, Shwe Pyi Thar Township, Yangon', null, 'Regular Hours', true),
  ('Workers'' Hospital - Shwe Pyi Thar', 'general', 'Shwe Pyi Thar', 'Industrial Zone Main Road, Shwe Pyi Thar Township, Yangon', null, 'Open 24 hours', true),
  ('South Dagon Township Hospital', 'general', 'South Dagon', 'No. 57 Ward, Near Hlaing Zay Yar Road / Myawaddy Mingyi Road, South Dagon Township, Yangon', null, 'Regular Hours', true),
  ('OSC Hospital - South Dagon / Dagon Seikkan Branch', 'specialist', 'South Dagon', 'Pyidaungsu Main Road, No. 104 Ward (South Dagon / Dagon Seikkan Border), South Dagon Township, Yangon', null, 'Open 24 hours', true),
  ('Arogya Specialist Clinic & Medical Center', 'clinic', 'South Dagon', 'No. 56 Ward, Anawrahta Main Road, South Dagon Township, Yangon', null, 'Regular Hours', false),
  ('South Okkalapa Women and Children Hospital', 'specialist', 'South Okkalapa', 'Corner of Thamin Ba Yan Road and Thumingalar Road, 6th Ward, South Okkalapa Township, Yangon', null, 'Open 24 hours', true),
  ('Aryu International Hospital', 'general', 'South Okkalapa', 'No. 40, Kyaik Ka San Road (Near Thuwunna Roundabout), 1st Ward, South Okkalapa Township, Yangon', null, 'Open 24 hours', true),
  ('SSC Specialist Hospital - South Okkalapa Branch', 'specialist', 'South Okkalapa', 'Thumingalar Main Road, 7th Ward, South Okkalapa Township, Yangon', null, 'Open 24 hours', true),
  ('Tamwe Township Hospital', 'general', 'Tamwe', 'Kyaikkasan Road, Tamwe Township, Yangon', null, 'Regular Hours', true),
  ('Aryu General Hospital', 'general', 'Tamwe', 'No. 137, Kyaikkasan Road, Tamwe Township, Yangon', null, 'Open 24 hours', true),
  ('Aslanta Hospital / SSC Hospital', 'specialist', 'Tamwe', 'No. 149, Kyaikkasan Road, Tamwe Township, Yangon', null, 'Open 24 hours', true),
  ('No. 1 Workers'' Hospital - Tamwe', 'general', 'Tamwe', 'Kyaikkasan Road, Corner of Natmauk Road, Tamwe Township, Yangon', null, 'Regular Hours', false),
  ('Thaketa General Hospital', 'general', 'Thaketa', '7/West Ward, Near Ayeyarwun Road, Thaketa Township, Yangon', null, 'Regular Hours', true),
  ('OSC Hospital', 'specialist', 'Thaketa', 'No. 59/60, Ayeyarwun Main Road, 7/East Ward, Thaketa Township, Yangon', null, 'Open 24 hours', true),
  ('SSC Women and Children Hospital - Thaketa Branch', 'specialist', 'Thaketa', 'Ayeyarwun Road, Thaketa Township, Yangon', null, 'Regular Hours', false),
  ('Thingangyun San Pya General Hospital', 'general', 'Thingangyun', 'Hlaing Zay Yar Road, 2nd Ward, Thingangyun Township, Yangon', null, 'Open 24 hours', true),
  ('AYA Hospital', 'specialist', 'Thingangyun', 'No. 59/A, Lay Daung Kan Road, 2nd Ward, Thingangyun Township, Yangon', null, 'Open 24 hours', true),
  ('Pinlon Hospital', 'specialist', 'Thingangyun', 'Corner of Pinlon Road and Sayar San Road, 26th Ward (North Dagon / Thingangyun Border), Yangon', null, 'Open 24 hours', true),
  ('Yankin Children''s Hospital', 'specialist', 'Yankin', 'Kanbe Road, 16th Ward, Yankin Township, Yangon', null, 'Open 24 hours', true),
  ('Specialist Hospital - Yankin / Yankin Chest Hospital', 'specialist', 'Yankin', 'Yankin Road, 1st Ward, Yankin Township, Yangon', null, 'Regular Hours', false),
  ('Melia Clinic & Specialist Clinics', 'clinic', 'Yankin', 'Kanbe Road / Near Kaba Aye Pagoda Road, Yankin Township, Yangon', null, 'Regular Hours', false)
) as v(name, type, township, address, phone, hours, er)
-- Re-runnable: a hospital already carried across is left alone rather
-- than duplicated. Name plus township is the pair that identifies one,
-- since a chain can have branches in two townships.
where not exists (
  select 1 from public.hospitals h
  where h.name = v.name and h.township = v.township
);


-- ---------- CHECKS ----------

-- Expect 65 rows, all published.
select count(*) as total,
       count(*) filter (where status = 'published') as published,
       count(*) filter (where er) as with_emergency_room
from public.hospitals;

-- The types in use, which must all satisfy hospitals_type_check.
select type, count(*) from public.hospitals group by type order by type;

-- Anything missing a phone number is worth knowing about.
select name, township from public.hospitals where phone is null order by name;

-- Read back a few, to compare against hospitals.html by eye.
select name, township, phone, hours, er from public.hospitals order by id limit 5;
