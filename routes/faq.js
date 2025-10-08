const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');
const bot = require('../config/bot');
const { GUILD_ID } = require('../config/env');

// Simple in-memory edit lock (ownerId, ownerName, since)
let editLock = null;

// GET current edit lock
router.get('/api/faq/edit-lock', checkAuth, async (req, res) => {
  try {
    res.json(editLock || null);
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture lock' });
  }
});

// POST acquire lock
router.post('/api/faq/edit-lock', checkAuth, async (req, res) => {
  // only command staff, supervisor or superadmin can acquire
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  try {
    if (editLock && editLock.ownerId !== req.user.id) {
      return res.status(409).json({ error: 'Verrou déjà pris', current: editLock });
    }
    // Try to fetch the guild member to use the display name (same logic as routes/user.js)
    let ownerName = req.user.username || String(req.user.id);
    try {
      const guild = await bot.guilds.fetch(GUILD_ID);
      guild.members.cache.delete(req.user.id);
      const member = await guild.members.fetch(req.user.id);
      if (member) ownerName = member.displayName || ownerName;
    } catch (e) {
      // ignore and fallback to username
    }
    editLock = { ownerId: req.user.id, ownerName, since: new Date().toISOString() };
    res.json(editLock);
  } catch (e) {
    res.status(500).json({ error: 'Erreur acquisition lock' });
  }
});

// DELETE release lock
router.delete('/api/faq/edit-lock', checkAuth, async (req, res) => {
  try {
    if (!editLock) return res.json({ success: true });
    // only owner or superadmin can release
    if (editLock.ownerId !== req.user.id && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
    editLock = null;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur release lock' });
  }
});

// POST release lock (useful for sendBeacon / keepalive on unload)
router.post('/api/faq/edit-lock/release', checkAuth, async (req, res) => {
  try {
    if (!editLock) return res.json({ success: true });
    if (editLock.ownerId !== req.user.id && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
    editLock = null;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur release lock' });
  }
});

// PATCH une entrée FAQ (Command Staff ou SuperAdmin)
router.patch('/api/faq/:id', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { id } = req.params;
  const { titre, description, image } = req.body;
  if (!titre || !description) return res.status(400).json({ error: 'Champs manquants' });
  try {
    await pool.query(
      'UPDATE lspd_faq_entries SET titre = $1, description = $2, image = $3 WHERE id = $4',
      [titre, description, image || null, id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur modification FAQ' });
  }
});

// PATCH une catégorie FAQ (Command Staff ou SuperAdmin)
router.patch('/api/faq/category/:id', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom manquant' });
  try {
    await pool.query('UPDATE lspd_faq_categories SET nom = $1 WHERE id = $2', [name, id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur modification catégorie' });
  }
});

// DELETE une entrée FAQ (Command Staff ou SuperAdmin)
router.delete('/api/faq/:id', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM lspd_faq_entries WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur suppression FAQ' });
  }
});

// DELETE une catégorie FAQ (Command Staff ou SuperAdmin)
router.delete('/api/faq/category/:id', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM lspd_faq_categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur suppression catégorie' });
  }
});


// GET toutes les catégories + entrées
router.get('/api/faq', async (req, res) => {
  try {
    const { rows: categories } = await pool.query('SELECT * FROM lspd_faq_categories ORDER BY ordre, id');
    const { rows: entries } = await pool.query('SELECT * FROM lspd_faq_entries ORDER BY ordre, id');
    const cats = categories.map(cat => ({
      id: cat.id,
      nom: cat.nom,
      entries: entries.filter(e => e.category_id === cat.id)
    }));
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: 'Erreur chargement FAQ' });
  }
});

// POST nouvelle entrée (Command Staff)
router.post('/api/faq', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { titre, description, image, categoryId } = req.body;
  if (!titre || !description || !categoryId) return res.status(400).json({ error: 'Champs manquants' });
  try {
    await pool.query(
      'INSERT INTO lspd_faq_entries (titre, description, image, category_id, auteur_id) VALUES ($1,$2,$3,$4,$5)',
      [titre, description, image || null, categoryId, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur ajout FAQ' });
  }
});

// POST nouvelle catégorie (Command Staff)
router.post('/api/faq/category', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom manquant' });
  try {
    await pool.query('INSERT INTO lspd_faq_categories (nom) VALUES ($1)', [name]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur ajout catégorie' });
  }
});

// PATCH update categories order (expects { order: [id1,id2,...] })
router.patch('/api/faq/order/categories', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Order manquant' });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        await client.query('UPDATE lspd_faq_categories SET ordre = $1 WHERE id = $2', [i, id]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Erreur mise à jour ordre catégories' });
  }
});

// PATCH update entries order (expects array of { id, categoryId, ordre })
router.patch('/api/faq/order/entries', checkAuth, async (req, res) => {
  if (!req.user?.isCommandStaff && !req.user?.isSupervisor && !req.user?.isSuperAdmin) return res.status(403).json({ error: 'Accès refusé' });
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Payload invalide' });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const it of items) {
        const { id, categoryId, ordre } = it;
        await client.query('UPDATE lspd_faq_entries SET category_id = $1, ordre = $2 WHERE id = $3', [categoryId, ordre, id]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Erreur mise à jour ordre entrées' });
  }
});

module.exports = router;
