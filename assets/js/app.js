/* FLASH ESPORT — moteur 3D de l'accueil : l'éclair en verre rouge.
   Adapté du moteur « Premium 3D Glass » (verre à dispersion, découpage automatique en fragments,
   recomposition, scroll lissé) : verre rouge, 5 chapitres Flash eSport, éclats en orbite autour du
   téléphone, halo qui suit l'éclair, modes allégé et statique, compatibilité iPhone.
   Three.js r160 hébergé dans le repo (assets/vendor) : aucun appel réseau hors du site. */
import * as THREE from '../vendor/three.module.min.js';
import { SVGLoader } from '../vendor/SVGLoader.js';

// ---- Configuration -------------------------------------------------------------
// `shapes` : la silhouette de l'éclair du logo (un seul <path>, viewBox 0 0 1000 1000).
// `palette` : une couleur de fond par chapitre, du hero au final. Uniquement des rouges sur noir.
// `fragments` : 6 éclats, un par jeu couvert.
const SITE = {
    shapes: ['../shapes/eclair.svg'],
    palette: ['#3a0000', '#B00000', '#E01818', '#6e0000', '#B00000'],
    fragments: 6
};
const SINGLE_SHAPE = SITE.shapes.length === 1;
let openingSource = '', finalSource = '';

// ---- Chronologie du scroll (0 → 1 sur la scène, puis chapitre final dans le flux) ----
const T = {
    open: [0.07, 0.085],      // juste avant d'éclater : les biseaux se resserrent (miroir de la fin)
    burst: [0.085, 0.22],      // l'éclair éclate
    orbit: [0.30, 0.37, 0.61, 0.67],   // les éclats entrent en orbite autour du téléphone, puis en sortent
    join: [0.66, 0.79],       // les éclats reviennent à leur place
    bevel: [0.79, 0.81],      // prisme unique : les biseaux grandissent
    holes: [0.79, 0.85],
    // Fenêtres d'affichage des textes : contiguës. Il y a toujours le texte d'un chapitre à l'écran, et il
    // change exactement en même temps que le chapitre indiqué dans l'en-tête (mêmes seuils que `chapters`).
    slides: [[-0.10, 0.09], [0.09, 0.335], [0.335, 0.69], [0.69, 1.05]],
    tuto: [0.355, 0.675],     // les 4 étapes du tutoriel se partagent cette plage
    nav: [0, 0.23, 0.40, 0.90],
    chapters: [0.09, 0.335, 0.69]
};
// Position de l'éclair à l'écran par chapitre (fraction de la largeur / de la hauteur), puis au final.
const FRAME = {
    landscape: { fx: [0.72, 0.27, 0.675, 0.505], fy: [0.5, 0.5, 0.5, 0.5], final: [0.27, 0.5] },
    portrait: { fx: [0.5, 0.5, 0.5, 0.5], fy: [0.685, 0.30, 0.46, 0.505], final: [0.5, 0.25] }
};

// ---- Réglages ------------------------------------------------------------------
const LOGO_HEIGHT = 3.1;                              // hauteur de l'éclair, unités monde
const LOGO_DEPTH = 0.44;
const LOGO_BEVEL = { size: 0.042, thickness: 0.052 };
// Une seule forme : le prisme recomposé est identique à celui qui a éclaté, biseau compris.
const ICON_SIZE = SINGLE_SHAPE ? LOGO_HEIGHT : 2.9;
const ICON_DEPTH = SINGLE_SHAPE ? LOGO_DEPTH : 0.50;
const ICON_BEVEL = SINGLE_SHAPE ? LOGO_BEVEL : { size: 0.028, thickness: 0.038 };
const SEAM_BEVEL = 0.006;                             // biseau pendant que les éclats fusionnent
const MORPH_STEPS = 16;                               // pas de géométrie pendant la recomposition

const canvas = document.querySelector('#webgl');
let scene, camera, renderer, glass;
let modelPivot;
const logoPieces = [];
let wholeBody;     // l'éclair entier, tant qu'il est assemblé
let glassIcon;     // prisme final unique
let iconOutline = [];
let iconHoles = [];
const clock = new THREE.Clock();
let currentScroll = 0;
let currentContact = 0, targetContact = 0;   // 0..1 : progression dans le chapitre final
let finalOpen = false;                       // le bloc final est entré à l'écran : il prend le relais du chapitre 4
const stageElement = document.querySelector('.scroll-stage');
const contactSection = document.querySelector('#telecharger');
const contactCardElement = document.querySelector('.final-bloc');
let glassCard, cardGlass;
const CARD_DISTANCE = 6.0;
const CARD_RIM_PX = 16, CARD_RADIUS_PX = 22, CARD_DEPTH = 0.08, CARD_RIM_DEPTH = 0.06;

let mouseX = 0, mouseY = 0, targetMouseX = 0, targetMouseY = 0;
let cursorX = window.innerWidth / 2, cursorY = window.innerHeight / 2;
let outerCursorX = cursorX, outerCursorY = cursorY;

const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const tactile = !pointerFine;
const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const portraitQuery = window.matchMedia('(max-width: 900px), (max-aspect-ratio: 4/5)');
let tier = 5;                // palier de qualité, voir « Qualité de rendu »
let etat = { debug: false, lite: false };
let repli = () => {};
let running = false;

let bgMaterial, bgMesh;
const paletteUniforms = Object.fromEntries(SITE.palette.map((hex, index) =>
    [`uC${index}`, { value: new THREE.Color(hex) }]));
const shaderUniforms = {
    ...paletteUniforms,
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uVelocity: { value: 0 },
    uObject: { value: new THREE.Vector2(0, 0) },     // position de l'éclair à l'écran
    uGlow: { value: 0.0 },                            // intensité du halo derrière l'éclair
    uGlowSpread: { value: 1.0 }
};

// Lucioles rouges : nombre affiché selon le palier de qualité (indice = palier, 1 à 5).
let fireflies = null;
const FIREFLY_MAX = 400;
const FIREFLY_TIERS = [60, 60, 120, 220, 320, 400];
let fireflyDrift = 0, fireflyTick = 0;
const fireflyZoneA = new THREE.Vector4(3, 3, 3, 3), fireflyZoneB = new THREE.Vector4(3, 3, 3, 3);   // hors écran = aucune zone
const fireflyUniforms = {
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3(0, -0.3, 0) },
    uBurst: { value: 0 }, uGather: { value: 0 }, uAura: { value: 0 }, uDrift: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uScale: { value: 600 }, uOpacity: { value: 0 },
    uFocus: { value: 5 }, uBoost: { value: 1 },
    uTextA: { value: new THREE.Vector4(3, 3, 3, 3) }, uTextB: { value: new THREE.Vector4(3, 3, 3, 3) }
};
// Balancement de l'éclair : il suit la souris avec de l'inertie (ressort légèrement sous-amorti).
const sway = { x: 0, y: 0, vx: 0, vy: 0 };

const sizes = { width: window.innerWidth, height: window.innerHeight };

