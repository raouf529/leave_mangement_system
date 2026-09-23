/**
 * Shared helper functions for calculations, date management, and data transformations.
 */


function mapRole(role, isLeaveResponsible) {
    if (isLeaveResponsible) return 'hr';
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
        throw new Error('Les dates de début et de fin sont requises.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Les dates de congé sont invalides.');
    }

    if (start > end) {
        throw new Error('La date de début doit être antérieure ou égale à la date de fin.');
    }

    const duration = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (duration <= 0) {
        throw new Error('La durée du congé doit être d’au moins un jour.');
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