(function () {
  'use strict';

  var cfg = window.MEDCARE_CONFIG || {};
  var SUPABASE_URL = cfg.SUPABASE_URL || '';
  var SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      '[MedCare] No configuration found. Copy js/config.example.js to ' +
      'js/config.js, fill in the project URL and anon key from your ' +
      'Supabase dashboard (Project Settings -> API), and make sure ' +
      'config.js is loaded BEFORE supabase.js.'
    );
    window.supabaseClient = null;
    return;
  }

  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error(
      '[MedCare] Supabase library not found. Check that the ' +
      '@supabase/supabase-js CDN <script> tag is present and comes ' +
      'BEFORE supabase.js in your HTML <head>.'
    );
    window.supabaseClient = null;
    return;
  }

  if (SUPABASE_URL.indexOf('YOUR-') !== -1 || SUPABASE_ANON_KEY.indexOf('YOUR-') !== -1) {
    console.warn(
      '[MedCare] js/config.js still holds the example placeholders. ' +
      'Replace them with the values from your Supabase dashboard ' +
      '(Project Settings -> API).'
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
