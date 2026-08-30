const express = require('express');
const { load, persist, nextId } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { genererPlanning } = require('../scheduler');

const router = express.Router();

function enrichir(db, entree) {
  const cours = db.cours.find((c) => c.id === entree.coursId);
  const matiere = cours && db.matieres.find((m) => m.id === cours.matiereId);
  const enseignant = cours && db.users.find((u) => u.id === cours.enseignantId);
  const creneau = db.creneaux.find((c) => c.id === entree.creneauId);
  const salle = db.salles.find((s) => s.id === entree.salleId);
  return {
    id: entree.id,
    statut: entree.statut,
    coursId: entree.coursId,
    groupe: cours ? cours.groupe : null,
    matiere: matiere ? matiere.nom : '—',
    enseignantId: cours ? cours.enseignantId : null,
    enseignant: enseignant ? `${enseignant.prenom} ${enseignant.nom}` : '—',
    creneauId: entree.creneauId,
    jour: creneau ? creneau.jour : null,
    heureDebut: creneau ? creneau.heureDebut : null,
    heureFin: creneau ? creneau.heureFin : null,
    salleId: entree.salleId,
    salle: salle ? salle.nom : '—',
  };
}

router.get('/', requireAuth, (req, res) => {
  const db = load();
  let entrees = db.planning;
  if (req.user.role !== 'admin') {
    if (db.meta.planningStatut !== 'publie') {
      return res.json({ statut: db.meta.planningStatut, planning: [] });
    }
    const idsCoursEnseignant = new Set(
      db.cours.filter((c) => c.enseignantId === req.user.id).map((c) => c.id)
    );
    entrees = entrees.filter((p) => idsCoursEnseignant.has(p.coursId));
  }
  res.json({
    statut: db.meta.planningStatut,
    planning: entrees.map((e) => enrichir(db, e)),
  });
});

router.post('/generer', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const { planning, nonPlacables } = genererPlanning(db);
  db.planning = planning.map((p) => ({ ...p, id: nextId(db) }));
  db.meta.planningStatut = 'brouillon';
  persist();
  res.json({
    statut: db.meta.planningStatut,
    planning: db.planning.map((e) => enrichir(db, e)),
    nonPlacables: nonPlacables.map((c) => ({
      coursId: c.id,
      matiere: (db.matieres.find((m) => m.id === c.matiereId) || {}).nom,
      groupe: c.groupe,
      enseignant: (() => {
        const u = db.users.find((u2) => u2.id === c.enseignantId);
        return u ? `${u.prenom} ${u.nom}` : '—';
      })(),
    })),
  });
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const entree = db.planning.find((p) => p.id === Number(req.params.id));
  if (!entree) return res.status(404).json({ error: 'Entrée de planning introuvable.' });

  const { creneauId, salleId } = req.body || {};
  const nouveauCreneauId = creneauId !== undefined ? Number(creneauId) : entree.creneauId;
  const nouvelleSalleId = salleId !== undefined ? Number(salleId) : entree.salleId;

  const cours = db.cours.find((c) => c.id === entree.coursId);

  const conflit = db.planning.find((p) => {
    if (p.id === entree.id) return false;
    if (p.creneauId !== nouveauCreneauId) return false;
    const autreCours = db.cours.find((c) => c.id === p.coursId);
    if (!autreCours) return false;
    const memeEnseignant = autreCours.enseignantId === cours.enseignantId;
    const memeGroupe = autreCours.groupe === cours.groupe;
    const memeSalle = p.salleId === nouvelleSalleId;
    return memeEnseignant || memeGroupe || memeSalle;
  });
  if (conflit) {
    return res.status(409).json({ error: 'Ce créneau/cette salle est déjà occupé pour cet enseignant, ce groupe ou cette salle.' });
  }

  entree.creneauId = nouveauCreneauId;
  entree.salleId = nouvelleSalleId;
  entree.statut = 'modifie';
  persist();
  res.json(enrichir(db, entree));
});

router.delete('/:id', requireAuth, requireRole(
