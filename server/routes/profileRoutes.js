const express = require('express');
const profileController = require('../controllers/profileController');
const { authenticateToken, authorizeRoles, authorizeProfileAccess } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', authenticateToken, profileController.getProfile);
router.get('/me/underemployees', authenticateToken, authorizeRoles('head', 'hr', 'admin'), profileController.getUnderemployees);
router.get('/company-employees', authenticateToken, authorizeRoles('hr'), profileController.getCompanyEmployees);
router.get('/all', authenticateToken, authorizeRoles('head', 'hr', 'admin'), profileController.getAllEmployees);
router.get('/:id', authenticateToken, authorizeProfileAccess, profileController.getProfile);
router.put('/:id', authenticateToken, profileController.updateProfile);

module.exports = router;