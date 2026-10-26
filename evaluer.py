# Évaluation hors ligne par « leave-one-out » : on cache un titre aimé, on recommande à partir
# du reste du profil, et on regarde à quel rang le titre caché ressort.
# Comparé à deux références : le hasard et « les titres les plus populaires d'abord ».
import os, random, statistics, sys

os.environ["RECOS_SANS_NAVIGATEUR"] = "1"
import recos as R


def rang(liste, cible):
    return next(k for k, i in enumerate(liste, 1) if i == cible)


def evaluer(p, k_liste=(10, 50)):
    poids = R.poids_profil(p)
    aimes = [i for i, w in poids.items() if w > 0]
    resultats = {"thèmes (ce projet)": [], "popularité": [], "hasard": []}
    for cache in aimes:
        dom = R.CAT[cache]["dom"]
        reste = {i: w for i, w in poids.items() if i != cache and R.CAT[i]["dom"] in ({"jeu"} if dom == "jeu" else {"film", "serie"})}
        if not any(w > 0 for w in reste.values()):
            continue
        deja = (set(p["notes"]) | R.EXCLUS_AUTO) - {cache}
        classe, _ = R.classer(reste, dom, deja)
        ids = [i for _, i, _ in classe]
        resultats["thèmes (ce projet)"].append(rang(ids, cache))
        pop = sorted(ids, key=lambda i: -R.CAT[i]["qualite"])
        resultats["popularité"].append(rang(pop, cache))
        random.seed(cache)
        resultats["hasard"].append(rang(random.sample(ids, len(ids)), cache))
    n = len(resultats["hasard"])
    print(f"{n} titres aimés testés un par un (cachés puis retrouvés)\n")
    print(f"{'méthode':<20}" + "".join(f"{'Hit@' + str(k):>9}" for k in k_liste) + f"{'rang médian':>14}")
    for nom, rangs in resultats.items():
        hits = "".join(f"{sum(r <= k for r in rangs) / n:>9.0%}" for k in k_liste)
        print(f"{nom:<20}{hits}{statistics.median(rangs):>14.0f}")


if __name__ == "__main__":
    evaluer(R.charger_profil())
