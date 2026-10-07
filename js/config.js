/* ============================================================
   Charisma 2026 — The Wedding of Usman Fori & Charity Ishaku
   Brand tokens, content config and offline fallbacks
   ============================================================ */

/* ---------- Brand palette (from the Charisma brand guide) ---------- */
const BRAND = {
  brown:     '#703104',  // Deep Burnt Brown
  taupe:     '#BAAA87',  // Pale Warm Taupe
  cream:     '#FFF8AD',  // Pale Cream
  white:     '#FFFFFF',  // White
  black:     '#0B0A08'   // Black (base of the brand gradient)
};

/* ---------- Key wedding facts ---------- */
const WEDDING = {
  groom: 'Usman Fori',
  bride: 'Charity Ishaku',
  groomNick: 'Coffee',
  brideNick: 'Vanilla',
  hashtag: '#Charisma2026',
  dateLabel: 'Saturday, 12th December, 2026',
  dateISO: '2026-12-12T09:00:00+01:00',
  icsStart: '20261212T080000Z',   // 09:00 West Africa Time
  icsEnd:   '20261212T113000Z',
  colours: 'Coffee, Vanilla, Beige & Black',
  church: {
    name: 'EYN LCC Abuja Sharaton',
    address: 'EYN LCC Abuja Sharaton, Maiduguri, Borno State',
    time: '9:00 AM PROMPT'
  },
  reception: {
    name: 'ASUU Hall',
    address: 'ASUU Hall, University of Maiduguri, Borno State',
    time: '11:00 AM'
  }
};

/* ============================================================
   INTEGRATIONS
   ============================================================ */

/* ---- Task 8: Jotform prayer form --------------------------------
   Replace `prayerFormUrl` with the real Jotform URL, e.g.
   https://form.jotform.com/241234567890123
   The CTA button opens it in a new tab (target="_blank").        */
const JOTFORM = {
  prayerFormUrl: 'https://form.jotform.com/000000000000000'
};

/* ---- Task 4: Google Drive as the media CDN ----------------------
   Paste the Drive FILE ID (the part after /d/ in a share link, or the
   value of the `id` query param) against the row it belongs to.

   Both a share link and a bare id are accepted — normaliseDriveId()
   below extracts the id for you.

   How each type is served (these are the formats that actually render):
     images → drive.google.com/thumbnail?id=ID&sz=w1600   (works in <img>)
     videos → drive.google.com/uc?export=download&id=ID   (progressive MP4)
     embeds → drive.google.com/file/d/ID/preview          (iframe player)

   NOTE: Drive throttles heavy hot-linking and may show an
   "exceeds quota" page for very popular files. For a wedding-scale
   audience it is fine; for anything larger, use R2/S3 instead.     */
const GDRIVE = {
  /* gallery row id  -> Drive file id or share link */
  imageFileIds: {
    // 'gal-01': '1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
  },
  /* reel id -> Drive file id or share link */
  videoFileIds: {
    // 'reel-1': '1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
  }
};

function normalizeDriveId(value) {
  if (!value) return '';
  var v = String(value).trim();
  var m = v.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  m = v.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  m = v.match(/^([A-Za-z0-9_-]{20,})$/);
  if (m) return m[1];
  return v;
}

/* Renders inline in <img src>. */
function driveImage(value, width) {
  var id = normalizeDriveId(value);
  if (!id) return '';
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (width || 1600);
}

/* Progressive stream URL for <video src>. */
function driveVideo(value) {
  var id = normalizeDriveId(value);
  if (!id) return '';
  return 'https://drive.google.com/uc?export=download&id=' + id;
}

/* Embeddable player URL for <iframe src>. */
function drivePreview(value) {
  var id = normalizeDriveId(value);
  if (!id) return '';
  return 'https://drive.google.com/file/d/' + id + '/preview';
}

/* ---- Task 5: Zainpay payment gateway ----------------------------
   `mode: 'demo'` never contacts the network: it records the gift and
   shows the confirmation flow, so the whole journey is demonstrable
   before keys exist.

   For live payments set mode:'live', fill in the keys, and provide a
   server-side charge endpoint (see README) — a static page must never
   hold a secret key. `chargeEndpoint` is that endpoint's URL.       */
