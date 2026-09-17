const notificationService = require('../services/notificationServices');

const notificationController = {
    async getNotificationsByEmployeeId(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }  
            const notifications = await notificationService.getNotificationsByEmployeeId(employeeId);
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async markNotificationAsRead(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const notificationId = req.params.notificationId;
            const success = await notificationService.markNotificationAsRead(notificationId, employeeId);
            if (success) {
                res.json({ message: 'Notification marked as read' });
            } else {
                res.status(404).json({ error: 'Notification not found or access denied' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async getUnreadNotifications(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const notifications = await notificationService.getUnreadNotifications(employeeId);
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = notificationController;