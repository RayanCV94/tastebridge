// Version navigateur du moteur (site github.io) : même calcul que recos.py, sans serveur.
// Le profil reste dans le navigateur du visiteur (localStorage) ; aucun compte, aucun envoi.
const Moteur = (() => {
  const NOTES = {adore: 2, aime: 1, regarde: 0.5, vu: 0, bof: -1, deteste: -2};
  const CLE = "tastebridge-profil";
  const CELEBRES = {
    // Volontairement mélangés par genre (action, horreur, comédie, animation, drame, SF...) pour que les premiers choix couvrent tout
    film: ["Inception", "The Conjuring", "Superbad", "Spider-Man: Into the Spider-Verse", "The Dark Knight", "La La Land", "Get Out", "Interstellar",
      "The Hangover", "Your Name", "John Wick", "Titanic", "Parasite", "Shrek", "Mad Max: Fury Road", "Hereditary", "The Wolf of Wall Street",
      "Spirited Away", "Gladiator", "The Notebook", "Dune", "It", "Deadpool", "Coco", "Joker", "A Quiet Place", "Pulp Fiction", "Toy Story 3",
      "The Matrix", "Whiplash", "Fast & Furious 7", "Intouchables", "Avengers: Endgame", "Mean Girls", "Oppenheimer", "Harry Potter and the Philosopher's Stone",
      "Top Gun: Maverick", "Knives Out", "Everything Everywhere All at Once", "The Lord of the Rings: The Fellowship of the Ring"],
    serie: ["Breaking Bad", "Stranger Things", "The Office", "Attack on Titan", "Game of Thrones", "Friends", "The Haunting of Hill House",
      "Squid Game", "Brooklyn Nine-Nine", "Arcane", "Peaky Blinders", "Bridgerton", "The Walking Dead", "Rick and Morty", "Money Heist",
      "The Witcher", "Sex Education", "Dark", "One Piece", "The Boys", "Modern Family", "Sherlock", "Grey's Anatomy", "Chernobyl",
      "Death Note", "Wednesday", "How I Met Your Mother", "Narcos", "The Last of Us", "Lupin", "Black Mirror", "The Simpsons",
      "Euphoria", "Prison Break", "The Mandalorian", "Demon Slayer: Kimetsu no Yaiba", "Succession", "Kaamelott", "True Detective", "Severance"],
    jeu: ["Red Dead Redemption 2", "Stardew Valley", "ELDEN RING", "It Takes Two", "Resident Evil 4", "Hades", "The Witcher 3: Wild Hunt — Remastered",
      "Portal 2", "Counter-Strike 2", "Hollow Knight", "Baldur's Gate 3", "Phasmophobia", "Rocket League", "Cyberpunk 2077", "Terraria",
      "Grand Theft Auto V Legacy", "Celeste", "Forza Horizon 5", "Dead by Daylight", "God of War", "Sekiro: Shadows Die Twice - GOTY Edition",
      "Cities: Skylines", "Lethal Company", "Hogwarts Legacy", "DOOM Eternal", "Among Us", "Disco Elysium - The Final Cut", "Euro Truck Simulator 2",
      "Ghost of Tsushima DIRECTOR'S CUT", "Outer Wilds", "Sid Meier's Civilization VI", "Left 4 Dead 2", "Valheim", "Inscryption", "Dead Cells",
      "Minecraft Dungeons", "Half-Life: Alyx", "Persona 5 Royal", "Subnautica", "Monster Hunter: World"],
  };
  let CAT, INDEX, PAR_IMDB, VEC;

  const simple = t => (t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const trouver = (dom, titre) => INDEX.get(dom + "|" + simple(titre));

  async function charger() {
    CAT = await (await fetch("catalogue.json")).json();
    INDEX = new Map(); PAR_IMDB = new Map();
    for (const it of Object.values(CAT).sort((a, b) => a.qualite - b.qualite)) {
      INDEX.set(it.dom + "|" + simple(it.titre), it.id); INDEX.set(it.dom + "|" + simple(it.titre_en), it.id);
      if (it.imdb) PAR_IMDB.set(it.imdb, it.id);
    }
    // Poids des thèmes : un thème présent partout compte moins qu'un thème rare
    const compte = {};
    for (const it of Object.values(CAT)) for (const th of it.themes) compte[th] = (compte[th] || 0) + 1;
    const n = Object.keys(CAT).length;
    VEC = {};
    for (const [i, it] of Object.entries(CAT)) {
      const v = {}; let s = 0;
      for (const th of it.themes) { v[th] = Math.log(n / compte[th]); s += v[th] ** 2; }
      s = Math.sqrt(s) || 1; for (const th in v) v[th] /= s;
      VEC[i] = v;
    }
  }

  function profil() {
    try { return JSON.parse(localStorage.getItem(CLE)) || {notes: {}}; } catch { return {notes: {}}; }
  }
  // Prévient compte.js (synchro du compte, s'il est connecté) à chaque changement
  function sauver(p) { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch {} dispatchEvent(new CustomEvent("profil-change")); }

  function classer(poids, cible, deja) {
    const prof = {};
    for (const [i, x] of Object.entries(poids)) for (const [th, v] of Object.entries(VEC[i])) prof[th] = (prof[th] || 0) + x * v;
    const norme = Math.hypot(...Object.values(prof));
    if (!norme) return [[], prof];
    const res = [];
    for (const [i, it] of Object.entries(CAT)) {
      if (it.dom !== cible || deja.has(i)) continue;
      let sim = 0; for (const [th, x] of Object.entries(VEC[i])) sim += (prof[th] || 0) * x;
      sim /= norme;
      const a = it.annee || (it.dom === "jeu" && it.steam > 500000 ? 2016 : 2008);
      let recence = a >= 2015 ? 1 : a >= 2005 ? 0.85 : 0.7;
      if (it.qualite > 0.9) recence = Math.max(recence, 0.95);  // grands classiques gardés
      res.push([sim * (0.35 + 0.65 * it.qualite) * recence, i, sim]);
    }
    res.sort((a, b) => b[0] - a[0]);
    return [res, prof];
  }

  function recos(p, cible, sources, n = 12) {
    const poids = {};
    for (const [i, note] of Object.entries(p.notes)) if (CAT[i] && NOTES[note] && sources.includes(CAT[i].dom)) poids[i] = NOTES[note];
    const [res, prof] = classer(poids, cible, new Set(Object.keys(p.notes)));
    const dot = (a, b) => Object.entries(VEC[a]).reduce((s, [th, x]) => s + (VEC[b][th] || 0) * x, 0);
    // Un seul profil additionné laisse un titre aux thèmes rares tout écraser (un Disney => que du Disney).
    // Chaque titre aimé a donc sa propre liste, et on pioche à tour de rôle (les « adoré » et les plus récents d'abord).
    const ok = res.filter(r => r[2] > 0.15);
    const qual = new Map(ok.map(([s, i, sim]) => [i, s / sim]));
    const ancres = Object.keys(poids).filter(j => poids[j] > 0).reverse().sort((a, b) => poids[b] - poids[a]).slice(0, 15);
    const listes = ancres.map(j => ok.map(([, i]) => [dot(i, j) * qual.get(i), i]).filter(([s]) => s > 0.12).sort((a, b) => b[0] - a[0]).map(([, i]) => i));
    const choix = [], pris = new Set();
    for (let tour = 0; choix.length < n && listes.some(l => l.length); tour++)
      for (const l of listes) {
        while (l.length && pris.has(l[0])) l.shift();
        if (l.length && choix.length < n) { const i = l.shift(); pris.add(i); choix.push(ok.find(r => r[1] === i)); }
      }
    return choix.map(([, i, sim]) => {
      const it = CAT[i];
      const pourquoi = Object.keys(poids).filter(j => poids[j] > 0).map(j => [dot(i, j), j]).sort((a, b) => b[0] - a[0]).slice(0, 2);
      const communs = Object.keys(VEC[i]).sort((a, b) => (prof[b] || 0) * VEC[i][b] - (prof[a] || 0) * VEC[i][a]).slice(0, 3);
      return {id: i, dom: it.dom, titre: it.titre, annee: it.annee, image: it.image, avis: it.avis, steam: it.steam, wiki: it.wiki,
        themes: communs.filter(t => (prof[t] || 0) > 0), parce_que: pourquoi.filter(([s]) => s > 0).map(([, j]) => CAT[j].titre), match: Math.round(Math.max(sim, pourquoi[0]?.[0] || 0) * 100)};
    });
  }

  // ---------- Imports CSV ----------
  function lireCsv(texte) {
    const lignes = []; let ligne = [], champ = "", guill = false;
    texte = texte.replace(/^﻿/, "");
    for (let k = 0; k < texte.length; k++) {
      const c = texte[k];
      if (guill) { if (c === '"') { if (texte[k + 1] === '"') { champ += '"'; k++; } else guill = false; } else champ += c; }
      else if (c === '"') guill = true;
      else if (c === ",") { ligne.push(champ); champ = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && texte[k + 1] === "\n") k++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
      else champ += c;
    }
    if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    const [tete, ...corps] = lignes.filter(l => l.some(x => x.trim()));
    return tete ? corps.map(l => Object.fromEntries(tete.map((h, k) => [h.trim(), (l[k] || "").trim()]))) : [];
  }

  const SAISON = /\b(season|saison|temporada|staffel|stagione|part|partie|parte|teil|chapter|chapitre|episode|épisode|limited series|mini-?série|volume|vol\.|book|livre|collection)\b/i;

  function lireExport(texte) {
    const rows = lireCsv(texte);
    if (!rows.length) throw new Error("Fichier vide ou pas au format CSV.");
    const cols = new Set(Object.keys(rows[0]));
    const a = (...c) => c.every(x => cols.has(x));
    if (a("Const", "Your Rating")) return ["IMDb", rows.map(r => {
      const n = +r["Your Rating"], t = (r["Title Type"] || "").toLowerCase();
      return [r.Title, r.Const, n >= 9 ? "adore" : n >= 7 ? "aime" : n >= 5 ? "vu" : n >= 3 ? "bof" : "deteste",
        t.includes("game") ? "jeu" : t.includes("series") ? "serie" : t.includes("movie") ? "film" : null];
    })];
    if (a("Name", "Letterboxd URI")) return ["Letterboxd", rows.map(r => {
      const n = +r.Rating;
      return [r.Name, null, !r.Rating ? "regarde" : n >= 4.5 ? "adore" : n >= 3.5 ? "aime" : n >= 2.5 ? "vu" : n >= 1.5 ? "bof" : "deteste", "film"];
    })];
    if (a("Title Name", "Thumbs Value")) return ["Netflix (notes)", rows.filter(r => ({1: 1, 2: 1, 3: 1})[r["Thumbs Value"]])
      .map(r => [r["Title Name"], null, {1: "bof", 2: "aime", 3: "adore"}[r["Thumbs Value"]], null])];
    if (a("Title", "Date") && cols.size === 2) {
      const ep = {}, films = new Set();
      for (const r of rows) {
        const parts = r.Title.split(/\s?:\s/).map(x => x.trim()).filter(Boolean);
        if (parts.length >= 3 || (parts.length === 2 && SAISON.test(parts[1]))) ep[parts[0]] = (ep[parts[0]] || 0) + 1;
        else if (parts.length) films.add(r.Title);
      }
      // Une série dont on a vu 3 épisodes ou plus, on l'a sans doute aimée
      return ["Netflix", [...[...films].map(t => [t, null, "regarde", null]), ...Object.entries(ep).map(([t, n]) => [t, null, n >= 3 ? "aime" : "regarde", "serie"])]];
    }
    const col = Object.keys(rows[0]).find(c => ["title", "titre", "name", "nom", "title name", "video title"].includes(c.toLowerCase()));
    if (col) return ["CSV", rows.filter(r => r[col]).map(r => [r[col], null, "regarde", null])];
    throw new Error("Format non reconnu : il faut un export Netflix, IMDb, Letterboxd ou un CSV avec une colonne Title.");
  }

  // ---------- API identique à celle du serveur local ----------
  return {
    charger,
    recos() {
      const p = profil(), ecrans = ["film", "serie"];
      return {
        film: [["D'après tes films et séries", recos(p, "film", ecrans)], ["D'après tes jeux", recos(p, "film", ["jeu"], 8)]],
        serie: [["D'après tes films et séries", recos(p, "serie", ecrans)], ["D'après tes jeux", recos(p, "serie", ["jeu"], 8)]],
        jeu: [["D'après tes jeux", recos(p, "jeu", ["jeu"])], ["D'après tes films et séries", recos(p, "jeu", ecrans, 8)]],
      };
    },
    gouts() {
      return Object.entries(profil().notes).filter(([i]) => CAT[i]).map(([i, note]) => ({id: i, dom: CAT[i].dom, titre: CAT[i].titre, annee: CAT[i].annee, image: CAT[i].image, note}))
        .sort((a, b) => (a.dom + a.titre).localeCompare(b.dom + b.titre));
    },
    cherche(q) {
      q = simple(q); if (q.length < 2) return [];
      return Object.values(CAT).filter(it => simple(it.titre).includes(q) || simple(it.titre_en).includes(q))
        .sort((a, b) => (simple(a.titre).startsWith(q) ? 0 : 1) - (simple(b.titre).startsWith(q) ? 0 : 1) || b.qualite - a.qualite)
        .slice(0, 20).map(it => ({id: it.id, dom: it.dom, titre: it.titre, annee: it.annee, image: it.image}));
    },
    // Titres les plus acclamés d'un domaine, pour qu'un nouveau visiteur note quelques titres d'entrée
    // Titres très connus d'abord (choisis à la main), complétés par les mieux notés du catalogue
    populaires(dom, n = 18) {
      const notes = profil().notes;
      const connus = (CELEBRES[dom] || []).map(t => trouver(dom, t)).filter(Boolean).map(i => CAT[i]);
      const reste = Object.values(CAT).filter(it => it.dom === dom && it.image && (it.annee || 0) >= 2008).sort((a, b) => b.qualite - a.qualite);
      return [...new Set([...connus, ...reste])].filter(it => it.image && !notes[it.id]).slice(0, n)
        .map(it => ({id: it.id, dom: it.dom, titre: it.titre, annee: it.annee, image: it.image, steam: it.steam}));
    },
    noter(id, note) {
      const p = profil(); if (!CAT[id]) return;
      delete p.notes[id]; if (note in NOTES) p.notes[id] = note; sauver(p);
    },
    importer(texte) {
      const p = profil(); const [source, lignes] = lireExport(texte); let reconnus = 0, inconnus = 0;
      for (const [titre, imdb, note, dom] of lignes) {
        let i = imdb && PAR_IMDB.get(imdb);
        if (!i) for (const d of dom ? [dom] : ["film", "serie"]) if ((i = trouver(d, titre))) break;
        if (!i) { inconnus++; continue; }
        const avant = p.notes[i];
        if (!avant || (NOTES[note] > NOTES[avant] && (avant === "regarde" || avant === "vu"))) { p.notes[i] = note; reconnus++; }
      }
      sauver(p); return {source, reconnus, inconnus};
    },
    exporter: () => JSON.stringify(profil(), null, 1),
    restaurer(texte) { const p = JSON.parse(texte); if (!p || typeof p.notes !== "object") throw new Error("Fichier de profil invalide."); sauver({notes: p.notes}); },
    vider() { sauver({notes: {}}); },
  };
})();
