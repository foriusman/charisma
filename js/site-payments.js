/* ============================================================
   Charisma 2026 — gifting, receipts & keep-alive
   Tasks 4 (Drive media), 5 (Zainpay), 6 (keep-alive),
   7 (payment records + PDF receipt), 8 (Jotform CTA)

   Loaded after js/config.js on index.html only.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

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

  function nowIso() { return new Date().toISOString(); }

  function makeReference() {
    var stamp = Date.now().toString(36).toUpperCase().slice(-5);
    var rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    return 'CH26-' + stamp + rand;
  }

  /* ---------------- Payment store ----------------
     Supabase when configured (Task 7), otherwise this project's own
     tables API so the flow and dashboard work out of the box. */
  function supabaseReady() {
    return !!(window.SUPABASE && SUPABASE.url && SUPABASE.anonKey);
  }

  var LOCAL_PAYMENTS_KEY = 'charisma-local-payments';

  function isLocalPreview() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  }

  function readLocalPayments() {
    try { return JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function storeLocalPayment(record) {
    var records = readLocalPayments().filter(function (item) { return item.reference !== record.reference; });
    records.unshift(record);
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(records));
    return Promise.resolve([record]);
  }

  function storePayment(record) {
    if (supabaseReady()) {
      var base = SUPABASE.url.replace(/\/$/, '');
      return fetch(base + '/rest/v1/' + SUPABASE.paymentsTable, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE.anonKey,
          Authorization: 'Bearer ' + SUPABASE.anonKey,
          Prefer: 'return=representation'
        },
        body: JSON.stringify(record)
      }).then(function (r) {
        if (!r.ok) throw new Error('Supabase ' + r.status);
        return r.json();
      });
    }

    return fetch('tables/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(record)
    }).then(function (r) {
      if (!r.ok) throw new Error('Tables API ' + r.status);
      return r.json();
    }).catch(function (error) {
      if (!isLocalPreview()) throw error;
      return storeLocalPayment(record);
    });
  }

  function uploadTransferReceipt(record, file) {
    var base = SUPABASE.url.replace(/\/$/, '');
    var bucket = SUPABASE.receiptsBucket || 'payment-receipts';
    var extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    var path = record.reference + '/' + crypto.randomUUID() + '.' + extension;
    var encodedPath = path.split('/').map(encodeURIComponent).join('/');

    return fetch(base + '/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodedPath, {
      method: 'POST',
      headers: {
        apikey: SUPABASE.anonKey,
        Authorization: 'Bearer ' + SUPABASE.anonKey,
        'Content-Type': file.type,
        'x-upsert': 'false'
      },
      body: file
    }).then(function (response) {
      if (!response.ok) throw new Error('Storage upload ' + response.status);
      return fetch(base + '/rest/v1/' + SUPABASE.paymentsTable, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE.anonKey,
          Authorization: 'Bearer ' + SUPABASE.anonKey,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(Object.assign({}, record, { receipt_path: path }))
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('Supabase payment record ' + response.status);
    });
  }

  function initReceiptUpload() {
    var form = $('#receipt-upload-form');
    if (!form) return;
    var status = $('#receipt-upload-status');
    var submit = $('#receipt-upload-submit');

    function setStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle('is-err', !!isError);
      status.classList.toggle('is-ok', !!message && !isError);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = $('#transfer-name').value.trim();
      var email = $('#transfer-email').value.trim();
      var amount = Number($('#transfer-amount').value);
      var referenceNote = $('#transfer-reference').value.trim();
      var file = $('#transfer-file').files[0];
      var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

      if (!supabaseReady()) return setStatus('Receipt uploads are not configured yet. Please contact the couple.', true);
      if (!name || name.length > 80) return setStatus('Enter your name (up to 80 characters).', true);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return setStatus('Enter a valid email address.', true);
      if (!Number.isFinite(amount) || amount < 100 || amount > 10000000 || Math.round(amount * 100) !== amount * 100) {
        return setStatus('Enter an amount between ₦100 and ₦10,000,000, with up to two decimal places.', true);
      }
      if (!file || allowedTypes.indexOf(file.type) === -1) return setStatus('Choose a JPG, PNG, WebP or PDF receipt.', true);
      if (file.size > 8 * 1024 * 1024) return setStatus('The receipt file must be 8 MB or smaller.', true);

      var record = {
        reference: makeReference(),
        payer_name: name,
        payer_email: email,
        amount: amount,
        currency: 'NGN',
        purpose: 'Wedding Donation',
        note: referenceNote,
        status: 'pending',
        gateway: 'Bank Transfer',
        gateway_reference: '',
        paid_at: null,
        created_at: nowIso()
      };

      setStatus('Uploading receipt securely…', false);
      submit.disabled = true;
      uploadTransferReceipt(record, file).then(function () {
        form.reset();
        setStatus('Receipt submitted for review. Your reference is ' + record.reference + '.', false);
      }).catch(function () {
        setStatus('We could not submit the receipt. Check your connection and try again.', true);
      }).then(function () { submit.disabled = false; });
    });
  }

  /* ---------------- Task 5: Zainpay charge ----------------
     Live mode requires a server endpoint that holds the secret key
     and returns { checkoutUrl }. A static page must never carry a
     secret key, so we only ever send non-sensitive fields. */
  function startCharge(payload) {
    if (typeof ZAINPAY === 'undefined' || ZAINPAY.mode === 'demo') return Promise.resolve({ demo: true });
    if (ZAINPAY.mode !== 'live') {
      return Promise.reject(new Error('Unsupported Zainpay payment mode.'));
    }
    if (!ZAINPAY.chargeEndpoint) {
      return Promise.reject(new Error('Zainpay live mode requires a server charge endpoint.'));
    }

    return fetch(ZAINPAY.chargeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('Charge endpoint ' + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || typeof data.checkoutUrl !== 'string' || !data.checkoutUrl.trim()) {
        throw new Error('Charge endpoint did not return a checkout URL.');
      }
      var checkoutUrl = new URL(data.checkoutUrl, window.location.href);
      if (checkoutUrl.protocol !== 'https:' || !/(^|\.)zainpay\.ng$/.test(checkoutUrl.hostname)) {
        throw new Error('Charge endpoint returned an invalid checkout URL.');
      }
      sessionStorage.setItem('charisma-payment', data.token);
      window.location.assign(checkoutUrl.href);
      return { redirecting: true };
    });
  }

  /* ---------------- Receipt rendering ---------------- */
  var lastReceipt = null;

  function receiptRows(rec) {
    return [
      ['Reference', rec.reference],
      ['Payer', rec.payer_name],
      ['Email', rec.payer_email],
      ['Amount', money(rec.amount, rec.currency)],
      ['Purpose', rec.purpose || 'Wedding Gift'],
      ['Status', String(rec.status || 'pending').toUpperCase()],
      ['Date', new Date(rec.created_at || Date.now()).toLocaleString()],
      ['Gateway', rec.gateway || 'Zainpay']
    ];
  }

  function paintReceipt(rec) {
    var box = $('#receipt-lines');
    if (!box) return;
    box.innerHTML = receiptRows(rec).map(function (pair) {
      return '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd></div>';
    }).join('');
  }

  /* Builds the PDF with jsPDF (loaded on demand from jsDelivr). */
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF unavailable'));
      };
      s.onerror = function () { reject(new Error('jsPDF failed to load')); };
      document.head.appendChild(s);
    });
  }

  function downloadReceipt(rec) {
    if (!rec) return;
    return loadJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var W = doc.internal.pageSize.getWidth();
      var M = 56;
      var y = 0;

      /* Header band */
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
      doc.setLineWidth(1);
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
      doc.text(
        doc.splitTextToSize(
          'Thank you for blessing Usman Fori & Charity Ishaku. This receipt confirms that the ' +
          'gift above was recorded against reference ' + rec.reference + '. ' +
          'Ceremony: 9:00 AM, 12 December 2026 — EYN LCC Abuja Sharaton, Maiduguri. ' +
          'Reception: 11:00 AM — ASUU Hall, University of Maiduguri.',
          W - M * 2
        ), M, y);

      doc.setFontSize(8);
      doc.setTextColor(138, 125, 108);
      doc.text('Coffee (Usman)  &  Vanilla (Charity)', M, doc.internal.pageSize.getHeight() - 48);

      doc.save('charisma2026-receipt-' + rec.reference + '.pdf');
    });
  }

  /* ---------------- Modals ---------------- */
  function openModal(el) {
    if (!el) return;
    el.hidden = false;
    document.body.classList.add('nav-open');
  }
  function closeModal(el) {
    if (!el || el.hidden) return;
    el.hidden = true;
    if (!$('#pay-modal') || $('#pay-modal').hidden) {
      if (!$('#receipt-modal') || $('#receipt-modal').hidden) {
        document.body.classList.remove('nav-open');
      }
    }
  }

  function initPayFlow() {
    var modal = $('#pay-modal');
    var form = $('#pay-form');
    if (!modal || !form) return;

    var status = $('#pay-status');
    var submit = $('#pay-submit');
    var amount = $('#pay-amount');
    var chips = $$('.amount-chip');
    var modeNote = $('#pay-mode-note');

    if (modeNote && typeof ZAINPAY !== 'undefined' && ZAINPAY.mode === 'live') {
      modeNote.textContent = 'Your payment will be completed securely on Zainpay. A receipt is issued only after payment is verified.';
    }

    function setStatus(msg, cls) {
      if (!status) return;
      status.textContent = msg || '';
      status.classList.remove('is-ok', 'is-err');
      if (cls) status.classList.add(cls);
    }

    $$('#open-pay').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setStatus('');
        openModal(modal);
        var first = $('#pay-name');
        if (first) setTimeout(function () { first.focus(); }, 60);
      });
    });

    var closeBtn = $('#pay-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (amount) amount.value = chip.getAttribute('data-amount');
        chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        if (amount) amount.removeAttribute('aria-invalid');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameEl = $('#pay-name');
      var emailEl = $('#pay-email');
      var purposeEl = $('#pay-purpose');
      var noteEl = $('#pay-note');

      var name = nameEl ? nameEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      var amt = amount ? Number(amount.value) : 0;

      [nameEl, emailEl, amount].forEach(function (el) { if (el) el.removeAttribute('aria-invalid'); });

      if (!name) {
        if (nameEl) { nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus(); }
        return setStatus('Please enter your name.', 'is-err');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (emailEl) { emailEl.setAttribute('aria-invalid', 'true'); emailEl.focus(); }
        return setStatus('Please enter a valid email for your receipt.', 'is-err');
      }
      if (!amt || amt < 100) {
        if (amount) { amount.setAttribute('aria-invalid', 'true'); amount.focus(); }
        return setStatus('Please enter a gift amount of at least ₦100.', 'is-err');
      }

      var reference = makeReference();
      var record = {
        reference: reference,
        payer_name: name,
        payer_email: email,
        amount: amt,
        currency: (typeof ZAINPAY !== 'undefined' && ZAINPAY.currency) || 'NGN',
        purpose: purposeEl ? purposeEl.value : 'Wedding Gift',
        note: noteEl ? noteEl.value.trim() : '',
        status: 'pending',
        gateway: 'Zainpay',
        gateway_reference: '',
        paid_at: nowIso(),
        created_at: nowIso()
      };

      setStatus('Recording your gift…', '');
      if (submit) submit.disabled = true;

      startCharge({
        amount: amt,
        email: email,
        name: name,
        reference: reference,
        phone: $('#pay-phone').value.trim(),
        purpose: record.purpose,
        note: record.note,
        currency: record.currency
      })
        .then(function (charge) {
          if (charge && charge.redirecting) return null;

          /* Demo / offline confirmation. A live integration flips this to
             'confirmed' from the Zainpay webhook handler instead. */
          record.status = 'demo';
          record.gateway_reference = 'DEMO-' + reference;
          return storePayment(record);
        })
        .then(function (saved) {
          if (saved === null) return; /* redirected to checkout */

          lastReceipt = record;
          paintReceipt(record);

          var lead = $('#receipt-lead');
          if (lead) {
            lead.textContent = 'Your gift of ' + money(record.amount, record.currency) +
              ' has been recorded. Download your receipt below.';
          }

          closeModal(modal);
          openModal($('#receipt-modal'));
          form.reset();
          chips.forEach(function (c) { c.classList.remove('is-active'); });
        })
        .catch(function () {
          setStatus('We could not record that just now. Please try again.', 'is-err');
        })
        .then(function () { if (submit) submit.disabled = false; });
    });

    if (new URLSearchParams(location.search).has('payment')) {
      openModal(modal);
      setStatus('Checking payment with Zainpay...');
      var token = sessionStorage.getItem('charisma-payment');
      if (!token) setStatus('Payment session unavailable. Contact us with your Zainpay reference.', 'is-err');
      else fetch(ZAINPAY.webhookConfirmPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token })
      }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (result) {
          if (!result.receipt || result.receipt.status !== 'confirmed') throw new Error();
          lastReceipt = result.receipt;
          paintReceipt(lastReceipt);
          $('#receipt-lead').textContent = 'Your payment has been verified. Thank you for your gift.';
          closeModal(modal); openModal($('#receipt-modal'));
          sessionStorage.removeItem('charisma-payment');
          history.replaceState(null, '', location.pathname + location.hash);
        }).catch(function () { setStatus('Payment is not yet verified. Refresh to check again; do not pay again if already charged.', 'is-err'); });
    }

    var rClose = $('#receipt-close');
    var rModal = $('#receipt-modal');
    if (rClose) rClose.addEventListener('click', function () { closeModal(rModal); });
    if (rModal) rModal.addEventListener('click', function (e) { if (e.target === rModal) closeModal(rModal); });

    var dl = $('#download-receipt');
    if (dl) {
      dl.addEventListener('click', function () {
        if (!lastReceipt) return;
        dl.disabled = true;
        var original = dl.innerHTML;
        dl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing…';
        downloadReceipt(lastReceipt)
          .catch(function () {
            /* Fall back to the browser's print-to-PDF if jsPDF is blocked. */
            window.print();
          })
          .then(function () { dl.disabled = false; dl.innerHTML = original; });
      });
    }

    var print = $('#print-receipt');
    if (print) print.addEventListener('click', function () { window.print(); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeModal(modal);
      closeModal($('#receipt-modal'));
    });
  }

  /* ---------------- Task 8: Jotform CTA ---------------- */
  function initJotform() {
    var cta = $('#jotform-cta');
    if (!cta) return;

    var url = (window.JOTFORM && JOTFORM.prayerFormUrl) || cta.getAttribute('href');
    var isPlaceholder = /000000000000000/.test(url) || url === '#';

    if (!isPlaceholder) {
      cta.href = url;
      cta.setAttribute('data-jotform-url', url);
      return;
    }

    /* Keep the honest placeholder state visible rather than opening a dead tab. */
    cta.href = '#';
    cta.removeAttribute('target');
    cta.setAttribute('aria-disabled', 'true');
    cta.addEventListener('click', function (e) {
      e.preventDefault();
      var note = $('#jotform-note');
      if (note) {
        note.textContent = 'Add your Jotform URL to JOTFORM.prayerFormUrl in js/config.js to activate this button.';
      }
    });
  }

  /* ---------------- Task 6: keep-alive ping ----------------
     Pings on an interval to keep the deployed site warm. A static
     page cannot run while closed — the always-on version is the
     scheduled workflow documented in README.md. */
  function initKeepAlive() {
    if (!window.KEEPALIVE || !KEEPALIVE.enabled) return;

    var target = KEEPALIVE.pingPath
      ? KEEPALIVE.pingPath
      : window.location.pathname + '?keepalive=' + Date.now();

    var url = target;
    if (!/^https?:/i.test(target)) {
      url = window.location.origin + (target.charAt(0) === '/' ? '' : '/') + target;
    }

    var pings = 0;
    var every = Math.max(1, Number(KEEPALIVE.intervalMinutes) || 10) * 60 * 1000;
    var cap = Number(KEEPALIVE.maxPingsPerSession) || 24;

    function ping() {
      if (pings >= cap) return;
      pings += 1;
      /* no-cors + fire-and-forget: we only need the request to land. */
      try {
        fetch(url, { method: 'GET', cache: 'no-store', mode: 'no-cors', keepalive: true })
          .catch(function () { /* offline is fine */ });
      } catch (e) { /* ignore */ }
    }

    /* First ping shortly after load (let the page settle), then schedule. */
    setTimeout(ping, 8000);
    setInterval(ping, every);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) ping();
    });
  }

  function boot() {
    initJotform();
    initPayFlow();
    initReceiptUpload();
    initKeepAlive();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