const V2 = (x = 0, y = 0) => new THREE.Vector2(x, y);
const cross2 = (a, b) => a.x * b.y - a.y * b.x;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// Lucioles rouges : de petites lumières en suspension dans toute la scène, comme dans un film fantastique.
// Tout le mouvement est calculé par la carte graphique (aucun calcul par luciole dans la boucle de rendu) :
//  - dérive lente sur des trajectoires douces, propres à chaque luciole (sommes de sinusoïdes déphasées, sans
//    période commune : jamais de boucle visible) ; chacune respire à son rythme ;
//  - profondeur : les proches sont plus grosses et un peu floues, les lointaines minuscules et nettes ;
//  - plus denses et plus lumineuses autour de l'éclair ; une gerbe s'échappe des cassures à l'éclatement ;
//    elles convergent vers l'éclair pendant la recomposition et l'entourent au chapitre final ;
//  - elles s'écartent du curseur, glissent légèrement avec le défilement, et s'effacent derrière les textes.
// Rouges de la charte, quelques cœurs orangés ; aucun bleu, aucun vert.
function createFireflies() {
    const count = FIREFLY_MAX;
    const home = new Float32Array(count * 3), seed = new Float32Array(count * 4), look = new Float32Array(count * 3);
    let state = 20261006;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    for (let i = 0; i < count; i++) {
        const burst = i % 7 === 3;                               // une luciole sur sept appartient à la gerbe de l'éclatement
        const theta = random() * Math.PI * 2, cosPhi = random() * 2 - 1, sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
        const dx = sinPhi * Math.cos(theta), dy = cosPhi, dz = sinPhi * Math.sin(theta);
        let x, y, z;
        if (burst) {
            const r = 0.2 + random() * 0.35;
            x = dx * r; y = -0.3 + dy * r * 1.4; z = dz * r;
        } else if (random() < 0.52) {                            // autour de l'éclair
            const r = 0.95 + Math.pow(random(), 1.5) * 2.3;
            x = dx * r; y = -0.3 + dy * r * 0.85; z = dz * r;
        } else {                                                 // dans tout l'espace de la scène
            x = (random() - 0.5) * 13; y = -0.3 + (random() - 0.5) * 7.4; z = (random() - 0.5) * 13;
        }
        home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = z;
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = random();
        look[i * 3] = 0.030 + Math.pow(random(), 3.0) * 0.085;   // taille (unités monde) : beaucoup de petites, quelques grosses
        look[i * 3 + 1] = random() < 0.2 ? 1 : 0;                // cœur plus chaud (orangé très léger)
        look[i * 3 + 2] = burst ? 1 : 0;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(home, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geometry.setAttribute('aLook', new THREE.BufferAttribute(look, 3));
    const material = new THREE.ShaderMaterial({
        uniforms: fireflyUniforms,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
            attribute vec4 aSeed;
            attribute vec3 aLook;
            uniform float uTime, uBurst, uGather, uAura, uDrift, uAspect, uScale, uOpacity, uFocus, uBoost;
            uniform vec3 uCenter;
            uniform vec2 uMouse;
            uniform vec4 uTextA, uTextB;
            varying float vAlpha;
            varying float vSoft;
            varying float vWarm;
            float inside(vec2 p, vec4 r) {
                vec2 d = max(r.xy - p, p - r.zw);
                return 1.0 - smoothstep(-0.03, 0.16, max(d.x, d.y));
            }
            void main() {
                float burst = aLook.z;
                float t = uTime * (0.5 + aSeed.x * 0.7);
                vec3 p = position;
                vec3 wander = vec3(
                    sin(t * 0.31 + p.y * 1.7 + aSeed.w * 6.283) + 0.6 * sin(t * 0.173 + p.z * 2.3 + aSeed.y * 6.283),
                    cos(t * 0.27 + p.z * 1.3 + aSeed.x * 6.283) + 0.6 * sin(t * 0.141 + p.x * 1.9 + aSeed.z * 6.283),
                    sin(t * 0.23 + p.x * 1.5 + aSeed.y * 6.283) + 0.6 * cos(t * 0.197 + p.y * 2.1 + aSeed.w * 6.283));
                vec3 q = p + wander * (0.22 + aSeed.y * 0.36);
                q.y += uDrift * (0.25 + aSeed.z * 0.6);
                vec3 away = q - uCenter;
                float dist = length(away);
                vec3 dir = away / max(dist, 0.001);
                float free = 1.0 - burst;
                // Recomposition : elles convergent vers l'éclair.
                q -= dir * uGather * min(dist * 0.55, 1.9) * (0.4 + aSeed.z * 0.6) * free;
                // Chapitre final : elles se rangent en aura autour de l'éclair.
                float ring = 1.25 + aSeed.y * 1.3;
                q = mix(q, uCenter + dir * ring, uAura * 0.62 * (1.0 - smoothstep(3.2, 5.6, dist)) * free);
                // Éclatement : la gerbe part du cœur de l'éclair, s'ouvre et retombe légèrement.
                vec3 own = normalize(position - vec3(0.0, -0.3, 0.0) + vec3(0.0001));
                vec3 spray = uCenter + own * (0.25 + uBurst * (1.1 + aSeed.x * 2.7)) + wander * 0.14 * uBurst
                    - vec3(0.0, 0.55 * uBurst * uBurst * aSeed.z, 0.0);
                q = mix(q, spray, burst);
                dist = length(q - uCenter);

                vec4 mv = modelViewMatrix * vec4(q, 1.0);
                vec4 clip = projectionMatrix * mv;
                vec2 ndc = clip.xy / max(clip.w, 0.001);
                // Elles s'écartent doucement autour du curseur.
                vec2 toMouse = ndc - uMouse;
                toMouse.x *= uAspect;
                float reach = length(toMouse);
                vec2 push = toMouse / max(reach, 0.001) * (1.0 - smoothstep(0.0, 0.4, reach)) * 0.09;
                push.x /= uAspect;
                clip.xy += push * clip.w;
                ndc += push;
                gl_Position = clip;

                float depth = max(-mv.z, 0.25);
                vSoft = 1.0 - smoothstep(0.34 * uFocus, 1.08 * uFocus, depth);       // plus proche que l'éclair : grosse et floue
                float size = aLook.x * uBoost * uScale / depth * (1.0 + vSoft * 1.5);
                gl_PointSize = clamp(size, 1.0, 84.0);

                float breath = smoothstep(-0.55, 0.9,
                    0.6 * sin(uTime * (0.6 + aSeed.y * 1.7) + aSeed.x * 37.0) + 0.6 * sin(uTime * (0.19 + aSeed.z * 0.43) + aSeed.w * 23.0));
                float near = 1.0 - smoothstep(0.8, 3.8, dist);
                float alpha = breath * (0.28 + 0.72 * near) * (1.0 - 0.5 * vSoft);
                alpha = mix(alpha, pow(max(sin(3.14159 * uBurst), 0.0), 0.8) * (0.55 + 0.6 * breath), burst);
                alpha *= 1.0 - 0.9 * max(inside(ndc, uTextA), inside(ndc, uTextB));
                alpha *= smoothstep(0.8, 2.2, size);            // les points trop petits s'effacent au lieu de scintiller
                vAlpha = alpha * uOpacity;
                vWarm = aLook.y;
            }`,
        fragmentShader: `
            varying float vAlpha;
            varying float vSoft;
            varying float vWarm;
            void main() {
                float r = length(gl_PointCoord * 2.0 - 1.0);
                if (r > 1.0 || vAlpha < 0.004) discard;
                float core = 1.0 - smoothstep(0.0, mix(0.24, 0.72, vSoft), r);
                float halo = pow(1.0 - r, 2.4);
                vec3 color = mix(vec3(0.69, 0.0, 0.0), vec3(0.878, 0.094, 0.094), core);                 // #B00000 → #E01818
                color = mix(color, vec3(1.0, 0.478, 0.322), core * core * (0.22 + 0.62 * vWarm));       // cœur chaud
                gl_FragColor = vec4(color, (core * 0.95 + halo * 0.4) * vAlpha);
            }`
    });
    fireflies = new THREE.Points(geometry, material);
    fireflies.frustumCulled = false;
    fireflies.renderOrder = 4;
    scene.add(fireflies);
}

// Zones de texte (en coordonnées d'écran normalisées) : les lucioles s'y effacent pour ne jamais gêner la lecture.
function measureFireflyZones(chapter) {
    const rect = (element, target) => {
        const box = element ? element.getBoundingClientRect() : null;
        if (!box || box.width < 2 || box.height < 2) { target.set(3, 3, 3, 3); return; }
        target.set(box.left / sizes.width * 2 - 1, 1 - box.bottom / sizes.height * 2, box.right / sizes.width * 2 - 1, 1 - box.top / sizes.height * 2);
    };
    rect(chapter >= 4 ? contactCardElement : slides[chapter] && slides[chapter].querySelector('.slide-corps'), fireflyZoneA);
    rect(chapter === 2 ? document.querySelector('.tuto-etape.est-active .tuto-texte') : null, fireflyZoneB);
}

// Studio d'environnement : de longues boîtes à lumière donnent des reflets nets.
// Panneaux blancs pour les arêtes, panneaux rouges pour la couleur du verre.
function createGlassEnvironment() {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color('#0a0606');
    const panels = [
        [2.8, 8, -4, 2, 3, '#f03226', 1.2],      // grande boîte : rouge clair, pour que les faces ne blanchissent pas
        [0.45, 7, 3, 1, 2, '#ff5c4a', 2.6],      // bandes fines blanches : elles dessinent les arêtes
        [5, 0.7, 0, 5, -1, '#ff5846', 2.2],
        [0.5, 6, -2, 0, -4, '#e01818', 3.4],
        [1.0, 5, 3, -1, -3, '#ff4a3a', 2.6],
        [4, 0.35, 0, -3, 3, '#ff2020', 3.0],
        [0.16, 5, -3, 0, 2, '#ff4e3e', 3.0],
        [0.35, 4, 4, 0, -2, '#ff5a3c', 2.0]
    ];
    for (const [w, h, x, y, z, color, intensity] of panels) {
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(color).multiplyScalar(intensity),
                side: THREE.DoubleSide
            })
        );
        panel.position.set(x, y, z);
        panel.lookAt(0, 0, 0);
        studio.add(panel);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.025, 0.1, 100);
    scene.environment = environment.texture;
    studio.traverse(object => {
        if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
        }
    });
    pmrem.dispose();
}

// Verre rouge profond, arêtes blanches et rouges lumineuses.
function createGlassMaterial() {
    const material = new THREE.MeshPhysicalMaterial({
        color: '#ffd6d6',
        metalness: 0.0,
        roughness: 0.025,
        transmission: 1.0,
        thickness: 0.48,
        ior: 1.46,
        attenuationColor: new THREE.Color('#d01010'),
        attenuationDistance: 0.9,
        clearcoat: 0.6,           // le vernis ne renvoie presque rien de face et beaucoup en rasant : il dessine les arêtes blanches
        clearcoatRoughness: 0.018,
        // Reflets de face teintés en rouge, arêtes rasantes blanches : le verre reste rouge profond
        // au lieu de blanchir quand une grande face renvoie une boîte à lumière.
        specularColor: new THREE.Color('#ffc9c0'),
        specularIntensity: 0.85,
        iridescence: 0.12,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [100, 420],
        envMapIntensity: 1.0,
        side: THREE.DoubleSide
    });
    material.userData.dispersion = true;
    // Three.js r160 n'a pas de paramètre de dispersion : la lumière transmise est échantillonnée
    // avec trois indices de réfraction légèrement différents. En mode allégé (ou si la greffe ne
    // s'applique pas), le verre garde la transmission standard, sans dispersion.
    material.onBeforeCompile = shader => {
        if (!material.userData.dispersion) return;
        const pattern = /vec4 transmitted = getIBLVolumeRefraction\([\s\S]*?\);/;
        const chunk = THREE.ShaderChunk.transmission_fragment;
        if (!pattern.test(chunk) || !shader.fragmentShader.includes('#include <transmission_fragment>')) return;
        shader.uniforms.uChromaticSpread = { value: 0.018 };
        shader.fragmentShader = 'uniform float uChromaticSpread;\n' + shader.fragmentShader;
        const transmission = chunk.replace(pattern,
            `// Faces avant nettes, accents spectraux sur les arêtes rasantes.
            float chromaticSpread = uChromaticSpread * mix(0.35, 1.0,
                smoothstep(0.15, 0.85, 1.0 - abs(dot(n, v))));
            vec4 transmitted = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            vec4 transmittedRed = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior - chromaticSpread, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            vec4 transmittedBlue = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior + chromaticSpread, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            transmitted = vec4(transmittedRed.r, transmitted.g, transmittedBlue.b,
                (transmittedRed.a + transmitted.a + transmittedBlue.a) / 3.0);`
        );
        shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', transmission);
    };
    material.customProgramCacheKey = () => `flash-verre-rouge-${material.userData.dispersion ? 'dispersion' : 'simple'}`;
    return material;
}

// ---- 2D contour helpers ------------------------------------------------------

// Remove near-duplicate and collinear vertices, force counter-clockwise order.
function cleanContour(points, epsilon = 1e-4) {
    const contour = [];
    for (const p of points) {
        if (!contour.length || contour[contour.length - 1].distanceTo(p) > epsilon) contour.push(p.clone());
    }
    while (contour.length > 1 && contour[0].distanceTo(contour[contour.length - 1]) <= epsilon) contour.pop();
    const result = contour.filter((p, i) => {
        const prev = contour[(i - 1 + contour.length) % contour.length];
        const next = contour[(i + 1) % contour.length];
        return Math.abs(cross2(p.clone().sub(prev), next.clone().sub(p))) > 1e-7;
    });
    if (THREE.ShapeUtils.isClockWise(result)) result.reverse();
    return result;
}

// Sutherland-Hodgman clipping against a convex set of half-planes.
function clipContour(points, halfPlanes) {
    let polygon = points.map(p => p.clone());
    for (const { origin, normal } of halfPlanes) {
        const clipped = [];
        for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const dp = p.clone().sub(origin).dot(normal), dq = q.clone().sub(origin).dot(normal);
            if (dp >= 0) clipped.push(p);
            if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
        }
        polygon = clipped;
        if (!polygon.length) break;
    }
    return cleanContour(polygon);
}

// Convex sector between two rays (counter-clockwise, less than 180 degrees apart).
function wedgeHalfPlanes(center, startDeg, endDeg) {
    const dir = deg => V2(Math.cos(THREE.MathUtils.degToRad(deg)), Math.sin(THREE.MathUtils.degToRad(deg)));
    const a = dir(startDeg), b = dir(endDeg);
    return [{ origin: center, normal: V2(-a.y, a.x) }, { origin: center, normal: V2(b.y, -b.x) }];
}

// Local contour around the bounding-box centre, plus that centre as a home position.
function recentre(points) {
    const centre = new THREE.Box2().setFromPoints(points).getCenter(V2());
    return {
        contour: points.map(p => p.clone().sub(centre)),
        home: new THREE.Vector3(centre.x, centre.y, 0)
    };
}

// Final shape: outline plus its holes, each scaled by holeScale (0 = not punched yet).
function makeIconPrism(bevelSize, bevelThickness, holeScale) {
    const shape = new THREE.Shape(iconOutline);
    if (holeScale > 0.02) {
        for (const hole of iconHoles) {
            const centre = new THREE.Box2().setFromPoints(hole).getCenter(V2());
            shape.holes.push(new THREE.Path(hole.map(p =>
                p.clone().sub(centre).multiplyScalar(holeScale).add(centre))));
        }
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: ICON_DEPTH, steps: 1, bevelEnabled: true, bevelSize, bevelThickness,
        bevelSegments: bevelSize < 0.016 ? 1 : 6, curveSegments: 24
    });
    geometry.translate(0, 0, -ICON_DEPTH / 2);
    return geometry;
}


function makePrism(points, depth, bevelSize, bevelThickness) {
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
        depth, steps: 1, bevelEnabled: true, bevelSize, bevelThickness,
        bevelSegments: bevelSize < 0.016 ? 1 : 6, curveSegments: 24
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
}

// ---- Morph correspondence ----------------------------------------------------

// Radial matching around each polygon's visibility kernel: fold-free morphs
// for star-shaped fragments. Throws when a kernel does not exist.
function matchRadially(source, target) {
    const prepare = points => {
        const contour = points.filter((p, i) => i === 0 || p.distanceToSquared(points[i - 1]) > 1e-12);
        if (contour[0].distanceToSquared(contour[contour.length - 1]) < 1e-12) contour.pop();
        if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
        let kernel = [V2(-10, -10), V2(10, -10), V2(10, 10), V2(-10, 10)];
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i], edge = contour[(i + 1) % contour.length].clone().sub(a);
            const clipped = [];
            for (let j = 0; j < kernel.length; j++) {
                const p = kernel[j], q = kernel[(j + 1) % kernel.length];
                const dp = cross2(edge, p.clone().sub(a)), dq = cross2(edge, q.clone().sub(a));
                if (dp >= -1e-10) clipped.push(p);
                if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
            }
            kernel = clipped;
        }
        if (!kernel.length) throw new Error('Contour has no visibility kernel.');
        const center = kernel.reduce((sum, p) => sum.add(p), V2()).multiplyScalar(1 / kernel.length);
        return { contour, center };
    };
    const a = prepare(source), b = prepare(target);
    const angle = (p, center) => (Math.atan2(p.y - center.y, p.x - center.x) + Math.PI * 2) % (Math.PI * 2);
    const angles = [...a.contour.map(p => angle(p, a.center)), ...b.contour.map(p => angle(p, b.center)),
        ...Array.from({ length: 32 }, (_, i) => i / 32 * Math.PI * 2)].sort((x, y) => x - y)
        .filter((value, i, values) => i === 0 || value - values[i - 1] > 1e-8);
    const sample = ({ contour, center }, angle) => {
        const direction = V2(Math.cos(angle), Math.sin(angle));
        let distance = Infinity;
        for (let i = 0; i < contour.length; i++) {
            const p = contour[i], edge = contour[(i + 1) % contour.length].clone().sub(p);
            const denominator = cross2(direction, edge);
            if (Math.abs(denominator) < 1e-12) continue;
            const relative = p.clone().sub(center);
            const t = cross2(relative, edge) / denominator;
            const u = cross2(relative, direction) / denominator;
            if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) distance = Math.min(distance, t);
        }
        if (!isFinite(distance)) throw new Error('Ray missed the contour.');
        return center.clone().addScaledVector(direction, distance);
    };
    return angles.map(angle => ({ source: sample(a, angle), target: sample(b, angle) }));
}

// Fallback for arbitrary polygons: equal arc-length resampling with the best
// rotational alignment. Works for any simple contour, may fold on wild shapes.
function matchByArcLength(source, target, samples = 160) {
    const resample = points => {
        const lengths = [0];
        for (let i = 0; i < points.length; i++) {
            lengths.push(lengths[i] + points[i].distanceTo(points[(i + 1) % points.length]));
        }
        const total = lengths[points.length];
        const out = [];
        let segment = 0;
        for (let i = 0; i < samples; i++) {
            const d = i / samples * total;
            while (segment < points.length - 1 && lengths[segment + 1] < d) segment++;
            const p = points[segment], q = points[(segment + 1) % points.length];
            const span = lengths[segment + 1] - lengths[segment];
            out.push(p.clone().lerp(q, span > 0 ? (d - lengths[segment]) / span : 0));
        }
        return out;
    };
    const a = resample(source), b = resample(target);
    let best = 0, bestCost = Infinity;
    for (let k = 0; k < samples; k++) {
        let cost = 0;
        for (let i = 0; i < samples; i++) cost += a[i].distanceToSquared(b[(i + k) % samples]);
        if (cost < bestCost) { bestCost = cost; best = k; }
    }
    return a.map((p, i) => ({ source: p, target: b[(i + best) % samples] }));
}

function matchMorphContours(source, target, name) {
    try {
        return matchRadially(source, target);
    } catch (error) {
        console.warn(`[glass] radial morph unavailable for "${name}" (${error.message}); using arc-length matching.`);
        return matchByArcLength(source, target);
    }
}

// ---- Reading a shape ---------------------------------------------------------
// Any SVG works. The largest contour is the outline; contours inside it are holes;
// anything else is a separate solid (the leaf of an apple, the dot of an i).
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y)
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

function parseShape(svgText) {
    const svg = new SVGLoader().parse(svgText);
    const contours = svg.paths
        .flatMap(path => path.subPaths.map(sub => cleanContour(sub.getPoints(6).map(p => V2(p.x, -p.y)))))
        .filter(contour => contour.length >= 3 && Math.abs(THREE.ShapeUtils.area(contour)) > 1e-9)
        .sort((a, b) => Math.abs(THREE.ShapeUtils.area(b)) - Math.abs(THREE.ShapeUtils.area(a)));
    if (!contours.length) throw new Error('This SVG has no closed contour.');
    const [outline, ...rest] = contours;
    const holes = [], extras = [];
    for (const contour of rest) {
        const centre = new THREE.Box2().setFromPoints(contour).getCenter(V2());
        (pointInPolygon(centre, outline) ? holes : extras).push(contour);
    }
    return { outline, holes, extras };
}

// Centre a shape on the origin and scale it to `height` world units.
function fitShape(shape, height) {
    const bounds = new THREE.Box2().setFromPoints(
        [shape.outline, ...shape.holes, ...shape.extras].flat());
    const centre = bounds.getCenter(V2());
    const size = bounds.getSize(V2());
    const scale = height / Math.max(size.x, size.y);
    const fit = contour => contour.map(p => p.clone().sub(centre).multiplyScalar(scale));
    return { outline: fit(shape.outline), holes: shape.holes.map(fit), extras: shape.extras.map(fit) };
}

// Visibility kernel of a polygon: from any point of it the whole contour is visible.
// A non-empty kernel is what makes the radial morph fold-free.
function visibilityKernel(points) {
    const contour = points.slice();
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const span = new THREE.Box2().setFromPoints(contour).getSize(V2()).length() * 2 + 1;
    let kernel = [V2(-span, -span), V2(span, -span), V2(span, span), V2(-span, span)];
    for (let i = 0; i < contour.length; i++) {
        const a = contour[i];
        const edge = contour[(i + 1) % contour.length].clone().sub(a);
        const clipped = [];
        for (let j = 0; j < kernel.length; j++) {
            const p = kernel[j], q = kernel[(j + 1) % kernel.length];
            const dp = cross2(edge, p.clone().sub(a)), dq = cross2(edge, q.clone().sub(a));
            if (dp >= -1e-10) clipped.push(p);
            if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
        }
        kernel = clipped;
        if (!kernel.length) return [];
    }
    return kernel;
}

// Cut a contour into `count` radial fragments. The start angle is chosen by scanning:
// the winner is the split whose worst fragment has the largest visibility kernel, so
// the morph stays fold-free on shapes this code has never seen.
function partitionContour(outline, count) {
    if (count <= 1) return [outline];
    const centre = new THREE.Box2().setFromPoints(outline).getCenter(V2());
    const step = 360 / count;
    let best = null;
    for (let offset = 0; offset < step - 0.001; offset += 5) {
        const pieces = [];
        let worst = Infinity;
        for (let i = 0; i < count; i++) {
            const piece = clipContour(outline,
                wedgeHalfPlanes(centre, offset + i * step, offset + (i + 1) * step));
            if (piece.length < 3) { worst = -1; break; }
            const kernel = visibilityKernel(piece);
            const ratio = kernel.length
                ? Math.abs(THREE.ShapeUtils.area(kernel)) / Math.abs(THREE.ShapeUtils.area(piece)) : 0;
            worst = Math.min(worst, ratio);
            pieces.push(piece);
        }
        if (worst >= 0 && (!best || worst > best.worst)) best = { worst, pieces };
    }
    if (!best) throw new Error(`Could not split this shape into ${count} fragments.`);
    if (best.worst === 0) {
        console.warn('[glass] a fragment has no visibility kernel; using arc-length morphing there.');
    }
    return best.pieces;
}

// Fragments of a fitted shape: radial wedges of the outline plus any separate solids,
// ordered by angle so both shapes are matched fragment to fragment along short paths.
function shapeFragments(fit, count) {
    const wedges = Math.max(1, count - fit.extras.length);
    // Separate solids are tagged: they stay visible while the outline is assembled.
    const extras = fit.extras.map(contour => Object.assign(contour.slice(), { isExtra: true }));
    const pieces = [...partitionContour(fit.outline, wedges), ...extras].slice(0, Math.max(1, count));
    const angle = contour => {
        const c = new THREE.Box2().setFromPoints(contour).getCenter(V2());
        return (Math.atan2(c.y, c.x) + Math.PI * 2) % (Math.PI * 2);
    };
    return pieces.sort((a, b) => angle(a) - angle(b));
}

// ---- Construction de l'éclair en verre -----------------------------------------
function createGlassLogo() {
    modelPivot = new THREE.Group();
    modelPivot.position.y = -0.3;
    scene.add(modelPivot);

    glass = createGlassMaterial();
    const logo = new THREE.Group();
    logo.rotation.set(-0.08, 0.28, -0.08);
    modelPivot.add(logo);

    const opening = fitShape(parseShape(openingSource), LOGO_HEIGHT);
    const final = fitShape(parseShape(finalSource), ICON_SIZE);
    iconOutline = final.outline;
    iconHoles = final.holes;

    // Éclair assemblé : un seul prisme étanche, exact avant l'éclatement.
    const whole = recentre(opening.outline);
    const wholeShape = new THREE.Shape(whole.contour);
    const wholeOffset = V2(whole.home.x, whole.home.y);
    for (const hole of opening.holes) {
        wholeShape.holes.push(new THREE.Path(hole.map(p => p.clone().sub(wholeOffset))));
    }
    const wholeGeometry = new THREE.ExtrudeGeometry(wholeShape, {
        depth: LOGO_DEPTH, steps: 1, bevelEnabled: true,
        bevelSize: LOGO_BEVEL.size, bevelThickness: LOGO_BEVEL.thickness,
        bevelSegments: 6, curveSegments: 24
    });
    wholeGeometry.translate(0, 0, -LOGO_DEPTH / 2);
    wholeBody = new THREE.Mesh(wholeGeometry, glass);
    wholeBody.position.copy(whole.home);
    logo.add(wholeBody);

    // Prisme final : les biseaux grandissent une fois les éclats fusionnés.
    glassIcon = new THREE.Mesh(makeIconPrism(SEAM_BEVEL, SEAM_BEVEL, 0), glass);
    glassIcon.userData.progress = -1;
    glassIcon.visible = false;
    logo.add(glassIcon);

    const sources = shapeFragments(opening, SITE.fragments);
    const targets = shapeFragments(final, sources.length);
    const count = sources.length;
    sources.forEach((sourceContour, index) => {
        const isExtra = !!sourceContour.isExtra;
        const source = recentre(sourceContour);
        const target = recentre(targets[Math.min(index, targets.length - 1)]);
        const geometry = makePrism(source.contour, LOGO_DEPTH, LOGO_BEVEL.size, LOGO_BEVEL.thickness);
        const mesh = new THREE.Mesh(geometry, glass);
        mesh.position.copy(source.home);
        logo.add(mesh);
        const radial = V2(source.home.x, source.home.y);
        if (radial.lengthSq() < 1e-6) radial.set(Math.cos(index), Math.sin(index));
        const offset = new THREE.Vector3(radial.x, radial.y, 0).normalize().multiplyScalar(1.15);
        offset.z = (index % 2 === 0 ? 1 : -1) * 0.55;
        const side = Math.sign(offset.x) || 1, vertical = Math.sign(offset.y) || 1;
        // Orbite autour du téléphone (chapitre 3) : un anneau incliné, les éclats alternés en hauteur.
        const order = (index * 2) % count + (index * 2 >= count && count % 2 === 0 ? 1 : 0);
        logoPieces.push({
            name: `fragment-${index}`, mesh, home: source.home, offset,
            twist: new THREE.Vector3(vertical * 0.12, side * 0.18, -side * vertical * 0.09),
            orbitAngle: index / count * Math.PI * 2,
            orbitHeight: (order / Math.max(1, count - 1) - 0.5),
            phase: index * 1.7 + 0.4,
            targetHome: target.home,
            correspondence: matchMorphContours(source.contour, target.contour, `fragment-${index}`),
            originalGeometry: geometry, morphGeometry: null, isBody: !isExtra,
            finalGeometry: isExtra ? makePrism(target.contour, ICON_DEPTH, ICON_BEVEL.size, ICON_BEVEL.thickness) : null,
            targetContour: isExtra ? target.contour : null, extraBevel: -1
        });
    });
}

// ---- Liquid glass card: a transmissive slab pinned to the DOM card ----------
// The slab lives in camera space at a fixed distance, so CSS pixels map linearly
// to world units. Its refraction, blur and rim lensing are real: the background
// shader is bent through the bevelled edge, like Apple's Liquid Glass.
function roundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x + w, y + h - r);
    shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x + r, y + h);
    shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return shape;
}

function cardUnitsPerPixel() {
    return 2 * CARD_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / sizes.height;
}

function buildGlassCardGeometry(w, h, unitsPerPixel) {
    const rim = CARD_RIM_PX * unitsPerPixel;                  // refractive rim width
    const radius = Math.max(rim + 0.002, CARD_RADIUS_PX * unitsPerPixel);
    const shape = roundedRectShape(w - 2 * rim, h - 2 * rim, radius - rim);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: CARD_DEPTH, steps: 1, bevelEnabled: true, bevelSize: rim, bevelThickness: CARD_RIM_DEPTH,
        bevelSegments: 10, curveSegments: 18
    });
    geometry.translate(0, 0, -(CARD_DEPTH + CARD_RIM_DEPTH));   // front face at local z = 0
    return geometry;
}

// Dalle de verre fumé calée derrière le bloc final (boutons des stores, réseaux).
function createGlassCard() {
    if (!contactCardElement) return;
    cardGlass = createGlassMaterial();
    cardGlass.side = THREE.FrontSide;
    cardGlass.color.set('#b9a8a8');
    cardGlass.roughness = 0.36;
    cardGlass.thickness = 0.35;
    cardGlass.attenuationColor.set('#2a0808');
    cardGlass.attenuationDistance = 1.6;
    cardGlass.clearcoat = 1.0;
    cardGlass.clearcoatRoughness = 0.14;
    cardGlass.iridescence = 0.06;
    cardGlass.envMapIntensity = 0.5;
    glassCard = new THREE.Mesh(buildGlassCardGeometry(1, 1, 1), cardGlass);
    glassCard.userData = { w: 0, h: 0 };
    glassCard.visible = false;
    camera.add(glassCard);
}

// La dalle suit le rectangle réel du bloc (reconstruite seulement si sa taille change).
function updateGlassCard() {
    if (!glassCard || !contactCardElement) return;
    glassCard.visible = slabEnabled && targetContact > 0.001;
    if (!glassCard.visible) return;
    const rect = contactCardElement.getBoundingClientRect();
    const upp = cardUnitsPerPixel();
    const w = rect.width * upp, h = rect.height * upp;
    if (Math.abs(glassCard.userData.w - w) > 0.003 || Math.abs(glassCard.userData.h - h) > 0.003) {
        glassCard.geometry.dispose();
        glassCard.geometry = buildGlassCardGeometry(w, h, upp);
        glassCard.userData = { w, h };
    }
    const cx = rect.left + rect.width / 2 - sizes.width / 2;
    const cy = sizes.height / 2 - (rect.top + rect.height / 2);
    glassCard.position.set(cx * upp, cy * upp, -CARD_DISTANCE);
    glassCard.rotation.set(-mouseY * 0.02, mouseX * 0.025, 0);
}

// ---- Scroll et chronologie -----------------------------------------------------
const layout = { portrait: portraitQuery.matches };

function stageMaxScroll() {
    const height = stageElement ? stageElement.offsetHeight : document.documentElement.scrollHeight;
    return Math.max(1, height - window.innerHeight);
}

function smoothScrollRange(scroll, start, end) {
    const t = clamp((scroll - start) / (end - start), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function getLogoSeparation(scroll) {
    return smoothScrollRange(scroll, T.burst[0], T.burst[1]) * (1 - smoothScrollRange(scroll, T.join[0], T.join[1]));
}

function getOrbit(scroll) {
    return smoothScrollRange(scroll, T.orbit[0], T.orbit[1]) * (1 - smoothScrollRange(scroll, T.orbit[2], T.orbit[3]));
}

// Poids de chaque chapitre (leur somme vaut 1) : sert au cadrage.
function chapterWeights(scroll) {
    // Chaque changement de cadrage est centré sur le seuil du chapitre : l'éclair croise la colonne de
    // texte au moment où l'ancien texte s'efface et avant que le nouveau n'apparaisse.
    const a = layout.portrait ? smoothScrollRange(scroll, 0.08, 0.12) : smoothScrollRange(scroll, 0.075, 0.105);
    const b = smoothScrollRange(scroll, 0.30, 0.37);
    const c = smoothScrollRange(scroll, 0.62, 0.72);
    return [1 - a, a - b, b - c, c];
}

// Cadrage. La caméra orbite autour de l'éclair ; elle vise un point décalé pour placer l'éclair
// à une fraction donnée de l'écran : à côté du texte sur ordinateur, au-dessus ou en dessous
// sur téléphone (même alternance que la mise en page empilée du CSS).
// Composition empilée (téléphone) : l'éclair se loge dans la zone laissée libre par le texte de chaque
// chapitre, mesurée dans la page. Il reste entier à l'écran quelle que soit la taille du téléphone,
// barre d'adresse de Safari visible ou non. Valeurs lissées : aucun saut quand la barre se replie.
const OBJECT_HEIGHT = 3.3, CLOUD_HEIGHT = 5.5;      // éclair assemblé / nuage d'éclats, unités monde
const zones = { ready: false, fy: [0.7, 0.3, 0.46, 0.5, 0.25], radius: [9, 11, 10.6, 10, 10], targetFy: [], targetRadius: [] };
function measureZones() {
    if (!layout.portrait) { zones.ready = false; return; }
    const height = sizes.height, visible = Math.min(window.innerHeight, height);
    const box = selector => { const element = document.querySelector(selector); return element ? element.getBoundingClientRect() : null; };
    const header = box('.entete'), hero = box('#accueil .slide-corps'), games = box('#jeux .slide-corps');
    const phone = box('.telephone'), live = box('#direct .slide-corps'), panel = box('.panneau');
    if (!header || !hero || !games || !phone || !live || !panel) return;
    const mediaReady = phone.height > 10 && panel.height > 10;   // téléphone et panneau pas encore affichés : valeurs par défaut
    const finalTop = contactSection ? parseFloat(getComputedStyle(contactSection).paddingTop) || visible * 0.42 : visible * 0.42;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // [haut, bas] de la zone libre en px, hauteur de l'objet en unités monde, rayon mini / maxi
    const list = [
        [hero.bottom + 14, visible - 24, OBJECT_HEIGHT, 7.4, 15],
        [header.bottom + 10, games.top - 12, CLOUD_HEIGHT, 9.5, 16],
        [phone.top, phone.bottom, 0, 10.6, 10.6],
        [live.bottom + 4, panel.top + 34, OBJECT_HEIGHT, 8.6, 16],
        [header.bottom + 14, finalTop - 4, OBJECT_HEIGHT, 8.6, 16]
    ];
    list.forEach(([top, bottom, objectHeight, minRadius, maxRadius], index) => {
        if (!mediaReady && (index === 2 || index === 3)) {
            zones.targetFy[index] = zones.fy[index];
            zones.targetRadius[index] = zones.radius[index];
            return;
        }
        const span = Math.max(60, bottom - top);
        zones.targetFy[index] = ((top + bottom) / 2 - span * 0.035) / height;   // la perspective grossit le bas de l'objet
        zones.targetRadius[index] = clamp(objectHeight * height / (span * 0.9 * 2 * tanHalf), minRadius, maxRadius);   // 10 % de marge (perspective)
        if (!zones.ready) { zones.fy[index] = zones.targetFy[index]; zones.radius[index] = zones.targetRadius[index]; }
    });
    zones.ready = true;
}
function smoothZones(amount) {
    if (!zones.ready) return;
    for (let i = 0; i < zones.fy.length; i++) {
        zones.fy[i] += (zones.targetFy[i] - zones.fy[i]) * amount;
        zones.radius[i] += (zones.targetRadius[i] - zones.radius[i]) * amount;
    }
}

// Angle de la caméra autour de l'éclair : un tour complet sur tout le défilement. Le tour s'accélère
// pendant la recomposition (62 → 80 %) pour que l'éclair reformé ne soit jamais vu de profil : la vue
// de côté tombe pendant que les éclats sont encore en mouvement.
function orbitAngle(scroll) {
    // L'avance atteint 0,2 tour à 78 % : l'éclair reformé est alors vu presque de face (à moins de 8°),
    // l'angle où le verre est rouge profond et non pâle. Elle se résorbe ensuite linéairement jusqu'à la
    // fin : la rotation reste toujours dans le même sens.
    const lead = 0.20 * (scroll <= 0.78 ? smoothScrollRange(scroll, 0.56, 0.78) : 1 - (scroll - 0.78) / 0.22);
    return (scroll + lead) * Math.PI * 2.0;
}

let debugFrame = null;   // cadrage imposé par les crochets de test (image fixe, image de partage)
function cameraFrame(scroll, contact = 0) {
    const portrait = layout.portrait;
    const separation = getLogoSeparation(scroll);
    const join = smoothScrollRange(scroll, T.join[0], T.join[1]);
    const final = smoothScrollRange(contact, 0, 0.85);
    let radius = portrait
        ? 9.1 - Math.sin(scroll * Math.PI) * 0.4 + separation * 1.8 + join * 1.2
        : 4.7 - Math.sin(scroll * Math.PI) * 0.6 + separation * 2.6 + join * 0.9 + final * 0.1;
    const weights = chapterWeights(scroll);
    const frame = portrait ? FRAME.portrait : FRAME.landscape;
    let fx = 0, fy = 0;
    for (let i = 0; i < 4; i++) { fx += weights[i] * frame.fx[i]; fy += weights[i] * frame.fy[i]; }
    fx = lerp(fx, frame.final[0], final);
    fy = lerp(fy, frame.final[1], final);
    // Entre deux chapitres l'éclair ne glisse pas en ligne droite : il décrit un arc, tantôt par le haut, tantôt par le bas.
    if (!portrait) fy += (weights[0] * weights[1] - weights[1] * weights[2] + weights[2] * weights[3]) * 4 * 0.05 * (1 - final);
    if (portrait && zones.ready) {
        fy = 0; radius = 0;
        for (let i = 0; i < 4; i++) { fy += weights[i] * zones.fy[i]; radius += weights[i] * zones.radius[i]; }
        fy = lerp(fy, zones.fy[4], final);
        radius = lerp(radius, zones.radius[4], final);
        // Pendant la recomposition, la caméra recule : le nuage d'éclats tient dans la zone libre
        // (il ne passe pas sur le texte), puis elle se rapproche à mesure que l'éclair se reforme.
        radius *= 1 + 0.6 * separation * weights[3];
    }
    if (debugFrame) { fx = debugFrame.fx; fy = debugFrame.fy; radius = debugFrame.radius || radius; }
    const visibleHeight = 2 * radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visibleWidth = visibleHeight * sizes.width / sizes.height;
    const phi = orbitAngle(scroll);
    const right = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
    const lookAt = new THREE.Vector3(0, -0.25 + (fy - 0.5) * visibleHeight, 0)
        .addScaledVector(right, -(fx - 0.5) * visibleWidth);
    return { radius, lookAt, fx, fy };
}

function cachedGeometry(owner, key, build) {
    const cache = owner.geometryCache || (owner.geometryCache = new Map());
    let geometry = cache.get(key);
    if (geometry) cache.delete(key);
    else geometry = build();
    cache.set(key, geometry);
    if (cache.size > 24) {
        const oldest = cache.keys().next().value;
        cache.get(oldest).dispose();
        cache.delete(oldest);
    }
    return geometry;
}
const geometryStep = value => Math.round(value * MORPH_STEPS) / MORPH_STEPS;

function morphGeometry(piece, geometryMorph) {
    return cachedGeometry(piece, `morph:${geometryMorph}`, () => {
        const contour = piece.correspondence.map(({ source, target }) => source.clone().lerp(target, geometryMorph));
        return makePrism(contour, lerp(LOGO_DEPTH, ICON_DEPTH, geometryMorph),
            lerp(LOGO_BEVEL.size, SEAM_BEVEL, geometryMorph),
            lerp(LOGO_BEVEL.thickness, SEAM_BEVEL, geometryMorph));
    });
}

// Prépare, pendant les temps morts, les géométries de la recomposition : aucun à-coup au scroll.
function prewarmMorph() {
    const jobs = [];
    for (const piece of logoPieces) {
        if (!piece.isBody) continue;
        for (let step = 1; step <= MORPH_STEPS; step++) jobs.push([piece, step / MORPH_STEPS]);
    }
    const idle = window.requestIdleCallback || (callback => setTimeout(() => callback({ timeRemaining: () => 8 }), 60));
    const run = deadline => {
        while (jobs.length && deadline.timeRemaining() > 3) {
            const [piece, value] = jobs.shift();
            morphGeometry(piece, value);
        }
        if (jobs.length && running) idle(run);
    };
    idle(run);
}

const _position = new THREE.Vector3();
const _orbit = new THREE.Vector3();

function updateLogoPieces(scroll, time) {
    const separation = getLogoSeparation(scroll);
    const morph = smoothScrollRange(scroll, T.join[0], T.join[1]);
    const orbit = getOrbit(scroll);
    // Quand les éclats sont quasi jointifs (à quelques pixels de leur place), c'est le prisme entier qui
    // est affiché : des faces de verre presque collées produisent des points blancs parasites aux jointures.
    const NEAR = 0.035;
    const complete = morph >= 1 || (morph > 0.5 && separation < NEAR);
    const assembled = separation < NEAR && morph <= 0;
    // Éclatement sans à-coup, miroir exact de la recomposition : le prisme entier resserre ses biseaux,
    // laisse la place aux éclats (jointifs, biseau minimal), dont les biseaux grandissent en s'écartant.
    const closing = assembled ? smoothScrollRange(scroll, T.open[0], T.open[1]) : 0;
    const opening = smoothScrollRange(scroll, T.burst[0], T.burst[0] + 0.07);
    const geometryMorph = geometryStep(Math.max(morph, 1 - opening));
    const prism = complete || closing > 0;
    if (wholeBody) wholeBody.visible = assembled && !prism;
    if (glassIcon) {
        glassIcon.visible = prism;
        if (prism) {
            const bevel = complete ? geometryStep(smoothScrollRange(scroll, T.bevel[0], T.bevel[1])) : geometryStep(1 - closing);
            const hole = complete ? geometryStep(smoothScrollRange(scroll, T.holes[0], T.holes[1])) : 1;
            const key = `${bevel}:${hole}`;
            if (key !== glassIcon.userData.progress) {
                if (!glassIcon.geometryCache) glassIcon.geometry.dispose();
                glassIcon.geometry = cachedGeometry(glassIcon, key, () => makeIconPrism(
                    lerp(SEAM_BEVEL, ICON_BEVEL.size, bevel),
                    lerp(SEAM_BEVEL, ICON_BEVEL.thickness, bevel), hole));
                glassIcon.userData.progress = key;
            }
        }
    }
    const ringRadius = layout.portrait ? 1.95 : 2.5;
    const ringHeight = layout.portrait ? 3.6 : 3.0;
    for (const piece of logoPieces) {
        const { mesh, home, targetHome, offset, twist, phase } = piece;
        mesh.visible = piece.isBody ? !complete && !assembled : true;
        if (!mesh.visible) continue;
        _position.copy(home).lerp(targetHome, morph).addScaledVector(offset, separation);
        // Les éclats flottent doucement tant qu'ils sont séparés.
        const drift = separation * 0.07;
        _position.x += Math.sin(time * 0.50 + phase) * drift;
        _position.y += Math.cos(time * 0.42 + phase * 1.3) * drift;
        _position.z += Math.sin(time * 0.37 + phase * 0.7) * drift;
        if (orbit > 0) {
            const angle = piece.orbitAngle + time * 0.14;
            _orbit.set(Math.cos(angle) * ringRadius, piece.orbitHeight * ringHeight, Math.sin(angle) * ringRadius);
            _position.lerp(_orbit, orbit);
        }
        mesh.position.copy(_position);
        mesh.rotation.set(
            twist.x * separation + Math.sin(time * 0.31 + phase) * 0.10 * separation + Math.sin(time * 0.21 + phase) * 0.55 * orbit,
            twist.y * separation + Math.cos(time * 0.27 + phase) * 0.14 * separation + Math.sin(time * 0.17 + phase * 1.9) * 1.1 * orbit,
            twist.z * separation + Math.sin(time * 0.23 + phase * 2.0) * 0.08 * separation);
        if (!piece.isBody && complete) {
            const bevel = geometryStep(smoothScrollRange(scroll, T.bevel[0], T.bevel[1]));
            mesh.geometry = bevel >= 1 ? piece.finalGeometry : cachedGeometry(piece, `extra:${bevel}`,
                () => makePrism(piece.targetContour, ICON_DEPTH,
                    lerp(SEAM_BEVEL, ICON_BEVEL.size, bevel),
                    lerp(SEAM_BEVEL, ICON_BEVEL.thickness, bevel)));
        } else if (geometryMorph <= 0) {
            mesh.geometry = piece.originalGeometry;
        } else {
            mesh.geometry = morphGeometry(piece, geometryMorph);
        }
    }
}

// ---- Fond : lignes ondulées fines, rouges sur noir, et halo qui suit l'éclair ----
function createBackgroundShader() {
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const fragmentShader = `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uScroll;
        uniform float uVelocity;
        uniform vec2 uObject;
        uniform float uGlow;
        uniform float uGlowSpread;

        mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
        float fineLine(float d, float width) {
            return 1.0 - smoothstep(width, width + 1.5 / uResolution.y, abs(d));
        }
        // Une couleur par chapitre (SITE.palette).
        uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
        vec3 chapterColor(float progress) {
            if (progress < 0.26) return mix(uC0, uC1, smoothstep(0.04, 0.22, progress));
            if (progress < 0.56) return mix(uC1, uC2, smoothstep(0.30, 0.44, progress));
            if (progress < 1.0) return mix(uC2, uC3, smoothstep(0.64, 0.86, progress));
            return mix(uC3, uC4, smoothstep(1.0, 1.2, progress));
        }
        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
            float s = uScroll;
            float time = uTime * 0.065;
            vec3 primary = chapterColor(s);
            vec3 secondary = chapterColor(min(1.22, s + 0.18));
            vec3 color = vec3(0.0);

            // Halo derrière l'éclair : il le suit à l'écran et nourrit la réfraction du verre.
            vec2 g = (uv - uObject) * vec2(1.30, 0.82) / uGlowSpread;
            float aura = exp(-dot(g, g) * 5.0);
            float core = exp(-dot(g, g) * 22.0);
            color += uC2 * (aura * 0.55 + core * 0.45) * uGlow;

            // Deux volumes retenus donnent de la profondeur sans délaver le noir.
            vec2 haloUv = (uv - vec2(0.16 + 0.16 * sin(s * 4.0), 0.14)) * vec2(1.20, 1.8);
            float halo = exp(-dot(haloUv, haloUv) * 2.8);
            vec2 lowerUv = (uv + vec2(0.40, 0.30)) * vec2(1.6, 2.6);
            color += primary * halo * 0.10;
            color += secondary * exp(-dot(lowerUv, lowerUv) * 2.0) * 0.035;

            vec2 p = rotate2d(-0.24 + s * 0.65) * (uv - vec2(0.06, -0.08));
            p += uMouse * 0.018;
            p.x += 0.15 * sin(p.y * 2.8 + s * 4.8 + time * 0.3);
            p.y += 0.09 * cos(p.x * 3.1 - s * 3.8 - time * 0.2);

            // Trois grands plis, espacés, aux arêtes fines et polies.
            for (int i = 0; i < 3; i++) {
                float k = float(i);
                vec2 q = p + vec2(0.0, 0.012 * sin(time + k));
                float radius = length(q * vec2(0.90, 1.22));
                float angle = atan(q.y, q.x);
                float contour = 0.34 + k * 0.145
                    + 0.075 * sin(angle * 2.0 + s * 5.0 + k * 0.28)
                    + 0.022 * cos(angle * 3.0 - time);
                float d = radius - contour;
                float arc = smoothstep(-0.65, 0.65, sin(angle + k * 0.55 + s * 3.5));
                vec3 tint = mix(primary, secondary, k * 0.38);
                float body = exp(-pow(d * 25.0, 2.0));
                float shoulder = exp(-pow((d + 0.018) * 13.0, 2.0));
                color += tint * (body * 0.10 + shoulder * 0.025) * arc;
                color += mix(tint, vec3(1.0, 0.82, 0.76), 0.22)
                    * fineLine(d, 0.0008) * arc * (0.18 + uVelocity * 0.07);
            }

            // Trame périphérique à peine visible.
            vec2 gridUv = rotate2d(-0.20 + s * 0.18) * uv + vec2(s * 0.08, s * 0.16);
            vec2 cell = abs(fract(gridUv * 10.0) - 0.5);
            float grid = max(fineLine((0.5 - cell.x) / 10.0, 0.0002), fineLine((0.5 - cell.y) / 10.0, 0.0002));
            float periphery = smoothstep(0.28, 0.80, length(uv));
            color += primary * grid * periphery * 0.022;

            float vignette = 1.0 - smoothstep(0.36, 1.20, length(uv * vec2(0.8, 1.0)));
            color *= mix(0.25, 1.0, vignette);
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    bgMaterial = new THREE.ShaderMaterial({
        vertexShader, fragmentShader, uniforms: shaderUniforms, depthWrite: false, depthTest: false
    });
    bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), bgMaterial);
    bgMesh.position.set(0.0, 0.0, -8.0);   // repère caméra, loin derrière
    bgMesh.renderOrder = -10;
    camera.add(bgMesh);
}

// ---- Qualité et taille de rendu ------------------------------------------------
// ---- Qualité de rendu ----------------------------------------------------------
// Cinq paliers, du verre complet au verre simplifié. Quel que soit le palier, la scène reste la même :
// même éclair, même taille, même position, mêmes chapitres. Les performances ne font jamais basculer
// vers l'image fixe en cours de visite.
//   5 = verre complet (dispersion)       4 = sans dispersion
//   3 = résolution × 0,75                2 = résolution × 0,55, dalle du chapitre final en CSS
//   1 = verre simplifié (sans réfraction : une seule passe de rendu)
const TIER_MAX = 5;
const RENDER_SCALE = [0.8, 0.8, 0.62, 0.78, 1, 1];
let forcedTier = 0;          // ?debug=1&palier=N : palier imposé pour les captures
let slabEnabled = false;     // dalle de verre 3D derrière le bloc final
let simpleGlass = null;

function pixelRatioCap() {
    const base = Math.min(window.devicePixelRatio || 1, tactile ? 1.5 : 2);
    return Math.max(0.5, base * RENDER_SCALE[tier]);
}

function initialTier() {
    if (forcedTier) return forcedTier;
    if (etat.lite) return 3;
    const memory = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    if (memory !== undefined && memory < 4) return 3;
    // Safari plafonne hardwareConcurrency sur iPhone et iPad : le signal n'y dit rien de la puissance
    // réelle. Ailleurs, peu de cœurs = départ sans dispersion ; la mesure des images/s fait le reste.
    if (!apple && cores !== undefined && cores <= 4) return 4;
    return TIER_MAX;
}

// Verre simplifié du dernier palier : rubis sombre légèrement translucide, sans réfraction (une seule
// passe de rendu). Reflets retenus : pas de face blanche, pas d'aplat saturé.
function createSimpleGlassMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: '#4a0000', metalness: 0.0, roughness: 0.22,
        clearcoat: 0.3, clearcoatRoughness: 0.25, specularIntensity: 0.4,
        envMapIntensity: 0.32, emissive: new THREE.Color('#420000'),
        transparent: true, opacity: 0.88, side: THREE.FrontSide
    });
}

