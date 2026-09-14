const express = require('express');
const requestController = require('../controllers/requestContoller');
const { authenticateToken, authorizeRoles, authorizeRequestAccess, authorizeRequestStepAccess, authorizeRequestTargetAccess } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, requestController.createRequest);
router.get('/steps/me', authenticateToken, requestController.getMyPendingSteps);
router.get('/steps/:targetId', authenticateToken, authorizeRequestTargetAccess, requestController.getRequestSteps);
router.patch('/step/:stepId', authenticateToken, authorizeRequestStepAccess, requestController.updateRequestStep);
router.get('/:requestId', authenticateToken, authorizeRequestAccess, requestController.getRequestDetails);
router.patch('/:requestId/cancel', authenticateToken, authorizeRequestAccess, requestController.cancelRequest);

module.exports = router;


