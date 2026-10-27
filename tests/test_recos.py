# Tests du moteur local (recos.py) sur le vrai catalogue. Lancer : python -m unittest discover tests
import os, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["RECOS_SANS_NAVIGATEUR"] = "1"
import recos as R  # noqa: E402

DAS_BOOT, SOCIAL_NETWORK, DARK_KNIGHT = "Q62730", "Q185888", "Q163872"


def profil(**notes):
    return {"notes": notes, "exclus": []}


class Recos(unittest.TestCase):
    def test_recos_cite_des_titres_aimes_avec_leur_id(self):
        p = profil(**{DAS_BOOT: "adore", SOCIAL_NETWORK: "aime"})
        r = R.recos(p, "film", ["film", "serie"], 5)
        self.assertEqual(len(r), 5)
        for x in r:
            self.assertNotIn(x["id"], p["notes"])  # jamais un titre déjà noté
            for pq in x["parce_que"]:
                self.assertIn(pq["id"], p["notes"])
                self.assertEqual(pq["titre"], R.CAT[pq["id"]]["titre"])

    def test_profil_vide_aucune_reco(self):
        self.assertEqual(R.recos(profil(), "film", ["film"], 5), [])


class Fiche(unittest.TestCase):
    def test_titre_inconnu(self):
        self.assertIsNone(R.fiche(profil(), "Q_INEXISTANT"))

    def test_proches_meme_support_d_abord_puis_autres(self):
        f = R.fiche(profil(), DARK_KNIGHT)
        doms = [x["dom"] for x in f["similaires"]]
        self.assertTrue(0 < len(doms) <= 12)
        self.assertEqual(doms[: doms.count("film")], ["film"] * doms.count("film"))
        self.assertTrue({"serie", "jeu"} & set(doms), "doit proposer d'autres supports")
        self.assertNotIn(DARK_KNIGHT, [x["id"] for x in f["similaires"]])
        for x in f["similaires"]:
            self.assertTrue(set(x["communs"]) <= set(R.CAT[DARK_KNIGHT]["themes"]))

    def test_pour_toi_sans_profil_puis_avec(self):
        self.assertIsNone(R.fiche(profil(), DARK_KNIGHT)["pour_toi"])
        pt = R.fiche(profil(**{DAS_BOOT: "adore"}), DARK_KNIGHT)["pour_toi"]
        self.assertTrue(0 <= pt["match"] <= 100)

    def test_note_courante(self):
        self.assertEqual(R.fiche(profil(**{DARK_KNIGHT: "aime"}), DARK_KNIGHT)["note"], "aime")


class Listes(unittest.TestCase):
    def test_liste_theme(self):
        l = R.liste(["Western"], None)
        self.assertGreater(l["total"], 0)
        self.assertLessEqual(len(l["titres"]), 60)
        self.assertTrue(all("Western" in R.CAT[x["id"]]["themes"] for x in l["titres"]))
        q = [R.CAT[x["id"]]["qualite"] for x in l["titres"]]
        self.assertEqual(q, sorted(q, reverse=True))

    def test_liste_annee(self):
        self.assertTrue(all(R.CAT[x["id"]].get("annee") == 1994 for x in R.liste([], 1994)["titres"]))


class Recherche(unittest.TestCase):
    def test_titre_francais_et_anglais(self):
        self.assertEqual(R.chercher("das boot")[0]["id"], DAS_BOOT)
        self.assertEqual(R.chercher("le bateau")[0]["id"], DAS_BOOT)
        self.assertIn("themes", R.chercher("das boot")[0])

    def test_trop_court(self):
        self.assertEqual(R.chercher("a"), [])


if __name__ == "__main__":
    unittest.main()
