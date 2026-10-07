/* ============================================================
   Charisma 2026 — Gift Dashboard (Task 7)
   Reads payment records from Supabase when configured, otherwise
   from this project's own tables API (`payments` table).
   Includes: search, status filter, CSV export, PDF receipt re-issue.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Convenience passcode. NOT security — see the notice in admin.html. */
  var ADMIN_PASSCODE = 'charisma2026';
  var SESSION_KEY = 'charisma-admin-unlocked';
  var CACHE_KEY = 'charisma-admin-payments';

  var state = { rows: [], query: '', status: 'all', source: 'tables' };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n, cur) {
    var num = Number(n) || 0;
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency', currency: cur || 'NGN', maximumFractionDigits: 0
      }).format(num);
    } catch (e) { return (cur || 'NGN') + ' ' + num.toLocaleString(); }
  }

  function fmtDateTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function supabaseReady() {
    return !!(window.SUPABASE && SUPABASE.url && SUPABASE.anonKey);
  }

  /* ---------------- Data loading ---------------- */
  function loadFromSupabase() {
    var base = SUPABASE.url.replace(/\/$/, '');
    var url = base + '/rest/v1/' + SUPABASE.paymentsTable +
      '?select=*&order=created_at.desc&limit=500';
    return fetch(url, {
      headers: { apikey: SUPABASE.anonKey, Authorization: 'Bearer ' + SUPABASE.anonKey }
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r.json();
    });
  }

  function loadFromTables() {
    return fetch('tables/payments?page=1&limit=500', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Tables API ' + r.status);
        return r.json();
      })
      .then(function (j) { return (j && j.data) ? j.data : []; });
  }

  function loadRows() {
    var loader = supabaseReady() ? loadFromSupabase : loadFromTables;
    state.source = supabaseReady() ? 'supabase' : 'tables';

    var label = $('#store-label');
    if (label) label.textContent = 'Store: ' + (state.source === 'supabase' ? 'Supabase' : 'Project tables API');

    var note = $('#store-note');
    if (note) {
      note.innerHTML = state.source === 'supabase'
        ? 'Reading live payment records from Supabase (<code>' + esc(SUPABASE.paymentsTable) + '</code>).'
        : 'Supabase is not configured, so records are read from this project&rsquo;s own <code>payments</code> table. ' +
          'Add <code>SUPABASE.url</code> and <code>SUPABASE.anonKey</code> in <code>js/config.js</code> to switch.';
    }

    return loader()
      .then(function (rows) {
        /* Newest first, whichever store answered. */
        state.rows = (rows || []).slice().sort(function (a, b) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(state.rows)); } catch (e) { /* ignore */ }
        render();
      })
      .catch(function () {
        /* Fall back to the last successful read so the dashboard is never blank. */
        var cached = null;
        try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { cached = null; }
        if (cached && cached.length) {
          state.rows = cached;
          render();
          if (note) note.innerHTML = '<strong>Showing the last loaded records</strong> — the data store could not be reached just now.';
        } else {
          state.rows = [];
          render();
          if (note) note.innerHTML = '<strong>No records available.</strong> The data store could not be reached. ' +
            'A newly deployed database starts empty; send a test gift from the site to create the first row.';
        }
      });
  }

  /* ---------------- Filtering ---------------- */
  function filtered() {
    var q = state.query.trim().toLowerCase();
    return state.rows.filter(function (r) {
      if (state.status !== 'all' && String(r.status || '').toLowerCase() !== state.status) return false;
      if (!q) return true;
      return [r.reference, r.payer_name, r.payer_email, r.purpose, r.gateway_reference]
        .some(function (v) { return String(v || '').toLowerCase().indexOf(q) > -1; });
    });
  }

  /* ---------------- Rendering ---------------- */
  function render() {
    var rows = state.rows;
    var confirmed = rows.filter(function (r) { return String(r.status).toLowerCase() === 'confirmed'; });
    var pending = rows.filter(function (r) { return String(r.status).toLowerCase() === 'pending'; });

    var total = confirmed.reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0);
    var pendingTotal = pending.reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0);
    var avg = confirmed.length ? Math.round(total / confirmed.length) : 0;

    setText('#kpi-total', money(total, 'NGN'));
    setText('#kpi-total-foot', rows.length + ' record' + (rows.length === 1 ? '' : 's') + ' total');

    setText('#kpi-confirmed', String(confirmed.length));
    setText('#kpi-confirmed-foot', confirmed.length ? 'Receipts available' : 'None yet');

    setText('#kpi-pending', String(pending.length));
    setText('#kpi-pending-foot', pending.length ? money(pendingTotal, 'NGN') + ' awaiting' : 'All settled');

    setText('#kpi-average', avg ? money(avg, 'NGN') : '—');
    setText('#kpi-average-foot', confirmed.length ? 'Across confirmed gifts' : '—');

    renderChart(rows);
    renderActivity(rows);
    renderTable();
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text;
  }

  function renderChart(rows) {
    var box = $('#chart-purpose');
    if (!box) return;

    var buckets = {};
    rows.forEach(function (r) {
      if (String(r.status).toLowerCase() !== 'confirmed') return;
      var key = r.purpose || 'Wedding Gift';
      buckets[key] = (buckets[key] || 0) + (Number(r.amount) || 0);
    });

    var entries = Object.keys(buckets).map(function (k) { return [k, buckets[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });

    if (!entries.length) {
      box.innerHTML = '<p class="admin-empty">No confirmed gifts yet.</p>';
      return;
    }

    var max = entries[0][1] || 1;
    box.innerHTML = entries.map(function (pair) {
      var pct = Math.max(4, Math.round((pair[1] / max) * 100));
      return '<div class="bar-row">' +
        '<span class="bar-name">' + esc(pair[0]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="bar-value">' + esc(money(pair[1], 'NGN')) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderActivity(rows) {
    var list = $('#activity-list');
    if (!list) return;

    var recent = rows.slice(0, 6);
    if (!recent.length) {
      list.innerHTML = '<li class="admin-empty">No payments recorded yet.</li>';
      return;
    }

    list.innerHTML = recent.map(function (r) {
      var st = String(r.status || 'pending').toLowerCase();
      return '<li class="activity-item">' +
        '<span class="activity-dot is-' + esc(st) + '" aria-hidden="true"></span>' +
        '<span class="activity-body">' +
          '<strong>' + esc(r.payer_name || 'Guest') + '</strong> gave ' +
          esc(money(r.amount, r.currency || 'NGN')) +
          '<small>' + esc(r.purpose || 'Wedding Gift') + ' · ' + esc(fmtDateTime(r.created_at)) + '</small>' +
        '</span>' +
      '</li>';
    }).join('');
  }

  function statusPill(status) {
    var st = String(status || 'pending').toLowerCase();
    var label = st.charAt(0).toUpperCase() + st.slice(1);
    return '<span class="pill is-' + esc(st) + '">' + esc(label) + '</span>';
  }

  function renderTable() {
    var body = $('#pay-rows');
    if (!body) return;

    var rows = filtered();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="admin-empty">' +
        (state.rows.length ? 'No records match your search.' : 'No payments recorded yet.') +
        '</td></tr>';
      return;
    }

    body.innerHTML = rows.map(function (r) {
      var st = String(r.status || 'pending').toLowerCase();
      var idx = state.rows.indexOf(r);
      return '<tr>' +
        '<td data-label="Reference"><code class="ref">' + esc(r.reference || r.id || '—') + '</code></td>' +
        '<td data-label="Payer">' +
          '<span class="payer">' + esc(r.payer_name || '—') + '</span>' +
          '<small class="payer-mail">' + esc(r.payer_email || '') + '</small>' +
        '</td>' +
        '<td data-label="Purpose">' + esc(r.purpose || 'Wedding Gift') + '</td>' +
        '<td data-label="Amount" class="num">' + esc(money(r.amount, r.currency || 'NGN')) + '</td>' +
        '<td data-label="Status">' + statusPill(r.status) + '</td>' +
        '<td data-label="Date" class="when">' + esc(fmtDateTime(r.created_at || r.paid_at)) + '</td>' +
        '<td data-label="Actions" class="row-actions">' +
          '<button class="icon-btn" type="button" data-receipt="' + idx + '" ' +
            'aria-label="Download receipt for ' + esc(r.reference || 'this gift') + '" title="Download receipt">' +
            '<i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i></button>' +
          (st === 'confirmed'
            ? '<button class="icon-btn" type="button" data-unconfirm="' + idx + '" ' +
              'aria-label="Mark ' + esc(r.reference || 'this gift') + ' as pending" title="Mark as pending">' +
              '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>'
            : '<button class="icon-btn" type="button" data-confirm="' + idx + '" ' +
              'aria-label="Confirm ' + esc(r.reference || 'this gift') + '" title="Confirm payment">' +
              '<i class="fa-solid fa-check" aria-hidden="true"></i></button>') +
        '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------------- Supabase update (confirm / unconfirm) ---------------- */
  function updateStatus(record, status) {
    if (!record) return Promise.resolve();

    if (supabaseReady()) {
      var base = SUPABASE.url.replace(/\/$/, '');
      var url = base + '/rest/v1/' + SUPABASE.paymentsTable + '?reference=eq.' + encodeURIComponent(record.reference);
      return fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE.anonKey,
          Authorization: 'Bearer ' + SUPABASE.anonKey
        },
        body: JSON.stringify({ status: status })
      }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); });
    }

    var id = record.id || record.reference;
    return fetch('tables/payments/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status: status })
    }).then(function (r) { if (!r.ok) throw new Error('Tables API ' + r.status); });
  }

  /* ---------------- PDF receipt (same layout as the public flow) ---------------- */
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('unavailable'));
      };
      s.onerror = function () { reject(new Error('failed')); };
      document.head.appendChild(s);
    });
  }

  function receiptRows(rec) {
    return [
      ['Reference', rec.reference || '—'],
      ['Payer', rec.payer_name || '—'],
      ['Email', rec.payer_email || '—'],
      ['Amount', money(rec.amount, rec.currency || 'NGN')],
      ['Purpose', rec.purpose || 'Wedding Gift'],
      ['Status', String(rec.status || 'pending').toUpperCase()],
      ['Date', fmtDateTime(rec.created_at || rec.paid_at || new Date())],
      ['Gateway', rec.gateway || 'Zainpay']
    ];
  }

  function downloadReceipt(rec) {
    if (!rec) return Promise.resolve();
    return loadJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var W = doc.internal.pageSize.getWidth();
      var M = 56;
      var y = 0;

      doc.setFillColor(112, 49, 4);
      doc.rect(0, 0, W, 118, 'F');
      doc.setTextColor(255, 248, 173);
      doc.setFont('times', 'italic');
      doc.setFontSize(26);
      doc.text('Charity & Usman', M, 58);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(217, 207, 182);
      doc.text('THE CHARISMA WEDDING  ·  #Charisma2026', M, 82);

      y = 160;
      doc.setTextColor(36, 26, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text('Proof of Payment / Receipt', M, y);

      y += 14;
      doc.setDrawColor(186, 170, 135);
      doc.line(M, y, W - M, y);
      y += 34;

      receiptRows(rec).forEach(function (pair) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(138, 125, 108);
        doc.text(String(pair[0]).toUpperCase(), M, y);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(36, 26, 16);
        var lines = doc.splitTextToSize(String(pair[1]), W - M - 220);
        doc.text(lines, W - M, y, { align: 'right' });

        y += 12 * lines.length + 14;
        doc.setDrawColor(232, 226, 212);
        doc.line(M, y - 12, W - M, y - 12);
        y += 8;
      });

      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(92, 79, 64);
      doc.text(doc.splitTextToSize(
        'Thank you for blessing Usman Fori & Charity Ishaku. This receipt confirms that the gift above ' +
        'was recorded against reference ' + (rec.reference || '') + '. ' +
        'Ceremony 9:00 AM, 12 December 2026 — EYN LCC Abuja Sharaton, Maiduguri. ' +
        'Reception 11:00 AM — ASUU Hall, University of Maiduguri.', W - M * 2), M, y);

      doc.setFontSize(8);
      doc.setTextColor(138, 125, 108);
      doc.text('Coffee (Usman)  &  Vanilla (Charity)', M, doc.internal.pageSize.getHeight() - 48);

      doc.save('charisma2026-receipt-' + (rec.reference || 'gift') + '.pdf');
    });
  }

  /* ---------------- CSV export ---------------- */
  function exportCsv() {
    var rows = filtered();
    if (!rows.length) return;

    var cols = ['reference', 'payer_name', 'payer_email', 'amount', 'currency',
      'purpose', 'status', 'gateway', 'created_at'];
    var head = cols.join(',');
    var body = rows.map(function (r) {
      return cols.map(function (c) {
        var v = r[c] == null ? '' : String(r[c]);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');

    var blob = new Blob([head + '\r\n' + body], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'charisma2026-gifts-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------------- Sign-in gate ---------------- */
  function unlock() {
    var gate = $('#admin-gate');
    var shell = $('#admin-shell');
    if (gate) gate.hidden = true;
    if (shell) shell.hidden = false;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
    loadRows();
  }

  function lockDash() {
    var gate = $('#admin-gate');
    var shell = $('#admin-shell');
    if (gate) gate.hidden = false;
    if (shell) shell.hidden = true;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    var pass = $('#gate-pass');
    if (pass) pass.value = '';
  }

  function initGate() {
    var form = $('#gate-form');
    if (!form) { unlock(); return; }

    var status = $('#gate-status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = $('#gate-pass');
      var value = pass ? pass.value : '';

      if (value === ADMIN_PASSCODE) {
        if (status) { status.textContent = ''; status.classList.remove('is-err'); }
        unlock();
      } else {
        if (pass) pass.setAttribute('aria-invalid', 'true');
        if (status) {
          status.textContent = 'Incorrect passcode. Try again.';
          status.classList.add('is-err');
        }
      }
    });

    var lock = $('#lock-btn');
    if (lock) lock.addEventListener('click', lockDash);

    /* Resume an unlocked session within the same tab. */
    var resumed = false;
    try { resumed = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { resumed = false; }
    if (resumed) unlock();
  }

  /* ---------------- Events ---------------- */
  function initEvents() {
    var search = $('#pay-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        renderTable();
      });
    }

    var filter = $('#pay-filter');
    if (filter) {
      filter.addEventListener('change', function () {
        state.status = filter.value;
        renderTable();
      });
    }

    var refresh = $('#refresh-btn');
    if (refresh) {
      refresh.addEventListener('click', function () {
        refresh.disabled = true;
        loadRows().then(function () { refresh.disabled = false; });
      });
    }

    var csv = $('#csv-btn');
    if (csv) csv.addEventListener('click', exportCsv);

    var body = $('#pay-rows');
    if (body) {
      body.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-receipt], button[data-confirm], button[data-unconfirm]');
        if (!btn) return;

        if (btn.hasAttribute('data-receipt')) {
          var rec = state.rows[Number(btn.getAttribute('data-receipt'))];
          btn.disabled = true;
          downloadReceipt(rec).catch(function () { /* ignore */ })
            .then(function () { btn.disabled = false; });
          return;
        }

        var confirming = btn.hasAttribute('data-confirm');
        var idx = Number(btn.getAttribute(confirming ? 'data-confirm' : 'data-unconfirm'));
        var row = state.rows[idx];
        if (!row) return;

        btn.disabled = true;
        updateStatus(row, confirming ? 'confirmed' : 'pending')
          .then(function () {
            row.status = confirming ? 'confirmed' : 'pending';
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(state.rows)); } catch (err) { /* ignore */ }
            render();
          })
          .catch(function () { btn.disabled = false; });
      });
    }
  }

  function boot() {
    initGate();
    initEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
