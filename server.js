require('dotenv').config();
const express = require('express');
const path    = require('path');

const authRoutes   = require('./routes/auth');
const habitRoutes  = require('./routes/habitos');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas API ─────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/habitos', habitRoutes);

// ── Catch-all: devolver index.html para el frontend SPA ───────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Iniciar servidor ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
