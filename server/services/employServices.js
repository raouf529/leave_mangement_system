const db = require('../db');
const { createLog } = require('../utils/dbUtils');
const bcrypt = require('bcrypt');
const { assignBalance, getExerciseYearForDate } = require('../utils/helpers');

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

const DEFAULT_PASSWORD = 'Passw0rd!';

const employServices = {
    async createEmployee(employeeData) {
        try {
            const { 
                nom, nom_jeune_fille, prenom, email,
                date_entree, direction_id,
                departement_id, service_id, matricule, 
                fonction,
                adminId 
            } = employeeData;

            const directionId = Number(direction_id);
            if (!Number.isInteger(directionId) || directionId <= 0) {
                const error = new Error('Une direction est obligatoire pour créer un employé.');
                error.statusCode = 400;
                throw error;
            }
            const [directions] = await db.query('SELECT id FROM Direction WHERE id = ?', [directionId]);
            if (directions.length === 0) {
                const error = new Error('La direction sélectionnée est introuvable.');
                error.statusCode = 400;
                throw error;
            }

            // Use a constant password for MVP demo (will be communicated to users manually)
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
            
            const employeRoleLeaveValidation = 'employe';
            const employeCanCreateForEmployee = 0;
            const employeIsLeaveResponsible = 0;

            const [result] = await db.query(
                `INSERT INTO Employe (
                    nom, nom_jeune_fille, prenom, email, password, 
                    date_entree, direction_id, departement_id,
                    service_id, matricule, fonction, 
                    can_create_for_employee, role_leave_validation, is_leave_responsible
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
                [
                    nom, nom_jeune_fille || null, prenom, email, hashedPassword,
                    date_entree || new Date(), directionId, departement_id || null,
                    service_id || null, matricule, fonction || null,
                    employeCanCreateForEmployee, employeRoleLeaveValidation, employeIsLeaveResponsible
                ]
            );

            await createLog(
                adminId || result.insertId,
                'CREATE_EMPLOYEE',
                `Création du profil de l'employé ${prenom} ${nom} (${email}) avec le rôle ${employeRoleLeaveValidation}.`
            );

            if (['chef_service', 'chef_departement', 'directeur'].includes(employeRoleLeaveValidation)) {
                await replaceChef(result.insertId, employeRoleLeaveValidation, service_id, departement_id, direction_id);
            }

            // Initialize exercise for the new employee
            const hireDate = date_entree ? new Date(`${date_entree}T00:00:00`) : new Date();
            const year = getExerciseYearForDate(hireDate);
            const balance = calculateInitialBalance(hireDate);
            const [newExercise] = await db.query(
                `INSERT INTO Exercise (emp_id, year, balance, created_at, updated_at) 
                VALUES (?, ?, ?, NOW(), NOW())`,
                [result.insertId, year, balance]
            )
            // insert log
            await createLog(
                result.insertId,
                'CREATE_EXERCISE',
                `Exercice ${year} créé avec un solde initial de ${balance} jour(s).`
            );
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
    },
    async transferChefRole(oldChefId, newEmployeeId, adminId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [employees] = await connection.query(
                `SELECT e.id, e.role_leave_validation, e.is_leave_responsible,
                        e.service_id, COALESCE(e.departement_id, s.departement_id) AS resolved_departement_id,
                        COALESCE(e.direction_id, dep.direction_id, s.direction_id) AS resolved_direction_id
                 FROM Employe e
                 LEFT JOIN Service s ON s.id = e.service_id
                 LEFT JOIN Departement dep ON dep.id = COALESCE(e.departement_id, s.departement_id)
                 WHERE e.id IN (?, ?)
                 FOR UPDATE`,
                [oldChefId, newEmployeeId]
            );
            const oldChef = employees.find((employee) => Number(employee.id) === Number(oldChefId));
            const newEmployee = employees.find((employee) => Number(employee.id) === Number(newEmployeeId));

            if (!oldChef || !newEmployee || Number(oldChefId) === Number(newEmployeeId)) {
                throw new Error('Les deux employés sélectionnés doivent être différents et exister.');
            }

            const unitColumns = {
                chef_service: 'service_id',
                chef_departement: 'resolved_departement_id',
                directeur: 'resolved_direction_id'
            };
            const unitColumn = unitColumns[oldChef.role_leave_validation];
            if (!unitColumn) {
                throw new Error('L’employé sélectionné ne détient pas un rôle de chef transférable.');
            }
            if (newEmployee.role_leave_validation !== 'employe' || Number(newEmployee.is_leave_responsible) === 1) {
                throw new Error('Le remplaçant doit être un employé sans rôle RH.');
            }
            if (!oldChef[unitColumn] || Number(oldChef[unitColumn]) !== Number(newEmployee[unitColumn])) {
                throw new Error('Le remplaçant doit appartenir à la même unité que le chef actuel.');
            }

            await connection.query(
                `UPDATE Employe SET role_leave_validation = 'employe' WHERE id = ?`,
                [oldChefId]
            );
            await connection.query(
                'UPDATE Employe SET role_leave_validation = ? WHERE id = ?',
                [oldChef.role_leave_validation, newEmployeeId]
            );
            const [stepResult] = await connection.query(
                'UPDATE Request_step SET target_id = ? WHERE target_id = ? AND decision IS NULL',
                [newEmployeeId, oldChefId]
            );

            await createLog(
                adminId || oldChefId,
                'TRANSFER_CHEF_ROLE',
                `Transfert du rôle ${oldChef.role_leave_validation} de l’employé ${oldChefId} vers ${newEmployeeId}.`,
                connection
            );
            await connection.commit();

            return {
                oldChefId: Number(oldChefId),
                newEmployeeId: Number(newEmployeeId),
                role: oldChef.role_leave_validation,
                reassignedSteps: stepResult.affectedRows ?? 0
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
};

employServices.DEFAULT_PASSWORD = DEFAULT_PASSWORD;

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