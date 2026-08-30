// Algorithme de génération automatique de l'emploi du temps.
//
// Principe : chaque "cours" (association matière + enseignant + groupe) doit être
// placé sur un ou plusieurs créneaux consécutifs du même jour, en respectant :
//   1. la disponibilité déclarée de l'enseignant sur ces créneaux,
//   2. l'absence de conflit enseignant (un enseignant ne peut pas être sur deux cours en même temps),
//   3. l'absence de conflit groupe (un groupe d'étudiants ne peut pas avoir deux cours en même temps),
//   4. l'absence de conflit salle, avec une capacité suffisante si elle est renseignée.
//
// Heuristique "most constrained first" : les cours dont l'enseignant a le moins de
// créneaux disponibles sont placés en premier, ce qui limite les échecs de placement.

function genererPlanning(db) {
  const { cours, creneaux, salles, disponibilites } = db;

  const creneauxParJour = {};
  creneaux.forEach((c) => {
    creneauxParJour[c.jour] = creneauxParJour[c.jour] || [];
    creneauxParJour[c.jour].push(c);
  });
  Object.values(creneauxParJour).forEach((liste) => liste.sort((a, b) => a.ordre - b.ordre));

  const dispoParEnseignant = {};
  disponibilites.forEach((d) => {
    dispoParEnseignant[d.userId] = dispoParEnseignant[d.userId] || {};
    dispoParEnseignant[d.userId][d.creneauId] = d.disponible;
  });

  function estDisponible(enseignantId, creneauId) {
    const map = dispoParEnseignant[enseignantId];
    return !!(map && map[creneauId] === true);
  }

  function scoreContrainte(c) {
    let count = 0;
    creneaux.forEach((cr) => {
      if (estDisponible(c.enseignantId, cr.id)) count += 1;
    });
    return count;
  }

  const coursTries = [...cours].sort((a, b) => scoreContrainte(a) - scoreContrainte(b));

  const occupationEnseignant = new Set();
  const occupationGroupe = new Set();
  const occupationSalle = new Set();

  const planning = [];
  const nonPlacables = [];

  coursTries.forEach((c) => {
    const duree = c.dureeCreneaux || 1;
    let place = false;

    for (const jour of Object.keys(creneauxParJour)) {
      const liste = creneauxParJour[jour];
      for (let i = 0; i <= liste.length - duree; i++) {
        const fenetre = liste.slice(i, i + duree);

        const enseignantOk = fenetre.every(
          (cr) =>
            estDisponible(c.enseignantId, cr.id) &&
            !occupationEnseignant.has(`${c.enseignantId}_${cr.id}`)
        );
        if (!enseignantOk) continue;

        const groupeOk = fenetre.every((cr) => !occupationGroupe.has(`${c.groupe}_${cr.id}`));
        if (!groupeOk) continue;

        const salle = trouverSalle(fenetre);
        if (!salle) continue;

        fenetre.forEach((cr) => {
          occupationEnseignant.add(`${c.enseignantId}_${cr.id}`);
          occupationGroupe.add(`${c.groupe}_${cr.id}`);
          occupationSalle.add(`${salle.id}_${cr.id}`);
          planning.push({
            id: undefined,
            coursId: c.id,
            creneauId: cr.id,
            salleId: salle.id,
            statut: 'genere',
          });
        });

        place = true;
        break;
      }
      if (place) break;
    }

    if (!place) nonPlacables.push(c);

    function trouverSalle(fenetre) {
      return salles.find((s) =>
        fenetre.every((cr) => !occupationSalle.has(`${s.id}_${cr.id}`))
      );
    }
  });

  return { planning, nonPlacables };
}

module.exports = { genererPlanning };
