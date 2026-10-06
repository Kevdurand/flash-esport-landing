# CONSIGNES PRIORITAIRES — Kévin + chef de projet (06/10, 08:35)

Ces consignes passent **avant** la suite du plan. Traite-les dans l'ordre 1 → 4, avec captures avant/après, commit et publication (§9 bis) après chacune. Ajoute ce fichier au `.gitignore` (`CONSIGNES.md`). Note dans `JOURNAL.md` une ligne par consigne terminée.

Kévin a vu la première version en ligne et en est content. Il veut maintenant un niveau de finition « studio » sur chaque détail.

---

## 1. Les boutons App Store / Google Play = badges OFFICIELS

Kévin veut des boutons identiques aux vrais badges d'Apple et de Google, pas des boutons maison.

- **Utilise les fichiers officiels**, téléchargés une fois et **hébergés dans le repo** (`assets/img/badges/`), jamais chargés depuis leurs serveurs à l'exécution :
  - Apple : badge **« Télécharger dans l'App Store »** en **français**, version **noire**, format **SVG**, depuis l'outil officiel Apple Marketing Tools (`tools.applemarketingtools.com`, badges « Download on the App Store », langue fr-fr) ou la page « App Store Marketing Guidelines » d'Apple.
  - Google : badge **« DISPONIBLE SUR Google Play »** en **français**, depuis la page officielle des badges Google Play (`play.google.com/intl/fr/badges/`). Prends la meilleure résolution disponible (SVG si possible, sinon PNG haute définition).
  - Note la source exacte et la date dans `assets/vendor/VERSIONS.md`.
- **Règles des marques** : ne modifie jamais le badge (pas de recoloration, pas de déformation, pas de texte ajouté dessus, pas de rognage). Les deux badges ont **la même hauteur visuelle** (Google a une marge transparente intégrée : compense-la pour que les deux paraissent identiques), espace libre autour, hauteur ≥ 40 px à l'écran, alignés proprement.
- **Avant la sortie** : badges affichés **non cliquables**, avec une mention **« Bientôt disponible »** placée **à côté ou au-dessus** (petite, Exo 2, discrète), jamais posée sur le badge. Pas de baisse d'opacité sur le badge lui-même.
- **Prêts pour samedi** : chaque badge garde `data-store-url`. Prépare (commentés, inactifs) :
  - App Store : `https://apps.apple.com/app/id6800447821`
  - Google Play : `https://play.google.com/store/apps/details?id=com.flashesport.mobile` (identifiant Android à confirmer par Kévin, noter `[À CONFIRMER]`).
  Activer un lien doit se faire en changeant **une seule valeur** (documente comment dans le journal).
- Effet au survol (ordinateur) : léger halo rouge **autour** du badge ou fine lame de lumière **sous** le badge, sans toucher au badge.
- Remplace **tous** les boutons stores du site (hero, bloc final, page téléchargement, partout où ils existent).

## 2. L'iPhone : qualité « photo produit »

Le téléphone actuel paraît **plat, standard et pixelisé**. Kévin veut un iPhone de grande qualité.

