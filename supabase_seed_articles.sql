-- ============================================================
-- MedCare — articles, carried across from script.js
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql. Safe to re-run.
--
-- GENERATED, NOT TYPED. Read out of the myArticles array and evaluated,
-- so both languages arrive exactly as written. Burmese especially:
-- retyping it invites a stacked consonant to come apart, and nothing
-- about the result would look wrong in a diff.
--
-- Both languages sit in the row because article prose is not translated
-- through the dictionary in script.js the way interface text is — the
-- page picks .mc-en or .mc-my. So title_my and excerpt_my are content,
-- not translations of a key.
--
-- SOURCE URLs ARE ALL NULL, and that is the thing to notice. The
-- project rule is that medical content carries a WHO or Ministry of
-- Health URL; not one of these 10 articles has one, because the array
-- never had a field for it. The constraint permits null so the
-- migration does not fail, but each of these needs a source added
-- before it is re-published through the editorial workflow.
--
-- They land as PUBLISHED because they are already live on the site.
-- ============================================================

insert into public.articles
  (title, title_my, excerpt, excerpt_my, cat, href, thumb, byline, byline_my, status)
select v.title, v.title_my, v.excerpt, v.excerpt_my, v.cat, v.href, v.thumb,
       v.byline, v.byline_my, 'published'