function applyTier() {
    const dispersion = tier >= 5;
    for (const material of [glass, cardGlass]) {
        if (material && material.userData.dispersion !== dispersion) {
            material.userData.dispersion = dispersion;
            material.needsUpdate = true;
        }
    }
    const simple = tier <= 1;
    if (simple && !simpleGlass) simpleGlass = createSimpleGlassMaterial();
    const material = simple ? simpleGlass : glass;
    for (const mesh of [wholeBody, glassIcon, ...logoPieces.map(piece => piece.mesh)]) {
        if (mesh && mesh.material !== material) mesh.material = material;
    }
    slabEnabled = tier >= 3 && !!glassCard;
    document.body.classList.toggle('has-glass-card', slabEnabled);
    if (glassCard && !slabEnabled) glassCard.visible = false;
    if (fireflies) fireflies.geometry.setDrawRange(0, Math.round(FIREFLY_TIERS[tier] * (tactile ? 0.75 : 1)));
    resizeRenderer(true);
    document.documentElement.dataset.qualite = String(tier);
}

function resizeRenderer(force = false) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const ratio = pixelRatioCap();
    // iPhone : la barre d'adresse de Safari change la hauteur visible mais pas celle de la toile
    // (100lvh). Rien à recalculer dans ce cas : aucun saut pendant le scroll.
    if (!force && width === sizes.width && height === sizes.height && renderer.getPixelRatio() === ratio) return false;
    sizes.width = width;
    sizes.height = height;
    layout.portrait = portraitQuery.matches;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(shaderUniforms.uResolution.value);
    return true;
}

