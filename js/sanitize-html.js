/* ============================================================
   MedCare — the HTML sanitiser

   One allowlist, two callers, and that is the whole point of the file
   existing separately.

     editor/js/editor-richtext.js  cleans what an editor WRITES
     read.js                       cleans what a reader is SHOWN

   Both matter, and neither is redundant. Cleaning on save stops bad
   markup being stored. Cleaning on render is what protects a reader from
   a row that got into the table some other way -- a direct API call with
   a stolen editor token, a hand-run UPDATE, a restored backup from
   before the sanitiser existed. The database check constraint catches
   only the three coarsest shapes; it is a backstop, not this.

   If the two ever disagree, the stored text and the rendered page
   disagree, and an editor sees something a reader does not. One file.

   ALLOWLIST, NOT BLOCKLIST. Unknown tags are unwrapped or removed and
   unknown attributes dropped. A blocklist is a list of the attacks
   somebody thought of.

   Loaded as a plain script; publishes window.MedCareSanitize.
   ============================================================ */

(function () {
  'use strict';

  /* ================================================================
     1. What is allowed to survive
     ================================================================ */

  /* Chosen for what a medical article actually needs, and nothing else.
     No tables — the reader pages have no styling for them and a table
     that renders as a stack of unaligned text is worse than a list. No
     headings above h2, because the page supplies the h1. No <div> or
     <span>: they carry no meaning and are how class soup gets in. */
  var ALLOWED = {
    p: [], br: [], strong: [], em: [], u: [], s: [],
    h2: [], h3: [], h4: [],
    ul: [], ol: [], li: [],
    blockquote: [], code: [], pre: [],
    /* target and rel are not authored - the sanitiser ADDS them to
       outbound links (see walk()), so they have to be legal here or a
       second pass would strip what the first one added. */
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt'],
    sup: [], sub: [], hr: []
  };

  /* Tags whose CONTENT is worth keeping when the tag itself is not.
     A <span> wrapping a sentence should leave the sentence behind; a
     <script> should leave nothing. Anything not named here is removed
     whole, children and all. */
  var UNWRAP = ['div', 'span', 'font', 'section', 'article', 'main', 'body', 'html', 'tbody', 'table', 'tr', 'td', 'th'];

  /* A URL is safe if it is http(s), mailto, or site-relative. Everything
     else — javascript:, data:, vbscript:, and the whitespace-and-control
     -character tricks that hide them — is refused. Parsed rather than
     pattern-matched where the browser will do it for us. */
  function safeUrl(value) {
    if (!value) { return null; }
    var v = String(value)
                 .replace(/[\u0000-\u0020\u007F-\u00A0]/g, '')
                 .toLowerCase();
    if (v.indexOf('javascript:') === 0 || v.indexOf('vbscript:') === 0) { return null; }
    // data: URLs are how an SVG carrying script gets in. Images come
    // from the bucket; there is no reason for one here.
    if (v.indexOf('data:') === 0) { return null; }
    var raw = String(value).trim();
    if (/^(https?:|mailto:)/i.test(raw)) { return raw; }
    if (raw.charAt(0) === '/' || raw.charAt(0) === '.' || /^[a-z0-9._-]+\//i.test(raw)) { return raw; }
    if (/^[a-z0-9._-]+\.(html?|php)$/i.test(raw)) { return raw; }
    return null;
  }

  /* ================================================================
     2. Normalising Quill's output
     ================================================================ */

  /* Quill says "this paragraph is centred" with a class. The stored
     format has no classes, so alignment is simply lost — deliberately.
     A centred paragraph in the middle of a health article is a styling
     decision the reader pages should make, not something an editor
     should be able to impose from a toolbar. The same reasoning drops
     colour and font size.

     Indent is the one that carries meaning rather than decoration: an
     indented list item is a nested list, so it is rebuilt as one. */
  function liftIndents(list) {
    var items = Array.prototype.slice.call(list.children);
    var stack = [{ level: 0, el: list }];

    items.forEach(function (li) {
      var level = 0;
      var cls = li.getAttribute('class') || '';
      var m = cls.match(/ql-indent-(\d+)/);
      if (m) { level = Math.min(parseInt(m[1], 10) || 0, 4); }
      li.removeAttribute('class');

      while (stack.length > 1 && stack[stack.length - 1].level >= level + 1) { stack.pop(); }

      if (level > stack[stack.length - 1].level) {
        // A nested list belongs INSIDE the previous item, not beside it,
        // or it renders as a sibling list with no relationship to it.
        var host = stack[stack.length - 1].el;
        var prev = host.lastElementChild;
        var sub  = document.createElement(list.tagName.toLowerCase());
        if (prev) { prev.appendChild(sub); } else { host.appendChild(sub); }
        stack.push({ level: level, el: sub });
      }
      stack[stack.length - 1].el.appendChild(li);
    });
  }

  /* ================================================================
     3. The sanitiser
     ================================================================ */

  /* Walks a detached copy of the document, so nothing here can execute
     while it is being cleaned: the HTML is parsed by DOMParser into a
     document with no browsing context, where <img onerror> never fires
     and <script> never runs. Cleaning a live fragment is how sanitisers
     get their own XSS advisories. */
  function clean(html) {
    if (!html) { return ''; }

    var doc = new DOMParser().parseFromString('<div id="mc-root">' + html + '</div>', 'text/html');
    var root = doc.getElementById('mc-root');
    if (!root) { return ''; }

    // Nested lists first, while Quill's classes are still present.
    Array.prototype.slice.call(root.querySelectorAll('ul, ol')).forEach(liftIndents);

    walk(root);

    var out = root.innerHTML;
    // Quill leaves a bare <p><br></p> for every blank line, including a
    // trailing one it adds itself. Harmless in the editor, a run of
    // empty paragraphs on the page.
    out = out.replace(/(<p><br><\/p>\s*)+$/g, '').trim();
    return out;
  }

  function walk(node) {
    var children = Array.prototype.slice.call(node.childNodes);

    children.forEach(function (child) {
      if (child.nodeType === 3) { return; }              // text: always fine
      if (child.nodeType !== 1) { child.remove(); return; }  // comments, CDATA

      var tag = child.tagName.toLowerCase();

      if (!Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
        walk(child);
        if (UNWRAP.indexOf(tag) !== -1) {
          // Keep the words, drop the wrapper.
          while (child.firstChild) { child.parentNode.insertBefore(child.firstChild, child); }
        }
        child.remove();
        return;
      }

      var allowedAttrs = ALLOWED[tag];
      Array.prototype.slice.call(child.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (allowedAttrs.indexOf(name) === -1) { child.removeAttribute(attr.name); return; }
        if (name === 'href' || name === 'src') {
          var ok = safeUrl(attr.value);
          if (ok === null) { child.removeAttribute(attr.name); }
          else { child.setAttribute(name, ok); }
        }
      });

      // A link with no href left is not a link any more.
      if (tag === 'a') {
        if (!child.getAttribute('href')) {
          while (child.firstChild) { child.parentNode.insertBefore(child.firstChild, child); }
          child.remove();
          return;
        }
        // Anything leaving the site opens away from it and cannot reach
        // back through window.opener.
        if (/^https?:/i.test(child.getAttribute('href'))) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (tag === 'img' && !child.getAttribute('src')) { child.remove(); return; }

      walk(child);
    });
  }

  /* ================================================================
     4. Plain text, for counting and for validation
     ================================================================ */

  /* The character counter and the "this one is needed" check both want
     to know whether there is anything here. `<p><br></p>` is 12
     characters of nothing. */
  function textOf(html) {
    if (!html) { return ''; }
    var doc = new DOMParser().parseFromString('<div id="t">' + html + '</div>', 'text/html');
    var el = doc.getElementById('t');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  window.MedCareSanitize = {
    clean: clean,
    textOf: textOf,
    safeUrl: safeUrl
  };

})();
