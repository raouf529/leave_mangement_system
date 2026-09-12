const pool = require('../db');


async function getDirection(unitId) {
    const [rows] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [unitId]);
    if (rows.length === 0) {
        throw new Error(`Unit '${unitId}' not found`);
    }
    while (rows[0].type !== 'direction') {
        const parentId = rows[0].parent_unit_id;
        const [parentRows] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [parentId]);
        if (parentRows.length === 0) {
            throw new Error(`Parent unit '${parentId}' not found`);
        }
        rows[0] = parentRows[0];
    }
    return rows[0];
}
async function getParentUnit(unitId) {
    const [rows] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [unitId]);
    if (rows.length === 0) {
        throw new Error(`Unit '${unitId}' not found`);
    }
    const parentId = rows[0].parent_unit_id;
    if (!parentId) {
        return null; // This unit has no parent
    }
    const [parentRows] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [parentId]);
    if (parentRows.length === 0) {
        throw new Error(`Parent unit '${parentId}' not found`);
    }
    return parentRows[0];
}

async function getHeadingUnit(unitId) {
    const [rows] = await pool.query('SELECT * FROM Employee WHERE unit_id = ? AND role = ?', [unitId, 'head']);
    return rows[0];
}

async function getNextStepOrder(requestId) {
    const [rows] = await pool.query(
        'SELECT COALESCE(MAX(step_order), 0) + 1 AS nextOrder FROM Request_step WHERE request_id = ?',
        [requestId]
    );
    return rows[0].nextOrder;
}

