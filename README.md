# The Charisma Wedding — Usman Fori &amp; Charity Ishaku

A modern, responsive wedding landing page for **Usman Fori (Coffee)** &amp; **Charity Ishaku (Vanilla)** —
*The Charisma Wedding*, inspired by Charity + Usman. **#Charisma2026**

> **"Charisma" means grace, charm, and favour — beautiful for a marriage.**

- **Date:** Saturday, 12th December, 2026
- **Ceremony:** 9:00 AM PROMPT — EYN LCC Abuja Sharaton, Maiduguri, Borno State
- **Reception:** 11:00 AM — ASUU Hall, University of Maiduguri
- **Colour of the day:** Coffee, Vanilla, Beige &amp; Black

---

## 1. Brand Guide

Derived from the supplied brand reference images (`images/brand-colors.jpg`, `images/brand-typography.jpg`).

### Colour palette

| Role | Name | Hex | RGB |
|------|------|-----|-----|
| Coffee | Deep Burnt Brown | `#703104` | 112, 49, 4 |
| Beige | Pale Warm Taupe | `#BAAA87` | 186, 170, 135 |
| Vanilla | Pale Cream | `#FFF8AD` | 255, 248, 173 |
| — | White | `#FFFFFF` | 230, 231, 232 |
| Black | Ceremony Black | `#0B0A08` | 11, 10, 8 |

A brand gradient (`--gradient-brand`) runs from the near-black to Deep Burnt Brown, matching the
gradient bar in the brand guide. All tokens live in `:root` in `css/style.css`.

### Typography

| Use | Font |
|-----|------|
| Display / script (names, monograms) | **Souther Demo** (proprietary) → falls back to **Great Vibes** |
| Body / UI | **Instrument Sans** |

> **Note:** *Souther Demo* is a licensed font and cannot be redistributed here. The `--font-script`
> token therefore lists `'Souther Demo'` **first**, so if you install the real font it is used
> automatically; otherwise Google Font *Great Vibes* provides a close calligraphic stand-in.
> To ship the genuine face, drop the `.woff2` files into `fonts/` and add an `@font-face` rule.

---

## 2. Project Structure

```
index.html                     Main wedding landing page
admin.html                     Gift dashboard (Task 7) — noindex
download.html                  Codebase download page (Task 2) — noindex
css/
  style.css                    Brand tokens + all public styles
  admin.css                    Dashboard styles
  download.css                 Download page styles
js/
  config.js                    Brand data, wedding facts, integrations, fallbacks
  main.js                      Public interactions (nav, reel, gallery, map, countdown)
   site-payments.js             Zainpay gifts, transfer receipts, PDF receipts, keep-alive
  admin.js                     Dashboard: read/filter/confirm/CSV/receipts
  download.js                  Client-side zip builder
images/
  brand-colors.jpg             Brand palette reference
  brand-typography.jpg         Brand type reference
.tables/schema.json            D1 / preview table schema
.tables/supabase-receipts.sql  Supabase payments table, private bucket and RLS policies
api/config.js                  Runtime delivery of public Supabase settings
.github/workflows/keepalive.yml Scheduled ping (Task 6)
```

---

## 3. Currently Completed Features

### Landing page (`index.html`)
- **Hero** — script-font names, animated countdown to 12 Dec 2026, window-light motif echoing the logo.
- **Love Story** — 4-chapter timeline read from the `love_story` table.
- **Portrait Video Slider** — 6 portrait (9:16) reels, autoplay on view, arrows, dots, swipe, keyboard
  and click-to-play. Cards are lazily sourced so the initial load stays light.
- **Wedding Details** — Church &amp; Reception venue cards, colour of the day, "Add to Calendar" (.ics)
  and native Share.
- **Donation** &amp; **Gifting** — grouped cards from the `gifts` table, plus the online Zainpay gift flow.
- **Colours of the Day** — brand swatch cards with names, hex and RGB.
- **Picture Gallery** — masonry grid, album filters, keyboard-accessible lightbox.
- **Send Thoughts &amp; Prayers** — Jotform CTA button (Task 8) + a Blessings Wall.
- **Directions** — switchable OpenStreetMap embed for both venues with turn-by-turn links.

