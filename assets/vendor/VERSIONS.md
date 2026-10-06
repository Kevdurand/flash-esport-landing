# Bibliothèques tierces hébergées dans le repo

Aucune ressource n'est chargée depuis un serveur tiers : tout est servi depuis flashesport.gg.

| Fichier | Bibliothèque | Version | Source | Licence | SHA-256 |
|---|---|---|---|---|---|
| `three.module.js` | Three.js | 0.160.0 (r160) | paquet npm officiel `three@0.160.0`, `build/three.module.js` | MIT (`licenses/Three-MIT.txt`) | `76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495` (identique au paquet officiel) |
| `SVGLoader.js` | Three.js — SVGLoader | 0.160.0 (r160) | paquet npm officiel `three@0.160.0`, `examples/jsm/loaders/SVGLoader.js` | MIT (`licenses/Three-MIT.txt`) | `8eac2c796e2c54c73fc7a63df63e89ad0a877453db6159597d4ca04b7ac831e7` (fichier modifié, voir ci-dessous) |

## Modification locale

`SVGLoader.js` : une seule ligne changée, l'import `from 'three'` devient `from './three.module.js'`
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
