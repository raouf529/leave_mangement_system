const bcrypt = require('bcrypt');
const pool = require('./db');
const { assignBalance } = require('./utils/helpers');

const DEFAULT_PASSWORD = 'Passw0rd!';

async function reset(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['Logs', 'Notification', 'Request_exercise_allocation', 'Request_step', 'Leave_request', 'Exercise', 'Employe', 'Service', 'Departement', 'Direction']) {
    await conn.query(`TRUNCATE TABLE ${table}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function seedOrgStructure(conn) {
  const directions = {};
  const departements = {};
  const services = {};

  const insertDirection = async (nom) => {
    const [result] = await conn.query('INSERT INTO Direction (nom) VALUES (?)', [nom]);
    directions[nom] = result.insertId;
  };
  const insertDepartement = async (nom, directionKey) => {
    const [result] = await conn.query(
      'INSERT INTO Departement (nom, direction_id) VALUES (?, ?)',
      [nom, directions[directionKey]]
    );
    departements[nom] = result.insertId;
  };
  const insertService = async (nom, departementKey, directionKey) => {
    const [result] = await conn.query(
      'INSERT INTO Service (nom, direction_id, departement_id) VALUES (?, ?, ?)',
      [nom, directions[directionKey], departements[departementKey]]
    );
    services[nom] = result.insertId;
  };

  await insertDirection('Direction RH');
  await insertDirection('Direction IT');
  await insertDepartement('Département RH', 'Direction RH');
  await insertDepartement('Département IT', 'Direction IT');
  await insertService('Section Recrutement', 'Département RH', 'Direction RH');
  await insertService('Section Paie', 'Département RH', 'Direction RH');
  await insertService('Section Dev', 'Département IT', 'Direction IT');
  await insertService('Section Infra', 'Département IT', 'Direction IT');

  return { directions, departements, services };
}

async function seedEmployees(conn, org) {
  const emp = {};
  const hashedPw = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // level: which of direction_id/departement_id/service_id gets set for this person
  // canCreate: value of can_create_for_employee (right given by the admin to create a request for an employee under them)

  const roster = [
    { key: 'dirRH',    first: 'Khadija', last: 'Benali',     email: 'khadija.benali@corp.dz',    role: 'directeur',       level: 'direction',   unit: 'Direction RH',        date: '2015-01-12', fonction: 'Directrice RH',                 roleValidation: 'directeur' },
    { key: 'dirIT',    first: 'Karim',   last: 'Merabet',    email: 'karim.merabet@corp.dz',     role: 'directeur',       level: 'direction',   unit: 'Direction IT',        date: '2015-02-15', fonction: 'Directeur IT',                  roleValidation: 'directeur' },
    { key: 'deptRH',   first: 'Amina',   last: 'Toumi',      email: 'amina.toumi@corp.dz',        role: 'chef_departement', level: 'departement', unit: 'Département RH',       date: '2016-03-01', fonction: 'Chef de Département RH',          roleValidation: 'chef_departement' },
    { key: 'deptIT',   first: 'Yacine',  last: 'Mansouri',   email: 'yacine.mansouri@corp.dz',    role: 'chef_departement', level: 'departement', unit: 'Département IT',       date: '2016-06-20', fonction: 'Chef de Département IT',          roleValidation: 'chef_departement', canCreate: true },
    { key: 'secRecru', first: 'Sofia',   last: 'Haddad',     email: 'sofia.haddad@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Recrutement', date: '2018-02-15', fonction: 'Chef de Service Recrutement',     roleValidation: 'chef_service', canCreate: true },
    { key: 'secPaie',  first: 'Riad',    last: 'Belkacem',   email: 'riad.belkacem@corp.dz',      role: 'chef_service',    level: 'service',     unit: 'Section Paie',        date: '2018-04-10', fonction: 'Chef de Service Paie',             roleValidation: 'chef_service' },
    { key: 'secDev',   first: 'Nadia',   last: 'Cherif',     email: 'nadia.cherif@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Dev',         date: '2017-09-05', fonction: 'Chef de Service Dev',              roleValidation: 'chef_service', canCreate: true },
    { key: 'secInfra', first: 'Farid',   last: 'Boumediene', email: 'farid.boumediene@corp.dz',   role: 'chef_service',    level: 'service',     unit: 'Section Infra',       date: '2017-11-22', fonction: 'Chef de Service Infra',            roleValidation: 'chef_service' },
    { key: 'hr',       first: 'Lina',    last: 'Zerrouki',   email: 'lina.zerrouki@corp.dz',      role: 'drh',             level: 'direction',   unit: 'Direction RH',        date: '2019-01-08', fonction: 'Directrice des Ressources Humaines', roleValidation: 'directeur', isLeaveResponsible: true },
    { key: 'admin',    first: 'Yasmine', last: 'Kaci',       email: 'yasmine.kaci@corp.dz',       role: 'admin',           level: 'direction',   unit: 'Direction IT',        date: '2015-01-05', fonction: 'Administrateur système',           roleValidation: 'admin' },
    { key: 'e1', first: 'Mounir',  last: 'Saidi',    email: 'mounir.saidi@corp.dz',    role: 'employe', level: 'service', unit: 'Section Recrutement',  date: '2021-03-01', fonction: 'Chargé de Recrutement' },
    { key: 'e2', first: 'Amel',    last: 'Bouzid',   email: 'amel.bouzid@corp.dz',     role: 'employe', level: 'service', unit: 'Section Recrutement',  date: '2022-05-14', fonction: 'Chargée de Recrutement' },
    { key: 'e3', first: 'Walid',   last: 'Ammar',    email: 'walid.ammar@corp.dz',     role: 'employe', level: 'service', unit: 'Section Paie',         date: '2020-09-19', fonction: 'Gestionnaire de Paie' },
    { key: 'e4', first: 'Nesrine', last: 'Kaddour',  email: 'nesrine.kaddour@corp.dz', role: 'employe', level: 'service', unit: 'Section Paie',         date: '2021-11-02', fonction: 'Gestionnaire de Paie' },
    { key: 'e5', first: 'Hicham',  last: 'Bendaoud', email: 'hicham.bendaoud@corp.dz', role: 'employe', level: 'service', unit: 'Section Dev',          date: '2020-06-23', fonction: 'Développeur Full Stack' },
    { key: 'e6', first: 'Sarah',   last: 'Ouali',    email: 'sarah.ouali@corp.dz',     role: 'employe', level: 'service', unit: 'Section Dev',          date: '2022-01-17', fonction: 'Développeuse Front-end' },
    { key: 'e7', first: 'Bilal',   last: 'Rahmani',  email: 'bilal.rahmani@corp.dz',   role: 'employe', level: 'service', unit: 'Section Infra',        date: '2021-08-09', fonction: 'Ingénieur Système' },
    { key: 'e8', first: 'Sami',    last: 'Grine',    email: 'sami.grine@corp.dz',      role: 'employe', level: 'service', unit: 'Section Infra',        date: '2023-02-10', fonction: 'Ingénieur Réseau' },
    { key: 'e9', first: 'Meriem',  last: 'Larbi',    email: 'meriem.larbi@corp.dz',    role: 'employe', level: 'service', unit: 'Section Dev',          date: '2026-09-10', fonction: 'Stagiaire Développeuse' },
    { key: 'e10', first: 'Amine', last: 'Ferhat',    email: 'amine.ferhat@corp.dz',    role: 'employe', level: 'departement', unit: 'Département RH',   date: '2020-04-12', fonction: 'Assistant RH' },
    { key: 'e11', first: 'Lydia', last: 'Mansouri',  email: 'lydia.mansouri@corp.dz',  role: 'employe', level: 'departement', unit: 'Département IT',   date: '2021-07-03', fonction: 'Technicienne IT' },
    { key: 'dg', first: 'Karim', last: 'Benali', email: 'karim.benali@corp.dz', role: 'dg', level: 'none', unit: null, date: '2014-01-06', fonction: 'Directeur Général', roleValidation: 'dg' },
  ];

  for (const [index, p] of roster.entries()) {
    const directionId = p.level === 'direction' ? org.directions[p.unit] : null;
    const departementId = p.level === 'departement' ? org.departements[p.unit] : null;
    const serviceId = p.level === 'service' ? org.services[p.unit] : null;

    const roleValidation = p.roleValidation || 'employe';
    const isLeaveResp = p.isLeaveResponsible ? 1 : 0;
    const fonction = p.fonction || null;

    // For service-based employees, keep service_id populated.
    // For department/direction employees, attach directly to the parent unit and leave service_id null.
    const [result] = await conn.query(
      `INSERT INTO Employe (nom, nom_jeune_fille, prenom, email, password, date_entree, direction_id, departement_id, service_id, matricule, fonction, can_create_for_employee, role_leave_validation, is_leave_responsible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.last, p.last, p.first, p.email, hashedPw, p.date, directionId, departementId, serviceId, 1001 + index, fonction, p.canCreate ? 1 : 0, roleValidation, isLeaveResp]
    );
    emp[p.key] = result.insertId;
  }

  return emp;
}

