const pool = require('../db');
const { getExerciseYearForDate, calculateLeaveDuration } = require('../utils/helpers');

const CREATOR_ROLES = ['chef_service', 'chef_departement', 'directeur'];


function computeAnnualExerciseSplit(duration, exercises, currentExerciseYear) {
    // split leave request on exercises starting from the oldest
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
            days_allocated: durationToUse,
            remaining_after: Number(exercise.balance || 0) - durationToUse
        });
        remainingDuration -= durationToUse;
    }

    if (remainingDuration > 0) {
        throw new Error(`Vous n'avez pas assez de solde dans les exercices pour couvrir la durée demandée. Il reste ${remainingDuration} jour(s) à couvrir.`);
    }

    return allocations;
}

function computeAdvanceExerciseSplit(duration, exercises, currentExerciseYear) {
    // in advanced leave, employee borrow days from currenct exercise, so we only need to check the current exercise
    const requestedDuration = Number(duration) || 0;
    if (requestedDuration <= 0) {
        return [];
    }
    const currentExercise = (Array.isArray(exercises) ? exercises : [])
        .find((exercise) => Number(exercise.year) === Number(currentExerciseYear));

    if (!currentExercise || Number(currentExercise.balance) <= 0) {
        throw new Error(`Aucun solde disponible pour l’exercice en cours (${currentExerciseYear}).`);
    }
    return [{
        exercise_id: currentExercise.exercise_id,
        year: Number(currentExercise.year),
        days_allocated: requestedDuration,
        remaining_after: Number(currentExercise.balance || 0) - requestedDuration
    }];
}

async function applyApprovedAnnualAllocations(requestId, conn = pool) {
    // apply the split of annual leave request
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error('Demande introuvable.');
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
    // apply the advance leave request
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error('Demande introuvable.');
    }
    if (requestRows[0].leave_type !== 'advance') {
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

async function refundApprovedAllocations(requestId, daysToRefund, conn = pool) {
    if (daysToRefund <= 0) {
        return;
    }

    // Refund starting from the most recently-used exercise first: for a multi-exercise
    // annual split (oldest exercise filled first), the last exercise filled covers the
    // later portion of the leave, which lines up with the not-yet-taken days being refunded.
    const [allocations] = await conn.query(
        `SELECT ra.exercise_id, SUM(ra.days_allocated) AS total_days
         FROM Request_exercise_allocation ra
         JOIN Exercise e ON e.exercise_id = ra.exercise_id
         WHERE ra.request_id = ?
         GROUP BY ra.exercise_id
         ORDER BY e.year DESC`,
        [requestId]
    );

    let remaining = daysToRefund;
    for (const allocation of allocations) {
        if (remaining <= 0) break;

        const allocated = Number(allocation.total_days) || 0;
        if (allocated <= 0) continue;

        const refundFromThis = Math.min(remaining, allocated);

        await conn.query(
            'UPDATE Exercise SET balance = balance + ? WHERE exercise_id = ?',
            [refundFromThis, allocation.exercise_id]
        );
        await conn.query(
            'UPDATE Request_exercise_allocation SET days_allocated = days_allocated - ? WHERE request_id = ? AND exercise_id = ?',
            [refundFromThis, requestId, allocation.exercise_id]
        );

        remaining -= refundFromThis;
    }
}

async function createAnnualExerciseRequest(requestId, conn = pool) {
    // helper function to create annual exercise request
    const [requestRows] = await conn.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error('Demande introuvable.');
    }

    const today = new Date();
    const currentExercise = getExerciseYearForDate(today);

    const [exerciseRows] = await conn.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year != ? AND balance > 0', [requestRows[0].Emp_id, currentExercise]);
    if (exerciseRows.length === 0) {
        throw new Error(`Vous n'avez pas assez de solde de congé pour couvrir la durée demandée.`);
    }

    const allocations = computeAnnualExerciseSplit(requestRows[0].duration, exerciseRows, currentExercise);

    for (const allocation of allocations) {
        await conn.query(
            'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated, remaining_after) VALUES (?, ?, ?, ?)',
            [requestId, allocation.exercise_id, allocation.days_allocated, allocation.remaining_after]
        );
    }

    return {
        requestId,
        message: 'Demande de congé annuel créée avec succès',
        allocations
    };
}

