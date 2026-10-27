// Tests du moteur du site (moteur.js) sur le catalogue compact de docs/. Lancer : node --test tests/
// Aucune dépendance : moteur.js est chargé dans un bac à sable avec un faux navigateur.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ICI = path.join(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(ICI, "catalogue.json"), "utf8"));

async function moteur(langue = "fr", services = []) {
  const stockage = new Map([["tastebridge-langue", langue], ["tastebridge-services", JSON.stringify(services)]]);
  const bac = {
    fetch: async url => ({ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ICI, "docs", url.split("?")[0]), "utf8"))}),
    localStorage: {getItem: k => stockage.get(k) ?? null, setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k)},
    navigator: {language: "fr-FR"}, dispatchEvent() {}, CustomEvent: class {},
  };
  vm.createContext(bac);
  vm.runInContext(fs.readFileSync(path.join(ICI, "moteur.js"), "utf8") + "\nthis.Moteur = Moteur;", bac);
  await bac.Moteur.charger();
  return bac.Moteur;
}

test("le catalogue compact se déplie à l'identique (champs utiles)", async () => {
  const M = await moteur();
  for (const id of ["Q62730", "Q163872", "steam2358720"]) {
    const f = M.fiche(id), s = source[id];
    for (const k of ["dom", "titre", "titre_en", "annee", "themes", "wiki", "imdb", "steam", "avis", "metacritic", "rt"])
      assert.deepEqual(f[k] ?? null, s[k] ?? null, `${id}.${k}`);
    assert.equal(f.image, s.image.split("?utm_source=")[0]);
    assert.ok(Math.abs(f.qualite - s.qualite) < 1e-4);
  }
});

test("notes IMDb jamais publiées par défaut", async () => {
  const brut = fs.readFileSync(path.join(ICI, "docs", "catalogue.json"), "utf8");
  const M = await moteur();
  assert.equal(M.fiche("Q62730").note_imdb, undefined);
  assert.ok(brut.length > 1e6);
});

test("recos : raisons en {id, titre}, jamais un titre déjà noté", async () => {
  const M = await moteur();
  M.noter("Q62730", "adore"); M.noter("Q185888", "aime");
  const film = M.recos().film[0][1];
  assert.ok(film.length > 0);
  for (const r of film) {
    assert.ok(!["Q62730", "Q185888"].includes(r.id));
    for (const p of r.parce_que) assert.ok(["Q62730", "Q185888"].includes(p.id) && p.titre);
  }
  const h = M.hasard("tout", []);
  assert.ok(h && h.parce_que.every(p => p.id && p.titre));
});

test("fiche : proches du même support d'abord, explication du score", async () => {
  const M = await moteur();
  const f = M.fiche("Q163872");
  const doms = f.similaires.map(x => x.dom);
  assert.ok(doms.length > 0 && doms.length <= 12);
  assert.deepEqual(doms.slice(0, doms.filter(d => d === "film").length), doms.filter(d => d === "film"));
  assert.equal(f.pour_toi, null);
  M.noter("Q62730", "adore");
  assert.ok(M.fiche("Q163872").pour_toi.match >= 0);
  assert.equal(M.fiche("Q_INEXISTANT"), null);
});

test("listes et recherche", async () => {
  const M = await moteur();
  const l = M.liste({themes: ["Western"]});
  assert.ok(l.total > 0 && l.titres.length <= 60);
  assert.equal(M.cherche("das boot")[0].id, "Q62730");
  assert.equal(M.cherche("le bateau")[0].id, "Q62730");
});

test("tri des listes : récents, note critique (sans note = après, jamais inventée)", async () => {
  const M = await moteur();
  const ans = Array.from(M.liste({themes: ["Western"], tri: "recents"}).titres, r => r.annee || 0);
  const sortis = ans.filter(a => a && a <= new Date().getFullYear());
  assert.deepEqual(ans.slice(0, sortis.length), [...sortis].sort((a, b) => b - a));  // les titres à venir passent après
  const notes = Array.from(M.liste({themes: ["Western"], tri: "critique"}).titres)
    .map(r => r.metacritic ?? r.rt ?? (r.avis ? parseInt(r.avis) : null));
  const avec = notes.filter(n => n != null);
  assert.ok(avec.length > 0);
  assert.deepEqual(notes.slice(0, avec.length), [...avec].sort((a, b) => b - a));  // les notés d'abord, puis les autres
  assert.equal(M.liste({themes: ["Western"], tri: "inconnu"}).total, M.liste({themes: ["Western"]}).total);
});

test("où jouer : plateformes Wikidata, « chez moi » selon mes services", async () => {
  const liste = a => Array.from(a);  // tableaux venus du bac à sable vm
  const M = await moteur();
  const w = M.fiche("steam2358720");
  assert.ok(w.plateformes.includes("PC"));
  assert.deepEqual(liste(M.chezMoi(w)), []);  // aucun service réglé
  const X = await moteur("fr", ["xbox"]);
  assert.deepEqual(liste(X.chezMoi({dom: "jeu", plateformes: ["Xbox Series"]})), ["xbox"]);
  assert.deepEqual(liste(X.chezMoi({dom: "jeu", boutiques: {ms: "x"}})), []);  // Microsoft Store = PC, pas forcément Xbox
  const N = await moteur("fr", ["netflix"]);
  assert.deepEqual(liste(N.chezMoi({dom: "film", dispo: {FR: {abo: ["Netflix"]}}})), ["netflix"]);
});

test("tendances : titres du bon support, jamais déjà notés", async () => {
  const M = await moteur();
  const t = JSON.parse(fs.readFileSync(path.join(ICI, "docs", "tendances.json"), "utf8"));
  const l = M.tendances("jeu");
  assert.ok(l.length > 0 && l.length <= 12);
  assert.ok(l.every(x => x.dom === "jeu" && x.tendance && t.jeu.some(([i]) => i === x.id)));
  M.noter(l[0].id, "aime");
  assert.ok(!M.tendances("jeu").some(x => x.id === l[0].id));
});

test("site en anglais : titre anglais affiché", async () => {
  const M = await moteur("en");
  assert.equal(M.fiche("Q62730").titre, "Das Boot");
});
