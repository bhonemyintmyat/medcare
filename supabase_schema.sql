-- ============================================================
-- MedCare — `diseases` table
-- Run this whole file in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: it drops and recreates the table.
-- ============================================================


-- ---------- 1. TABLE ----------

drop table if exists public.diseases;

create table public.diseases (
  id         bigint generated always as identity primary key,
  name       text        not null,
  "desc"     text        not null,
  icon       text        not null,
  tag        text        not null,
  cat        text        not null,
  href       text        not null unique,
  created_at timestamptz not null default now()
);

comment on table  public.diseases is 'Disease cards shown on common-diseases.html';
comment on column public.diseases."desc" is 'Short plain-language summary shown on the card';
comment on column public.diseases.cat  is 'Space-separated filter categories, e.g. "infectious respiratory"';


-- ---------- 2. ROW LEVEL SECURITY ----------
-- Without this, your anon key gets back an EMPTY array — not an error.
-- RLS on + a read policy = public can read, nobody can write.

alter table public.diseases enable row level security;

create policy "Public can read diseases"
  on public.diseases
  for select
  to anon, authenticated
  using (true);

-- Deliberately NO insert/update/delete policy: with RLS enabled and no
-- write policy, writes from the browser are refused. Edit rows in the
-- dashboard (which uses the service_role key server-side) instead.


-- ---------- 3. YOUR 12 DISEASES ----------
-- Insert order = display order, preserved via the `id` column.

insert into public.diseases (name, icon, tag, cat, href, "desc") values
  ('Hypertension',           'bi-heart-pulse',      'Chronic',     'chronic',                'diseases/hypertension.html', 'High blood pressure often has no symptoms but raises the risk of stroke and heart disease over time.'),
  ('Diabetes',               'bi-droplet-half',     'Chronic',     'chronic',                'diseases/diabetes.html',     'A long-term condition where blood sugar levels are too high, manageable with diet, exercise, and medication.'),
  ('Asthma',                 'bi-lungs',            'Respiratory', 'respiratory',            'diseases/asthma.html',       'Airways narrow and swell, causing wheezing and shortness of breath — usually controlled with inhalers.'),
  ('Dengue fever',           'bi-bug',              'Infectious',  'infectious',             'diseases/dengue.html',       'A mosquito-borne viral illness common in the rainy season, causing high fever, body aches, and rash.'),
  ('Tuberculosis (TB)',      'bi-clipboard2-pulse', 'Infectious',  'infectious respiratory', 'diseases/tb.html',           'A bacterial infection mainly affecting the lungs, treatable with a full course of antibiotics.'),
  ('Malaria',                'bi-thermometer-half', 'Infectious',  'infectious',             'diseases/malaria.html',      'A mosquito-borne parasitic disease that causes cyclic fever and chills; preventable with nets and repellents.'),
  ('Hepatitis B',            'bi-shield-plus',      'Infectious',  'infectious',             'diseases/hepatitis.html',    'A liver infection that can become long-term; a safe vaccine prevents it and testing catches it early.'),
  ('Coronary heart disease', 'bi-heart',            'Chronic',     'chronic',                'diseases/coronary.html',     'Narrowed arteries reduce blood flow to the heart and can cause chest pain or a heart attack.'),
  ('Stroke',                 'bi-brain',            'Chronic',     'chronic',                'diseases/stroke.html',       'A sudden interruption of blood to the brain — act fast; call an ambulance if you notice F.A.S.T. signs.'),
  ('Anemia',                 'bi-droplet',          'Chronic',     'chronic maternal',       'diseases/anemia.html',       'Low red blood cell counts cause fatigue and weakness; iron-rich foods and supplements often help.'),
  ('Typhoid fever',          'bi-cup-hot',          'Infectious',  'infectious',             'diseases/typhoid.html',      'A bacterial infection spread through contaminated food or water — safe hygiene and vaccination help prevent it.'),
  ('Pre-eclampsia',          'bi-person-heart',     'Maternal',    'maternal',               'diseases/eclampsia.html',    'A pregnancy complication with high blood pressure — regular antenatal check-ups are essential.');


-- ---------- 4. CHECK IT WORKED ----------
-- Should return 12 rows in the same order as your old array.

select id, name, tag, cat, href, "desc" from public.diseases order by id;
