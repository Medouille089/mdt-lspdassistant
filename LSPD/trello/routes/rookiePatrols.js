const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../config/middleware");
const pool = require("../../../config/db");

/**
 * GET /api/rookie-patrols - Récupérer toutes les patrouilles avec rookies
 * Inclut toutes les versions (actives et superseded) pour afficher l'historique complet
 */
router.get('/api/rookie-patrols', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, 
             COALESCE(version, 1) as computed_version,
             superseded_at,
             superseded_by_id
      FROM trello_historiquerookie 
      ORDER BY card_id, COALESCE(version, 1) DESC, timestamp DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des patrouilles rookie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


/**
 * Helper function to check if rookie members have changed
 */
function haveMembersChanged(existingRookies, newRookies) {
  if (!existingRookies || !newRookies) return true;

  const existingBadges = (Array.isArray(existingRookies) ? existingRookies : [])
    .map(r => r.badge)
    .sort();
  const newBadges = (Array.isArray(newRookies) ? newRookies : [])
    .map(r => r.badge)
    .sort();

  if (existingBadges.length !== newBadges.length) return true;
  return existingBadges.some((badge, i) => badge !== newBadges[i]);
}

/**
 * POST /api/rookie-patrols - Ajouter ou créer une nouvelle version si les membres ont changé
 * 
 * Logique de versioning:
 * - Si card_id n'existe pas → créer nouvelle entrée
 * - Si card_id existe ET membres identiques → mettre à jour les métadonnées seulement
 * - Si card_id existe ET membres différents → créer nouvelle version + marquer ancienne comme superseded
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

    // Chercher la version active existante (non superseded)
    const existing = await pool.query(
      'SELECT * FROM trello_historiquerookie WHERE card_id = $1 AND superseded_at IS NULL ORDER BY version DESC LIMIT 1',
      [cardId]
    );

    if (existing.rows.length > 0) {
      const currentEntry = existing.rows[0];
      const existingRookies = currentEntry.rookies;

      // Vérifier si les membres rookies ont changé
      if (haveMembersChanged(existingRookies, rookies)) {
        // Les membres ont changé → créer une nouvelle version
        const newVersion = (currentEntry.version || 1) + 1;

        // 1. Créer la nouvelle entrée
        const insertResult = await pool.query(`
          INSERT INTO trello_historiquerookie (
            card_id, patrol_name, list_name, list_id, badges, rookies, all_members, 
            rookie_count, total_count, timestamp, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
          RETURNING *
        `, [cardId, patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies),
          JSON.stringify(allMembers), rookieCount, totalCount, newVersion]);

        const newEntry = insertResult.rows[0];

        // 2. Marquer l'ancienne entrée comme superseded
        await pool.query(`
          UPDATE trello_historiquerookie 
          SET superseded_at = NOW(),
              superseded_by_id = $1
          WHERE id = $2
        `, [newEntry.id, currentEntry.id]);

        res.json({ ...newEntry, previousVersion: currentEntry.id });
      } else {
        // Membres identiques → mettre à jour les métadonnées seulement (nom patrouille, liste, etc.)
        const result = await pool.query(`
          UPDATE trello_historiquerookie 
          SET patrol_name = $1, 
              list_name = $2, 
              list_id = $3,
              badges = $4,
              updated_at = NOW()
          WHERE id = $5
          RETURNING *
        `, [patrolName, listName, listId, JSON.stringify(badges), currentEntry.id]);

        res.json(result.rows[0]);
      }
    } else {
      // Nouvelle patrouille → créer première version
      const result = await pool.query(`
        INSERT INTO trello_historiquerookie (
          card_id, patrol_name, list_name, list_id, badges, rookies, all_members, 
          rookie_count, total_count, timestamp, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 1)
        RETURNING *
      `, [cardId, patrolName, listName, listId, JSON.stringify(badges), JSON.stringify(rookies),
        JSON.stringify(allMembers), rookieCount, totalCount]);

      res.json(result.rows[0]);
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
      WHERE card_id = $1 AND deleted_at IS NULL
      RETURNING *
    `, [cardId]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
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

    const result = await pool.query(`
      UPDATE trello_historiquerookie
      SET report_completed = $2,
          report_completed_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE card_id = $1
      RETURNING *
    `, [cardId, completed]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patrouille non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur lors de la mise à jour du rapport de patrouille:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