async function forwardRequestToNextStep(requestId, currentlocation_id, decision, comment) {
    //currentlocation_id is the Emp_id of the employee who is currently handling the request
    const [row] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [currentlocation_id]);
    const [unitRow] = await pool.query('SELECT * FROM Org_unit WHERE unit_id = ?', [row[0].unit_id]);
    const nextStepOrder = await getNextStepOrder(requestId);


    if (row[0].role == 'employee') {
        // Forward to the employee's head
        targetUnit = await getHeadingUnit(row[0].unit_id);
        if (!targetUnit) {
            throw new Error(`No head found for unit '${row[0].unit_id}'`);
        }
        await pool.query(
          'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
          [requestId, nextStepOrder, targetUnit.Emp_id, decision, comment, null]
        );
    }
    else if (row[0].role == 'head' && unitRow[0].type !== 'direction') {
        // Forward to the head of the parent unit
        parentUnit = await getParentUnit(unitRow[0].unit_id);
        if (!parentUnit) {
            throw new Error(`No parent unit found for unit '${unitRow[0].unit_id}'`);
        }
        targetUnit = await getHeadingUnit(parentUnit.unit_id);
        if (!targetUnit) {
            throw new Error(`No head found for parent unit '${parentUnit.unit_id}'`);
        }
        await pool.query(
          'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
          [requestId, nextStepOrder, targetUnit.Emp_id, decision, comment, null]
        );
    }
    else if (row[0].role == 'head' && unitRow[0].type == 'direction') {
        // Forward to HR
        const [hrRows] = await pool.query('SELECT * FROM Employee WHERE role = ? AND unit_id = ?', ['hr', unitRow[0].unit_id]);
        if (hrRows.length === 0) {
            throw new Error(`No HR employee found for unit '${unitRow[0].unit_id}'`);
        }
        targetUnit = hrRows[0];
        await pool.query(
          'INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at) VALUES (?, ?, ?, ?, ?, ?)',
          [requestId, nextStepOrder, targetUnit.Emp_id, decision, comment, null]
        );
    }
    return targetUnit;
}
const requestService = {
  async createRequest({ employeeId, startDate, duration, leaveType, reasonType, justification, url, exercise = String(new Date().getFullYear()) }) {
    const [result] = await pool.query(
      'INSERT INTO Leave_request (Emp_id, exercise, leave_type, start_date, duration, reason_type, justification, url_justification, request_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, exercise, leaveType, startDate, duration, reasonType ?? null, justification ?? null, url ?? null, 'pending']
    );
    // after creating requsest, we need to create the first step for the request, which is to send it to the employee's head
    const [employeeRows] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [employeeId]);
    if (employeeRows.length === 0) {
      throw new Error(`Employee '${employeeId}' not found`);
    }
    // to avoid floos of request, we check if the employee already has pending request, if so we throw an error
    const [pendingRequests] = await pool.query(
      'SELECT * FROM Leave_request WHERE Emp_id = ? AND request_status = ?',
        [employeeId, 'pending']
    );
    if (pendingRequests.length > 0) {
      throw new Error(`Employee '${employeeId}' already has a pending request`);
    }
    await forwardRequestToNextStep(result.insertId, employeeId, null, null);
    return result.insertId;
  },
  async getRequestSteps(targetId) {
    const [steps] = await pool.query('SELECT * FROM Request_step WHERE target_id = ?', [targetId]);
    return steps;
  },
  async getPendingStepsForUser(userId) {
    const [steps] = await pool.query(
      `SELECT rs.*, lr.start_date, lr.duration, lr.leave_type, lr.justification, lr.reason_type, lr.request_status,
              e.First_name, e.Last_name, e.email
       FROM Request_step rs
       JOIN Leave_request lr ON lr.request_id = rs.request_id
       JOIN Employee e ON e.Emp_id = lr.Emp_id
       WHERE rs.target_id = ? AND (rs.decision IS NULL OR rs.decision = '') AND lr.request_status = 'pending'`,
      [userId]
    );
    return steps;
  },
 async updateRequestStep(stepId, decision, comment) {
    if (decision !== 'approved' && decision !== 'rejected') {  
        throw new Error(`Invalid decision '${decision}'. Must be 'approved' or 'rejected'.`);
    }
    [stepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
    [targetRows] = await pool.query('SELECT * FROM Employee WHERE Emp_id = ?', [stepRows[0].target_id]);
    if (stepRows.length === 0) {
        throw new Error(`Request step '${stepId}' not found`);
    }
    if (decision === 'approved') {
        if(targetRows[0].role=='hr'){
            // if role is hr, then we need to update the request status to approved
            await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['approved', stepRows[0].request_id]);
            return { requestId: stepRows[0].request_id, message: 'Request approved and marked as completed' };
        }
        else {
            await pool.query('UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?', [decision, comment, stepId]);
            // Get the request_id and currentlocation_id for the step
            const [stepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
            if (stepRows.length === 0) {
                throw new Error(`Request step '${stepId}' not found`);
            }
            const requestId = stepRows[0].request_id;
            //forward the request to the next step
            const targetUnit = await forwardRequestToNextStep(requestId, stepRows[0].target_id, null, null);
            return { requestId, targetUnit };
        }
    }
    else {
        await pool.query('UPDATE Request_step SET decision = ?, comment = ?, decided_at = NOW() WHERE step_id = ?', [decision, comment, stepId]);
        // Get the request_id for the step
        const [stepRows] = await pool.query('SELECT * FROM Request_step WHERE step_id = ?', [stepId]);
        if (stepRows.length === 0) {
            throw new Error(`Request step '${stepId}' not found`);
        }
        const requestId = stepRows[0].request_id;
        // Update the request status to 'rejected'
        await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['rejected', requestId]);
        return { requestId };
    }
 },
 async cancelRequest(requestId) {
    // Update the request status to 'cancelled'
    await pool.query('UPDATE Leave_request SET request_status = ? WHERE request_id = ?', ['cancelled', requestId]);
    return { requestId, message: 'Request cancelled successfully' };
  },
  async getRequestDetails(requestId) {
    const [requestRows] = await pool.query('SELECT * FROM Leave_request WHERE request_id = ?', [requestId]);
    return requestRows[0];
  }
};
module.exports = requestService;