from (values
  ('Eating well for a healthier life',
   'ကျန်းမာရေးနှင့် ညီညွတ်သော အစားအသောက်များ',
   'Balanced, nourishing meals strengthen your immune system and help keep long-term illness away.',
   'အာဟာရပြည့်ဝသော အစားအစာများကို မျှတစွာ စားသုံးခြင်းဖြင့် ကိုယ်ခံစွမ်းအားကို မြင့်တက်စေပြီး ရောဂါဘယများကို ကာကွယ်နိုင်ပါသည်။',
   'nutrition',
   'healthyfood.html',
   'images/healthyfood.jpg',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Managing stress and looking after your mental health',
   'စိတ်ဖိစီးမှု လျှော့ချခြင်းနှင့် စိတ်ကျန်းမာရေး',
   'Mindfulness and regular rest go a long way towards easing the pressures of everyday life.',
   'နေ့စဉ်ဘဝတွင် ကြုံတွေ့နေရသော စိတ်ဖိစီးမှုများကို လျှော့ချရန်အတွက် တရားထိုင်ခြင်းနှင့် အပန်းဖြေခြင်းတို့က များစွာအထောက်အကူပြုပါသည်။',
   'wellness',
   'mentalhealth.html',
   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Physical activity and heart health',
   'ကိုယ်လက်လှုပ်ရှားမှုနှင့် နှလုံးကျန်းမာရေး',
   'About 30 minutes of walking or exercise a day strengthens the heart muscle and improves circulation.',
   'တစ်နေ့လျှင် မိနစ် ၃၀ ခန့် လမ်းလျှောက်ခြင်း၊ လေ့ကျင့်ခန်းလုပ်ခြင်းသည် နှလုံးကြွက်သားများကို သန်စွမ်းစေပြီး သွေးလှည့်ပတ်မှုကို ကောင်းမွန်စေပါသည်။',
   'wellness',
   'heartandex.html',
   'images/hearthealth.jpg',
   'Dr. Aung Min',
   'Dr. Aung Min'),

  ('Why enough sleep matters',
   'လုံလောက်သော အိပ်စက်ချိန်၏ အရေးပါပုံ',
   'Sleeping well sharpens memory and restores the energy your body spends through the day.',
   'ကောင်းမွန်စွာ အိပ်စက်ခြင်းက မှတ်ဉာဏ်စွမ်းရည်ကို တိုးတက်စေပြီး ခန္ဓာကိုယ်အားအင်ကို ပြန်လည်ပြည့်ဖြိုးစေပါသည်။',
   'wellness',
   'sleep.html',
   'images/sleep%20copy.jpg',
   'Dr. Aung Min',
   'Dr. Aung Min'),

  ('The benefits of drinking enough water',
   'ရေလုံလောက်စွာ သောက်သုံးခြင်း၏ အကျိုးကျေးဇူးများ',
   'Water makes up most of the body and flushes out waste. Aim for at least eight glasses a day.',
   'ရေသည် ခန္ဓာကိုယ်၏ အဓိက အစိတ်အပိုင်းဖြစ်ပြီး အဆိပ်အတောက်များကို ဖယ်ရှားပေးပါသည်။ တစ်နေ့လျှင် ရေ ၈ ခွက် အနည်းဆုံး သောက်သုံးသင့်ပါသည်။',
   'wellness',
   'hydration.html',
   'images/hydration.jpg',
   'Dr. May Thida',
   'Dr. May Thida'),

  ('Looking after your eyes in a screen-filled world',
   'မျက်စိကျန်းမာရေးအတွက် ဂရုစိုက်သင့်သည့် အချက်များ',
   'With so much time on phones and computers, the 20-20-20 rule is a simple way to ease eye strain.',
   'ဖုန်းနှင့် ကွန်ပျူတာ အကြည့်များသည့် ယနေ့ခေတ်တွင် 20-20-20 rule ကို ကျင့်သုံးခြင်းဖြင့် မျက်စိညောင်းညာမှုကို လျှော့ချနိုင်ပါသည်။',
   'prevention',
   'eyehealth.html',
   'images/eyecare.jpg',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Mouth and dental health',
   'ခံတွင်းနှင့် သွားကျန်းမာရေး',
   'Flossing matters as much as brushing, and a check-up every six months catches trouble early.',
   'သွားတိုက်ခြင်းသာမက သွားကြားထိုးကြိုး (Floss) အသုံးပြုခြင်းသည်လည်း မရှိမဖြစ်လိုအပ်ပါသည်။ ခြောက်လတစ်ကြိမ် ပုံမှန်ပြသသင့်ပါသည်။',
   'prevention',
   'oralhealth.html',
   'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Personal hygiene and preventing infection',
   'တစ်ကိုယ်ရည် သန့်ရှင်းရေးနှင့် ရောဂါကာကွယ်ခြင်း',
   'Washing your hands properly and often is one of the cheapest, most effective ways to stop infection.',
   'လက်ကို ဆပ်ပြာဖြင့် စနစ်တကျ မကြာခဏ ဆေးကြောခြင်းသည် ကူးစက်ရောဂါများကို ကာကွယ်ရန် အထိရောက်ဆုံး နည်းလမ်းတစ်ခု ဖြစ်ပါသည်။',
   'prevention',
   'hygiene.html',
   'images/hygene.jpg',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Good posture and back pain',
   'မှန်ကန်သော ကိုယ်နေဟန်ထားနှင့် ခါးနာခြင်း',
   'If you sit for work, how you hold your back and spine matters. Stretching keeps back pain away.',
   'အထိုင်များသော အလုပ်လုပ်သူများအနေဖြင့် ခါးနှင့် ကျောရိုး အနေအထားမှန်ကန်ရန် ဂရုပြုသင့်ပါသည်။ အကြောဆန့် လေ့ကျင့်ခန်းများက ခါးနာခြင်းမှ ကင်းဝေးစေပါသည်။',
   'wellness',
   'posture.html',
   'images/posture.jpg',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့'),

  ('Regular health check-ups',
   'ကျန်းမာရေး ပုံမှန်စစ်ဆေးခြင်း (Medical Checkup)',
   'Even with no symptoms, a check-up once a year finds problems while they are still easy to treat.',
   'ရောဂါလက္ခဏာ မပြသော်လည်း တစ်နှစ်လျှင် တစ်ကြိမ်ခန့် ပုံမှန်စစ်ဆေးမှု ခံယူခြင်းဖြင့် ရောဂါများကို ကြိုတင်သိရှိနိုင်ပါသည်။',
   'prevention',
   'medicalcheckup.html',
   'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
   'MedCare editorial team',
   'MedCare တည်းဖြတ်အဖွဲ့')
) as v(title, title_my, excerpt, excerpt_my, cat, href, thumb, byline, byline_my)
-- href is unique on the table, so it is also what identifies a row that
-- has already been carried across.
where not exists (
  select 1 from public.articles a where a.href = v.href
);


-- ---------- CHECKS ----------

-- Expect 10 rows, all published, all with Burmese.
select count(*) as total,
       count(*) filter (where status = 'published') as published,
       count(*) filter (where title_my is not null and excerpt_my is not null) as bilingual,
       count(*) filter (where source_url is not null) as with_source
from public.articles;

-- Categories in use. These must match the chips myArticleCats builds,
-- or an article becomes unreachable through the filter bar:
--   prevention, nutrition, wellness
select cat, count(*) from public.articles group by cat order by cat;

-- The articles still missing a source URL — the whole list, for now.
select id, title from public.articles where source_url is null order by id;

-- Read a couple back to compare against articles.html by eye.
select title, title_my, cat, href from public.articles order by id limit 3;
