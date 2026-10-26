# Lecture de ce que l'utilisateur a déjà vu ou joué : exports CSV des plateformes,
# Steam installé sur ce PC, Jellyfin et liste Excel (facultatifs). Rien n'est envoyé nulle part.
import csv, io, os, re, sys
from pathlib import Path


# ---------- Exports CSV (bouton « Importer ») ----------
# Chaque lecteur rend des lignes (titre, imdb, année, note, domaine) ; domaine None = film ou série.
SAISON = re.compile(r"\b(season|saison|temporada|staffel|stagione|part|partie|parte|teil|chapter|chapitre|episode|épisode|"
                    r"limited series|mini-?série|volume|vol\.|book|livre|collection)\b", re.I)


def _netflix(rows):
    """NetflixViewingHistory.csv (Compte > Activité de visionnage > Tout télécharger) : colonnes Title, Date."""
    episodes, films = {}, set()
    for r in rows:
        parts = [x.strip() for x in re.split(r"\s?:\s", r.get("Title", "")) if x.strip()]
        if not parts:
            continue
        if len(parts) >= 3 or (len(parts) == 2 and SAISON.search(parts[1])):
            episodes[parts[0]] = episodes.get(parts[0], 0) + 1
        else:
            films.add(r["Title"].strip())
    out = [(t, None, None, "regarde", None) for t in films]
    # Une série dont on a vu 3 épisodes ou plus, on l'a sans doute aimée
    out += [(t, None, None, "aime" if n >= 3 else "regarde", "serie") for t, n in episodes.items()]
    return out


def _netflix_notes(rows):
    """Ratings.csv de l'export complet Netflix : pouces 1 = bof, 2 = aime, 3 = adore."""
    conv = {"1": "bof", "2": "aime", "3": "adore"}
    return [(r["Title Name"], None, None, conv[r["Thumbs Value"].strip()], None)
            for r in rows if r.get("Thumbs Value", "").strip() in conv]


def _imdb(rows):
    """Export des notes IMDb (Your Ratings > ... > Export) : Const, Your Rating, Title Type."""
    out = []
    for r in rows:
        n = int(r["Your Rating"])
        note = "adore" if n >= 9 else "aime" if n >= 7 else "vu" if n >= 5 else "bof" if n >= 3 else "deteste"
        typ = r.get("Title Type", "").lower()
        dom = "jeu" if "game" in typ else "serie" if "series" in typ else "film" if "movie" in typ else None
        out.append((r.get("Title", ""), r["Const"], r.get("Year"), note, dom))
    return out


def _letterboxd(rows):
    """ratings.csv, diary.csv ou watched.csv de l'export Letterboxd : Name, Year, Rating (sur 5)."""
    out = []
    for r in rows:
        if r.get("Rating"):
            n = float(r["Rating"])
            note = "adore" if n >= 4.5 else "aime" if n >= 3.5 else "vu" if n >= 2.5 else "bof" if n >= 1.5 else "deteste"
        else:
            note = "regarde"
        out.append((r["Name"], None, r.get("Year"), note, "film"))
    return out


def _generique(rows, col):
    """Tout autre CSV avec une colonne de titres (historique Prime Video de la demande de données Amazon, etc.)."""
    return [(r[col], None, None, "regarde", None) for r in rows if r.get(col, "").strip()]


def lire_export(nom, texte):
    texte = texte.lstrip("\ufeff")
    rows = list(csv.DictReader(io.StringIO(texte)))
    if not rows:
        raise ValueError("Fichier vide ou pas au format CSV.")
    cols = set(rows[0])
    if {"Const", "Your Rating"} <= cols:
        return "IMDb", _imdb(rows)
    if {"Name", "Letterboxd URI"} <= cols:
        return "Letterboxd", _letterboxd(rows)
    if {"Title Name", "Thumbs Value"} <= cols:
        return "Netflix (notes)", _netflix_notes(rows)
    if {"Title", "Date"} <= cols and len(cols) == 2:
        return "Netflix", _netflix(rows)
    for col in rows[0]:
        if col.strip().lower() in ("title", "titre", "name", "nom", "title name", "video title"):
            return "CSV", _generique(rows, col)
    raise ValueError("Format non reconnu : il faut un export Netflix, IMDb, Letterboxd ou un CSV avec une colonne Title.")


# ---------- Steam installé sur ce PC ----------
def _dossier_steam():
    if sys.platform == "win32":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
                return Path(winreg.QueryValueEx(k, "SteamPath")[0])
        except OSError:
            return Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Steam"
    for p in ("~/.steam/steam", "~/.local/share/Steam", "~/Library/Application Support/Steam"):
        if Path(p).expanduser().exists():
            return Path(p).expanduser()
    return None


def steam_local():
    """[(appid, minutes jouées)] lus dans localconfig.vdf, sans compte ni clé Steam."""
    d = _dossier_steam()
    if not d:
        return []
    out = []
    for f in d.glob("userdata/*/config/localconfig.vdf"):
        for appid, minutes in re.findall(r'"(\d+)"\s*\{[^{}]*?"Playtime"\s*"(\d+)"', f.read_text(encoding="utf-8", errors="ignore")):
            out.append((int(appid), int(minutes)))
    return out


# ---------- Facultatifs, réglés dans donnees/config.json ----------
def jellyfin(url, cle, utilisateur=None):
    """[(nom, imdb)] de la bibliothèque Jellyfin (films et séries)."""
    import requests
    h = {"Authorization": f'MediaBrowser Token="{cle}"'}
    out = []
    for u in requests.get(f"{url}/Users", headers=h, timeout=3).json():
        if utilisateur and u["Name"] != utilisateur:
            continue
        items = requests.get(f"{url}/Users/{u['Id']}/Items", headers=h, timeout=10, params={
            "Recursive": "true", "IncludeItemTypes": "Movie,Series", "Fields": "ProviderIds"}).json()["Items"]
        out += [(i["Name"], i.get("ProviderIds", {}).get("Imdb")) for i in items]
    return out


def excel(fichier, feuille, colonne=2):
    import openpyxl
    wb = openpyxl.load_workbook(Path(fichier).expanduser(), read_only=True)
    return [r[colonne - 1] for r in list(wb[feuille].iter_rows(values_only=True))[1:] if r[colonne - 1]]
