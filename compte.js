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
.voile-compte{position:fixed;inset:0;z-index:20;background:rgba(5,5,8,.7);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px}
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

  sb.auth.onAuthStateChange((evt, session) => {
    const avant = user?.id;
    user = session?.user || null;
    maj();
    if (user && user.id !== avant) setTimeout(recuperer, 0);
  });
  maj();
})();
