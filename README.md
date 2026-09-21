# Flash eSport — site V1

Site statique (HTML, CSS, JavaScript), sans outil de compilation.
Hébergé sur GitHub Pages, domaine `flashesport.gg`.

## Pages
- `index.html` — Accueil
- `telechargement.html` — Téléchargement
- `contact.html` — Contact et questions fréquentes (sert d'URL d'assistance App Store)
- `mentions-legales.html`, `privacy.html`, `cgu.html` — pages légales (URL de confidentialité App Store : https://flashesport.gg/privacy.html)
- `404.html` — page introuvable

## Ne pas supprimer
- `CNAME` : relie le dépôt au domaine flashesport.gg
- `.nojekyll` : GitHub Pages sert les fichiers tels quels
- `assets/fonts/LICENSE-*` : licences obligatoires des polices

## Règles
- Charte : fond #000000, rouge #B00000 (textes et accents), boutons #30FF0000 / #40FF0000, rayon 8, Anton + Exo 2.
- Aucun logo d'équipe, de jeu ou d'éditeur, aucun visage réel : les équipes affichées sont fictives.
- Aucun cookie ni script tiers (sinon mettre à jour la politique de confidentialité et ajouter un bandeau de consentement).

## Aperçu local
Lancer `python3 -m http.server 8000 --bind 127.0.0.1` dans ce dossier, puis ouvrir http://127.0.0.1:8000 (la CSP peut bloquer l'aperçu par double-clic).

Si le script inline du `<head>` change, recalculer son empreinte et la reporter dans la CSP des 7 pages :
```sh
printf '%s' 'document.documentElement.classList.add("js")' | openssl dgst -sha256 -binary | openssl base64
```