async function getDepartement(unitId, conn = pool) {
    // helper function to get departement info
    const [rows] = await conn.query(
        'SELECT id AS unit_id, nom AS name, direction_id FROM Departement WHERE id = ?',
        [unitId]
    );
    if (rows.length === 0) {
        throw new Error('Département introuvable.');
    }
    return { ...rows[0], type: 'department' };
}

async function getEmployeeUnit(employeeId, conn = pool) {
    // helper function to get employee's unit info
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
        throw new Error('Employé introuvable.');
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
    throw new Error(`Aucune unité trouvée pour cet employé.`);
}

async function getParentUnit(unitId, conn = pool) {
    // helper function to get parent unit of an employee
    const unit = typeof unitId === 'object' ? unitId : await getEmployeeUnit(unitId, conn);
    if (unit.type === 'direction') {
        return null; 
    }

    if (unit.type === 'service' && unit.departement_id !== null) {
        return getDepartement(unit.departement_id, conn);
    }

    const [rows] = await conn.query(
        'SELECT id AS unit_id, nom AS name FROM Direction WHERE id = ?',
        [unit.direction_id]
    );
    if (rows.length === 0) {
        throw new Error(`La direction de « ${unit.name} » est introuvable.`);
    }
    return { ...rows[0], type: 'direction' };
}

