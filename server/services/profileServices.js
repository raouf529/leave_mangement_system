const pool = require('../db');

// to got follower emploee of a head employee, we need to get the unit of the head employee, then get all the employees in that unit and its child units
// to extract the child units, we can use a recursive function to get all the child units of a given unit
async function getChildUnits(unitId) {
    const [units] = await pool.query('SELECT * FROM Org_unit WHERE parent_unit_id = ?', [unitId]);
    let childUnits = [...units];

    for (const unit of units) {
        const subUnits = await getChildUnits(unit.unit_id);
        childUnits = [...childUnits, ...subUnits];
    }

    return childUnits;
}

const profileService = {
    async getEmployeeProfile(employeeId) {
        const [rows] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [employeeId]);
        if (rows.length === 0) {
            throw new Error('Employee not found');
        }

        const [units] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [rows[0].unit_id]);
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
                        e.First_name, e.Last_name, e.role AS target_role,
                        u.name AS unit_name, u.type AS unit_type
                 FROM Request_step rs
                 JOIN Employee e ON e.Emp_id = rs.target_id
                 LEFT JOIN Org_unit u ON u.unit_id = e.unit_id
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
            id: rows[0].Emp_id,
            firstName: rows[0].First_name,
            lastName: rows[0].Last_name,
            email: rows[0].email,
            role: rows[0].role,
            recrutement_date: rows[0].recrutement_date,
            unit: units.length > 0 ? { id: units[0].unit_id, name: units[0].name, type: units[0].type } : null,
            forward_drh: rows[0].forward_drh,
            exercises: exercises.map(ex => ({ exercise: ex.year, balance: ex.balance })),
            leaveRequests: leaveRequests.map(lr => {
                const currentStep = currentStepByRequest[lr.request_id];
                const rejectedStep = rejectedStepByRequest[lr.request_id];
                const currentStepLabel = currentStep
                    ? currentStep.target_role === 'hr'
                        ? 'HR'
                        : currentStep.target_role === 'head'
                            ? `${currentStep.unit_name ?? 'Unité'} (${currentStep.unit_type ?? 'unit'})`
                            : `${currentStep.First_name ?? ''} ${currentStep.Last_name ?? ''}`.trim() || 'Responsable'
                    : null;

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
        const [rows] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [employeeId]);
        if (rows.length === 0) {
            throw new Error('Employee not found');
        }

        await pool.query(
            'UPDATE Employee SET First_name = ?, Last_name = ?, email = ? WHERE Emp_id = ?',
            [firstName, lastName, email, employeeId]
        );

        return { id: employeeId, firstName, lastName, email };
    },

    // whene role is head or hr, get the list of employees in the same unit and child units
    async getUnderemployees(employeeId) {
        const [rows] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [employeeId]);
        if (rows.length === 0) {
            throw new Error('Employee not found');
        }

        const user = rows[0];
        if (user.role !== 'head' && user.role !== 'hr') {
            throw new Error('Only employees with the role of "head" or "hr" can view underemployees');
        }

        const [units] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [user.unit_id]);
        if (!units || units.length === 0) {
            throw new Error(`Unit '${user.unit_id}' not found`);
        }
        const unit = units[0];

        const childUnits = await getChildUnits(unit.unit_id);
        const unitIds = [unit.unit_id, ...childUnits.map(childUnit => childUnit.unit_id)];
        const [underemployees] = await pool.query(
            'SELECT * FROM Employee WHERE unit_id IN (?)',
            [unitIds]
        );
        const [all_units] = await pool.query('SELECT * FROM Org_unit');

        return underemployees.map(emp => ({
            id: emp.Emp_id,
            firstName: emp.First_name,
            lastName: emp.Last_name,
            email: emp.email,
            role: emp.role,
            unit: all_units.find(unit => unit.unit_id === emp.unit_id)
                ? {
                    id: emp.unit_id,
                    name: all_units.find(unit => unit.unit_id === emp.unit_id).name,
                    type: all_units.find(unit => unit.unit_id === emp.unit_id).type
                }
                : null
        }));
    },

    async getAllEmployees() {
        const [employees] = await pool.query('SELECT * FROM Employee');
        const [units] = await pool.query('SELECT * FROM Org_unit');
        return employees.map(emp => ({
            id: emp.Emp_id,
            firstName: emp.First_name,
            lastName: emp.Last_name,
            email: emp.email,
            role: emp.role,
            unit: units.find(unit => unit.unit_id === emp.unit_id)
                ? {
                    id: emp.unit_id,
                    name: units.find(unit => unit.unit_id === emp.unit_id).name,
                    type: units.find(unit => unit.unit_id === emp.unit_id).type
                }
                : null
        }));
    }
};

module.exports = profileService;