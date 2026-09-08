

(function () {
  'use strict';

  

  
  var ALLOWED = {
    p: [], br: [], strong: [], em: [], u: [], s: [],
    h2: [], h3: [], h4: [],
    ul: [], ol: [], li: [],
    blockquote: [], code: [], pre: [],
    
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt'],
    sup: [], sub: [], hr: []
  };

  
  var UNWRAP = ['div', 'span', 'font', 'section', 'article', 'main', 'body', 'html', 'tbody', 'table', 'tr', 'td', 'th'];

  
  function safeUrl(value) {
    if (!value) { return null; }
    var v = String(value)
                 .replace(/[\u0000-\u0020\u007F-\u00A0]/g, '')
                 .toLowerCase();
    if (v.indexOf('javascript:') === 0 || v.indexOf('vbscript:') === 0) { return null; }

    if (v.indexOf('data:') === 0) { return null; }
    var raw = String(value).trim();
    if (/^(https?:|mailto:)/i.test(raw)) { return raw; }
    if (raw.charAt(0) === '/' || raw.charAt(0) === '.' || /^[a-z0-9._-]+\//i.test(raw)) { return raw; }
    if (/^[a-z0-9._-]+\.(html?|php)$/i.test(raw)) { return raw; }
    return null;
  }

  

  
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

        var host = stack[stack.length - 1].el;
        var prev = host.lastElementChild;
        var sub  = document.createElement(list.tagName.toLowerCase());
        if (prev) { prev.appendChild(sub); } else { host.appendChild(sub); }
        stack.push({ level: level, el: sub });
      }
      stack[stack.length - 1].el.appendChild(li);
    });
  }

  

  
  function clean(html) {
    if (!html) { return ''; }

    var doc = new DOMParser().parseFromString('<div id="mc-root">' + html + '</div>', 'text/html');
    var root = doc.getElementById('mc-root');
    if (!root) { return ''; }


    Array.prototype.slice.call(root.querySelectorAll('ul, ol')).forEach(liftIndents);

    walk(root);

    var out = root.innerHTML;

    out = out.replace(/(<p><br><\/p>\s*)+$/g, '').trim();
    return out;
  }

  function walk(node) {
    var children = Array.prototype.slice.call(node.childNodes);

    children.forEach(function (child) {
      if (child.nodeType === 3) { return; }
      if (child.nodeType !== 1) { child.remove(); return; }

      var tag = child.tagName.toLowerCase();

      if (!Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
        walk(child);
        if (UNWRAP.indexOf(tag) !== -1) {

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


      if (tag === 'a') {
        if (!child.getAttribute('href')) {
          while (child.firstChild) { child.parentNode.insertBefore(child.firstChild, child); }
          child.remove();
          return;
        }

        if (/^https?:/i.test(child.getAttribute('href'))) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (tag === 'img' && !child.getAttribute('src')) { child.remove(); return; }

      walk(child);
    });
  }

  

  
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
