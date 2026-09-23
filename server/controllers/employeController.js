const employServices = require('../services/employServices');

const employeController = {
    async getAllServices(req, res){
        try {
            const services = await employServices.getAllServices();
            res.json(services);
        } catch (error) {
            console.error('Error fetching services:', error);
            res.status(500).json({ error: 'Failed to fetch services' });
        }
    },
    async getAllDepartements(req, res){
        try {
            const departements = await employServices.getAllDepartements();
            res.json(departements);
        } catch (error) {
            console.error('Error fetching departements:', error);
            res.status(500).json({ error: 'Failed to fetch departements' });
        }
    },
    async getAllDirections(req, res){
        try {
            const directions = await employServices.getAllDirections();
            res.json(directions);
        } catch (error) {
            console.error('Error fetching directions:', error);
            res.status(500).json({ error: 'Failed to fetch directions' });
        }
    },
    async createEmployee(req, res){
        try {
            const adminId = req.user ? req.user.id : null;
            const employeeData = { ...req.body, adminId };
            const newEmployeeId = await employServices.createEmployee(employeeData);
            res.status(201).json({ success: true, employeeId: newEmployeeId });
        } catch (error) {
            console.error('Error creating employee:', error);
            res.status(500).json({ error: 'Failed to create employee' });
        }
    }
}

module.exports = employeController;