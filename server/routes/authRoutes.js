const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');

const router = express.Router();

router.post('/admin/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  try {
    const db = await getDb();
    const admin = await db.get('SELECT * FROM admins WHERE email = $1', email);
    await db.close();

    if (!admin) {
      return res.status(401).json({ error: 'Admin não encontrado.' });
    }

    const valid = await bcrypt.compare(senha, admin.senha_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Senha de admin inválida.' });
    }

    req.session.admin = { id: admin.id, email: admin.email };
    return res.json({ message: 'Login admin realizado com sucesso.', admin: req.session.admin });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao realizar login admin.' });
  }
});

router.get('/session', (req, res) => {
  res.json({ admin: req.session.admin || null });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout realizado com sucesso.' });
  });
});

module.exports = router;
