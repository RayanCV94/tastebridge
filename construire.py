# Construit catalogue.json (films, séries, jeux + leurs thèmes) depuis Wikidata,
# SteamSpy et Wikipédia. Sources gratuites, sans compte. Lancé une fois, puis à la demande.
import json, math, sys, time, requests
from pathlib import Path
from themes import THEMES, themes_wd, themes_steam
import notes

ICI = Path(__file__).parent
EXCLURE = {"Software", "Utilities", "Sexual Content", "Hentai", "Design & Illustration", "Animation & Modeling", "Massively Multiplayer"}
UA = {"User-Agent": "tastebridge/1.0 (https://github.com/RayanCV94/tastebridge)"}


def sparql(q):
    for essai in range(3):
        try:
            r = requests.get("https://query.wikidata.org/sparql", params={"query": q, "format": "json"},
                             headers=UA, timeout=180)
            r.raise_for_status()
            return r.json()["results"]["bindings"]
        except Exception as e:
            print("  Wikidata, nouvel essai :", e)
            time.sleep(10)
    return []


# En deux temps : la liste des identifiants (requête légère), puis les détails par paquets.
# En une seule requête, Wikidata dépasse son délai dès que le catalogue grossit.
REQ_IDS = """SELECT ?i ?sl WHERE { VALUES ?type { %s } ?i wdt:P31 ?type; wikibase:sitelinks ?sl. FILTER(?sl >= %d) }"""

REQ_ECRAN = """SELECT ?i ?en ?fr ?imdb ?art (MIN(?y0) AS ?y)
 (GROUP_CONCAT(DISTINCT ?gl;separator="|") AS ?g) (GROUP_CONCAT(DISTINCT ?ml;separator="|") AS ?m) WHERE {
 VALUES ?i { %s }
 { ?i wdt:P577 ?d } UNION { ?i wdt:P580 ?d } BIND(YEAR(?d) AS ?y0) FILTER(?y0 >= 1975)
 ?i rdfs:label ?en FILTER(lang(?en)="en")
 OPTIONAL { ?i rdfs:label ?fr FILTER(lang(?fr)="fr") }
 OPTIONAL { ?i wdt:P345 ?imdb }
 OPTIONAL { ?art schema:about ?i; schema:isPartOf <https://en.wikipedia.org/> }
 OPTIONAL { ?i wdt:P136 ?ge. ?ge rdfs:label ?gl FILTER(lang(?gl)="en") }
 OPTIONAL { ?i wdt:P921 ?ms. ?ms rdfs:label ?ml FILTER(lang(?ml)="en") }
} GROUP BY ?i ?en ?fr ?imdb ?art"""

REQ_ANNEES_JEUX = """SELECT ?steam (MIN(YEAR(?d)) AS ?y) WHERE { ?i wdt:P1733 ?steam; wdt:P577 ?d } GROUP BY ?steam"""


def ecran(types, seuil, dom):
    out = {}
    sl = {b["i"]["value"].rsplit("/", 1)[1]: int(b["sl"]["value"]) for b in sparql(REQ_IDS % (types, seuil))}
    print(f"   {len(sl)} identifiants")
    ids = list(sl)
    lignes = []
    for k in range(0, len(ids), 300):
        lignes += sparql(REQ_ECRAN % " ".join("wd:" + q for q in ids[k:k + 300]))
        if k % 3000 == 0:
            print(f"   détails {k}/{len(ids)}")
    for b in lignes:
        qid = b["i"]["value"].rsplit("/", 1)[1]
        mots = b.get("g", {}).get("value", "") + "|" + b.get("m", {}).get("value", "")
        th = themes_wd(mots)
        if not th:
            continue
        if qid in out or "y" not in b:
            continue
        out[qid] = {
            "id": qid, "dom": dom,
            "titre": b.get("fr", b["en"])["value"], "titre_en": b["en"]["value"],
            "annee": int(b["y"]["value"]), "imdb": b.get("imdb", {}).get("value"),
            "wiki": b.get("art", {}).get("value", "").rsplit("/", 1)[-1] or None,
            "qualite": min(1.0, math.log(sl[qid]) / math.log(150)), "themes": th,
        }
    return out


