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
  site-payments.js             Zainpay gifting, PDF receipts, Jotform CTA, keep-alive
  admin.js                     Dashboard: read/filter/confirm/CSV/receipts
  download.js                  Client-side zip builder
images/
  brand-colors.jpg             Brand palette reference
  brand-typography.jpg         Brand type reference
.tables/schema.json            D1 / preview table schema
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
- `demo` mode records and confirms a gift so the whole journey is demonstrable; `live` mode POSTs to a
  server `chargeEndpoint` and redirects to the returned `checkoutUrl`.
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

**Config entry points** (all in `js/config.js`): `JOTFORM.prayerFormUrl`, `GDRIVE.imageFileIds`,
`GDRIVE.videoFileIds`, `ZAINPAY.*`, `SUPABASE.*`, `KEEPALIVE.*`.

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
2. **Supabase** (optional) — `wedding_payments`, used by the dashboard when `SUPABASE.url` +
   `SUPABASE.anonKey` are set.
3. **Google Drive** (optional) — media CDN, see the caveat in §7.

### Supabase setup (optional)

```sql
create table if not exists public.wedding_payments (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  payer_name text,
  payer_email text,
  amount numeric,
  currency text default 'NGN',
  purpose text,
  note text,
  status text default 'pending',
  gateway text default 'Zainpay',
  gateway_reference text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.wedding_payments enable row level security;

-- Anonymous visitors may insert a gift…
create policy "anon can insert payments"
  on public.wedding_payments for insert to anon with check (true);

-- …and the dashboard may read/update (tighten this for real use).
create policy "anon can read payments"
  on public.wedding_payments for select to anon using (true);

create policy "anon can update payments"
  on public.wedding_payments for update to anon using (true);
```

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
   is fully wired; going live requires a small server endpoint that creates the charge and returns a
   `checkoutUrl`, plus a **webhook** handler to flip `status` to `confirmed`. Set
   `ZAINPAY.mode = 'live'` and `ZAINPAY.chargeEndpoint`. The webhook **cannot** be host
   Cloudflare/D1 functions from this project.
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
8. **Bank details in the Gifting section are placeholders** — replace `[Your Bank Name]` and
   `[0000000000]` before sharing.

---

## 8. Recommended Next Steps

1. Replace placeholder media with the couple's photos/videos.
2. Set `JOTFORM.prayerFormUrl` to the real form URL (the CTA shows an honest notice until then).
3. Fill in real bank details, or switch fully to the online Zainpay flow.
4. Stand up the Zainpay charge + webhook endpoints, then switch `ZAINPAY.mode` to `live`.
5. Create the Supabase project, run the SQL in §5, and paste the URL/anon key into `js/config.js`.
6. Restrict `/admin.html` at the platform level rather than relying on the passcode.
7. Add the GitHub remote and set `SITE_URL` so the keep-alive runs server-side.
8. Optionally add RSVP/guest-seating and a live photo wall.

---

## 9. Public URLs

| Environment | URL |
|-------------|-----|
| Production (Hosted) | *set after Hosted Deploy* |
| Preview | `https://www.genspark.ai/api/code_sandbox_light_git/preview/<project-id>/index.html` |
| Dashboard | `<base>/admin.html` (noindex) |
| Codebase download | `<base>/download.html` |

To make the site live, use the **Publish** tab (or an explicit Hosted Deploy). Note that a deployed
site has its **own** database: rows added in the editor do **not** appear on the live site until you
copy them across.
