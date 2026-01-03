const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { checkAuth } = require("../config/middleware");

// GET /api/tags - Liste des tags par type
router.get('/api/tags', checkAuth, async (req, res) => {
    try {
        const { type } = req.query;
        let query = 'SELECT * FROM lspd_tags';
        const params = [];

        if (type) {
            query += ' WHERE type = $1';
            params.push(type);
        }

        query += ' ORDER BY name ASC';
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Erreur GET /api/tags :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/tags - Créer un nouveau tag (Command Staff uniquement)
router.post('/api/tags', checkAuth, async (req, res) => {
    try {
        // Vérification Command Staff (optionnel mais recommandé selon la demande)
        if (!req.user.isCommandStaff && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Accès refusé : Command Staff uniquement' });
        }

        const { name, color, type } = req.body;
        if (!name || !type) {
            return res.status(400).json({ error: 'Nom et type requis' });
        }

        const { rows } = await pool.query(
            'INSERT INTO lspd_tags (name, color, type) VALUES ($1, $2, $3) RETURNING *',
            [name, color || '#3498db', type]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Erreur POST /api/tags :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/tags/:id - Supprimer un tag (Command Staff uniquement)
router.delete('/api/tags/:id', checkAuth, async (req, res) => {
    try {
        if (!req.user.isCommandStaff && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Accès refusé : Command Staff uniquement' });
        }

        const { id } = req.params;
        
        // Supprimer d'abord les liens
        await pool.query('DELETE FROM lspd_entity_tags WHERE tag_id = $1', [id]);
        
        // Puis supprimer le tag
        const { rowCount } = await pool.query('DELETE FROM lspd_tags WHERE id = $1', [id]);
        
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Tag non trouvé' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur DELETE /api/tags/:id :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/tags/entity/:type/:id - Tags d'une entité spécifique
router.get('/api/tags/entity/:type/:id', checkAuth, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { rows } = await pool.query(`
            SELECT t.* FROM lspd_tags t
            JOIN lspd_entity_tags et ON t.id = et.tag_id
            WHERE et.entity_type = $1 AND et.entity_id = $2::TEXT
        `, [type, id]);
        res.json(rows);
    } catch (err) {
        console.error('Erreur GET /api/tags/entity :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/tags/entity - Lier un tag à une entité
router.post('/api/tags/entity', checkAuth, async (req, res) => {
    try {
        const { tag_id, entity_id, entity_type } = req.body;
        if (!tag_id || !entity_id || !entity_type) {
            return res.status(400).json({ error: 'tag_id, entity_id et entity_type requis' });
        }

        await pool.query(
            'INSERT INTO lspd_entity_tags (tag_id, entity_id, entity_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [tag_id, entity_id, entity_type]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur POST /api/tags/entity :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/tags/entity - Délier un tag d'une entité
router.delete('/api/tags/entity', checkAuth, async (req, res) => {
    try {
        const { tag_id, entity_id, entity_type } = req.query;
        if (!tag_id || !entity_id || !entity_type) {
            return res.status(400).json({ error: 'tag_id, entity_id et entity_type requis' });
        }

        await pool.query(
            'DELETE FROM lspd_entity_tags WHERE tag_id = $1 AND entity_id = $2::TEXT AND entity_type = $3',
            [tag_id, entity_id, entity_type]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur DELETE /api/tags/entity :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