async function seedExercise(conn, emp) {
  const exercises = {};
  for (const key of Object.keys(emp)) {
    if (key === 'e9') {
      exercises[key] = null;
      continue;
    }
    const balances = key === 'e8' ? { 2024: 0, 2025: 0, 2026: 7.0 } :  { 2024: 5, 2025: 30, 2026: 7.0 };
    const [r2024] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, ?)', [emp[key], 2024, balances[2024], '2024-07-01']);
    const [r2025] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, ?)', [emp[key], 2025, balances[2025], '2025-07-01']);
    const [r2026] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, ?)', [emp[key], 2026, balances[2026], '2026-07-01']);
    exercises[key] = { 2024: r2024.insertId, 2025: r2025.insertId, 2026: r2026.insertId };
  }
  return exercises;
}

async function seedLeaveRequestsAndSteps(conn, emp, exercises) {
  // createdBy: only set when a chef created the request for the employee (otherwise the employee created it)
  const requests = [
    { key: 'r1', emp: 'e1', exercise: 2026, type: 'annual',      start: '2026-10-05', duration: 5,  status: 'pending',   created_at: '2026-08-01 10:00:00' },
    { key: 'r2', emp: 'e2', exercise: 2026, type: 'annual',      start: '2026-09-20', duration: 3,  status: 'approved',  created_at: '2026-08-05 11:30:00' },
    { key: 'r3', emp: 'e3', exercise: 2026, type: 'exceptional', start: '2026-09-15', duration: 2,  status: 'rejected',  reason: 'family_event', justification: 'Family emergency', created_at: '2026-08-10 09:15:00' },
    { key: 'r4', emp: 'e4', exercise: 2025, type: 'advance',     start: '2026-11-01', duration: 4,  status: 'pending',   created_at: '2026-08-15 14:00:00' },
    { key: 'r5', emp: 'e5', exercise: 2026, type: 'annual',      start: '2026-12-10', duration: 7,  status: 'cancelled', created_at: '2026-08-20 16:45:00' },
    { key: 'r6', emp: 'e6', exercise: 2026, type: 'annual',      start: '2026-09-01', duration: 10, status: 'approved',  created_at: '2026-08-22 08:30:00' },
    { key: 'r7', emp: 'e7', exercise: 2026, type: 'exceptional', start: '2026-09-22', duration: 1,  status: 'pending',   reason: 'medical', justification: 'Doctor appointment', created_at: '2026-08-25 12:00:00' },
    { key: 'r8', emp: 'e8', exercise: 2026, type: 'exceptional', start: '2026-09-28', duration: 2,  status: 'pending',   reason: 'family_event', justification: 'Family event', created_at: '2026-09-16 10:00:00' },
    { key: 'r9', emp: 'e2', createdBy: 'secRecru', exercise: 2026, type: 'annual', start: '2026-10-12', duration: 4, status: 'pending', created_at: '2026-09-18 09:30:00' },
  ];

  const requestIds = {};
  for (const r of requests) {
    const [result] = await conn.query(
      `INSERT INTO Leave_request (Emp_id, created_by, exercise, leave_type, start_date, duration, reason_type, justification, request_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp[r.emp], r.createdBy ? emp[r.createdBy] : null, r.exercise, r.type, r.start, r.duration, r.reason || null, r.justification || null, r.status, r.created_at]
    );
    requestIds[r.key] = result.insertId;

    if (r.type === 'annual') {
      const [exerciseRows] = await conn.query(
        `SELECT exercise_id, year, balance
         FROM Exercise
         WHERE Emp_id = ? AND year != ? AND balance > 0
         ORDER BY year ASC`,
        [emp[r.emp], r.exercise]
      );

      let remainingDuration = Number(r.duration);
      for (const exercise of exerciseRows) {
        if (remainingDuration <= 0) break;

        const daysAllocated = Math.min(remainingDuration, Number(exercise.balance));
        const remainingAfter = Number(exercise.balance) - daysAllocated;
        await conn.query(
          'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated, remaining_after) VALUES (?, ?, ?, ?)',
          [result.insertId, exercise.exercise_id, daysAllocated, remainingAfter]
        );
        remainingDuration -= daysAllocated;
      }

      if (remainingDuration > 0) {
        throw new Error(`Seed request ${r.key} has insufficient exercise balance.`);
      }
    }
  }

  // Chains stop at the current pending step. A bypass keeps the skipped target step
  // and adds the bypassing approver's own decision step.
  const steps = [
    // r1: waiting for the chef de service
    ['r1', [['secRecru', null, null, null]]],
    // r2: fully approved through the DRH (RH branch -> dirRH)
    ['r2', [['secRecru', 'approved', '2026-09-18 09:00:00', 'OK'], ['deptRH', 'approved', '2026-09-18 14:00:00', 'OK'], ['dirRH', 'approved', '2026-09-19 09:00:00', 'Validated'], ['hr', 'approved', '2026-09-19 10:00:00', 'Final approval']]],
    // r3: rejected by the chef de service
    ['r3', [['secPaie', 'rejected', '2026-09-14 11:00:00', 'Insufficient notice']]],
    // r4: chef de service approved, waiting for the chef de département
    ['r4', [['secPaie', 'approved', '2026-10-25 10:00:00', 'OK'], ['deptRH', null, null, null]]],
    // r5: approved by everyone, then cancelled by the employee (IT branch -> dirIT)
    ['r5', [['secDev', 'approved', '2026-11-20 10:00:00', 'OK'], ['deptIT', 'approved', '2026-11-20 11:00:00', 'OK'], ['dirIT', 'approved', '2026-11-20 12:00:00', 'Approved then cancelled by employee'], ['hr', 'approved', '2026-11-20 13:00:00', 'Final approval']]],
    // r6: bypass approved by the chef de département, waiting for the directeur (IT branch -> dirIT)
    ['r6', [['secDev', 'skipped', '2026-08-25 09:00:00', null], ['deptIT', 'approved', '2026-08-25 09:00:00', 'Approved directly by department head'], ['dirIT', null, null, null]]],
    // r7: waiting for the chef de service
    ['r7', [['secInfra', null, null, null]]],
    // r8: bypass rejection by the chef de département
    ['r8', [['secInfra', 'skipped', '2026-09-17 15:00:00', null], ['deptIT', 'rejected', '2026-09-17 15:00:00', 'Rejected directly by department head']]],
    // r9: created by the chef de service for the employee, waiting for that chef
    ['r9', [['secRecru', null, null, null]]],
  ];

  for (const [reqKey, chain] of steps) {
    let order = 1;
    for (const [targetKey, decision, decidedAt, comment] of chain) {
      await conn.query(
        `INSERT INTO Request_step (request_id, step_order, target_id, decision, comment, decided_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [requestIds[reqKey], order, emp[targetKey], decision, comment, decidedAt]
      );
      order++;
    }
  }
}

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Resetting tables...');
    await reset(conn);
    console.log('Seeding org structure...');
    const org = await seedOrgStructure(conn);
    console.log('Seeding employees...');
    const emp = await seedEmployees(conn, org);
    console.log('Seeding exercise balances...');
    const exercises = await seedExercise(conn, emp);
    console.log('Seeding leave requests + steps...');
    await seedLeaveRequestsAndSteps(conn, emp, exercises);
    console.log('Seed complete');
    console.log(`Login for any seeded user: <email> / ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

seed();