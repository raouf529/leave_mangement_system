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

        return {
            id: rows[0].Emp_id,
            firstName: rows[0].First_name,
            lastName: rows[0].Last_name,
            email: rows[0].email,
            role: rows[0].role,
            recrutement_date: rows[0].recrutement_date,
            unit: units.length > 0 ? { id: units[0].unit_id, name: units[0].name, type: units[0].type } : null,
            forward_drh: rows[0].forward_drh,
            exercises: exercises.map(ex => ({ exercise: ex.exercise, balance: ex.balance })),
            leaveRequests: leaveRequests.map(lr => ({
                id: lr.request_id,
                startDate: lr.start_date,
                duration: lr.duration,
                status: lr.request_status,
                leaveType: lr.leave_type,
            }))
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