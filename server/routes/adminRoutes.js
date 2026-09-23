const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create-exercise', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExercise);
router.post('/create-exercise-by-id', authenticateToken, authorizeRoles('hr', 'admin'), adminController.createExerciseById);
router.get('/leave-titles', authenticateToken, authorizeRoles('hr', 'admin'), adminController.getApprovedLeaveTitles);
router.get('/leave-requests/employee/:employeeId', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.getLeaveRequests);
router.get('/leave-requests', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.getLeaveRequests);
router.post('/update-exercise-balance', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.updateExerciseBalance);
router.post('/update-leave-request', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.updateLeaveRequest);
router.post('/update-request-step', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.updateRequestStep);
router.post('/update-request-step-target', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.updateRequestStepTarget);
router.post('/update-request-step-decision', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.updateRequestStepDecision);
router.post('/trigger-monthly-job', authenticateToken, authorizeRoles('drh', 'hr', 'admin'), adminController.triggerMonthlyJob);

module.exports = router;