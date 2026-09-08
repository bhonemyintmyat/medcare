

(function () {
  'use strict';

  var ed = window.MedCareEditor;
  if (!ed) { return; }

  
  var sanitize = window.MedCareSanitize;
  if (!sanitize) { return; }

  var clean  = sanitize.clean;
  var textOf = sanitize.textOf;
  var safeUrl = sanitize.safeUrl;


  

  var QUILL_CSS = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
  var QUILL_JS  = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';

  var loading = null;

  
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
