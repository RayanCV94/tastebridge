# Recommandations films, séries et jeux par ressemblance de thèmes, en local.
# Lancé à la demande ; s'arrête tout seul quand la page est fermée.
import json, math, os, re, sys, threading, time, webbrowser, unicodedata
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ICI = Path(__file__).parent
DONNEES = ICI / "donnees"  # tout ce qui est personnel est ici (jamais publié, voir .gitignore)
DONNEES.mkdir(exist_ok=True)
if sys.stdout is None:  # lancé masqué (pythonw) : les erreurs vont dans donnees/erreurs.log
    sys.stdout = sys.stderr = open(DONNEES / "erreurs.log", "a", encoding="utf-8", buffering=1)

import requests
import imports
import notes

PORT = 5077
HOTES = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
PROFIL = DONNEES / "profil.json"
CONFIG = json.loads((DONNEES / "config.json").read_text(encoding="utf-8")) if (DONNEES / "config.json").exists() else {}
NOTES = {"adore": 2.0, "aime": 1.0, "regarde": 0.5, "vu": 0.0, "bof": -1.0, "deteste": -2.0}

CAT = notes.ajouter_imdb(json.loads((ICI / "catalogue.json").read_text(encoding="utf-8")))  # IMDb : usage personnel, donc ici
NOTES_EXT = ("imdb", "note_imdb", "votes_imdb", "metacritic", "rt")
verrou = threading.Lock()
dernier_ping = time.time()


