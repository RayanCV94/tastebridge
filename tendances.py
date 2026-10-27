# Tendances de la semaine, sans clé ni scraping :
# - films et séries : articles Wikipédia (anglais) les plus lus chaque jour sur 7 jours (API Wikimedia, données ouvertes) ;
# - jeux : les 100 jeux Steam les plus joués sur 2 semaines (SteamSpy).
# Écrit tendances.json (petit fichier à part : le catalogue n'est pas retéléchargé chaque jour).
# Lancé chaque jour par GitHub Actions (.github/workflows/tendances.yml), ou à la main : python tendances.py
import datetime, json, sys
from pathlib import Path

ICI = Path(__file__).parent
UA = {"User-Agent": "tastebridge/1.0 (https://github.com/RayanCV94/tastebridge)"}


def calculer(cat, jours=7, garder=40):
    import requests
    par_wiki = {it["wiki"]: i for i, it in cat.items() if it.get("wiki")}
    vues = {}
    for k in range(2, 2 + jours):  # les chiffres d'hier ne sont pas toujours publiés
        d = datetime.date.today() - datetime.timedelta(days=k)
        r = requests.get(f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{d:%Y/%m/%d}", headers=UA, timeout=60)
        if not r.ok:
            continue
        for a in r.json()["items"][0]["articles"]:
            if a["article"] in par_wiki:
                i = par_wiki[a["article"]]
                vues[i] = vues.get(i, 0) + a["views"]
    out = {"maj": datetime.date.today().isoformat()}
    for dom in ("film", "serie"):
        l = sorted(((v, i) for i, v in vues.items() if cat[i]["dom"] == dom), reverse=True)[:garder]
        out[dom] = [[i, round(v / l[0][0], 3)] for v, i in l] if l else []
    r = requests.get("https://steamspy.com/api.php", params={"request": "top100in2weeks"}, headers=UA, timeout=60)
    jeux = [f"steam{a['appid']}" for a in r.json().values()] if r.ok else []
    jeux = [i for i in jeux if i in cat][:garder]
    out["jeu"] = [[i, round(1 - k / max(1, len(jeux)), 3)] for k, i in enumerate(jeux)]
    return out


if __name__ == "__main__":
    cat = json.loads((ICI / "catalogue.json").read_text(encoding="utf-8"))
    t = calculer(cat)
    if not (t["film"] or t["serie"] or t["jeu"]):
        sys.exit("Aucune tendance récupérée (API injoignables) : ancien fichier gardé.")
    (ICI / "tendances.json").write_text(json.dumps(t, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print({k: len(v) for k, v in t.items() if k != "maj"})
