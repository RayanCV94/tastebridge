# tastebridge

**Movie, TV show and video game recommendations that cross the line between screens.**
Liked *The Dark Knight*? Here are crime-noir superhero games. Played *Dying Light*? Here are zombie films.
Runs 100 % locally, no account, no API key, no tracking.

*Version française plus bas.*

![Games tab](docs/jeux.jpg)

## Why

Streaming platforms recommend only inside their own catalogue, and only one medium at a time.
But taste is not tied to a medium: someone who loves slow, atmospheric horror films will often love the same thing in a game.
tastebridge builds **one taste profile across films, series and games** and recommends in two ways:

- **within a medium** (games from your games, films from your films), because you can like a genre in games and not in films;
- **across media** (games from your films, films from your games), with the reason shown on every card: *"because you liked X and Y"*.

## How it works

1. **Catalogue** (`construire.py`): ~3,600 films and ~2,400 series from [Wikidata](https://www.wikidata.org) (genres and main subjects), ~2,500 well-reviewed Steam games from [SteamSpy](https://steamspy.com) (community tags, review ratio), posters from Wikipedia. All free, open sources, no key.
2. **Shared theme vocabulary** (`themes.py`): Wikidata genres and Steam tags are mapped onto 27 common themes (horror, cyberpunk, heist, open world, souls-like...). This is the bridge between media.
3. **Vectors**: each title becomes a TF-IDF-weighted theme vector, so rare themes (Western) weigh more than ubiquitous ones (Action).
4. **Profile**: weighted sum of the vectors of what you rated (loved +2, liked +1, watched +0.5, disliked -1, hated -2).
5. **Ranking**: cosine similarity between profile and candidates, multiplied by a quality score (Wikipedia language coverage for screens, Steam review ratio and volume for games) and a recency factor that keeps acclaimed classics.
6. Already seen / owned titles are excluded automatically.

## Evaluation

`python evaluer.py` runs a leave-one-out test: each liked title is hidden, recommendations are computed from the rest of the profile, and we record the rank at which the hidden title comes back.

Result on the author's profile (37 liked titles):

| method | Hit@10 | Hit@50 | median rank |
|---|---|---|---|
| **themes (this project)** | **35 %** | **46 %** | **57** |
| most popular first | 5 % | 35 % | 117 |
| random | 0 % | 3 % | 1128 |

Limits, honestly: one user, a small profile, and themes only (no collaborative filtering, so no "people who liked X also liked Y"). Wikidata genres are sometimes noisy.

## Import your history

In the **Mes goûts** tab, drop a CSV export. Files are read on your machine, nothing is uploaded.

| Source | How to get the file | What is used |
|---|---|---|
| Netflix | Account > Profile > Viewing activity > *Download all* (`NetflixViewingHistory.csv`) | titles watched; a series with 3+ episodes counts as liked |
| Netflix ratings | Account > *Download your personal information* > `Ratings.csv` | thumbs up / down / double up |
| IMDb | Your ratings > ... > *Export* | your 1-10 ratings, including video games |
| Letterboxd | Settings > Data > *Export your data* (`ratings.csv`, `watched.csv`) | your 0.5-5 ratings |
| Prime Video, others | Amazon has no export button: request your data from Amazon, or any CSV with a `Title` column | titles watched |
| Steam | nothing to do: games installed or played on this PC are read from Steam's local files | excluded from recommendations |

Netflix, Prime Video and Disney+ have no public API, so a "connect with Netflix" button is not possible without breaking their terms: CSV export is the clean way.

Optional, in `donnees/config.json` (never committed):

```json
{
 "jellyfin": {"url": "http://localhost:8096", "cle": "YOUR_JELLYFIN_API_KEY", "utilisateur": "YourName"},
 "listes_jeux_possedes": [{"fichier": "~/games.xlsx", "feuille": "Owned", "colonne": 2}]
}
```

## Run it

```bash
pip install -r requirements.txt
python recos.py
```

The page opens at http://127.0.0.1:5077. On Windows, double-click `lancer.vbs` to start it without a console window.
The server stops by itself 3 minutes after the page is closed: nothing runs in the background.

Rebuild the catalogue (about 1 hour, mostly polite SteamSpy rate limits): `python construire.py`, or `--jeux` / `--affiches` for one part.

## Privacy and security

- The server listens on `127.0.0.1` only: not reachable from your network or the internet.
- Requests from other websites are refused (Host and Origin checks, custom header required to write), so a malicious page cannot read or change your profile.
- Your ratings, settings and logs live in `donnees/`, which is git-ignored.
- No API key is needed or stored in the code. The only outgoing requests are poster images loaded by your browser (Wikipedia, Steam CDN).

## Data and licences

Code: MIT. Wikidata content is CC0. Game data comes from SteamSpy. Posters are not stored: the catalogue only keeps their Wikipedia URLs, and they remain the property of their rights holders.

---

## Version française

**Recommandations de films, séries et jeux vidéo qui passent d'un écran à l'autre.** Tu as aimé *The Dark Knight* ? Voici des jeux de super-héros façon polar. Tu as joué à *Dying Light* ? Voici des films de zombies. Tout tourne sur ton PC, sans compte ni clé.

- Un seul profil de goûts pour films, séries et jeux, avec deux sortes de recos : dans le même domaine, et d'un domaine à l'autre, chaque fois avec la raison (« parce que tu as aimé X et Y »).
- Méthode : 27 thèmes communs (horreur, cyberpunk, braquage, monde ouvert...), vecteurs TF-IDF, similarité cosinus, pondérée par la qualité (avis Steam, couverture Wikipédia) et la récence.
- Évaluation « leave-one-out » : un titre aimé caché ressort dans le top 10 dans 35 % des cas, contre 5 % pour « les plus populaires d'abord » et 0 % au hasard.
- Import d'historique : Netflix, IMDb, Letterboxd, ou tout CSV avec une colonne Title ; Steam est lu tout seul.
- Lancer : `pip install -r requirements.txt` puis `python recos.py` (ou double-clic sur `lancer.vbs` sous Windows). La page s'ouvre, et le serveur s'arrête seul 3 minutes après sa fermeture.

![Onglet films](docs/films.jpg)
