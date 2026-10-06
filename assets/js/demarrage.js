/* FLASH ESPORT — accueil : choix du mode d'affichage, apparition du hero, indicateur de chargement.
   Script externe et synchrone (aucun script inline : CSP stricte), placé juste après l'indicateur.
   - mode « 3d »       : scène WebGL pilotée par le scroll (assets/js/app.js)
   - mode « statique » : image fixe de l'éclair et simples fondus (mouvement réduit, WebGL2 absent, ?statique=1)
   Le texte du hero s'affiche tout de suite ; la scène 3D se charge derrière et apparaît quand elle est prête. */
(function () {
  "use strict";
  var racine = document.documentElement;
  racine.classList.add("js");

  var params = new URLSearchParams(window.location.search);
  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var statique = reduit || !window.WebGL2RenderingContext || params.get("statique") === "1";
  var etat = window.__flash = {
    mode: statique ? "statique" : "3d",
    reduit: reduit,
    debug: params.get("debug") === "1",
    lite: params.get("lite") === "1",
    loader: { done: function () {}, finish: function () {} }
  };
  racine.classList.add(statique ? "mode-statique" : "mode-3d");

  // Le hero apparaît dès que la police des titres est prête (au plus tard après 1,2 s).
  var heroLance = false;
  function lancerHero() {
    if (heroLance) return;
    heroLance = true;
    requestAnimationFrame(function () {
      var hero = document.getElementById("accueil");
      if (hero && window.scrollY < window.innerHeight * 0.5) hero.classList.add("active");
    });
  }
  // On n'attend pas la fin du chargement des scripts : dès que la section existe dans la page.
  (function attendreHero() {
    if (!document.getElementById("accueil")) { requestAnimationFrame(attendreHero); return; }
    if (document.fonts && document.fonts.load) {
      document.fonts.load('1em "Anton"').then(lancerHero, lancerHero);
      setTimeout(lancerHero, 1200);
    } else {
      lancerHero();
    }
  })();
  if (statique) return;

  // ---- Indicateur de chargement de la scène : discret, à l'emplacement de l'éclair, sans bloquer la page ----
  var el = document.getElementById("loader");
  var count = document.getElementById("loader-count");
  var fill = document.getElementById("loader-fill");
  if (!el || !count || !fill) return;
  el.hidden = false;
  var start = performance.now(), ready = false, rampAt = 0, shownAtRamp = 0, shown = 0, finished = false;
  var RAMP = 220, affiche = -1;
  function finish() {
    if (finished) return;
    finished = true;
    count.textContent = "100";
    fill.style.transform = "scaleX(1)";
    el.classList.add("is-done");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }
  function tick(now) {
    if (finished) return;
    if (ready && !rampAt) { rampAt = now; shownAtRamp = shown; }
    if (rampAt) {
      var k = Math.min(1, (now - rampAt) / RAMP);
      shown = shownAtRamp + (100 - shownAtRamp) * (1 - Math.pow(1 - k, 3));
    } else {
      shown = 92 * (1 - Math.exp(-(now - start) / 1600));
    }
    // La page n'est retouchée que lorsque le chiffre affiché change (pas à chaque image).
    var entier = Math.round(shown);
    if (entier !== affiche) {
      affiche = entier;
      count.textContent = String(entier).padStart(2, "0");
      fill.style.transform = "scaleX(" + (entier / 100) + ")";
    }
    if (rampAt && shown >= 99.5) { finish(); return; }
    requestAnimationFrame(tick);
  }
  etat.loader.done = function () { ready = true; };
  etat.loader.finish = finish;
  requestAnimationFrame(tick);
  // Au bout de 15 s l'indicateur s'efface quoi qu'il arrive.
  setTimeout(finish, 15000);
})();
