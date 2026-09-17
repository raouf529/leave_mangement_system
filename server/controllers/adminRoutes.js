const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/create-exercise', authMiddleware.protect, authMiddleware.requireRole('hr'), adminController.createExercise);
router.post('/create-exercise-new-employee', authMiddleware.protect, authMiddleware.requireRole('hr'), adminController.createExerciseNewEmployee);
router.post('/update-exercise-balance', authMiddleware.protect, authMiddleware.requireRole('hr'), adminController.updateExerciseBalance);
router.post('/update-leave-request', authMiddleware.protect, authMiddleware.requireRole('hr'), adminController.updateLeaveRequest);
router.post('/update-request-step', authMiddleware.protect, authMiddleware.requireRole('hr'), adminController.updateRequestStep);

module.exports = router;
