const path = require('path');
const express = require('express');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'barbearia-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api', bookingRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', url: 'http://localhost:3000' });
});

app.get('*', (req, res) => {
  const routes = {
    '/': 'index.html',
    '/servicos': 'servicos.html',
    '/agendar': 'agendar.html',
    '/perfil': 'perfil.html',
    '/admin': 'admin.html',
  };

  const file = routes[req.path];
  if (file) {
    return res.sendFile(path.join(__dirname, '..', 'public', file));
  }

  return res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
