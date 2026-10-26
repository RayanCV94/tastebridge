# Prépare la version site (GitHub Pages, dossier docs/) : même page que la version locale,
# avec le moteur JavaScript et le catalogue. À relancer après construire.py ou une modif de page.html.
import shutil
from pathlib import Path

ICI = Path(__file__).parent
DOCS = ICI / "docs"
page = (ICI / "page.html").read_text(encoding="utf-8")
page = page.replace("<script>\nlet onglet", '<script src="moteur.js"></script>\n<script>\nlet onglet', 1)
assert "moteur.js" in page
(DOCS / "index.html").write_text(page, encoding="utf-8")
shutil.copy(ICI / "moteur.js", DOCS / "moteur.js")
shutil.copy(ICI / "catalogue.json", DOCS / "catalogue.json")
(DOCS / ".nojekyll").touch()
print("Site prêt dans docs/")
