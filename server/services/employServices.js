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
                fonction, 
                adminId // ID of the admin creating this user for logging
            } = employeeData;

            // Use a constant password for MVP demo (will be communicated to users manually)
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
            role = 'employe';
            role_leave_validation = 'employe';
            can_create_for_employee = 0;
            is_leave_responsible = 0;

            const [result] = await db.query(
                `INSERT INTO Employe (
                    nom, nom_jeune_fille, prenom, email, password, 
                    date_entree, role, direction_id, departement_id, 
                    service_id, matricule, fonction, 
                    can_create_for_employee, role_leave_validation, is_leave_responsible
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nom, nom_jeune_fille || null, prenom, email, hashedPassword,
                    date_entree || new Date(), role || 'employe', direction_id || null, departement_id || null,
                    service_id || null, matricule, fonction || null,
                    can_create_for_employee ? 1 : 0, role_leave_validation || 'employe', is_leave_responsible ? 1 : 0
                ]
            );

            await createLog({
                empId: adminId || result.insertId, // Log who created it if provided, else self
                action: 'create_employee',
                requestId: null,
                meta: {
                    role: role || 'employe',
                    newEmployeeId: result.insertId,
                    email: email
                }
            });

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
    }
    
};

module.exports = employServices;