// Images par seconde durablement basses : on descend d'un palier (ou de plusieurs si c'est très lent).
// On ne remonte jamais, et on ne descend jamais sous le verre simplifié.
const perf = { enabled: true, frames: 0, total: 0, squares: 0, low: 0, graceUntil: 0 };
function watchPerformance(now, delta, active) {
    if (!perf.enabled || tier <= 1 || !active || delta > 1500 || now < perf.graceUntil) return;
    const sample = Math.min(delta, 400);
    perf.frames++;
    perf.total += sample;
    perf.squares += sample * sample;
    if (perf.frames < 36 && perf.total < 2500) return;          // fenêtre : 36 images ou 2,5 s
    const average = perf.total / perf.frames;
    const deviation = Math.sqrt(Math.max(0, perf.squares / perf.frames - average * average));
    perf.frames = 0;
    perf.total = 0;
    perf.squares = 0;
    // Écran ou mode économie d'énergie à 30 images/s : cadence régulière, ce n'est pas un manque de puissance.
    const capped = average > 31 && average < 35.5 && deviation < 2.5;
    perf.low = average > 28 && !capped ? perf.low + 1 : 0;
    if (perf.low < 2) return;
    perf.low = 0;
    perf.graceUntil = now + 2000;
    setTier(average > 120 ? 1 : average > 60 ? tier - 2 : tier - 1);
}

