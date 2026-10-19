# StrikZy eSport — site officiel

StrikZy s'appelait auparavant Flash eSport. Accroche : « Tous tes matchs eSport en direct. »

Site statique (HTML, CSS, JavaScript en modules ES natifs), sans framework, sans bundler, sans étape de build.
Hébergé sur GitHub Pages, domaine `strikzy.gg`.

## Pages
- `index.html` — accueil : le Z du logo en verre rouge (WebGL, Three.js r160 hébergé dans le repo) piloté par le scroll, 5 chapitres
- `telechargement.html` — téléchargement
- `faq.html` — questions fréquentes
- `contact.html` — contact (sert d'URL d'assistance App Store)
- `mentions-legales.html`, `privacy.html`, `cgu.html` — pages légales (URL de confidentialité App Store : https://strikzy.gg/privacy.html)
- `404.html` — page introuvable

## Organisation
- `assets/css/tokens.css` — la charte en variables CSS (seul endroit où des couleurs sont écrites)
- `assets/css/base.css` — gabarit commun (polices, en-tête, menu, boutons, pied de page)
- `assets/css/accueil.css`, `assets/css/pages.css` — accueil / pages secondaires
- `assets/js/demarrage.js` — choix du mode d'affichage de l'accueil et préchargeur
- `assets/js/accueil.js` — point d'entrée de l'accueil (charge le moteur 3D seulement si utile)
- `assets/js/app.js` — moteur 3D (Z en verre à diagonale lumineuse, éclats, scroll lissé, modes allégé et statique)
- `assets/js/site.js` — comportements communs (menu mobile, boutons des stores)
- `assets/shapes/z.svg` — silhouette du Z (celle du logo)
- `assets/app/` — captures de l'app (remplaçables en gardant le même nom de fichier)
- `assets/vendor/` — Three.js r160 + SVGLoader, versions et empreintes dans `VERSIONS.md`

## Modes de l'accueil
- normal : scène 3D ; `?lite=1` force le mode allégé ; `?statique=1` force l'image fixe
- « mouvement réduit » (réglage du système) ou WebGL2 absent : image fixe du Z (`assets/img/z-poster.webp`) et simples fondus
- `?debug=1` : active les crochets de test (`window.__glassSite`)

## Activer les boutons des stores
Renseigner l'adresse dans l'attribut `data-store-url=""` de chaque bouton (accueil et page téléchargement). Rien d'autre à changer.

## Ne pas supprimer
- `CNAME` : relie le dépôt au domaine strikzy.gg
- `.nojekyll` : GitHub Pages sert les fichiers tels quels
- `assets/fonts/LICENSE-*`, `assets/vendor/licenses/` : licences obligatoires

## Règles
- Charte StrikZy : fond #000000, rouge #B00000 en accent seulement (diagonale du Z, traits, pastilles du direct), surfaces #101010, texte secondaire #8A8A8A, rayon 8, Anton + Exo 2.
- Logo « La Frappe » : STRIKZY en Anton blanc, seule la diagonale du Z en rouge ; en SVG dans l'en-tête et le pied de page.
- Écriture : « StrikZy » dans le texte, « StrikZy eSport » en nom complet, « STRIKZY » dans les logos. Toujours « en direct ».
- Identifiants techniques à ne jamais changer : bundle iOS `com.flashesport.mobile`, projet Firebase et URL des Cloud Functions.
- Aucun cookie, aucun script tiers, aucune ressource chargée depuis un autre domaine.
- CSP stricte sur toutes les pages : aucun script inline, aucun attribut `style=""`, aucun `onclick=""`.
- Les URL `/privacy.html`, `/cgu.html`, `/mentions-legales.html`, `/contact.html`, `/telechargement.html` ne doivent jamais changer.

## Aperçu local
Lancer un serveur statique dans ce dossier (par exemple `npx serve`), puis ouvrir l'adresse indiquée.
