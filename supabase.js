/* ============================================================
   MedCare — Supabase client setup
   ------------------------------------------------------------
   This file creates ONE shared Supabase client that every page
   can use. It must be loaded AFTER the Supabase library CDN tag
   and BEFORE any of your own code that talks to Supabase:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3" defer></script>
     <script src="supabase.js" defer></script>
     <script src="script.js" defer></script>

   (`defer` makes scripts run in the order they appear, after the
   HTML is parsed — so the order above is guaranteed.)
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 1. YOUR PROJECT SETTINGS — PASTE THESE IN ----------
     Find both values in your Supabase dashboard:
       Project Settings -> API
         "Project URL"  -> SUPABASE_URL
         "anon public"  -> SUPABASE_ANON_KEY
  ---------------------------------------------------------------- */

  // >>> REPLACE THIS <<<  e.g. 'https://abcdefghijklm.supabase.co'
  var SUPABASE_URL = 'https://dszujgyrbmtygzyfijtr.supabase.co';

  // >>> REPLACE THIS <<<  the long "anon public" key (starts with 'eyJ...' or 'sb_publishable_...')
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzenVqZ3lyYm10eWd6eWZpanRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTY5MDEsImV4cCI6MjEwMjAzMjkwMX0.gQsbAVhCbmVtWUD4m6d_gt7wJYDmK5bCyXQz2j9EC8w';

  /* ---------- 2. A NOTE ON KEYS AND SAFETY ----------
     The "anon public" key above is DESIGNED to be visible in
     frontend code. Anyone can open DevTools or "View source" and
     read it, and that is expected and fine. It does not by itself
     grant access to anything — it only identifies your project.
     What actually protects your data is Row Level Security (RLS):
     turn RLS on for every table and write policies saying who may
     read or write which rows. Without RLS policies, a public key
     plus a public table means public data.

     The "service_role" key is the opposite. It bypasses RLS
     completely and can read, edit, and delete ANY row in your
     database. NEVER put it in this file, in any .js or .html file,
     in client-side code of any kind, or in a public git repo.
     If it ever leaks, treat the database as compromised and
     rotate the key immediately in the dashboard.
     It belongs only on a server you control (or a Supabase Edge
     Function), where the browser can never see it.
  --------------------------------------------------------------- */

  /* ---------- 3. CREATE THE CLIENT ----------
     Heads up on naming: the CDN script defines a GLOBAL called
     `supabase` — that is the library itself, which gives us the
     `createClient` function. To avoid shadowing it, we publish our
     ready-to-use client under a different name: `supabaseClient`.

       supabase        = the library  (has .createClient)
       supabaseClient  = your project's connection (has .from, .auth, ...)
  ------------------------------------------------------------- */

  // Guard 1: did the CDN <script> tag actually load?
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error(
      '[MedCare] Supabase library not found. Check that the ' +
      '@supabase/supabase-js CDN <script> tag is present and comes ' +
      'BEFORE supabase.js in your HTML <head>.'
    );
    window.supabaseClient = null;
    return;
  }

  // Guard 2: are the placeholders above still unedited?
  if (SUPABASE_URL.indexOf('PASTE_') === 0 || SUPABASE_ANON_KEY.indexOf('PASTE_') === 0) {
    console.warn(
      '[MedCare] Supabase is not configured yet. Open supabase.js and ' +
      'replace SUPABASE_URL and SUPABASE_ANON_KEY with the values from ' +
      'your Supabase dashboard (Project Settings -> API).'
    );
    window.supabaseClient = null;
    return;
  }

  // Build the client once and share it on `window` so any page or
  // script can reach it. Creating it once (instead of per page-feature)
  // keeps a single auth session and a single realtime connection.
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ---------- 4. HOW TO USE IT ELSEWHERE ----------
     From script.js, or any inline <script> on a page:

       var db = window.supabaseClient;
       if (db) {
         db.from('articles').select('*').then(function (res) {
           console.log(res.data, res.error);
         });
       }

     The `if (db)` check matters: the guards above deliberately set
     it to null when things aren't set up, so nothing on the site
     breaks — it just logs a message and carries on.
  ------------------------------------------------------------- */

})();
