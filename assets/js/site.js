/* FLASH ESPORT — comportements communs à toutes les pages, sans dépendance */
(function () {
  "use strict";
  var racine = document.documentElement;
  racine.classList.add("js");

  // Menu mobile plein écran
  var bouton = document.querySelector(".menu-btn");
  var nav = document.getElementById("navigation");
  function reglerMenu(ouvert) {
    racine.classList.toggle("menu-ouvert", ouvert);
    bouton.setAttribute("aria-expanded", String(ouvert));
    bouton.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
  }
  if (bouton && nav) {
    bouton.addEventListener("click", function () {
      reglerMenu(bouton.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target instanceof Element && e.target.closest("a")) reglerMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && racine.classList.contains("menu-ouvert")) {
        reglerMenu(false);
        bouton.focus();
      }
    });
    window.matchMedia("(min-width: 821px)").addEventListener("change", function (e) {
      if (e.matches) reglerMenu(false);
    });
  }

  // En-tête en verre sombre après défilement
  var entete = document.querySelector(".entete");
  if (entete) {
    var majEntete = function () { entete.classList.toggle("est-defile", window.scrollY > 8); };
    majEntete();
    window.addEventListener("scroll", majEntete, { passive: true });
  }

  // Boutons des stores : désactivés tant que data-store-url est vide.
  // Pour les activer : renseigner data-store-url="https://…" dans le HTML, rien d'autre.
  document.querySelectorAll("[data-store-url]").forEach(function (lien) {
    var url = lien.getAttribute("data-store-url");
    if (!url) return;
    lien.setAttribute("href", url);
    lien.setAttribute("target", "_blank");
    lien.setAttribute("rel", "noopener noreferrer");
    lien.removeAttribute("aria-disabled");
    lien.removeAttribute("role");
    var petit = lien.querySelector(".store-petit");
    if (petit) petit.textContent = "Télécharger sur";
  });

  // Apparition douce des blocs (pages secondaires)
  var blocs = document.querySelectorAll(".apparait");
  if (blocs.length) {
    var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduit || !("IntersectionObserver" in window)) {
      blocs.forEach(function (b) { b.classList.add("est-visible"); });
    } else {
      var obs = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("est-visible"); obs.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      blocs.forEach(function (b) { obs.observe(b); });
    }
  }
})();
