const requestService = require('../services/requsetServices');

const requestController = {
    async createRequest(req, res) {
        try {
            const employeeId = req.user?.id ?? req.body.employeeId;
            const { startDate, duration, leaveType, reasonType, justification, url } = req.body;

            if (!employeeId || !startDate || !duration || !leaveType) {
                return res.status(400).json({ error: 'Missing required request fields' });
            }

            const requestId = await requestService.createRequest({
                employeeId,
                startDate,
                duration,
                leaveType,
                reasonType,
                justification,
                url,
            });

            res.status(201).json({ message: 'Leave request created successfully', requestId });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getRequestSteps(req, res) {
        try {
            const { targetId } = req.params;
            const steps = await requestService.getRequestSteps(targetId);
            res.status(200).json(steps);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getMyPendingSteps(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const steps = await requestService.getPendingStepsForUser(userId);
            res.status(200).json(steps);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateRequestStep(req, res) {
        try {
            const { stepId } = req.params;
            const { decision, comment } = req.body;

            if (!decision) {
                return res.status(400).json({ error: 'Decision is required' });
            }

            const result = await requestService.updateRequestStep(stepId, decision, comment ?? '');
            res.status(200).json({ message: 'Request step updated successfully', ...result });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getRequestDetails(req, res) {
        try {
            const { requestId } = req.params;
            const request = await requestService.getRequestDetails(requestId);

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }

            res.status(200).json(request);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async cancelRequest(req, res) {
        try {
            const { requestId } = req.params;
            const result = await requestService.cancelRequest(requestId);
            res.status(200).json({ message: 'Request cancelled successfully', ...result });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = requestController;