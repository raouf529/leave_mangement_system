const attendenceServices = require('../services/attendenceServices');

const attendenceController = {
    async getAttendanceByEmployeeId(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const attendance = await attendenceServices.getAttendanceByEmployeeId(employeeId);
            res.json(attendance);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async makeAttendence(req, res) {
        try {
            const employeeId = req.user?.id;
            if (!employeeId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { date, status } = req.body;
            await attendenceServices.makeAttendence(employeeId, date, status);
            res.json({ message: 'Attendance recorded successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};