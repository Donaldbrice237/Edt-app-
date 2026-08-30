const express = require('express');
const { load, persist } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Un enseignant récupère ses propres disponibilités ; l'admin peut consulter celles de n'importe qui via ?userId=
router.get('/', requireAuth, (req, res) => {
  const db = load();
  let userId = req.user.id;
  if (req.user.role === 'admin' && req.query.userId) {
    userId = Number(req.query.userId);
  }
  res.json(db.disponibilites.filter((d) => d.userId === userId));
});

// Remplace en une fois la grille de disponibilités de l'utilisateur connecté (ou d'un enseignant si admin)
router.put('/', requireAuth, (req, res) => {
  const db = load();
  let userId = req.user.id;
  if (req.user.role === 'admin' && req.body.userId) {
    userId = Number(req.body.userId);
  } else if (req.user.role !== 'enseignant' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  const { creneauxDisponibles } = req.body || {}; // tableau d'IDs de créneaux
  if (!Array.isArray(creneauxDisponibles)) {
    return res.status(400).json({ error: 'creneauxDisponibles doit être un tableau d\'identifiants de créneaux.' });
  }

  db.disponibilites = db.disponibilites.filter((d) => d.userId !== userId);
  const idsValides = new Set(db.creneaux.map((c) => c.id));
  db.creneaux.forEach((c) => {
    db.disponibilites.push({
      userId,
      creneauId: c.id,
      disponible: idsValides.has(c.id) && creneauxDisponibles.includes(c.id),
    });
  });

  persist();
  res.json(db.disponibilites.filter((d) => d.userId === userId));
});

module.exports = router;
