const requestService = require('../services/requestServices');
const fs = require('fs');
const path = require('path');

const requestController = {
    async createRequest(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'Vous devez être connecté pour effectuer cette action.' });
            }
            const { startDate, endDate, duration, leaveType, reasonType, justification, url, targetEmployeeId } = req.body;
            const justificationUrl = req.file ? `/uploads/justifications/${req.file.filename}` : url;

            if (!employeeId || !startDate || !endDate || !leaveType) {
                return res.status(400).json({ error: 'Les informations requises pour la demande de congé sont manquantes.' });
            }

            const requestId = await requestService.createRequest({
                employeeId,
                targetEmployeeId,
                startDate,
                endDate,
                duration,
                leaveType,
                reasonType,
                justification,
                url: justificationUrl,
            });

            res.status(201).json({ message: 'Demande de congé créée avec succès.', requestId });
        } catch (error) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            res.status(400).json({ error: error.message });
        }
    },

    async getRequestSteps(req, res) {
        try {
            const { targetId } = req.params;
            const currentUserId = req.user?.id;
            const currentUserRole = req.user?.role;
            const steps = await requestService.getRequestSteps(targetId, currentUserId, currentUserRole);
            res.status(200).json(steps);
        } catch (error) {
            res.status(403).json({ error: error.message });
        }
    },

    async getMyPendingSteps(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Vous devez être connecté pour effectuer cette action.' });
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
                return res.status(400).json({ error: 'La décision est obligatoire.' });
            }

            const result = await requestService.updateRequestStep(
                stepId,
                decision,
                comment ?? '',
                req.user?.id,
                req.user?.role
            );
            res.status(200).json({ message: 'Request step updated successfully', ...result });
        } catch (error) {
            res.status(403).json({ error: error.message });
        }
    },

    async getRequestDetails(req, res) {
        try {
            const { requestId } = req.params;
            const request = await requestService.getRequestDetails(requestId, req.user?.id, req.user?.role);

            if (!request) {
                return res.status(404).json({ error: 'La demande est introuvable.' });
            }

            res.status(200).json(request);
        } catch (error) {
            res.status(403).json({ error: error.message });
        }
    },
    async createTitle(req, res) {
        try {
            const { requestId } = req.params;
            const title = await requestService.createTitle({ requestId });
            res.status(200).json(title);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async downloadTitleDocument(req, res) {
        try {
            const document = await requestService.createTitleDocument({
                requestId: req.params.requestId,
                exerciseId: req.query.exerciseId
            });
            res.setHeader('Content-Type', document.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
            res.send(document.buffer);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async openJustificationDocument(req, res) {
        try {
            const { requestId } = req.params;
            const request = await requestService.getRequestDetails(requestId, req.user?.id, req.user?.role);
            if (!request.url_justification) {
                return res.status(404).json({ error: 'Aucun document justificatif n’a été trouvé.' });
            }

            const filename = path.basename(request.url_justification);
            const filePath = path.join(__dirname, '..', 'uploads', 'justifications', filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Le document justificatif est introuvable.' });
            }

            return res.sendFile(filePath);
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }
    },
    async cancelRequest(req, res) {
        try {
            const { requestId } = req.params;
            const result = await requestService.cancelRequest(requestId, req.user?.id, req.user?.role);
            res.status(200).json({ message: 'Demande annulée avec succès.', ...result });
        } catch (error) {
            res.status(403).json({ error: error.message });
        }
    }
};

module.exports = requestController;