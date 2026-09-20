# No Fake

Site qui vérifie si une photo ou une vidéo est un montage ou une image générée par IA, en s'appuyant sur l'API Gemini de Google (vision).

## Structure

- `index.html`, `style.css`, `app.js` — le site (statique)
- `api/analyze.js` — fonction serverless Vercel qui appelle l'API Gemini
- `vercel.json` — configuration Vercel

## Obtenir une clé Gemini gratuite

1. Allez sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey) et connectez-vous avec un compte Google.
2. Cliquez sur **Create API key**.
3. Copiez la clé générée — aucune carte bancaire n'est demandée pour le niveau gratuit.

Le niveau gratuit a des limites de débit (nombre de requêtes par minute/jour) plus basses que le niveau payant, largement suffisantes pour un usage personnel.

## Déploiement sur Vercel

### Option A — via l'interface Vercel (le plus simple)

1. Mettez ce dossier dans un dépôt Git (GitHub, GitLab ou Bitbucket).
2. Sur [vercel.com](https://vercel.com), cliquez sur **Add New → Project** et importez le dépôt.
3. Laissez les réglages par défaut (aucun framework à sélectionner, c'est un projet statique + fonctions).
4. Dans **Settings → Environment Variables**, ajoutez :
   - `GEMINI_API_KEY` = votre clé Gemini
   - `GEMINI_MODEL` (optionnel) = le modèle à utiliser, par défaut `gemini-3.5-flash`
5. Cliquez sur **Deploy**.

Si vous aviez déjà déployé ce projet avec l'ancienne version (Anthropic), remplacez tous les fichiers par ceux de ce zip, puis dans **Settings → Environment Variables** supprimez `ANTHROPIC_API_KEY` et ajoutez `GEMINI_API_KEY` à la place. Après tout changement de variable d'environnement, il faut **redéployer** (Deployments → menu ⋯ → Redeploy) — la modification seule ne relance pas le site.

### Option B — via la CLI Vercel

```bash
npm install -g vercel
cd no-fake-vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

## Notes

- La clé API reste côté serveur (dans la fonction `api/analyze.js`) — elle n'est jamais exposée au navigateur.
- Les images sont réduites côté client avant l'envoi pour rester sous la limite de taille des fonctions Vercel.
- Pour une vidéo, seule une image extraite de la vidéo est analysée, pas le fichier entier.
- Les noms de modèles Gemini changent assez souvent ; si `gemini-3.5-flash` venait à être retiré, vérifiez la liste actuelle sur [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) et mettez à jour la variable `GEMINI_MODEL`.
- Le verdict rendu est un avis visuel donné par une IA, pas une expertise judiciaire.
