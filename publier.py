# Publie le site sur le dépôt public rayancv94.github.io (le dépôt du code reste privé) :
#   git clone https://github.com/RayanCV94/rayancv94.github.io ../site-public
#   python3 site.py && python3 publier.py ../site-public
#   cd ../site-public && git add -A && git commit -m "Site" && git push
# Le site y est servi sous /tastebridge/ (même adresse qu'avant). Les tendances du jour sont mises à jour
# là-bas (maj.py) : on garde les siennes, plus fraîches que celles d'ici.
import shutil, subprocess, sys
from pathlib import Path

ICI = Path(__file__).parent
cible = Path(sys.argv[1]) if len(sys.argv) > 1 else sys.exit("Usage : python3 publier.py <clone du dépôt public>")
garder = {f: (cible / "tastebridge" / f).read_bytes() for f in ("tendances.json", "communaute.json") if (cible / "tastebridge" / f).exists()}
shutil.copytree(ICI / "site-public", cible, dirs_exist_ok=True)
shutil.copy(ICI / "tendances.py", cible)
shutil.rmtree(cible / "tastebridge", ignore_errors=True)
shutil.copytree(ICI / "docs", cible / "tastebridge")
for f, b in garder.items():
    (cible / "tastebridge" / f).write_bytes(b)
subprocess.run([sys.executable, str(cible / "maj.py"), "--empreintes"], check=True)
print(f"Site prêt dans {cible} : il reste à le committer et le pousser.")
