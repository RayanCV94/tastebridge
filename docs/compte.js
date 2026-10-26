// Compte optionnel (site uniquement) : e-mail + mot de passe via Supabase Auth.
// Le mot de passe est géré et haché par Supabase, jamais vu par ce code. Le profil
// (les notes) est rangé dans la table « profils », lisible seulement par son propriétaire
// (règles RLS). La clé ci-dessous est la clé publique « anon » : elle est faite pour
// être dans le navigateur, elle ne donne accès qu'à ce que les règles RLS permettent.
const SUPA_URL = "https://ryvqymggtvosrijdxmzg.supabase.co";
const SUPA_CLE = "sb_publishable_HzOqlGPtg9qhTVESavdHGw_ZLKp95f4";

(() => {
  const sb = supabase.createClient(SUPA_URL, SUPA_CLE);
  let user = null, envoi = null, applique = false;

  const css = document.createElement("style");
  css.textContent = `
.connexion{display:flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--trait);background:var(--surface);color:var(--texte);font:500 13px Onest,sans-serif;cursor:pointer;white-space:nowrap;transition:border-color .2s}
.connexion:hover{border-color:var(--ambre)}
.connexion i{width:8px;height:8px;border-radius:50%;background:var(--menthe)}
.voile-compte{position:fixed;inset:0;z-index:40;background:rgba(5,5,8,.7);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px}
.boite{width:min(400px,100%);background:var(--surface);border:1px solid var(--trait2);border-radius:18px;padding:28px;box-shadow:var(--ombre)}
.boite h3{font:400 28px/1.1 Gloock,serif;margin:0 0 6px}
.boite p{color:var(--doux);font-size:13.5px;margin:0 0 18px}
.boite label{display:block;font-size:12.5px;color:var(--doux);margin:12px 0 6px}
.boite input{width:100%;background:var(--surface2);border:1px solid var(--trait);border-radius:10px;padding:11px 13px;color:var(--texte);font:15px Onest,sans-serif;outline:none}
.boite input:focus{border-color:var(--ambre)}
.boite .principal{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;background:var(--ambre);color:#16110a;font:600 15px Onest,sans-serif;cursor:pointer}
.boite .principal:disabled{opacity:.6;cursor:wait}
.boite .lien{background:none;border:0;color:var(--ambre);font:inherit;cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px}
.boite .bas{display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:13px;color:var(--doux)}
.boite .msg{min-height:20px;margin-top:12px;font-size:13px;color:var(--rouge)}
.boite .msg.ok{color:var(--menthe)}`;
  document.head.append(css);

  const bouton = document.createElement("button");
  bouton.className = "connexion";
  document.querySelector(".gh").before(bouton);
  bouton.onclick = () => user ? menuCompte() : fenetre("entrer");

  function maj() {
    bouton.innerHTML = user ? `<i></i>${user.email.split("@")[0]}` : "Se connecter";
    bouton.title = user ? `Connecté : ${user.email}` : "Garder tes goûts sur tous tes appareils";
  }

  function fermer() { document.querySelector(".voile-compte")?.remove(); }

  function fenetre(mode) {
    fermer();
    const nouveau = mode === "creer";
    const v = document.createElement("div");
    v.className = "voile-compte";
    v.innerHTML = `<form class="boite">
  <h3>${nouveau ? "Créer un compte" : "Se connecter"}</h3>
  <p>Tes notes suivent sur tous tes appareils. Pas de compte : elles restent dans ce navigateur.</p>
  <label for="c-mail">E-mail</label><input id="c-mail" type="email" autocomplete="email" required>
  <label for="c-mdp">Mot de passe${nouveau ? " (8 caractères minimum)" : ""}</label>
  <input id="c-mdp" type="password" minlength="${nouveau ? 8 : 1}" autocomplete="${nouveau ? "new-password" : "current-password"}" required>
  <button class="principal">${nouveau ? "Créer mon compte" : "Se connecter"}</button>
  <div class="msg" role="status"></div>
  <div class="bas"><span>${nouveau ? "Déjà un compte ?" : "Pas encore de compte ?"}</span>
   <button type="button" class="lien">${nouveau ? "Se connecter" : "Créer un compte"}</button></div>
</form>`;
    document.body.append(v);
    v.onclick = e => { if (e.target === v) fermer(); };
    v.querySelector(".lien").onclick = () => fenetre(nouveau ? "entrer" : "creer");
    v.querySelector("#c-mail").focus();
    const msg = v.querySelector(".msg"), go = v.querySelector(".principal");
    v.querySelector("form").onsubmit = async e => {
      e.preventDefault();
      go.disabled = true; msg.className = "msg"; msg.textContent = "";
      const email = v.querySelector("#c-mail").value.trim(), password = v.querySelector("#c-mdp").value;
      const { data, error } = nouveau
        ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
        : await sb.auth.signInWithPassword({ email, password });
      go.disabled = false;
      if (error) { msg.textContent = traduire(error.message); return; }
      if (nouveau && !data.session) { msg.className = "msg ok"; msg.textContent = "Compte créé. Clique le lien reçu par e-mail pour l'activer."; return; }
      fermer();
    };
  }

  function menuCompte() {
    fermer();
    const v = document.createElement("div");
    v.className = "voile-compte";
    v.innerHTML = `<div class="boite"><h3>Ton compte</h3><p>${user.email}<br>Tes notes sont synchronisées automatiquement.</p>
  <button class="principal">Se déconnecter</button></div>`;
    document.body.append(v);
    v.onclick = e => { if (e.target === v) fermer(); };
    v.querySelector(".principal").onclick = async () => { await sb.auth.signOut(); fermer(); };
  }

  function traduire(m) {
    if (/invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/already registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
    if (/not confirmed/i.test(m)) return "Active d'abord ton compte avec le lien reçu par e-mail.";
    if (/password/i.test(m)) return "Mot de passe trop faible (8 caractères minimum).";
    if (/rate limit/i.test(m)) return "Trop d'essais, réessaie dans quelques minutes.";
    return m;
  }

  // À la connexion : on fusionne les notes du compte et celles de ce navigateur
  async function recuperer() {
    const { data, error } = await sb.from("profils").select("notes").eq("id", user.id).maybeSingle();
    if (error) { console.warn(error.message); return; }
    const locales = JSON.parse(Moteur.exporter()).notes || {};
    const notes = { ...(data?.notes || {}), ...locales };
    applique = true;
    Moteur.restaurer(JSON.stringify({ notes }));
    applique = false;
    await envoyer();
    rafraichir();
  }

  async function envoyer() {
    if (!user) return;
    const notes = JSON.parse(Moteur.exporter()).notes || {};
    const { error } = await sb.from("profils").upsert({ id: user.id, notes, maj: new Date().toISOString() });
    if (error) console.warn(error.message);
  }

  function rafraichir() { dispatchEvent(new CustomEvent("profil-recharge")); }

  addEventListener("profil-change", () => {
    if (!user || applique) return;
    clearTimeout(envoi);
    envoi = setTimeout(envoyer, 800);
  });

  // ---------- Avis et commentaires ----------
  // Tout texte venant d'un visiteur passe par echap() avant d'entrer dans la page (pas d'injection de HTML)
  const echap = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  const etoiles = n => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  css.textContent += `
.avis-boite{width:min(560px,100%);max-height:88vh;display:flex;flex-direction:column}
.avis-boite .resume{display:flex;align-items:baseline;gap:10px;margin:2px 0 16px;color:var(--doux);font-size:13.5px}
.avis-boite .resume b{font:400 30px Gloock,serif;color:var(--texte)}
.avis-boite .liste{overflow:auto;display:flex;flex-direction:column;gap:10px;margin:0 -4px;padding:0 4px;flex:1;min-height:60px}
.un-avis{background:var(--surface2);border:1px solid var(--trait);border-radius:12px;padding:12px 14px}
.un-avis .haut{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--doux)}
.un-avis .haut strong{color:var(--texte);font-weight:600}
.un-avis .st,.saisie .st button{color:var(--ambre);letter-spacing:1px}
.un-avis p{margin:6px 0 0;color:var(--texte);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
.un-avis .suppr{background:none;border:0;color:var(--pale);font:12px Onest,sans-serif;cursor:pointer;padding:0;margin-top:6px;text-decoration:underline}
.saisie{border-top:1px solid var(--trait);margin-top:16px;padding-top:14px}
.saisie .st{display:flex;gap:2px;margin-bottom:8px}
.saisie .st button{background:none;border:0;font-size:26px;line-height:1;cursor:pointer;padding:2px;color:var(--trait2)}
.saisie .st button.on{color:var(--ambre)}
.saisie textarea{width:100%;min-height:76px;resize:vertical;background:var(--surface2);border:1px solid var(--trait);border-radius:10px;padding:10px 12px;color:var(--texte);font:14px/1.5 Onest,sans-serif;outline:none}
.saisie textarea:focus,.saisie input:focus{border-color:var(--ambre)}
.saisie .ligne{display:flex;gap:8px;margin-top:8px}
.saisie input{flex:1;min-width:0;background:var(--surface2);border:1px solid var(--trait);border-radius:10px;padding:10px 12px;color:var(--texte);font:14px Onest,sans-serif;outline:none}
.saisie .principal{width:auto;margin:0;padding:10px 18px}`;

  window.ouvrirAvis = async bouton => {
    fermer();
    const item = bouton.dataset.id, titre = bouton.dataset.t;
    const v = document.createElement("div");
    v.className = "voile-compte";
    v.innerHTML = `<div class="boite avis-boite"><h3>${echap(titre)}</h3><div class="resume">Chargement des avis...</div><div class="liste"></div><div class="saisie"></div></div>`;
    document.body.append(v);
    v.onclick = e => { if (e.target === v) fermer(); };
    const { data, error } = await sb.from("avis").select("id,user_id,pseudo,note,texte,cree").eq("item", item).order("cree", { ascending: false }).limit(200);
    const res = v.querySelector(".resume"), liste = v.querySelector(".liste"), saisie = v.querySelector(".saisie");
    if (error) { res.textContent = "Avis indisponibles pour le moment."; return; }
    const moy = data.length ? data.reduce((s, a) => s + a.note, 0) / data.length : 0;
    res.innerHTML = data.length ? `<b>${moy.toFixed(1).replace(".", ",")}</b><span>sur 5 · ${data.length} avis</span>` : "<span>Aucun avis pour l'instant. Sois le premier.</span>";
    liste.innerHTML = data.map(a => `<div class="un-avis"><div class="haut"><span><strong>${echap(a.pseudo)}</strong> <span class="st">${etoiles(a.note)}</span></span><span>${new Date(a.cree).toLocaleDateString("fr-FR")}</span></div>
${a.texte ? `<p>${echap(a.texte)}</p>` : ""}${user && a.user_id === user.id ? `<button class="suppr" data-sup="${a.id}">Supprimer mon avis</button>` : ""}</div>`).join("");
    liste.querySelectorAll("[data-sup]").forEach(b => b.onclick = async () => {
      await sb.from("avis").delete().eq("id", b.dataset.sup);
      ouvrirAvis(bouton);
    });
    if (!user) {
      saisie.innerHTML = `<button class="principal">Se connecter pour donner ton avis</button>`;
      saisie.querySelector("button").onclick = () => fenetre("entrer");
      return;
    }
    const mien = data.find(a => a.user_id === user.id);
    let note = mien?.note || 0;
    let pseudo = mien?.pseudo || "";
    try { pseudo ||= localStorage.getItem("tastebridge-pseudo") || ""; } catch {}
    saisie.innerHTML = `<div class="st" role="radiogroup" aria-label="Ta note">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} sur 5">★</button>`).join("")}</div>
<textarea maxlength="1000" placeholder="Ton avis (facultatif) : ce que tu as aimé, ou pas...">${echap(mien?.texte || "")}</textarea>
<div class="ligne"><input maxlength="30" placeholder="Ton pseudo" value="${echap(pseudo)}"><button class="principal">${mien ? "Mettre à jour" : "Publier"}</button></div>
<div class="msg" role="status"></div>`;
    const boutons = saisie.querySelectorAll(".st button"), msg = saisie.querySelector(".msg");
    const peindre = () => boutons.forEach(b => b.classList.toggle("on", +b.dataset.n <= note));
    boutons.forEach(b => b.onclick = () => { note = +b.dataset.n; peindre(); });
    peindre();
    saisie.querySelector(".principal").onclick = async () => {
      const texte = saisie.querySelector("textarea").value.trim(), ps = saisie.querySelector("input").value.trim();
      msg.className = "msg";
      if (!note) { msg.textContent = "Choisis une note de 1 à 5 étoiles."; return; }
      if (ps.length < 2) { msg.textContent = "Choisis un pseudo (2 caractères minimum)."; return; }
      const { error } = await sb.from("avis").upsert({ user_id: user.id, item, pseudo: ps, note, texte }, { onConflict: "user_id,item" });
      if (error) { msg.textContent = "Envoi impossible : " + error.message; return; }
      try { localStorage.setItem("tastebridge-pseudo", ps); } catch {}
      ouvrirAvis(bouton);
    };
  };

  sb.auth.onAuthStateChange((evt, session) => {
    const avant = user?.id;
    user = session?.user || null;
    maj();
    if (user && user.id !== avant) setTimeout(recuperer, 0);
  });
  maj();
})();
