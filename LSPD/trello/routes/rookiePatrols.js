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
      'SELECT id FROM trello_historiquerookie WHERE card_id = ?',
      [cardId]
    );

    if (existing.rows.length > 0) {
      // Mise à jour
      const result = await pool.query(`
        UPDATE trello_historiquerookie 
        SET patrol_name = ?, 
            list_name = ?, 
            list_id = ?,
            badges = ?,
            rookies = ?,
            all_members = ?,
            rookie_count = ?,
            total_count = ?,
            updated_at = NOW()
        WHERE card_id = ?
      `, [patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies), JSON.stringify(allMembers), rookieCount, totalCount, cardId]);
      
      const selectResult = await pool.query('SELECT * FROM trello_historiquerookie WHERE card_id = ?', [cardId]);
      res.json(selectResult.rows[0]);
    } else {
      // Insertion
      const result = await pool.query(`
        INSERT INTO trello_historiquerookie (
          card_id, patrol_name, list_name, list_id, badges, rookies, all_members, rookie_count, total_count, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [cardId, patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies), JSON.stringify(allMembers), rookieCount, totalCount]);
      
      const selectResult = await pool.query('SELECT * FROM trello_historiquerookie WHERE card_id = ?', [cardId]);
      res.json(selectResult.rows[0]);
    }
  } catch (err) {
    console.error('Erreur lors de l\'ajout de la patrouille rookie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/rookie-patrols/:cardId/mark-deleted - Marquer une patrouille comme supprimée
 */ 
router.put('/api/rookie-patrols/:cardId/mark-deleted', checkAuth, async (req, res) => {
  try {
    const { cardId } = req.params;
    
    const result = await pool.query(`
      UPDATE trello_historiquerookie 
      SET deleted_at = NOW(),
          active_duration = NOW() - timestamp
      WHERE card_id = ? AND deleted_at IS NULL
    `, [cardId]);
    
    if (result.affectedRows > 0) {
      const selectResult = await pool.query('SELECT * FROM trello_historiquerookie WHERE card_id = ?', [cardId]);
      res.json(selectResult.rows[0]);
    } else {
      res.status(404).json({ error: 'Patrouille non trouvée ou déjà marquée comme supprimée' });
    }
  } catch (err) {
    console.error('Erreur lors du marquage de suppression:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/rookie-patrols/deleted - Supprimer les patrouilles dont les cartes n'existent plus
 */
router.delete('/api/rookie-patrols/deleted', checkAuth, async (req, res) => {
  try {
    const { deletedCardIds } = req.body;
    
    const selectResult = await pool.query(
      'SELECT card_id FROM trello_historiquerookie WHERE card_id IN (?)',
      [deletedCardIds]
    );
    
    await pool.query(
      'DELETE FROM trello_historiquerookie WHERE card_id IN (?)',
      [deletedCardIds]
    );
    
    res.json({ deleted: selectResult.rows.length, cardIds: selectResult.rows.map(r => r.card_id) });
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
    const result = await pool.query('DELETE FROM trello_historiquerookie');
    
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'historique:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/rookie-patrols/:cardId/report - Met à jour l'état du rapport pour une patrouille
 */
router.put('/api/rookie-patrols/:cardId/report', checkAuth, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Paramètre "completed" invalide' });
    }

    const updateResult = await pool.query(`
      UPDATE trello_historiquerookie
      SET report_completed = ?,
          report_completed_at = CASE WHEN ? THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE card_id = ?
    `, [completed, completed, cardId]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Patrouille non trouvée' });
    }

    const selectResult = await pool.query('SELECT * FROM trello_historiquerookie WHERE card_id = ?', [cardId]);
    res.json(selectResult.rows[0]);
  } catch (err) {
    console.error("Erreur lors de la mise à jour du rapport de patrouille:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
