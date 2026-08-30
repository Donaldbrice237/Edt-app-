const express = require('express');
const bcrypt = require('bcryptjs');
const { load, persist } = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  const db = load();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body || {};
  if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }
  const db = load();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (!bcrypt.compareSync(ancienMotDePasse || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
  }
  user.passwordHash = bcrypt.hashSync(nouveauMotDePasse, 10);
  persist();
  res.json({ ok: true });
});

module.exports = router;
