// Tests du moteur du site (moteur.js) sur le catalogue compact de docs/. Lancer : node --test tests/
// Aucune dépendance : moteur.js est chargé dans un bac à sable avec un faux navigateur.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ICI = path.join(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(ICI, "catalogue.json"), "utf8"));

async function moteur(langue = "fr") {
  const stockage = new Map([["tastebridge-langue", langue]]);
  const bac = {
    fetch: async () => ({json: async () => JSON.parse(fs.readFileSync(path.join(ICI, "docs", "catalogue.json"), "utf8"))}),
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

test("site en anglais : titre anglais affiché", async () => {
  const M = await moteur("en");
  assert.equal(M.fiche("Q62730").titre, "Das Boot");
});
