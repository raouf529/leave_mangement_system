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
        // Return attendance counts per month for an exercise year for specific employee
        try {
            const [employee] = await pool.query(`SELECT id FROM Employe WHERE id = ?`, [employeeId]);
            if (employee.length === 0) {
                throw new Error('Employee not found');
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
    },

    async updateMonthAttendance(employeeId, monthDateStr, count, exerciseYear) {
        try {
            const [employee] = await pool.query(
                `SELECT id FROM Employe WHERE id = ?`,
                [employeeId]
            );
            if (employee.length === 0) {
                throw new Error('Employee not found');
            }

            // Format date string to YYYY-MM-01
            const d = new Date(monthDateStr || Date.now());
            const monthFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

            const [existingAttendance] = await pool.query(
                `SELECT count, updated FROM Attendance_count WHERE Emp_id = ? AND month = ?`,
                [employeeId, monthFormatted]
            );

            const attendanceCount = Number(count) >= 0 ? Number(count) : 20;
            const balanceDelta = assignBalance(attendanceCount);

            if (existingAttendance.length > 0) {
                const oldBalanceDelta = assignBalance(existingAttendance[0].count);
                const netChange = balanceDelta - oldBalanceDelta;

                await pool.query(
                    `UPDATE Attendance_count SET count = ?, updated = true WHERE Emp_id = ? AND month = ?`,
                    [attendanceCount, employeeId, monthFormatted]
                );

                if (netChange !== 0 && exerciseYear) {
                    await pool.query(
                        `UPDATE Exercise SET balance = balance + ? WHERE Emp_id = ? AND year = ?`,
                        [netChange, employeeId, exerciseYear]
                    );
                }
            } else {
                await pool.query(
                    `INSERT INTO Attendance_count (Emp_id, month, count, updated) VALUES (?, ?, ?, true)`,
                    [employeeId, monthFormatted, attendanceCount]
                );

                if (exerciseYear) {
                    const [existingExercise] = await pool.query(
                        `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                        [employeeId, exerciseYear]
                    );

                    if (existingExercise.length === 0) {
                        await pool.query(
                            `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, ?)`,
                            [employeeId, exerciseYear, balanceDelta]
                        );
                    } else {
                        await pool.query(
                            `UPDATE Exercise SET balance = balance + ? WHERE Emp_id = ? AND year = ?`,
                            [balanceDelta, employeeId, exerciseYear]
                        );
                    }
                }
            }

            await createNotification({
                targetId: employeeId,
                content: `Votre présence a été mise à jour pour le mois ${monthFormatted.slice(0, 7)} (${attendanceCount} jours).`
            });

            return { success: true, message: 'Monthly attendance updated successfully' };
        } catch (error) {
            throw new Error('Error updating month attendance: ' + error.message);
        }
    }
};

module.exports = ExerciseService;