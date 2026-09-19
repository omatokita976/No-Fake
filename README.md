# No Fake

Site qui vérifie si une photo ou une vidéo est un montage ou une image générée par IA, en s'appuyant sur l'API Anthropic (Claude) avec vision.

## Structure

- `index.html`, `style.css`, `app.js` — le site (statique)
- `api/analyze.js` — fonction serverless Vercel qui appelle l'API Anthropic
- `vercel.json` — configuration Vercel

## Déploiement sur Vercel

### Option A — via l'interface Vercel (le plus simple)

1. Mettez ce dossier dans un dépôt Git (GitHub, GitLab ou Bitbucket).
2. Sur [vercel.com](https://vercel.com), cliquez sur **Add New → Project** et importez le dépôt.
3. Laissez les réglages par défaut (aucun framework à sélectionner, c'est un projet statique + fonctions).
4. Dans **Settings → Environment Variables**, ajoutez :
   - `ANTHROPIC_API_KEY` = votre clé API Anthropic (à récupérer sur [console.anthropic.com](https://console.anthropic.com))
   - `CLAUDE_MODEL` (optionnel) = le modèle à utiliser, par défaut `claude-sonnet-5`
5. Cliquez sur **Deploy**.

### Option B — via la CLI Vercel

```bash
npm install -g vercel
cd no-fake-vercel
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## Notes

- La clé API reste côté serveur (dans la fonction `api/analyze.js`) — elle n'est jamais exposée au navigateur.
- Les images sont réduites côté client avant l'envoi pour rester sous la limite de taille des fonctions Vercel.
- Pour une vidéo, seule une image extraite de la vidéo est analysée, pas le fichier entier.
- Le verdict rendu est un avis visuel donné par une IA, pas une expertise judiciaire.
