# Notes externes des films et séries, ajoutées au moment de la construction (aucun appel au runtime).
# - Metacritic et Rotten Tomatoes : propriété « review score » (P444) de Wikidata, licence CC0,
#   donc publiables : écrites dans catalogue.json (champs metacritic sur 100, rt en %).
# - IMDb : jeu de données officiel title.ratings.tsv.gz, réservé à un usage personnel et non commercial
#   (pas de republication). Les notes vont dans donnees/notes_imdb.json (jamais versionné), lu par la
#   version locale. Le site ne les publie que si site.py est lancé avec --avec-imdb.
# À lancer après construire.py (qui l'appelle), ou seul : python notes.py [--imdb]
import csv, gzip, io, json, re, sys, time
from pathlib import Path

ICI = Path(__file__).parent
IMDB_LOCAL = ICI / "donnees" / "notes_imdb.json"
UA = {"User-Agent": "tastebridge/1.0 (https://github.com/RayanCV94/tastebridge)"}
METACRITIC, ROTTEN = "Q150248", "Q105584"

# La note la plus récente de chaque source (Wikidata garde l'historique, daté par P585)
REQ = """SELECT ?i ?par ?score ?date WHERE { VALUES ?i { %s } VALUES ?par { wd:%s wd:%s }
 ?i p:P444 ?s. ?s ps:P444 ?score; pq:P447 ?par. OPTIONAL { ?s pq:P585 ?date } }"""


def sparql(q):
    import requests  # seulement pour construire le catalogue : la version locale n'en a pas besoin
    for essai in range(3):
        try:
            r = requests.get("https://query.wikidata.org/sparql", params={"query": q, "format": "json"}, headers=UA, timeout=180)
            r.raise_for_status()
            return r.json()["results"]["bindings"]
        except Exception as e:
            print("  Wikidata, nouvel essai :", e)
            time.sleep(10)
    return []


def notes_wikidata(cat):
    ids = [i for i, it in cat.items() if it["dom"] != "jeu" and i.startswith("Q")]
    meilleures = {}
    for k in range(0, len(ids), 300):
        for b in sparql(REQ % (" ".join("wd:" + i for i in ids[k:k + 300]), METACRITIC, ROTTEN)):
            i, par, s = b["i"]["value"].rsplit("/", 1)[1], b["par"]["value"].rsplit("/", 1)[1], b["score"]["value"].strip()
            # Metacritic : « 85/100 » ; Rotten Tomatoes : le Tomatometer en « 94% » (pas la moyenne sur 10)
            m = re.fullmatch(r"(\d{1,3})\s*/\s*100", s) if par == METACRITIC else re.fullmatch(r"(\d{1,3})\s*%", s)
            if not m or int(m[1]) > 100:
                continue
            cle, date = (i, "metacritic" if par == METACRITIC else "rt"), b.get("date", {}).get("value", "")
            if cle not in meilleures or date > meilleures[cle][1]:
                meilleures[cle] = (int(m[1]), date)
        if k % 3000 == 0:
            print(f"  notes Wikidata {k}/{len(ids)}")
    for it in cat.values():
        it.pop("metacritic", None), it.pop("rt", None)
    for (i, champ), (v, _) in meilleures.items():
        cat[i][champ] = v
    return len({i for i, _ in meilleures})


def notes_imdb(cat):
    import requests
    voulus = {it["imdb"]: i for i, it in cat.items() if it.get("imdb")}
    r = requests.get("https://datasets.imdbws.com/title.ratings.tsv.gz", headers=UA, timeout=300)
    r.raise_for_status()
    out = {}
    with gzip.open(io.BytesIO(r.content), "rt", encoding="utf-8") as f:
        for l in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            if l["tconst"] in voulus:
                out[voulus[l["tconst"]]] = [float(l["averageRating"]), int(l["numVotes"])]
    IMDB_LOCAL.parent.mkdir(exist_ok=True)
    IMDB_LOCAL.write_text(json.dumps(out), encoding="utf-8")
    return len(out)


def ajouter_imdb(cat):
    # Pour la version locale (usage personnel) ou pour site.py --avec-imdb : ajoute note_imdb et votes_imdb
    if IMDB_LOCAL.exists():
        for i, (note, votes) in json.loads(IMDB_LOCAL.read_text(encoding="utf-8")).items():
            if i in cat:
                cat[i]["note_imdb"], cat[i]["votes_imdb"] = note, votes
    return cat


def ajouter(cat, imdb=False):
    print("Notes Metacritic et Rotten Tomatoes (Wikidata)...")
    print(" ", notes_wikidata(cat), "titres notés")
    if imdb:
        print("Notes IMDb (usage personnel, gardées dans donnees/)...")
        print(" ", notes_imdb(cat), "titres notés")


if __name__ == "__main__":
    chemin = ICI / "catalogue.json"
    cat = json.loads(chemin.read_text(encoding="utf-8"))
    ajouter(cat, imdb="--imdb" in sys.argv)
    chemin.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
