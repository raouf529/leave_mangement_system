const pool = require('../db');

const attendanceService = {
    async getAttendanceByEmployeeId(employeeId) {
        try {
            const [rows] = await pool.query('SELECT * FROM Attendance WHERE Emp_id = ?', [employeeId]);
            return rows;
        }
        catch (error) {
            throw new Error('Error fetching attendance data: ' + error.message);
        }
    },
    async markAttendance(employeeId, date, status) {
        try {
            const [result] = await pool.query('INSERT INTO Attendance (Emp_id, date, status) VALUES (?, ?, ?)', [employeeId, date, status]);
            return result.insertId;
        }
        catch (error) {
            throw new Error('Error marking attendance: ' + error.message);
        }
    }
}