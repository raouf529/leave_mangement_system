/**
 * Shared database query utilities and common data operations.
 */
const pool = require('../db');

async function createNotification({ targetId, requestId, content }, connection = null) {
    if (!targetId || !content) {
        return;
    }
    try {
        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const query = 'INSERT INTO Notification (target_id, request_id, content, is_read, created_at) VALUES (?, ?, ?, ?, ?)';
        const values = [targetId, requestId || null, content, false, currentTimestamp];
        const runner = connection || pool;
        await runner.query(query, values);
    } catch (err) {
        console.error('Error creating notification:', err.message);
    }
}

async function getEmployeeById(employeeId, connection = null) {
    const runner = connection || pool;
    const [users] = await runner.query('SELECT * FROM Employe WHERE id = ?', [employeeId]);
    if (users.length === 0) {
        throw new Error('Employé introuvable.');
    }
    return users[0];
}

async function findExistingExercise(employeeId, exerciseYear, connection = null) {
    const runner = connection || pool;
    const [rows] = await runner.query(
        'SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?',
        [employeeId, exerciseYear]
    );
    return rows;
}

async function getUserById(userId, connection = null) {
    const runner = connection || pool;
    const [users] = await runner.query('SELECT * FROM Employe WHERE id = ?', [userId]);
    if (users.length === 0) {
        throw new Error('Employé introuvable.');
    }
    return users[0];
}

async function createLog(empId, action, details, connection = null) {
    try {
        const runner = connection || pool;
        await runner.query('INSERT INTO Logs (emp_id, action_type, details, action_timestamp) VALUES (?, ?, ?, ?)', [empId, action, details, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    } catch (error) {
        console.error('Error creating log:', error.message);
    }
}

module.exports = {
    createNotification,
    getEmployeeById,
    findExistingExercise,
    createLog
};
