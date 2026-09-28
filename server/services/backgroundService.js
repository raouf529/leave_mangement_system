const pool = require('../db');
const { getExerciseWindowForDate, getExerciseYearForDate, assignBalance } = require('../utils/helpers');
const { createNotification, createLog } = require('../utils/dbUtils');

let cron = null;
try {
    cron = require('node-cron');
} catch (error) {
    cron = null;
}


const backgroundService = {
    // check expired leave requests and update their status to 'time out'.
    // A request is considered expired when its first day is strictly in the past.
    async checkExpiredLeaveRequests() {
        try {
            const [expiredRequests] = await pool.query(
                `SELECT request_id, Emp_id FROM Leave_request
                 WHERE request_status = 'pending'
                   AND start_date < CURDATE()`
            );
            for (const request of expiredRequests) {
                await pool.query(
                    `UPDATE Leave_request SET request_status = 'time out' WHERE request_id = ?`,
                    [request.request_id]
                );
                await createNotification({
                    targetId: request.Emp_id,
                    requestId: request.request_id,
                    content: `Votre demande de congé a expiré (délai dépassé).`
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
            const [employees] = await pool.query(`SELECT id FROM Employe WHERE role_leave_validation != 'admin'`);

            for (const employee of employees) {
                for (const exerciseYear of [currentExerciseYear, nextExerciseYear]) {
                    const [existingExercise] = await pool.query(
                        `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                        [employee.id, exerciseYear]
                    );

                    if (existingExercise.length === 0) {
                        await pool.query(
                            `INSERT IGNORE INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, 0, NOW())`,
                            [employee.id, exerciseYear]
                        );
                        await createLog(employee.id, 'CREATE_EXERCISE', `Exercice ${exerciseYear} créé automatiquement (solde initial: 0).`);
                    }
                }
            }
        } catch (error) {
            throw new Error('Error creating new exercise: ' + error.message);
        }
    },
    // Executed on the 1st of each month: Adds 2.5 balance for each employee
    async updateExerciseBalances() {
        try {
            const [employees] = await pool.query(`SELECT id, date_entree FROM Employe WHERE role_leave_validation != 'admin'`);
            const now = new Date();
            const exerciseYear = getExerciseYearForDate(now);

            for (const employee of employees) {
                let balanceToAdd = 2.5;
                await pool.query(
                    `INSERT IGNORE INTO Exercise (Emp_id, year, balance) VALUES (?, ?, 0)`,
                    [employee.id, exerciseYear]
                );
                await pool.query(
                    `UPDATE Exercise SET balance = balance + ? WHERE Emp_id = ? AND year = ?`,
                    [balanceToAdd, employee.id, exerciseYear]
                );
                await createLog(employee.id, 'UPDATE_EXERCISE', `Solde de l'exercice ${exerciseYear} mis à jour (+${balanceToAdd} jours).`);
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
backgroundService.runMonthlyJob = async function runMonthlyJob() {
    const now = new Date();
    if (now.getMonth() === 6) { 
        await backgroundService.createNewExercise();
    }
    await backgroundService.updateExerciseBalances();
};

if (cron) {
    // 1st of every month at midnight: credit balance + (in July) create new exercise rows
    cron.schedule('0 0 1 * *', () => {
        backgroundService.runMonthlyJob().catch((error) => console.error('Monthly exercise job failed:', error.message));
    });

    // Every day at midnight: expire pending requests whose leave period is fully past
    cron.schedule('0 0 * * *', () => {
        backgroundService.checkExpiredLeaveRequests().catch((error) => console.error('Expired request check failed:', error.message));
    });
}

module.exports = backgroundService;
module.exports.getExerciseYearForDate = getExerciseYearForDate;
module.exports.getExerciseWindowForDate = getExerciseWindowForDate;
module.exports.assignBalance = assignBalance;