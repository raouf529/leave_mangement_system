const pool = require('../db');

function getExerciseYearForDate(dateValue) {
    const date = new Date(dateValue ?? Date.now());
    const year = date.getFullYear();
    return date.getMonth() >= 6 ? year : year - 1;
}

function calculateLeaveDuration(startDate, endDate) {
    if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Leave dates must be valid');
    }

    if (start > end) {
        throw new Error('Start date must be before or equal to the end date');
    }

    const duration = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (duration <= 0) {
        throw new Error('Leave duration must be at least one day');
    }

    return duration;
}

function computeAnnualExerciseSplit(duration, exercises, currentExerciseYear) {
    const requestedDuration = Number(duration) || 0;
    if (requestedDuration <= 0) {
        return [];
    }

    const availableExercises = (Array.isArray(exercises) ? exercises : [])
        .filter((exercise) => Number(exercise.balance) > 0 && Number(exercise.year) !== Number(currentExerciseYear))
        .sort((a, b) => Number(a.year) - Number(b.year));

    let remainingDuration = requestedDuration;
    const allocations = [];

    for (const exercise of availableExercises) {
        if (remainingDuration <= 0) {
            break;
        }

        const durationToUse = Math.min(remainingDuration, Number(exercise.balance || 0));
        if (durationToUse <= 0) {
            continue;
        }

        allocations.push({
            exercise_id: exercise.exercise_id,
            year: Number(exercise.year),
            days_allocated: durationToUse
        });
        remainingDuration -= durationToUse;
    }

    if (remainingDuration > 0) {
        throw new Error(`Not enough budget in exercises to cover the requested duration. Remaining duration: ${remainingDuration}`);
    }

    return allocations;
}

function computeAdvanceExerciseSplit(duration, exercises, currentExerciseYear) {
    const requestedDuration = Number(duration) || 0;
    if (requestedDuration <= 0) {
        return [];
    }
    // in advanced leave, employee borrow days from currenct exercise, so we only need to check the current exercise
    const currentExercise = (Array.isArray(exercises) ? exercises : [])
        .find((exercise) => Number(exercise.year) === Number(currentExerciseYear));

    if (!currentExercise || Number(currentExercise.balance) <= 0) {
        throw new Error(`No available balance in the current exercise year ${currentExerciseYear}`);
    }
    return [{
        exercise_id: currentExercise.exercise_id,
        year: Number(currentExercise.year),
        days_allocated: Math.min(requestedDuration, Number(currentExercise.balance))
    }];
}

async function applyApprovedAnnualAllocations(requestId, conn = pool) {
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error(`Request '${requestId}' not found`);
    }
    if (requestRows[0].leave_type !== 'annual') {
        return [];
    }

    const [allocations] = await conn.query(
        'SELECT exercise_id, SUM(days_allocated) AS total_days FROM Request_exercise_allocation WHERE request_id = ? GROUP BY exercise_id',
        [requestId]
    );

    for (const allocation of allocations) {
        const totalDays = Number(allocation.total_days) || 0;
        if (totalDays <= 0) continue;

        await conn.query(
            'UPDATE Exercise SET balance = balance - ? WHERE exercise_id = ?',
            [totalDays, allocation.exercise_id]
        );
    }

    return allocations;
}

async function applyApprovedAdvanceAllocations(requestId, conn = pool) {
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error(`Request '${requestId}' not found`);
    }
    if (requestRows[0].leave_type !== 'advance') {
        return [];
    }
    const [allocations] = await conn.query(
        'SELECT exercise_id, SUM(days_allocated) AS total_days FROM Request_exercise_allocation WHERE request_id = ? GROUP BY exercise_id',
        [requestId]
    );
    return allocations;
}

