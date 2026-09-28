const ExerciseService = require('../services/exerciseServices');

const exerciseController = {
    async getAllMonths(req, res) {
        try {
            const { employeeId, exercise } = req.params;
            const months = await ExerciseService.getAllMonths(employeeId, exercise);
            res.status(200).json(months);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async getAllExercises(req, res) {
        try {
            const exercises = await ExerciseService.getAllExercises();
            res.status(200).json(exercises);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = exerciseController;
