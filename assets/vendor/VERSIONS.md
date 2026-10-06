# Bibliothèques tierces hébergées dans le repo

Aucune ressource n'est chargée depuis un serveur tiers : tout est servi depuis flashesport.gg.

| Fichier | Bibliothèque | Version | Source | Licence | SHA-256 |
|---|---|---|---|---|---|
| `three.module.min.js` | Three.js | 0.160.0 (r160) | paquet npm officiel `three@0.160.0`, `build/three.module.min.js` (version minifiée officielle, récupérée avec `npm pack three@0.160.0`) | MIT (`licenses/Three-MIT.txt`) | `3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6` (identique au paquet officiel) |
| `SVGLoader.js` | Three.js — SVGLoader | 0.160.0 (r160) | paquet npm officiel `three@0.160.0`, `examples/jsm/loaders/SVGLoader.js` | MIT (`licenses/Three-MIT.txt`) | `a5894ef057dbdf9feb0a04ab6482e8c26be0b4b9550b87981d95de2b8dd2bba3` (fichier modifié, voir ci-dessous) |

## Modification locale

`SVGLoader.js` : une seule ligne changée, l'import `from 'three'` devient `from './three.module.min.js'`
(chemin relatif, pour se passer d'import map et garder une CSP sans script inline).
Empreinte du fichier d'origine : `6ae9cdd2067dfd546568acf859c19b223e39c46cc03d27b1a419ca25c55722e3`.

## Polices (`assets/fonts/`)

| Fichier | Police | Licence |
|---|---|---|
| `anton-400.woff2` | Anton 400 | SIL OFL 1.1 (`LICENSE-Anton-OFL.txt`) |
| `exo2-400/500/600/700.woff2` | Exo 2 | SIL OFL 1.1 (`LICENSE-Exo2-OFL.txt`) |

## Mise à jour de Three.js

Le verre utilise une greffe de shader (`onBeforeCompile` dans `assets/js/app.js`) qui dépend du code
interne de Three.js r160. Toute montée de version impose de revérifier la dispersion du verre.

## Pourquoi la version minifiée

`three.module.min.js` est le même code que `three.module.js` (même paquet officiel ; l'empreinte de
`build/three.module.js` du paquet, `76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495`,
est identique au fichier fourni dans le template), en plus léger : 167 Ko compressés au lieu de 258 Ko.
