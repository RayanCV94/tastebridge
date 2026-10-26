# Vocabulaire commun aux films, séries et jeux : c'est lui qui permet de passer
# d'un domaine à l'autre (« tu aimes les films d'horreur, voici un jeu d'horreur »).
# wd = mots cherchés dans les genres/sujets Wikidata (anglais), steam = tags Steam exacts.
import re

THEMES = {
    "Horreur":            {"wd": ["horror", "slasher", "supernatural"], "steam": ["Horror", "Psychological Horror", "Survival Horror"]},
    "Zombies":            {"wd": ["zombie"], "steam": ["Zombies"]},
    "Science-fiction":    {"wd": ["science fiction", "space opera", "extraterrestrial", "time travel"], "steam": ["Sci-fi", "Space", "Aliens", "Time Travel"]},
    "Cyberpunk, dystopie": {"wd": ["cyberpunk", "dystopi"], "steam": ["Cyberpunk", "Dystopian "]},
    "Post-apocalyptique": {"wd": ["apocalyptic"], "steam": ["Post-apocalyptic"]},
    "Super-héros":        {"wd": ["superhero", "comic book"], "steam": ["Superhero"]},
    "Fantasy":            {"wd": ["fantasy", "sword and sorcery"], "steam": ["Fantasy", "Dark Fantasy", "Medieval", "Magic"]},
    "Action":             {"wd": ["action", "martial arts"], "steam": ["Hack and Slash", "Martial Arts", "Character Action Game", "Fast-Paced"]},
    "Aventure":           {"wd": ["adventure"], "steam": ["Adventure", "Exploration"]},
    "Polar, gangsters":   {"wd": ["crime", "heist", "gangster", "noir", "detective", "police procedural"], "steam": ["Crime", "Heist", "Noir", "Detective"]},
    "Thriller, mystère":  {"wd": ["thriller", "mystery", "psychological", "suspense"], "steam": ["Mystery", "Thriller", "Psychological", "Investigation"]},
    "Guerre":             {"wd": ["war"], "steam": ["War", "Military", "World War II"]},
    "Western":            {"wd": ["western"], "steam": ["Western"]},
    "Comédie":            {"wd": ["comedy", "sitcom", "parody"], "steam": ["Comedy", "Funny"]},
    "Histoire forte":     {"wd": ["drama"], "steam": ["Story Rich", "Emotional", "Choices Matter"]},
    "Historique":         {"wd": ["historical", "period", "epic film"], "steam": ["Historical"]},
    "Anime":              {"wd": ["anime"], "steam": ["Anime"]},
    "Survie":             {"wd": ["survival", "disaster"], "steam": ["Survival"]},
    "Espionnage, infiltration": {"wd": ["spy", "espionage"], "steam": ["Stealth"]},
    "Vengeance, vigilante": {"wd": ["vigilante", "revenge", "neo-noir"], "steam": []},
    # Thèmes propres aux jeux (servent aux recos « d'après tes jeux »)
    "Monde ouvert":       {"wd": [], "steam": ["Open World"]},
    "Souls-like":         {"wd": [], "steam": ["Souls-like", "Difficult"]},
    "RPG":                {"wd": [], "steam": ["RPG", "Action RPG", "CRPG"]},
    "Tir":                {"wd": [], "steam": ["FPS", "Shooter", "Third-Person Shooter"]},
    "Roguelike":          {"wd": [], "steam": ["Roguelike", "Roguelite"]},
    "Stratégie":          {"wd": [], "steam": ["Strategy", "Tactical", "Turn-Based Tactics"]},
    "Course, sport":      {"wd": ["sport", "racing"], "steam": ["Racing", "Sports"]},
}

_WD = {nom: [re.compile(r"\b" + re.escape(m)) for m in v["wd"]] for nom, v in THEMES.items()}
_STEAM = {t: nom for nom, v in THEMES.items() for t in v["steam"]}


def themes_wd(texte):
    texte = texte.lower()
    return sorted(nom for nom, motifs in _WD.items() if any(m.search(texte) for m in motifs))


def themes_steam(tags):
    return sorted({_STEAM[t] for t in tags if t in _STEAM})
