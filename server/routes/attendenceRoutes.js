const express =  require('express');
const router = express.Router();
const attendenceController = require('../controllers/attendenceController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/mark', authenticateToken, attendenceController.makeAttendence);
router.get('/my', authenticateToken, attendenceController.getAttendanceByEmployeeId);
module.exports = router;