### Responsive &amp; mobile hardening (Tasks 1, 3)
- `overscroll-behavior: none` on `html` kills rubber-band/pull-to-refresh background exposure.
- `overflow-x: clip` (not `hidden`) on `body` + per-section clip prevents horizontal overflow while
  keeping `position: sticky` descendants working.
- `safe-area-inset` padding for notched devices; `100svh` hero so the hero does not jump when the
  mobile URL bar hides/shows.
- `overflow-wrap: anywhere` on long free-text so bank details/emails never force a sideways scroll.
- Nav: sticky bar with **hysteresis** (no flicker at the threshold), **rAF-throttled** scroll handler,
  own compositing layer, `backdrop-filter` disabled on small screens (its per-frame repaint was the
  main source of mobile flicker), and the drawer force-closes when resizing up to desktop.

### Gifting &amp; payments
- Zainpay gift modal: name, receipt email, amount (+ quick chips), purpose, message, validation.
- `demo` mode exercises the gift form without charging. `live` mode POSTs non-secret payment details
  to a server `chargeEndpoint` and redirects to its returned `checkoutUrl`; an invalid or missing
  checkout URL is treated as an error, never as a successful demo payment.
- Confirmation screen with a **PDF receipt** (jsPDF), plus Print fallback.
- Gift reference format: `CH26-XXXXXXX`.

### Gift dashboard (`admin.html`)
- KPIs (total received, confirmed, pending, average), "by purpose" bar chart, recent activity feed.
- Searchable, status-filterable payment table; confirm/unconfirm; CSV export; receipt re-issue.
- Reads from **Supabase** when configured, otherwise from this project's own `payments` table.
- Falls back to the last-loaded records if the store is unreachable.

### Downloadable codebase (`download.html`)
- Builds a zip **entirely client-side** (JSZip) from a manifest of the real project files.
- Per-file download buttons and a live list of archive contents.

### Keep-alive (Task 6)
- `.github/workflows/keepalive.yml` pings the deployed site every 10 minutes.
- A lightweight in-page ping (`js/site-payments.js`) also fires while a tab is open.

---

## 4. Functional Entry Points &amp; Parameters

| Path | Purpose | Notes |
|------|---------|-------|
| `index.html` | Public invitation | `#hero` `#story` `#films` `#details` `#donation` `#gifting` `#palette` `#gallery` `#prayers` `#directions` anchors |
| `admin.html` | Gift dashboard | Passcode gate (see security note) |
| `download.html` | Codebase export | Click **Build &amp; Download ZIP** |
| `tables/{table}?page=&limit=&search=&sort=` | REST table read | `love_story`, `gallery`, `gifts`, `prayers`, `payments` |
| `tables/{table}` `POST` | Create row | Used by the gift flow |
| `tables/{table}/{id}` `PATCH` | Partial update | Used to confirm a payment |

**Config entry points** (all in `js/config.js`): `JOTFORM.prayerFormUrl`, `GDRIVE.galleryFolderId`,
`GDRIVE.videoFolderId`, `GDRIVE.galleryApiKey`, `GDRIVE.imageFileIds`, `GDRIVE.videoFileIds`, `ZAINPAY.*`,
`SUPABASE.*`, `KEEPALIVE.*`.

### Automatic Google Drive gallery

The gallery and portrait reel can list image/video files directly from the public folders configured in
`GDRIVE.galleryFolderId` and `GDRIVE.videoFolderId`. To enable automatic folder loading:

1. Make sure the folder is shared as **Anyone with the link — Viewer**.
2. In a Google Cloud project, enable the **Google Drive API** and create an API key.
3. Restrict the key to the **Google Drive API** and add website HTTP referrer restrictions
   (production domain, `www` domain if used, and local development origin).
   For local testing, add the local origin you use (for example `http://localhost:5500/*`).
