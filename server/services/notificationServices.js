const pool = require('../db');

const notificationService = {
    async getNotificationsByEmployeeId(employeeId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM Notification WHERE target_id = ? ORDER BY created_at DESC',
                [employeeId]
            );
            return rows;
        } catch (error) {
            throw new Error('Error fetching notifications: ' + error.message);
        }
    },
    async markNotificationAsRead(notificationId, employeeId) {
        try {
            const [result] = await pool.query(
                'UPDATE Notification SET is_read = true WHERE notification_id = ? AND target_id = ?',
                [notificationId, employeeId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error('Error marking notification as read: ' + error.message);
        }
    },
    async getUnreadNotifications(employeeId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM Notification WHERE target_id = ? AND is_read = false ORDER BY created_at DESC',
                [employeeId]
            );
            return rows;
        } catch (error) {
            throw new Error('Error fetching unread notifications: ' + error.message);
        }
    }
};

module.exports = notificationService;