const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');
const bot = require('../config/bot');
const config = require('../config/config');
const { EmbedBuilder } = require('discord.js');

// --- Weapon models (catalogue) ---
router.get('/api/weapon_models', checkAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM weapon_models ORDER BY model_name');
        res.json({ models: rows });
    } catch (err) {
        console.error('Erreur récupération weapon_models:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/api/weapon_models', checkAuth, async (req, res) => {
    try {
        const { model_name, image_url, created_by } = req.body;
        if (!model_name) return res.status(400).json({ error: 'model_name requis' });

        const user = req.user;
        const createdBy = created_by || user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `INSERT INTO weapon_models (model_name, image_url, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
            [model_name, image_url || null, createdBy]
        );

        // Optional logs can be added similar to other routes
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Erreur création weapon_model:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET single model
router.get('/api/weapon_models/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM weapon_models WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Modèle introuvable' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erreur récupération weapon_model:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Update model
router.put('/api/weapon_models/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { model_name, image_url } = req.body;
        if (!model_name) return res.status(400).json({ error: 'model_name requis' });

        const user = req.user;
        const updatedBy = user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `UPDATE weapon_models SET model_name = $1, image_url = $2, updated_by = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
            [model_name, image_url || null, updatedBy, id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Modèle introuvable' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erreur mise à jour weapon_model:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Delete model
router.delete('/api/weapon_models/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: existing } = await pool.query('SELECT * FROM weapon_models WHERE id = $1', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Modèle introuvable' });

        await pool.query('DELETE FROM weapon_models WHERE id = $1', [id]);
        res.json({ message: 'Modèle supprimé' });
    } catch (err) {
        console.error('Erreur suppression weapon_model:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Weapons CRUD ---
// GET /api/weapons?owner_id= - list weapons, filterable
router.get('/api/weapons', checkAuth, async (req, res) => {
    try {
        const { owner_id, model_id, search, limit = 20, offset = 0 } = req.query;
        let query = 'SELECT * FROM weapons WHERE 1=1';
        const params = [];
        let idx = 1;

        if (owner_id) {
            query += ` AND owner_id = $${idx}`;
            params.push(parseInt(owner_id));
            idx++;
        }
        if (model_id) {
            query += ` AND model_id = $${idx}`;
            params.push(parseInt(model_id));
            idx++;
        }
        if (search) {
            query += ` AND (LOWER(model_name) LIKE $${idx} OR LOWER(serial_number) LIKE $${idx})`;
            params.push(`%${search.toLowerCase()}%`);
            idx++;
        }

        // Count total
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].count);

        query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);
        res.json({ weapons: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error('Erreur récupération weapons:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET by id
router.get('/api/weapons/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM weapons WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Arme non trouvée' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erreur récupération weapon:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Create weapon - model chosen from weapon_models; owner chosen from citoyens
router.post('/api/weapons', checkAuth, async (req, res) => {
    try {
        const { model_id, serial_number, owner_id, created_by } = req.body;
        if (!model_id || !serial_number) return res.status(400).json({ error: 'model_id et serial_number requis' });

        // Récupérer le modèle
        const { rows: modelRows } = await pool.query('SELECT * FROM weapon_models WHERE id = $1', [model_id]);
        if (modelRows.length === 0) return res.status(400).json({ error: 'Modèle d\'arme introuvable' });
        const model = modelRows[0];

        // Récupérer le propriétaire si fourni
        let ownerName = null;
        if (owner_id) {
            const { rows: ownerRows } = await pool.query('SELECT nom, prenom FROM citoyens WHERE id = $1', [owner_id]);
            if (ownerRows.length > 0) {
                ownerName = `${ownerRows[0].prenom || ''} ${ownerRows[0].nom || ''}`.trim();
            }
        }

        const user = req.user;
        const createdBy = created_by || user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `INSERT INTO weapons (model_id, model_name, model_image_url, serial_number, owner_id, owner_name, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
            [model.id, model.model_name, model.image_url || null, serial_number, owner_id || null, ownerName || null, createdBy]
        );

        const newWeapon = rows[0];

        // Optional: send logs to Discord as in other routes
        res.status(201).json(newWeapon);
    } catch (err) {
        console.error('Erreur création weapon:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Update weapon
router.put('/api/weapons/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { model_id, serial_number, owner_id } = req.body;

        const { rows: existing } = await pool.query('SELECT * FROM weapons WHERE id = $1', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Arme non trouvée' });

        // If model changed, get model data
        let modelName = existing[0].model_name;
        let modelImage = existing[0].model_image_url;
        if (model_id) {
            const { rows: modelRows } = await pool.query('SELECT * FROM weapon_models WHERE id = $1', [model_id]);
            if (modelRows.length > 0) {
                modelName = modelRows[0].model_name;
                modelImage = modelRows[0].image_url || null;
            }
        }

        let ownerName = existing[0].owner_name;
        if (owner_id) {
            const { rows: ownerRows } = await pool.query('SELECT nom, prenom FROM citoyens WHERE id = $1', [owner_id]);
            if (ownerRows.length > 0) ownerName = `${ownerRows[0].prenom || ''} ${ownerRows[0].nom || ''}`.trim();
            else ownerName = null;
        }

        const user = req.user;
        const updatedBy = user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `UPDATE weapons SET model_id = $1, model_name = $2, model_image_url = $3, serial_number = $4, owner_id = $5, owner_name = $6, updated_by = $7, updated_at = NOW()
            WHERE id = $8 RETURNING *`,
            [model_id || existing[0].model_id, modelName, modelImage, serial_number || existing[0].serial_number, owner_id || existing[0].owner_id, ownerName, updatedBy, id]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('Erreur mise à jour weapon:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Delete weapon
router.delete('/api/weapons/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows: existing } = await pool.query('SELECT * FROM weapons WHERE id = $1', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Arme non trouvée' });

        await pool.query('DELETE FROM weapons WHERE id = $1', [id]);
        res.json({ message: 'Arme supprimée' });
    } catch (err) {
        console.error('Erreur suppression weapon:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
