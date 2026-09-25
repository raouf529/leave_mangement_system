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



// Finds who must treat a request for a given role, from the requester's org units
// (service -> departement -> direction). HR is scoped per direction.
async function findStepTarget(employeeId, role) {
    const [employee] = await pool.query(
        `SELECT service_id, departement_id, direction_id FROM Employe WHERE id = ?`,
        [employeeId]
    );
    if (employee.length === 0) {
        throw new Error(`Employee '${employeeId}' not found`);
    }

    let serviceId = employee[0].service_id;
    let departementId = employee[0].departement_id;
    let directionId = employee[0].direction_id;

    // an employee only has his own unit filled, so climb the tree to get the parent units
    if (!departementId && serviceId) {
        const [service] = await pool.query(`SELECT departement_id FROM Service WHERE id = ?`, [serviceId]);
        departementId = service.length > 0 ? service[0].departement_id : null;
    }
    if (!directionId && departementId) {
        const [departement] = await pool.query(`SELECT direction_id FROM Departement WHERE id = ?`, [departementId]);
        directionId = departement.length > 0 ? departement[0].direction_id : null;
    }

    // role -> [column that holds the unit of that role's head, unit id of the requester]
    const units = {
        chef_service: ['service_id', serviceId],
        chef_departement: ['departement_id', departementId],
        directeur: ['direction_id', directionId],
    };

    let heads = [];
    if (role === 'drh') {
        // DRH is global, not bound to the requester's direction
        [heads] = await pool.query(`SELECT id FROM Employe WHERE role_leave_validation = 'drh' LIMIT 1`);
    } else {
        if (!units[role]) {
            throw new Error(`Unknown role '${role}'`);
        }
        const [column, unitId] = units[role];
        if (!unitId) {
            throw new Error(`Employee '${employeeId}' has no unit for role '${role}'`);
        }
        [heads] = await pool.query(`SELECT id FROM Employe WHERE role = ? AND ${column} = ?`, [role, unitId]);
    }

    if (heads.length === 0) {
        throw new Error(`No '${role}' found for employee '${employeeId}'`);
    }
    return heads[0].id;
}


