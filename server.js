require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { load } = require('./src/db');

const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const matieresRoutes = require('./src/routes/matieres');
const sallesRoutes = require('./src/routes/salles');
const creneauxRoutes = require('./src/routes/creneaux');
const disponibilitesRoutes = require('./src/routes/disponibilites');
const coursRoutes = require('./src/routes/cours');
const planningRoutes = require('./src/routes/planning');

load(); // initialise le fichier de données au démarrage (crée l'admin par défaut si besoin)

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/enseignants', usersRoutes);
app.use('/api/matieres', matieresRoutes);
app.use('/api/salles', sallesRoutes);
app.use('/api/creneaux', creneauxRoutes);
app.use('/api/disponibilites', disponibilitesRoutes);
app.use('/api/cours', coursRoutes);
app.use('/api/planning', planningRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur emploi du temps démarré sur http://localhost:${PORT}`);
  console.log(`Compte admin : ${process.env.ADMIN_EMAIL || 'admin@universite.fr'}`);
});
