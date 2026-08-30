const express = require('express');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(load().salles);
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { nom, capacite } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom de la salle est requis.' });
  const db = load();
  const salle = { id: nextId(db), nom, capacite: capacite || null };
  db.salles.push(salle);
  persist();
  res.status(201).json(salle);
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const salle = db.salles.find((s) => s.id === Number(req.params.id));
  if (!salle) return res.status(404).json({ error: 'Salle introuvable.' });
  const { nom, capacite } = req.body || {};
  if (nom) salle.nom = nom;
  if (capacite !== undefined) salle.capacite = capacite;
  persist();
  res.json(salle);
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const idx = db.salles.findIndex((s) => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Salle introuvable.' });
  db.salles.splice(idx, 1);
  persist();
  res.json({ ok: true });
});

module.exports = router;
