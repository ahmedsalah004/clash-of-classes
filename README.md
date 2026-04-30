# Clash of Classes

First MVP scaffold for a classroom quiz and live revision game platform.

## Tech stack

- React + TypeScript
- Vite
- Plain CSS (clean baseline styles for quick iteration)

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Run the development server

```bash
npm run dev
```

Then open the local URL shown in your terminal (typically `http://localhost:5173`).

### 3) Create a production build

```bash
npm run build
```

## Content API integration (Classroom Mode)

The Classroom Mode pack flow connects to the deployed Clash Content API Worker.

- Default API base URL: `https://clash-content-api.clashofclasses.workers.dev`
- Optional override: `VITE_CONTENT_API_BASE_URL`

Example:

```bash
VITE_CONTENT_API_BASE_URL=https://clash-content-api.clashofclasses.workers.dev npm run dev
```

### Fallback behaviour

- Pack Selection tries `GET /packs` from the Worker.
- If pack list loading fails, the app shows an error and falls back to local `sampleMatterPack` so classroom play can continue.
- Game start fetches full pack data from `GET /packs/:packId`.
- If loading `y5s-u3-matter` fails (or has no questions), the app falls back to local `sampleMatterPack`.
- The game will not start with empty categories/questions for non-fallback packs.

### Security/content boundary note

Google Sheet CSV source URLs remain private in the Worker environment.
The React app only uses the public Worker API base URL and does not expose sheet URLs.

## MVP scaffold included

- Homepage branded as **Clash of Classes**
- Hero section describing live classroom quiz battles and revision games
- Placeholder sections for:
  - Teacher dashboard
  - Create a game
  - Join with room code
  - Live classroom screen

## Not included yet

- Authentication
- Database
- Paid services
- Firebase / Supabase integrations

This is intentionally a lightweight, frontend-only starting point for future features.