function setTier(value) {
    const next = clamp(Math.round(value), 1, TIER_MAX);
    if (next === tier) return;
    tier = next;
    applyTier();
}

function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(animationRequest);
    animationRequest = 0;
    document.querySelectorAll('.slide-title, .final-titre').forEach(title => { title.style.fontSize = ''; });
    if (contactSection) contactSection.style.transform = '';
    document.documentElement.classList.remove('scene-prete');
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (error) { /* contexte déjà perdu */ }
}

// Contexte WebGL perdu (pilote graphique, mémoire) : le navigateur le rend en général tout seul.
// En attendant, la toile est masquée et les chapitres continuent de suivre le scroll. S'il ne revient
// pas en un peu plus d'une seconde, l'image fixe de l'éclair prend le relais en fondu, au même endroit
// et à la même taille, une seule fois pour toute la visite (pas d'aller-retour).
const lost = { active: false, since: 0, poster: null };
function showPoster() {
    if (lost.poster) return;
    const poster = document.createElement('img');
    poster.className = 'affiche-secours';
    poster.alt = '';
    poster.setAttribute('aria-hidden', 'true');
    poster.src = new URL('../img/eclair-poster.webp', import.meta.url).href;
    document.body.appendChild(poster);
    lost.poster = poster;
    requestAnimationFrame(() => document.documentElement.classList.add('affiche-secours-visible'));
}
function updatePoster(frame, separation) {
    if (!lost.poster) return;
    // L'image fait 960×1200 ; l'éclair en occupe 62,5 % de la hauteur, centré.
    const visibleHeight = 2 * frame.radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const height = (OBJECT_HEIGHT * 0.96 / visibleHeight) * sizes.height / 0.625;
    lost.poster.style.height = `${height.toFixed(1)}px`;
    lost.poster.style.transform = `translate3d(${(frame.fx * sizes.width - height * 0.4).toFixed(1)}px, ${(frame.fy * sizes.height - height / 2).toFixed(1)}px, 0)`;
    lost.poster.style.opacity = String(1 - separation * 0.7);
}

