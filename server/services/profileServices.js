const pool = require('../db');
const { mapRole, getRoleLabel, getEmployeeUnit } = require('../utils/helpers');


const profileService = {
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
        const [leaveRequests] = await pool.query('SELECT * FROM Leave_request WHERE Emp_id = ?', [employeeId]);

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
                          CASE WHEN e.role = 'drh' THEN 'hr'
                              WHEN e.role IN ('directeur', 'chef_departement', 'chef_service') THEN 'head'
                              WHEN e.role = 'employe' THEN 'employee'
                              ELSE e.role END AS target_role,
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
            firstName: employee.prenom,
            lastName: employee.nom,
            email: rows[0].email,
            role: mapRole(employee.role),
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
                    rejectionReason: rejectedStep?.comment ?? null
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

    async getUnderemployees(employeeId) {
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
        if (!['head', 'hr'].includes(mapRole(user.role))) {
            throw new Error('Seuls les employés avec le rôle "head" ou "hr" peuvent consulter leurs collaborateurs.');
        }

        const userUnit = getEmployeeUnit(user);
        if (!userUnit) {
            throw new Error(`Unité de l’employé '${employeeId}' introuvable.`);
        }
        const [underemployees] = await pool.query(
            `SELECT e.*, d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
             FROM Employe e
             LEFT JOIN Service s ON s.id = e.service_id
                 LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
                 LEFT JOIN Direction d ON d.id = COALESCE(e.direction_id, dep.direction_id, s.direction_id)
                 WHERE (? = 'direction' AND COALESCE(e.direction_id, dep.direction_id, s.direction_id) = ?)
                     OR (? = 'department' AND COALESCE(e.departement_id, s.departement_id) = ?)
                OR (? = 'service' AND e.service_id = ?)`,
            [userUnit.type, userUnit.id, userUnit.type, userUnit.id, userUnit.type, userUnit.id]
        );

        return underemployees.map(emp => ({
            id: emp.id,
            firstName: emp.prenom,
            lastName: emp.nom,
            email: emp.email,
            role: mapRole(emp.role),
            roleLabel: getRoleLabel(emp.role),
            unit: getEmployeeUnit(emp)
        }));
    },

    async getAllEmployees() {
        const [employees] = await pool.query(
            `SELECT e.*, d.nom AS direction_name, dep.nom AS departement_name, s.nom AS service_name
             FROM Employe e
             LEFT JOIN Direction d ON d.id = e.direction_id
             LEFT JOIN Departement dep ON dep.id = e.departement_id
             LEFT JOIN Service s ON s.id = e.service_id`
        );
        return employees.map(emp => ({
            id: emp.id,
            firstName: emp.prenom,
            lastName: emp.nom,
            email: emp.email,
            role: mapRole(emp.role),
            roleLabel: getRoleLabel(emp.role),
            unit: getEmployeeUnit(emp)
        }));
    }
};

module.exports = profileService;