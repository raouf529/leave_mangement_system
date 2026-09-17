const adminServices = require('../services/adminServices');

const adminController = {
    async createExercise(req, res) {
        try {
            const { year } = req.body;
            if (!year) {
                return res.status(400).json({ error: 'Year is required' });
            }
            const exercise = await adminServices.createExercise({ year: Number(year) });
            res.status(201).json({ message: 'Exercise created successfully', exercise });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async createExerciseNewEmployee(req, res) {
        try {
            const { empId, year } = req.body;
            if (!empId || !year) {
                return res.status(400).json({ error: 'empId and year are required' });
            }
            const exercise = await adminServices.createExerciseNewEmployee({ empId: Number(empId), year: Number(year) });
            res.status(201).json({ message: 'Exercise created for new employee successfully', exercise });
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
    async updateRequestStep(req, res) {
        try {
            const stepIdOrData = req.body.stepIdOrData !== undefined ? req.body.stepIdOrData : req.body;
            const updateDataParam = req.body.updateDataParam !== undefined ? req.body.updateDataParam : undefined;
            const updatedRequestStep = await adminServices.updateRequestStep(stepIdOrData, updateDataParam);
            res.status(200).json(updatedRequestStep);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
};

module.exports = adminController;
