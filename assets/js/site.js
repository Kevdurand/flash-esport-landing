/* STRIKZY — comportements communs à toutes les pages, sans dépendance */
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
    window.matchMedia("(min-width: 901px)").addEventListener("change", function (e) {
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

  // Badges App Store / Google Play.
  // Depuis le 10/11/2026, Google Play n'affiche plus de badge mais le texte « Bientôt sur Android » (écrit dans le HTML).
  // À la sortie Android : remettre dans le HTML le badge Google Play avec data-store-url (voir le commentaire près des badges), puis mettre l'adresse ici.
  //   App Store   : "https://apps.apple.com/fr/app/id6800447821"   (en ligne depuis le 04/11/2026, badge aussi écrit en dur dans le HTML)
  //   Google Play : "https://play.google.com/store/apps/details?id=com.flashesport.mobile"
  var LIENS_STORES = {
    "app-store": "https://apps.apple.com/fr/app/id6800447821",
    "google-play": ""
  };
  document.querySelectorAll(".badge[data-store]").forEach(function (badge) {
    var cible = badge.querySelector("[data-store-url]");
    if (!cible) return;
    var url = cible.getAttribute("data-store-url") || LIENS_STORES[badge.getAttribute("data-store")] || "";
    if (!url) return;
    var lien = document.createElement("a");
    lien.className = cible.className;
    lien.href = url;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    lien.setAttribute("data-store-url", url);
    while (cible.firstChild) lien.appendChild(cible.firstChild);
    badge.replaceChild(lien, cible);
    var mention = badge.querySelector(".badge-mention");
    if (mention) badge.removeChild(mention);
    badge.classList.add("est-actif");
  });

  // Sommaire des pages légales : ouvert sur ordinateur, replié sur téléphone
  var sommaire = document.querySelector("details[data-sommaire]");
  if (sommaire) {
    var large = window.matchMedia("(min-width: 901px)");
    var majSommaire = function () { sommaire.open = large.matches; };
    majSommaire();
    large.addEventListener("change", majSommaire);
    sommaire.addEventListener("click", function (e) {
      if (!large.matches && e.target instanceof Element && e.target.closest("a")) sommaire.open = false;
    });
  }

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
