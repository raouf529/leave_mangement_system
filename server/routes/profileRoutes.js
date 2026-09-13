const express = require('express');
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', authenticateToken, profileController.getProfile);
router.get('/me/underemployees', authenticateToken, profileController.getUnderemployees);
router.get('/all', authenticateToken, profileController.getAllEmployees);
router.get('/:id', authenticateToken, profileController.getProfile);
router.put('/:id', authenticateToken, profileController.updateProfile);

module.exports = router;