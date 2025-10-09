const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../config/middleware");
const pool = require("../../../config/db");

/**
 * GET /api/rookie-patrols - Récupérer toutes les patrouilles avec rookies
 */
router.get('/api/rookie-patrols', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM trello_historiquerookie 
      ORDER BY timestamp DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des patrouilles rookie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/rookie-patrols - Ajouter ou mettre à jour une patrouille avec rookie
 */
router.post('/api/rookie-patrols', checkAuth, async (req, res) => {
  try {
    const {
      cardId,
      patrolName,
      listName,
      listId,
      badges,
      rookies,
      allMembers,
      rookieCount,
      totalCount
    } = req.body;

    // Vérifier si la patrouille existe déjà
    const existing = await pool.query(
      'SELECT id FROM trello_historiquerookie WHERE card_id = $1',
      [cardId]
    );

    if (existing.rows.length > 0) {
      // Mise à jour
      const result = await pool.query(`
        UPDATE trello_historiquerookie 
        SET patrol_name = $1, 
            list_name = $2, 
            list_id = $3,
            badges = $4,
            rookies = $5,
            all_members = $6,
            rookie_count = $7,
            total_count = $8,
            updated_at = NOW()
        WHERE card_id = $9
        RETURNING *
      `, [patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies), JSON.stringify(allMembers), rookieCount, totalCount, cardId]);
      
      res.json(result.rows[0]);
    } else {
      // Insertion
      const result = await pool.query(`
        INSERT INTO trello_historiquerookie (
          card_id, patrol_name, list_name, list_id, badges, rookies, all_members, rookie_count, total_count, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `, [cardId, patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies), JSON.stringify(allMembers), rookieCount, totalCount]);
      
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Erreur lors de l\'ajout de la patrouille rookie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/rookie-patrols/deleted - Supprimer les patrouilles dont les cartes n'existent plus
 */
router.delete('/api/rookie-patrols/deleted', checkAuth, async (req, res) => {
  try {
    const { deletedCardIds } = req.body;
    
    const result = await pool.query(
      'DELETE FROM trello_historiquerookie WHERE card_id = ANY($1) RETURNING card_id',
      [deletedCardIds]
    );
    
    res.json({ deleted: result.rows.length, cardIds: result.rows.map(r => r.card_id) });
  } catch (err) {
    console.error('Erreur lors de la suppression des patrouilles:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/rookie-patrols - Supprimer tout l'historique
 */
router.delete('/api/rookie-patrols', checkAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM trello_historiquerookie RETURNING card_id');
    
    res.json({ deleted: result.rows.length });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'historique:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
