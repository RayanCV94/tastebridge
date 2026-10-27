# Où regarder, où jouer : ajouté au catalogue au moment de la construction (aucun appel au runtime).
# - Jeux : plateformes et identifiants de boutiques (GOG, Epic, Microsoft Store, PlayStation Store, eShop)
#   depuis Wikidata (CC0), reliés par l'identifiant Steam.
# - Films et séries : identifiant TMDB depuis Wikidata. (Le « distribué par » de Wikidata n'est pas utilisé :
#   Netflix y figure pour 8 664 titres, dont des films de 1994 qu'il a seulement distribués dans certains pays.)
# - Films et séries, si une clé TMDB est fournie (variable TMDB_API_KEY) : offres d'abonnement, de location et
#   d'achat en France et aux États-Unis. Données JustWatch via TMDB : gratuites pour un projet non commercial,
#   avec mention de TMDB et de JustWatch (sinon licence TMDB nécessaire).
# À lancer après construire.py (qui l'appelle), ou seul : python disponibilites.py
import json, os, sys, time
from pathlib import Path

from notes import sparql

ICI = Path(__file__).parent

# Plateformes actuelles seulement (une PS3 ne dit pas où jouer aujourd'hui)
PLATEFORMES = {"Microsoft Windows": "PC", "macOS": "Mac", "Linux": "Linux", "PlayStation 5": "PS5", "PlayStation 4": "PS4",
               "Xbox Series X and Series S": "Xbox Series", "Xbox One": "Xbox One", "Nintendo Switch": "Switch",
               "Nintendo Switch 2": "Switch 2", "iOS": "iOS", "Android": "Android"}
BOUTIQUES = {"gog": "P2725", "ms": "P5885", "ps": "P5971", "epic": "P6278", "eshop": "P8084"}

REQ_JEUX = """SELECT ?steam ?pl %s WHERE { VALUES ?steam { %s } ?i wdt:P1733 ?steam.
 OPTIONAL { ?i wdt:P400 ?p. ?p rdfs:label ?pl FILTER(lang(?pl) = "en") } %s }"""
REQ_ECRANS = """SELECT ?i ?tf ?ts WHERE { VALUES ?i { %s } OPTIONAL { ?i wdt:P4947 ?tf } OPTIONAL { ?i wdt:P4983 ?ts } }"""


def jeux(cat):
    par_steam = {str(it["steam"]): it for it in cat.values() if it["dom"] == "jeu" and it.get("steam")}
    ids = list(par_steam)
    vars_ = " ".join(f"?{k}" for k in BOUTIQUES)
    opts = " ".join(f"OPTIONAL {{ ?i wdt:{p} ?{k} }}" for k, p in BOUTIQUES.items())
    for it in par_steam.values():
        it.pop("plateformes", None), it.pop("boutiques", None)
    for k in range(0, len(ids), 200):
        for b in sparql(REQ_JEUX % (vars_, " ".join(f'"{s}"' for s in ids[k:k + 200]), opts)):
            it = par_steam[b["steam"]["value"]]
            pl = PLATEFORMES.get(b.get("pl", {}).get("value"))
            if pl and pl not in it.setdefault("plateformes", []):
                it["plateformes"].append(pl)
            for cle in BOUTIQUES:
                v = b.get(cle, {}).get("value")
                # GOG : plusieurs fiches (jeu, extensions) : on garde celle du jeu
                if v and (cle != "gog" or v.startswith("game/")):
                    it.setdefault("boutiques", {}).setdefault(cle, v)
        print(f"  jeux {min(k + 200, len(ids))}/{len(ids)}")
    ordre = list(PLATEFORMES.values())
    for it in par_steam.values():
        if "plateformes" in it:
            it["plateformes"].sort(key=ordre.index)
    return sum("plateformes" in it or "boutiques" in it for it in par_steam.values())


def ecrans(cat):
    ids = [i for i, it in cat.items() if it["dom"] != "jeu" and i.startswith("Q")]
    for i in ids:
        cat[i].pop("tmdb", None)
    for k in range(0, len(ids), 300):
        for b in sparql(REQ_ECRANS % " ".join("wd:" + i for i in ids[k:k + 300])):
            it = cat[b["i"]["value"].rsplit("/", 1)[1]]
            t = b.get("tf" if it["dom"] == "film" else "ts", {}).get("value")
            if t and t.isdigit():
                it["tmdb"] = int(t)
        if k % 3000 == 0:
            print(f"  films et séries {k}/{len(ids)}")
    return sum("tmdb" in cat[i] for i in ids)


def tmdb(cat, cle, pays=("FR", "US")):
    # Offres par pays : abonnement (flatrate), gratuit/pub (free, ads), location (rent), achat (buy)
    import requests
    s = requests.Session()
    entete = {"Authorization": f"Bearer {cle}"} if len(cle) > 40 else {}
    params = {} if entete else {"api_key": cle}
    n = 0
    for it in cat.values():
        if not it.get("tmdb"):
            continue
        genre = "movie" if it["dom"] == "film" else "tv"
        for essai in range(3):
            r = s.get(f"https://api.themoviedb.org/3/{genre}/{it['tmdb']}/watch/providers", headers=entete, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(2 + essai * 3)
                continue
            break
        if not r.ok:
            continue
        res, dispo = r.json().get("results", {}), {}
        for p in pays:
            o = res.get(p, {})
            offres = {"abo": [x["provider_name"] for x in o.get("flatrate", []) + o.get("free", []) + o.get("ads", [])],
                      "loc": [x["provider_name"] for x in o.get("rent", [])], "achat": [x["provider_name"] for x in o.get("buy", [])]}
            offres = {k: list(dict.fromkeys(v)) for k, v in offres.items() if v}
            if offres:
                dispo[p] = offres
        if dispo:
            it["dispo"] = dispo
        else:
            it.pop("dispo", None)
        n += 1
        if n % 1000 == 0:
            print(f"  TMDB {n}")
    return sum("dispo" in it for it in cat.values())


def ajouter(cat):
    print("Où jouer : plateformes et boutiques (Wikidata)...")
    print(" ", jeux(cat), "jeux")
    print("Où regarder : identifiants TMDB (Wikidata)...")
    print(" ", ecrans(cat), "films et séries reliés à TMDB")
    cle = os.environ.get("TMDB_API_KEY")
    if cle:
        print("Où regarder : offres FR et US (TMDB, données JustWatch)...")
        print(" ", tmdb(cat, cle), "titres avec au moins une offre")
    else:
        print("  pas de TMDB_API_KEY : offres de streaming non mises à jour (lien JustWatch seulement)")


if __name__ == "__main__":
    chemin = ICI / "catalogue.json"
    cat = json.loads(chemin.read_text(encoding="utf-8"))
    ajouter(cat)
    chemin.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sys.exit(0)
