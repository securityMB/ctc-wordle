# AGENTS.md — ctc-wordle

Static Astro 7 + Preact archive for Cracking The Cryptic's _Wordle in a Minute_ solves, deployed to Netlify (`https://ctc-wordle.netlify.app`).

## Data & Build Pipeline

- **Source of truth:** `data/20*.json` (monthly arrays of `{ youtubeId, date, correctWord, guesses, solveTimeSeconds }`).
- **Build-generated files (do not edit manually):** `scripts/prebuild.ts` generates `public/data/solves.json`, `public/data/wordle.sqlite`, and `public/data/sql-wasm.wasm`.
- **Shared domain & SSG loader:** `lib/games.ts` (`loadAllGames()`) and `lib/wordle.ts` (`isSolved()`, `scoreGuess()`) are shared across `scripts/prebuild.ts`, `src/pages/index.astro`, and `src/components/`.
- **SQL Explorer:** `src/components/SqlExplorer.tsx` communicates with `src/scripts/sqlExplorer.ts`, which runs `sql.js` inside a dedicated Web Worker (`src/scripts/sqlWorker.ts`) with `PRAGMA query_only = ON;` against `/data/wordle.sqlite`.

## Verification Commands

- `npm test` — runs Vitest (`tests/*.test.{ts,tsx}`: Astro Container rendering, Preact `happy-dom` tests, and SQLite preset checks). Note: `tests/sql-explorer.test.tsx` expects `public/data/wordle.sqlite` to exist (run `npm run prebuild` if missing).
- `npm run check` — runs `astro check` (primary typechecker; `tsconfig.json` extends `astro/tsconfigs/strictest`, and standalone `tsc --noEmit` does not resolve `.astro` imports in `tests/`).
- `npm run build` — runs `prebuild` + `astro build` into `dist/`.

## Conventions

- In Vitest tests, prefer `.toEqual(...)` over `.toBe(...)` (including for booleans and primitives).
- Keep all code changes verified with `npm test && npm run check && npm run build` after the final edit.
- Do not run `git commit` or `git push` unless explicitly requested by the user.
