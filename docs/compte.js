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

  const ICONE_MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  const bouton = document.createElement("button");
  bouton.className = "connexion";
  document.querySelector(".gh").before(bouton);
  bouton.onclick = () => user ? menuCompte() : fenetre("entrer");

  function maj() {
    bouton.innerHTML = user ? `<i></i>${user.email.split("@")[0]}` : "Connexion";
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
  <p>Tes goûts sont sauvegardés et te suivent sur tous tes appareils. Ceux déjà notés ici sont repris dans ton compte.${nouveau ? `<span class="note-mail">${ICONE_MAIL}<span>Tu vas recevoir un e-mail de confirmation envoyé par <b>Supabase</b>, le service qui gère les comptes de Tastebridge (pense à regarder dans les spams).</span></span>` : ""}</p>
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
      if (nouveau && !data.session) { msg.className = "msg ok"; msg.textContent = "Compte créé. Clique le lien de l'e-mail « Supabase » pour l'activer (regarde aussi les spams)."; return; }
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
.avis-boite{position:relative;width:min(640px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:auto}
.fermer-fiche{position:absolute;top:10px;right:12px;width:36px;height:36px;border:0;border-radius:10px;background:var(--surface2);color:var(--doux);font-size:22px;cursor:pointer}
.fond-fiche{position:absolute;inset:0 0 auto;height:220px;background-size:cover;background-position:center 25%;filter:blur(28px) saturate(1.2);opacity:.45;transform:scale(1.2);pointer-events:none;mask-image:linear-gradient(#000,transparent)}
.avis-boite{overflow-x:hidden}
.avis-boite>*:not(.fond-fiche):not(.fermer-fiche){position:relative}
.fiche{display:grid;grid-template-columns:140px 1fr;gap:20px;margin-bottom:8px;padding-top:34px}
.fiche .aff{box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1)}
.avis-boite .resume{flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px}
.moyenne{display:flex;align-items:baseline;gap:8px}
.histo{display:flex;align-items:flex-end;gap:3px;height:34px;width:90px}
.histo i{flex:1;background:var(--ambre);opacity:.75;border-radius:2px 2px 0 0}
.fiche .aff{aspect-ratio:2/3;border-radius:12px;overflow:hidden;background:var(--surface2)}
.fiche .aff img{width:100%;height:100%;object-fit:cover;display:block}
.fiche .type{font-size:12.5px;color:var(--pale)}
.fiche h3{margin:4px 40px 10px 0}
.fiche .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.fiche .ext{font-size:13px;color:var(--doux)}
.avis-boite .sous{font:600 13px Onest,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--pale);margin:12px 0 10px;padding-top:14px;border-top:1px solid var(--trait)}
.avis-boite .liste{flex:none!important}
@media(max-width:520px){.fiche{grid-template-columns:96px 1fr;gap:14px}.fiche h3{font-size:22px}}
.avis-boite .resume{display:flex;align-items:baseline;gap:10px;margin:2px 0 16px;color:var(--doux);font-size:13.5px}
.avis-boite .resume b{font:400 30px Gloock,serif;color:var(--texte)}
.avis-boite .liste{overflow:auto;display:flex;flex-direction:column;gap:10px;margin:0 -4px;padding:0 4px;flex:1;min-height:60px}
.un-avis{padding:14px 2px;border-bottom:1px solid var(--trait)}.un-avis:last-child{border-bottom:0}
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
    // En-tête de fiche : affiche, infos, lien externe (FICHES est rempli par la page)
    const f = typeof FICHES !== "undefined" ? FICHES[item] : null;
    const ext = f ? (f.steam ? `https://store.steampowered.com/app/${f.steam}` : `https://fr.wikipedia.org/wiki/Special:Search/${encodeURIComponent(f.titre)}`) : "";
    const tete = f ? `<div class="fiche"><div class="aff">${f.image ? `<img src="${echap(visuel(f))}" alt="">` : ""}</div><div>
<span class="type">${{film: "Film", serie: "Série", jeu: "Jeu"}[f.dom]}${f.annee ? " · " + f.annee : ""}</span><h3>${echap(titre)}</h3>
<div class="chips">${(f.themes || []).map(t => `<span class="chip">${echap(t)}</span>`).join("")}</div>
<div class="resume">Chargement des avis...</div>
<a class="ext" href="${ext}" target="_blank" rel="noopener">${f.steam ? "Voir sur Steam" : "Voir sur Wikipédia"}</a></div></div>` : `<h3>${echap(titre)}</h3><div class="resume">Chargement des avis...</div>`;
    const fond = f?.image ? `<div class="fond-fiche" style="background-image:url('${echap(f.image)}')"></div>` : "";
    v.innerHTML = `<div class="boite avis-boite">${fond}<button class="fermer-fiche" aria-label="Fermer">×</button>${tete}<h4 class="sous">Avis</h4><div class="liste"></div><div class="saisie"></div></div>`;
    document.body.append(v);
    v.onclick = e => { if (e.target === v || e.target.closest(".fermer-fiche")) fermer(); };
    const { data, error } = await sb.from("avis").select("id,user_id,pseudo,note,texte,cree").eq("item", item).order("cree", { ascending: false }).limit(200);
    const res = v.querySelector(".resume"), liste = v.querySelector(".liste"), saisie = v.querySelector(".saisie");
    if (error) { res.textContent = "Avis indisponibles pour le moment."; return; }
    const moy = data.length ? data.reduce((s, a) => s + a.note, 0) / data.length : 0;
    const par = [1, 2, 3, 4, 5].map(n => data.filter(a => a.note === n).length), haut = Math.max(1, ...par);
    res.innerHTML = data.length ? `<div class="moyenne"><b>${moy.toFixed(1).replace(".", ",")}</b><span>sur 5 · ${data.length} avis</span></div>
<div class="histo" aria-label="Répartition des notes">${par.map((c, i) => `<i style="height:${Math.max(4, c / haut * 100)}%" title="${i + 1} sur 5"></i>`).join("")}</div>` : "<span>Aucun avis pour l'instant. Sois le premier.</span>";
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
      chargerNotes();
      ouvrirAvis(bouton);
    };
  };

  // Moyenne de chaque œuvre, pour le badge étoile et le tri « Mieux notés »
  async function chargerNotes() {
    const { data, error } = await sb.from("avis").select("item,note").limit(10000);
    if (error) return;
    const t = {};
    data.forEach(a => { const x = t[a.item] ||= [0, 0]; x[0] += a.note; x[1]++; });
    window.NOTES = Object.fromEntries(Object.entries(t).map(([k, [s, n]]) => [k, [s / n, n]]));
    dispatchEvent(new CustomEvent("notes-moyennes"));
  }
  chargerNotes();

  sb.auth.onAuthStateChange((evt, session) => {
    const avant = user?.id;
    user = session?.user || null;
    maj();
    if (user && user.id !== avant) setTimeout(recuperer, 0);
  });
  maj();

  // ---------- Invitation douce à créer un compte ----------
  // Tout marche sans compte. Après 5 recherches ou lancers de dé, une carte propose d'en créer un.
  // Elle ne bloque rien, se ferme d'un clic et ne revient pas une fois fermée.
  const SEUIL = 5;
  const lire = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  addEventListener("action-visiteur", () => {
    const n = +lire("tastebridge-actions", 0) + 1;
    ecrire("tastebridge-actions", n);
    if (n >= SEUIL && !user && !lire("tastebridge-invite-fermee", "") && !document.querySelector(".invite")) inviter();
  });
  function inviter() {
    const c = document.createElement("aside");
    c.className = "invite";
    c.setAttribute("role", "dialog");
    c.setAttribute("aria-label", "Créer un compte");
    c.innerHTML = `<button class="x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
<h4>Garde tes goûts pour de bon</h4>
<p>Avec un compte gratuit, tes notes sont sauvegardées et tu les retrouves sur ton téléphone comme sur ton PC. Celles déjà notées ici sont reprises.</p>
<p class="note-mail">${ICONE_MAIL}<span>L'e-mail de confirmation vient de <b>Supabase</b>, notre service de comptes (vérifie les spams).</span></p>
<div class="boutons"><button class="principal">Créer mon compte</button><button class="plus-tard">Plus tard</button></div>`;
    document.body.append(c);
    const fermerInvite = () => { ecrire("tastebridge-invite-fermee", "1"); c.remove(); };
    c.querySelector(".x").onclick = fermerInvite;
    c.querySelector(".plus-tard").onclick = fermerInvite;
    c.querySelector(".principal").onclick = () => { c.remove(); fenetre("creer"); };
  }
  css.textContent += `
.note-mail{display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(232,163,61,.08);border:1px solid rgba(232,163,61,.22);color:var(--texte);font-size:12.5px;line-height:1.45}
.note-mail svg{width:16px;height:16px;flex:none;margin-top:1px;color:var(--ambre)}
.invite{position:fixed;z-index:35;right:20px;bottom:20px;width:min(360px,calc(100% - 32px));background:var(--surface);border:1px solid var(--trait2);border-radius:16px;padding:20px;box-shadow:var(--ombre);animation:monte .45s var(--sortie)}
@keyframes monte{from{opacity:0;transform:translateY(16px)}}
.invite h4{margin:0 28px 6px 0;font:400 22px/1.15 Gloock,serif}
.invite p{margin:0;color:var(--doux);font-size:13.5px}
.invite .x{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:8px;background:none;color:var(--doux);cursor:pointer}
.invite .x:hover{background:var(--surface2);color:var(--texte)}
.invite .x svg{width:16px;height:16px}
.invite .boutons{display:flex;gap:8px;margin-top:14px}
.invite .principal{flex:1;margin:0;padding:11px;border:0;border-radius:10px;background:var(--ambre);color:#16110a;font:600 14px Onest,sans-serif;cursor:pointer}
.invite .plus-tard{padding:11px 14px;border:1px solid var(--trait);border-radius:10px;background:none;color:var(--doux);font:500 14px Onest,sans-serif;cursor:pointer}
@media(max-width:600px){.invite{right:16px;left:16px;bottom:16px;width:auto}}
@media(prefers-reduced-motion:reduce){.invite{animation:none}}`;
})();
