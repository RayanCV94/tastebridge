# Ajoute le thème « Animation, famille » aux films et séries d'animation du catalogue.
# Wikidata range souvent l'animation dans « nature de l'élément » (film d'animation, série d'animation)
# et non dans le genre : sans ça, Onward ou Trolls n'ont que « Fantasy » et sortent pour The Witcher.
# À lancer après construire.py, puis site.py.
import json
import time
from pathlib import Path

import requests

ICI = Path(__file__).parent
REQ = """SELECT DISTINCT ?i WHERE { VALUES ?i { %s }
  { ?i wdt:P31/wdt:P279* wd:Q202866 } UNION { ?i wdt:P31/wdt:P279* wd:Q581714 }
  UNION { ?i wdt:P136/wdt:P279* wd:Q202866 } UNION { ?i wdt:P136 wd:Q11425 } }"""

cat = json.loads((ICI / "catalogue.json").read_text(encoding="utf-8"))
ids = [i for i, it in cat.items() if it["dom"] in ("film", "serie") and i.startswith("Q")]
anim = set()
for k in range(0, len(ids), 300):
    lot = " ".join("wd:" + i for i in ids[k:k + 300])
    for essai in range(4):
        r = requests.post("https://query.wikidata.org/sparql", data={"query": REQ % lot, "format": "json"},
                          headers={"User-Agent": "Tastebridge/1.0 (github.com/RayanCV94/tastebridge)"}, timeout=90)
        if r.ok:
            break
        time.sleep(5 * (essai + 1))
    r.raise_for_status()
    anim |= {b["i"]["value"].rsplit("/", 1)[1] for b in r.json()["results"]["bindings"]}
    print(f"  {min(k + 300, len(ids))}/{len(ids)}", flush=True)

ajoutes = 0
for i in anim:
    if "Animation, famille" not in cat[i]["themes"]:
        cat[i]["themes"] = sorted(cat[i]["themes"] + ["Animation, famille"])
        ajoutes += 1
(ICI / "catalogue.json").write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(anim)} œuvres d'animation, thème ajouté à {ajoutes}")
