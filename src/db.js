// Couche de persistance minimale, basée sur un fichier JSON.
// Volontairement sans dépendance native (pas de sqlite compilé) pour rester
// facile à installer sur n'importe quel serveur avec juste `npm install`.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function defaultData() {
  return {
    users: [],
    matieres: [],
    salles: [],
    creneaux: [],
    disponibilites: [],
    cours: [],
    planning: [],
    meta: { planningStatut: 'brouillon', nextId: 1 },
  };
}

function nextId(db) {
  const id = db.meta.nextId;
  db.meta.nextId += 1;
  return id;
}

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    cache = defaultData();
    seed(cache);
    save(cache);
  } else {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  return cache;
}

function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function persist() {
  save(cache);
}

// Crée un compte admin par défaut et une grille horaire type au premier lancement.
function seed(db) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@universite.fr';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

  db.users.push({
    id: nextId(db),
    email: adminEmail,
    passwordHash: bcrypt.hashSync(adminPassword, 10),
    role: 'admin',
    nom: 'Administrateur',
    prenom: 'Scolarité',
  });

  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const plages = [
    ['08:00', '10:00'],
    ['10:15', '12:15'],
    ['13:30', '15:30'],
    ['15:45', '17:45'],
  ];

  let ordre = 0;
  jours.forEach((jour) => {
    plages.forEach(([debut, fin]) => {
      db.creneaux.push({
        id: nextId(db),
        jour,
        heureDebut: debut,
        heureFin: fin,
        ordre: ordre++,
      });
    });
  });
}

module.exports = { load, persist, nextId };
