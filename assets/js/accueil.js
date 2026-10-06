/* FLASH ESPORT — accueil : point d'entrée.
   Charge le moteur 3D (Three.js) seulement en mode « 3d ». En mode « statique », ou si le moteur
   échoue, la page reste une page classique : image fixe de l'éclair et simples fondus. */

const etat = window.__flash || { mode: 'statique', reduit: false, debug: false, lite: false, loader: { done() {} } };
const racine = document.documentElement;
const version = new URL(import.meta.url).search;

// ---- Mode statique : fondus à l'entrée de chaque section, image fixe de l'éclair ----
let statiqueActif = false;
function modeStatique() {
    if (statiqueActif) return;
    statiqueActif = true;
    racine.classList.remove('mode-3d');
    racine.classList.add('mode-statique');
    document.body.classList.remove('is-loading', 'has-glass-card', 'contact-open', 'cursor-hover', 'cursor-hidden');
    if (etat.loader.finish) etat.loader.finish();
    document.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; });
    const sections = document.querySelectorAll('.slide, .final');
    sections.forEach(section => section.classList.remove('active'));
    if (!('IntersectionObserver' in window)) { sections.forEach(section => section.classList.add('active')); return; }
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) { entry.target.classList.add('active'); observer.unobserve(entry.target); }
        }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    sections.forEach(section => observer.observe(section));
}

// ---- Panneau incliné : suit la souris sur ordinateur (sur écran tactile, balancement lent en CSS) ----
function panneauIncline() {
    const panneau = document.querySelector('[data-inclinaison] .panneau-verre');
    if (!panneau || etat.reduit || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const section = panneau.closest('.slide');
    let cibleX = 0, cibleY = 0, x = 0, y = 0, boucle = 0;
    const image = () => {
        x += (cibleX - x) * 0.07;
        y += (cibleY - y) * 0.07;
        panneau.style.transform = `rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 13).toFixed(2)}deg)`;
        boucle = Math.abs(cibleX - x) + Math.abs(cibleY - y) > 0.002 ? requestAnimationFrame(image) : 0;
    };
    window.addEventListener('pointermove', event => {
        if (!section.classList.contains('active')) return;
        cibleX = (event.clientX / window.innerWidth) * 2 - 1;
        cibleY = (event.clientY / window.innerHeight) * 2 - 1;
        if (!boucle) boucle = requestAnimationFrame(image);
    }, { passive: true });
}

panneauIncline();

if (etat.mode === '3d') {
    try {
        const moteur = await import(`./app.js${version}`);
        await moteur.demarrer(etat, modeStatique);
    } catch (erreur) {
        // Moteur indisponible (WebGL refusé, vieux navigateur…) : on retombe sur la page statique.
        if (etat.debug) console.warn('[flash] moteur 3D indisponible, page statique', erreur);
        modeStatique();
    }
} else {
    modeStatique();
}
