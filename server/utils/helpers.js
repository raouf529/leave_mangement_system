/**
 * Shared helper functions for calculations, date management, and data transformations.
 */


function mapRole(role) {
    if (role === 'admin') return 'admin';
    if (role === 'drh') return 'hr';
    if (['directeur', 'chef_departement', 'chef_service'].includes(role)) return 'head';
    if (role === 'employe') return 'employee';
    return role;
}

function getRoleLabel(role) {
    const labels = {
        admin: 'Administrateur',
        directeur: 'Directeur',
        chef_departement: 'Chef de département',
        chef_service: 'Chef de service',
        drh: 'Ressources humaines',
        employe: 'Employé'
    };
    return labels[role] ?? role;
}

function getEmployeeUnit(employee) {
    if (employee.service_id !== null && employee.service_id !== undefined) {
        return { id: employee.service_id, name: employee.service_name, type: 'service' };
    }
    if (employee.departement_id !== null && employee.departement_id !== undefined) {
        return { id: employee.departement_id, name: employee.departement_name, type: 'department' };
    }
    if (employee.direction_id !== null && employee.direction_id !== undefined) {
        return { id: employee.direction_id, name: employee.direction_name, type: 'direction' };
    }
    return null;
}

function getExerciseWindowForDate(dateValue) {
    const date = new Date(dateValue ?? Date.now());
    const year = date.getFullYear();
    const currentExerciseYear = date.getMonth() >= 6 ? year : year - 1;

    return {
        date,
        currentExerciseYear,
        nextExerciseYear: currentExerciseYear + 1,
        previousExerciseYear: currentExerciseYear - 1
    };
}

function getExerciseYearForDate(dateValue) {
    return getExerciseWindowForDate(dateValue).currentExerciseYear;
}

function calculateLeaveDuration(startDate, endDate) {
    if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Leave dates must be valid');
    }

    if (start > end) {
        throw new Error('Start date must be before or equal to the end date');
    }

    const duration = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (duration <= 0) {
        throw new Error('Leave duration must be at least one day');
    }

    return duration;
}

function assignBalance(attendanceDays) {
    const attendedDays = Number(attendanceDays) || 0;

    if (attendedDays < 9) {
        return 0;
    }
    if (attendedDays < 15) {
        return 1;
    }
    return 2.5;
}

module.exports = {
    mapRole,
    getRoleLabel,
    getEmployeeUnit,
    getExerciseWindowForDate,
    getExerciseYearForDate,
    calculateLeaveDuration,
    assignBalance
};
