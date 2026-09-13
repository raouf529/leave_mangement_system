const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', authController.registerEmployee);
router.post('/login', authController.loginEmployee);
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
