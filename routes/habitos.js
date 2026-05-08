const express        = require('express');
const router         = express.Router();
const verificarToken = require('../middleware/auth');
const {
  getHabitos,
  getHabitoById,
  createHabito,
  updateHabito,
  deleteHabito,
  registrarCumplimiento,
  getRegistros,
  getCategorias,
} = require('../controllers/controllers');

// Todas las rutas requieren JWT
router.use(verificarToken);

// Categorias (necesario para el formulario del frontend)
router.get('/categorias', getCategorias);

// CRUD habitos
router.get('/',    getHabitos);
router.get('/:id', getHabitoById);
router.post('/',   createHabito);
router.put('/:id', updateHabito);
router.delete('/:id', deleteHabito);

// Registrar cumplimiento del dia (llama al Stored Procedure)
router.post('/:id/completar', registrarCumplimiento);

// Historial de registros de un habito
router.get('/:id/registros', getRegistros);

module.exports = router;
