const db = require('../db');
const { createLog } = require('../utils/dbUtils');
const bcrypt = require('bcrypt');
const { assignBalance, getExerciseWindowForDate } = require('../utils/helpers');

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

const DEFAULT_PASSWORD = 'Passw0rd!';

const employServices = {
    async createEmployee(employeeData) {
        try {
            const { 
                nom, nom_jeune_fille, prenom, email, 
                date_entree, direction_id, 
                departement_id, service_id, matricule, 
                fonction, role, role_leave_validation, can_create_for_employee, is_leave_responsible,
                adminId // ID of the admin creating this user for logging
            } = employeeData;

            // Use a constant password for MVP demo (will be communicated to users manually)
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
            
            const employeRole = role || 'employe';
            const employeRoleLeaveValidation = role_leave_validation || 'employe';
            const employeCanCreateForEmployee = can_create_for_employee ? 1 : 0;
            const employeIsLeaveResponsible = is_leave_responsible ? 1 : 0;

            const [result] = await db.query(
                `INSERT INTO Employe (
                    nom, nom_jeune_fille, prenom, email, password, 
                    date_entree, role, direction_id, departement_id, 
                    service_id, matricule, fonction, 
                    can_create_for_employee, role_leave_validation, is_leave_responsible
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nom, nom_jeune_fille || null, prenom, email, hashedPassword,
                    date_entree || new Date(), employeRole, direction_id || null, departement_id || null,
                    service_id || null, matricule, fonction || null,
                    employeCanCreateForEmployee, employeRoleLeaveValidation, employeIsLeaveResponsible
                ]
            );

            await createLog({
                empId: adminId || result.insertId, // Log who created it if provided, else self
                action: 'create_employee',
                requestId: null,
                meta: {
                    role: employeRole,
                    newEmployeeId: result.insertId,
                    email: email
                }
            });

            if (['chef_service', 'chef_departement', 'directeur'].includes(employeRoleLeaveValidation)) {
                await replaceChef(result.insertId, employeRoleLeaveValidation, service_id, departement_id, direction_id);
            }

            // Initialize exercise for the new employee
            const year = getExerciseYearForDate(new Date());
            const balance = calculateInitialBalance(new Date(), new Date());
            const [newExercise] = await db.query(
                `INSERT INTO Exercise (emp_id, year, balance, created_at, updated_at) 
                VALUES (?, ?, ?, NOW(), NOW())`,
                [result.insertId, year, balance]
            )
            // insert log
            await createLog({
                empId: result.insertId,
                action: 'create_exercise',
                requestId: null,
                meta: {
                    exerciseYear: year,
                    balance
                }
            })
            return result.insertId;
        } catch (error) {
            throw error;
        }
    },
    async getAllServices() {
        try {
            var [services] = await db.query(`SELECT * FROM Service`);
            return services;
        } catch (error) {
            throw error;
        }
    },
    async getAllDepartements(){
        try {
            const [departements] = await db.query(`SELECT * FROM Departement`);
            return departements;
        } catch (error) {
            throw error;
        }
    },
    async getAllDirections(){
        try {
            const [directions] = await db.query(`SELECT * FROM Direction`);
            return directions;
        } catch (error) {
            throw error;
        }
    },
    async changeRole(empId, newRoleValidation) {
        try {
            const [emps] = await db.query(`SELECT service_id, departement_id, direction_id FROM Employe WHERE id = ?`, [empId]);
            if (emps.length === 0) throw new Error('Employee not found');
            const emp = emps[0];
            
            await db.query(`UPDATE Employe SET role_leave_validation = ? WHERE id = ?`, [newRoleValidation, empId]);
            
            if (['chef_service', 'chef_departement', 'directeur'].includes(newRoleValidation)) {
                await replaceChef(empId, newRoleValidation, emp.service_id, emp.departement_id, emp.direction_id);
            }
        } catch(error) {
            throw error;
        }
    }
};

async function replaceChef(newEmployeeId, role_leave_validation, service_id, departement_id, direction_id) {
    let unitColumn = '';
    let unitValue = null;

    if (role_leave_validation === 'chef_service') {
        unitColumn = 'service_id';
        unitValue = service_id;
    } else if (role_leave_validation === 'chef_departement') {
        unitColumn = 'departement_id';
        unitValue = departement_id;
    } else if (role_leave_validation === 'directeur') {
        unitColumn = 'direction_id';
        unitValue = direction_id;
    }

    if (!unitValue) return;

    const [existing] = await db.query(
        `SELECT id FROM Employe WHERE role_leave_validation = ? AND ${unitColumn} = ? AND id != ?`,
        [role_leave_validation, unitValue, newEmployeeId]
    );

    if (existing.length > 0) {
        const oldChefId = existing[0].id;
        
        await db.query(
            `UPDATE Employe SET role_leave_validation = 'employe' WHERE id = ?`,
            [oldChefId]
        );

        await db.query(
            `UPDATE Request_step SET target_id = ? WHERE target_id = ? AND decision IS NULL`,
            [newEmployeeId, oldChefId]
        );
    }
}

module.exports = employServices;