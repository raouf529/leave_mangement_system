const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
// authRoutes.js
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/register', authenticateToken, authorizeRoles('hr'), authController.registerEmployee);
router.post('/login', authController.loginEmployee);
router.get('/me', authenticateToken, authController.getCurrentUser);
router.post('/logout', authController.logout);
module.exports = router;
