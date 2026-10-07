/* ============================================================
   Charisma 2026 — interaction layer
   Sections: preloader · header · reveal · countdown · story ·
   reel slider · gifts · palette · gallery + lightbox · prayers ·
   directions map · calendar & share
   ============================================================ */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* Escape untrusted text before injecting into innerHTML. */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Rewrite a sized CDN url to the width we need for a given context. */
  function sized(url, w) {
    if (!url) return '';
    if (/width=\d+/.test(url)) return url.replace(/width=\d+/, 'width=' + w);
    return url;
  }

  function fmtDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return d.toDateString(); }
  }

  /* ---------------- Data access (tables API + fallback) ---------------- */
  var API_BASE = 'tables/';

  function fallbackFor(name) {
    var list = (window.FALLBACK && window.FALLBACK[name]) ? window.FALLBACK[name].slice() : [];
    var by = arguments.length > 1 ? arguments[1] : null;
    return { rows: list, offline: true };
  }

  function getRows(name, opts) {
    opts = opts || {};
    var qs = '?page=1&limit=' + (opts.limit || 100) + (opts.sort ? '&sort=' + encodeURIComponent(opts.sort) : '');
    return fetch(API_BASE + name + qs, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error(name + ' -> HTTP ' + r.status);
        return r.json();
      })
      .then(function (payload) {
        var rows = (payload && payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        return { rows: rows, offline: false };
      })
      .catch(function () {
        return fallbackFor(name);
      });
  }

  function postRow(name, body) {
    return fetch(API_BASE + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------------- Preloader ---------------- */
  function initPreloader() {
    var el = $('#preloader');
    if (!el) return;
    var done = function () { el.classList.add('is-done'); };
    if (document.readyState === 'complete') setTimeout(done, 320);
    else window.addEventListener('load', function () { setTimeout(done, 320); });
    setTimeout(done, 2600); /* safety net */
  }

  /* ---------------- Header: sticky state, scrollspy, mobile nav ---------------- */
  function initHeader() {
    var header = $('#site-header');
    var toggle = $('#nav-toggle');
    var nav = $('#primary-nav');
    var links = $$('#primary-nav a');
    var toTop = $('#to-top');
    if (!header) return;

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      /* Hysteresis: don't toggle the background right at the threshold, or the
         bar flickers while the user scrolls slowly. */
      if (y > 72) header.classList.add('is-stuck');
      else if (y < 48) header.classList.remove('is-stuck');

      if (toTop) toTop.classList.toggle('is-visible', y > 700);
    }

    /* rAF-throttle so we read/write layout at most once per frame. */
    var ticking = false;
    function requestScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        onScroll();
      });
    }

    onScroll();
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll, { passive: true });

    function closeNav() {
      if (!nav) return;
      nav.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      }
    }

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        document.body.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
    }

    links.forEach(function (a) { a.addEventListener('click', closeNav); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    /* A resize that promotes the layout past the mobile breakpoint must not
       leave the drawer stuck open behind the desktop nav. */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeNav();
    }, { passive: true });

    document.addEventListener('click', function (e) {
      if (!nav || !nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || (toggle && toggle.contains(e.target))) return;
      closeNav();
    });

    /* Scrollspy on the sections named by the nav */
    var targets = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if ('IntersectionObserver' in window && targets.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach(function (t) { spy.observe(t); });
    }

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* Lets content injected after load participate in the reveal animation. */
  function observeDynamic(root) {
    var items = $$('.reveal', root).filter(function (el) { return !el.classList.contains('is-visible'); });
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      });
    }, { threshold: 0.1 });
    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 60, 360) + 'ms';
      io.observe(el);
    });
  }

  /* ---------------- Countdown ---------------- */
  function initCountdown() {
    var box = $('#countdown');
    if (!box) return;
    var target = new Date(box.getAttribute('data-target') || WEDDING.dateISO).getTime();
    var label = $('.countdown-label', box);
    var cells = {
      days: $('[data-unit="days"]', box),
      hours: $('[data-unit="hours"]', box),
      minutes: $('[data-unit="minutes"]', box),
      seconds: $('[data-unit="seconds"]', box)
    };
    var grid = $('.countdown-grid', box);

    function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }

    function tick() {
      var diff = target - Date.now();

      if (diff <= 0) {
        if (label) label.textContent = 'Today is the day — welcome!';
        if (grid) {
          grid.innerHTML = '<p style="color:var(--cream);font-size:1.05rem;margin:0;letter-spacing:.08em">' +
            'The Charisma Wedding · 12 December 2026</p>';
        }
        return clearInterval(timer);
      }

      var s = Math.floor(diff / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;

      if (cells.days) cells.days.textContent = d;
      if (cells.hours) cells.hours.textContent = pad(h);
      if (cells.minutes) cells.minutes.textContent = pad(m);
      if (cells.seconds) cells.seconds.textContent = pad(sec);
    }

    tick();
    var timer = setInterval(tick, 1000);
  }

  /* ---------------- Love story ---------------- */
  function renderStory(res) {
    var list = $('#story-timeline');
    if (!list) return;
    var rows = (res.rows || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    if (!rows.length) {
      list.innerHTML = '<li class="timeline-loading">Our story is being written…</li>';
      list.removeAttribute('aria-busy');
      return;
    }

    list.innerHTML = rows.map(function (r) {
      return '<li class="story-item reveal">' +
        '<span class="story-badge" aria-hidden="true"><i class="' + esc(r.icon || 'fa-solid fa-heart') + '"></i></span>' +
        '<div class="story-card">' +
          '<p class="story-chapter">' + esc(r.chapter || '') + '</p>' +
          '<h3>' + esc(r.title || '') + '</h3>' +
          (r.date_label ? '<p class="story-date">' + esc(r.date_label) + '</p>' : '') +
          '<p class="story-text">' + esc(r.story || '') + '</p>' +
        '</div>' +
      '</li>';
    }).join('');

    list.removeAttribute('aria-busy');
    observeDynamic(list);
  }

  /* ---------------- Portrait film reel ---------------- */
  function initReel() {
    var track = $('#reel-track');
    var viewport = $('#reel-viewport');
    var prev = $('#reel-prev');
    var next = $('#reel-next');
    var dotsBox = $('#reel-dots');
    if (!track || !viewport) return;

    var items = (typeof REELS !== 'undefined') ? REELS : [];
    if (!items.length) return;

    track.innerHTML = items.map(function (r, i) {
      /* Task 4: prefer a Google Drive id when one is configured. */
      var resolved = (typeof resolveReelVideo === 'function')
        ? resolveReelVideo(r) : { url: r.video, kind: 'url' };
      return '<article class="reel-card" data-index="' + i + '" aria-label="' + esc(r.title) + '">' +
        '<video class="reel-video" muted loop playsinline preload="none" ' +
          'poster="' + esc(r.poster) + '" data-src="' + esc(resolved.url) + '" ' +
          'aria-hidden="true" tabindex="-1"></video>' +
        '<span class="reel-scrim" aria-hidden="true"></span>' +
        '<span class="reel-badge">' + esc(r.badge) + '</span>' +
        '<button class="reel-play" type="button" aria-label="Play ' + esc(r.title) + '"><i class="fa-solid fa-play" aria-hidden="true"></i></button>' +
        '<div class="reel-copy">' +
          '<h3>' + esc(r.title) + '</h3>' +
          '<p>' + esc(r.caption) + '</p>' +
        '</div>' +
      '</article>';
    }).join('');

    var cards = $$('.reel-card', track);
    var index = 0;

    if (dotsBox) {
      dotsBox.innerHTML = items.map(function (r, i) {
        return '<button class="reel-dot" type="button" role="tab" data-index="' + i +
          '" aria-label="Go to film ' + (i + 1) + ': ' + esc(r.title) + '"></button>';
      }).join('');
    }
    var dots = $$('.reel-dot', dotsBox || document.createElement('div'));

    function activate(play) {
      cards.forEach(function (c, i) {
        var on = i === index;
        c.classList.toggle('is-active', on);
        var v = $('.reel-video', c);
        if (!v) return;
        if (on && play) {
          if (!v.getAttribute('src')) v.setAttribute('src', v.getAttribute('data-src'));
          var p = v.play();
          if (p && p.catch) p.catch(function () { /* autoplay blocked: poster remains */ });
          c.classList.add('is-playing');
        } else if (!on) {
          v.pause();
          c.classList.remove('is-playing');
        }
      });
      dots.forEach(function (d, i) {
        var on = i === index;
        d.classList.toggle('is-active', on);
        d.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      move(play);
    }

    function move() {
      if (!cards.length) return;
      var card = cards[index];
      /* Measure relative to the FIRST card so the result does not depend on
         which element happens to be the track's offsetParent. */
      var offset = card.offsetLeft - cards[0].offsetLeft;
      var centred = offset - (viewport.clientWidth - card.offsetWidth) / 2;
      var target = Math.max(0, centred);
      track.style.transform = 'translate3d(' + (-target) + 'px,0,0)';
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === cards.length - 1;
    }

    function go(delta, play) {
      var n = Math.min(cards.length - 1, Math.max(0, index + delta));
      if (n === index) return;
      index = n;
      activate(play !== false);
      if (play !== false) restartAutoplay();
    }

    /* manual play button on a card */
    cards.forEach(function (c, i) {
      var btn = $('.reel-play', c);
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          index = i;
          activate(true);
          restartAutoplay();
        });
      }
    });

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { index = i; activate(true); restartAutoplay(); });
    });

    if (prev) prev.addEventListener('click', function () { go(-1, true); });
    if (next) next.addEventListener('click', function () { go(1, true); });

    /* keyboard support */
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1, true); }
    });
    track.setAttribute('tabindex', '0');

    /* touch swipe */
    var startX = 0, deltaX = 0, dragging = false;
    viewport.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX; deltaX = 0; dragging = true;
    }, { passive: true });
    viewport.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      deltaX = e.touches[0].clientX - startX;
    }, { passive: true });
    viewport.addEventListener('touchend', function () {
      dragging = false;
      if (Math.abs(deltaX) > 45) go(deltaX < 0 ? 1 : -1, true);
    });

    window.addEventListener('resize', function () { move(); });

    /* autoplay through the reel while it is on screen */
    var autoplayTimer = null;

    function stopAutoplay() {
      if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
    }
    function restartAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        if (document.hidden) return;
        index = (index + 1) % cards.length;
        activate(true);
      }, 6000);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { activate(true); restartAutoplay(); }
          else { stopAutoplay(); cards.forEach(function (c) { var v = $('.reel-video', c); if (v) v.pause(); }); }
        });
      }, { threshold: 0.45 });
      io.observe(viewport);
    } else {
      activate(false);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAutoplay();
      else restartAutoplay();
    });

    activate(true);
    restartAutoplay();
  }

  /* ---------------- Donation & gifting cards ---------------- */
  function renderGifts(res) {
    var rows = res.rows || [];
    var groups = {
      Donation: { el: $('#donation-list'), rows: [] },
      Gifting: { el: $('#gifting-list'), rows: [] }
    };

    rows.forEach(function (r) {
      var g = (r.group_name === 'Gifting') ? 'Gifting' : 'Donation';
      if (groups[g]) groups[g].rows.push(r);
    });

    Object.keys(groups).forEach(function (key) {
      var bucket = groups[key];
      if (!bucket.el) return;
      bucket.rows.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

      if (!bucket.rows.length) {
        bucket.el.innerHTML = '<p class="card-loading">Details coming soon…</p>';
        bucket.el.removeAttribute('aria-busy');
        return;
      }

      bucket.el.innerHTML = bucket.rows.map(function (r) {
        return '<article class="gift-card reveal">' +
          '<span class="gift-icon" aria-hidden="true"><i class="' + esc(r.icon || 'fa-solid fa-gift') + '"></i></span>' +
          '<h3>' + esc(r.title || '') + '</h3>' +
          '<p>' + esc(r.description || '') + '</p>' +
          (r.meta_label ? '<span class="gift-meta">' + esc(r.meta_label) + '</span>' : '') +
        '</article>';
      }).join('');
      bucket.el.removeAttribute('aria-busy');
      observeDynamic(bucket.el);
    });
  }

  /* ---------------- Gallery + filters + lightbox ---------------- */
  var galleryState = { items: [], filter: 'All', lightboxIndex: 0 };

  function renderGallery(res) {
    var grid = $('#gallery-grid');
    var filterBar = $('#gallery-filters');
    if (!grid) return;

    var rows = (res.rows || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    if (!rows.length) {
      grid.innerHTML = '<p class="card-loading">Photographs coming soon…</p>';
      grid.removeAttribute('aria-busy');
      if (filterBar) filterBar.innerHTML = '';
      return;
    }

    galleryState.items = rows.map(function (r) {
      /* Task 4: a configured Google Drive id wins; otherwise use the row URL. */
      var resolved = (typeof resolveGalleryImage === 'function')
        ? resolveGalleryImage(r) : { url: r.image_url, kind: 'url' };
      return {
        caption: r.caption || '',
        tag: r.tag || 'Gallery',
        thumb: resolved.kind === 'drive' ? resolved.url : sized(resolved.url, 900),
        large: resolved.kind === 'drive' ? resolved.url : sized(resolved.url, 1800)
      };
    });

    grid.innerHTML = rows.map(function (r, i) {
      var tag = r.tag || 'Gallery';
      var resolved = (typeof resolveGalleryImage === 'function')
        ? resolveGalleryImage(r) : { url: r.image_url, kind: 'url' };
      var src = resolved.kind === 'drive' ? resolved.url : sized(resolved.url, 900);
      return '<figure class="masonry-item reveal" data-tag="' + esc(tag) + '" data-index="' + i + '">' +
        '<button class="gallery-figure" type="button" aria-label="Open image: ' + esc(r.caption || 'wedding photograph') + '">' +
          '<img src="' + esc(src) + '" alt="' + esc(r.caption || 'Wedding photograph') + '" loading="lazy" decoding="async">' +
          '<span class="gallery-tag">' + esc(tag) + '</span>' +
          '<figcaption class="gallery-caption">' + esc(r.caption || '') + '</figcaption>' +
        '</button>' +
      '</figure>';
    }).join('');

    /* filters */
    if (filterBar) {
      var tags = ['All'];
      rows.forEach(function (r) {
        var t = r.tag || 'Gallery';
        if (tags.indexOf(t) === -1) tags.push(t);
      });

      filterBar.innerHTML = tags.map(function (t) {
        return '<button class="filter-btn' + (t === 'All' ? ' is-active' : '') +
          '" type="button" role="tab" aria-selected="' + (t === 'All') +
          '" data-filter="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('');

      $$('.filter-btn', filterBar).forEach(function (btn) {
        btn.addEventListener('click', function () {
          galleryState.filter = btn.getAttribute('data-filter');
          $$('.filter-btn', filterBar).forEach(function (b) {
            var on = b === btn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          applyGalleryFilter();
        });
      });
    }

    grid.removeAttribute('aria-busy');
    observeDynamic(grid);

    $$('.gallery-figure', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fig = btn.closest('.masonry-item');
        openLightbox(Number(fig.getAttribute('data-index')));
      });
    });
  }

  function visibleGalleryItems() {
    var visible = [];
    $$('#gallery-grid .masonry-item').forEach(function (el) {
      if (el.classList.contains('is-hidden')) return;
      visible.push(Number(el.getAttribute('data-index')));
    });
    return visible;
  }

  function applyGalleryFilter() {
    $$('#gallery-grid .masonry-item').forEach(function (el) {
      var match = galleryState.filter === 'All' || el.getAttribute('data-tag') === galleryState.filter;
      el.classList.toggle('is-hidden', !match);
    });
  }

  function openLightbox(index) {
    var box = $('#lightbox');
    if (!box || !galleryState.items.length) return;
    galleryState.lightboxIndex = index;
    paintLightbox();
    box.hidden = false;
    document.body.classList.add('nav-open');
    var close = $('#lightbox-close');
    if (close) close.focus();
  }

  function paintLightbox() {
    var item = galleryState.items[galleryState.lightboxIndex];
    if (!item) return;
    var img = $('#lightbox-img');
    var cap = $('#lightbox-caption');
    if (img) { img.src = item.large; img.alt = item.caption || 'Wedding photograph'; }
    if (cap) {
      cap.innerHTML = esc(item.caption || '') +
        (item.tag ? ' <span style="opacity:.7">· ' + esc(item.tag) + '</span>' : '');
    }
  }

  function stepLightbox(delta) {
    var order = visibleGalleryItems();
    if (!order.length) return;
    var pos = order.indexOf(galleryState.lightboxIndex);
    if (pos === -1) pos = 0;
    pos = (pos + delta + order.length) % order.length;
    galleryState.lightboxIndex = order[pos];
    paintLightbox();
  }

  function closeLightbox() {
    var box = $('#lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove('nav-open');
  }

  function initLightbox() {
    var box = $('#lightbox');
    if (!box) return;
    var close = $('#lightbox-close');
    var prev = $('#lightbox-prev');
    var next = $('#lightbox-next');

    if (close) close.addEventListener('click', closeLightbox);
    if (prev) prev.addEventListener('click', function () { stepLightbox(-1); });
    if (next) next.addEventListener('click', function () { stepLightbox(1); });

    box.addEventListener('click', function (e) { if (e.target === box) closeLightbox(); });

    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') stepLightbox(1);
      if (e.key === 'ArrowLeft') stepLightbox(-1);
    });
  }

  /* ---------------- Prayers: wall ----------------
     The submission form now lives on Jotform (Task 8); this module only
     renders the blessings wall. */
  function paintPrayers(rows, offline) {
    var list = $('#prayer-list');
    if (!list) return;

    var visible = rows.filter(function (r) { return r.approved !== false; });
    visible.sort(function (a, b) {
      return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    });

    if (!visible.length) {
      list.innerHTML = '<li class="card-loading">Be the first to leave a blessing.</li>';
      list.removeAttribute('aria-busy');
      return;
    }

    list.innerHTML = visible.map(function (r) {
      return '<li class="prayer-item">' +
        '<div class="prayer-head">' +
          '<span class="prayer-name">' + esc(r.guest_name || 'A well-wisher') + '</span>' +
          (r.relation ? '<span class="prayer-rel">' + esc(r.relation) + '</span>' : '') +
        '</div>' +
        '<p class="prayer-msg">' + esc(r.message || '') + '</p>' +
        (r.submitted_at ? '<span class="prayer-time">' + esc(fmtDate(r.submitted_at)) + '</span>' : '') +
      '</li>';
    }).join('');

    list.removeAttribute('aria-busy');
    if (offline) list.setAttribute('data-offline', 'true');
  }

  function loadPrayers() {
    return getRows('prayers', { limit: 100 }).then(function (res) {
      paintPrayers(res.rows, res.offline);
    });
  }

  /* ---- Task 8: prayer submissions happen on Jotform (see site-payments.js).
     The wall still reads whatever is stored in the prayers table. ---- */

  /* ---------------- Directions map ---------------- */
  function initMap() {
    var frame = $('#map-frame');
    var title = $('#map-title');
    var address = $('#map-address');
    var link = $('#map-link');
    var tabs = $$('.map-tab');
    if (!frame || !tabs.length) return;

    function embedUrl(lat, lng) {
      var d = 0.04;
      var bbox = [lng - d, lat - d / 2, lng + d, lat + d / 2].join('%2C');
      return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox +
        '&amp;layer=mapnik&marker=' + lat + '%2C' + lng;
    }

    function build(lat, lng) {
      return 'https://www.openstreetmap.org/export/embed.html?bbox=' +
        (lng - 0.04) + ',' + (lat - 0.02) + ',' + (lng + 0.04) + ',' + (lat + 0.02) +
        '&layer=mapnik&marker=' + lat + ',' + lng;
    }
    void embedUrl;

    function select(tab) {
      var lat = parseFloat(tab.getAttribute('data-lat'));
      var lng = parseFloat(tab.getAttribute('data-lng'));
      var t = tab.getAttribute('data-title') || '';
      var addr = tab.getAttribute('data-address') || '';

      tabs.forEach(function (b) {
        var on = b === tab;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      frame.src = build(lat, lng);
      if (title) title.textContent = t;
      if (address) address.textContent = addr;
      if (link) {
        link.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab); });
    });

    /* Jump from the venue cards' "Directions" buttons */
    $$('[data-dir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.getAttribute('data-dir');
        var tab = tabs.filter(function (t) { return t.getAttribute('data-venue') === want; })[0];
        if (tab) select(tab);
      });
    });
  }

  /* ---------------- Calendar (.ics) & share ---------------- */
  function buildIcs() {
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Charisma 2026//Wedding//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:charisma-2026-wedding@usman-charity',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART:' + WEDDING.icsStart,
      'DTEND:' + WEDDING.icsEnd,
      'SUMMARY:Wedding of Usman Fori & Charity Ishaku (The Charisma Wedding)',
      'LOCATION:EYN LCC Abuja Sharaton, Maiduguri, Borno State',
      'DESCRIPTION:Ceremony at 9:00 AM PROMPT. Reception follows at 11:00 AM at ASUU Hall, University of Maiduguri. Colour of the day: ' + WEDDING.colours + '. #Charisma2026',
      'GEO:11.8311;13.1487',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tomorrow — the Charisma Wedding',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:charisma-2026-reception@usman-charity',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART:20261212T100000Z',
      'DTEND:20261212T150000Z',
      'SUMMARY:Reception — Usman & Charity (The Charisma Wedding)',
      'LOCATION:ASUU Hall, University of Maiduguri, Borno State',
      'DESCRIPTION:Reception at 11:00 AM. Colour of the day: ' + WEDDING.colours + '. #Charisma2026',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    return lines.join('\r\n');
  }

  function initCalendarAndShare() {
    var ics = $('#ics-download');
    if (ics) {
      try {
        var blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' });
        ics.href = URL.createObjectURL(blob);
      } catch (e) {
        ics.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildIcs());
      }
    }

    var share = $('#share-btn');
    if (share) {
      share.addEventListener('click', function (e) {
        var data = {
          title: 'Usman & Charity — The Charisma Wedding',
          text: 'Join us on Saturday, 12th December 2026 at EYN LCC Abuja Sharaton, Maiduguri. #Charisma2026',
          url: window.location.href
        };
        if (navigator.share) {
          e.preventDefault();
          navigator.share(data).catch(function () { /* dismissed */ });
        } else if (navigator.clipboard) {
          e.preventDefault();
          navigator.clipboard.writeText(data.text + ' ' + data.url)
            .then(function () { share.innerHTML = '<i class="fa-solid fa-check"></i> Link copied'; })
            .catch(function () { /* ignore */ });
        }
      });
    }
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    initPreloader();
    initHeader();
    initReveal();
    initCountdown();
    initReel();
    initLightbox();
    initMap();
    initCalendarAndShare();

    getRows('love_story', { limit: 50 }).then(renderStory);
    getRows('gifts', { limit: 50 }).then(renderGifts);
    getRows('gallery', { limit: 100 }).then(renderGallery);
    loadPrayers();

    /* Re-centre the reel once images/fonts settle */
    window.addEventListener('load', function () {
      window.dispatchEvent(new Event('resize'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
