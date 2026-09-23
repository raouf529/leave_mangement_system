const pool = require('../db');
const { mapRole, getRoleLabel, getEmployeeUnit } = require('../utils/helpers');


const profileService = {
    // get all employee infos: personal info, exercise info, and historic leaves requests
    async getEmployeeProfile(employeeId) {
        const [rows] = await pool.query('SELECT * FROM Employe WHERE id = ?', [employeeId]);
        if (rows.length === 0) {
            throw new Error('Employé introuvable.');
        }

        const [employees] = await pool.query(
            `SELECT e.*, d.id AS resolved_direction_id, d.nom AS direction_name,
                    dep.id AS resolved_departement_id, dep.nom AS departement_name,
                    s.nom AS service_name
             FROM Employe e
             LEFT JOIN Service s ON s.id = e.service_id
             LEFT JOIN Departement dep
                ON dep.id = COALESCE(e.departement_id, s.departement_id)
             LEFT JOIN Direction d
                ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
             WHERE e.id = ?`,
            [employeeId]
        );
        if (employees.length === 0 || employees[0].resolved_direction_id === null) {
            throw new Error(`Direction de l’employé '${employeeId}' introuvable.`);
        }
        const employee = employees[0];
        const unit = getEmployeeUnit(employee);
        const [exercises] = await pool.query('SELECT * FROM Exercise WHERE Emp_id = ?', [employeeId]);
        const [leaveRequests] = await pool.query(
            `SELECT lr.*,
                    creator.nom AS creator_last_name,
                    creator.prenom AS creator_first_name,
                    creator.role AS creator_role
             FROM Leave_request lr
             LEFT JOIN Employe creator ON creator.id = lr.created_by
             WHERE lr.Emp_id = ?`,
            [employeeId]
        );

        let requestAllocations = [];
        let requestSteps = [];
        if (leaveRequests.length > 0) {
            [requestAllocations] = await pool.query(
                `SELECT ra.request_id, ra.exercise_id, ra.days_allocated, e.year AS exercise_year
                 FROM Request_exercise_allocation ra
                 JOIN Exercise e ON e.exercise_id = ra.exercise_id
                 WHERE ra.request_id IN (?)`,
                [leaveRequests.map((request) => request.request_id)]
            );

            [requestSteps] = await pool.query(
                `SELECT rs.request_id, rs.step_order, rs.target_id, rs.decision, rs.comment,
                          e.nom, e.prenom,
                          CASE WHEN e.is_leave_responsible = 1 THEN 'hr'
                              WHEN e.role_leave_validation IN ('directeur', 'chef_departement', 'chef_service') THEN 'head'
                              WHEN e.role_leave_validation = 'employe' THEN 'employee'
                              ELSE e.role_leave_validation END AS target_role,
                           COALESCE(s.nom, dep.nom, d.nom) AS unit_name,
                           CASE WHEN e.service_id IS NOT NULL THEN 'service'
                             WHEN e.departement_id IS NOT NULL THEN 'department'
                             ELSE 'direction' END AS unit_type
                 FROM Request_step rs
                       JOIN Employe e ON e.id = rs.target_id
                       LEFT JOIN Direction d ON d.id = e.direction_id
                       LEFT JOIN Departement dep ON dep.id = e.departement_id
                       LEFT JOIN Service s ON s.id = e.service_id
                 WHERE rs.request_id IN (?)
                 ORDER BY rs.request_id, rs.step_order DESC`,
                [leaveRequests.map((request) => request.request_id)]
            );
        }

        const allocationsByRequest = requestAllocations.reduce((acc, allocation) => {
            if (!acc[allocation.request_id]) {
                acc[allocation.request_id] = [];
            }

            acc[allocation.request_id].push({
                exerciseId: allocation.exercise_id,
                year: allocation.exercise_year,
                daysAllocated: Number(allocation.days_allocated)
            });
            return acc;
        }, {});

        const currentStepByRequest = {};
        const rejectedStepByRequest = {};

        for (const step of requestSteps) {
            if (!currentStepByRequest[step.request_id] && (!step.decision || step.decision === '')) {
                currentStepByRequest[step.request_id] = step;
            }

            if (!rejectedStepByRequest[step.request_id] && step.decision === 'rejected') {
                rejectedStepByRequest[step.request_id] = step;
            }
        }

        return {
            id: employee.id,
            matricule: employee.matricule,
            firstName: employee.prenom,
            lastName: employee.nom,
            email: rows[0].email,
            role: mapRole(employee.role, employee.is_leave_responsible),
            roleLabel: getRoleLabel(employee.role),
            recrutement_date: employee.date_entree,
            unit,
            exercises: exercises.map(ex => ({ exercise: ex.year, balance: ex.balance })),
            leaveRequests: leaveRequests.map(lr => {
                const currentStep = currentStepByRequest[lr.request_id];
                const rejectedStep = rejectedStepByRequest[lr.request_id];
                const currentStepLabel = currentStep
                    ? currentStep.target_role === 'hr'
                        ? 'HR'
                        : currentStep.target_role === 'head'
                            ? `${currentStep.unit_name ?? 'Unité'} (${currentStep.unit_type ?? 'unit'})`
                            : `${currentStep.prenom ?? ''} ${currentStep.nom ?? ''}`.trim() || 'Responsable'
                    : null;
                const created_at = lr.created_at;

                return {
                    id: lr.request_id,
                    startDate: lr.start_date,
                    duration: lr.duration,
                    status: lr.request_status,
                    leaveType: lr.leave_type,
                    createdByName: lr.creator_first_name && lr.creator_last_name
                        ? `${lr.creator_first_name} ${lr.creator_last_name}`
                        : null,
                    createdByRole: lr.creator_role ?? null,
                    allocations: allocationsByRequest[lr.request_id] ?? [],
                    currentStep: currentStep
                        ? {
                            stepOrder: currentStep.step_order,
                            targetRole: currentStep.target_role,
                            targetName: currentStepLabel,
                            unitName: currentStep.unit_name,
                            unitType: currentStep.unit_type,
                            kind: currentStep.target_role === 'hr' ? 'hr' : currentStep.target_role === 'head' ? 'unit' : 'person'
                          }
                        : null,
                    rejectionReason: rejectedStep?.comment ?? null,
                    rejectedByName: rejectedStep
                        ? `${rejectedStep.prenom ?? ''} ${rejectedStep.nom ?? ''}`.trim() || null
                        : null,
                    rejectedByRole: rejectedStep?.target_role ?? null
                };
            })
        };
    },

    async updateEmployeeProfile(employeeId, updates) {
        const { firstName, lastName, email } = updates;
        const [rows] = await pool.query('SELECT * FROM Employe WHERE id = ?', [employeeId]);
        if (rows.length === 0) {
            throw new Error('Employé introuvable.');
        }

        await pool.query(
            'UPDATE Employe SET prenom = ?, nom = ?, email = ? WHERE id = ?',
            [firstName, lastName, email, employeeId]
        );

        return { id: employeeId, firstName, lastName, email };
    },

    async getUnderemployees(employeeId, options = {}) {
        const [rows] = await pool.query(
            `SELECT e.*, d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
             FROM Employe e
             LEFT JOIN Direction d ON d.id = e.direction_id
             LEFT JOIN Departement dep ON dep.id = e.departement_id
             LEFT JOIN Service s ON s.id = e.service_id
             WHERE e.id = ?`,
            [employeeId]
        );
        if (rows.length === 0) {
            throw new Error('Employé introuvable.');
        }

        const user = rows[0];
        if (!['head', 'hr'].includes(mapRole(user.role, user.is_leave_responsible))) {
            throw new Error('Seuls les employés avec le rôle "head" ou "hr" peuvent consulter leurs collaborateurs.');
        }

        const userUnit = getEmployeeUnit(user);
        if (!userUnit) {
            throw new Error(`Unité de l’employé '${employeeId}' introuvable.`);
        }

        const page = options.page ? Math.max(1, parseInt(options.page, 10) || 1) : null;
        const limit = options.limit ? Math.max(1, parseInt(options.limit, 10) || 10) : null;
        const search = String(options.search ?? '').trim();
        const roleFilter = String(options.role ?? '').trim();

        const allowedSortFields = {
            id: 'e.id',
            nom: 'e.nom',
            prenom: 'e.prenom',
            email: 'e.email',
            matricule: 'e.matricule',
            date_entree: 'e.date_entree'
        };
        const sortByField = allowedSortFields[options.sortBy] || 'e.id';
        const sortOrder = String(options.sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const whereClauses = [
            `((? = 'direction' AND COALESCE(e.direction_id, dep.direction_id, s.direction_id) = ?)
              OR (? = 'department' AND COALESCE(e.departement_id, s.departement_id) = ?)
              OR (? = 'service' AND e.service_id = ?))`
        ];
        const params = [userUnit.type, userUnit.id, userUnit.type, userUnit.id, userUnit.type, userUnit.id];

        if (search) {
            whereClauses.push(`(
                CAST(e.matricule AS CHAR) LIKE ?
                OR e.nom LIKE ?
                OR e.prenom LIKE ?
                OR e.email LIKE ?
                OR CONCAT(e.nom, ' ', e.prenom) LIKE ?
                OR CONCAT(e.prenom, ' ', e.nom) LIKE ?
            )`);
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern, pattern, pattern);
        }

        if (roleFilter) {
            if (roleFilter === 'hr') {
                whereClauses.push('(e.is_leave_responsible = 1 OR e.role = ?)');
                params.push('drh');
            } else if (roleFilter === 'head') {
                whereClauses.push('e.role IN (?, ?, ?)');
                params.push('directeur', 'chef_departement', 'chef_service');
            } else if (roleFilter === 'employee') {
                whereClauses.push('e.role = ? AND e.is_leave_responsible = 0');
                params.push('employe');
            } else {
                whereClauses.push('e.role = ?');
                params.push(roleFilter);
            }
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM Employe e
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

        const [underemployees] = await pool.query(
            `SELECT e.*, d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
             FROM Employe e
             LEFT JOIN Service s ON s.id = e.service_id
             LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
             LEFT JOIN Direction d ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
             ${whereSql}
             ORDER BY ${sortByField} ${sortOrder}
             ${limitSql}`,
            queryParams
        );

        const formatted = underemployees.map(emp => ({
            id: emp.id,
            matricule: emp.matricule,
            firstName: emp.prenom,
            lastName: emp.nom,
            email: emp.email,
            role: mapRole(emp.role, emp.is_leave_responsible),
            roleLabel: getRoleLabel(emp.role),
            unit: getEmployeeUnit(emp),
            canCreateForEmployee: Boolean(emp.can_create_for_employee)
        }));

        if (page === null || limit === null) {
            return formatted;
        }

        const totalPages = Math.ceil(total / limit) || 1;
        return {
            data: formatted,
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


    async getAllEmployees(options = {}) {
        const page = options.page ? Math.max(1, parseInt(options.page, 10) || 1) : null;
        const limit = options.limit ? Math.max(1, parseInt(options.limit, 10) || 10) : null;
        const search = String(options.search ?? '').trim();
        const roleFilter = String(options.role ?? '').trim();
        const directionId = options.directionId ? Number(options.directionId) : null;
        const departementId = options.departementId ? Number(options.departementId) : null;
        const serviceId = options.serviceId ? Number(options.serviceId) : null;

        const allowedSortFields = {
            id: 'e.id',
            nom: 'e.nom',
            prenom: 'e.prenom',
            email: 'e.email',
            matricule: 'e.matricule',
            date_entree: 'e.date_entree',
            role: 'e.role'
        };
        const sortByField = allowedSortFields[options.sortBy] || 'e.id';
        const sortOrder = String(options.sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const whereClauses = [];
        const params = [];

        if (search) {
            whereClauses.push(`(
                CAST(e.matricule AS CHAR) LIKE ?
                OR e.nom LIKE ?
                OR e.prenom LIKE ?
                OR e.email LIKE ?
                OR CONCAT(e.nom, ' ', e.prenom) LIKE ?
                OR CONCAT(e.prenom, ' ', e.nom) LIKE ?
            )`);
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern, pattern, pattern);
        }

        if (roleFilter) {
            if (roleFilter === 'hr') {
                whereClauses.push('(e.is_leave_responsible = 1 OR e.role = ?)');
                params.push('drh');
            } else if (roleFilter === 'head') {
                whereClauses.push('e.role IN (?, ?, ?)');
                params.push('directeur', 'chef_departement', 'chef_service');
            } else if (roleFilter === 'employee') {
                whereClauses.push('e.role = ? AND e.is_leave_responsible = 0');
                params.push('employe');
            } else {
                whereClauses.push('e.role = ?');
                params.push(roleFilter);
            }
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

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM Employe e
            LEFT JOIN Direction d ON d.id = e.direction_id
            LEFT JOIN Departement dep ON dep.id = e.departement_id
            LEFT JOIN Service s ON s.id = e.service_id
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

        const dataQuery = `
            SELECT e.*, d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
            FROM Employe e
            LEFT JOIN Direction d ON d.id = e.direction_id
            LEFT JOIN Departement dep ON dep.id = e.departement_id
            LEFT JOIN Service s ON s.id = e.service_id
            ${whereSql}
            ORDER BY ${sortByField} ${sortOrder}
            ${limitSql}
        `;

        const [employees] = await pool.query(dataQuery, queryParams);

        const formatted = employees.map(emp => ({
            id: emp.id,
            matricule: emp.matricule,
            firstName: emp.prenom,
            lastName: emp.nom,
            email: emp.email,
            role: mapRole(emp.role, emp.is_leave_responsible),
            roleLabel: getRoleLabel(emp.role),
            unit: getEmployeeUnit(emp),
            canCreateForEmployee: Boolean(emp.can_create_for_employee)
        }));

        if (page === null || limit === null) {
            return formatted;
        }

        const totalPages = Math.ceil(total / limit) || 1;
        return {
            data: formatted,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }
};

module.exports = profileService;