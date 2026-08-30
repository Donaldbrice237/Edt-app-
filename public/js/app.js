/* Application "Planning universitaire" — SPA vanille (sans framework).
   Organisation : state global + petit routeur + une fonction de rendu par vue. */

const state = {
  user: null,
  view: null,
  cache: {},
};

const JOUR_ORDRE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const els = {
  app: document.getElementById('app'),
  topbar: document.getElementById('topbar'),
  topbarNav: document.getElementById('topbarNav'),
  userLabel: document.getElementById('userLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  toast: document.getElementById('toast'),
};

function toast(message, isAlert = false) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.className = 'toast' + (isAlert ? ' alert' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function init() {
  if (Api.hasToken()) {
    try {
      const { user } = await Api.get('/auth/me');
      state.user = user;
      startApp();
      return;
    } catch (e) {
      Api.clearToken();
    }
  }
  renderLogin();
}

function renderLogin(errorMessage) {
  els.topbar.hidden = true;
  els.app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <span class="brand-mark">EDT</span>
        <h1>Planning universitaire</h1>
        <p class="sub">Connectez-vous pour saisir vos disponibilités ou gérer l'emploi du temps.</p>
        ${errorMessage ? `<div class="msg msg-alert">${esc(errorMessage)}</div>` : ''}
        <form id="loginForm">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" required autocomplete="username" />
          <label for="loginPassword">Mot de passe</label>
          <input id="loginPassword" type="password" required autocomplete="current-password" />
          <button class="btn btn-gold" type="submit" style="width:100%">Se connecter</button>
        </form>
        <p class="hint">Compte administrateur créé au premier démarrage du serveur (voir le fichier .env). Les comptes enseignants sont créés par l'administrateur depuis l'onglet « Enseignants ».</p>
      </div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await Api.post('/auth/login', { email, password });
      Api.setToken(res.token);
      state.user = res.user;
      startApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function startApp() {
  els.topbar.hidden = false;
  els.userLabel.textContent = `${state.user.prenom} ${state.user.nom} · ${state.user.role === 'admin' ? 'Administration' : 'Enseignant'}`;
  const nav = state.user.role === 'admin'
    ? [
        ['enseignants', 'Enseignants'],
        ['matieres', 'Matières'],
        ['salles', 'Salles'],
        ['creneaux', 'Créneaux'],
        ['cours', 'Cours'],
        ['planning', "Emploi du temps"],
      ]
    : [
        ['disponibilites', 'Mes disponibilités'],
        ['mon-planning', 'Mon emploi du temps'],
      ];

  els.topbarNav.innerHTML = nav.map(([id, label]) =>
    `<button data-view="${id}">${esc(label)}</button>`
  ).join('');
  els.topbarNav.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  navigate(nav[0][0]);
}

els.logoutBtn.addEventListener('click', () => {
  Api.clearToken();
  state.user = null;
  renderLogin();
});

function navigate(view) {
  state.view = view;
  els.topbarNav.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const routes = {
    enseignants: viewEnseignants,
    matieres: viewMatieres,
    salles: viewSalles,
    creneaux: viewCreneaux,
    cours: viewCours,
    planning: viewPlanningAdmin,
    disponibilites: viewDisponibilites,
    'mon-planning': viewPlanningEnseignant,
  };
  (routes[view] || renderLogin)();
}

function buildGrid(creneaux) {
  const jours = [...new Set(creneaux.map((c) => c.jour))].sort((a, b) => {
    const ia = JOUR_ORDRE.indexOf(a), ib = JOUR_ORDRE.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const timeKey = (c) => `${c.heureDebut}|${c.heureFin}`;
  const seen = new Map();
  creneaux.forEach((c) => {
    if (!seen.has(timeKey(c))) seen.set(timeKey(c), { heureDebut: c.heureDebut, heureFin: c.heureFin });
  });
  const times = [...seen.values()].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  const matrix = times.map((t) => jours.map((j) =>
    creneaux.find((c) => c.jour === j && c.heureDebut === t.heureDebut && c.heureFin === t.heureFin) || null
  ));
  return { jours, times, matrix };
}

function pageHeader(eyebrow, title, sub) {
  return `
    <div class="page-header">
      <div>
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h1>${esc(title)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </div>
    </div>
  `;
}

async function viewEnseignants() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Enseignants', "Créez un compte pour chaque enseignant afin qu'il puisse saisir ses disponibilités.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let liste;
  try { liste = await Api.get('/enseignants'); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un enseignant</h3></div>
      <form id="addForm">
        <div class="field-row">
          <div><label>Prénom</label><input name="prenom" required /></div>
          <div><label>Nom</label><input name="nom" required /></div>
        </div>
        <div class="field-row">
          <div><label>Email</label><input name="email" type="email" required /></div>
          <div><label>Mot de passe initial</label><input name="password" type="text" required minlength="6" /></div>
        </div>
        <button class="btn btn-gold" type="submit">Créer le compte</button>
      </form>
    </div>
    <div class="panel">
      <div class="panel-title"><h3>${liste.length} enseignant(s)</h3></div>
      <table>
        <thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>
        <tbody>
          ${liste.length ? liste.map((u) => `
            <tr>
              <td>${esc(u.prenom)} ${esc(u.nom)}</td>
              <td>${esc(u.email)}</td>
              <td><button class="btn btn-outline btn-sm" data-del="${u.id}">Supprimer</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="3">Aucun enseignant pour le moment.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Api.post('/enseignants', Object.fromEntries(fd));
      toast('Enseignant créé.');
      viewEnseignants();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet enseignant ? Ses disponibilités et cours associés seront aussi supprimés.')) return;
      try {
        await Api.del(`/enseignants/${btn.dataset.del}`);
        toast('Enseignant supprimé.');
        viewEnseignants();
      } catch (err) { toast(err.message, true); }
    });
  });
}

function crudSimpleView(config) {
  return async function () {
    els.app.innerHTML = `<div class="page">${pageHeader('Administration', config.titre, config.sous)}<div id="content">Chargement…</div></div>`;
    const content = document.getElementById('content');
    let liste;
    try { liste = await Api.get(config.endpoint); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

    content.innerHTML = `
      <div class="panel">
        <div class="panel-title"><h3>${config.formTitre}</h3></div>
        <form id="addForm">
          ${config.champs.map((c) => `
            <label>${esc(c.label)}</label>
            <input name="${c.name}" type="${c.type || 'text'}" ${c.required ? 'required' : ''} />
          `).join('')}
          <button class="btn btn-gold" type="submit">Ajouter</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-title"><h3>${liste.length} élément(s)</h3></div>
        <table>
          <thead><tr>${config.colonnes.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${liste.length ? liste.map((item) => `
              <tr>
                ${config.colonnes.map((c) => `<td>${esc(item[c.key] ?? '—')}</td>`).join('')}
                <td><button class="btn btn-outline btn-sm" data-del="${item.id}">Supprimer</button></td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="${config.colonnes.length + 1}">Aucun élément pour le moment.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        await Api.post(config.endpoint, fd);
        toast('Ajouté.');
        config.rerender();
      } catch (err) { toast(err.message, true); }
    });

    content.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Confirmer la suppression ?')) return;
        try {
          await Api.del(`${config.endpoint}/${btn.dataset.del}`);
          toast('Supprimé.');
          config.rerender();
        } catch (err) { toast(err.message, true); }
      });
    });
  };
}

const viewMatieres = crudSimpleView({
  titre: 'Matières',
  sous: "Les matières regroupent les cours à planifier (ex. Algorithmique, Droit civil…).",
  endpoint: '/matieres',
  formTitre: 'Ajouter une matière',
  champs: [
    { name: 'nom', label: 'Nom de la matière', required: true },
    { name: 'volumeHoraire', label: "Volume horaire (h, optionnel)", type: 'number' },
  ],
  colonnes: [{ key: 'nom', label: 'Nom' }, { key: 'volumeHoraire', label: 'Volume horaire' }],
  rerender: () => viewMatieres(),
});

const viewSalles = crudSimpleView({
  titre: 'Salles',
  sous: 'Salles disponibles pour accueillir les cours.',
  endpoint: '/salles',
  formTitre: 'Ajouter une salle',
  champs: [
    { name: 'nom', label: 'Nom de la salle', required: true },
    { name: 'capacite', label: 'Capacité (places, optionnel)', type: 'number' },
  ],
  colonnes: [{ key: 'nom', label: 'Nom' }, { key: 'capacite', label: 'Capacité' }],
  rerender: () => viewSalles(),
});

async function viewCreneaux() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Créneaux horaires', 'La grille sur laquelle enseignants et emploi du temps se basent.')}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let creneaux;
  try { creneaux = await Api.get('/creneaux'); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }
  const { jours, times, matrix } = buildGrid(creneaux);

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un créneau</h3></div>
      <form id="addForm">
        <div class="field-row">
          <div>
            <label>Jour</label>
            <select name="jour" required>
              ${JOUR_ORDRE.map((j) => `<option value="${j}">${j}</option>`).join('')}
            </select>
          </div>
          <div><label>Heure de début</label><input name="heureDebut" type="time" required /></div>
          <div><label>Heure de fin</label><input name="heureFin" type="time" required /></div>
        </div>
        <button class="btn btn-gold" type="submit">Ajouter le créneau</button>
      </form>
    </div>
    <div class="panel">
      <div class="panel-title"><h3>Grille actuelle</h3></div>
      ${creneaux.length ? renderPlainGrid(jours, times, matrix, true) : '<p>Aucun créneau défini.</p>'}
    </div>
  `;

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      await Api.post('/creneaux', fd);
      toast('Créneau ajouté.');
      viewCreneaux();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del-creneau]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce créneau ? Les disponibilités et le planning associés seront aussi supprimés.')) return;
      try {
        await Api.del(`/creneaux/${btn.dataset.delCreneau}`);
        toast('Créneau supprimé.');
        viewCreneaux();
      } catch (err) { toast(err.message, true); }
    });
  });
}

function renderPlainGrid(jours, times, matrix, deletable) {
  const cols = `80px repeat(${jours.length}, 1fr)`;
  let html = `<div class="timetable-wrap"><div class="timetable" style="grid-template-columns:${cols}">`;
  html += `<div class="tt-corner"></div>`;
  jours.forEach((j) => { html += `<div class="tt-day-head">${esc(j)}</div>`; });
  times.forEach((t, ti) => {
    html += `<div class="tt-time">${esc(t.heureDebut)}–${esc(t.heureFin)}</div>`;
    jours.forEach((j, ji) => {
      const c = matrix[ti][ji];
      html += `<div class="tt-cell">`;
      if (c && deletable) {
        html += `<button class="btn btn-outline btn-sm" data-del-creneau="${c.id}" style="width:100%">Retirer</button>`;
      } else if (c) {
        html += `<span class="mono" style="font-size:0.72rem;color:var(--slate-soft)">créneau #${c.id}</span>`;
      }
      html += `</div>`;
    });
  });
  html += `</div></div>`;
  return html;
}

async function viewCours() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Cours à planifier', "Associez une matière, un enseignant et un groupe d'étudiants : c'est ce que l'algorithme placera dans l'emploi du temps.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let cours, matieres, enseignants;
  try {
    [cours, matieres, enseignants] = await Promise.all([
      Api.get('/cours'), Api.get('/matieres'), Api.get('/enseignants'),
    ]);
  } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  const matiereNom = (id) => (matieres.find((m) => m.id === id) || {}).nom || '—';
  const ensNom = (id) => { const u = enseignants.find((e) => e.id === id); return u ? `${u.prenom} ${u.nom}` : '—'; };

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un cours</h3></div>
      ${(!matieres.length || !enseignants.length) ? `<div class="msg msg-alert">Créez d'abord au moins une matière et un enseignant.</div>` : `
      <form id="addForm">
        <div class="field-row">
          <div><label>Matière</label>
            <select name="matiereId" required>${matieres.map((m) => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select>
          </div>
          <div><label>Enseignant</label>
            <select name="enseignantId" required>${enseignants.map((u) => `<option value="${u.id}">${esc(u.prenom)} ${esc(u.nom)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field-row">
          <div><label>Groupe / promotion</label><input name="groupe" placeholder="ex. L2-Info-A" required /></div>
          <div><label>Durée (nombre de créneaux consécutifs)</label><input name="dureeCreneaux" type="number" min="1" value="1" /></div>
        </div>
        <button class="btn btn-gold" type="submit">Ajouter le cours</button>
      </form>`}
    </div>
    <div class="panel">
      <div class="panel-title"><h3>${cours.length} cours à planifier</h3></div>
      <table>
        <thead><tr><th>Matière</th><th>Enseignant</th><th>Groupe</th><th>Durée</th><th></th></tr></thead>
        <tbody>
          ${cours.length ? cours.map((c) => `
            <tr>
              <td>${esc(matiereNom(c.matiereId))}</td>
              <td>${esc(ensNom(c.enseignantId))}</td>
              <td>${esc(c.groupe)}</td>
              <td>${c.dureeCreneaux} créneau(x)</td>
              <td><button class="btn btn-outline btn-sm" data-del="${c.id}">Supprimer</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="5">Aucun cours pour le moment.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const form = document.getElementById('addForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      await Api.post('/cours', fd);
      toast('Cours ajouté.');
      viewCours();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce cours ?')) return;
      try {
        await Api.del(`/cours/${btn.dataset.del}`);
        toast('Cours supprimé.');
        viewCours();
      } catch (err) { toast(err.message, true); }
    });
  });
}

async function viewPlanningAdmin() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', "Emploi du temps", "Générez automatiquement une proposition à partir des disponibilités déclarées, ajustez-la si nécessaire, puis publiez-la.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');

  let planningRes, creneaux, salles;
  try {
    [planningRes, creneaux, salles] = await Promise.all([
      Api.get('/planning'), Api.get('/creneaux'), Api.get('/salles'),
    ]);
  } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  const { planning, statut } = planningRes;
  const { jours, times, matrix } = buildGrid(creneaux);

  function cardFor(creneauId) {
    return planning.filter((p) => p.creneauId === creneauId).map((p) => `
      <div class="tt-card ${p.statut === 'modifie' ? 'modifie' : ''}">
        <strong>${esc(p.matiere)}</strong>
        <span>${esc(p.enseignant)}</span>
        <span>${esc(p.groupe)} · ${esc(p.salle)}</span>
      </div>
    `).join('');
  }

  const cols = `80px repeat(${jours.length}, 1fr)`;
  let grid = `<div class="timetable-wrap"><div class="timetable" style="grid-template-columns:${cols}">`;
  grid += `<div class="tt-corner"></div>`;
  jours.forEach((j) => { grid += `<div class="tt-day-head">${esc(j)}</div>`; });
  times.forEach((t, ti) => {
    grid += `<div class="tt-time">${esc(t.heureDebut)}–${esc(t.heureFin)}</div>`;
    jours.forEach((j, ji) => {
      const c = matrix[ti][ji];
      grid += `<div class="tt-cell">${c ? cardFor(c.id) : ''}</div>`;
    });
  });
  grid += `</div></div>`;

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title">
        <h3>Statut : <span class="badge badge-${statut === 'publie' ? 'publie' : 'brouillon'}">${statut === 'publie' ? 'Publié' : 'Brouillon'}</span></h3>
        <div class="actions-row">
          <button class="btn btn-teal" id="genBtn">Générer automatiquement</button>
          ${statut === 'publie'
            ? `<button class="btn btn-outline" id="depubBtn">Dépublier</button>`
            : `<button class="btn btn-gold" id="pubBtn" ${planning.length ? '' : 'disabled'}>Publier aux enseignants</button>`}
        </div>
      </* Application "Planning universitaire" — SPA vanille (sans framework).
   Organisation : state global + petit routeur + une fonction de rendu par vue. */

const state = {
  user: null,
  view: null,
  cache: {},
};

const JOUR_ORDRE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const els = {
  app: document.getElementById('app'),
  topbar: document.getElementById('topbar'),
  topbarNav: document.getElementById('topbarNav'),
  userLabel: document.getElementById('userLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  toast: document.getElementById('toast'),
};

function toast(message, isAlert = false) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.className = 'toast' + (isAlert ? ' alert' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function init() {
  if (Api.hasToken()) {
    try {
      const { user } = await Api.get('/auth/me');
      state.user = user;
      startApp();
      return;
    } catch (e) {
      Api.clearToken();
    }
  }
  renderLogin();
}

function renderLogin(errorMessage) {
  els.topbar.hidden = true;
  els.app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <span class="brand-mark">EDT</span>
        <h1>Planning universitaire</h1>
        <p class="sub">Connectez-vous pour saisir vos disponibilités ou gérer l'emploi du temps.</p>
        ${errorMessage ? `<div class="msg msg-alert">${esc(errorMessage)}</div>` : ''}
        <form id="loginForm">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" required autocomplete="username" />
          <label for="loginPassword">Mot de passe</label>
          <input id="loginPassword" type="password" required autocomplete="current-password" />
          <button class="btn btn-gold" type="submit" style="width:100%">Se connecter</button>
        </form>
        <p class="hint">Compte administrateur créé au premier démarrage du serveur (voir le fichier .env). Les comptes enseignants sont créés par l'administrateur depuis l'onglet « Enseignants ».</p>
      </div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await Api.post('/auth/login', { email, password });
      Api.setToken(res.token);
      state.user = res.user;
      startApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function startApp() {
  els.topbar.hidden = false;
  els.userLabel.textContent = `${state.user.prenom} ${state.user.nom} · ${state.user.role === 'admin' ? 'Administration' : 'Enseignant'}`;
  const nav = state.user.role === 'admin'
    ? [
        ['enseignants', 'Enseignants'],
        ['matieres', 'Matières'],
        ['salles', 'Salles'],
        ['creneaux', 'Créneaux'],
        ['cours', 'Cours'],
        ['planning', "Emploi du temps"],
      ]
    : [
        ['disponibilites', 'Mes disponibilités'],
        ['mon-planning', 'Mon emploi du temps'],
      ];

  els.topbarNav.innerHTML = nav.map(([id, label]) =>
    `<button data-view="${id}">${esc(label)}</button>`
  ).join('');
  els.topbarNav.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  navigate(nav[0][0]);
}

els.logoutBtn.addEventListener('click', () => {
  Api.clearToken();
  state.user = null;
  renderLogin();
});

function navigate(view) {
  state.view = view;
  els.topbarNav.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const routes = {
    enseignants: viewEnseignants,
    matieres: viewMatieres,
    salles: viewSalles,
    creneaux: viewCreneaux,
    cours: viewCours,
    planning: viewPlanningAdmin,
    disponibilites: viewDisponibilites,
    'mon-planning': viewPlanningEnseignant,
  };
  (routes[view] || renderLogin)();
}

function buildGrid(creneaux) {
  const jours = [...new Set(creneaux.map((c) => c.jour))].sort((a, b) => {
    const ia = JOUR_ORDRE.indexOf(a), ib = JOUR_ORDRE.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const timeKey = (c) => `${c.heureDebut}|${c.heureFin}`;
  const seen = new Map();
  creneaux.forEach((c) => {
    if (!seen.has(timeKey(c))) seen.set(timeKey(c), { heureDebut: c.heureDebut, heureFin: c.heureFin });
  });
  const times = [...seen.values()].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  const matrix = times.map((t) => jours.map((j) =>
    creneaux.find((c) => c.jour === j && c.heureDebut === t.heureDebut && c.heureFin === t.heureFin) || null
  ));
  return { jours, times, matrix };
}

function pageHeader(eyebrow, title, sub) {
  return `
    <div class="page-header">
      <div>
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h1>${esc(title)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </div>
    </div>
  `;
}

async function viewEnseignants() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Enseignants', "Créez un compte pour chaque enseignant afin qu'il puisse saisir ses disponibilités.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let liste;
  try { liste = await Api.get('/enseignants'); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un enseignant</h3></div>
      <form id="addForm">
        <div class="field-row">
          <div><label>Prénom</label><input name="prenom" required /></div>
          <div><label>Nom</label><input name="nom" required /></div>
        </div>
        <div class="field-row">
          <div><label>Email</label><input name="email" type="email" required /></div>
          <div><label>Mot de passe initial</label><input name="password" type="text" required minlength="6" /></div>
        </div>
        <button class="btn btn-gold" type="submit">Créer le compte</button>
      </form>
    </div>
    <div class="panel">
      <div class="panel-title"><h3>${liste.length} enseignant(s)</h3></div>
      <table>
        <thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>
        <tbody>
          ${liste.length ? liste.map((u) => `
            <tr>
              <td>${esc(u.prenom)} ${esc(u.nom)}</td>
              <td>${esc(u.email)}</td>
              <td><button class="btn btn-outline btn-sm" data-del="${u.id}">Supprimer</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="3">Aucun enseignant pour le moment.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Api.post('/enseignants', Object.fromEntries(fd));
      toast('Enseignant créé.');
      viewEnseignants();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet enseignant ? Ses disponibilités et cours associés seront aussi supprimés.')) return;
      try {
        await Api.del(`/enseignants/${btn.dataset.del}`);
        toast('Enseignant supprimé.');
        viewEnseignants();
      } catch (err) { toast(err.message, true); }
    });
  });
}

function crudSimpleView(config) {
  return async function () {
    els.app.innerHTML = `<div class="page">${pageHeader('Administration', config.titre, config.sous)}<div id="content">Chargement…</div></div>`;
    const content = document.getElementById('content');
    let liste;
    try { liste = await Api.get(config.endpoint); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

    content.innerHTML = `
      <div class="panel">
        <div class="panel-title"><h3>${config.formTitre}</h3></div>
        <form id="addForm">
          ${config.champs.map((c) => `
            <label>${esc(c.label)}</label>
            <input name="${c.name}" type="${c.type || 'text'}" ${c.required ? 'required' : ''} />
          `).join('')}
          <button class="btn btn-gold" type="submit">Ajouter</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-title"><h3>${liste.length} élément(s)</h3></div>
        <table>
          <thead><tr>${config.colonnes.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${liste.length ? liste.map((item) => `
              <tr>
                ${config.colonnes.map((c) => `<td>${esc(item[c.key] ?? '—')}</td>`).join('')}
                <td><button class="btn btn-outline btn-sm" data-del="${item.id}">Supprimer</button></td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="${config.colonnes.length + 1}">Aucun élément pour le moment.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        await Api.post(config.endpoint, fd);
        toast('Ajouté.');
        config.rerender();
      } catch (err) { toast(err.message, true); }
    });

    content.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Confirmer la suppression ?')) return;
        try {
          await Api.del(`${config.endpoint}/${btn.dataset.del}`);
          toast('Supprimé.');
          config.rerender();
        } catch (err) { toast(err.message, true); }
      });
    });
  };
}

const viewMatieres = crudSimpleView({
  titre: 'Matières',
  sous: "Les matières regroupent les cours à planifier (ex. Algorithmique, Droit civil…).",
  endpoint: '/matieres',
  formTitre: 'Ajouter une matière',
  champs: [
    { name: 'nom', label: 'Nom de la matière', required: true },
    { name: 'volumeHoraire', label: "Volume horaire (h, optionnel)", type: 'number' },
  ],
  colonnes: [{ key: 'nom', label: 'Nom' }, { key: 'volumeHoraire', label: 'Volume horaire' }],
  rerender: () => viewMatieres(),
});

const viewSalles = crudSimpleView({
  titre: 'Salles',
  sous: 'Salles disponibles pour accueillir les cours.',
  endpoint: '/salles',
  formTitre: 'Ajouter une salle',
  champs: [
    { name: 'nom', label: 'Nom de la salle', required: true },
    { name: 'capacite', label: 'Capacité (places, optionnel)', type: 'number' },
  ],
  colonnes: [{ key: 'nom', label: 'Nom' }, { key: 'capacite', label: 'Capacité' }],
  rerender: () => viewSalles(),
});

async function viewCreneaux() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Créneaux horaires', 'La grille sur laquelle enseignants et emploi du temps se basent.')}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let creneaux;
  try { creneaux = await Api.get('/creneaux'); } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }
  const { jours, times, matrix } = buildGrid(creneaux);

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un créneau</h3></div>
      <form id="addForm">
        <div class="field-row">
          <div>
            <label>Jour</label>
            <select name="jour" required>
              ${JOUR_ORDRE.map((j) => `<option value="${j}">${j}</option>`).join('')}
            </select>
          </div>
          <div><label>Heure de début</label><input name="heureDebut" type="time" required /></div>
          <div><label>Heure de fin</label><input name="heureFin" type="time" required /></div>
        </div>
        <button class="btn btn-gold" type="submit">Ajouter le créneau</button>
      </form>
    </div>
    <div class="panel">
      <div class="panel-title"><h3>Grille actuelle</h3></div>
      ${creneaux.length ? renderPlainGrid(jours, times, matrix, true) : '<p>Aucun créneau défini.</p>'}
    </div>
  `;

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      await Api.post('/creneaux', fd);
      toast('Créneau ajouté.');
      viewCreneaux();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del-creneau]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce créneau ? Les disponibilités et le planning associés seront aussi supprimés.')) return;
      try {
        await Api.del(`/creneaux/${btn.dataset.delCreneau}`);
        toast('Créneau supprimé.');
        viewCreneaux();
      } catch (err) { toast(err.message, true); }
    });
  });
}

function renderPlainGrid(jours, times, matrix, deletable) {
  const cols = `80px repeat(${jours.length}, 1fr)`;
  let html = `<div class="timetable-wrap"><div class="timetable" style="grid-template-columns:${cols}">`;
  html += `<div class="tt-corner"></div>`;
  jours.forEach((j) => { html += `<div class="tt-day-head">${esc(j)}</div>`; });
  times.forEach((t, ti) => {
    html += `<div class="tt-time">${esc(t.heureDebut)}–${esc(t.heureFin)}</div>`;
    jours.forEach((j, ji) => {
      const c = matrix[ti][ji];
      html += `<div class="tt-cell">`;
      if (c && deletable) {
        html += `<button class="btn btn-outline btn-sm" data-del-creneau="${c.id}" style="width:100%">Retirer</button>`;
      } else if (c) {
        html += `<span class="mono" style="font-size:0.72rem;color:var(--slate-soft)">créneau #${c.id}</span>`;
      }
      html += `</div>`;
    });
  });
  html += `</div></div>`;
  return html;
}

async function viewCours() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', 'Cours à planifier', "Associez une matière, un enseignant et un groupe d'étudiants : c'est ce que l'algorithme placera dans l'emploi du temps.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');
  let cours, matieres, enseignants;
  try {
    [cours, matieres, enseignants] = await Promise.all([
      Api.get('/cours'), Api.get('/matieres'), Api.get('/enseignants'),
    ]);
  } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  const matiereNom = (id) => (matieres.find((m) => m.id === id) || {}).nom || '—';
  const ensNom = (id) => { const u = enseignants.find((e) => e.id === id); return u ? `${u.prenom} ${u.nom}` : '—'; };

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>Ajouter un cours</h3></div>
      ${(!matieres.length || !enseignants.length) ? `<div class="msg msg-alert">Créez d'abord au moins une matière et un enseignant.</div>` : `
      <form id="addForm">
        <div class="field-row">
          <div><label>Matière</label>
            <select name="matiereId" required>${matieres.map((m) => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select>
          </div>
          <div><label>Enseignant</label>
            <select name="enseignantId" required>${enseignants.map((u) => `<option value="${u.id}">${esc(u.prenom)} ${esc(u.nom)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field-row">
          <div><label>Groupe / promotion</label><input name="groupe" placeholder="ex. L2-Info-A" required /></div>
          <div><label>Durée (nombre de créneaux consécutifs)</label><input name="dureeCreneaux" type="number" min="1" value="1" /></div>
        </div>
        <button class="btn btn-gold" type="submit">Ajouter le cours</button>
      </form>`}
    </div>
    <div class="panel">
      <div class="panel-title"><h3>${cours.length} cours à planifier</h3></div>
      <table>
        <thead><tr><th>Matière</th><th>Enseignant</th><th>Groupe</th><th>Durée</th><th></th></tr></thead>
        <tbody>
          ${cours.length ? cours.map((c) => `
            <tr>
              <td>${esc(matiereNom(c.matiereId))}</td>
              <td>${esc(ensNom(c.enseignantId))}</td>
              <td>${esc(c.groupe)}</td>
              <td>${c.dureeCreneaux} créneau(x)</td>
              <td><button class="btn btn-outline btn-sm" data-del="${c.id}">Supprimer</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="5">Aucun cours pour le moment.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const form = document.getElementById('addForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      await Api.post('/cours', fd);
      toast('Cours ajouté.');
      viewCours();
    } catch (err) { toast(err.message, true); }
  });

  content.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce cours ?')) return;
      try {
        await Api.del(`/cours/${btn.dataset.del}`);
        toast('Cours supprimé.');
        viewCours();
      } catch (err) { toast(err.message, true); }
    });
  });
}

async function viewPlanningAdmin() {
  els.app.innerHTML = `<div class="page">${pageHeader('Administration', "Emploi du temps", "Générez automatiquement une proposition à partir des disponibilités déclarées, ajustez-la si nécessaire, puis publiez-la.")}<div id="content">Chargement…</div></div>`;
  const content = document.getElementById('content');

  let planningRes, creneaux, salles;
  try {
    [planningRes, creneaux, salles] = await Promise.all([
      Api.get('/planning'), Api.get('/creneaux'), Api.get('/salles'),
    ]);
  } catch (e) { content.innerHTML = `<div class="msg msg-alert">${esc(e.message)}</div>`; return; }

  const { planning, statut } = planningRes;
  const { jours, times, matrix } = buildGrid(creneaux);

  function cardFor(creneauId) {
    return planning.filter((p) => p.creneauId === creneauId).map((p) => `
      <div class="tt-card ${p.statut === 'modifie' ? 'modifie' : ''}">
        <strong>${esc(p.matiere)}</strong>
        <span>${esc(p.enseignant)}</span>
        <span>${esc(p.groupe)} · ${esc(p.salle)}</span>
      </div>
    `).join('');
  }

  const cols = `80px repeat(${jours.length}, 1fr)`;
  let grid = `<div class="timetable-wrap"><div class="timetable" style="grid-template-columns:${cols}">`;
  grid += `<div class="tt-corner"></div>`;
  jours.forEach((j) => { grid += `<div class="tt-day-head">${esc(j)}</div>`; });
  times.forEach((t, ti) => {
    grid += `<div class="tt-time">${esc(t.heureDebut)}–${esc(t.heureFin)}</div>`;
    jours.forEach((j, ji) => {
      const c = matrix[ti][ji];
      grid += `<div class="tt-cell">${c ? cardFor(c.id) : ''}</div>`;
    });
  });
  grid += `</div></div>`;

  content.innerHTML = `
    <div class="panel">
      <div class="panel-title">
        <h3>Statut : <span class="badge badge-${statut === 'publie' ? 'publie' : 'brouillon'}">${statut === 'publie' ? 'Publié' : 'Brouillon'}</span></h3>
        <div class="actions-row">
          <button class="btn btn-teal" id="genBtn">Générer automatiquement</button>
          ${statut === 'publie'
            ? `<button class="btn btn-outline" id="depubBtn">Dépublier</button>`
            : `<button class="btn btn-gold" id="pubBtn" ${planning.length ? '' : 'disabled'}>Publier aux enseignants</button>`}
        </div>
      <
