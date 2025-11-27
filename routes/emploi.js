const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ============================================
// GET - Récupérer l'emploi du temps complet
// ============================================
router.get("/api/emploi-du-temps", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM v_emploi_complet
      ORDER BY jour_numero, creneau_ordre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erreur récupération emploi du temps:", error);
    res.status(500).json({
      error: "Erreur lors de la récupération de l'emploi du temps",
      details: error.message
    });
  }
});

// ============================================
// GET - Récupérer les données de référence
// ============================================
router.get("/api/emploi/jours", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, numero
      FROM jours
      WHERE actif = true
      ORDER BY numero
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erreur récupération jours:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des jours" });
  }
});

router.get("/api/emploi/creneaux", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, heure_debut, heure_fin, ordre
      FROM creneaux
      WHERE actif = true
      ORDER BY ordre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erreur récupération créneaux:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des créneaux" });
  }
});

router.get("/api/emploi/matieres", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, code, couleur, description
      FROM matieres
      WHERE actif = true
      ORDER BY nom
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erreur récupération matières:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des matières" });
  }
});

router.get("/api/emploi/professeurs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, prenom, email, specialite
      FROM professeurs
      WHERE actif = true
      ORDER BY nom, prenom
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erreur récupération professeurs:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des professeurs" });
  }
});

// ============================================
// POST - Ajouter un cours à l'emploi du temps
// ============================================
router.post("/api/emploi-du-temps", async (req, res) => {
  const { jour_id, creneau_id, matiere_id, professeur_id, salle, remarques } = req.body;

  // Validation des données
  if (!jour_id || !creneau_id) {
    return res.status(400).json({
      error: "Le jour et le créneau sont obligatoires"
    });
  }

  try {
    // Vérifier si un cours existe déjà à ce créneau
    const checkResult = await pool.query(
      `SELECT id FROM emploi_du_temps WHERE jour_id = $1 AND creneau_id = $2`,
      [jour_id, creneau_id]
    );

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        error: "Un cours existe déjà à ce créneau. Veuillez le modifier ou le supprimer d'abord."
      });
    }

    // Insérer le nouveau cours
    const result = await pool.query(
      `INSERT INTO emploi_du_temps
        (jour_id, creneau_id, matiere_id, professeur_id, salle, remarques, actif)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [jour_id, creneau_id, matiere_id || null, professeur_id || null, salle || null, remarques || null]
    );

    console.log("✅ Cours ajouté avec succès:", result.rows[0]);
    res.status(201).json({
      success: true,
      message: "Cours ajouté avec succès",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Erreur ajout cours:", error);
    res.status(500).json({
      error: "Erreur lors de l'ajout du cours",
      details: error.message
    });
  }
});

// ============================================
// PUT - Modifier un cours existant
// ============================================
router.put("/api/emploi-du-temps/:id", async (req, res) => {
  const { id } = req.params;
  const { matiere_id, professeur_id, salle, remarques } = req.body;

  try {
    const result = await pool.query(
      `UPDATE emploi_du_temps
       SET matiere_id = $1,
           professeur_id = $2,
           salle = $3,
           remarques = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [matiere_id || null, professeur_id || null, salle || null, remarques || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cours non trouvé" });
    }

    console.log("✅ Cours modifié avec succès:", result.rows[0]);
    res.json({
      success: true,
      message: "Cours modifié avec succès",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Erreur modification cours:", error);
    res.status(500).json({
      error: "Erreur lors de la modification du cours",
      details: error.message
    });
  }
});

// ============================================
// DELETE - Supprimer un cours
// ============================================
router.delete("/api/emploi-du-temps/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM emploi_du_temps WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cours non trouvé" });
    }

    console.log("✅ Cours supprimé avec succès");
    res.json({
      success: true,
      message: "Cours supprimé avec succès"
    });
  } catch (error) {
    console.error("❌ Erreur suppression cours:", error);
    res.status(500).json({
      error: "Erreur lors de la suppression du cours",
      details: error.message
    });
  }
});

// ============================================
// POST - Ajouter une nouvelle matière
// ============================================
router.post("/api/emploi/matieres", async (req, res) => {
  const { nom, code, couleur, description } = req.body;

  if (!nom) {
    return res.status(400).json({ error: "Le nom de la matière est obligatoire" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO matieres (nom, code, couleur, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nom, code || null, couleur || '#3498db', description || null]
    );

    res.status(201).json({
      success: true,
      message: "Matière ajoutée avec succès",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Erreur ajout matière:", error);
    res.status(500).json({
      error: "Erreur lors de l'ajout de la matière",
      details: error.message
    });
  }
});

// ============================================
// POST - Ajouter un nouveau professeur
// ============================================
router.post("/api/emploi/professeurs", async (req, res) => {
  const { nom, prenom, email, telephone, specialite } = req.body;

  if (!nom || !prenom) {
    return res.status(400).json({ error: "Le nom et le prénom sont obligatoires" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO professeurs (nom, prenom, email, telephone, specialite)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nom, prenom, email || null, telephone || null, specialite || null]
    );

    res.status(201).json({
      success: true,
      message: "Professeur ajouté avec succès",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Erreur ajout professeur:", error);
    res.status(500).json({
      error: "Erreur lors de l'ajout du professeur",
      details: error.message
    });
  }
});

module.exports = router;
