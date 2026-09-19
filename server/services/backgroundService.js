const pool = require('../db');
const { getExerciseWindowForDate, getExerciseYearForDate, assignBalance } = require('../utils/helpers');
const { createNotification } = require('../utils/dbUtils');

let cron = null;
try {
    cron = require('node-cron');
} catch (error) {
    cron = null;
}


const backgroundService = {
    // check expired leave requests and update their status to 'time out'
    async checkExpiredLeaveRequests() {
        try {
            const [expiredRequests] = await pool.query(
                `SELECT request_id, Emp_id FROM Leave_request WHERE request_status = 'pending' AND end_date < NOW()`
            );
            for (const request of expiredRequests) {
                await pool.query(
                    `UPDATE Leave_request SET request_status = 'time out' WHERE request_id = ?`,
                    [request.request_id]
                );
                await createNotification({
                    targetId: request.Emp_id,
                    requestId: request.request_id,
                    content: `Your leave request has been timed out.`
                });
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
                        // INSERT IGNORE: if admin created this row concurrently, silently skip instead of erroring.
                        // Requires a UNIQUE key on (Emp_id, year) in Exercise to actually take effect.
                        await pool.query(
                            `INSERT IGNORE INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, 0, NOW())`,
                            [employee.id, exerciseYear]
                        );
                    }
                }
            }
        } catch (error) {
            throw new Error('Error creating new exercise: ' + error.message);
        }
    },
    // Executed on the 1st of each month:
    // Adds 2.5 balance for each employee (calculates pro-rated balance for newly recruited employees in their first month).
    async updateExerciseBalances() {
        try {
            const [employees] = await pool.query('SELECT id, date_entree FROM Employe');
            const now = new Date();
            const exerciseYear = getExerciseYearForDate(now);

            for (const employee of employees) {
                const hireDate = new Date(employee.date_entree);
                const isNewEmployee = (
                    hireDate.getFullYear() === now.getFullYear() &&
                    hireDate.getMonth() === now.getMonth()
                );

                let balanceToAdd = 2.5;

                if (isNewEmployee) {
                    const diffTime = Math.max(0, now - hireDate);
                    const attendedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    balanceToAdd = assignBalance(attendedDays);
                }

                // Ensure an Exercise record exists for this exercise year, then add the balance.
                // INSERT IGNORE + always-UPDATE is safe whether or not admin already created the row
                // concurrently (requires a UNIQUE key on (Emp_id, year) in Exercise to actually dedupe).
                await pool.query(
                    `INSERT IGNORE INTO Exercise (Emp_id, year, balance) VALUES (?, ?, 0)`,
                    [employee.id, exerciseYear]
                );
                await pool.query(
                    `UPDATE Exercise SET balance = balance + ? WHERE Emp_id = ? AND year = ?`,
                    [balanceToAdd, employee.id, exerciseYear]
                );

                // Create notification for employee
                await createNotification({
                    targetId: employee.id,
                    requestId: null,
                    content: `Votre solde de congé a été crédité de ${balanceToAdd} jours ce mois-ci.`
                });
            }
        } catch (error) {
            throw new Error('Error updating exercise balances: ' + error.message);
        }
    }
};

backgroundService.autoupdateExercse = backgroundService.updateExerciseBalances;

// Runs on the 1st of every month. In July (fiscal year start), also creates the
// new exercise-year rows before crediting the monthly balance.
backgroundService.runMonthlyJob = async function runMonthlyJob() {
    const now = new Date();
    if (now.getMonth() === 6) { // July, JS months are 0-indexed
        await backgroundService.createNewExercise();
    }
    await backgroundService.updateExerciseBalances();
};

if (cron) {
    cron.schedule('0 0 1 * *', () => {
        backgroundService.runMonthlyJob().catch((error) => console.error('Monthly exercise job failed:', error.message));
    });
}

module.exports = backgroundService;
module.exports.getExerciseYearForDate = getExerciseYearForDate;
module.exports.getExerciseWindowForDate = getExerciseWindowForDate;
module.exports.assignBalance = assignBalance;