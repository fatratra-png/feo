# FEO — Henoy ara

A music player built on the YouTube catalogue, with an AI that builds playlists, keeps an endless radio going and composes personalised mixes. It ships as a web app and an Expo (iOS/Android) app that share the same design and backend.

## Features

- **Songs only**: search and mixes filter out films, radio dramas, TV sketches, full albums, concerts and compilations.
- **Endless AI radio**: when the queue runs low, the AI picks what comes next. If the AI is unavailable, it falls back to a YouTube mix.
- **Playlist from a prompt**: describe a moment ("chill Malagasy evening, 2000s") and get a playable, saveable playlist.
- **Smart search**: describe a song in plain language ("the 2010 World Cup song that goes waka waka").
- **"For you" mixes** on the home screen, built from what you finish, skip and like.
- Likes, editable playlists, listening history, a full-screen player, and light/dark themes.

## Requirements

- Node.js ≥ 20 and PostgreSQL
- **yt-dlp ≥ 2026.10 with its extras**: `python3 -m pip install --user -U "yt-dlp[default]"`.
  The `yt-dlp-ejs` package and Node as JS runtime are required: without them YouTube cuts audio streams after ~1 MB.

## Getting started

```bash
cp apps/backend/.env.example apps/backend/.env   # DATABASE_URL, JWT_*, LLM_API_KEY…
npm --prefix apps/backend install && npm --prefix apps/web install
npm run dev:backend    # API on :3001 (migrates the database on startup)
npm run dev:web        # web app on :5173
npm test               # backend (mocha) + web (vitest) tests
```

### Mobile app (Expo SDK 58)

```bash
cd apps/mobile
npm install
cp .env.example .env    # set EXPO_PUBLIC_API_URL to your computer's LAN IP
npx expo start          # scan the QR code with Expo Go, or press w for the web preview
```

On a phone, `localhost` refers to the phone itself, so the API URL must point to the machine that runs the backend. Playback continues in the background and shows on the lock screen.

## AI (OpenRouter)

The AI is configured with `LLM_BASE_URL`, `LLM_API_KEY`, `AI_MODEL`, `AI_FALLBACK_MODEL`, `AI_MODEL_FAST` and `AI_MODEL_ALT`.
Models are tried as a chain, with adaptive routing based on measured latency. Model reasoning is turned off on purpose: with it on, these models sometimes reasoned for ~90 s before answering; without it they answer in 7–15 s.

⚠️ Without credits, OpenRouter limits `:free` models to **50 requests/day per account**. Once that quota is reached the AI pauses until the daily reset, and every feature falls back instantly to a non-AI result (YouTube mix for the radio, search for playlists).

## Architecture

- `apps/backend` — Express + PostgreSQL + zod.
  - `services/youtube.ts`: async yt-dlp, caches, songs-only filter.
  - `services/ai.ts`: radio, prompt playlists, smart search, home mixes.
  - `services/library.ts`: likes, plays, taste profile.
  - `routes.ts`: all endpoints, including the sliced, range-aware audio proxy.
- `apps/web` — React 19 + Vite + Tailwind v4 + Zustand + TanStack Query. Light/dark themes via `data-theme`; the player lives in `stores/player.ts` + `components/player/AudioEngine.tsx`.
- `apps/mobile` — Expo SDK 58 + React Native + React Navigation. It uses the same design tokens as the web (`src/theme/tokens.ts`), the same player store, and `expo-audio` for background playback.
