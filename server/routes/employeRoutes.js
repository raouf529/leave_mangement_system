const express = require('express');
const router = express.Router();
const employeController = require('../controllers/employeController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/services', authenticateToken, employeController.getAllServices);
router.get('/departements', authenticateToken, employeController.getAllDepartements);
router.get('/directions', authenticateToken, employeController.getAllDirections);

router.post('/create', authenticateToken, authorizeRoles('drh'), employeController.createEmployee);
router.post('/change-role', authenticateToken, authorizeRoles('drh', 'admin'), employeController.changeRole);

module.exports = router;
