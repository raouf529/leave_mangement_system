const pool = require('../db');

let cron = null;
try {
    cron = require('node-cron');
} catch (error) {
    cron = null;
}

function getExerciseWindowForDate(dateValue) {
    const date = new Date(dateValue ?? Date.now());
    const year = date.getFullYear();
    const currentExerciseYear = date.getMonth() >= 6 ? year : year - 1;

    return {
        date,
        currentExerciseYear,
        nextExerciseYear: currentExerciseYear + 1,
        previousExerciseYear: currentExerciseYear - 1
    };
}

function getExerciseYearForDate(dateValue) {
    return getExerciseWindowForDate(dateValue).currentExerciseYear;
}

function assignBalance(attendance) {
    const attendedDays = Number(attendance) || 0;

    if (attendedDays < 9) {
        return 0;
    }
    if (attendedDays < 15) {
        return 1;
    }
    return 2.5;
}

function getMonthDateRange(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
        start,
        end,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10)
    };
}

const backgroundService = {
    // check expired leave requests and update their status to 'time out'
    async checkExpiredLeaveRequests() {
        try {
            const [expiredRequests] = await pool.query(
                `SELECT request_id FROM Leave_request WHERE request_status = 'pending' AND end_date < NOW()`
            );
            for (const request of expiredRequests) {
                await pool.query(
                    `UPDATE Leave_request SET request_status = 'time out' WHERE request_id = ?`,
                    [request.request_id]
                );
            }
        } catch (error) {
            throw new Error('Error checking expired leave requests: ' + error.message);
        }
    },
    // On 01 July, create the active exercise year and the next exercise year for every employee.
    async createNewExercise() {
        try {
            const { currentExerciseYear, nextExerciseYear } = getExerciseWindowForDate(new Date());
            const [employees] = await pool.query(`SELECT id FROM Employe`);

            for (const employee of employees) {
                for (const exerciseYear of [currentExerciseYear, nextExerciseYear]) {
                    const [existingExercise] = await pool.query(
                        `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                        [employee.id, exerciseYear]
                    );

                    if (existingExercise.length === 0) {
                        await pool.query(
                            `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, 0)`,
                            [employee.Emp_id, exerciseYear]
                        );
                    }
                }
            }
        } catch (error) {
            throw new Error('Error creating new exercise: ' + error.message);
        }
    },
    // At the end of each month, add the attendance-based balance to the current exercise year.
    async updateExerciseBalances() {
        try {
            const now = new Date();
            const { currentExerciseYear } = getExerciseWindowForDate(now);
            const { startDate, endDate } = getMonthDateRange(now);
            const [employees] = await pool.query(`SELECT Emp_id FROM Employee`);

            for (const employee of employees) {
                const [exerciseRows] = await pool.query(
                    `SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?`,
                    [employee.Emp_id, currentExerciseYear]
                );

                const [attendanceRow] = await pool.query(
                    `SELECT COUNT(*) AS attended_days FROM Attendance
                     WHERE Emp_id = ? AND attend = 1 AND attendance_date >= ? AND attendance_date < ?`,
                    [employee.Emp_id, startDate, endDate]
                );

                const attendedDays = Number(attendanceRow[0]?.attended_days || 0);
                const monthlyBalance = assignBalance(attendedDays);
                const currentBalance = Number(exerciseRows[0]?.balance || 0);
                const newBalance = currentBalance + monthlyBalance;

                if (exerciseRows.length === 0) {
                    await pool.query(
                        `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, ?)`,
                        [employee.Emp_id, currentExerciseYear, monthlyBalance]
                    );
                    continue;
                }

                await pool.query(
                    `UPDATE Exercise SET balance = ? WHERE Emp_id = ? AND year = ?`,
                    [newBalance, employee.Emp_id, currentExerciseYear]
                );
            }
        } catch (error) {
            throw new Error('Error updating exercise balances: ' + error.message);
        }
    }
};

if (cron) {
    cron.schedule('0 0 1 7 *', () => {
        backgroundService.createNewExercise().catch((error) => console.error('Exercise creation failed:', error.message));
    });

    cron.schedule('0 0 28-31 * *', () => {
        backgroundService.updateExerciseBalances().catch((error) => console.error('Exercise balance update failed:', error.message));
    });
}

module.exports = backgroundService;
module.exports.getExerciseYearForDate = getExerciseYearForDate;
module.exports.getExerciseWindowForDate = getExerciseWindowForDate;
module.exports.assignBalance = assignBalance;