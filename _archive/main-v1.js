/* FLASH ESPORT — site V1 — comportements simples, sans dépendance */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Menu mobile
  var bouton = document.querySelector(".menu-btn");
  var nav = document.getElementById("navigation");
  if (bouton && nav) {
    bouton.addEventListener("click", function () {
      var ouvert = bouton.getAttribute("aria-expanded") === "true";
      bouton.setAttribute("aria-expanded", String(!ouvert));
      bouton.setAttribute("aria-label", ouvert ? "Ouvrir le menu" : "Fermer le menu");
      nav.classList.toggle("ouvert", !ouvert);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("ouvert")) {
        bouton.click();
        bouton.focus();
      }
    });
  }

  // Trait sous la barre du haut après défilement
  var barre = document.querySelector(".barre-haut");
  if (barre) {
    var majBarre = function () { barre.classList.toggle("defile", window.scrollY > 8); };
    majBarre();
    window.addEventListener("scroll", majBarre, { passive: true });
  }

  // Apparition douce des blocs
  var blocs = document.querySelectorAll(".apparait");
  if (reduit || !("IntersectionObserver" in window)) {
    blocs.forEach(function (b) { b.classList.add("visible"); });
  } else {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    blocs.forEach(function (b) { obs.observe(b); });
  }

  // Maquette : un but marqué, une seule fois
  var score = document.querySelector("[data-score-live]");
  if (score && !reduit) {
    setTimeout(function () {
      score.textContent = "1 - 0";
      score.classList.add("score-flash");
    }, 2600);
  }

  // Année du pied de page
  var annee = document.querySelector("[data-annee]");
  if (annee) annee.textContent = String(new Date().getFullYear());
})();
