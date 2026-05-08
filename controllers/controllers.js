const pool   = require('../db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ============================================================
//  AUTH
// ============================================================

async function register(req, res) {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son requeridos.' });
  }

  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya esta registrado.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, nombre, email, rol, fecha_registro`,
      [nombre, email, hash]
    );

    res.status(201).json({ mensaje: 'Usuario registrado correctamente.', usuario: result.rows[0] });
  } catch (err) {
    console.error('Error en register:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son requeridos.' });
  }

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas.' });
    }

    const usuario = result.rows[0];
    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales invalidas.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ============================================================
//  HABITOS – CRUD
// ============================================================

async function getHabitos(req, res) {
  try {
    const result = await pool.query(
      `SELECT h.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM habitos h
       JOIN categorias c ON h.id_categoria = c.id
       WHERE h.id_usuario = $1
       ORDER BY h.fecha_creacion DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en getHabitos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function getHabitoById(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT h.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM habitos h
       JOIN categorias c ON h.id_categoria = c.id
       WHERE h.id = $1 AND h.id_usuario = $2`,
      [id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Habito no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en getHabitoById:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// Usa una TRANSACCION con BEGIN / COMMIT / ROLLBACK
async function createHabito(req, res) {
  const { id_categoria, nombre, descripcion, frecuencia, meta_dias, fecha_inicio } = req.body;

  if (!id_categoria || !nombre) {
    return res.status(400).json({ error: 'id_categoria y nombre son requeridos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que la categoria exista
    const cat = await client.query('SELECT id FROM categorias WHERE id = $1', [id_categoria]);
    if (cat.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La categoria indicada no existe.' });
    }

    const result = await client.query(
      `INSERT INTO habitos (id_usuario, id_categoria, nombre, descripcion, frecuencia, meta_dias, fecha_inicio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.usuario.id,
        id_categoria,
        nombre,
        descripcion || null,
        frecuencia  || 'diario',
        meta_dias   || 30,
        fecha_inicio || new Date().toISOString().split('T')[0]
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en createHabito (ROLLBACK ejecutado):', err.message);
    res.status(500).json({ error: 'Error al crear el habito. Transaccion revertida.' });
  } finally {
    client.release();
  }
}

async function updateHabito(req, res) {
  const { id } = req.params;
  const { id_categoria, nombre, descripcion, frecuencia, meta_dias, activo } = req.body;

  try {
    // Verificar que pertenece al usuario
    const check = await pool.query(
      'SELECT id FROM habitos WHERE id = $1 AND id_usuario = $2',
      [id, req.usuario.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Habito no encontrado.' });
    }

    const result = await pool.query(
      `UPDATE habitos
       SET id_categoria = COALESCE($1, id_categoria),
           nombre       = COALESCE($2, nombre),
           descripcion  = COALESCE($3, descripcion),
           frecuencia   = COALESCE($4, frecuencia),
           meta_dias    = COALESCE($5, meta_dias),
           activo       = COALESCE($6, activo)
       WHERE id = $7 AND id_usuario = $8
       RETURNING *`,
      [id_categoria, nombre, descripcion, frecuencia, meta_dias, activo, id, req.usuario.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en updateHabito:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function deleteHabito(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM habitos WHERE id = $1 AND id_usuario = $2 RETURNING id',
      [id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Habito no encontrado.' });
    }
    res.json({ mensaje: 'Habito eliminado correctamente.' });
  } catch (err) {
    console.error('Error en deleteHabito:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ============================================================
//  REGISTROS – Marcar cumplimiento del dia usando el Stored Procedure
// ============================================================

async function registrarCumplimiento(req, res) {
  const { id } = req.params; // id del habito
  const { nota } = req.body;

  try {
    // Verificar que el habito pertenece al usuario autenticado
    const check = await pool.query(
      'SELECT id FROM habitos WHERE id = $1 AND id_usuario = $2 AND activo = TRUE',
      [id, req.usuario.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Habito no encontrado o inactivo.' });
    }

    // Llamar al Stored Procedure
    await pool.query('CALL registrar_cumplimiento($1, $2)', [id, nota || null]);

    res.json({ mensaje: '¡Habito marcado como completado hoy!' });
  } catch (err) {
    if (err.message.includes('duplicate key') || err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El habito ya fue registrado hoy.' });
    }
    console.error('Error en registrarCumplimiento:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function getRegistros(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.*
       FROM registros_habitos r
       JOIN habitos h ON r.id_habito = h.id
       WHERE r.id_habito = $1 AND h.id_usuario = $2
       ORDER BY r.fecha DESC`,
      [id, req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en getRegistros:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ============================================================
//  CATEGORIAS
// ============================================================

async function getCategorias(req, res) {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error('Error en getCategorias:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = {
  register,
  login,
  getHabitos,
  getHabitoById,
  createHabito,
  updateHabito,
  deleteHabito,
  registrarCumplimiento,
  getRegistros,
  getCategorias,
};
