const express = require('express');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = load();
  const liste = [...db.creneaux].sort((a, b) => a.ordre - b.ordre);
  res.json(liste);
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { jour, heureDebut, heureFin } = req.body || {};
  if (!jour || !heureDebut || !heureFin) {
    return res.status(400).json({ error: 'Jour, heure de début et heure de fin sont requis.' });
  }
  const db = load();
  const ordreMax = db.creneaux.reduce((max, c) => Math.max(max, c.ordre), -1);
  const creneau = { id: nextId(db), jour, heureDebut, heureFin, ordre: ordreMax + 1 };
  db.creneaux.push(creneau);
  persist();
  res.status(201).json(creneau);
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const idx = db.creneaux.findIndex((c) => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Créneau introuvable.' });
  db.creneaux.splice(idx, 1);
  db.disponibilites = db.disponibilites.filter((d) => d.creneauId !== Number(req.params.id));
  db.planning = db.planning.filter((p) => p.creneauId !== Number(req.params.id));
  persist();
  res.json({ ok: true });
});

module.exports = router;
