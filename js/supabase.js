(function () {
  'use strict';

  var SUPABASE_URL = 'https://dszujgyrbmtygzyfijtr.supabase.co';

  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzenVqZ3lyYm10eWd6eWZpanRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTY5MDEsImV4cCI6MjEwMjAzMjkwMX0.gQsbAVhCbmVtWUD4m6d_gt7wJYDmK5bCyXQz2j9EC8w';

  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error(
      '[MedCare] Supabase library not found. Check that the ' +
      '@supabase/supabase-js CDN <script> tag is present and comes ' +
      'BEFORE supabase.js in your HTML <head>.'
    );
    window.supabaseClient = null;
    return;
  }

  if (SUPABASE_URL.indexOf('PASTE_') === 0 || SUPABASE_ANON_KEY.indexOf('PASTE_') === 0) {
    console.warn(
      '[MedCare] Supabase is not configured yet. Open supabase.js and ' +
      'replace SUPABASE_URL and SUPABASE_ANON_KEY with the values from ' +
      'your Supabase dashboard (Project Settings -> API).'
    );
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {

      persistSession: true,
      autoRefreshToken: true,

      detectSessionInUrl: false
    }
  });

})();
