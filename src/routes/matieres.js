const express = require('express');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(load().matieres);
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { nom, volumeHoraire } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom de la matière est requis.' });
  const db = load();
  const matiere = { id: nextId(db), nom, volumeHoraire: volumeHoraire || null };
  db.matieres.push(matiere);
  persist();
  res.status(201).json(matiere);
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const matiere = db.matieres.find((m) => m.id === Number(req.params.id));
  if (!matiere) return res.status(404).json({ error: 'Matière introuvable.' });
  const { nom, volumeHoraire } = req.body || {};
  if (nom) matiere.nom = nom;
  if (volumeHoraire !== undefined) matiere.volumeHoraire = volumeHoraire;
  persist();
  res.json(matiere);
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const idx = db.matieres.findIndex((m) => m.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Matière introuvable.' });
  db.matieres.splice(idx, 1);
  db.cours = db.cours.filter((c) => c.matiereId !== Number(req.params.id));
  persist();
  res.json({ ok: true });
});

module.exports = router;
