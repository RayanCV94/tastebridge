# Tendances du jour pour le site public (lancé chaque jour par .github/workflows/tendances.yml) :
# recalcule tastebridge/tendances.json depuis le catalogue publié, puis met à jour les empreintes ?v=
# (le service worker garde en cache tout fichier versionné : sans nouvelle empreinte, rien ne changerait).
import hashlib, json, re, sys
from pathlib import Path

ICI = Path(__file__).parent
SITE = ICI / "tastebridge"


def v(contenu):
    return hashlib.sha1(contenu).hexdigest()[:10]


def rehacher():
    # Mêmes empreintes que site.py : tendances et discussions dans moteur.js, moteur.js dans la page
    moteur = (SITE / "moteur.js").read_text(encoding="utf-8")
    for f in ("tendances.json", "communaute.json"):
        if (SITE / f).exists():
            moteur = re.sub(rf"{re.escape(f)}\?v=[0-9a-f]+", f"{f}?v={v((SITE / f).read_bytes())}", moteur)
    (SITE / "moteur.js").write_text(moteur, encoding="utf-8")
    page = (SITE / "index.html").read_text(encoding="utf-8")
    page = re.sub(r"moteur\.js\?v=[0-9a-f]+", f"moteur.js?v={v(moteur.encode())}", page)
    (SITE / "index.html").write_text(page, encoding="utf-8")


def catalogue():
    # Catalogue compact (site.py) : [id, support, titre, titre_en, année, qualité, thèmes, image, wiki, ...]
    lignes = json.loads((SITE / "catalogue.json").read_text(encoding="utf-8"))["lignes"]
    return {l[0]: {"dom": ("film", "serie", "jeu")[l[1]], "wiki": l[8] if len(l) > 8 else ""} for l in lignes}


if __name__ == "__main__":
    if "--empreintes" not in sys.argv:
        import tendances
        t = tendances.calculer(catalogue())
        if not (t["film"] or t["serie"] or t["jeu"]):
            sys.exit("Aucune tendance récupérée (API injoignables) : ancien fichier gardé.")
        (SITE / "tendances.json").write_text(json.dumps(t, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    rehacher()