// ---- Braise : une petite lumière rouge suit la souris avec inertie (ordinateur uniquement) ----
const ember = document.querySelector('.braise');
let emberShown = false, emberAt = '';
function setupPointer() {
    document.body.classList.add('cursor-hidden');   // la braise n'apparaît qu'au premier mouvement de souris
    window.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        cursorX = event.clientX;
        cursorY = event.clientY;
        targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = (event.clientY / window.innerHeight) * 2 - 1;
        if (!emberShown) {
            emberShown = true;
            outerCursorX = cursorX; outerCursorY = cursorY;
            document.body.classList.remove('cursor-hidden');
        }
    }, { passive: true });
    if (!pointerFine) return;
    document.addEventListener('mouseover', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        document.body.classList.toggle('cursor-hover', Boolean(target && target.closest('a[href], button, summary')));
    });
    document.addEventListener('mouseleave', () => { emberShown = false; document.body.classList.add('cursor-hidden'); });
}
function updateCursor(damping) {
    if (!pointerFine || !ember) return;
    outerCursorX += (cursorX - outerCursorX) * damping(0.16);
    outerCursorY += (cursorY - outerCursorY) * damping(0.16);
    const at = `translate3d(${outerCursorX.toFixed(1)}px, ${outerCursorY.toFixed(1)}px, 0)`;
    if (at !== emberAt) { ember.style.transform = at; emberAt = at; }
}