async function createAnnualExerciseRequest(requestId, conn = pool) {
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error(`Request '${requestId}' not found`);
    }

    const today = new Date();
    const currentExercise = getExerciseYearForDate(today);

    const [exerciseRows] = await conn.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year != ? AND balance > 0', [requestRows[0].Emp_id, currentExercise]);
    if (exerciseRows.length === 0) {
        throw new Error(`Exercise for employee '${requestRows[0].Emp_id}' not found`);
    }

    const allocations = computeAnnualExerciseSplit(requestRows[0].duration, exerciseRows, currentExercise);

    for (const allocation of allocations) {
        await conn.query(
            'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated) VALUES (?, ?, ?)',
            [requestId, allocation.exercise_id, allocation.days_allocated]
        );
    }

    return {
        requestId,
        message: 'Annual exercise request created successfully',
        allocations
    };
}

async function getDepartement(unitId, conn = pool) {
    const [rows] = await conn.query(
        'SELECT id AS unit_id, nom AS name, direction_id FROM Departement WHERE id = ?',
        [unitId]
    );
    if (rows.length === 0) {
        throw new Error(`Department '${unitId}' not found`);
    }
    return { ...rows[0], type: 'department' };
}

async function getEmployeeUnit(employeeId, conn = pool) {
    const [rows] = await conn.query(
        `SELECT e.id, e.role, e.direction_id, e.departement_id, e.service_id,
            COALESCE(e.direction_id, dep.direction_id, s.direction_id) AS resolved_direction_id,
            COALESCE(e.departement_id, s.departement_id) AS resolved_departement_id,
            d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
         FROM Employe e
         LEFT JOIN Service s ON s.id = e.service_id
         LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
         LEFT JOIN Direction d ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
         WHERE e.id = ?`,
        [employeeId]
    );
    if (rows.length === 0) {
        throw new Error(`Employee '${employeeId}' not found`);
    }

    const employee = rows[0];
    if (employee.service_id !== null) {
        return {
            ...employee,
            departement_id: employee.resolved_departement_id,
            direction_id: employee.resolved_direction_id,
            unit_id: employee.service_id,
            name: employee.service_name,
            type: 'service'
        };
    }
    if (employee.departement_id !== null) {
        return {
            ...employee,
            direction_id: employee.resolved_direction_id,
            unit_id: employee.departement_id,
            name: employee.departement_name,
            type: 'department'
        };
    }
    if (employee.resolved_direction_id !== null) {
        return { ...employee, direction_id: employee.resolved_direction_id, unit_id: employee.resolved_direction_id, name: employee.direction_name, type: 'direction' };
    }
    throw new Error(`Unit for employee '${employeeId}' not found`);
}

async function getParentUnit(unitId, conn = pool) {
    const unit = typeof unitId === 'object' ? unitId : await getEmployeeUnit(unitId, conn);
    if (unit.type === 'direction') {
        return null; // This unit has no parent
    }

    if (unit.type === 'service' && unit.departement_id !== null) {
        return getDepartement(unit.departement_id, conn);
    }

    const [rows] = await conn.query(
        'SELECT id AS unit_id, nom AS name FROM Direction WHERE id = ?',
        [unit.direction_id]
    );
    if (rows.length === 0) {
        throw new Error(`Direction '${unit.direction_id}' not found`);
    }
    return { ...rows[0], type: 'direction' };
}

async function getHeadingUnit(unitId, conn = pool) {
    const unit = typeof unitId === 'object' ? unitId : await getEmployeeUnit(unitId, conn);
    let query;
    let params;
    if (unit.type === 'service') {
        query = 'SELECT * FROM Employe WHERE service_id = ? AND role = ?';
        params = [unit.unit_id, 'chef_service'];
    } else if (unit.type === 'department') {
        query = 'SELECT * FROM Employe WHERE departement_id = ? AND role = ?';
        params = [unit.unit_id, 'chef_departement'];
    } else {
        query = 'SELECT * FROM Employe WHERE direction_id = ? AND role = ?';
        params = [unit.unit_id, 'directeur'];
    }
    const [rows] = await conn.query(query, params);
    return rows[0];
}

