const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create-exercise', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExercise);
router.post('/create-exercise-new-employee', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExerciseNewEmployee);
router.post('/update-exercise-balance', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateExerciseBalance);
router.post('/update-leave-request', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateLeaveRequest);
router.post('/update-request-step', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateRequestStep);

module.exports = router;
