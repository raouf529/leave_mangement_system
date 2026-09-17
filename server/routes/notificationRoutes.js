const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/unread', authenticateToken, notificationController.getUnreadNotifications);
router.get('/', authenticateToken, notificationController.getNotificationsByEmployeeId);
router.post('/:notificationId/read', authenticateToken, notificationController.markNotificationAsRead);

module.exports = router;