const ZAINPAY = {
  mode: 'demo',                     // 'demo' | 'live'
  publicKey: '',                    // Zainpay public key (safe for the browser)
  zainboxCode: '',                  // your Zainbox / sub-account code
  companyEmail: '',
  currency: 'NGN',
  baseUrl: 'https://api.zainpay.ng',
  /* Backend route that creates the charge and returns { checkoutUrl }.
     Leave blank in demo mode. */
  chargeEndpoint: '',
  /* Task 6 keep-alive target: the Zainpay webhook/confirm route that
     finalises a payment server-side before a receipt is issued. */
  webhookConfirmPath: '/api/zainpay/confirm'
};

/* ---- Task 7: Supabase (payments store + admin dashboard) --------
   When `url` and `anonKey` are both set, the gifting flow writes to
   the `wedding_payments` table and admin.html reads from it.

   When they are blank the app falls back to this project's own
   tables API (`payments` table), so the dashboard is usable today.

   Table SQL (run once in the Supabase SQL editor) is in README.md.  */
const SUPABASE = {
  url: '',            // https://xxxxxxxxxxxx.supabase.co
  anonKey: '',        // public anon key (safe for the browser with RLS on)
  paymentsTable: 'wedding_payments'
};

/* ---- Task 6: keep-alive / uptime ping ---------------------------
   `pingPath` is fetched on an interval so an idle deployed site is
   never put to sleep. See README for the scheduled-workflow version,
   which keeps pinging even when nobody has the page open.           */
const KEEPALIVE = {
  enabled: true,
  pingPath: '',            // blank = ping the current page itself
  intervalMinutes: 10,
  maxPingsPerSession: 24
};

/* ---- Resolvers: prefer a Google Drive id when one is configured,
        otherwise fall back to the URL stored on the row. ---- */
function resolveGalleryImage(row) {
  var drive = (typeof GDRIVE !== 'undefined' && GDRIVE.imageFileIds)
    ? GDRIVE.imageFileIds[row && row.id] : null;
  if (drive) return { url: driveImage(drive, 1600), kind: 'drive' };
  return { url: (row && row.image_url) || '', kind: 'url' };
}

function resolveReelVideo(reel) {
  var drive = (typeof GDRIVE !== 'undefined' && GDRIVE.videoFileIds)
    ? GDRIVE.videoFileIds[reel && reel.id] : null;
  if (drive) return { url: driveVideo(drive), kind: 'drive' };
  return { url: (reel && reel.video) || '', kind: 'url' };
}

/* ---------- Portrait film reel (placeholder footage) ----------
   Sources: Wikimedia Commons, freely licensed. Replace with the
   couple's own reels before the real launch.                     */