4. Retrieve the key string locally. The API key resource UID shown by `gcloud services api-keys list`
   is not the key string used by the browser:

   ```powershell
   gcloud services api-keys get-key-string 52465181-8d0d-402f-a58f-2bdd7177b43e --project=wedding-511718
   ```

5. Put the returned `keyString` value in `GDRIVE.galleryApiKey` in `js/config.js`.

Folder images and videos then appear automatically, ordered by filename. Image captions and video titles
come from filenames. If listing fails or the key is unset, the existing gallery records and reel videos
are used instead. Google Drive videos must be playable/downloadable by viewers with the link; very large
files may not stream reliably from Drive and should be hosted on a video CDN for dependable playback.
Browser API keys are visible to visitors, so restrict the key as above; never put a
service-account credential or other secret in this file.

---

## 5. Data Models &amp; Storage

`.tables/schema.json` provisions one Cloudflare D1 database on Hosted Deploy. Tables:

| Table | Fields |
|-------|--------|
| `love_story` | id, chapter, date_label, title, story, icon, sort_order |
| `gallery` | id, caption, image_url, tag, sort_order |
| `gifts` | id, group_name (`Donation`/`Gifting`), title, description, meta_label, icon, sort_order |
| `prayers` | id, guest_name, relation, message, submitted_at, approved |
| `payments` | id, reference, payer_name, payer_email, amount, currency, purpose, note, status (`pending`/`confirmed`/`failed`), gateway, gateway_reference, paid_at, created_at |

**Storage services**
1. **Genspark tables API / D1** — story, gallery, gifts, prayers, and payment fallback.
2. **Supabase** — `wedding_payments` and the private `payment-receipts` bucket for bank-transfer proof.
3. **Google Drive** (optional) — media CDN, see the caveat in §7.

The Supabase `wedding_payments` table additionally stores `receipt_path` for bank-transfer submissions; the D1/preview `payments` schema does not.

### Supabase receipts setup

1. Create a Supabase project and open **SQL Editor → New query**.
2. Run the complete script in [.tables/supabase-receipts.sql](.tables/supabase-receipts.sql). It creates or updates `wedding_payments`, adds the `receipt_path` field, creates the private `payment-receipts` bucket with an 8 MB limit and allowed image/PDF types, and installs the required RLS policies. The script can be run again safely.
3. In the Supabase project settings, copy the **Project URL** and **anon/public key**. Do not use the `service_role` key in browser code or expose it as a `SUPABASE_*` public variable.
4. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the hosting environment. For local development, put them in `.env.local` at the project root. `api/config.js` exposes only these two public values to the browser at runtime.
5. Redeploy/restart the local server. The bank-transfer form in the Donation section uploads a private receipt object, then adds a `pending` row to `wedding_payments`. Donors may submit JPG, PNG, WebP, or PDF files up to 8 MB.
6. Review the pending row in Supabase **Table Editor → wedding_payments**. Use its `receipt_path` to locate the private object in **Storage → payment-receipts**, verify the transfer in your bank account, then mark the row confirmed from the admin dashboard. An uploaded receipt alone is not proof of settlement and never auto-confirms a payment.

The bucket is private and has no anonymous read, update, or delete policy. The public upload policy only permits new objects under a generated `CH26-...` reference folder. Keep the project URL and anon key public-safe by relying on RLS; never place a service-role key in `.env.local` variables delivered to the frontend.

**Security limitation:** the existing admin page uses a client-side passcode and anonymous Supabase read/update access; it is not secure authentication. Protect `/admin.html` at the hosting layer and use Supabase Auth plus server-side authorization before relying on the dashboard for sensitive payment records. Public table reads expose payer metadata. These policies support the current simple wedding workflow, not a high-risk payments ledger.

---

## 6. Keep-Alive Setup (Task 6)

1. Push this repository to GitHub.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `SITE_URL`
   - Value: `https://your-live-site-url`
3. **Actions** tab → enable workflows.

