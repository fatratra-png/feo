# FEO — Henoy ara

Lecteur de musique web (catalogue YouTube) avec une IA qui compose des playlists, une radio infinie et des mix personnalisés.

## Prérequis

- Node.js ≥ 20 et PostgreSQL
- **yt-dlp ≥ 2026.10 avec ses extras** : `python3 -m pip install --user -U "yt-dlp[default]"`
  (le paquet `yt-dlp-ejs` + Node comme moteur JS sont indispensables : sans eux YouTube coupe les flux audio après ~1 Mo)

## Démarrage

```bash
cp apps/backend/.env.example apps/backend/.env   # DATABASE_URL, JWT_*, LLM_API_KEY…
npm --prefix apps/backend install && npm --prefix apps/web install
npm run dev:backend    # API sur :3001 (migre la base au démarrage)
npm run dev:web        # interface sur :5173
npm test               # tests backend (mocha) + frontend (vitest)
```

## IA (OpenRouter)

Configurée par `LLM_BASE_URL`, `LLM_API_KEY`, `AI_MODEL`, `AI_FALLBACK_MODEL`, `AI_MODEL_FAST`, `AI_MODEL_ALT`.
Les modèles sont essayés en chaîne, avec un routage adaptatif selon la latence mesurée. Le raisonnement est désactivé exprès : avec lui, ces modèles réfléchissaient parfois 90 s avant de répondre.

⚠️ Sans crédits, OpenRouter limite les modèles `:free` à **50 requêtes/jour par compte**. Quand ce quota est atteint, l'IA se met en pause jusqu'à la remise à zéro, et chaque fonction bascule sur un repli sans IA : mix YouTube pour la radio, recherche pour les playlists.

## Architecture

- `apps/backend` — Express + PostgreSQL + zod. `services/youtube.ts` (yt-dlp asynchrone, caches, filtre « chansons uniquement »), `services/ai.ts` (radio, playlist par prompt, recherche IA, mix d'accueil), `services/library.ts` (likes, écoutes, profil de goût), `routes.ts` (dont le proxy audio par tranches).
- `apps/web` — React 19 + Vite + Tailwind v4 + Zustand + TanStack Query. Thèmes clair/sombre (`data-theme`), lecteur dans `stores/player.ts` + `components/player/AudioEngine.tsx`.