function resolveDepartmentHeadTarget(employee, employeeUnit, headByUnit, directToDepartmentHead = false) {
    if (!directToDepartmentHead || !employee || !employeeUnit || !headByUnit) {
        return null;
    }

    if (employeeUnit.type === 'department' || employeeUnit.type === 'direction') {
        return headByUnit[employeeUnit.unit_id] ?? null;
    }

    if (employeeUnit.parent_unit_id) {
        return headByUnit[employeeUnit.parent_unit_id] ?? null;
    }

    return null;
}

async function getNextStepOrder(requestId) {
    const [rows] = await pool.query(
        'SELECT COALESCE(MAX(step_order), 0) + 1 AS nextOrder FROM Request_step WHERE request_id = ?',
        [requestId]
    );
    return rows[0].nextOrder;
}

async function forwardRequestToNextStep(requestId, currentlocation_id, decision, comment, conn = pool, directToDepartmentHead = false) {
    // currentlocation_id is the id of the employee who is currently handling the request
    const [row] = await conn.query('SELECT * FROM Employe WHERE id = ?', [currentlocation_id]);
    if (!row[0]) {
        throw new Error(`Employee '${currentlocation_id}' not found`);
    }

    const unitRow = await getEmployeeUnit(currentlocation_id, conn);
    const nextStepOrder = await getNextStepOrder(requestId);

    let targetUnit;

    if (row[0].role === 'employe') {
        if (directToDepartmentHead) {
            const departmentUnit = unitRow.type === 'department'
                ? unitRow
                : unitRow.departement_id !== null
                    ? await getDepartement(unitRow.departement_id, conn)
                    : null;
            if (!departmentUnit) {
                throw new Error(`No department found for employee '${currentlocation_id}'`);
            }
            targetUnit = await getHeadingUnit(departmentUnit, conn);
            if (!targetUnit) {
                throw new Error(`No department head found for unit '${departmentUnit.unit_id}'`);
            }
            await conn.query(
                'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
                [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
            );
            return targetUnit;
        }

        // Forward to the employee's head
        targetUnit = await getHeadingUnit(unitRow, conn);
        if (!targetUnit) {
            throw new Error(`No head found for unit '${unitRow.unit_id}'`);
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    else if (['directeur', 'chef_departement', 'chef_service'].includes(row[0].role) && row[0].role !== 'directeur') {
        // Forward to the head of the parent unit
        const parentUnit = await getParentUnit(unitRow, conn);
        if (!parentUnit) {
            throw new Error(`No parent unit found for unit '${unitRow.unit_id}'`);
        }
        targetUnit = await getHeadingUnit(parentUnit, conn);
        if (!targetUnit) {
            throw new Error(`No head found for parent unit '${parentUnit.unit_id}'`);
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    else if (row[0].role === 'directeur') {
        // Forward to HR
        const [hrRows] = await conn.query('SELECT * FROM Employe WHERE role = ? AND direction_id = ?', ['drh', unitRow.unit_id]);
        if (hrRows.length === 0) {
            throw new Error(`No HR employee found for unit '${unitRow[0].unit_id}'`);
        }
        targetUnit = hrRows[0];
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    return targetUnit;
}

async function assertRequestAccess(requestId, currentUserId, currentUserRole) {
    if (!requestId || !currentUserId) {
        throw new Error('User authentication is required to access leave requests');
    }

    const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error(`Request '${requestId}' not found`);
    }

    const isOwner = Number(requestRows[0].Emp_id) === Number(currentUserId);
    const isManager = ['head', 'hr'].includes(currentUserRole);

    if (!isOwner && !isManager) {
        throw new Error('You are not authorized to access this leave request');
    }

    return requestRows[0];
}

async function assertStepAccess(stepId, currentUserId, currentUserRole) {
    if (!stepId || !currentUserId) {
        throw new Error('User authentication is required to act on a request step');
    }

    const [stepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
    if (stepRows.length === 0) {
        throw new Error(`Request step '${stepId}' not found`);
    }

    const isAssignedTarget = Number(stepRows[0].target_id) === Number(currentUserId);
    const isManager = ['head', 'hr'].includes(currentUserRole);

    if (!isAssignedTarget && !isManager) {
        throw new Error('You are not authorized to act on this request step');
    }

    return stepRows[0];
}

const requestService = {
    async createRequest({ employeeId, startDate, endDate, duration, leaveType, reasonType, justification, url, exercise, directToDepartmentHead = false, sendToDepartmentHead = false }) {
        const effectiveDuration = calculateLeaveDuration(startDate, endDate);
        const normalizedJustification = typeof justification === 'string' ? justification.trim() : '';
        const normalizedReasonType = typeof reasonType === 'string' ? reasonType.trim() : '';

        if (leaveType === 'exceptional') {
            if (!normalizedReasonType) {
                throw new Error('A reason is required for exceptional leave');
            }
            if (!normalizedJustification) {
                throw new Error('A justification is required for exceptional leave');
            }
        }

        if (duration !== undefined && duration !== null && Number(duration) !== effectiveDuration) {
            throw new Error('Leave duration does not match the selected date range');
        }

        const exerciseYear = exercise ?? getExerciseYearForDate(startDate);
        const connection = await pool.getConnection();

        try {
            const [employeeRows] = await connection.query('SELECT * FROM Employe WHERE id = ?', [employeeId]);
            if (employeeRows.length === 0) {
                throw new Error(`Employee '${employeeId}' not found`);
            }

            const [pendingRequests] = await connection.query(
                'SELECT * FROM Leave_request WHERE Emp_id = ? AND request_status = ?',
                [employeeId, 'pending']
            );
            if (pendingRequests.length > 0) {
                throw new Error(`Employee '${employeeId}' already has a pending request`);
            }

            await connection.beginTransaction();
            const [result] = await connection.query(
                'INSERT INTO Leave_request (Emp_id, exercise, leave_type, start_date, duration, reason_type, justification, url_justification, request_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [employeeId, Number(exerciseYear), leaveType, startDate, effectiveDuration, normalizedReasonType || null, normalizedJustification || null, url ?? null, 'pending']
            );

            if (leaveType === 'annual') {
                await createAnnualExerciseRequest(result.insertId, connection);
            } else if (leaveType === 'advance') {
                // if still have balance in previous exercise, throw error, because employee should use the balance first before requesting advance
                const [priorExerciseRows] = await connection.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year != ? AND balance > 0', [employeeId, exerciseYear]);
                if (priorExerciseRows.length > 0) {
                    throw new Error(`Employee '${employeeId}' still has balance in previous exercise year(s). Please use the available balance before requesting advance leave.`);
                }
                const [currentExerciseRows] = await connection.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?', [employeeId, exerciseYear]);
                const advanceAllocations = computeAdvanceExerciseSplit(effectiveDuration, currentExerciseRows, exerciseYear);
                for (const allocation of advanceAllocations) {
                    await connection.query(
                        'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated) VALUES (?, ?, ?)',
                        [result.insertId, allocation.exercise_id, allocation.days_allocated]
                    );
                }
            }


            const shouldSendToDepartmentHead = Boolean(directToDepartmentHead || sendToDepartmentHead);
            await forwardRequestToNextStep(result.insertId, employeeId, null, null, connection, shouldSendToDepartmentHead);
            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    async getRequestSteps(targetId, currentUserId, currentUserRole) {
        if (!currentUserId) {
            throw new Error('User authentication is required to access request steps');
        }

        const isOwnTarget = Number(targetId) === Number(currentUserId);
        const isManager = ['head', 'hr'].includes(currentUserRole);

        if (!isOwnTarget && !isManager) {
            throw new Error('You are not authorized to view these request steps');
        }

        const [steps] = await pool.query('SELECT * FROM Request_step WHERE target_id = ?', [targetId]);
        return steps;
    },
    async getPendingStepsForUser(userId) {
        const [steps] = await pool.query(
                        `SELECT rs.*, lr.start_date, lr.duration, lr.leave_type, lr.justification, lr.url_justification,
                            lr.reason_type, lr.request_status,
            e.nom, e.prenom, e.email
       FROM Request_step rs
       JOIN Leave_request lr ON lr.request_id = rs.request_id
        JOIN Employe e ON e.id = lr.Emp_id
       WHERE rs.target_id = ? AND (rs.decision IS NULL OR rs.decision = '') AND lr.request_status = 'pending'`,
            [userId]
        );

        if (steps.length === 0) {
            return [];
        }

        const requestIds = [...new Set(steps.map((step) => step.request_id))];
        const [allocations] = await pool.query(
            `SELECT ra.request_id, ra.exercise_id, ra.days_allocated, e.year AS exercise_year
       FROM Request_exercise_allocation ra
       JOIN Exercise e ON e.exercise_id = ra.exercise_id
       WHERE ra.request_id IN (?)
       ORDER BY e.year ASC`,
            [requestIds]
        );

        const splitByRequest = allocations.reduce((acc, allocation) => {
            if (!acc[allocation.request_id]) {
                acc[allocation.request_id] = [];
            }
            acc[allocation.request_id].push({
                exerciseId: allocation.exercise_id,
                year: Number(allocation.exercise_year),
                daysAllocated: Number(allocation.days_allocated)
            });
            return acc;
        }, {});

        return steps.map((step) => ({
            ...step,
            annualSplit: splitByRequest[step.request_id] ?? []
        }));
    },
    async updateRequestStep(stepId, decision, comment, currentUserId, currentUserRole) {
        if (decision !== 'approved' && decision !== 'rejected') {
            throw new Error(`Invalid decision '${decision}'. Must be 'approved' or 'rejected'.`);
        }

        const step = await assertStepAccess(stepId, currentUserId, currentUserRole);
        const [targetRows] = await pool.query('SELECT * FROM Employe WHERE id = ?', [step.target_id]);

        if (decision === 'approved') {
            if (targetRows[0].role === 'drh') {
                const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [step.request_id]);
                if (requestRows.length === 0) {
                    throw new Error(`Request '${step.request_id}' not found`);
                }

                if (requestRows[0].request_status === 'approved') {
                    return { requestId: step.request_id, message: 'Request already approved' };
                }

                await pool.query(
                    'UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?',
                    [decision, comment, stepId]
                );
                await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['approved', step.request_id]);

                if (requestRows[0].leave_type === 'annual') {
                    await applyApprovedAnnualAllocations(step.request_id);
                } else if (requestRows[0].leave_type === 'advance') {
                    await applyApprovedAdvanceAllocations(step.request_id);
                }

                return { requestId: step.request_id, message: 'Request approved and marked as completed' };
            }

            await pool.query('UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?', [decision, comment, stepId]);
            const [updatedStepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
            if (updatedStepRows.length === 0) {
                throw new Error(`Request step '${stepId}' not found`);
            }

            const requestId = updatedStepRows[0].request_id;
            const targetUnit = await forwardRequestToNextStep(requestId, updatedStepRows[0].target_id, null, null);
            return { requestId, targetUnit };
        }

        await pool.query('UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?', [decision, comment, stepId]);
        const [rejectedStepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
        if (rejectedStepRows.length === 0) {
            throw new Error(`Request step '${stepId}' not found`);
        }

        const requestId = rejectedStepRows[0].request_id;
        await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['rejected', requestId]);
        return { requestId };
    },
    async cancelRequest(requestId, currentUserId, currentUserRole) {
        const request = await assertRequestAccess(requestId, currentUserId, currentUserRole);
        const isOwner = Number(request.Emp_id) === Number(currentUserId);
        if (!isOwner) {
            throw new Error('You are not authorized to cancel this leave request');
        }

        await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['cancelled', requestId]);
        return { requestId, message: 'Request cancelled successfully' };
    },
    async getRequestDetails(requestId, currentUserId, currentUserRole) {
        await assertRequestAccess(requestId, currentUserId, currentUserRole);
        const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
        return requestRows[0];
    }
};
module.exports = requestService;
module.exports.calculateLeaveDuration = calculateLeaveDuration;
module.exports.computeAnnualExerciseSplit = computeAnnualExerciseSplit;
module.exports.resolveDepartmentHeadTarget = resolveDepartmentHeadTarget;