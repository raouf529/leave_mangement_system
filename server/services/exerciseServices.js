const pool = require('../db');
const { assignBalance } = require('../utils/helpers');
const { createNotification } = require('../utils/dbUtils');


const ExerciseService = {
    async getAllExercises() {
        try {
            const [rows] = await pool.query('SELECT * FROM Exercise');
            return rows;
        } catch (error) {
            throw new Error('Error fetching exercises: ' + error.message);
        }
    },

    async getAllMonths(employeeId, exerciseYear) {
        try {
            const [employee] = await pool.query(`SELECT id FROM Employe WHERE id = ?`, [employeeId]);
            if (employee.length === 0) {
                throw new Error('Employé introuvable.');
            }

            // In Attendance_count table, `month` is a DATE field (e.g. '2026-09-01').
            // We filter by employee id and check if month falls within the exercise year period.
            const yearNum = Number(exerciseYear);
            const startDate = `${yearNum}-07-01`;
            const endDate = `${yearNum + 1}-06-30`;

            const [months] = await pool.query(
                `SELECT Emp_id, DATE_FORMAT(month, '%Y-%m-%d') as month, count, updated 
                 FROM Attendance_count 
                 WHERE Emp_id = ? AND month >= ? AND month <= ?
                 ORDER BY month ASC`,
                [employeeId, startDate, endDate]
            );
            return months;
        } catch (error) {
            throw new Error('Error getting all months: ' + error.message);
        }
    }
};

module.exports = ExerciseService;
