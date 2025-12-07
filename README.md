# LogoCraft — Logo Design Article (Multi-language)

Professional single-page demo that displays a logo-design article and translates it into 100+ languages (provider-dependent).

## What you get
- `index.html`, `styles.css`, `script.js` — colorful, responsive frontend.
- `server.js` — Node/Express backend that proxies translation requests to:
  - **Google Translate (v2)** — requires `GOOGLE_API_KEY` (paid).
  - **LibreTranslate** — public instances exist (e.g. `https://libretranslate.de`) and some self-hosted installs.
- `i18n.json` — small UI strings file.

## How it works
1. Frontend fetches supported languages from the server (`/api/languages`).
2. When user clicks **Translate**, the client posts article HTML to `/api/translate`.
3. Server splits the HTML into blocks and translates block text via provider, then returns translated HTML.
4. Translations are cached in browser sessionStorage for faster repeat loads.

## Setup (local)
1. Clone or copy files into a folder.
2. Init & install:
```bash
npm init -y
npm install express express-rate-limit cors node-fetch
