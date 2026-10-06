/* FLASH ESPORT — accueil : choix du mode d'affichage et préchargeur.
   Script externe et synchrone (aucun script inline : CSP stricte), placé juste après le préchargeur.
   - mode « 3d »       : scène WebGL pilotée par le scroll (assets/js/app.js)
   - mode « statique » : image fixe de l'éclair et simples fondus (mouvement réduit, WebGL2 absent, ?statique=1) */
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
    loader: { done: function () {} }
  };
  if (statique) { racine.classList.add("mode-statique"); return; }
  racine.classList.add("mode-3d");

  // ---- Préchargeur : progression simulée pendant la préparation de la scène, puis course à 100 ----
  var el = document.getElementById("loader");
  var count = document.getElementById("loader-count");
  var fill = document.getElementById("loader-fill");
  if (!el || !count || !fill) return;
  el.hidden = false;
  document.body.classList.add("is-loading");
  var start = performance.now(), ready = false, rampAt = 0, shownAtRamp = 0, shown = 0, finished = false;
  var RAMP = 220;
  function finish() {
    if (finished) return;
    finished = true;
    count.textContent = "100";
    fill.style.transform = "scaleX(1)";
    el.classList.add("is-done");
    document.body.classList.remove("is-loading");
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
    count.textContent = String(Math.round(shown)).padStart(2, "0");
    fill.style.transform = "scaleX(" + (shown / 100) + ")";
    if (rampAt && shown >= 99.5) { finish(); return; }
    requestAnimationFrame(tick);
  }
  etat.loader.done = function () { ready = true; };
  etat.loader.finish = finish;
  requestAnimationFrame(tick);
  // Ne jamais retenir le visiteur : au bout de 12 s le préchargeur se lève quoi qu'il arrive.
  setTimeout(function () { ready = true; }, 12000);
  setTimeout(finish, 13500);
})();