const adminServices = {
    async getApprovedLeaveTitles(options = {}) {
        let term = '';
        let page = null;
        let limit = null;

        if (typeof options === 'string') {
            term = options.trim();
        } else if (typeof options === 'object' && options !== null) {
            term = String(options.search ?? '').trim();
            page = options.page ? Math.max(1, parseInt(options.page, 10) || 1) : null;
            limit = options.limit ? Math.max(1, parseInt(options.limit, 10) || 10) : null;
        }

        const params = ['approved'];
        let searchClause = '';

        if (term) {
            searchClause = `AND (
                CAST(e.matricule AS CHAR) LIKE ?
                OR CONCAT(e.nom, ' ', e.prenom) LIKE ?
                OR CONCAT(e.prenom, ' ', e.nom) LIKE ?
            )`;
            const pattern = `%${term}%`;
            params.push(pattern, pattern, pattern);
        }

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM Leave_request lr
            JOIN Employe e ON e.id = lr.Emp_id
            WHERE lr.request_status = ? ${searchClause}
        `;
        const [countRows] = await pool.query(countQuery, params);
        const total = countRows[0].total;

        let limitSql = '';
        const queryParams = [...params];
        if (page !== null && limit !== null) {
            const offset = (page - 1) * limit;
            limitSql = `LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }

        const [requests] = await pool.query(
            `SELECT lr.request_id, lr.leave_type, lr.start_date, lr.duration,
                    lr.request_status, lr.created_at,
                    e.id AS employee_id, e.nom, e.prenom, e.matricule
             FROM Leave_request lr
             JOIN Employe e ON e.id = lr.Emp_id
             WHERE lr.request_status = ? ${searchClause}
             ORDER BY lr.start_date DESC, lr.request_id DESC
             ${limitSql}`,
            queryParams
        );

        if (page === null || limit === null) {
            return requests;
        }

        const totalPages = Math.ceil(total / limit) || 1;
        return {
            data: requests,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    },

    async getLeaveRequests(options = {}) {
        let employeeId = undefined;
        let page = null;
        let limit = null;
        let search = '';
        let status = '';
        let leaveType = '';
        let exerciseYear = null;
        let directionId = null;
        let departementId = null;
        let serviceId = null;
        let sortBy = 'created_at';
        let sortOrder = 'DESC';

        if (typeof options === 'number' || typeof options === 'string') {
            employeeId = Number(options);
        } else if (typeof options === 'object' && options !== null) {
            employeeId = options.employeeId !== undefined && options.employeeId !== null && options.employeeId !== '' ? Number(options.employeeId) : undefined;
            page = options.page ? Math.max(1, parseInt(options.page, 10) || 1) : null;
            limit = options.limit ? Math.max(1, parseInt(options.limit, 10) || 10) : null;
            search = String(options.search ?? '').trim();
            status = String(options.status ?? '').trim();
            leaveType = String(options.leaveType ?? '').trim();
            exerciseYear = options.exerciseYear ? Number(options.exerciseYear) : null;
            directionId = options.directionId ? Number(options.directionId) : null;
            departementId = options.departementId ? Number(options.departementId) : null;
            serviceId = options.serviceId ? Number(options.serviceId) : null;
            if (options.sortBy) sortBy = String(options.sortBy);
            if (options.sortOrder) sortOrder = String(options.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        }

        const whereClauses = [];
        const params = [];

        if (employeeId !== undefined && !isNaN(employeeId)) {
            whereClauses.push('lr.Emp_id = ?');
            params.push(employeeId);
        }
        if (status) {
            whereClauses.push('lr.request_status = ?');
            params.push(status);
        }
        if (leaveType) {
            whereClauses.push('lr.leave_type = ?');
            params.push(leaveType);
        }
        if (exerciseYear) {
            whereClauses.push('lr.exercise = ?');
            params.push(exerciseYear);
        }
        if (search) {
            whereClauses.push(`(
                CAST(e.matricule AS CHAR) LIKE ?
                OR e.nom LIKE ?
                OR e.prenom LIKE ?
                OR CONCAT(e.nom, ' ', e.prenom) LIKE ?
                OR CONCAT(e.prenom, ' ', e.nom) LIKE ?
            )`);
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern, pattern);
        }
        if (serviceId) {
            whereClauses.push('e.service_id = ?');
            params.push(serviceId);
        } else if (departementId) {
            whereClauses.push('COALESCE(e.departement_id, s.departement_id) = ?');
            params.push(departementId);
        } else if (directionId) {
            whereClauses.push('COALESCE(e.direction_id, dep.direction_id, s.direction_id) = ?');
            params.push(directionId);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const allowedSortFields = {
            created_at: 'lr.created_at',
            start_date: 'lr.start_date',
            duration: 'lr.duration',
            request_id: 'lr.request_id',
            status: 'lr.request_status'
        };
        const sortByField = allowedSortFields[sortBy] || 'lr.created_at';

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM Leave_request lr
            JOIN Employe e ON e.id = lr.Emp_id
            LEFT JOIN Service s ON s.id = e.service_id
            LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
            LEFT JOIN Direction d ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
            ${whereSql}
        `;
        const [countRows] = await pool.query(countQuery, params);
        const total = countRows[0].total;

        let limitSql = '';
        const queryParams = [...params];
        if (page !== null && limit !== null) {
            const offset = (page - 1) * limit;
            limitSql = `LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }

        const [requests] = await pool.query(
            `SELECT lr.*, e.nom, e.prenom, e.email, e.matricule,
                    creator.nom AS creator_last_name,
                    creator.prenom AS creator_first_name,
                    creator.role_leave_validation AS creator_role
             FROM Leave_request lr
             JOIN Employe e ON e.id = lr.Emp_id
             LEFT JOIN Service s ON s.id = e.service_id
             LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
             LEFT JOIN Direction d ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
             LEFT JOIN Employe creator ON creator.id = lr.created_by
             ${whereSql}
             ORDER BY ${sortByField} ${sortOrder}, lr.request_id DESC
             ${limitSql}`,
            queryParams
        );

        if (requests.length === 0) {
            if (page === null || limit === null) return [];
            return {
                data: [],
                pagination: { total: 0, page, limit, totalPages: 1, hasNextPage: false, hasPrevPage: false }
            };
        }

        const requestIds = requests.map((request) => request.request_id);
        const [steps] = await pool.query(
            `SELECT rs.step_id, rs.request_id, rs.step_order, rs.target_id,
                    rs.decision, rs.comment, rs.decided_at,
                    e.nom AS target_last_name, e.prenom AS target_first_name,
                    e.role_leave_validation AS target_role
             FROM Request_step rs
             JOIN Employe e ON e.id = rs.target_id
             WHERE rs.request_id IN (?)
             ORDER BY rs.request_id, rs.step_order`,
            [requestIds]
        );

        const stepsByRequest = steps.reduce((result, step) => {
            if (!result[step.request_id]) result[step.request_id] = [];
            result[step.request_id].push(step);
            return result;
        }, {});

        const formattedRequests = requests.map((request) => ({
            ...request,
            steps: stepsByRequest[request.request_id] ?? []
        }));

        if (page === null || limit === null) {
            return formattedRequests;
        }

        const totalPages = Math.ceil(total / limit) || 1;
        return {
            data: formattedRequests,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    },
    async createExercise() {
        try {
            const now = new Date();
            const year = getExerciseYearForDate(now);

            const [employees] = await pool.query(`SELECT id, date_entree FROM Employe WHERE role_leave_validation != 'admin'`);

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

                const [currentExerciseRows] = await pool.query(
                    `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                    [employee.id, year]
                );
                const currentExerciseId = currentExerciseRows[0]?.exercise_id;

                if (currentExerciseId) {
                    const [advanceRows] = await pool.query(
                        `SELECT COALESCE(SUM(rea.days_allocated), 0) AS approved_advance_days
                         FROM Leave_request lr
                         JOIN Request_exercise_allocation rea ON rea.request_id = lr.request_id
                         JOIN Exercise allocated_exercise ON allocated_exercise.exercise_id = rea.exercise_id
                         WHERE lr.Emp_id = ?
                           AND lr.exercise = ?
                           AND lr.leave_type = 'advance'
                           AND lr.request_status = 'approved'
                           AND allocated_exercise.exercise_id = ?`,
                        [employee.id, year, currentExerciseId]
                    );
                    const approvedAdvanceDays = Number(advanceRows[0]?.approved_advance_days) || 0;

                    if (approvedAdvanceDays > 0) {
                        await pool.query(
                            `UPDATE Exercise SET balance = balance - ? WHERE exercise_id = ?`,
                            [approvedAdvanceDays, currentExerciseId]
                        );
                    }
                }
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
                throw new Error(`Employé introuvable : ${empId}`);
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
                throw new Error(`Demande de congé introuvable : ${requestId}`);
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
            if (request[0].request_status !== 'pending') {
                throw new Error(`Request '${RequestStep[0].request_id}' is not pending`);
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
            if (lastStep.decision) {
                throw new Error(`Request step '${stepId}' already has a decision`);
            }
            const targetId = await findStepTarget(request[0].Emp_id, newRole);
            await pool.query(`UPDATE Request_step SET target_id = ? WHERE step_id = ?`, [targetId, stepId]);
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
            if (request[0].request_status !== 'pending') {
                throw new Error(`Request '${RequestStep[0].request_id}' is not pending`);
            }
            await pool.query(`UPDATE Request_step SET decision = ?, decided_at = NOW() WHERE step_id = ?`, [decision, stepId]);
            return { success: true, message: 'Request step decision updated successfully' };
        } catch (error) {
            throw new Error('Error updating request step decision: ' + error.message);
        }
    },
    async assignCreateForOthers(EmpId, permission){
        // this function use to give/revoke permission of create for other employee for chefs
        try {
            const [employee] = await pool.query(`SELECT * FROM Employe WHERE id = ?`, [EmpId]);
            if(employee[0].role==='employe' || employee[0].role==='admin' || employee[0].role==='drh'){
                throw new Error(`Employee '${EmpId}' is not authorized to create requests for others`);
            }
            await pool.query(`UPDATE Employe SET can_create_for_employee = ? WHERE id = ?`,
                [permission, EmpId]
            )
            return { success: true, message: 'Employee create other request permission updated successfully' };
        } catch (error) {
            throw new Error('Error assigning create other request permission: ' + error.message);
        }
    },
    async assignDRH(empId) {
        try {
            const [emp] = await pool.query('SELECT role_leave_validation FROM Employe WHERE id = ?', [empId]);
            if (emp.length === 0) {
                throw new Error('Employee not found');
            }
            if (emp[0].role === 'admin') {
                throw new Error('Admin cannot be assigned as DRH');
            }
            await pool.query("UPDATE Employe SET role_leave_validation = 'employe' WHERE role_leave_validation = 'drh'");
            await pool.query("UPDATE Employe SET role_leave_validation = 'drh' WHERE id = ?", [empId]);
            return { success: true, message: 'DRH assigned successfully' };
        } catch (error) {
            throw new Error('Error assigning DRH: ' + error.message);
        }
    },
    async createMonthBalance(){
    const results = { updated: [], skipped: [] };
    try {
        const [employees] = await pool.query(`SELECT * FROM Employe WHERE role_leave_validation != 'admin'`);
        const year = getExerciseYearForDate(new Date());
        const current_date = new Date();

        for (const employee of employees) {
            try {
                const recrutement_date = new Date(employee.date_entree);

                const [exercise] = await pool.query(
                    `SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?`,
                    [employee.id, year]
                );
                if (exercise.length === 0) {
                    results.skipped.push({ empId: employee.id, reason: 'no exercise found' });
                    continue;
                }

                const isHiredThisMonth =
                    recrutement_date.getMonth() === current_date.getMonth() &&
                    recrutement_date.getFullYear() === current_date.getFullYear();

                let increment;
                if (isHiredThisMonth) {
                    const attendanceDays =
                        getMonthEnd(current_date.getFullYear(), current_date.getMonth()) -
                        recrutement_date.getDate() + 1;
                    increment = assignBalance(attendanceDays);
                } else {
                    increment = 2.5;
                }

                await pool.query(
                    `UPDATE Exercise SET balance = balance + ? WHERE exercise_id = ?`,
                    [increment, exercise[0].exercise_id]
                );
                results.updated.push({ empId: employee.id, increment });
            } catch (innerError) {
                results.skipped.push({ empId: employee.id, reason: innerError.message });
            }
        }

        return { success: true, message: 'Month balance created successfully', ...results };
    } catch (error) {
        throw new Error('Error creating month balance: ' + error.message);
    }
},
async getLogs(){
    try {
        const [logs] = await pool.query(`SELECT * FROM Logs ORDER BY created_at DESC`);
        return logs;
    } catch (error) {
        throw new Error('Error getting logs: ' + error.message);
    }
}
};

module.exports = adminServices;