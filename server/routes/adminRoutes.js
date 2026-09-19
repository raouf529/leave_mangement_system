const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create-exercise', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExercise);
router.post('/create-exercise-by-id', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExerciseById);
router.get('/leave-requests/employee/:employeeId', authenticateToken, authorizeRoles('hr', 'admin'), adminController.getLeaveRequests);
router.get('/leave-requests', authenticateToken, authorizeRoles('hr', 'admin'), adminController.getLeaveRequests);
router.post('/update-exercise-balance', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateExerciseBalance);
router.post('/update-leave-request', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateLeaveRequest);
router.post('/update-request-step', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateRequestStep);
router.post('/update-request-step-target', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateRequestStepTarget);
router.post('/update-request-step-decision', authenticateToken, authorizeRoles('hr', 'admin'), adminController.updateRequestStepDecision);
router.post('/trigger-monthly-job', authenticateToken, authorizeRoles('hr', 'admin'), adminController.triggerMonthlyJob);

module.exports = router;