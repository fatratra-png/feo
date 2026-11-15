# Tests de FEO

Trois niveaux de tests, du plus rapide au plus complet. Aucun n'appelle
YouTube ni l'IA : ces services sont simulés, donc les tests passent partout,
y compris en CI.

| Niveau | Outil | Où | Commande |
| --- | --- | --- | --- |
| Unitaires backend | Mocha + Chai | `apps/backend/tests/*.test.ts` | `cd apps/backend && npm test` |
| Intégration API (HTTP + PostgreSQL) | Mocha + Supertest | `apps/backend/tests/api.integration.test.ts` | idem, avec `TEST_DATABASE_URL` |
| Unitaires web | Vitest (+ jsdom, Testing Library) | `apps/web/tests/*.test.ts(x)` | `cd apps/web && npm test` |
| End-to-end | Cypress | `apps/web/cypress/e2e/*.cy.ts` | `cd apps/web && npm run test:e2e` |

La CI (`.github/workflows/ci.yml`) exécute les quatre sur chaque pull request,
avec un PostgreSQL de service.

## Backend

```bash
cd apps/backend
npm test
```

Sans base de données, les tests d'intégration sont marqués *pending* et le
reste s'exécute. Pour les lancer, donnez une base **dédiée aux tests** : la
suite vide ses tables au démarrage.

```bash
# Base locale : un schéma séparé suffit (pas besoin du droit CREATE DATABASE)
psql "$DATABASE_URL" -c 'CREATE SCHEMA IF NOT EXISTS feo_test'
TEST_DATABASE_URL="postgresql://feo:…@localhost:5432/feo?options=-c%20search_path%3Dfeo_test" npm test
```

`tests/setup.ts` est chargé avant tous les fichiers : il fournit les variables
d'environnement requises, désactive l'IA et le préchargement des flux.

Ce qui est couvert :

- `core.test.ts` : extraction JSON des réponses LLM, routage des modèles,
  choix du meilleur résultat YouTube, filtre « chansons uniquement »,
  métadonnées, en-têtes `Range`, caches, limiteur de concurrence.
- `innertube.test.ts` : lecture des réponses InnerTube (recherche, pagination,
  mix), erreurs HTTP, et le service `youtube` au-dessus (nettoyage des titres,
  doublons, direct et compilations écartés).
- `auth.integration.test.ts` : changement de mot de passe, mot de passe
  oublié et réinitialisation (lien à usage unique, limite d'envois, aucune
  fuite sur l'existence d'un compte), connexion Google et GitHub (création,
  liaison par email vérifié, protection CSRF, annulation, retour vers
  l'app mobile).
- `playlistBalance.test.ts` : respect des genres demandés dans les playlists IA.
- `api.integration.test.ts` : inscription, connexion, rotation et révocation
  des refresh tokens, likes, écoutes et historique, playlists (création,
  ajout, réordonnancement, renommage, suppression, accès d'un autre
  utilisateur), validation des entrées, recherche avec YouTube simulé.

## Web

```bash
cd apps/web
npm test          # une fois
npm run test:watch
```

- `player.test.ts` : file d'attente, répétition, aléatoire, signaux d'écoute,
  radio IA, couleur d'accent.
- `AudioEngine.test.tsx` : lecture via le proxy de l'API, bascule automatique
  vers le lecteur YouTube intégré quand le proxy échoue, synchronisation
  lecture/pause/position/volume, titre suivant, titres non intégrables.
- `youtubeEmbed.test.ts` : chargement de l'API IFrame, préférence mémorisée.
- `api.test.ts` : jeton d'accès, rafraîchissement de session (unique pour des
  requêtes simultanées), expiration, messages d'erreur.
- `stores.test.ts` : authentification, notifications, thème.
- `format.test.ts` : durées, pluriels, dates relatives.

## End-to-end (Cypress)

Les tests e2e pilotent la vraie application web contre la vraie API et une
vraie base PostgreSQL. Seul YouTube est simulé (`cy.fakeYouTube()` dans
`cypress/support/e2e.ts`) : résultats de recherche, flux audio (un fichier WAV
silencieux), pochettes et lecteur IFrame.

```bash
cd apps/web
E2E_DATABASE_URL="postgresql://…/feo_e2e" npm run test:e2e
```

La commande démarre l'API sur le port 3101 et le site sur le port 5174,
attend qu'ils répondent, lance `cypress run` puis arrête tout. Comme pour
l'intégration, utilisez une base ou un schéma réservé aux tests :
`?options=-c%20search_path%3Dfeo_test` fonctionne aussi.

Pour écrire ou déboguer un test, démarrez la pile puis ouvrez l'interface :

```bash
E2E_DATABASE_URL=… npm run e2e:api   # terminal 1
npm run e2e:web                      # terminal 2
npm run e2e:open                     # terminal 3
```

Scénarios couverts :

- `auth.cy.ts` : redirection vers la connexion, validation du formulaire,
  inscription → déconnexion → connexion, mauvais mot de passe, email déjà
  utilisé, session conservée au rechargement.
- `playback.cy.ts` : recherche, lecture via le proxy audio, pause/reprise et
  titre suivant au clavier, bouton du lecteur.
- `youtube-fallback.cy.ts` : l'API est bloquée par YouTube → la lecture
  continue via le lecteur intégré, sans nouvel essai du proxy ; pause/reprise ;
  titre refusé par l'intégration → titre suivant.
- `library.cy.ts` : like persistant dans « Titres likés », création d'une
  playlist depuis un titre, renommage et suppression.
- `account.cy.ts` : changement de mot de passe depuis « Mon compte »,
  mot de passe oublié avec le lien reçu par email (lu via `/api/test/outbox`,
  route montée seulement quand `NODE_ENV=test`), boutons Google/GitHub et
  retour de connexion.
