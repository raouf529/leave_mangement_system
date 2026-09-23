const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const requestController = require('../controllers/requestContoller');
const { authenticateToken, authorizeRoles, authorizeRequestAccess, authorizeRequestStepAccess, authorizeRequestTargetAccess } = require('../middleware/authMiddleware');

const router = express.Router();

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'justifications');
fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
	storage: multer.diskStorage({
		destination: uploadDirectory,
		filename: (req, file, callback) => {
			const extension = path.extname(file.originalname).toLowerCase();
			callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
		}
	}),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, callback) => {
		const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
		const extension = path.extname(file.originalname).toLowerCase();
		if (!allowedExtensions.includes(extension)) {
			return callback(new Error('Le document justificatif doit être un fichier PDF, image, DOC ou DOCX.'));
		}
		callback(null, true);
	}
});

function uploadJustification(req, res, next) {
	upload.single('justificationDocument')(req, res, (error) => {
		if (error) {
			return res.status(400).json({ error: error.message });
		}
		next();
	});
}

router.post('/', authenticateToken, uploadJustification, requestController.createRequest);
router.get('/steps/me', authenticateToken, requestController.getMyPendingSteps);
router.get('/steps/:targetId', authenticateToken, authorizeRequestTargetAccess, requestController.getRequestSteps);
router.patch('/step/:stepId', authenticateToken, authorizeRequestStepAccess, requestController.updateRequestStep);
router.get('/:requestId/title', authenticateToken, authorizeRequestAccess, requestController.createTitle);
router.get('/:requestId/title/document', authenticateToken, authorizeRequestAccess, requestController.downloadTitleDocument);
router.get('/:requestId/document', authenticateToken, authorizeRequestAccess, requestController.openJustificationDocument);
router.get('/:requestId', authenticateToken, authorizeRequestAccess, requestController.getRequestDetails);
router.patch('/:requestId/cancel', authenticateToken, authorizeRequestAccess, requestController.cancelRequest);

module.exports = router;