Runs every 10 minutes. Note the GitHub limits: cron cannot run more often than every 5 minutes, and
scheduled workflows are disabled after ~60 days of repository inactivity. For stricter uptime use an
external monitor (UptimeRobot, cron-job.org) or a Cloudflare Cron Trigger.

---

## 7. Features Not Yet Implemented / Important Caveats

Please read these — several requested items **cannot be fully completed on a static site**, and are
implemented as far as the platform honestly allows.

1. **Admin passcode is NOT security.** `admin.html` uses a client-side passcode
   (`charisma2026`). Anyone can read it in the page source. Real protection must be applied at the
   platform level (restrict the route) — treat this page as "hidden, not protected". Do not put
   sensitive payout details on it.
2. **Zainpay live charging needs a backend.** A static page must never hold a secret key. `demo` mode
   exercises the form without charging; going live requires a server endpoint that creates a Zainpay
   charge and returns a `checkoutUrl`, plus a **webhook** handler that verifies the gateway event
   before setting `status` to `confirmed` or issuing a receipt. The Zainbox code and secret keys
   belong in server-side environment variables, not `js/config.js` or browser requests. Set
   `ZAINPAY.mode = 'live'` and `ZAINPAY.chargeEndpoint` only after these endpoints are deployed. The
   webhook **cannot** be hosted by this project's Cloudflare/D1 functions.
3. **Supabase payments are unauthenticated by design.** With RLS open to `anon`, any visitor could
   in principle write. For production, insert through a server endpoint that holds the service key.
4. **Google Drive is a fragile CDN.** Drive throttles hot-linking and can serve an
   "exceeds quota" page for popular files. It is fine for a wedding-scale audience, but it is not a
   real CDN. Images use `drive.google.com/thumbnail?id=…&sz=wN` and videos
   `drive.google.com/uc?export=download&id=…`. Prefer R2/S3 for anything larger.
5. **Keep-alive only runs while a tab is open** (browser side); the durable version is the GitHub
   workflow, which needs a GitHub remote and the `SITE_URL` variable.
6. **Media is placeholder.** Gallery photos and reel videos are freely licensed stand-ins
   (Wikimedia Commons CC BY / CC BY-SA). Replace them with the couple's own media, and keep the
   attribution if you reuse them.
7. **Prayers wall is read-only on-site.** New prayers are collected by Jotform (Task 8), so the wall
   shows whatever is already in the `prayers` table. To surface Jotform submissions, sync them into
   that table.
8. Confirm the displayed bank account details with the account holder before sharing the site.

---

## 8. Recommended Next Steps

1. Replace placeholder media with the couple's photos/videos.
2. Confirm `JOTFORM.prayerFormUrl` in `js/config.js` points to the couple's active Jotform form.
3. Fill in real bank details, or switch fully to the online Zainpay flow.
4. Stand up the Zainpay charge + webhook endpoints, then switch `ZAINPAY.mode` to `live`.
5. Create the Supabase project, run the SQL in §5, and configure `SUPABASE_URL` plus `SUPABASE_ANON_KEY` in the host environment.
6. Restrict `/admin.html` at the platform level rather than relying on the passcode.
7. Add the GitHub remote and set `SITE_URL` so the keep-alive runs server-side.
8. Optionally add RSVP/guest-seating and a live photo wall.

---

## 9. Local Preview & Deployment Guide

Use Node.js 22 or newer (npm is included with Node). The site has no build step or installed runtime packages, but it uses Vercel-style `/api/*` functions; a plain static server such as `python -m http.server` will not run those routes.

From the project root, install the lockfile dependencies and run the automated checks:

```powershell
npm ci
npm test
```

Start the local site and serverless routes with the Vercel CLI:

```powershell
npx --yes vercel dev --listen 3000
```