const REELS = [
  {
    id: 'reel-1',
    badge: 'Reel 01',
    title: 'The Way You Look Today',
    caption: 'Pre-wedding · Maiduguri',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/00/Couple_holding_hands.webm/Couple_holding_hands.webm.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/xE73fyiiATfxxgBo?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY 3.0'
  },
  {
    id: 'reel-2',
    badge: 'Reel 02',
    title: 'Something Borrowed, Something White',
    caption: 'The dress · fittings',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/97/Wedding_dress_ceremony_in_Hamad_City.webm/Wedding_dress_ceremony_in_Hamad_City.webm.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/NmxirMuVbZmNPrL7?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY 4.0'
  },
  {
    id: 'reel-3',
    badge: 'Reel 03',
    title: 'Two Families, One Aisle',
    caption: 'Our people, gathered',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Marriage_ceremony_in_kargil_ladakh_--_ladakhi_wedding_-ladakh.webm/Marriage_ceremony_in_kargil_ladakh_--_ladakhi_wedding_-ladakh.webm.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/Sjfk2fnyqdHPV82S?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY 3.0'
  },
  {
    id: 'reel-4',
    badge: 'Reel 04',
    title: 'Dance Like Nobody Is Watching',
    caption: 'Reception · 11:00 AM',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/94/Punjabi_Wedding_by_Sumita_Roy.webm/Punjabi_Wedding_by_Sumita_Roy.webm.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/kRSqFaj9j8e3n0fO?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY-SA 4.0'
  },
  {
    id: 'reel-5',
    badge: 'Reel 05',
    title: 'Lit By Candlelight',
    caption: 'Details & décor',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/24/Synchronization-in-flickering-of-three-coupled-candle-flames-srep36145-s4.ogv/Synchronization-in-flickering-of-three-coupled-candle-flames-srep36145-s4.ogv.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/5yIEYlFkxpqdSeEn?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY 4.0'
  },
  {
    id: 'reel-6',
    badge: 'Reel 06',
    title: 'Then, Now, Always',
    caption: 'Save the date · 12.12.2026',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/36/Traditional_wedding_of_Kazakhs_in_China.webm/Traditional_wedding_of_Kazakhs_in_China.webm.480p.vp9.webm',
    poster: 'https://sspark.genspark.ai/i/Eelafi2c7JLqM5Xk?width=900',
    credit: 'Footage: Wikimedia Commons · CC BY 3.0'
  }
];

/* ---------- Offline fallbacks ----------
   Used only if the tables API is unreachable, so the page still
   renders a complete invitation.                                  */
