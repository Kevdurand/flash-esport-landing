# Flash eSport — landing page

Page de liste d'attente de **Flash eSport**, l'application française qui réunit résultats,
calendriers et compétitions eSport au même endroit — CS2, LoL, VALORANT, Dota 2, R6 et Rocket League.

**Objectif unique de la page :** collecter des adresses email avant le lancement.

> *L'eSport mérite mieux.*

---

## Structure

```
flash-esport-landing/
├── index.html              La page
├── 404.html                Page d'erreur, reprend le même style
├── robots.txt              Instructions pour les moteurs de recherche
├── .gitignore              Fichiers que Git doit ignorer
├── README.md               Ce fichier
└── assets/
    ├── css/
    │   └── style.css       Toute la mise en forme
    ├── js/
    │   └── main.js         Formulaire : validation et confirmation
    └── img/
        ├── bolt.png        L'éclair du logo
        ├── wordmark.png    Le lettrage FLASH ESPORT
        ├── favicon.svg     Icône d'onglet, vectorielle
        ├── favicon-32.png  Icône de secours pour les vieux navigateurs
        ├── apple-touch-icon.png   Icône iOS quand on ajoute à l'écran d'accueil
        └── og-image.png    Visuel 1200×630 affiché au partage d'un lien
```

Aucune dépendance, aucune étape de compilation. C'est du HTML, du CSS et du JavaScript
que le navigateur lit directement.

---

## Voir la page en local

Ouvrir `index.html` d'un double-clic fonctionne, mais un vrai serveur local reproduit
mieux les conditions de production. Depuis le dossier du projet :

```bash
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>. `Ctrl+C` pour arrêter.

---

## Ce qu'il reste à faire

### 1. Brancher Mailerlite — indispensable

Tant que ce n'est pas fait, la page affiche le message de confirmation mais
**n'enregistre aucune adresse**.

Ouvre `assets/js/main.js` et cherche `BRANCHER MAILERLITE ICI`. Deux méthodes y sont
détaillées. Pense à supprimer la ligne qui simule l'envoi :

```js
setTimeout(showSuccess, 850);
```

Teste ensuite avec ta propre adresse et vérifie qu'elle apparaît bien dans ton tableau
de bord Mailerlite **avant** de communiquer le lien.

### 2. Compléter l'adresse de partage

Dans `index.html`, la balise `og:url` attend l'adresse réelle du site :

```html
<meta property="og:url" content="https://flashesport.gg/">
```

L'image de partage, elle, est déjà prête (`assets/img/og-image.png`).

### 3. Une fois en ligne

Décommente la ligne `Sitemap:` dans `robots.txt` et crée le fichier correspondant.

---

## Modifier le design

Les couleurs, les polices et la courbe d'animation sont regroupées dans un seul bloc
`:root` en haut de `assets/css/style.css`. Changer une valeur là se répercute partout.

| Variable | Rôle |
|---|---|
| `--bg` | Fond, `#0A0A0A` |
| `--accent` | Rouge signature, `#FF2E2E` |
| `--text` / `--muted` | Texte principal / secondaire |
| `--font-display` | Police des grands titres — **Anton** |
| `--font-display-weight` | À laisser à `400` |

⚠️ **Anton n'existe qu'en une seule graisse.** Si tu montes `--font-display-weight`
au-dessus de 400, le navigateur fabrique un faux gras qui déforme les lettres.

Pour changer de police d'affichage : ajoute-la au lien Google Fonts dans le `<head>`
de `index.html`, puis modifie les deux variables. Alternatives déjà testées, toutes
gratuites sur Google Fonts : `Saira Condensed` (900), `Big Shoulders Display` (900),
`Archivo Black` (400).

Le corps de texte est en **Exo 2**.

---

## Mise en ligne

Prévu pour **GitHub Pages** : dépôt public, branche `main`, dossier racine.
Réglages dans l'onglet **Settings → Pages** du dépôt.

Le site fonctionne aussi tel quel sur n'importe quel hébergement statique
(Netlify, Cloudflare Pages, OVH, un simple dossier sur un serveur Apache ou Nginx) :
il suffit de déposer le contenu du dossier à la racine.

### Domaine personnalisé sur GitHub Pages

Quatre enregistrements **A** sur le domaine nu :

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Un **CNAME** pour `www` vers `<ton-pseudo>.github.io`, puis Settings → Pages →
Custom domain, et enfin **Enforce HTTPS** une fois la vérification passée au vert.

---

## Notes techniques

- **Mobile d'abord.** Le hero tient sur un écran sans défilement, jusqu'aux petits
  écrans de 360 × 640. Les blocs `@media (max-height: …)` de la feuille de style
  resserrent la mise en page sur les écrans courts.
- **Accessibilité.** Le formulaire a un label, les messages d'erreur sont annoncés
  aux lecteurs d'écran (`aria-live`), et toutes les animations se coupent si le
  système est réglé sur « réduire les animations ».
- **Aucun traceur.** Pas de Google Analytics, pas de cookie, donc pas de bandeau
  de consentement à afficher. Si tu ajoutes un outil de mesure un jour, cette
  question se posera.
