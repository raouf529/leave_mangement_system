const profileServices = require('../services/profileServices');

const profileController = {
    async getProfile(req, res) {
        try {
            const userId = req.params && req.params.id ? req.params.id : req.user.id;
            const profile = await profileServices.getEmployeeProfile(userId);
            res.status(200).json(profile);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updates = req.body; 
            const updatedProfile = await profileServices.updateEmployeeProfile(userId, updates);
            res.status(200).json(updatedProfile);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getUnderemployees(req, res) {
        try {
            const userId = req.user.id;
            const underemployees = await profileServices.getUnderemployees(userId);
            res.status(200).json(underemployees);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async getAllEmployees(req, res) {
        try {
            const employees = await profileServices.getAllEmployees();
            res.status(200).json(employees);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = profileController;