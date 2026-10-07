/* ============================================================
   Charisma 2026 — Codebase download page (Task 2)

   The browser cannot read the repo's own directory listing, so the
   list of files to package is declared below. Each entry is fetched
   relative to this page, which means the SAME code works on the
   local preview, the published site, and a Hosted deploy.

   If a file 404s it is reported as skipped instead of silently
   producing a half-empty archive.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };

  /* ---- The project manifest -------------------------------------
     Keep this in sync when files are added. `zipPath` is the path
     inside the archive. */
  var MANIFEST = [
    { path: 'index.html',                                label: 'Wedding invitation (main page)' },
    { path: 'admin.html',                                label: 'Gift dashboard (Task 7)' },
    { path: 'download.html',                             label: 'This download page (Task 2)' },
    { path: 'css/style.css',                             label: 'Brand stylesheet' },
    { path: 'css/admin.css',                             label: 'Dashboard stylesheet' },
    { path: 'css/download.css',                          label: 'Download page stylesheet' },
    { path: 'js/config.js',                              label: 'Brand + integrations config' },
    { path: 'js/main.js',                                label: 'Site interactions' },
    { path: 'js/site-payments.js',                       label: 'Gifting, receipts, keep-alive' },
    { path: 'js/admin.js',                               label: 'Dashboard logic' },
    { path: 'js/download.js',                            label: 'Download page logic' },
    { path: '.tables/schema.json',                       label: 'Database schema (D1 tables)' },
    { path: '.github/workflows/keepalive.yml',           label: 'Keep-alive workflow (Task 6)' },
    { path: 'images/brand-colors.jpg',                   label: 'Brand palette reference' },
    { path: 'images/brand-typography.jpg',               label: 'Brand typography reference' },
    { path: 'README.md',                                 label: 'Documentation' }
  ];

  var ARCHIVE_NAME = 'charisma2026-wedding-site.zip';
  var TEXT_EXT = /\.(html|css|js|json|md|yml|yaml|txt|svg)$/i;

  function fmtBytes(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var loaded = [];   /* { path, label, blob, size } */
  var skipped = [];

  /* ---------------- File list UI ---------------- */
  function renderList() {
    var list = $('#file-list');
    var count = $('#dl-count');
    if (!list) return;

    if (loaded.length) {
      list.innerHTML = loaded.map(function (f) {
        return '<li class="file-row">' +
          '<span class="file-icon" aria-hidden="true"><i class="fa-solid ' +
            (TEXT_EXT.test(f.path) ? 'fa-file-code' : 'fa-file-image') + '"></i></span>' +
          '<span class="file-info">' +
            '<span class="file-path">' + esc(f.path) + '</span>' +
            '<span class="file-label">' + esc(f.label) + ' &middot; ' + esc(fmtBytes(f.size)) + '</span>' +
          '</span>' +
          '<button class="file-dl" type="button" data-path="' + esc(f.path) + '" ' +
            'aria-label="Download ' + esc(f.path) + '">' +
            '<i class="fa-solid fa-download" aria-hidden="true"></i>' +
          '</button>' +
        '</li>';
      }).join('');
    } else {
      list.innerHTML = '<li class="dl-empty">No files could be read from this deployment.</li>';
    }

    if (skipped.length) {
      list.insertAdjacentHTML('beforeend',
        '<li class="dl-missing"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ' +
        'Skipped ' + skipped.length + ' file(s) that were not reachable: ' +
        esc(skipped.join(', ')) + '</li>');
    }

    if (count) count.textContent = loaded.length + ' file' + (loaded.length === 1 ? '' : 's');
  }

  function downloadOne(path) {
    var file = loaded.filter(function (f) { return f.path === path; })[0];
    if (!file) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(file.blob);
    a.download = path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------------- Fetch every file ---------------- */
  function fetchAll() {
    var total = MANIFEST.length;
    var done = 0;
    var bar = $('#dl-bar-fill');
    var text = $('#dl-progress-text');

    function step() {
      done += 1;
      var pct = Math.round((done / total) * 100);
      if (bar) bar.style.width = pct + '%';
      if (text) text.textContent = 'Reading files… ' + done + ' of ' + total + ' (' + pct + '%)';
    }

    return Promise.all(MANIFEST.map(function (entry) {
      return fetch(entry.path, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(function (blob) {
          /* A dev server that rewrites 404s to index.html would hand back
             HTML for a missing asset — reject that so we don't ship junk. */
          var isHtml = /\.html$/i.test(entry.path);
          if (!isHtml && blob.type && blob.type.indexOf('text/html') === 0) {
            throw new Error('HTML fallback');
          }
          loaded.push({ path: entry.path, label: entry.label, blob: blob, size: blob.size });
        })
        .catch(function () { skipped.push(entry.path); })
        .then(step);
    }));
  }

  /* ---------------- Build the zip ---------------- */
  function buildZip() {
    if (!window.JSZip) {
      throw new Error('JSZip failed to load — check your network connection.');
    }
    var zip = new window.JSZip();

    loaded.forEach(function (f) {
      /* Store text as text and binaries as binary so the archive is
         readable when unzipped. */
      if (TEXT_EXT.test(f.path)) {
        return; /* handled below (needs async read) */
      }
      zip.file(f.path, f.blob);
    });

    var textReads = loaded
      .filter(function (f) { return TEXT_EXT.test(f.path); })
      .map(function (f) {
        return f.blob.text().then(function (txt) { zip.file(f.path, txt); });
      });

    return Promise.all(textReads).then(function () {
      /* README roster so the unzipped folder is self-describing. */
      zip.file('ARCHIVE-CONTENTS.txt', [
        'Charisma 2026 — Wedding of Usman Fori & Charity Ishaku',
        '#Charisma2026',
        '',
        'Archive built: ' + new Date().toISOString(),
        'Files included: ' + loaded.length,
        skipped.length ? 'Skipped (unreachable): ' + skipped.join(', ') : 'Skipped: none',
        '',
        loaded.map(function (f) { return '  ' + f.path + '  (' + fmtBytes(f.size) + ')'; }).join('\n')
      ].join('\n'));

      return zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        function (meta) {
          if (barRef) barRef.style.width = Math.round(meta.percent) + '%';
          if (textRef) textRef.textContent = 'Packaging… ' + Math.round(meta.percent) + '%';
        }
      );
    });
  }

  var barRef = null;
  var textRef = null;

  function setStatus(msg, cls) {
    var el = $('#dl-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'dl-status' + (cls ? ' ' + cls : '');
  }

  function init() {
    var btn = $('#dl-build');
    var progress = $('#dl-progress');
    barRef = $('#dl-bar-fill');
    textRef = $('#dl-progress-text');

    var total = $('#dl-total');
    if (total) {
      var approx = MANIFEST.reduce(function (n, m) { return n + (m.label ? 1 : 0); }, 0);
      total.textContent = approx + ' files from the project repository';
    }

    var list = $('#file-list');
    if (list) {
      list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-path]');
        if (b) downloadOne(b.getAttribute('data-path'));
      });
    }

    if (!btn) return;

    /* Prefetch on load so the visitor can see exactly what the archive
       contains (and grab a single file) before committing to the zip. */
    var prefetch = fetchAll().then(renderList).catch(function () { /* reported on build */ });

    btn.addEventListener('click', function () {
      btn.disabled = true;
      if (progress) progress.hidden = false;
      setStatus('');

      /* Reuse the prefetched files; only re-fetch if the prefetch failed. */
      prefetch
        .catch(function () { /* fall through to the retry below */ })
        .then(function () {
          return loaded.length ? null : fetchAll().then(renderList);
        })
        .then(function () {
          renderList();
          setStatus('Files read. Packaging the archive…');
          return buildZip();
        })
        .then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = ARCHIVE_NAME;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

          setStatus(
            'Done — ' + ARCHIVE_NAME + ' (' + fmtBytes(blob.size) + ') with ' +
            loaded.length + ' file' + (loaded.length === 1 ? '' : 's') + '.' +
            (skipped.length ? ' ' + skipped.length + ' file(s) were unreachable and skipped.' : ''),
            'is-ok'
          );
        })
        .catch(function (err) {
          setStatus('Could not build the archive: ' + err.message, 'is-err');
        })
        .then(function () {
          btn.disabled = false;
          if (progress) progress.hidden = true;
        });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
