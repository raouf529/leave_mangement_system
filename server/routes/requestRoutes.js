const express = require('express');
const requestController = require('../controllers/requstContoller');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, requestController.createRequest);
router.get('/steps/me', authenticateToken, requestController.getMyPendingSteps);
router.get('/steps/:targetId', authenticateToken, requestController.getRequestSteps);
router.patch('/step/:stepId', authenticateToken, requestController.updateRequestStep);
router.get('/:requestId', authenticateToken, requestController.getRequestDetails);
router.patch('/:requestId/cancel', authenticateToken, requestController.cancelRequest);

module.exports = router;