async function getHeadingUnit(unitId, conn = pool) {
    // helper function to get heading of a unit
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

async function isSuperiorOf(superiorId, subordinateId, conn = pool) {
    if (Number(superiorId) === Number(subordinateId)) {
        return false;
    }

    const [rows] = await conn.query(
        `SELECT superior.id AS superior_id, superior.role AS superior_role,
                subordinate.id AS subordinate_id, subordinate.role AS subordinate_role,
                superior.departement_id AS superior_departement_id,
                COALESCE(superior.direction_id, superior_dep.direction_id, superior_service.direction_id) AS superior_direction_id,
                subordinate.service_id AS subordinate_service_id,
                COALESCE(subordinate.departement_id, subordinate_service.departement_id) AS subordinate_departement_id,
                COALESCE(subordinate.direction_id, subordinate_dep.direction_id, subordinate_service.direction_id) AS subordinate_direction_id
         FROM Employe superior
         LEFT JOIN Service superior_service ON superior_service.id = superior.service_id
         LEFT JOIN Departement superior_dep ON superior_dep.id = COALESCE(superior.departement_id, superior_service.departement_id)
         LEFT JOIN Employe subordinate ON subordinate.id = ?
         LEFT JOIN Service subordinate_service ON subordinate_service.id = subordinate.service_id
         LEFT JOIN Departement subordinate_dep ON subordinate_dep.id = COALESCE(subordinate.departement_id, subordinate_service.departement_id)
         WHERE superior.id = ?`,
        [subordinateId, superiorId]
    );
    if (rows.length === 0) {
        return false;
    }

    const relationship = rows[0];
    if (relationship.superior_role === 'chef_departement') {
        return relationship.subordinate_role === 'chef_service'
            && Number(relationship.superior_departement_id) === Number(relationship.subordinate_departement_id);
    }

    if (relationship.superior_role === 'directeur') {
        return ['chef_service', 'chef_departement'].includes(relationship.subordinate_role)
            && Number(relationship.superior_direction_id) === Number(relationship.subordinate_direction_id);
    }

    return false;
}

async function getNextStepOrder(requestId, conn = pool) {
    const [rows] = await conn.query(
        'SELECT COALESCE(MAX(step_order), 0) + 1 AS nextOrder FROM Request_step WHERE request_id = ?',
        [requestId]
    );
    return rows[0].nextOrder;
}

async function forwardRequestToNextStep(requestId, currentlocation_id, decision, comment, conn = pool) {
    // currentlocation_id is the id of the employee who is currently handling the request
    const [row] = await conn.query('SELECT * FROM Employe WHERE id = ?', [currentlocation_id]);
    if (!row[0]) {
        throw new Error('Employé introuvable.');
    }

    const currentEmp = row[0];
    const unitRow = await getEmployeeUnit(currentlocation_id, conn);
    const nextStepOrder = await getNextStepOrder(requestId, conn);

    let targetUnit;

    if (currentEmp.role === 'employe') {
        // Standard request submission from regular employee: forward to head of employee's unit (Service, Department, or Direction head)
        targetUnit = await getHeadingUnit(unitRow, conn);
        if (!targetUnit) {
            throw new Error(`Aucun responsable trouvé pour l'unité « ${unitRow.name} ».`);
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    else if (currentEmp.role === 'chef_service') {
        // Step approved by chef_service -> forward to head of parent department (or parent direction if no department)
        const parentUnit = await getParentUnit(unitRow, conn);
        if (!parentUnit) {
            throw new Error(`Aucune unité parente trouvée pour le service « ${unitRow.name} ».`);
        }
        targetUnit = await getHeadingUnit(parentUnit, conn);
        if (!targetUnit) {
            throw new Error(`Aucun responsable trouvé pour l'unité parente « ${parentUnit.name} ».`);
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    else if (currentEmp.role === 'chef_departement') {
        // Step approved by chef_departement -> forward to director of direction (or HR if department is top-level direction)
        const parentUnit = await getParentUnit(unitRow, conn);
        if (parentUnit && parentUnit.type === 'direction') {
            targetUnit = await getHeadingUnit(parentUnit, conn);
        } else {
            // If department has no parent direction or is already top level, forward to DRH
            const [hrRows] = await conn.query('SELECT * FROM Employe WHERE role = ? AND direction_id = ?', ['drh', unitRow.direction_id]);
            if (hrRows.length === 0) {
                // Fallback to any DRH if direction DRH not found
                const [anyHrRows] = await conn.query('SELECT * FROM Employe WHERE role = ?', ['drh']);
                if (anyHrRows.length === 0) {
                    throw new Error('Aucun employé RH trouvé dans le système.');
                }
                targetUnit = anyHrRows[0];
            } else {
                targetUnit = hrRows[0];
            }
        }

        if (!targetUnit) {
            throw new Error(`Aucun destinataire trouvé pour l'approbation du chef de département.`);
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    else if (currentEmp.role === 'directeur') {
        // Step approved by directeur -> forward to HR (DRH)
        const [hrRows] = await conn.query('SELECT * FROM Employe WHERE role = ? AND direction_id = ?', ['drh', unitRow.direction_id ?? unitRow.unit_id]);
        if (hrRows.length === 0) {
            const [anyHrRows] = await conn.query('SELECT * FROM Employe WHERE role = ?', ['drh']);
            if (anyHrRows.length === 0) {
                throw new Error(`Aucun DRH trouvé pour la direction « ${unitRow.direction_name} ».`);
            }
            targetUnit = anyHrRows[0];
        } else {
            targetUnit = hrRows[0];
        }
        await conn.query(
            'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
            [requestId, nextStepOrder, targetUnit.id, decision, comment, null]
        );
    }
    return targetUnit;
}

async function assertRequestAccess(requestId, currentUserId, currentUserRole) {
    if (!requestId || !currentUserId) {
        throw new Error('Authentification requise pour accéder aux demandes de congé.');
    }

    const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    if (requestRows.length === 0) {
        throw new Error('Demande introuvable.');
    }

    const isOwner = Number(requestRows[0].Emp_id) === Number(currentUserId);
    const isManager = ['admin', 'drh', 'head', 'hr'].includes(currentUserRole);

    if (!isOwner && !isManager) {
        throw new Error(`Vous n'êtes pas autorisé à accéder à cette demande de congé.`);
    }

    return requestRows[0];
}

async function assertStepAccess(stepId, currentUserId, currentUserRole, conn = pool) {
    if (!stepId || !currentUserId) {
        throw new Error('Authentification requise pour traiter une étape de demande.');
    }

    const [stepRows] = await conn.query(
        `SELECT rs.*, lr.request_status
         FROM Request_step rs
         JOIN Leave_request lr ON lr.request_id = rs.request_id
         WHERE rs.step_id = ?
         FOR UPDATE`,
        [stepId]
    );
    if (stepRows.length === 0) {
        throw new Error('Étape de la demande introuvable.');
    }
    if (stepRows[0].decision !== null || stepRows[0].request_status !== 'pending') {
        throw new Error('Cette étape de demande a déjà été traitée.');
    }

    const isAssignedTarget = Number(stepRows[0].target_id) === Number(currentUserId);
    const isManager = ['admin', 'drh', 'head', 'hr'].includes(currentUserRole);
    const canBypass = await isSuperiorOf(currentUserId, stepRows[0].target_id, conn);

    if (!isAssignedTarget && !isManager && !canBypass) {
        throw new Error(`Vous n'êtes pas autorisé à traiter cette étape de la demande.`);
    }

    return stepRows[0];
}
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

function getRoleLabel(role) {
    return {
        employe: 'employé',
        chef_service: 'chef de service',
        chef_departement: 'chef de département',
        directeur: 'directeur',
        drh: 'DRH'
    }[role] || role || 'utilisateur';
}

const requestService = {
    async createRequest({ employeeId, targetEmployeeId, startDate, endDate, duration, leaveType, reasonType, justification, url, exercise }) {
        // create new Request
        const effectiveDuration = calculateLeaveDuration(startDate, endDate);
        const normalizedJustification = typeof justification === 'string' ? justification.trim() : '';
        const normalizedReasonType = typeof reasonType === 'string' ? reasonType.trim() : '';
        const creatorId = Number(employeeId);
        const requestedEmployeeId = targetEmployeeId ? Number(targetEmployeeId) : creatorId;

        if (leaveType === 'exceptional') {
            if (!normalizedReasonType) {
                throw new Error('Un motif est obligatoire pour un congé exceptionnel.');
            }
            if (!normalizedJustification) {
                throw new Error('Une justification est obligatoire pour un congé exceptionnel.');
            }
        }

        if (duration !== undefined && duration !== null && Number(duration) !== effectiveDuration) {
            throw new Error('La durée du congé ne correspond pas à la période sélectionnée.');
        }

        const exerciseYear = exercise ?? getExerciseYearForDate(startDate);
        const connection = await pool.getConnection();

        try {
            const [creatorRows] = await connection.query('SELECT * FROM Employe WHERE id = ?', [creatorId]);
            if (creatorRows.length === 0) {
                throw new Error('Employé créateur introuvable.');
            }

            const creator = creatorRows[0];
            const isCreatingForEmployee = requestedEmployeeId !== creatorId;
            if (isCreatingForEmployee) {
                if (!CREATOR_ROLES.includes(creator.role) || !creator.can_create_for_employee) {
                    throw new Error('Vous n’êtes pas autorisé à créer une demande pour un autre employé.');
                }

                const [targetScopeRows] = await connection.query(
                    `SELECT e.id
                     FROM Employe e
                     LEFT JOIN Service s ON s.id = e.service_id
                     LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
                     WHERE e.id = ?
                       AND e.role = 'employe'
                       AND (
                         (? = 'chef_service' AND e.service_id = ?)
                         OR (? = 'chef_departement' AND COALESCE(e.departement_id, s.departement_id) = ?)
                         OR (? = 'directeur' AND COALESCE(e.direction_id, dep.direction_id, s.direction_id) = ?)
                       )`,
                    [requestedEmployeeId, creator.role, creator.service_id, creator.role, creator.departement_id, creator.role, creator.direction_id]
                );
                if (targetScopeRows.length === 0) {
                    throw new Error('Cet employé ne relève pas de votre périmètre.');
                }
            }

            employeeId = requestedEmployeeId;
            const [employeeRows] = await connection.query('SELECT * FROM Employe WHERE id = ?', [employeeId]);
            if (employeeRows.length === 0) {
                throw new Error('Employé introuvable.');
            }

            const employeeRole = employeeRows[0].role;
            if (employeeRole === 'directeur' || employeeRole === 'drh') {
                throw new Error('Les directeurs et le DRH ne peuvent pas soumettre de demande de congé via le workflow standard. Veuillez contacter l’administration.');
            }

            const [pendingRequests] = await connection.query(
                'SELECT * FROM Leave_request WHERE Emp_id = ? AND request_status = ?',
                [employeeId, 'pending']
            );
            if (pendingRequests.length > 0) {
                throw new Error('Vous avez déjà une demande en attente.');
            }

            const [approvedRequests] = await connection.query(
                'SELECT request_id, start_date, duration FROM Leave_request WHERE Emp_id = ? AND request_status = ?',
                [employeeId, 'approved']
            );
            const newStart = new Date(startDate);
            const newEnd = new Date(endDate);
            for (const existing of approvedRequests) {
                const startDateStr = existing.start_date instanceof Date 
                    ? existing.start_date.toISOString().split('T')[0]
                    : String(existing.start_date).split('T')[0];
                const existingStart = new Date(startDateStr);
                const existingEnd = new Date(existingStart);
                existingEnd.setDate(existingEnd.getDate() + Number(existing.duration) - 1);

                if (newStart <= existingEnd && newEnd >= existingStart) {
                    throw new Error(`La période demandée chevauche un congé déjà approuvé (du ${startDateStr} pour ${existing.duration} jour(s))`);
                }
            }

            await connection.beginTransaction();
            const [result] = await connection.query(
                'INSERT INTO Leave_request (Emp_id, created_by, exercise, leave_type, start_date, duration, reason_type, justification, url_justification, request_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [employeeId, creatorId, Number(exerciseYear), leaveType, startDate, effectiveDuration, normalizedReasonType || null, normalizedJustification || null, url ?? null, 'pending', new Date().toISOString().slice(0, 19).replace('T', ' ')]
            );

            if (leaveType === 'annual') {
                await createAnnualExerciseRequest(result.insertId, connection);
            } else if (leaveType === 'advance') {
                // if still have balance in previous exercise, throw error, because employee should use the balance first before requesting advance
                const [priorExerciseRows] = await connection.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year != ? AND balance > 0', [employeeId, exerciseYear]);
                if (priorExerciseRows.length > 0) {
                    throw new Error(`Vous disposez encore d'un solde dans un ou plusieurs exercices précédents. Veuillez utiliser ce solde avant de demander un congé par anticipation.`);
                }

                // Advance leave is capped at 30 days per exercise, cumulative across all
                // approved advance requests for that exercise (not per individual request).
                const [advanceUsageRows] = await connection.query(
                    `SELECT COALESCE(SUM(ra.days_allocated), 0) AS total_days
                     FROM Request_exercise_allocation ra
                     JOIN Leave_request lr ON lr.request_id = ra.request_id
                     WHERE lr.Emp_id = ? AND lr.leave_type = 'advance' AND lr.request_status = 'approved' AND lr.exercise = ?`,
                    [employeeId, exerciseYear]
                );
                const advanceUsedThisExercise = Number(advanceUsageRows[0].total_days) || 0;
                if (advanceUsedThisExercise + effectiveDuration > 30) {
                    throw new Error(`La limite de 30 jours de congé par anticipation pour cet exercice est dépassée : ${advanceUsedThisExercise} jour(s) déjà approuvé(s), ${effectiveDuration} jour(s) supplémentaires demandés.`);
                }

                const [currentExerciseRows] = await connection.query('SELECT * FROM Exercise WHERE Emp_id = ? AND year = ?', [employeeId, exerciseYear]);
                const advanceAllocations = computeAdvanceExerciseSplit(effectiveDuration, currentExerciseRows, exerciseYear);
                for (const allocation of advanceAllocations) {
                    await connection.query(
                        'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated, remaining_after) VALUES (?, ?, ?, ?)',
                        [result.insertId, allocation.exercise_id, allocation.days_allocated, allocation.remaining_after]
                    );
                }
            }

            let targetUnit;
            if (isCreatingForEmployee) {
                const nextStepOrder = await getNextStepOrder(result.insertId, connection);
                await connection.query(
                    'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [result.insertId, nextStepOrder, creatorId, null, null, null]
                );
                targetUnit = creator;
            } else {
                targetUnit = await forwardRequestToNextStep(result.insertId, employeeId, null, null, connection);
            }
            if (targetUnit && targetUnit.id) {
                await createNotification({
                    targetId: targetUnit.id,
                    requestId: result.insertId,
                    content: isCreatingForEmployee
                        ? `Une demande de congé pour ${employeeRows[0].nom} ${employeeRows[0].prenom} vous attend pour approbation.`
                        : `${employeeRows[0].nom} ${employeeRows[0].prenom} vous a soumis une demande de congé du ${startDate} au ${endDate}.`
                }, connection);
            }
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
            throw new Error('Authentification requise pour accéder aux étapes des demandes.');
        }

        const isOwnTarget = Number(targetId) === Number(currentUserId);
        const isManager = ['admin', 'drh', 'head', 'hr'].includes(currentUserRole);

        if (!isOwnTarget && !isManager) {
            throw new Error(`Vous n'êtes pas autorisé à consulter ces étapes.`);
        }

        const [steps] = await pool.query('SELECT * FROM Request_step WHERE target_id = ?', [targetId]);
        return steps;
    },
    async getPendingStepsForUser(userId) {
        const [userRows] = await pool.query('SELECT id, role FROM Employe WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            throw new Error('Employé introuvable.');
        }

        const [steps] = await pool.query(
                        `SELECT rs.*, lr.start_date, lr.duration, lr.leave_type, lr.justification, lr.url_justification,
                            lr.reason_type, lr.request_status,
            e.nom, e.prenom, e.email,
            creator.nom AS creator_last_name, creator.prenom AS creator_first_name,
            creator.role AS creator_role,
            target.nom AS target_nom, target.prenom AS target_prenom, target.role AS target_role
       FROM Request_step rs
       JOIN Leave_request lr ON lr.request_id = rs.request_id
        JOIN Employe e ON e.id = lr.Emp_id
       LEFT JOIN Employe creator ON creator.id = lr.created_by
       JOIN Employe target ON target.id = rs.target_id
       WHERE (rs.decision IS NULL OR rs.decision = '') AND lr.request_status = 'pending'
         AND (rs.target_id = ? OR target.role IN ('chef_service', 'chef_departement'))`,
            [userId]
        );

        const visibleSteps = [];
        for (const step of steps) {
            if (Number(step.target_id) === Number(userId)
                || await isSuperiorOf(userId, step.target_id)) {
                visibleSteps.push(step);
            }
        }

        if (visibleSteps.length === 0) {
            return [];
        }

        const requestIds = [...new Set(visibleSteps.map((step) => step.request_id))];
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

        return visibleSteps.map((step) => ({
            ...step,
            annualSplit: splitByRequest[step.request_id] ?? []
        }));
    },
    async updateRequestStep(stepId, decision, comment, currentUserId, currentUserRole) {
        if (decision !== 'approved' && decision !== 'rejected') {
            throw new Error(`Décision invalide « ${decision} ». Valeurs acceptées : 'approved' ou 'rejected'.`);
        }

        const connection = await pool.getConnection();
        const notifications = [];

        try {
            await connection.beginTransaction();
            const step = await assertStepAccess(stepId, currentUserId, currentUserRole, connection);
            const [approverRows] = await connection.query('SELECT * FROM Employe WHERE id = ?', [currentUserId]);
            if (approverRows.length === 0) {
                throw new Error('Employé introuvable.');
            }

            const approver = approverRows[0];
            const isAssignedTarget = Number(step.target_id) === Number(currentUserId);
            const isBypass = !isAssignedTarget
                && ['chef_departement', 'directeur'].includes(approver.role)
                && await isSuperiorOf(currentUserId, step.target_id, connection);

            const [requestRows] = await connection.query('SELECT * FROM Leave_request WHERE request_id = ? FOR UPDATE', [step.request_id]);
            if (requestRows.length === 0) {
                throw new Error('Demande introuvable.');
            }

            const request = requestRows[0];
            const approverName = `${approver.nom} ${approver.prenom}`;
            const targetDecision = isBypass ? 'skipped' : decision;
            await connection.query(
                'UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?',
                [targetDecision, isBypass ? null : comment, stepId]
            );

            let nextTarget = null;
            if (isBypass) {
                const nextStepOrder = await getNextStepOrder(request.request_id, connection);
                await connection.query(
                    'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [request.request_id, nextStepOrder, currentUserId, decision, comment]
                );
            }

            if (decision === 'rejected') {
                await connection.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['rejected', request.request_id]);
                notifications.push({
                    targetId: request.Emp_id,
                    requestId: request.request_id,
                    content: `Votre demande de congé du ${request.start_date} a été refusée par ${approverName}.`
                });
            } else if (approver.role === 'drh' && !isBypass) {
                await connection.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['approved', request.request_id]);
                if (request.leave_type === 'annual') {
                    await applyApprovedAnnualAllocations(request.request_id, connection);
                } else if (request.leave_type === 'advance') {
                    await applyApprovedAdvanceAllocations(request.request_id, connection);
                }
                notifications.push({
                    targetId: request.Emp_id,
                    requestId: request.request_id,
                    content: `Votre demande de congé du ${request.start_date} a été approuvée par ${approverName}.`
                });
            } else {
                const forwardingId = isBypass ? currentUserId : step.target_id;
                nextTarget = await forwardRequestToNextStep(request.request_id, forwardingId, null, null, connection);
                if (nextTarget) {
                    notifications.push({
                        targetId: nextTarget.id,
                        requestId: request.request_id,
                        content: `Une demande de congé vous a été transmise pour examen par ${approverName}.`
                    });
                }
                notifications.push({
                    targetId: request.Emp_id,
                    requestId: request.request_id,
                    content: `Votre demande de congé a été approuvée par ${approverName} et transmise à l'étape suivante.`
                });
            }

            await connection.commit();
            for (const notification of notifications) {
                await createNotification(notification);
            }
            return { requestId: request.request_id, targetUnit: nextTarget };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    async cancelRequest(requestId, currentUserId, currentUserRole) {
        const request = await assertRequestAccess(requestId, currentUserId, currentUserRole);
        const isOwner = Number(request.Emp_id) === Number(currentUserId);
        if (!isOwner) {
            throw new Error(`Vous n'êtes pas autorisé à annuler cette demande de congé.`);
        }

        if (!['pending', 'approved'].includes(request.request_status)) {
            throw new Error(`Une demande au statut « ${request.request_status} » ne peut pas être annulée.`);
        }

        let daysToRefund = 0;
        if (request.request_status === 'approved' && request.leave_type !== 'exceptional') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startDate = new Date(request.start_date);
            startDate.setHours(0, 0, 0, 0);
            const duration = Number(request.duration) || 0;
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + duration - 1);

            if (today < startDate) {
                // Case 1: leave hasn't started yet -> refund the full duration
                daysToRefund = duration;
            } else if (today <= endDate) {
                // Case 2: leave is in progress -> refund only the not-yet-taken days
                const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
                daysToRefund = Math.max(duration - elapsedDays, 0);
            } else {
                throw new Error('Ce congé est déjà terminé et ne peut plus être annulé.');
            }
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            if (daysToRefund > 0) {
                await refundApprovedAllocations(requestId, daysToRefund, connection);
            }
            await connection.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['cancelled', requestId]);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // Get employee info for notification message
        const [empRows] = await pool.query('SELECT nom, prenom FROM Employe WHERE id = ?', [currentUserId]);
        const empName = empRows.length > 0 ? `${empRows[0].nom} ${empRows[0].prenom}` : 'L\'employé';

        // Notify the owner (employee)
        await createNotification({
            targetId: currentUserId,
            requestId,
            content: `Votre demande de congé du ${request.start_date} a été annulée avec succès.`
        });

        // Notify assigned reviewers with pending steps
        const [pendingSteps] = await pool.query(
            'SELECT DISTINCT target_id FROM Request_step WHERE request_id = ? AND (decision IS NULL OR decision = "")',
            [requestId]
        );
        for (const step of pendingSteps) {
            if (Number(step.target_id) !== Number(currentUserId)) {
                await createNotification({
                    targetId: step.target_id,
                    requestId,
                    content: `La demande de congé de ${empName} du ${request.start_date} a été annulée.`
                });
            }
        }

        return { requestId, message: 'Demande annulée avec succès', daysRefunded: daysToRefund };
    },
    async getRequestDetails(requestId, currentUserId, currentUserRole) {
        await assertRequestAccess(requestId, currentUserId, currentUserRole);
        const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
        return requestRows[0];
    },

    async createTitle({ requestId }) {
        const [requestRows] = await pool.query(
            'SELECT * FROM Leave_request WHERE request_id = ?',
            [requestId]
        );
        if (requestRows.length === 0) {
            throw new Error('Demande introuvable.');
        }

        const request = requestRows[0];
        if (request.request_status !== 'approved') {
            throw new Error('La demande doit être approuvée pour générer un titre.');
        }

        const [employeeRows] = await pool.query(
            'SELECT nom, prenom, matricule FROM Employe WHERE id = ?',
            [request.Emp_id]
        );
        if (employeeRows.length === 0) {
            throw new Error('Employé introuvable.');
        }

        const [allocations] = await pool.query(
            `SELECT re.exercise_id, re.days_allocated, re.remaining_after,
                    ex.year AS exercise_year
             FROM Request_exercise_allocation re
             JOIN Exercise ex ON ex.exercise_id = re.exercise_id
             WHERE re.request_id = ?
             ORDER BY ex.year ASC`,
            [requestId]
        );
        if (allocations.length === 0) {
            throw new Error('Aucun exercice associé à cette demande.');
        }

        const startDate = new Date(request.start_date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + Number(request.duration) - 1);
        const formatDate = (date) => date.toISOString().slice(0, 10);
        const employee = employeeRows[0];

        return {
            name: `${employee.nom} ${employee.prenom}`,
            matricule: employee.matricule,
            leaveType: request.leave_type,
            period: {
                start: formatDate(startDate),
                end: formatDate(endDate)
            },
            duration: Number(request.duration),
            status: request.request_status,
            exercises: allocations.map((allocation) => ({
                exerciseId: allocation.exercise_id,
                year: Number(allocation.exercise_year),
                daysAllocated: Number(allocation.days_allocated),
                remainingAfter: allocation.remaining_after === null
                    ? null
                    : Number(allocation.remaining_after)
            }))
        };
    }
    
};
module.exports = requestService;
module.exports.calculateLeaveDuration = calculateLeaveDuration;
module.exports.computeAnnualExerciseSplit = computeAnnualExerciseSplit;
module.exports.applyApprovedAnnualAllocations = applyApprovedAnnualAllocations;
module.exports.applyApprovedAdvanceAllocations = applyApprovedAdvanceAllocations;
module.exports.refundApprovedAllocations = refundApprovedAllocations;
module.exports.isSuperiorOf = isSuperiorOf;