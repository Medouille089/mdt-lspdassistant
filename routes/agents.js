const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");

router.get('/api/user', checkAuth, async (req, res) => {
  const user = req.user;

  try {
    res.set('Cache-Control', 'no-store');

    res.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: user.roles,
      isSupervisor: user.isSupervisor,
      isCommandStaff: user.isCommandStaff,
      grade: user.grade
    });

  } catch (err) {
    console.error('Erreur fetch user:', err);
    res.status(500).json({ error: 'Impossible de récupérer les infos utilisateur.' });
  }
});


module.exports = router;