- **Captures en pleine définition** : déposées dans `assets/app/hd/` (1170 px de large, comme l'écran d'un vrai iPhone). Utilise-les avec `srcset` (900 px pour les petits écrans, 1170 px pour les écrans Retina), `decoding="async"`, dimensions déclarées. Vérifie qu'aucune mise à l'échelle CSS ne floute l'image (pas de `transform: scale` sur l'image, pas de flou, rendu net en Retina).
- **Cadre de téléphone entièrement vectoriel** (SVG + CSS, aucune image matricielle), au niveau des rendus produits Apple, **sans logo Apple** :
  - proportions réelles d'un iPhone récent (rapport ~ 19,5:9, coins arrondis continus, écran aux coins arrondis concentriques) ;
  - **cadre en titane sombre** : contour métallique fin avec dégradé (reflet clair en haut à gauche, plus sombre en bas), double liseré (arête extérieure + bord intérieur) ;
  - **bords noirs** fins et réguliers autour de l'écran ;
  - **Dynamic Island** (pilule noire en haut de l'écran) ;
  - **boutons latéraux** discrets (volume à gauche, bouton latéral à droite) ;
  - **reflet de verre** très subtil en diagonale sur l'écran ;
  - **ombre portée douce** et un léger halo rouge derrière, cohérent avec la lumière de la scène.
- En mode 3D, légère **inclinaison / parallaxe** du téléphone qui suit la souris (comme le panneau du chapitre 4), très douce ; aucune sur écran tactile.
- Transition entre les 4 écrans du tutoriel : fondu croisé net (les deux images ne doivent jamais apparaître floues ou décalées), sans saut de mise en page.
- Captures de contrôle obligatoires : téléphone en gros plan à **DPR 2 et DPR 3** (Playwright `deviceScaleFactor`), ordinateur et iPhone.

## 3. Référencement (SEO) : être 1er sur « Flash eSport »

Constat du chef de projet : le site n'apparaît pas encore sur Google pour « Flash eSport ». Une équipe eSport existante s'appelle « Flash eSports » (Team Flash, teamflash.gg) : il faut que Google comprenne sans ambiguïté que **Flash eSport = l'application française de résultats eSport** et que **flashesport.gg** est son site officiel.

À faire dans le code :
- **H1 de l'accueil** : il doit contenir la marque. Garde le visuel « TES ÉQUIPES. / SANS BRUIT. » et ajoute au début du H1 un texte visible ou une étiquette lisible par les robots : `<h1><span class="visuellement-cache">Flash eSport, l'app de résultats eSport : </span>…</h1>` (classe de masquage accessible standard, pas `display:none`). Mieux encore si le design le permet : surtitre visible `FLASH ESPORT · L'ESPORT EN DIRECT`.
- **Première phrase visible du hero** : commencer par « Flash eSport : … » (ex. « Flash eSport : scores en direct, résultats, calendrier et tournois de tes équipes eSport. »).
- **Title** de l'accueil : `Flash eSport — L'app des résultats eSport en direct` (≤ 60 caractères). Titles des autres pages au format `Page — Flash eSport`.
- **Données structurées JSON-LD** dans l'accueil (`<script type="application/ld+json">` : c'est un bloc de données, non exécuté, compatible avec la CSP actuelle ; vérifie quand même qu'aucune erreur CSP n'apparaît en console) :
  - `Organization` : name « Flash eSport », alternateName [« FlashEsport », « Flash eSport App », « flashesport.gg »], url, logo (PNG carré ≥ 112 px), email de contact, `sameAs` : Instagram `https://www.instagram.com/flashesport.gg/` et X `https://x.com/flashesportfr`.
  - `WebSite` : name « Flash eSport », url `https://flashesport.gg/`, inLanguage fr-FR.
  - `MobileApplication` : name « Flash eSport », operatingSystem « iOS, Android », applicationCategory « SportsApplication », offers prix 0 EUR, inLanguage fr. **Aucune note, aucun avis, aucun nombre de téléchargements** (rien d'inventé).
  - Valide la syntaxe JSON (aucune erreur) ; si possible teste avec l'outil de test des résultats enrichis de Google.
- **Le contenu doit être lisible par Google sans JavaScript** : tous les textes des 5 chapitres présents dans le HTML (c'est déjà le cas, à vérifier), noms des 6 jeux, mots-clés naturels : « résultats eSport », « scores en direct », « application eSport », « CS2 », « LoL », « VALORANT »… sans bourrage.
- `alt` descriptifs sur les captures (« Écran d'accueil de l'application Flash eSport : mes équipes, matchs à ne pas manquer… »).
- `sitemap.xml` à jour (toutes les pages publiques, `lastmod` du jour), `robots.txt` qui pointe vers le sitemap, `canonical` sur chaque page, `og:image` 1200×630 soignée, favicon + `apple-touch-icon`.
- Note au journal, section « À FAIRE PAR KÉVIN » (le code ne peut pas le faire) : Google Search Console (vérification du domaine par DNS chez Porkbun, envoi du sitemap, demande d'indexation), lien vers flashesport.gg dans les bios Instagram et X, et la fiche App Store qui pointera vers le site.

## 4. Qualité des transitions : zéro bug, tout carré, ultra fluide (exigence permanente de Kévin)

À partir de maintenant, **avant chaque publication**, fais ce contrôle complet (en plus du §9 bis) :
- **Vidéos de défilement** : enregistre avec Playwright (`recordVideo`) un défilement complet, lent puis rapide, de l'accueil en **1440×900** et **390×844** (Chromium et WebKit). Range-les dans `_rapport/videos/AAAAMMJJ-HHMM/`. Regarde-les image par image aux moments clés (éclatement, orbite autour du téléphone, recomposition, entrée du bloc final).
- **Captures fines** : tous les 2 % de défilement sur les zones de transition, pour repérer : saut de position ou de taille de l'éclair, éclat qui « téléporte », clignotement, texte qui apparaît avant/après son chapitre, texte recouvert par la 3D, chevauchement de deux textes, élément qui dépasse de l'écran, défilement horizontal parasite.
- **Fluidité** : mesure les images/s pendant le défilement (trace de performance ou compteur `requestAnimationFrame`) ; objectif 60 images/s sur ordinateur, ≥ 50 sur mobile en émulation ; repère les tâches longues (> 50 ms) et supprime-les.
- **Stabilité de mise en page** : CLS ≈ 0 (aucun décalage au chargement des polices et images).
- **Défilement rapide / retour arrière** : remonter vite, sauter au milieu via le menu, recharger la page au milieu du défilement : l'état 3D doit toujours être cohérent avec le chapitre affiché.
- **Redimensionnement et rotation** de l'écran : aucun état cassé.
- Corrige tout défaut trouvé avant de publier. Écris dans le journal la liste de ce qui a été contrôlé et corrigé.
