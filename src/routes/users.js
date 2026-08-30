const express = require('express');
const bcrypt = require('bcryptjs');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role, nom: u.nom, prenom: u.prenom };
}

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  res.json(db.users.filter((u) => u.role === 'enseignant').map(publicUser));
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { email, nom, prenom, password } = req.body || {};
  if (!email || !nom || !prenom || !password) {
    return res.status(400).json({ error: 'Email, nom, prénom et mot de passe sont requis.' });
  }
  const db = load();
  if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  const user = {
    id: nextId(db),
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'enseignant',
    nom,
    prenom,
  };
  db.users.push(user);
  persist();
  res.status(201).json(publicUser(user));
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === Number(req.params.id) && u.role === 'enseignant');
  if (!user) return res.status(404).json({ error: 'Enseignant introuvable.' });
  const { email, nom, prenom, password } = req.body || {};
  if (email) user.email = email;
  if (nom) user.nom = nom;
  if (prenom) user.prenom = prenom;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
  persist();
  res.json(publicUser(user));
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const idx = db.users.findIndex((u) => u.id === Number(req.params.id) && u.role === 'enseignant');
  if (idx === -1) return res.status(404).json({ error: 'Enseignant introuvable.' });
  const [removed] = db.users.splice(idx, 1);
  db.disponibilites = db.disponibilites.filter((d) => d.userId !== removed.id);
  db.cours = db.cours.filter((c) => c.enseignantId !== removed.id);
  persist();
  res.json({ ok: true });
});

module.exports = router;