def simple(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


INDEX, PAR_IMDB = {}, {}
for it in sorted(CAT.values(), key=lambda i: i["qualite"]):
    for t in {simple(it["titre"]), simple(it["titre_en"])}:
        INDEX[(it["dom"], t)] = it["id"]
    if it.get("imdb"):
        PAR_IMDB[it["imdb"]] = it["id"]


def trouver(dom, titre):
    return INDEX.get((dom, simple(titre)))


# Poids des thèmes : un thème présent partout (Action) compte moins qu'un thème rare (Western)
_compte = {}
for it in CAT.values():
    for th in it["themes"]:
        _compte[th] = _compte.get(th, 0) + 1
IDF = {th: math.log(len(CAT) / n) for th, n in _compte.items()}


def vecteur(it):
    v = {th: IDF[th] for th in it["themes"]}
    n = math.sqrt(sum(x * x for x in v.values())) or 1
    return {k: x / n for k, x in v.items()}


VEC = {i: vecteur(it) for i, it in CAT.items()}


# ---------- Profil ----------
def charger_profil():
    if PROFIL.exists():
        return json.loads(PROFIL.read_text(encoding="utf-8"))
    p = {"notes": {}, "exclus": {}}
    graines = DONNEES / "graines.json"  # goûts de départ facultatifs : {"film": {"aime": ["Titre", ...]}, ...}
    if graines.exists():
        for dom, notes in json.loads(graines.read_text(encoding="utf-8")).items():
            for note, titres in notes.items():
                for t in titres:
                    i = trouver(dom, t)
                    if i:
                        p["notes"][i] = note
    sauver(p)
    return p


def sauver(p):
    tmp = PROFIL.with_suffix(".tmp")
    tmp.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(PROFIL)


def exclus_auto():
    """Ce que tu as déjà : jeux Steam de ce PC, bibliothèque Jellyfin et liste Excel si configurées."""
    ex, joues = set(), {}
    for appid, minutes in imports.steam_local():
        if f"steam{appid}" in CAT:
            ex.add(f"steam{appid}")
            joues[f"steam{appid}"] = minutes / 60
    jf = CONFIG.get("jellyfin")
    if jf:
        try:
            for nom, imdb in imports.jellyfin(jf["url"], jf["cle"], jf.get("utilisateur")):
                i = PAR_IMDB.get(imdb) or trouver("film", nom) or trouver("serie", nom)
                if i:
                    ex.add(i)
        except Exception as e:
            print("Jellyfin ignoré :", e)
    for liste in CONFIG.get("listes_jeux_possedes", []):
        try:
            for nom in imports.excel(liste["fichier"], liste["feuille"], liste.get("colonne", 2)):
                i = trouver("jeu", re.sub(r"\s*\(.*?\)|\s*[—-]\s*Director's Cut|\s*GOTY", "", nom))
                if i:
                    ex.add(i)
        except Exception as e:
            print("Liste Excel ignorée :", e)
    return ex, joues


EXCLUS_AUTO, HEURES = exclus_auto()


# ---------- Moteur ----------
def poids_profil(p):
    return {i: NOTES[n] for i, n in p["notes"].items() if i in CAT and NOTES.get(n)}


def classer(poids, cible, deja):
    """Tous les candidats du domaine cible, du plus au moins recommandé : [(score, id, similarité)]."""
    prof = {}
    for i, x in poids.items():
        for th, v in VEC[i].items():
            prof[th] = prof.get(th, 0) + x * v
    norme = math.sqrt(sum(v * v for v in prof.values()))
    if not norme:
        return [], prof
    res = []
    for i, it in CAT.items():
        if it["dom"] != cible or i in deja:
            continue
        sim = sum(prof.get(th, 0) * x for th, x in VEC[i].items()) / norme
        a = it.get("annee") or (2016 if it["dom"] == "jeu" and it.get("steam", 0) > 500000 else 2008)
        recence = 1.0 if a >= 2015 else 0.85 if a >= 2005 else 0.7
        if it["qualite"] > 0.9:
            recence = max(recence, 0.95)  # grands classiques gardés
        res.append((sim * (0.35 + 0.65 * it["qualite"]) * recence, i, sim))
    res.sort(reverse=True)
    return res, prof


def recos(p, cible, sources, n=12):
    poids = {i: x for i, x in poids_profil(p).items() if CAT[i]["dom"] in sources}
    res, prof = classer(poids, cible, set(p["notes"]) | set(p["exclus"]) | EXCLUS_AUTO)
    dot = lambda a, b: sum(VEC[b].get(th, 0) * x for th, x in VEC[a].items())
    # Un seul profil additionné laisse un titre aux thèmes rares tout écraser (un Disney => que du Disney).
    # Chaque titre aimé a donc sa propre liste, et on pioche à tour de rôle (les « adoré » et les plus récents d'abord).
    ok = [r for r in res if r[2] > 0.15]
    qual = {i: s / sim for s, i, sim in ok}
    ancres = sorted([j for j, w in reversed(list(poids.items())) if w > 0], key=lambda j: -poids[j])[:15]
    listes = [[i for s, i in sorted(((dot(i, j) * qual[i], i) for _, i, _ in ok), reverse=True) if s > 0.12] for j in ancres]
    par_id = {r[1]: r for r in ok}
    choix, pris = [], set()
    while len(choix) < n and any(listes):
        for l in listes:
            while l and l[0] in pris:
                l.pop(0)
            if l and len(choix) < n:
                i = l.pop(0)
                pris.add(i)
                choix.append(par_id[i])
    sortie = []
    for score, i, sim in choix:
        it = CAT[i]
        pourquoi = sorted(((dot(i, j), j) for j, w in poids.items() if w > 0), reverse=True)[:2]
        communs = sorted(VEC[i], key=lambda th: -prof.get(th, 0) * VEC[i][th])[:3]
        sortie.append({**{k: it.get(k) for k in ("id", "dom", "titre", "annee", "image", "avis", "steam", "wiki") + NOTES_EXT},
                       "themes": [t for t in communs if prof.get(t, 0) > 0],
                       "parce_que": [CAT[j]["titre"] for s, j in pourquoi if s > 0],
                       "match": round(max(sim, pourquoi[0][0] if pourquoi else 0) * 100)})
    return sortie


def tout(p):
    ecrans = ["film", "serie"]
    return {
        "film": [["D'après tes films et séries", recos(p, "film", ecrans)], ["D'après tes jeux", recos(p, "film", ["jeu"], 8)]],
        "serie": [["D'après tes films et séries", recos(p, "serie", ecrans)], ["D'après tes jeux", recos(p, "serie", ["jeu"], 8)]],
        "jeu": [["D'après tes jeux", recos(p, "jeu", ["jeu"])], ["D'après tes films et séries", recos(p, "jeu", ecrans, 8)]],
    }


def mes_gouts(p):
    out = []
    for i, n in p["notes"].items():
        if i in CAT:
            it = CAT[i]
            out.append({"id": i, "dom": it["dom"], "titre": it["titre"], "annee": it.get("annee"), "image": it.get("image"), "note": n})
    for i, h in HEURES.items():
        if i not in p["notes"] and h >= 15:
            it = CAT[i]
            out.append({"id": i, "dom": "jeu", "titre": it["titre"], "annee": it.get("annee"), "image": it.get("image"),
                        "note": "", "heures": round(h)})
    return sorted(out, key=lambda x: (x["dom"], x["titre"]))


TONS = ("Animation, famille", "Sombre, adulte")


def dot(a, b):
    return sum(VEC[b].get(th, 0) * x for th, x in VEC[a].items())


def court(it, **plus):
    return {**{k: it.get(k) for k in ("id", "dom", "titre", "annee", "image", "avis", "steam", "wiki") + NOTES_EXT}, **plus}


def proches(id_):
    # Fiche : les titres les plus proches (même similarité cosinus que les recos), du même support d'abord
    res = {"film": [], "serie": [], "jeu": []}
    for i, it in CAT.items():
        if i == id_ or not it.get("image"):
            continue
        sim = dot(id_, i)
        if sim < 0.3:
            continue
        ton = 0.4 if any((t in VEC[i]) != (t in VEC[id_]) for t in TONS) else 1
        res[it["dom"]].append((sim * (0.35 + 0.65 * it["qualite"]) * ton, i, sim))
    dom0, out = CAT[id_]["dom"], []
    for d in sorted(res, key=lambda d: d != dom0):
        for _, i, sim in sorted(res[d], reverse=True)[:6 if d == dom0 else 3]:
            communs = sorted((th for th in VEC[i] if th in VEC[id_]), key=lambda th: -VEC[id_][th] * VEC[i][th])[:3]
            out.append(court(CAT[i], themes=CAT[i]["themes"][:3], parce_que=[], match=round(sim * 100), communs=communs))
    return out


def pour_toi(p, id_):
    # Fiche : d'où vient le pourcentage (même calcul que les recos), ou None sans titre aimé
    poids = {i: w for i, w in poids_profil(p).items() if i != id_}
    aimes = [j for j, w in poids.items() if w > 0]
    if not aimes:
        return None
    prof = {}
    for i, x in poids.items():
        for th, v in VEC[i].items():
            prof[th] = prof.get(th, 0) + x * v
    norme = math.sqrt(sum(x * x for x in prof.values())) or 1
    sim = sum(prof.get(th, 0) * x for th, x in VEC[id_].items()) / norme
    pourquoi = [(s, j) for s, j in sorted(((dot(id_, j), j) for j in aimes), reverse=True)[:2] if s > 0]
    return {"match": round(max(sim, pourquoi[0][0] if pourquoi else 0) * 100),
            "parce_que": [{"id": j, "dom": CAT[j]["dom"], "titre": CAT[j]["titre"], "sim": round(s * 100)} for s, j in pourquoi],
            "communs": sorted((th for th in VEC[id_] if prof.get(th, 0) > 0), key=lambda th: -prof[th] * VEC[id_][th])[:3]}


def fiche(p, id_):
    if id_ not in CAT:
        return None
    return {**CAT[id_], "note": p["notes"].get(id_, ""), "similaires": proches(id_), "pour_toi": pour_toi(p, id_)}


def liste(themes, annee):
    l = sorted((it for it in CAT.values() if it.get("image") and all(t in it["themes"] for t in themes)
                and (not annee or it.get("annee") == annee)), key=lambda it: -it["qualite"])
    return {"total": len(l), "titres": [court(it, themes=it["themes"][:3], parce_que=[]) for it in l[:60]]}


def chercher(q):
    q = simple(q)
    if len(q) < 2:
        return []
    r = [it for it in CAT.values() if q in simple(it["titre"]) or q in simple(it["titre_en"])]
    r.sort(key=lambda it: (not simple(it["titre"]).startswith(q), -it["qualite"]))
    return [{k: it.get(k) for k in ("id", "dom", "titre", "annee", "image") + NOTES_EXT} for it in r[:20]]


def importer(p, nom_fichier, texte):
    """Ajoute à ton profil un export Netflix, Prime Video, IMDb ou Letterboxd. Ne remplace jamais une note donnée à la main."""
    source, lignes = imports.lire_export(nom_fichier, texte)
    ajoutes, inconnus = 0, 0
    for titre, imdb, annee, note, dom in lignes:
        i = PAR_IMDB.get(imdb) if imdb else None
        if not i:
            doms = [dom] if dom else ["film", "serie"]
            i = next((trouver(d, titre) for d in doms if trouver(d, titre)), None)
        if not i:
            inconnus += 1
            continue
        if i not in p["notes"] or NOTES.get(note, 0) > NOTES.get(p["notes"][i], 0) and p["notes"][i] in ("regarde", "vu"):
            p["notes"][i] = note
            ajoutes += 1
    sauver(p)
    return {"source": source, "reconnus": ajoutes, "inconnus": inconnus}


# ---------- Serveur ----------
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def autorise(self, ecriture=False):
        # Refuse ce qui ne vient pas de la page elle-même : un autre site ouvert dans le navigateur
        # ne peut ni lire tes goûts (Host vérifié, contre le DNS rebinding) ni les modifier (en-tête maison obligatoire).
        if self.headers.get("Host") not in HOTES:
            return False
        origine = self.headers.get("Origin")
        if origine and urlparse(origine).netloc not in HOTES:
            return False
        return not ecriture or self.headers.get("X-Recos") == "1"

    def envoyer(self, corps, type_="application/json", code=200):
        b = corps if isinstance(corps, bytes) else json.dumps(corps, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", type_ + "; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        global dernier_ping
        if not self.autorise():
            return self.envoyer({"erreur": "refusé"}, code=403)
        dernier_ping = time.time()
        u = urlparse(self.path)
        with verrou:
            p = charger_profil()
        if u.path == "/":
            self.envoyer((ICI / "page.html").read_bytes(), "text/html")
        elif u.path == "/api/recos":
            self.envoyer(tout(p))
        elif u.path == "/api/gouts":
            self.envoyer(mes_gouts(p))
        elif u.path == "/api/cherche":
            self.envoyer(chercher(parse_qs(u.query).get("q", [""])[0]))
        elif u.path == "/api/fiche":
            self.envoyer(fiche(p, parse_qs(u.query).get("id", [""])[0]))
        elif u.path == "/api/liste":
            q = parse_qs(u.query)
            annee = q.get("annee", [""])[0]
            self.envoyer(liste([t for t in q.get("themes", [""])[0].split("|") if t], int(annee) if annee.isdigit() else None))
        elif u.path == "/api/ping":
            self.envoyer({"ok": True})
        else:
            self.send_error(404)

    def do_POST(self):
        global dernier_ping
        if not self.autorise(ecriture=True):
            return self.envoyer({"erreur": "refusé"}, code=403)
        dernier_ping = time.time()
        taille = int(self.headers.get("Content-Length", 0))
        if taille > 30_000_000:
            return self.envoyer({"erreur": "fichier trop gros"}, code=413)
        d = json.loads(self.rfile.read(taille) or "{}")
        with verrou:
            p = charger_profil()
            if self.path == "/api/import":
                try:
                    return self.envoyer(importer(p, d.get("nom", ""), d.get("texte", "")))
                except ValueError as e:
                    return self.envoyer({"erreur": str(e)}, code=400)
            i, n = d.get("id"), d.get("note")
            if i in CAT:
                p["notes"].pop(i, None)
                p["exclus"].pop(i, None)
                if n in NOTES:
                    p["notes"][i] = n
                sauver(p)
        self.envoyer({"ok": True})


def surveiller(srv):
    # Plus aucune page ouverte depuis 3 min (onglet en arrière-plan = 1 ping par minute) : on s'arrête, rien ne reste en fond
    while True:
        time.sleep(5)
        if time.time() - dernier_ping > 180:
            srv.shutdown()
            return


if __name__ == "__main__":
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    except OSError:
        webbrowser.open(f"http://127.0.0.1:{PORT}")  # déjà lancé : on rouvre juste la page
        raise SystemExit
    threading.Thread(target=surveiller, args=(srv,), daemon=True).start()
    if not os.environ.get("RECOS_SANS_NAVIGATEUR"):
        webbrowser.open(f"http://127.0.0.1:{PORT}")
    srv.serve_forever()