def jeux():
    vus = {}
    noms = sorted({t for v in THEMES.values() for t in v["steam"]})
    for n, tag in enumerate(noms, 1):
        print(f"  SteamSpy {n}/{len(noms)} : {tag}")
        try:
            d = requests.get("https://steamspy.com/api.php", params={"request": "tag", "tag": tag},
                             headers=UA, timeout=120).json()
        except Exception as e:
            print("   ignoré :", e)
            continue
        for a in d.values():
            pos, neg = a.get("positive", 0), a.get("negative", 0)
            if pos < 800 or pos / (pos + neg) < 0.72:
                continue
            j = vus.setdefault(a["appid"], {"tags": set(), "a": a})
            j["tags"].add(tag)
        time.sleep(1.1)
    # Les listes par tag sont bruitées (tags « troll ») : on relit les vrais tags votés de chaque jeu
    cache_f = ICI / "steamspy_cache.json"
    cache = json.loads(cache_f.read_text(encoding="utf-8")) if cache_f.exists() else {}
    for n, appid in enumerate(vus, 1):
        if str(appid) in cache:
            continue
        try:
            cache[str(appid)] = requests.get("https://steamspy.com/api.php", params={"request": "appdetails", "appid": appid},
                                             headers=UA, timeout=60).json().get("tags") or {}
        except Exception:
            continue
        if n % 100 == 0:
            print(f"  tags détaillés {n}/{len(vus)}")
            cache_f.write_text(json.dumps(cache), encoding="utf-8")
        time.sleep(1.05)
    cache_f.write_text(json.dumps(cache), encoding="utf-8")
    for appid, j in list(vus.items()):
        votes = cache.get(str(appid))
        if not isinstance(votes, dict) or not votes or EXCLURE & set(votes):
            vus.pop(appid)
            continue
        haut = max(votes.values())
        j["tags"] = {t for t, v in votes.items() if v >= 0.25 * haut}
    annees = {b["steam"]["value"]: int(b["y"]["value"]) for b in sparql(REQ_ANNEES_JEUX) if "y" in b}
    out = {}
    for appid, j in vus.items():
        a = j["a"]
        th = themes_steam(j["tags"])
        if not th:
            continue
        pos, neg = a["positive"], a["negative"]
        ratio = pos / (pos + neg)
        # Note façon « acclamé » : bonne proportion d'avis positifs ET beaucoup d'avis
        q = ratio * min(1.0, math.log10(pos) / 5.5)
        gid = f"steam{appid}"
        out[gid] = {
            "id": gid, "dom": "jeu", "titre": a["name"], "titre_en": a["name"],
            "annee": annees.get(str(appid)), "steam": appid,
            "image": f"https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg",
            "avis": f"{round(ratio * 100)} % positifs sur {pos + neg:,} avis".replace(",", " "),
            "qualite": q, "themes": th,
        }
    return out


def affiches(items):
    # Miniature de l'article Wikipédia anglais (affiche du film ou de la série)
    liste = [i for i in items if i.get("wiki")]
    for k in range(0, len(liste), 50):
        lot = {requests.utils.unquote(i["wiki"]).replace("_", " "): i for i in liste[k:k + 50]}
        for essai in range(4):
          try:
            d = requests.post("https://en.wikipedia.org/w/api.php", headers=UA, timeout=60, data={
                "action": "query", "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": 400,
                "pilicense": "any", "format": "json", "redirects": 1, "titles": "|".join(lot)}).json()["query"]
            break
          except Exception:
            time.sleep(5 * (essai + 1))
        else:
            print("   affiches ignorées pour ce lot")
            continue
        renvoi = {r["to"]: r["from"] for r in d.get("normalized", []) + d.get("redirects", [])}
        for p in d.get("pages", {}).values():
            t = p.get("title")
            t = t if t in lot else renvoi.get(t, t)
            if t in lot and "thumbnail" in p:
                lot[t]["image"] = p["thumbnail"]["source"]
        print(f"  affiches {min(k + 50, len(liste))}/{len(liste)}")
        time.sleep(0.5)


if __name__ == "__main__" and sys.argv[1:] == ["--affiches"]:
    cat = json.loads((ICI / "catalogue.json").read_text(encoding="utf-8"))
    affiches([i for i in cat.values() if i["dom"] != "jeu"])
    (ICI / "catalogue.json").write_text(json.dumps(cat, ensure_ascii=False), encoding="utf-8")
elif __name__ == "__main__" and sys.argv[1:] == ["--jeux"]:
    cat = json.loads((ICI / "catalogue.json").read_text(encoding="utf-8"))
    cat = {k: v for k, v in cat.items() if v["dom"] != "jeu"} | jeux()
    (ICI / "catalogue.json").write_text(json.dumps(cat, ensure_ascii=False), encoding="utf-8")
    print("Jeux :", sum(v["dom"] == "jeu" for v in cat.values()))
elif __name__ == "__main__" and sys.argv[1:] in ([], ["--imdb"]):
    t0 = time.time()
    print("Films (Wikidata)...")
    films = ecran("wd:Q11424 wd:Q24869 wd:Q202866", 12, "film")
    print(" ", len(films))
    print("Séries (Wikidata)...")
    series = ecran("wd:Q5398426 wd:Q581714 wd:Q1259759 wd:Q63952888 wd:Q117467246", 6, "serie")
    print(" ", len(series))
    print("Jeux (SteamSpy)...")
    js = jeux()
    print(" ", len(js))
    print("Affiches (Wikipédia)...")
    affiches(list(films.values()) + list(series.values()))
    if len(films) < 3000 or len(series) < 2000 or len(js) < 2000:
        sys.exit("Catalogue incomplet (Wikidata ou SteamSpy en panne) : ancien catalogue gardé.")
    cat = {**films, **series, **js}
    notes.ajouter(cat, imdb="--imdb" in sys.argv)  # Metacritic, Rotten Tomatoes ; IMDb en local seulement
    (ICI / "catalogue.json").write_text(json.dumps(cat, ensure_ascii=False), encoding="utf-8")
    print(f"Fini : {len(cat)} titres en {round(time.time() - t0)} s")