const FALLBACK = {
  love_story: [
    { id: 'story-01', chapter: 'Chapter One', date_label: 'Where it all began', title: 'A First Hello', story: 'It started with a simple greeting that neither of them thought much about at the time — a hello that turned into a conversation, and a conversation that refused to end.', icon: 'fa-solid fa-mug-hot', sort_order: 1 },
    { id: 'story-02', chapter: 'Chapter Two', date_label: 'The slow becoming', title: 'Friends, Then More', story: 'Coffee dates became long calls. Somewhere between the laughter and the late-night talks, friendship quietly grew roots deeper than either of them expected.', icon: 'fa-solid fa-heart', sort_order: 2 },
    { id: 'story-03', chapter: 'Chapter Three', date_label: 'The yes', title: 'The Proposal', story: 'With a heart full of certainty and hands that would not stop shaking, Usman asked Charity to spend forever with him. She said yes before he could finish the sentence.', icon: 'fa-solid fa-ring', sort_order: 3 },
    { id: 'story-04', chapter: 'Chapter Four', date_label: '12 . 12 . 2026', title: 'Forever Begins', story: 'Two families, two cultures and one covenant. On Saturday, the 12th of December 2026, before God and the people they love most, Coffee and Vanilla become one.', icon: 'fa-solid fa-church', sort_order: 4 }
  ],
  gallery: [
    { id: 'gal-01', caption: 'The beginning of forever', image_url: 'https://sspark.genspark.ai/i/Eelafi2c7JLqM5Xk?width=900', tag: 'Pre-Wedding', sort_order: 1 },
    { id: 'gal-02', caption: 'Joy, in full bloom', image_url: 'https://sspark.genspark.ai/i/QJloNAVFrgKYChfC?width=900', tag: 'Pre-Wedding', sort_order: 2 },
    { id: 'gal-03', caption: 'Hand in hand, always', image_url: 'https://sspark.genspark.ai/i/xE73fyiiATfxxgBo?width=900', tag: 'Details', sort_order: 3 },
    { id: 'gal-04', caption: 'A garden, a promise', image_url: 'https://sspark.genspark.ai/i/4tJzRExBqkR4hIwZ?width=900', tag: 'Pre-Wedding', sort_order: 4 },
    { id: 'gal-05', caption: 'EYN LCC Abuja Sharaton', image_url: 'https://sspark.genspark.ai/i/u5PRQLHGikDN1BbS?width=900', tag: 'Ceremony', sort_order: 5 },
    { id: 'gal-06', caption: 'Down the aisle', image_url: 'https://sspark.genspark.ai/i/Sjfk2fnyqdHPV82S?width=900', tag: 'Ceremony', sort_order: 6 },
    { id: 'gal-07', caption: 'Where vows are made', image_url: 'https://sspark.genspark.ai/i/EHZkfEH4kfXZrTmg?width=900', tag: 'Ceremony', sort_order: 7 },
    { id: 'gal-08', caption: 'Coffee, Vanilla, Beige & Black', image_url: 'https://sspark.genspark.ai/i/kRSqFaj9j8e3n0fO?width=900', tag: 'Reception', sort_order: 8 },
    { id: 'gal-09', caption: 'Table for the celebration', image_url: 'https://sspark.genspark.ai/i/5yIEYlFkxpqdSeEn?width=900', tag: 'Reception', sort_order: 9 },
    { id: 'gal-10', caption: 'Soft neutrals, warm light', image_url: 'https://sspark.genspark.ai/i/4I1mfBKT9XSqjbry?width=900', tag: 'Reception', sort_order: 10 },
    { id: 'gal-11', caption: 'The bride, radiant', image_url: 'https://sspark.genspark.ai/i/NmxirMuVbZmNPrL7?width=900', tag: 'Pre-Wedding', sort_order: 11 },
    { id: 'gal-12', caption: 'Two rings, one story', image_url: 'https://sspark.genspark.ai/i/uvY1yaJIZ7YvpoIV?width=900', tag: 'Details', sort_order: 12 }
  ],
  gifts: [
    { id: 'gift-01', group_name: 'Donation', title: 'Church Thanksgiving Offering', description: 'A seed of gratitude towards the house of God that has guided our journey.', meta_label: 'Open to all guests', icon: 'fa-solid fa-church', sort_order: 1 },
    { id: 'gift-02', group_name: 'Donation', title: 'Marriage Blessing Fund', description: 'Contributions towards the founding of our new home.', meta_label: 'Optional & heartfelt', icon: 'fa-solid fa-hands-praying', sort_order: 2 },
    { id: 'gift-03', group_name: 'Donation', title: 'Charity Outreach Pledge', description: 'In honour of the bride\u2019s name and her heart, a portion of our gifts will be passed on to a family in need.', meta_label: 'A gift that keeps giving', icon: 'fa-solid fa-hand-holding-heart', sort_order: 3 },
    { id: 'gift-04', group_name: 'Gifting', title: 'Bank Transfer', description: 'Account Name: Usman Fori & Charity Ishaku\nBank: [Your Bank Name]\nAccount Number: [0000000000]\nReference: Charisma2026 + Your Name', meta_label: 'Preferred for cash gifts', icon: 'fa-solid fa-building-columns', sort_order: 1 },
    { id: 'gift-05', group_name: 'Gifting', title: 'Cash Gift on the Day', description: 'A dedicated gift table will be available at the reception at ASUU Hall.', meta_label: 'Reception, ASUU Hall', icon: 'fa-solid fa-gift', sort_order: 2 },
    { id: 'gift-06', group_name: 'Gifting', title: 'Gift Registry Wishlist', description: 'If you would rather bless us with something for the home, our registry wishlist is available on request.', meta_label: 'Available on request', icon: 'fa-solid fa-list-check', sort_order: 3 }
  ],
  prayers: [
    { id: 'prayer-01', guest_name: 'The Fori Family', relation: 'Family of the Groom', message: 'May the Lord who brought you together keep you in perfect peace. We are praying for a home filled with laughter, wisdom and grace. Welcome to the family, Charity!', submitted_at: '2026-09-14T10:20:00.000Z', approved: true },
    { id: 'prayer-02', guest_name: 'Aunty Rose & Uncle Danjuma', relation: 'Family friends', message: 'Charisma — grace, charm and favour. What a perfect name for a perfect pair. May your union be sweeter with every year.', submitted_at: '2026-09-18T16:45:00.000Z', approved: true },
    { id: 'prayer-03', guest_name: 'The Ishaku Household', relation: 'Family of the Bride', message: 'Our daughter, our joy. Go and be blessed, and know that our prayers travel with you into this new home.', submitted_at: '2026-09-22T07:05:00.000Z', approved: true }
  ]
};
