# Reconnaissance des titres dans les posts Reddit (hors ligne, sans identifiants)
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import communaute as C  # noqa: E402

CAT = {
    "a": {"dom": "jeu", "titre": "The Last of Us", "titre_en": "The Last of Us"},
    "b": {"dom": "jeu", "titre": "The Last of Us Part II", "titre_en": "The Last of Us Part II"},
    "c": {"dom": "jeu", "titre": "Control", "titre_en": "Control"},
    "d": {"dom": "jeu", "titre": "Hollow Knight", "titre_en": "Hollow Knight"},
    "e": {"dom": "film", "titre": "Hollow Knight", "titre_en": "Hollow Knight"},
    "f": {"dom": "jeu", "titre": "Doublon Game", "titre_en": "Doublon Game"},
    "g": {"dom": "jeu", "titre": "Doublon Game", "titre_en": "Doublon Game"},
}


class Mentions(unittest.TestCase):
    def setUp(self):
        self.idx = C.index_titres(CAT, "jeu")

    def test_titres_courts_ou_ambigus_ecartes(self):
        self.assertNotIn("control", self.idx)       # trop court : faux positifs (« lost control »)
        self.assertNotIn("doublon game", self.idx)  # deux jeux du même nom
        self.assertIn("hollow knight", self.idx)

    def test_titre_le_plus_long_l_emporte(self):
        m = C.mentions([("Just finished The Last of Us Part II, wow", 120)], self.idx)
        self.assertEqual(m, {"b": 120})

    def test_mots_entiers_et_cumul(self):
        m = C.mentions([("Hollow Knight is a masterpiece", 50), ("hollow knightmare fuel", 900), ("THE LAST OF US: my thoughts", 0)], self.idx)
        self.assertEqual(m, {"d": 50, "a": 1})

    def test_support_respecte(self):
        self.assertEqual(C.index_titres(CAT, "film"), {"hollow knight": "e"})


if __name__ == "__main__":
    unittest.main()
