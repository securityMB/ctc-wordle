# CTC Wordle Archive

**Live site:** <https://ctc-wordle.netlify.app/>

A fast, static searchable archive of **Wordle in a Minute** solves from [Cracking The Cryptic](https://www.youtube.com/@CrackingTheCryptic), featuring full color-coded guess boards, solve times, and an in-browser SQLite explorer.

> **Disclaimer:** This is a fan-made project and is **not affiliated with Cracking The Cryptic**. Guesses and solve times are extracted automatically from videos using computer vision, a custom ML classifier, and a VLM, so occasional inaccuracies may occur.

## Features

- **Static Site Generation (SSG):** Built with **Astro 7** and **Preact** — the initial archive page (stats + first 50 solves) is pre-rendered directly into static HTML (`dist/index.html`) with zero server-side runtime.
- **Instant Filtering & URL Sync:** Search by solution or guess word (with 100ms debounce), filter by attempts (`1–6`, `X`), exact date, month, or date range, and sort by date or solve time — all synced with URL query parameters.
- **In-Browser SQL Explorer (`/sql-explorer`):** Lazy-loads **SQLite (WebAssembly)** via `sql.js` and queries a build-time generated `wordle.sqlite` (`games` and `guesses` tables) directly in your browser.
- **YouTube Embed Modal:** Click **▶ Watch** to open a lightweight Shorts-friendly player modal with keyboard controls (`Space`: play/pause, `←`/`→`: ±10s, `Esc`: close).
- **Light & Dark Theme:** Toggleable theme persisted in `localStorage`.

## Project Structure

```text
├── astro.config.mjs       # Astro 7 + Preact + build-ID cache-busting config
├── netlify.toml           # Netlify build & cache headers (Node 24)
├── scripts/
│   └── prebuild.ts        # Generates solves.json, wordle.sqlite, and sql-wasm.wasm
├── data/                  # Monthly Wordle JSON archives (YYYY-MM.json)
├── public/
│   └── favicon.svg        # CTC tile SVG favicon
└── src/
    ├── components/        # StatsBar.astro, GamesTable.tsx, SqlExplorer.tsx
    ├── layouts/           # Layout.astro
    ├── pages/             # index.astro (/), sql-explorer.astro (/sql-explorer)
    ├── scripts/           # sqlExplorer.ts (lazy sql.js loader + presets)
    └── styles/            # global.css
```

## Local Development

Requires **Node.js 22.18+ / 24+** (native TypeScript execution for `scripts/prebuild.ts`).

```bash
npm install
npm run prebuild   # generates public/data/solves.json, wordle.sqlite, sql-wasm.wasm
npm run dev        # local dev server
```

### Production Build & Preview

```bash
npm run build
npm run preview
```

## Deployment

Configured for **Netlify** via `netlify.toml` (`npm run build` → `dist/`). Every build generates fresh `solves.json`, `wordle.sqlite`, and `sql-wasm.wasm` with a per-build cache-busting query parameter.
