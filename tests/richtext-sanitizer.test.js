/* ============================================================
   Exercises sanitize-html.js's clean() against the payloads it exists
   to stop, plus the markup an editor legitimately produces. It runs the
   REAL file rather than a copy of its logic, so a change to the
   sanitiser that breaks it shows up here.

   This is the only test in the repository, and it is here because the
   sanitiser is the one piece of this project where being subtly wrong is
   invisible until it matters. Everything else fails loudly.

   The site itself has no build step and no package.json - deliberately -
   so this does not run on `npm test`. It needs a DOM, and Node has none:

     cd <a scratch directory>
     npm install linkedom
     node <path to this file>

   Nothing in the site depends on linkedom; it exists for the length of
   the test run and can be thrown away afterwards.
   ============================================================ */

const path = require('path');
const fs = require('fs');
/* Resolved from the CURRENT DIRECTORY rather than from this file, so
   the scratch directory you installed linkedom into is where it is
   looked for - this file lives in a repository that has no node_modules
   and is not going to grow one. */
let parseHTML;
try {
  parseHTML = require('module')
    .createRequire(path.join(process.cwd(), 'noop.js'))('linkedom').parseHTML;
} catch (e) {
  console.error('');
  console.error('This test needs a DOM, and Node has none. From a scratch directory:');
  console.error('');
  console.error('  npm install linkedom');
  console.error('  node ' + __filename);
  console.error('');
  console.error('Run it FROM that directory - linkedom is looked for there, not here.');
  console.error('');
  process.exit(2);
}

const page = parseHTML('<!doctype html><html><body></body></html>');

// The module reaches for these as globals, exactly as a browser supplies them.
global.window = page.window;
global.document = page.document;
global.DOMParser = page.window.DOMParser;

/* Resolved from this file's own location, so the test can be run from
   anywhere and copied to a scratch directory to pick up linkedom. */
const target = process.env.MEDCARE_SANITIZER ||
  path.join(__dirname, '..', 'sanitize-html.js');
const src = fs.readFileSync(target, 'utf8');
new Function('window', 'document', 'DOMParser', src)(global.window, global.document, global.DOMParser);

const rt = global.window.MedCareSanitize;
if (!rt) { console.error('MedCareSanitize did not register'); process.exit(1); }

const clean = rt.clean;

let pass = 0, fail = 0;
function check(name, input, predicate, why) {
  const out = clean(input);
  const ok = predicate(out);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got: ${JSON.stringify(out)}\n        want: ${why}`); }
}

const absent = (...needles) => (out) => {
  const low = out.toLowerCase();
  return needles.every((n) => low.indexOf(n.toLowerCase()) === -1);
};

console.log('\n--- attacks that must not survive ---');
check('script tag', '<p>hi</p><script>alert(1)</script>',
  absent('<script', 'alert'), 'no script element or its contents');
check('img onerror', '<img src=x onerror="alert(1)">',
  absent('onerror'), 'the event handler stripped');
check('javascript: href', '<a href="javascript:alert(1)">click</a>',
  absent('javascript:'), 'href dropped (and the link unwrapped)');
check('JaVaScRiPt: mixed case', '<a href="JaVaScRiPt:alert(1)">x</a>',
  absent('javascript:'), 'case-insensitive match');
check('javascript with embedded tab', '<a href="java\tscript:alert(1)">x</a>',
  absent('javascript:', 'java\tscript'), 'control chars stripped before matching');
check('data: URL image', '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
  absent('data:'), 'data URLs refused');
check('svg with onload', '<svg onload="alert(1)"><circle/></svg>',
  absent('onload', '<svg'), 'unknown element removed whole');
check('iframe', '<iframe src="https://evil.test"></iframe>',
  absent('<iframe'), 'not on the allowlist');
check('style attribute', '<p style="position:fixed;top:0">x</p>',
  absent('style='), 'attribute not allowlisted');
check('form and input', '<form action="/steal"><input name="pw"></form>',
  absent('<form', '<input'), 'removed');
check('nested script inside allowed tag', '<blockquote><script>alert(1)</script>ok</blockquote>',
  absent('<script', 'alert'), 'walk descends into allowed elements');
check('on* handler on allowed tag', '<p onclick="alert(1)">text</p>',
  absent('onclick'), 'stripped from an allowed tag too');

console.log('\n--- legitimate content that must survive ---');
check('basic formatting', '<p>Take <strong>two</strong> tablets <em>daily</em>.</p>',
  (o) => o.includes('<strong>two</strong>') && o.includes('<em>daily</em>'), 'kept');
check('headings', '<h2>Symptoms</h2><h3>Early</h3>',
  (o) => o.includes('<h2>Symptoms</h2>') && o.includes('<h3>Early</h3>'), 'kept');
check('lists', '<ul><li>Fever</li><li>Rash</li></ul>',
  (o) => o.includes('<li>Fever</li>') && o.includes('<li>Rash</li>'), 'kept');
check('external link hardened', '<a href="https://www.who.int/dengue">WHO</a>',
  (o) => o.includes('href="https://www.who.int/dengue"') &&
         o.includes('target="_blank"') && o.includes('rel="noopener noreferrer"'),
  'kept, with target and rel added');
check('relative link kept bare', '<a href="diseases/dengue.html">Dengue</a>',
  (o) => o.includes('href="diseases/dengue.html"') && !o.includes('target='),
  'internal links are not forced into a new tab');
check('bucket image', '<img src="https://x.supabase.co/storage/v1/object/public/content-images/a.jpg" alt="A rash">',
  (o) => o.includes('<img') && o.includes('alt="A rash"'), 'kept');
check('blockquote', '<blockquote>Seek care within 24 hours.</blockquote>',
  (o) => o.includes('<blockquote>'), 'kept');

console.log('\n--- Quill normalisation ---');
check('ql-align dropped, text kept', '<p class="ql-align-center">Centred</p>',
  (o) => o === '<p>Centred</p>', 'class gone, paragraph kept');
check('span unwrapped', '<p>a <span class="ql-size-large">big</span> word</p>',
  (o) => o === '<p>a big word</p>', 'span unwrapped, words kept');
check('trailing empty paragraphs trimmed', '<p>Real text.</p><p><br></p><p><br></p>',
  (o) => o === '<p>Real text.</p>', 'Quill trailing blanks removed');
check('indented list becomes nested',
  '<ul><li>One</li><li class="ql-indent-1">Under one</li></ul>',
  (o) => o.replace(/>\s+</g, '><').includes('<li>One<ul><li>Under one</li></ul></li>'),
  'the indented item nests inside the previous one');

console.log('\n--- edge cases ---');
check('empty input', '', (o) => o === '', 'empty string');
check('only whitespace paragraphs', '<p><br></p>', (o) => o === '', 'collapses to nothing');
check('plain text with angle brackets',
  '<p>Use &lt;strong&gt; sparingly.</p>',
  (o) => o.includes('&lt;strong&gt;'), 'escaped text stays escaped, not re-parsed');
check('double sanitisation is stable',
  clean('<a href="https://who.int">WHO</a>'),
  (o) => o === clean(clean('<a href="https://who.int">WHO</a>')),
  'cleaning twice equals cleaning once');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
