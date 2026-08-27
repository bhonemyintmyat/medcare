/* ============================================================
   MedCare — the rich text editor

   Wraps Quill and hands back clean, semantic HTML. Used by the entry
   form for `body` and `body_my`, which are the long-form article and
   disease text.

   WHY QUILL, AND WHY IT DOES NOT LEAK INTO THE DATABASE

   Rich text editing is a tar pit — selection ranges, paste from Word,
   undo across a DOM the user is also editing — and hand-rolling one on
   document.execCommand (deprecated, and inconsistent in ways that only
   show up on somebody else's browser) would be a bad trade for a health
   site that has real work to do. Quill is loaded from the same CDN as
   Bootstrap, which this project already depends on.

   But Quill's output is not neutral. It emits its own vocabulary:
   `<p class="ql-align-center">`, `<li class="ql-indent-1">`, `<span
   class="ql-size-large">`. Storing that would mean every page that ever
   renders an article has to ship Quill's stylesheet to look right, and
   the database would be full of one library's private class names.

   So the editing surface is Quill and the STORED format is plain
   semantic HTML. toHTML() normalises on the way out — Quill classes
   become real elements or are dropped — and the result is markup that a
   hand-written page in this repository can style with the site's own
   CSS. Swap Quill for something else later and the stored content does
   not care.

   THE SANITISER IS NOT DECORATION

   Whatever comes out of here is written to a column that a public page
   renders. Two editors hold this role today, and the whole point of the
   publish-approval work was that one pair of hands is not enough. An
   allowlist here means a compromised editor account cannot put script
   on the public site by pasting it into an article.

   It is an ALLOWLIST, not a blocklist: unknown tags are unwrapped and
   unknown attributes dropped. A blocklist is a list of the attacks
   somebody thought of.

   The sanitiser itself is ../../sanitize-html.js, shared with the reader
   so that what is stored and what is shown are cleaned by one set of
   rules. The check constraint on the column is a third line and a coarse
   one - see the migration.
   ============================================================ */

(function () {
  'use strict';

  var ed = window.MedCareEditor;
  if (!ed) { return; }

  /* The allowlist, the URL rules and the Quill-to-semantic-HTML
     normalisation all moved to ../../sanitize-html.js when the reader
     side needed them too. They are the same rules in both places by
     construction rather than by discipline - see the note at the top of
     that file for why cleaning on save is not enough on its own. */
  var sanitize = window.MedCareSanitize;
  if (!sanitize) { return; }

  var clean  = sanitize.clean;
  var textOf = sanitize.textOf;
  var safeUrl = sanitize.safeUrl;


  /* ================================================================
     5. Creating one
     ================================================================ */

  var QUILL_CSS = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
  var QUILL_JS  = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';

  var loading = null;

  /* Loaded on demand rather than in every editor page's <head>, because
     only the entry form has a body field and the library is not small.
     One promise, shared: two editors on one page must not fetch it
     twice. */
  function loadQuill() {
    if (window.Quill) { return Promise.resolve(window.Quill); }
    if (loading) { return loading; }

    loading = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = QUILL_CSS;
      document.head.appendChild(css);

      var js = document.createElement('script');
      js.src = QUILL_JS;
      js.onload = function () {
        if (window.Quill) { resolve(window.Quill); }
        else { reject(new Error('Quill loaded but did not register.')); }
      };
      js.onerror = function () {
        reject(new Error('Could not load the text editor from the CDN. ' +
                         'Check the connection and reload the page.'));
      };
      document.head.appendChild(js);
    });
    return loading;
  }

  /* opts: { onChange, onImage }
       onChange()  fires on every edit, for the dirty flag and the counter
       onImage(cb) opens the media library and calls cb(url), or is absent
                   and the image button is left out

     Returns a promise for a handle:
       getHTML()      cleaned, storable HTML
       getText()      plain text, for counting
       setHTML(html)  replaces the content without firing onChange
       setEnabled(on) the read-only lock
       focus()
  */
  function create(host, opts) {
    opts = opts || {};

    return loadQuill().then(function (Quill) {
      var toolbar = [
        [{ header: [2, 3, 4, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote'],
        ['link'].concat(opts.onImage ? ['image'] : []),
        ['clean']
      ];

      var q = new Quill(host, {
        theme: 'snow',
        modules: {
          toolbar: { container: toolbar },
          /* Quill's default paste handler keeps a lot of what Word and
             Google Docs send. Ours runs the same allowlist the save path
             uses, so what lands in the editor is what would be stored -
             an editor should never see formatting that silently
             disappears when they press Save. */
          clipboard: { matchVisual: false }
        },
        placeholder: opts.placeholder || 'Write the article here…'
      });

      if (opts.onImage) {
        q.getModule('toolbar').addHandler('image', function () {
          var range = q.getSelection(true);
          opts.onImage(function (url) {
            if (!url) { return; }
            q.insertEmbed(range ? range.index : 0, 'image', url, 'user');
          });
        });
      }

      var quiet = false;
      q.on('text-change', function () {
        if (quiet || !opts.onChange) { return; }
        opts.onChange();
      });

      return {
        quill: q,
        getHTML: function () { return clean(q.root.innerHTML); },
        getText: function () { return (q.getText() || '').replace(/\s+/g, ' ').trim(); },
        setHTML: function (html) {
          quiet = true;
          // Through the clipboard converter rather than innerHTML, so
          // Quill builds its own model instead of being handed a DOM it
          // does not know about — which breaks undo and the toolbar
          // state in ways that look like random bugs later.
          q.setContents(q.clipboard.convert({ html: clean(html) || '<p></p>' }), 'silent');
          quiet = false;
        },
        setEnabled: function (on) {
          q.enable(!!on);
          var tb = host.parentNode && host.parentNode.querySelector('.ql-toolbar');
          if (tb) { tb.style.display = on ? '' : 'none'; }
        },
        focus: function () { q.focus(); }
      };
    });
  }

  window.MedCareRichText = {
    create: create,
    clean: clean,
    textOf: textOf,
    safeUrl: safeUrl
  };

})();
