-- ============================================================
-- MedCare — the disease prose, moved into the database
-- Applied to the live project on 2026-08-28.
--
-- WHAT HAPPENED
--
-- All twelve `diseases` rows had an empty `body`. The prose existed only
-- in the hand-written files under diseases/, and the row beside each one
-- held just the card and an `href` pointing at the file. So `pageHref()`
-- in script.js sent every reader to the file, and read.html redirected
-- to it as well: the reader page for a condition was unreachable.
--
-- This filled `body` for all twelve, from the files themselves.
--
-- WHY THERE IS NO CONTENT IN THIS FILE
--
-- The text was not typed here. It was extracted by the editor's own
-- import module — editor/js/editor-import.js — which is the same code
-- path an editor triggers by opening a condition in entry.html. Doing it
-- any other way would have produced content that differs from what the
-- editor would have written, and the difference would only surface the
-- first time somebody pressed Save.
--
-- The extraction is therefore reproducible from the repository rather
-- than frozen into a migration:
--
--     MedCareImport.fromPage('diseases/dengue.html')  ->  { en, my }
--
-- with whitespace collapsed (`\s+` -> ' ', then '>\s+<' -> '><'), which
-- is safe here because none of the twelve contain <pre> or <code>, the
-- only allowlisted tags where whitespace is significant.
--
-- `body_my` was deliberately left empty. The disease pages carry no
-- .mc-my markup — there is no Burmese prose to find — and writing the
-- English into it would make twelve rows claim a translation nobody
-- wrote. read.html shows its "written in English only" notice instead,
-- which is the truth.
--
-- WHO RAN IT
--
-- guard_publish() refuses `published` -> `published` edits from anyone
-- who is not an admin: changing what a reader already sees is the same
-- act as publishing, and the approval step is worthless if it can be
-- reached by rewriting a live page instead. The updates were therefore
-- run with request.jwt.claims set to the admin account, at the owner's
-- explicit instruction, so the trigger saw a real admin rather than an
-- anonymous service connection. The guard was never disabled.
--
-- WHAT THIS CHANGED FOR READERS
--
-- `pageHref()` prefers `body` over `href`, so all twelve cards on
-- common-diseases.html now open read.html instead of the hand-written
-- page. The files are still in the repository and still reachable by
-- direct URL; nothing links to them any more.
--
-- That is a real trade. The hand-written pages are Bootstrap accordions
-- with callouts and styled lists; the allowlist has no <button> and
-- strips class attributes, so what read.html renders is the same words
-- as flat prose — four <h2> sections, their lists, and the closing
-- "When to see a doctor". Better in that it is editable without a
-- deployment; plainer in that the accordion is gone.
-- ============================================================


-- ---------- 1. CHECKS ----------

-- Twelve rows, all with a body, none carrying the accordion's standing
-- "Learn more" label (see the strip list in editor-import.js).
select count(*)                                             as total,
       count(*) filter (where coalesce(btrim(body),'') <> '') as with_body,
       count(*) filter (where body like '%Learn more%')       as with_chrome,
       count(*) filter (where coalesce(btrim(body_my),'') <> '') as with_burmese
from public.diseases;
-- expected: 12 | 12 | 0 | 0

-- Each should have its four section headings and a closing h3.
select id, name,
       length(body)                                        as body_len,
       (length(body) - length(replace(body, '<h2>', ''))) / 4 as h2_count,
       (length(body) - length(replace(body, '<h3>', ''))) / 4 as h3_count
from public.diseases
order by id;
-- expected: h2_count = 4 and h3_count = 1 on every row

-- Nothing should have been taken off the site by this.
select status, count(*) from public.diseases group by status;
-- expected: published | 12


-- ---------- 2. ROLLBACK ----------
--
-- Every one of the twelve was empty before this ran, so undoing it is
-- not a restore — it is simply emptying them again. `pageHref()` then
-- falls straight back to `href` and all twelve cards point at the
-- hand-written pages exactly as they did before.
--
-- Needs an admin for the same reason the migration did.
--
--     update public.diseases set body = null;
--
-- To drop a single condition back to its file:
--
--     update public.diseases set body = null where id = 4;
