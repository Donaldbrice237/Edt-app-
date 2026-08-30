const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, nom: user.nom, prenom: user.prenom },
    SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée, merci de vous reconnecter.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Vous n'avez pas les droits nécessaires pour cette action." });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, SECRET };
