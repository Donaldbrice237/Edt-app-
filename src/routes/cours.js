const express = require('express');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = load();
  if (req.user.role === 'admin') return res.json(db.cours);
  // un enseignant ne voit que ses propres cours
  res.json(db.cours.filter((c) => c.enseignantId === req.user.id));
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { matiereId, enseignantId, groupe, dureeCreneaux } = req.body || {};
  if (!matiereId || !enseignantId || !groupe) {
    return res.status(400).json({ error: 'Matière, enseignant et groupe sont requis.' });
  }
  const db = load();
  if (!db.matieres.some((m) => m.id === Number(matiereId))) {
    return res.status(400).json({ error: 'Matière inconnue.' });
  }
  if (!db.users.some((u) => u.id === Number(enseignantId) && u.role === 'enseignant')) {
    return res.status(400).json({ error: 'Enseignant inconnu.' });
  }
  const cours = {
    id: nextId(db),
    matiereId: Number(matiereId),
    enseignantId: Number(enseignantId),
    groupe,
    dureeCreneaux: dureeCreneaux ? Number(dureeCreneaux) : 1,
  };
  db.cours.push(cours);
  persist();
  res.status(201).json(cours);
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const idx = db.cours.findIndex((c) => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Cours introuvable.' });
  db.cours.splice(idx, 1);
  db.planning = db.planning.filter((p) => p.coursId !== Number(req.params.id));
  persist();
  res.json({ ok: true });
});

module.exports = router;
