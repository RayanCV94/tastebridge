# Signal communautaire : les titres dont on parle cette semaine sur Reddit (posts les mieux classés de quelques
# communautés films, séries, jeux). API officielle uniquement, jamais de scraping. Il faut une application Reddit
# (type « script ») : variables REDDIT_CLIENT_ID et REDDIT_CLIENT_SECRET. L'accès gratuit est réservé aux usages
# non commerciaux (conditions Reddit à relire avant toute monétisation). Sans identifiants, le script ne fait rien.
# Écrit communaute.json (même format que tendances.json). Lancé par .github/workflows/tendances.yml.
import json, os, re, sys, unicodedata
from pathlib import Path

ICI = Path(__file__).parent
UA = "tastebridge/1.0 (https://github.com/RayanCV94/tastebridge)"
COMMUNAUTES = {"film": ["movies", "MovieSuggestions", "flicks"], "serie": ["television", "televisionsuggestions"],
               "jeu": ["gaming", "patientgamers", "Games"]}
# Titres trop courants pour être reconnus dans une phrase (« It », « Up », « Her », « Control »...)
MIN_LETTRES = 7


def simple(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def index_titres(cat, dom):
    # Titre anglais normalisé -> id ; les titres ambigus (deux œuvres du même nom) sont écartés
    vus, idx = set(), {}
    for i, it in cat.items():
        if it["dom"] != dom:
            continue
        t = simple(it.get("titre_en") or it["titre"])
        if len(t.replace(" ", "")) < MIN_LETTRES or " " not in t and len(t) < 10:
            continue
        if t in vus:
            idx.pop(t, None)
        else:
            vus.add(t), idx.setdefault(t, i)
    return idx


def mentions(posts, idx):
    # posts : [(titre du post, score)] -> {id: score cumulé}. Le titre doit apparaître en mots entiers ;
    # le plus long titre reconnu l'emporte (« The Last of Us Part II » plutôt que « The Last of Us »).
    longueur = sorted(idx, key=len, reverse=True)
    out = {}
    for titre, score in posts:
        s = f" {simple(titre)} "
        for t in longueur:
            if f" {t} " in s:
                out[idx[t]] = out.get(idx[t], 0) + max(1, score)
                s = s.replace(f" {t} ", "  ")
    return out


def calculer(cat, cid, secret, garder=40):
    import requests
    jeton = requests.post("https://www.reddit.com/api/v1/access_token", auth=(cid, secret), data={"grant_type": "client_credentials"},
                          headers={"User-Agent": UA}, timeout=30).json()["access_token"]
    h = {"Authorization": f"bearer {jeton}", "User-Agent": UA}
    out = {}
    for dom, subs in COMMUNAUTES.items():
        posts = []
        for sub in subs:
            r = requests.get(f"https://oauth.reddit.com/r/{sub}/top", params={"t": "week", "limit": 100}, headers=h, timeout=30)
            if r.ok:
                posts += [(c["data"]["title"], c["data"]["score"]) for c in r.json()["data"]["children"]]
        m = sorted(((v, i) for i, v in mentions(posts, index_titres(cat, dom)).items()), reverse=True)[:garder]
        out[dom] = [[i, round(v / m[0][0], 3)] for v, i in m] if m else []
    return out


if __name__ == "__main__":
    cid, secret = os.environ.get("REDDIT_CLIENT_ID"), os.environ.get("REDDIT_CLIENT_SECRET")
    if not (cid and secret):
        sys.exit(print("Pas d'identifiants Reddit (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET) : signal communautaire ignoré.") or 0)
    cat = json.loads((ICI / "catalogue.json").read_text(encoding="utf-8"))
    t = calculer(cat, cid, secret)
    (ICI / "communaute.json").write_text(json.dumps(t, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print({k: len(v) for k, v in t.items()})
