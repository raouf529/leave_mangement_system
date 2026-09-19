const pool = require('../db');
const { assignBalance, getExerciseWindowForDate } = require('../utils/helpers');


// Exercise.year = fiscal start year (Jul startYear – Jun startYear+1)
function getExerciseYearForDate(date) {
    return date.getMonth() < 6 ? date.getFullYear() - 1 : date.getFullYear();
}


// e.g. Sept -> Jan (next year) = 4, July -> May (next year) = 10
function monthsBetween(from, to) {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

// month is 0-based (as returned by getMonth()); day 0 of next month = last day of this month (handles leap years)
function getMonthEnd(year, month){
    return new Date(year, month + 1, 0).getDate();
}

function calculateInitialBalance(hireDate, referenceDate = new Date()) {
    const hire_month = hireDate.getMonth();
    const start_month_attendence = getMonthEnd(hireDate.getFullYear(), hire_month) - hireDate.getDate() + 1;
    const start_month_balance = assignBalance(start_month_attendence);
    const monthsSinceHire = Math.max(monthsBetween(hireDate, referenceDate), 0);
    return start_month_balance + (monthsSinceHire * 2.5);
}

function assignContinuingBalance(exerciseYear, referenceDate = new Date()) {
    const julyFirst = new Date(exerciseYear, 6, 1);
    const monthsElapsed = Math.max(monthsBetween(julyFirst, referenceDate) + 1, 0);
    return monthsElapsed * 2.5;
}



const adminServices = {
    async getLeaveRequests(employeeId) {
        const whereClause = employeeId === undefined ? '' : 'WHERE lr.Emp_id = ?';
        const queryParams = employeeId === undefined ? [] : [employeeId];
        const [requests] = await pool.query(
            `SELECT lr.*, e.nom, e.prenom, e.email
             FROM Leave_request lr
             JOIN Employe e ON e.id = lr.Emp_id
             ${whereClause}
             ORDER BY lr.created_at DESC, lr.request_id DESC`,
            queryParams
        );

        if (requests.length === 0) return [];

        const requestIds = requests.map((request) => request.request_id);
        const [steps] = await pool.query(
            `SELECT rs.step_id, rs.request_id, rs.step_order, rs.target_id,
                    rs.decision, rs.comment, rs.decided_at,
                    e.nom AS target_last_name, e.prenom AS target_first_name,
                    e.role AS target_role
             FROM Request_step rs
             JOIN Employe e ON e.id = rs.target_id
             WHERE rs.request_id IN (?)
             ORDER BY rs.request_id, rs.step_order`
            , [requestIds]
        );

        const stepsByRequest = steps.reduce((result, step) => {
            if (!result[step.request_id]) result[step.request_id] = [];
            result[step.request_id].push(step);
            return result;
        }, {});

        return requests.map((request) => ({
            ...request,
            steps: stepsByRequest[request.request_id] ?? []
        }));
    },
    async createExercise() {
        try {
            const now = new Date();
            const year = getExerciseYearForDate(now);

            const [employees] = await pool.query(`SELECT id, date_entree FROM Employe`);

            for (const employee of employees) {
                const [existingExercise] = await pool.query(
                    `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                    [employee.id, year]
                );
                const hireDate = new Date(employee.date_entree);
                const hiredThisExercise = getExerciseYearForDate(hireDate) === year;

                const balance = hiredThisExercise
                    ? calculateInitialBalance(hireDate, now)
                    : assignContinuingBalance(year, now);

                await pool.query(
                    `INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
                    [employee.id, year, balance]
                );
            }
        } catch (error) {
            throw new Error('Error creating new exercise: ' + error.message);
        }
    },
    async createExerciseById({ empId, year, balance }) {
        // create exercise manually for a specific employee
        try {
            const now = new Date();

            if (!Number.isInteger(year)) {
                throw new Error('Year must be an integer');
            }
            if (!Number.isFinite(balance) || balance < 0 || balance > 30) {
                throw new Error('Balance must be between 0 and 30');
            }

            // Get employee info
            const [employee] = await pool.query(
                `SELECT date_entree FROM Employe WHERE id = ?`,
                [empId]
            );

            if (!employee || employee.length === 0) {
                throw new Error(`Employee not found: ${empId}`);
            }

            const hireDate = new Date(employee[0].date_entree);
            const currentExerciseYear = getExerciseYearForDate(now);
            const hireExerciseYear = getExerciseYearForDate(hireDate);

            if (year > currentExerciseYear) {
                throw new Error(`Exercise year cannot be in the future (latest allowed: ${currentExerciseYear})`);
            }
            if (year < hireExerciseYear) {
                throw new Error(`Exercise year cannot be before the employee's recruitment year (${hireExerciseYear})`);
            }

            await pool.query(
                `INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
                [empId, year, balance]
            );
        } catch (error) {
            throw new Error(`Error creating exercise for employee ${empId}: ` + error.message);
        }
    },
    async updateExerciseBalance({ empId, year, balance } = {}) {
        // Update exercise balance manually for an employee
        try {
            const [existingExercise] = await pool.query(
                `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                [empId, year]
            );
            if (existingExercise.length === 0) {
                await pool.query(
                    `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, ?)`,
                    [empId, year, balance ?? 0]
                );
            } else {
                await pool.query(
                    `UPDATE Exercise SET balance = ? WHERE Emp_id = ? AND year = ?`,
                    [balance, empId, year]
                );
            }
            const [updated] = await pool.query(
                `SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?`,
                [empId, year]
            );
            return updated[0];
        } catch (error) {
            throw new Error('Error updating exercise balance: ' + error.message);
        }
    },
    async updateLeaveRequest(requestIdOrData, updateDataParam) {
        // Update possible fields in Leave_request
        try {
            let requestId;
            let updateData;

            if (typeof requestIdOrData === 'object' && requestIdOrData !== null) {
                const { requestId: reqId, id, ...rest } = requestIdOrData;
                requestId = reqId || id;
                updateData = updateDataParam || rest;
            } else {
                requestId = requestIdOrData;
                updateData = updateDataParam || {};
            }

            if (!requestId) {
                throw new Error('requestId is required for updating leave request');
            }

            const allowedFields = [
                'Emp_id', 'exercise', 'leave_type', 'start_date',
                'duration', 'reason_type', 'justification', 'url_justification', 'request_status'
            ];

            const fieldsToUpdate = [];
            const values = [];

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    fieldsToUpdate.push(`${field} = ?`);
                    values.push(updateData[field]);
                }
            }

            if (fieldsToUpdate.length === 0) {
                throw new Error('No valid fields provided for update');
            }

            values.push(requestId);
            const query = `UPDATE Leave_request SET ${fieldsToUpdate.join(', ')} WHERE request_id = ?`;
            const [result] = await pool.query(query, values);

            if (result.affectedRows === 0) {
                throw new Error(`Leave request not found: ${requestId}`);
            }

            const [updatedRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
            return updatedRows[0];
        } catch (error) {
            throw new Error('Error updating leave request: ' + error.message);
        }
    },
    async updateExercise({ exerciseId, balance }) {
        // Update exercise balance manually for an employee
        try {
            await pool.query(
                `UPDATE Exercise SET balance = ? WHERE exercise_id = ?`,
                [balance, exerciseId]
            );
            const [updated] = await pool.query(
                `SELECT * FROM Exercise WHERE exercise_id = ?`,
                [exerciseId]
            );
            return updated[0];
        } catch (error) {
            throw new Error('Error updating exercise balance: ' + error.message);
        }
    },
    async updateRequestStepTarget(stepId, newRole) {
        try {
            const [RequestStep] = await pool.query(`SELECT * FROM Request_step WHERE step_id = ?`, [stepId]);
            if (RequestStep.length === 0) {
                throw new Error(`Request step '${stepId}' not found`);
            }
            const [request] = await pool.query(`SELECT * FROM Leave_request WHERE request_id = ?`, [RequestStep[0].request_id]);
            if (request.length === 0) {
                throw new Error(`Request '${RequestStep[0].request_id}' not found`);
            }
            if (request[0].request_status === 'approved' || request[0].request_status === 'rejected' || request[0].request_status == 'time out') {
                throw new Error(`Request '${RequestStep[0].request_id}' is already approved or rejected`);
            }
            // extract all request with the same request_id, and check input step is las in order, if not throw an error
            const [requestSteps] = await pool.query(`SELECT * FROM Request_step WHERE request_id = ? ORDER BY step_order`, [RequestStep[0].request_id]);
            if (requestSteps.length === 0) {
                throw new Error(`Request '${RequestStep[0].request_id}' has no steps`);
            }
            const lastStep = requestSteps[requestSteps.length - 1];
            if (lastStep.step_id !== stepId) {
                throw new Error(`Request '${RequestStep[0].request_id}' step '${stepId}' is not the last step`);
            }
            if(newRole=='chef_service'){
                // extract id of same chef service as employe
                const [employee] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [request[0].Emp_id]);
                if (employee.length === 0) {
                    throw new Error(`Employee '${request[0].Emp_id}' not found`);
                }
                const [newTarget] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [employee[0].chef_service]);
                if (newTarget.length === 0) {
                    throw new Error(`Chef service '${employee[0].chef_service}' not found`);
                }
                await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [newTarget[0].Emp_id, stepId]);
            }else if (newRole=='chef_departement'){
                // extract id of same chef departement as employe
                const [employee] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [request[0].Emp_id]);
                if (employee.length === 0) {
                    throw new Error(`Employee '${request[0].Emp_id}' not found`);
                }
                const [newTarget] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [employee[0].chef_departement]);
                if (newTarget.length === 0) {
                    throw new Error(`Chef departement '${employee[0].chef_departement}' not found`);
                }
                await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [newTarget[0].Emp_id, stepId]);
            }else if (newRole=='drh'){
                // extract id of same drh as employe
                const [employee] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [request[0].Emp_id]);
                if (employee.length === 0) {
                    throw new Error(`Employee '${request[0].Emp_id}' not found`);
                }
                const [newTarget] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [employee[0].drh]);
                if (newTarget.length === 0) {
                    throw new Error(`DRH '${employee[0].drh}' not found`);
                }
                await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [newTarget[0].Emp_id, stepId]);
            }else if(newRole=='directeur'){
                // extract id of same directeur as employe
                const [employee] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [request[0].Emp_id]);
                if (employee.length === 0) {
                    throw new Error(`Employee '${request[0].Emp_id}' not found`);
                }
                const [newTarget] = await pool.query(`SELECT * FROM Employee WHERE Emp_id = ?`, [employee[0].directeur]);
                if (newTarget.length === 0) {
                    throw new Error(`Directeur '${employee[0].directeur}' not found`);
                }
                await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [newTarget[0].Emp_id, stepId]);
            }else if(newRole=='drh'){
                // extract all drh
                const [drh] = await pool.query(`SELECT * FROM Employee WHERE role = 'drh'`);
                if (drh.length === 0) {
                    throw new Error(`DRH '${newRole}' not found`);
                }
                await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [drh[0].Emp_id, stepId]);
            }
            return { success: true, message: 'Request step target updated successfully' };
        } catch (error) {
            throw new Error('Error updating request step target: ' + error.message);
        }        
    },
    async updateRequestStepDecision(stepId,decision){
        try {
            const [RequestStep] = await pool.query(`SELECT * FROM Request_step WHERE step_id = ?`, [stepId]);
            if (RequestStep.length === 0) {
                throw new Error(`Request step '${stepId}' not found`);
            }
            const [request] = await pool.query(`SELECT * FROM Leave_request WHERE request_id = ?`, [RequestStep[0].request_id]);
            if (request.length === 0) {
                throw new Error(`Request '${RequestStep[0].request_id}' not found`);
            }
            // ensure updated step is last in order
            const [requestSteps] = await pool.query(`SELECT * FROM Request_step WHERE request_id = ? ORDER BY step_order`, [RequestStep[0].request_id]);
            if (requestSteps.length === 0) {
                throw new Error(`Request '${RequestStep[0].request_id}' has no steps`);
            }
            const lastStep = requestSteps[requestSteps.length - 1];
            if (lastStep.step_id !== stepId) {
                throw new Error(`Request '${RequestStep[0].request_id}' step '${stepId}' is not the last step`);
            }
            if (request[0].request_status === 'approved' || request[0].request_status === 'rejected' || request[0].request_status == 'time out') {
                throw new Error(`Request '${RequestStep[0].request_id}' is already approved or rejected`);
            }
            await pool.query(`UPDATE Request_step SET decision = ? WHERE step_id = ?`, [decision, stepId]);
            return { success: true, message: 'Request step decision updated successfully' };
        } catch (error) {
            throw new Error('Error updating request step decision: ' + error.message);
        }        
    }
};

module.exports = adminServices;