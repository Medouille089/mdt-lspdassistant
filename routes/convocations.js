const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Recherche de convocations par nom ou prénom
router.get('/api/convocations/search', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name || name.length < 2) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, date, heure, officer, lieu
       FROM lspd_convocations
       WHERE LOWER(nom) LIKE LOWER(?) OR LOWER(prenom) LIKE LOWER(?)
       ORDER BY date DESC LIMIT 10`,
      [`%${name}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur recherche convocations:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'une convocation par ID (pour viewArrestation.js)
// Route :id uniquement si id numérique
router.get('/api/convocations/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }
  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, date, heure, officer, lieu
       FROM lspd_convocations
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({});
    // Formatage date JJ/MM/AAAA et mapping agent rédacteur
    const row = result.rows[0];
    if (row && row.date) {
      const d = new Date(row.date);
      row.date = d.toLocaleDateString('fr-FR');
    }
    row.agent_redacteur = row.officer || 'Non renseigné';
    res.json(row);
  } catch (err) {
    console.error('Erreur GET /api/convocations/:id', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
