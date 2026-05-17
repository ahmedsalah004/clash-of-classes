# Clash of Classes — Claude Project Guide

## Project overview

Clash of Classes is a browser-based classroom quiz and live revision game platform. Teachers pick a curriculum pack, configure teams, and host a live Jeopardy-style board game on a smartboard. The entire app is frontend-only (React + TypeScript + Vite); content is fetched from a deployed Cloudflare Worker API.

## Tech stack

- **React 18** + **TypeScript** (strict)
- **Vite 5** — dev server and production bundler
- **Plain CSS** (`src/styles.css`) — no CSS framework
- **Cloudflare Workers** — content API lives in `workers/content-api/`

## Repository layout

```
src/
  App.tsx                  # Entire game UI — single-file, screen-driven
  main.tsx                 # React root mount
  styles.css               # All styles
  api/
    contentApi.ts          # Fetch helpers + response mapping for the Worker API
  data/
    sampleMatterPack.ts    # Local fallback pack (Cambridge Stage 5 Science)
  types/
    game.ts                # Core domain types: Pack, Category, Question, Team, GameState
workers/
  content-api/             # Cloudflare Worker that serves /packs and /packs/:id
```

## Development commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite production build → dist/
npm run preview      # preview production build locally
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_CONTENT_API_BASE_URL` | `https://clash-content-api.clashofclasses.workers.dev` | Override the content API base URL |

## Architecture notes

### Screen model (`App.tsx`)

The app uses a `Screen` union type (`'home' | 'pack-selection' | 'team-setup' | 'board' | 'question'`) and renders the correct section via conditionals. There is intentionally no router.

### Pack selection funnel

Four-step drill-down: **Curriculum → Year/Level → Subject → Pack**. Each step filters `availablePacks` in-memory using the `normalizeCurriculum`, `normalizeLevel`, and `normalizeSubject` helpers.

### Game state (`GameState`)

Held in a single `useState<GameState | null>` in `App`. Key fields:
- `pack` — full pack with categories and questions
- `teams` — array of `Team` (id, name, points, lifelinesUsed)
- `currentTeamTurnIndex` — index into `teams`
- `usedQuestionIds` — set of consumed question IDs
- `phase` — `'board'` or `'question'`
- `stealPhase` — whether the 15 s other-team steal window is active

### Timers

- Main timer: 60 s countdown, triggers steal phase on expiry
- Other-team timer: 15 s countdown, runs during steal phase
- Warning audio (`/assets/sounds/timer-warning.mp3`) loops when ≤ 10 s remain

### Lifelines

Each team gets three one-use lifelines per game: **MCQ options**, **Hint**, and **Give two answers**. Consumed state lives in `team.lifelinesUsed`.

### Content API (`src/api/contentApi.ts`)

- `fetchPackSummaries()` — `GET /packs`, returns `Pack[]` (no categories)
- `fetchPackById(id)` — `GET /packs/:id`, returns full `Pack` with categories and questions
- Both results are cached in module-level variables for the session lifetime
- If the API is unavailable at pack-selection time, `sampleMatterPack` is used as a fallback

### Fallback pack

`src/data/sampleMatterPack.ts` is a hardcoded Cambridge Stage 5 Science pack (unit: Matter). It activates automatically when:
1. `fetchPackSummaries()` throws, **or**
2. The selected pack is `y5s-u3-matter` and `fetchPackById` fails / returns empty categories

## Key invariants — do not break

- **No router** — navigation is screen-state only; do not add `react-router` or similar.
- **No auth / database** — the app is intentionally stateless between page loads.
- **Google Sheet URLs stay private** — they live in the Worker environment; the React app only knows the public Worker base URL.
- **`sampleMatterPack` is the safety net** — always keep it loadable so offline classroom play works.
- **TypeScript strict** — `tsc -b` must pass before Vite build; keep it green.

## Testing

There is no automated test suite yet. Manually verify changes with `npm run dev` and walk through:
1. Home → Start Classroom Mode
2. Pick a curriculum, level, subject, and pack
3. Set team names and start the game
4. Open a question, use each lifeline, mark correct/incorrect, and observe score changes
5. Confirm the steal phase activates after an incorrect answer
