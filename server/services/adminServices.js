const pool = require('../db');
const { assignBalance, getExerciseWindowForDate } = require('../utils/helpers');

const adminServices = {
    async createExercise({ year }){
        // create exercise manually in case problem in server happen don't allow crone work correctly
        try {
            const [employees] = await pool.query(`SELECT id FROM Employe`);
            for (const employee of employees){
                const [existingExercise] = await pool.query(
                    `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                    [employee.id, year]
                );
                if (existingExercise.length === 0){
                    await pool.query(
                        `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, 0)`,
                        [employee.id, year]
                    );
                }
            }
        } catch (error){
            throw new Error('Error creating new exercise: ' + error.message);
        }
    },
    async createExerciseNewEmployee({empId, year}){
        // create exercise manually for new employee in case problem in server happen don't allow crone work correctly
        try {
            const [existingExercise] = await pool.query(
                `SELECT exercise_id FROM Exercise WHERE Emp_id = ? AND year = ?`,
                [empId, year]
            );
            if (existingExercise.length === 0){
                await pool.query(
                    `INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, 0)`,
                    [empId, year]
                );
            }

            // Get employee info
            const [employee] = await pool.query(
                `SELECT date_entree FROM Employe WHERE id = ?`,
                [empId]
            );

            if (!employee || employee.length === 0) {
                throw new Error(`Employee not found: ${empId}`);
            }

            const hireDate = new Date(employee[0].date_entree);
            const now = new Date();
            const isNewEmployee = (
                hireDate.getFullYear() === year &&
                hireDate.getMonth() >= 6
            );

            if (isNewEmployee) {
                const diffTime = Math.max(0, now - hireDate);
                const attendedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const balanceToAdd = assignBalance(attendedDays);

                await pool.query(
                    `UPDATE Exercise SET balance = balance + ? WHERE Emp_id = ? AND year = ?`,
                    [balanceToAdd, empId, year]
                );
            }
        } catch (error){
            throw new Error('Error creating new exercise: ' + error.message);
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
                throw new Error(`Leave request not found: ${requestId}`);
            }

            const [updatedRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
            return updatedRows[0];
        } catch (error) {
            throw new Error('Error updating leave request: ' + error.message);
        }
    },
    async updateRequestStep(stepIdOrData, updateDataParam) {
        // Update possible fields in Request_step
        try {
            let stepId;
            let updateData;

            if (typeof stepIdOrData === 'object' && stepIdOrData !== null) {
                const { stepId: stId, id, ...rest } = stepIdOrData;
                stepId = stId || id;
                updateData = updateDataParam || rest;
            } else {
                stepId = stepIdOrData;
                updateData = updateDataParam || {};
            }

            if (!stepId) {
                throw new Error('stepId is required for updating request step');
            }

            const allowedFields = [
                'request_id', 'step_order', 'target_id', 'decision', 'comment', 'decided_at'
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

            values.push(stepId);
            const query = `UPDATE Request_step SET ${fieldsToUpdate.join(', ')} WHERE step_id = ?`;
            const [result] = await pool.query(query, values);

            if (result.affectedRows === 0) {
                throw new Error(`Request step not found: ${stepId}`);
            }

            const [updatedRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
            return updatedRows[0];
        } catch (error) {
            throw new Error('Error updating request step: ' + error.message);
        }
    }
};

module.exports = adminServices;