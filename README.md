# WebProject
Web Project for Sem II

## Where things live

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
