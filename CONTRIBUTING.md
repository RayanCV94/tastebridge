# Contributing to Tastebridge

Thanks for wanting to help! Issues and pull requests are welcome, in English or French.

## Start in one minute

```bash
git clone https://github.com/RayanCV94/tastebridge && cd tastebridge
python3 recos.py                      # local version, Python standard library only
python3 -m http.server -d docs 8000   # or the website version: http://localhost:8000
```

## How the project is organised

| File | Role |
|---|---|
| `page.html` | The whole interface (vanilla JS, no framework), shared by the website and the local version |
| `moteur.js` | Recommendation engine for the website (runs in the browser) |
| `recos.py` | Local version: same engine in Python + a small local server |
| `compte.js`, `langue.js` | Optional account (Supabase) and English translation, website only |
| `construire.py`, `notes.py`, `disponibilites.py`, `tendances.py`, `communaute.py` | Build steps that produce `catalogue.json` and the small JSON files |
| `site.py` | Regenerates `docs/` (the website) from the files above |
| `tests/` | Python and Node tests, plus browser tests (Playwright) |

**After changing `page.html`, `moteur.js`, `compte.js` or `langue.js`, run `python3 site.py`**: CI checks that `docs/` is up to date.

## Before opening a pull request

```bash
pip install ruff && ruff check .
python3 -m unittest discover tests
npm install && npx playwright install chromium && npm test
```

- Keep the stack: no framework and no new runtime dependency without a good reason (say why in the PR).
- Visible text is written in French in `page.html`; add its English version to `langue.js`.
- Escape anything coming from a visitor or an external API with `esc()` / `echap()`.
- Keep it accessible: real links and buttons, keyboard focus, `aria-label` when there is no visible text, `prefers-reduced-motion`.
- Never add data you are not allowed to publish (see the IMDb note in the README), and never invent a rating: show "not available".
- Small, focused PRs are easier to review. Describe what you tested.

## Good first issues

Look for the [`good first issue`](https://github.com/RayanCV94/tastebridge/labels/good%20first%20issue) label. Comment on the issue before starting so two people don't work on the same thing.

## Code of conduct

By taking part, you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).