The first run may ask you to authenticate or link a Vercel project. Open `http://localhost:3000/`, `http://localhost:3000/admin.html`, and `http://localhost:3000/download.html`. To load Supabase locally, copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` there after running the SQL setup in §5. Never put a service-role key in these browser-exposed settings.

With `ZAINPAY.mode` left at its default `demo`, submit a test gift: no charge is made, and on localhost the demo record is saved in that browser's local storage. Open the admin page in the same browser and use its existing demo passcode to inspect or confirm the local record. This does not call Zainpay or create a real payment. Receipt uploads require Supabase configuration and the SQL/bucket policies to be applied.

### Deployment guide

Deploy the project root to Vercel so `api/config.js` and `api/zainpay/*` run as Node serverless functions; keep the HTML pages at the root. Add the required variables from `.env.example` in the Vercel project settings. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are public client settings; Zainpay keys and `PAYMENT_SIGNING_SECRET` are server-only secrets. Static-only hosting is not sufficient unless it proxies these API routes to a compatible Node backend. Verify the deployed site, Supabase bucket upload, and Zainpay sandbox flow before enabling live payments.

---

## 10. Public URLs

| Environment | URL |
|-------------|-----|
| Production (Hosted) | *set after Hosted Deploy* |
| Preview | `https://www.genspark.ai/api/code_sandbox_light_git/preview/<project-id>/index.html` |
| Dashboard | `<base>/admin.html` (noindex) |
| Codebase download | `<base>/download.html` |

To make the site live, use the **Publish** tab (or an explicit Hosted Deploy). Note that a deployed
site has its **own** database: rows added in the editor do **not** appear on the live site until you
copy them across.

### Zainpay checkout integration (October 2026)

The checkout now includes Node 22+ serverless handlers at `api/zainpay/charge.js`
and `api/zainpay/confirm.js`, compatible with Vercel's Node functions. Static-only
hosting must proxy these same-origin routes to a Node function deployment. Do not
publish `.env` or `server/` as static assets. No npm runtime dependencies are needed.

1. Set the hosting environment variables in `.env.example`: `ZAINPAY_PUBLIC_KEY`,
   `ZAINPAY_ZAINBOX_CODE`, `ZAINPAY_ENV=sandbox`, `SITE_URL` (your HTTPS origin), and
   `PAYMENT_SIGNING_SECRET` (a random secret of at least 32 characters).
2. Deploy the API routes alongside the frontend. Set `ZAINPAY.mode` in
   `js/config.js` to `live` to enable hosted checkout (the backend environment
   still controls sandbox versus real payments). Keep it `demo` until configured.
3. Complete a sandbox checkout, return, cancelled checkout, and failed checkout.
   Check the verification amount matches the original amount in naira. Zainpay's
   deposit verification documentation also describes net settlement amounts;
   the handler deliberately rejects mismatches rather than issuing an incorrect
   receipt. Confirm your account's units/fee treatment before enabling real payments.
4. Switch `ZAINPAY_ENV` to `live` with the corresponding account key and Zainbox.

Credentials stay on the server. Checkout references are server-generated. Signed
sessions expire after seven days; the browser retains the session in sessionStorage
for return verification. Return URL parameters never prove payment. Verification
checks the gateway's reference, Zainbox, deposit type, amount and payment details.
Refresh the return page to retry pending verification. Keep the same browser tab.

This implementation provides hosted checkout and verified downloadable receipts.
It does not yet persist live payments to the admin dashboard or process background
webhooks; use the Zainpay dashboard as the payment ledger. The confirm route is a
browser-triggered verification endpoint, not a webhook receiver. Demo receipts are
labelled DEMO and are not payment proof. Do not use the existing anonymous payment
table as an authoritative live ledger.

Reference: https://github.com/zainpay/zainpay-nodejs-sdk (official SDK endpoint
mapping and payloads; implementation uses native fetch). Run `npm test` for the
mocked gateway and media resolver regression checks. Real account checkout remains
pending credentials and sandbox validation.

Drive videos now use Google's `/file/d/ID/preview` player in both reel and gallery;
files must be shared for viewer access and finished processing in Drive. Direct
video URLs use native controls with the source attached immediately. Embedded Drive
players manage their own playback; the page cannot enforce exclusive playback
inside cross-origin iframes.
