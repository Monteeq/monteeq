# Monteeq Next.js cutover checklist

Production still serves the Vite app in `frontend/`. Use this checklist when you are ready to switch the live site to `next-app/`. **Do not** follow the live steps until Next is smoke-tested.

## Before switching

### Environment (Vercel / host)

Set these from [`next-app/.env.example`](.env.example):

| Variable | Required | Notes |
|---|---|---|
| `API_BASE_URL` | Yes | FastAPI origin (server-only), no `/api/v1` suffix |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Same origin for browser HLS / client fetch |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical / OG origin, no trailing slash |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes (auth) | Google OAuth web client |
| `NEXT_PUBLIC_WS_HOST` | Optional | Chat WebSocket host; empty = page host |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Optional | Ads |
| `NEXT_PUBLIC_ADSENSE_MULTIPLEX_SLOT_ID` | Optional | Watch multiplex |
| `NEXT_PUBLIC_ADSENSE_INFEED_SLOT_ID` | Optional | Search / feed |
| `NEXT_PUBLIC_ADSENSE_INFEED_LAYOUT_KEY` | Optional | In-feed layout |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Optional | Pro checkout (still Coming Soon in UI) |

### Vercel project

1. Set **Root Directory** to `next-app` (not `frontend`).
2. Framework: Next.js (see [`vercel.json`](vercel.json) — **no** SPA rewrite to `index.html`).
3. Remove or ignore `frontend/vercel.json` SPA rewrites when the Next project is active.
4. Confirm build command is `npm run build` (Next default) and output is handled by the Next.js builder.

### Local scripts

From repo root (Next is the default UI):

- `npm run dev` / `npm run dev:lite` — **Next** + services
- `npm run dev:next` — Next only
- `npm run build` / `npm run build:next` — Next production build
- `npm run install:next` — install Next deps only
- `npm run dev:vite` / `npm run dev:lite:vite` — legacy Vite UI (kept until cutover is stable)

Default `dev` / `build` point at **Next**. Vite remains available under `dev:vite` / `build:frontend`.

## Smoke test (staging or preview deploy)

- [ ] Login / signup / Google OAuth / logout
- [ ] Verify + onboarding redirects
- [ ] Flash feed (scroll, like, comments, report, URL sync, tab title)
- [ ] Watch (play, like, Watch Later, report, share, download, AdSense if env set)
- [ ] Posts feed + report
- [ ] Chat WebSocket send/receive
- [ ] Upload
- [ ] Notifications toast / achievement celebration (`NotificationManager`)
- [ ] Protected routes redirect when logged out
- [ ] `robots.txt`, `sitemap.xml`, `ads.txt`, `sw.js` serve from origin
- [ ] Push subscription after login (if VAPID configured on backend)

## Go live

1. Deploy Next preview; finish smoke list.
2. Point production Root Directory → `next-app` and promote.
3. Keep `frontend/` in the repo until Next is stable for a release or two.

## Rollback

1. Point Vercel Root Directory back to `frontend`.
2. Ensure SPA rewrite from `frontend/vercel.json` is active again.
3. Redeploy the Vite project.

Auth remains **localStorage token + `Authorization` Bearer** (same as Vite). Do not introduce httpOnly cookie middleware without revisiting cross-site API constraints (HF Spaces).
