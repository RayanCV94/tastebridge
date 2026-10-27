// Parcours réel dans Chromium (Playwright) sur docs/ : accueil, notation, onglets, Retour, fiche, liens, listes.
// Lancer : npm test (ou node --test tests/e2e.test.js). Le reste des tests ne dépend pas de Playwright.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {chromium} = require("playwright");

const DOCS = path.join(__dirname, "..", "docs");
const TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg"};
let serveur, base, navigateur;

test.before(async () => {
  serveur = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
    const f = path.join(DOCS, p);
    if (!f.startsWith(DOCS) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, {"content-type": TYPES[path.extname(f)] || "application/octet-stream"}); r.end(fs.readFileSync(f));
  }).listen(0);
  base = `http://localhost:${serveur.address().port}/`;
  navigateur = await chromium.launch();
});
test.after(async () => { await navigateur?.close(); serveur?.close(); });

// Les ressources externes (affiches, Wikipédia, Supabase) sont coupées : le test ne dépend pas du réseau
async function page(opts = {}, langue = "fr") {
  const ctx = await navigateur.newContext({serviceWorkers: "block", ...opts});
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  const p = await ctx.newPage(), erreurs = [];
  p.on("pageerror", e => erreurs.push(e.message));
  await p.addInitScript(l => localStorage.setItem("tastebridge-langue", l), langue);
  return {p, erreurs};
}
async function noterCinq(p) {
  await p.goto(base); await p.waitForSelector(".pop-note");
  for (const b of (await p.$$(".pop-note")).slice(0, 5)) await b.click();
  await p.click("#voir"); await p.waitForSelector(".scene:not(.chargement)");
}

test("accueil, notation, onglets et Retour", async () => {
  const {p, erreurs} = await page();
  await p.goto(base); await p.waitForSelector(".pop-note");
  const pop = (await p.$$(".pop"))[0];
  await (await pop.$(".pop-note")).click();
  assert.equal(await pop.$eval(".pop-etat", e => e.textContent), "J'aime");
  await (await pop.$(".pop-note")).click();
  assert.equal(await pop.$eval(".pop-etat", e => e.textContent), "J'adore");
  for (const b of (await p.$$(".pop-note")).slice(1, 5)) await b.click();
  await p.click("#voir"); await p.waitForSelector(".scene:not(.chargement)");
  assert.equal(await p.evaluate(() => location.hash), "#/film");
  await p.click('nav button[data-o="serie"]'); await p.waitForSelector(".scene:not(.chargement)");
  await p.goBack(); await p.waitForSelector(".scene:not(.chargement)");
  assert.equal(await p.evaluate(() => location.hash), "#/film");
  assert.deepEqual(erreurs, []);
});

test("cartes : tout est lien, la raison est visible sans survol (tactile)", async () => {
  const {p, erreurs} = await page({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  await noterCinq(p);
  const c = await p.$(".grille .c");
  const liens = await c.$$eval("a", l => l.map(a => a.getAttribute("href")));
  assert.ok(liens.some(h => /^#\/film\/Q\d+$/.test(h)), "affiche et titre");
  assert.ok(liens.some(h => /\/score$/.test(h)), "badge %");
  assert.ok(liens.some(h => h.startsWith("#/annee/")) && liens.some(h => h.startsWith("#/theme/")));
  assert.equal(await c.$eval(".legende .pq", e => getComputedStyle(e).display), "block");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "pas de défilement horizontal");
  // Aucune icône d'action démesurée (régression : icône de « Fiche et avis » en taille naturelle)
  assert.ok(await c.$$eval(".mini-act svg", l => l.every(s => s.getBoundingClientRect().width <= 20)));
  assert.deepEqual(erreurs, []);
});

test("fiche : page entière, notation, Retour à la même position", async () => {
  const {p, erreurs} = await page();
  await noterCinq(p);
  await p.evaluate(() => scrollTo(0, 1200)); await p.waitForTimeout(200);
  const y = await p.evaluate(() => scrollY);
  await (await p.$$(".grille .c .legende .titre"))[2].click();
  await p.waitForSelector(".fiche-page");
  assert.match(await p.evaluate(() => location.hash), /^#\/film\/Q\d+$/);
  await p.click("#actions-fiche button:nth-child(2)");
  await p.waitForFunction(() => document.querySelector("#actions-fiche .etat").textContent.includes("Aimé"));
  assert.ok(await p.$$eval("#proches .c", l => l.length) > 0);
  await p.goBack(); await p.waitForSelector(".scene:not(.chargement)"); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => scrollY), y);
  assert.deepEqual(erreurs, []);
});

test("lien direct, titre inconnu, liste par thème", async () => {
  const {p, erreurs} = await page();
  await p.goto(base + "#/jeu/steam2358720"); await p.waitForSelector(".fiche-page");
  assert.match(await p.$eval("#notes", e => e.innerText), /positifs/);
  assert.match(await p.$eval("#ou", e => e.innerText), /Steam/);
  assert.ok(await p.$$eval("#ou a", l => l.some(a => a.href.startsWith("https://store.steampowered.com/app/2358720"))));
  await p.goto(base + "#/film/Q_INEXISTANT"); await p.waitForSelector(".vide");
  await p.goto(base + "#/theme/Western"); await p.waitForSelector("#main .c");
  assert.match(await p.$eval("#main .tete", e => e.innerText), /titres/);
  assert.deepEqual(erreurs, []);
});

test("mes services : un jeu Xbox ressort « chez toi »", async () => {
  const {p, erreurs} = await page();
  await p.goto(base + "#/gouts"); await p.waitForSelector(".services");
  await p.click('.services [data-k="xbox"]');
  await p.goto(base + "#/jeu/steam2358720"); await p.waitForSelector("#ou");
  assert.deepEqual(await p.$$eval("#ou .chip.mien", l => l.map(e => e.textContent)), ["Xbox Series"]);
  assert.deepEqual(erreurs, []);
});

test("listes mixtes : créer depuis une fiche, partager par lien, ouvrir ailleurs", async () => {
  const {p, erreurs} = await page();
  await p.goto(base + "#/film/Q62730"); await p.waitForSelector(".fiche-page");
  await p.click('[aria-controls="menu-liste"]');
  await p.fill('#menu-liste input[name="nom"]', "Automne <b>test</b>");
  await p.click("#menu-liste .bt.plein");
  await p.goto(base + "#/jeu/steam292030"); await p.waitForSelector(".fiche-page");
  await p.click('[aria-controls="menu-liste"]');
  await p.check("#menu-liste input[type=checkbox]");
  await p.goto(base + "#/listes"); await p.waitForSelector(".une-liste");
  assert.match(await p.$eval(".une-liste a", e => e.innerText), /Automne <b>test<\/b>\s+1 film, 1 jeu/);
  const lien = await p.$eval(".une-liste a", a => a.href);
  // Le lien s'ouvre ailleurs (autre navigateur, sans la liste en mémoire)
  const autre = await page();
  await autre.p.goto(lien); await autre.p.waitForSelector("#main .c");
  assert.equal(await autre.p.$eval("#main h3", e => e.textContent), "Automne <b>test</b>");  // texte, pas du HTML
  assert.equal(await autre.p.$$eval("#main .c", l => l.length), 2);
  assert.equal(await autre.p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await autre.p.$("#garder"));
  assert.deepEqual([...erreurs, ...autre.erreurs], []);
});

test("version anglaise : textes traduits", async () => {
  const {p, erreurs} = await page({}, "en");
  await noterCinq(p);
  assert.match(await p.$eval(".scene", e => e.innerText), /Because you liked/);
  assert.deepEqual(erreurs, []);
});
