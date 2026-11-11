# Déploiement de FEO

Le frontend statique est hébergé sur Vercel. L'API doit rester un service Node
persistant : elle lance `yt-dlp`, dépend d'un runtime Node pour YouTube et
transmet des flux audio avec prise en charge des requêtes HTTP Range. Le
`Dockerfile` et `render.yaml` configurent cette API sur Render. PostgreSQL est
hébergé séparément sur Neon.

## 1. Créer la base Neon

Créez un projet PostgreSQL dans la région que vous utiliserez pour l'API Render.
Conservez les deux chaînes de connexion Neon avec `sslmode=require` :
`DATABASE_URL` (poolée) pour les requêtes de l'API et `DATABASE_URL_UNPOOLED`
(directe) pour les migrations. Gardez ces valeurs secrètes.

L'API applique automatiquement les migrations au démarrage. N'exécutez pas
manuellement la migration en parallèle d'un premier démarrage.

## 2. Déployer l'API sur Render

Créez un Blueprint Render à partir du dépôt : il détectera `render.yaml` à la
racine. Avant de créer le service, vérifiez la région Render et le plan tarifaire
choisis. La région est difficile à modifier ensuite; privilégiez la même région
que Neon. Le Blueprint demande le plan gratuit pour éviter des frais; le service
s'endort après inactivité, ce qui entraîne un délai au premier démarrage et ne
convient pas à une lecture audio toujours réactive.

Renseignez les variables demandées par le Blueprint :

- `DATABASE_URL` : chaîne Neon poolée et secrète.
- `DATABASE_URL_UNPOOLED` : chaîne Neon directe, utilisée pour les migrations.
- `FRONTEND_URL` : origine de production Vercel, sans chemin ni slash final
  (par exemple `https://feo.vercel.app`). Plusieurs origines sont séparées par
  des virgules; ajoutez aussi votre domaine personnalisé s'il existe.
- `JWT_SECRET` et `JWT_REFRESH_SECRET` : générées par Render.

`LLM_API_KEY` est facultative : sans elle, le backend démarre avec les fonctions
IA désactivées et leurs solutions de repli. Pour activer l'IA, ajoutez la clé
OpenRouter dans les variables secrètes Render. Le backend expose
`https://<service>.onrender.com/api/health`; une réponse JSON avec
`"status":"ok"` confirme que l'API et la connexion de démarrage fonctionnent.

## 3. Déployer le web sur Vercel

Importez le dépôt dans Vercel et configurez le projet ainsi :

- **Root Directory** : `apps/web`
- **Framework Preset** : Vite
- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Environment Variable** : `VITE_API_URL=https://<service>.onrender.com/api`

`VITE_API_URL` est intégré au bundle lors du build et ne doit contenir aucun
secret. Redéployez après l'avoir modifié. `vercel.json` assure également le
fallback SPA pour les routes React.

Si vous utilisez un domaine Vercel ou un domaine personnalisé différent,
ajoutez exactement son origine à `FRONTEND_URL` sur Render, puis redéployez
l'API. Les origines des déploiements preview doivent aussi être autorisées si
vous souhaitez tester l'application depuis ces URLs.

## 4. Vérifications avant ouverture

1. Vérifiez `/api/health` sur l'URL Render et l'absence d'erreurs de migration
   dans les logs.
2. Ouvrez `/login` directement sur le domaine Vercel (pas seulement la page
   d'accueil) pour vérifier le fallback SPA.
3. Créez un compte, connectez-vous, puis vérifiez recherche, bibliothèque,
   lecture audio et lecture suivante. Une recherche peut échouer si YouTube
   impose un challenge anti-robot; les cookies yt-dlp restent facultatifs.
4. Vérifiez les logs Render et la console réseau du navigateur : aucune erreur
   CORS, aucune URL API pointant vers `localhost`, et les requêtes audio doivent
   répondre avec les en-têtes `Accept-Ranges`/`Content-Range`.