// Un titre tient sur deux lignes, jamais trois : une ligne trop large pour sa colonne
// rétrécit jusqu'à tenir. Mesuré avec la police chargée, puis à chaque redimensionnement.
function fitTitles() {
    document.querySelectorAll('.slide-title, .final-titre').forEach(title => {
        title.style.fontSize = '';
        const lines = [...title.querySelectorAll('.line-inner')];
        if (!lines.length) return;
        const widest = Math.max(...lines.map(line => {
            const range = document.createRange();
            range.selectNodeContents(line);
            return range.getBoundingClientRect().width;
        }));
        const available = title.clientWidth;
        if (widest > available && available > 0) {
            const size = parseFloat(getComputedStyle(title).fontSize);
            title.style.fontSize = `${Math.floor(size * available / widest * 0.985)}px`;
        }
    });
}

// Les captures de l'app (téléphone, panneau) ne sont chargées qu'après le hero : le premier
// affichage reste léger. Elles arrivent dès que le visiteur commence à défiler, ou après 2,5 s.
let mediasShown = false, mediasAt = Infinity;
function showMedias() {
    mediasShown = true;
    document.documentElement.classList.add('medias');
    requestAnimationFrame(measureZones);
}

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
// Repères de temps de l'initialisation (visibles dans l'onglet Performance du navigateur).
const mark = name => { try { performance.mark(`flash:${name}`); } catch (error) { /* sans importance */ } };

// ---- Boucle de rendu -----------------------------------------------------------
let animationRequest = 0;
let lastFrameAt = 0;
let lastInputAt = performance.now();
const _target = new THREE.Vector3();
const _projected = new THREE.Vector3();

function readScroll() {
    const maxScroll = stageMaxScroll();
    const scrollTop = window.scrollY || 0;
    // Le chapitre final ne commence que lorsque son bloc entre réellement à l'écran (et non dès que sa
    // section, plus haute que lui, dépasse le bas de la fenêtre) : le chapitre 4 garde son texte et son
    // éclair jusque-là, il n'y a jamais d'écran sans texte entre les deux.
    if (contactSection) {
        const enter = clamp(0.14 + contactCardElement.offsetTop / window.innerHeight, 0, 0.8);
        targetContact = clamp(((scrollTop - maxScroll) / window.innerHeight - enter) / (1 - enter), 0, 1);
    } else targetContact = 0;
    finalOpen = targetContact > 0.02;
    return clamp(scrollTop / maxScroll, 0, 1);
}

function animate(now = performance.now()) {
    if (!running || document.hidden) return;
    animationRequest = requestAnimationFrame(animate);
    const targetScroll = readScroll();
    const unsettled = Math.abs(targetScroll - currentScroll) > 0.0001 || Math.abs(targetContact - currentContact) > 0.0001;
    const active = unsettled || now - lastInputAt < 1500;
    const fps = active ? 60 : 30;
    if (lastFrameAt && now - lastFrameAt < 1000 / fps - 1) return;
    const frameDelta = lastFrameAt ? now - lastFrameAt : 16;
    lastFrameAt = now;
    watchPerformance(now, frameDelta, active);
    if (!running) return;
    if (!mediasShown && (targetScroll > 0.04 || now > mediasAt)) showMedias();
    // Le lissage suit le temps réel écoulé : sur une machine lente (peu d'images par seconde), le texte
    // et la 3D restent calés sur la position de défilement au lieu de prendre du retard.
    const elapsed = Math.min(clock.getDelta(), 1.0);
    const deltaTime = Math.min(elapsed, 0.1);
    const time = clock.getElapsedTime();
    const damping = factor => 1 - Math.pow(1 - factor, elapsed * 60);

    // Scroll lissé (inertie). Un peu plus vif au doigt qu'à la molette.
    currentScroll += (targetScroll - currentScroll) * damping(tactile ? 0.055 : 0.032);
    currentContact += (targetContact - currentContact) * damping(0.07);
    if (Math.abs(targetContact - currentContact) < 0.0015) currentContact = targetContact;

    mouseX += (targetMouseX - mouseX) * damping(0.05);
    mouseY += (targetMouseY - mouseY) * damping(0.05);
    updateCursor(damping);
    smoothZones(damping(0.09));

    const separation = getLogoSeparation(currentScroll);
    const final = smoothScrollRange(currentContact, 0, 0.85);

    // L'éclair suit légèrement la souris, respire doucement, et fait un tour sur lui-même
    // en rejoignant le chapitre final.
    if (modelPivot) {
        // Ressort : l'éclair se tourne vers la souris, dépasse à peine sa cible puis se pose.
        const step = Math.min(elapsed, 0.05);
        sway.vy += ((targetMouseX * 0.40 - sway.y) * 26 - sway.vy * 6.5) * step;
        sway.vx += ((targetMouseY * 0.22 - sway.x) * 26 - sway.vx * 6.5) * step;
        sway.y += sway.vy * step;
        sway.x += sway.vx * step;
        const whole = 1 - separation;
        modelPivot.rotation.y = sway.y + Math.sin(time * 0.35) * 0.07 + Math.sin(final * Math.PI) * 0.06;
        modelPivot.rotation.x = sway.x + Math.sin(time * 0.27) * 0.03;
        modelPivot.rotation.z = Math.sin(time * 0.21 + 1.3) * 0.02 * whole;
        modelPivot.position.x = mouseX * 0.09 * (0.5 + 0.5 * whole);
        modelPivot.position.y = -0.3 + Math.sin(time * 0.5) * 0.045 * whole;
            }
    // Pendant la recomposition la caméra voit la grande face de l'éclair sous un angle rasant : le studio
    // de lumière s'y reflète en nappe pâle. On baisse les reflets sur cette plage (le verre reste rouge
    // profond), puis on les remonte au chapitre final.
    const grazing = smoothScrollRange(currentScroll, 0.64, 0.74) * (1 - smoothScrollRange(currentScroll, 0.90, 0.99));
    if (glass) glass.envMapIntensity = 1.0 - 0.48 * grazing * (1 - final) + smoothScrollRange(final, 0.55, 1) * 0.4;
    if (simpleGlass) simpleGlass.envMapIntensity = 0.32 + final * 0.12;

    // Lucioles : le récit et les interactions passent par quelques nombres, le reste se calcule dans la carte graphique.
    if (fireflies) {
        const u = fireflyUniforms;
        u.uTime.value = time;
        u.uCenter.value.set(modelPivot ? modelPivot.position.x : 0, -0.3, 0);
        u.uBurst.value = clamp((currentScroll - T.burst[0]) / (0.31 - T.burst[0]), 0, 1);
        u.uGather.value = smoothScrollRange(currentScroll, 0.60, 0.74) * (1 - smoothScrollRange(currentScroll, 0.80, 0.93));
        u.uAura.value = final;
        // Elles glissent légèrement avec le défilement (sur téléphone, c'est leur seule réaction au geste).
        fireflyDrift += (clamp((targetScroll - currentScroll) * 26, -1, 1) - fireflyDrift) * damping(0.07);
        u.uDrift.value = fireflyDrift * 0.85;
        if (pointerFine && emberShown) u.uMouse.value.set(outerCursorX / sizes.width * 2 - 1, 1 - outerCursorY / sizes.height * 2);
        else u.uMouse.value.set(9, 9);
        u.uAspect.value = sizes.width / sizes.height;
        u.uScale.value = sizes.height * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        u.uFocus.value = camera.position.length();
        u.uBoost.value = layout.portrait ? 2.3 : 1;     // sur téléphone la caméra est deux fois plus loin : mêmes lucioles à l'écran
        u.uOpacity.value += (1 - u.uOpacity.value) * damping(0.02);
        if (fireflyTick++ % 20 === 0) measureFireflyZones(headerState.chapter);
        u.uTextA.value.lerp(fireflyZoneA, damping(0.12));
        u.uTextB.value.lerp(fireflyZoneB, damping(0.12));
    }

    // La caméra fait le tour de l'éclair au fil du scroll.
    const frame = cameraFrame(currentScroll, currentContact);
    const phi = orbitAngle(currentScroll);
    const y = 0.35 + Math.sin(currentScroll * Math.PI) * 0.8;
    _target.set(frame.radius * Math.sin(phi), y, frame.radius * Math.cos(phi));
    // Le scroll est déjà lissé : la caméra le suit de près. Un second lissage trop mou la mettait en
    // retard pendant le défilement (éclair vu de profil, reflets pâles) par rapport aux positions calculées.
    camera.position.lerp(_target, damping(0.12));
    camera.lookAt(frame.lookAt);
    camera.updateMatrixWorld();
    updateGlassCard();

    // Fond : couleur du chapitre, halo calé sur l'éclair.
    _projected.set(0, -0.3, 0).project(camera);
    shaderUniforms.uObject.value.set(_projected.x * camera.aspect * 0.5, _projected.y * 0.5);
    shaderUniforms.uGlow.value = 0.20 - separation * 0.07 + final * 0.14;
    shaderUniforms.uGlowSpread.value = (layout.portrait ? 0.62 : 1.0) * (1.0 + separation * 0.9);
    shaderUniforms.uTime.value = time;
    shaderUniforms.uMouse.value.set(mouseX, -mouseY);
    shaderUniforms.uScroll.value = currentScroll + currentContact * 0.22;
    shaderUniforms.uVelocity.value += (Math.min(1, Math.abs(targetScroll - currentScroll) * 14) - shaderUniforms.uVelocity.value) * damping(0.06);

    updateLogoPieces(currentScroll, time);
    updateSlides(currentScroll);
    updateHeader(currentScroll);
    updateFinal();
    if (lost.active) {
        if (now - lost.since > 1200) showPoster();
        updatePoster(frame, separation);
        return;
    }
    renderer.render(scene, camera);
}

// ---- En-tête : chapitre actif, compteur, filet de progression -----------------
const headerState = { chapter: -1, progress: '' };
const chapterLinks = [...document.querySelectorAll('.nav [data-chapitre]')];
const chapterCounter = document.getElementById('compteur-chapitre');
const progressFill = document.getElementById('entete-progression');
// Le numéro de chapitre bascule comme sur un tableau de score : l'ancien chiffre se couche, le nouveau se relève.
let counterTimer = 0;
function flipCounter(text) {
    if (!chapterCounter || chapterCounter.textContent === text) return;
    clearTimeout(counterTimer);
    chapterCounter.classList.remove('entre');
    chapterCounter.classList.add('sort');
    counterTimer = setTimeout(() => {
        chapterCounter.textContent = text;
        chapterCounter.classList.remove('sort');
        chapterCounter.classList.add('entre');
    }, 150);
}
function updateHeader(scroll) {
    const chapter = targetContact > 0.02 ? 4
        : scroll < T.chapters[0] ? 0 : scroll < T.chapters[1] ? 1 : scroll < T.chapters[2] ? 2 : 3;
    if (chapter !== headerState.chapter) {
        headerState.chapter = chapter;
        for (const link of chapterLinks) {
            const current = Number(link.dataset.chapitre) === chapter;
            link.classList.toggle('est-actif', current);
            if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        }
        flipCounter(String(chapter + 1).padStart(2, '0'));
    }
    if (progressFill) {
        const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, window.scrollY / total).toFixed(4);
        if (progress !== headerState.progress) { progressFill.style.transform = `scaleX(${progress})`; headerState.progress = progress; }
    }
}

