# Prépare la version site (GitHub Pages, dossier docs/) : même page que la version locale,
# avec le moteur JavaScript et le catalogue. À relancer après construire.py ou une modif de page.html.
import hashlib, json, re, sys
from pathlib import Path

ICI = Path(__file__).parent
DOCS = ICI / "docs"


# GitHub Pages garde chaque fichier 10 min en cache : un nom qui change avec le contenu
# (?v=empreinte) évite qu'un navigateur mélange ancienne et nouvelle version.
def v(contenu):
    return hashlib.sha1(contenu).hexdigest()[:10]


cat = (ICI / "catalogue.json").read_bytes()
# Notes IMDb : réservées à un usage personnel (conditions IMDb), donc absentes du site par défaut.
# --avec-imdb les publie quand même : à ne faire qu'avec une licence ou l'accord d'IMDb.
if "--avec-imdb" in sys.argv:
    from notes import ajouter_imdb
    cat = json.dumps(ajouter_imdb(json.loads(cat)), ensure_ascii=False, separators=(",", ":")).encode()


# Catalogue du site en format compact (moteur.js le déplie) : tableau de lignes au lieu d'objets,
# thèmes en numéros, préfixes d'affiches et paramètres de suivi retirés, image Steam déduite de l'appid.
# 10,8 Mo -> ~4 Mo à analyser sur téléphone. Le catalogue source (et la version locale) ne change pas.
PREFIXES = ["https://upload.wikimedia.org/wikipedia/", "https://thumb.wikimedia.org/wikipedia/"]


def compact(items):
    themes = sorted({t for it in items.values() for t in it["themes"]})
    rang = {t: k for k, t in enumerate(themes)}
    def image(it):
        u = it.get("image") or ""
        if it["dom"] == "jeu" or not u:
            return ""
        u = u.split("?utm_source=")[0]
        for k, pre in enumerate(PREFIXES):
            if u.startswith(pre):
                return f"{k}:{u[len(pre):]}"
        return u
    def avis(it):
        if not it.get("avis"):
            return None
        pct, n = re.fullmatch(r"(\d+) % positifs sur ([\d ]+) avis", it["avis"]).groups()
        return [int(pct), int(n.replace(" ", ""))]
    lignes = [[it["id"], "fsj".index(it["dom"][0]), it["titre"], it["titre_en"] if it["titre_en"] != it["titre"] else 0,
               it.get("annee") or 0, round(it["qualite"] * 1e4), [rang[t] for t in it["themes"]], image(it),
               it.get("wiki") or "", it.get("imdb") or "", it.get("steam") or 0, avis(it),
               it.get("metacritic"), it.get("rt"), it.get("note_imdb"), it.get("votes_imdb"),
               it.get("plateformes"), it.get("boutiques"), it.get("dispo")] for it in items.values()]
    for l in lignes:  # champs vides en fin de ligne retirés
        while l[-1] in (None, 0, ""):
            l.pop()
    return json.dumps({"v": 1, "themes": themes, "prefixes": PREFIXES, "lignes": lignes}, ensure_ascii=False, separators=(",", ":")).encode()


cat = compact(json.loads(cat))
tend = (ICI / "tendances.json").read_bytes() if (ICI / "tendances.json").exists() else b"{}"
moteur = (ICI / "moteur.js").read_text(encoding="utf-8").replace('fetch("catalogue.json")', f'fetch("catalogue.json?v={v(cat)}")', 1)
moteur = moteur.replace('fetch("tendances.json")', f'fetch("tendances.json?v={v(tend)}")', 1)
assert "catalogue.json?v=" in moteur
compte = (ICI / "compte.js").read_bytes()
langue = (ICI / "langue.js").read_bytes()

page = (ICI / "page.html").read_text(encoding="utf-8")
# langue.js avant la page : la traduction se fait avant le premier affichage (pas de texte qui saute)
page = page.replace("<script>\nlet onglet", f'<script src="langue.js?v={v(langue)}"></script>\n<script src="moteur.js?v={v(moteur.encode())}"></script>\n<script>\nlet onglet', 1)
assert "moteur.js" in page
# Compte optionnel (Supabase) : uniquement sur le site, chargé après la page
page = page.replace("</body>", f'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n<script src="compte.js?v={v(compte)}"></script>\n</body>', 1)
assert "compte.js" in page and "langue.js" in page
# Application installable (PWA) : manifest, icônes, service worker (site uniquement)
page = page.replace("</head>", '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icones/icone-192.png">\n</head>', 1)
page = page.replace("</body>", '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js"));</script>\n</body>', 1)
(DOCS / "index.html").write_text(page, encoding="utf-8")
for f in ["sw.js", "manifest.webmanifest"]:
    (DOCS / f).write_bytes((ICI / f).read_bytes())
(DOCS / "icones").mkdir(exist_ok=True)
for f in (ICI / "icones").glob("*.png"):
    (DOCS / "icones" / f.name).write_bytes(f.read_bytes())
(DOCS / "moteur.js").write_text(moteur, encoding="utf-8")
(DOCS / "compte.js").write_bytes(compte)
(DOCS / "langue.js").write_bytes(langue)
(DOCS / "catalogue.json").write_bytes(cat)
(DOCS / "tendances.json").write_bytes(tend)
(DOCS / ".nojekyll").touch()
print("Site prêt dans docs/")
