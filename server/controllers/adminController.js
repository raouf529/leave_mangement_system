const adminServices = require('../services/adminServices');
const backgroundService = require('../services/backgroundService');

const adminController = {
    async getLeaveRequests(req, res) {
        try {
            const employeeId = req.params.employeeId === undefined ? undefined : Number(req.params.employeeId);
            const requests = await adminServices.getLeaveRequests(employeeId);
            res.status(200).json(requests);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async createExercise(req, res) {
        try {
            const exercise = await adminServices.createExercise();
            res.status(201).json({ message: 'Exercise created successfully', exercise });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async createExerciseById(req, res) {
        try {
            const { empId, year, balance } = req.body;
            if (!empId || year === undefined || balance === undefined) {
                return res.status(400).json({ error: 'empId, year, and balance are required' });
            }
            const exercise = await adminServices.createExerciseById({
                empId: Number(empId),
                year: Number(year),
                balance: Number(balance),
            });
            res.status(201).json({ message: 'Exercise created for employee successfully', exercise });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async updateExerciseBalance(req, res) {
        try {
            const { empId, year, balance } = req.body;
            if (empId === undefined || year === undefined || balance === undefined) {
                return res.status(400).json({ error: 'empId, year, and balance are required' });
            }
            const exercise = await adminServices.updateExerciseBalance({ empId: Number(empId), year: Number(year), balance: Number(balance) });
            res.status(200).json(exercise);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async updateLeaveRequest(req, res) {
        try {
            const requestIdOrData = req.body.requestIdOrData !== undefined ? req.body.requestIdOrData : req.body;
            const updateDataParam = req.body.updateDataParam !== undefined ? req.body.updateDataParam : undefined;
            const updatedLeaveRequest = await adminServices.updateLeaveRequest(requestIdOrData, updateDataParam);
            res.status(200).json(updatedLeaveRequest);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async updateRequestStepTarget(req, res) {
        try {
            const { stepId, newRole } = req.body;
            if (stepId === undefined || !newRole) {
                return res.status(400).json({ error: 'stepId and newRole are required' });
            }
            const result = await adminServices.updateRequestStepTarget(Number(stepId), newRole);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async updateRequestStepDecision(req, res) {
        try {
            const { stepId, decision } = req.body;
            if (stepId === undefined || !decision) {
                return res.status(400).json({ error: 'stepId and decision are required' });
            }
            const result = await adminServices.updateRequestStepDecision(Number(stepId), decision);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async updateRequestStep(req, res) {
        try {
            const { stepId, newRole, decision } = req.body;
            if (stepId === undefined) {
                return res.status(400).json({ error: 'stepId is required' });
            }
            if (newRole !== undefined) {
                const result = await adminServices.updateRequestStepTarget(Number(stepId), newRole);
                return res.status(200).json(result);
            }
            if (decision !== undefined) {
                const result = await adminServices.updateRequestStepDecision(Number(stepId), decision);
                return res.status(200).json(result);
            }
            return res.status(400).json({ error: 'newRole or decision is required' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async triggerMonthlyJob(req, res) {
        // Manual fallback in case the server was down when the cron job (1st of the month) should have run.
        try {
            await backgroundService.runMonthlyJob();
            res.status(200).json({ message: 'Monthly exercise job executed successfully' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
};

module.exports = adminController;