// ---- Chapitres : un texte reste affiché assez longtemps même si on scrolle vite ----
const SLIDE_MIN_SHOW = 1500, SLIDE_LEAVE_HOLD = 400;
const slides = [...document.querySelectorAll('.slide')];
const slideState = T.slides.map(() => ({ active: false, since: 0, left: 0 }));
const tutoSteps = [...document.querySelectorAll('.tuto-etape')];
const tutoDots = [...document.querySelectorAll('.tuto-points span')];
let tutoStep = -1;

function updateSlides(scroll) {
    const now = performance.now();
    const inside = T.slides.map(([start, end]) => !finalOpen && scroll >= start && scroll <= end);
    const current = inside.indexOf(true);
    const actives = slideState.map((state, index) => {
        if (current === index) {
            if (!state.active) state.since = now;
            state.active = true;
            state.left = 0;
            return true;
        }
        if (state.active && current === -1 && !finalOpen) {
            if (!state.left) state.left = now;
            if (now - state.since < SLIDE_MIN_SHOW || now - state.left < SLIDE_LEAVE_HOLD) return true;
        }
        state.active = false;
        state.left = 0;
        return false;
    });
    slides.forEach((slide, index) => { if (slide) slide.classList.toggle('active', actives[index]); });

    // Tutoriel : les 4 étapes se succèdent au rythme du scroll dans le chapitre 3.
    const local = clamp((scroll - T.tuto[0]) / (T.tuto[1] - T.tuto[0]), 0, 0.9999);
    const step = Math.floor(local * tutoSteps.length);
    if (step !== tutoStep) {
        tutoStep = step;
        tutoSteps.forEach((element, index) => element.classList.toggle('est-active', index === step));
        tutoDots.forEach((element, index) => element.classList.toggle('est-actif', index === step));
    }
}

let finalPinned = -1;
function updateFinal() {
    if (!contactSection) return;
    document.body.classList.toggle('contact-open', finalOpen);
    contactSection.classList.toggle('active', finalOpen);
    // Fin de page : le bloc final (et sa dalle de verre) reste en place, l'éclair aussi ; c'est le pied
    // de page qui monte et les recouvre. En remontant, tout se retrouve exactement au même endroit.
    const over = Math.max(0, Math.round(window.scrollY + window.innerHeight - (contactSection.offsetTop + contactSection.offsetHeight)));
    if (over !== finalPinned) {
        finalPinned = over;
        // Le bloc remonte juste ce qu'il faut pour que ses boutons restent visibles au-dessus du pied de
        // page. Sur téléphone il défile alors derrière la barre du haut en verre, comme une page normale ;
        // sur ordinateur il s'arrête sous la barre.
        const sectionTop = window.innerHeight - contactSection.offsetHeight;      // haut de la section quand elle est épinglée
        const top = sectionTop + contactCardElement.offsetTop, bottom = top + contactCardElement.offsetHeight;
        const room = layout.portrait ? Infinity : Math.max(0, top - 70 - 10);
        const lift = clamp(bottom + (layout.portrait ? 20 : 16) - (window.innerHeight - over), 0, room);
        contactSection.style.transform = over > 0 ? `translate3d(0, ${over - lift}px, 0)` : '';
    }
}

function setupNavigation() {
    const go = (index) => {
        const top = index >= 4 && contactSection ? contactSection.offsetTop : stageMaxScroll() * T.nav[index];
        window.scrollTo({ top, behavior: 'smooth' });
    };
    document.querySelectorAll('[data-chapitre]').forEach(link => {
        link.addEventListener('click', (event) => { event.preventDefault(); go(Number(link.dataset.chapitre)); });
    });
    document.querySelectorAll('a[href="#accueil"]:not([data-chapitre])').forEach(link => {
        link.addEventListener('click', (event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    // Arrivée avec une ancre de chapitre (les chapitres sont fixes : le navigateur ne peut pas y sauter seul).
    const anchors = { '#jeux': 1, '#app': 2, '#direct': 3 };
    const index = anchors[window.location.hash];
    if (index) window.scrollTo(0, stageMaxScroll() * T.nav[index]);
}

function snapCamera() {
    const frame = cameraFrame(currentScroll, currentContact);
    const phi = orbitAngle(currentScroll);
    camera.position.set(frame.radius * Math.sin(phi), 0.35 + Math.sin(currentScroll * Math.PI) * 0.8, frame.radius * Math.cos(phi));
    camera.lookAt(frame.lookAt);
}

// Crochets de test : actifs seulement avec ?debug=1 (captures automatisées).
function installDebugHooks() {
    window.__glassSite = {
        snap(value) {
            window.scrollTo(0, stageMaxScroll() * value);
            currentScroll = value;
            currentContact = targetContact = 0;
            snapCamera();
        },
        snapContact(value) {
            window.scrollTo(0, stageMaxScroll() + window.innerHeight * value);
            currentScroll = 1;
            currentContact = targetContact = value;
            snapCamera();
        },
        setTier,
        frame(fx, fy, radius) { debugFrame = fx === undefined ? null : { fx, fy, radius }; snapCamera(); },
        get tier() { return tier; },
        // perd volontairement le contexte WebGL (test de l'image de secours) ; `restore` le rend
        loseContext(restore = false) {
            const extension = renderer.getContext().getExtension('WEBGL_lose_context');
            if (!extension) return false;
            if (restore) extension.restoreContext(); else extension.loseContext();
            return true;
        },
        get zones() { return zones; },
        get scroll() { return currentScroll; },
        get contact() { return currentContact; },
        get pieces() { return logoPieces.map(p => ({ name: p.name, points: p.correspondence.length })); },
        get info() { return renderer.info.render; }
    };
}

// Initialisation découpée en étapes courtes : la page reste réactive pendant que la scène se prépare.
async function init() {
    mark('debut');
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.FogExp2('#000000', 0.01);

    camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(0, 0.2, 3.0);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 indisponible');
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;

    mark('renderer');
    createBackgroundShader();

    scene.add(new THREE.AmbientLight('#ffffff', 0.1));
    // Lumière principale : blanche, en haut à droite.
    const keyLight = new THREE.SpotLight('#ffe9e2', 4.0);      // doux : pas de point chaud blanc sur les grandes faces
    keyLight.position.set(4, 6, 3);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.9;
    scene.add(keyLight);
    // Lumière de contour : chaude, derrière à gauche, dessine la silhouette.
    const rimLight = new THREE.DirectionalLight('#ffe8e0', 10.0);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight('#fff3e6', 0.8);
    fillLight.position.set(-2, -4, 2);
    scene.add(fillLight);

    createFireflies();
    mark('fond');
    await pause();
    createGlassEnvironment();
    mark('environnement');
    await pause();
    createGlassLogo();
    mark('eclair');
    await pause();
    createGlassCard();
    tier = initialTier();
    applyTier();
    fitTitles();
    measureZones();
    currentScroll = readScroll();
    currentContact = targetContact;
    snapCamera();

    // Compile tous les shaders maintenant (dalle du chapitre final comprise), sans bloquer la page
    // quand le navigateur sait compiler en parallèle. Three.js rend le verre en deux temps : d'abord
    // le fond et les faces arrière dans une texture (passe de transmission), puis l'image finale.
    // Les deux jeux de shaders sont préparés ici, sinon la première image les compilerait d'un bloc.
    mark('dalle');
    if (glassCard) glassCard.visible = true;
    glassIcon.visible = true;
    const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
    const compileScene = async () => {
        if (parallel) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    };
    const transmissionTarget = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(transmissionTarget);
    glass.side = THREE.BackSide;
    glass.needsUpdate = true;
    await compileScene();
    mark('shaders-transmission');
    await pause();
    renderer.setRenderTarget(null);
    glass.side = THREE.DoubleSide;
    glass.needsUpdate = true;
    await compileScene();
    transmissionTarget.dispose();
    if (glassCard) glassCard.visible = false;
    glassIcon.visible = false;
    mark('shaders');
    await pause();

    for (const type of ['scroll', 'pointermove', 'pointerdown', 'keydown', 'resize', 'touchmove']) {
        window.addEventListener(type, () => { lastInputAt = performance.now(); }, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
        cancelAnimationFrame(animationRequest);
        animationRequest = 0;
        if (!document.hidden && running) {
            clock.getDelta();
            lastFrameAt = 0;
            lastInputAt = performance.now();
            perf.graceUntil = performance.now() + 1500;
            animationRequest = requestAnimationFrame(animate);
        }
    });
    window.addEventListener('resize', () => {
        if (!running) return;
        if (resizeRenderer()) { headerState.chapter = -1; }
        fitTitles();
        measureZones();
    });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();          // autorise le navigateur à rendre le contexte
        if (!running) return;
        lost.active = true;
        lost.since = performance.now();
        // La toile est masquée tout de suite : un contexte perdu peut s'afficher en gris.
        document.documentElement.classList.add('contexte-perdu');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        if (!running || lost.poster) return;
        lost.active = false;
        document.documentElement.classList.remove('contexte-perdu');
        lastFrameAt = 0;
        clock.getDelta();
        applyTier();
    });

    setupPointer();
    setupNavigation();
    if (etat.debug) installDebugHooks();

    running = true;
    perf.graceUntil = performance.now() + 3000;
    mediasAt = performance.now() + 2500;
    animate();
    mark('premiere-image');
    document.documentElement.classList.add('scene-prete');
    prewarmMorph();
}

// Point d'entrée, appelé par accueil.js. `repliStatique` bascule la page en image fixe.
export async function demarrer(etatInitial, repliStatique) {
    etat = etatInitial;
    repli = repliStatique;
    const params = new URLSearchParams(window.location.search);
    if (etat.debug) {
        // Réglages de test : autre forme de assets/shapes/, autre nombre d'éclats.
        const forme = params.get('forme');
        if (forme && /^[a-z0-9-]+$/.test(forme)) SITE.shapes[0] = `../shapes/${forme}.svg`;
        const fragments = Number(params.get('fragments'));
        if (fragments >= 1 && fragments <= 8) SITE.fragments = fragments;
        perf.enabled = params.get('auto') === '1';
        const palier = Number(params.get('palier'));
        if (palier >= 1 && palier <= TIER_MAX) forcedTier = palier;
    }
    const version = new URL(import.meta.url).search;
    const sources = await Promise.all(SITE.shapes.map(async (path) => {
        const response = await fetch(new URL(path + version, import.meta.url));
        if (!response.ok) throw new Error(`Forme introuvable : ${path}`);
        return response.text();
    }));
    openingSource = sources[0];
    finalSource = SINGLE_SHAPE ? sources[0] : sources[1];

    await init();

    // Première image rendue, shaders compilés : on lève le préchargeur une fois les polices prêtes.
    const release = () => { if (running) { fitTitles(); measureZones(); } etat.loader.done(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(release, release); else release();
}
