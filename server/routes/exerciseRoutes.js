const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');

router.get('/:employeeId/all-exercises', exerciseController.getAllExercises);
router.get('/:employeeId/:exercise/all-months', exerciseController.getAllMonths);


module.exports = router;

