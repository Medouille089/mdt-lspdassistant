// GET /api/officer/convocations?userId=<discord_id>
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/api/officer/convocations', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "userId manquant" });
        const result = await pool.query(
            `SELECT * FROM lspd_convocations_agents WHERE agent_convoque_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération convocations officer:', err);
        res.status(500).json({ error: 'Impossible de récupérer les convocations de l’agent' });
    }
});

module.exports = router;
