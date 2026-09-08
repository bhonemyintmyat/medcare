# MedCare

Health information for Myanmar, in Burmese and English. MedCare is a
static, no-build website backed by Supabase: the public side is plain
reading — disease pages, health articles, a hospital and pharmacy
directory, emergency contacts, a BMI calculator — and behind a login sit
an editor desk for writing and translating that content and an admin area
for managing staff, permissions and reports.

It is built for readers on slow connections and modest phones, and for
the small team that keeps the content current.

![Static site](https://img.shields.io/badge/site-static%20HTML%2FCSS%2FJS-informational)
![No build step](https://img.shields.io/badge/build-none-brightgreen)
![Backend](https://img.shields.io/badge/backend-Supabase-3ecf8e)
![Languages](https://img.shields.io/badge/languages-English%20%7C%20Burmese-blue)

> There is no CI pipeline in this repository, so there are no build or
> coverage badges to show — the ones above describe the stack, not a
> passing run.

## 🛠️ Prerequisites

You need very little to read the site, and a bit more to change the parts
that talk to Supabase.

**To run the site locally**

* Any static file server. One of:
  * Python 3.6+ — `python -m http.server`
  * Node.js 18+ — `npx http-server`
  * VS Code with the Live Server extension (`.vscode/launch.json` already
    points a Chrome debug session at `http://localhost:8080`)
* A modern browser: Chrome, Edge, Firefox or Safari, current version.

Opening the `.html` files straight off disk (`file://`) mostly works, but
some pages fetch other files and browsers block that on `file://` — use a
server.

**To change the database or the edge function**

* A [Supabase](https://supabase.com) project — the free tier is enough.
* [Supabase CLI](https://supabase.com/docs/guides/cli) 1.x or newer, for
  deploying the edge function.
* [Deno](https://deno.com) 1.40+, only if you want to type-check or run
  `supabase/functions/invite-staff/index.ts` locally.
* SMTP credentials configured on the Supabase project, so invitation and
  password-reset mail actually sends. MedCare uses Brevo.

**To run the one test**

* Node.js 18+ and a scratch directory you can `npm install linkedom` into.
  The repository has no `package.json` and is not meant to grow one.

## 📦 Installation

Clone the repository and serve it. There is nothing to compile, bundle or
install for the site itself.

```bash
git clone https://github.com/bhonemyintmyat/medcare.git
```

```bash
cd medcare
```

Serve the folder on port 8080 with whichever you have:

```bash
python -m http.server 8080
```

```bash
npx http-server -p 8080
```

Then open <http://localhost:8080>.

### Point it at your own Supabase project

The project URL and anon key checked into [`js/supabase.js`](js/supabase.js)
belong to the live project. To run against your own, edit the two values
near the top of that file:

```js
var SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

Both come from your Supabase dashboard under **Project Settings → API**.
The anon key is designed to be public; Row Level Security is what protects
the data. The `service_role` key must never appear in any file the browser
can load.

### Create the schema

The SQL in `database/` is applied by hand, in the Supabase SQL editor,
schema first, then policies, then the feature tables:

```text
database/supabase_schema.sql          tables
database/supabase_rls.sql             row level security policies
database/supabase_auth.sql            profiles and roles
database/supabase_admin_schema.sql    admin area tables
...                                   then the remaining feature files
database/supabase_seed_articles.sql   optional sample content
database/supabase_seed_hospitals.sql  optional sample content
```

Each file says at the top what it does and what it expects to already
exist.

### Deploy the edge function

`invite-staff` is the one operation the browser is not allowed to perform
— creating an account for somebody else. It holds the `service_role` key
server-side, verifies the caller's stored role is `admin`, and sends the
invitation email.

```bash
supabase login
```

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

```bash
supabase functions deploy invite-staff
```

Leave `verify_jwt` on. Supabase supplies `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to the function
automatically; you do not set them yourself.

## 🚀 Usage

### Read the site

With the server running, the public pages are the ones at the top level:

```text
http://localhost:8080/                      home
http://localhost:8080/articles.html         health articles
http://localhost:8080/common-diseases.html  disease index
http://localhost:8080/hospitals.html        hospital directory
http://localhost:8080/pharmacy.html         pharmacy directory
http://localhost:8080/bmi.html              BMI calculator
http://localhost:8080/emergency-contacts.html
```

Use the language switch in the navbar to move between English and
Burmese. Signing in adds bookmarks (`saved.html`) and lets you report a
problem with a page.

### Sign in as staff

```text
http://localhost:8080/login.html
```

Where you land depends on the `role` stored on your row in `profiles`:

| role     | can do                                                           |
|----------|------------------------------------------------------------------|
| `user`   | read, bookmark, report a page                                     |
| `editor` | write and translate content at `editor/`                          |
| `admin`  | everything, plus staff, permissions and housekeeping at `admin/`  |

The role is read from the database, never from anything the browser
claims, and RLS re-checks it on every request. To make the first admin,
set the column directly in the Supabase table editor:

```sql
update profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
```

After that, admins invite the rest from **Admin → Users**, which calls the
edge function above.

### Use the shared client from a page

Every page loads the Supabase library, then `js/supabase.js`, then its own
script — in that order, all deferred:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3" defer></script>
<script src="js/supabase.js" defer></script>
<script src="js/auth.js" defer></script>
<script src="js/script.js" defer></script>
```

That publishes one shared client as `window.supabaseClient`. It is `null`
when Supabase is unreachable or unconfigured, so check before using it:

```js
var db = window.supabaseClient;
if (db) {
  db.from('articles')
    .select('title, slug')
    .then(function (res) { console.log(res.data, res.error); });
}
```

`js/auth.js` sits on top of it and answers the two questions pages
actually ask:

```js
Auth.getUser();   // the signed-in user, or null
Auth.getRole();   // 'user' | 'editor' | 'admin' | null
```

### Run the test

One test exists, covering `js/sanitize-html.js` — the sanitiser is the
single place in this project where being subtly wrong stays invisible
until it matters. It needs a DOM, and Node has none, so install `linkedom`
into a scratch directory and run it from there:

```bash
npm install linkedom
```

```bash
node C:/Testing/medcare/tests/richtext-sanitizer.test.js
```

Run both from the scratch directory, not from the repository. Nothing in
the site depends on `linkedom`; throw the scratch directory away
afterwards.

## 📁 Where things live

```text
index.html, *.html   the public pages — these stay at the top level,
                     because their paths are hard-coded in the database
                     (bookmarks, reports) and in links across the site
diseases/            one page per disease
admin/               the admin area — its own js/ and css/
editor/              the editor area — its own js/ and css/

js/                  shared scripts: supabase.js, auth.js, script.js
                     first, then whatever a page needs
css/styles.css       the site stylesheet
images/              every photograph and product shot

database/            the SQL to run by hand in the Supabase SQL editor
supabase/functions/  edge functions
tests/               node tests (richtext-sanitizer needs `linkedom`)
```
