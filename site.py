# Prépare la version site (GitHub Pages, dossier docs/) : même page que la version locale,
# avec le moteur JavaScript et le catalogue. À relancer après construire.py ou une modif de page.html.
import hashlib, json, sys
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
moteur = (ICI / "moteur.js").read_text(encoding="utf-8").replace('fetch("catalogue.json")', f'fetch("catalogue.json?v={v(cat)}")', 1)
assert "catalogue.json?v=" in moteur
compte = (ICI / "compte.js").read_bytes()
langue = (ICI / "langue.js").read_bytes()

page = (ICI / "page.html").read_text(encoding="utf-8")
page = page.replace("<script>\nlet onglet", f'<script src="moteur.js?v={v(moteur.encode())}"></script>\n<script>\nlet onglet', 1)
assert "moteur.js" in page
# Compte optionnel (Supabase) : uniquement sur le site, chargé après la page
page = page.replace("</body>", f'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n<script src="compte.js?v={v(compte)}"></script>\n<script src="langue.js?v={v(langue)}"></script>\n</body>', 1)
assert "compte.js" in page and "langue.js" in page
(DOCS / "index.html").write_text(page, encoding="utf-8")
(DOCS / "moteur.js").write_text(moteur, encoding="utf-8")
(DOCS / "compte.js").write_bytes(compte)
(DOCS / "langue.js").write_bytes(langue)
(DOCS / "catalogue.json").write_bytes(cat)
(DOCS / ".nojekyll").touch()
print("Site prêt dans docs/")
