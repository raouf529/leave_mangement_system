const bcrypt = require('bcrypt');
const pool = require('./db');
const { assignBalance } = require('./utils/helpers');

const DEFAULT_PASSWORD = 'Passw0rd!';

async function reset(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['Notification', 'Request_exercise_allocation', 'Request_step', 'Leave_request', 'Exercise', 'Employe', 'Service', 'Departement', 'Direction']) {
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
  const insertService = async (nom, departementKey) => {
    const [result] = await conn.query(
      'INSERT INTO Service (nom, departement_id) VALUES (?, ?)',
      [nom, departements[departementKey]]
    );
    services[nom] = result.insertId;
  };

  await insertDirection('Direction Générale');
  await insertDepartement('Département RH', 'Direction Générale');
  await insertDepartement('Département IT', 'Direction Générale');
  await insertService('Section Recrutement', 'Département RH');
  await insertService('Section Paie', 'Département RH');
  await insertService('Section Dev', 'Département IT');
  await insertService('Section Infra', 'Département IT');

  return { directions, departements, services };
}

async function seedEmployees(conn, org) {
  const emp = {};
  const hashedPw = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // level: which of direction_id/departement_id/service_id gets set for this person
  // canCreate: value of can_create_for_employee (right given by the admin to create a request for an employee under them)

  const roster = [
    { key: 'dg',       first: 'Karim',   last: 'Benali',     email: 'karim.benali@corp.dz',      role: 'directeur',       level: 'direction',   unit: 'Direction Générale',  date: '2015-01-12' },
    { key: 'deptRH',   first: 'Amina',   last: 'Toumi',      email: 'amina.toumi@corp.dz',        role: 'chef_departement', level: 'departement', unit: 'Département RH',       date: '2016-03-01' },
    { key: 'deptIT',   first: 'Yacine',  last: 'Merabet',    email: 'yacine.merabet@corp.dz',     role: 'chef_departement', level: 'departement', unit: 'Département IT',       date: '2016-06-20', canCreate: true },
    { key: 'secRecru', first: 'Sofia',   last: 'Haddad',     email: 'sofia.haddad@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Recrutement', date: '2018-02-15', canCreate: true },
    { key: 'secPaie',  first: 'Riad',    last: 'Belkacem',   email: 'riad.belkacem@corp.dz',      role: 'chef_service',    level: 'service',     unit: 'Section Paie',   date: '2018-04-10' },
    { key: 'secDev',   first: 'Nadia',   last: 'Cherif',     email: 'nadia.cherif@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Dev',      date: '2017-09-05', canCreate: true },
    { key: 'secInfra', first: 'Farid',   last: 'Boumediene', email: 'farid.boumediene@corp.dz',   role: 'chef_service',    level: 'service',     unit: 'Section Infra',       date: '2017-11-22' },
    { key: 'hr',       first: 'Lina',    last: 'Zerrouki',   email: 'lina.zerrouki@corp.dz',      role: 'drh',             level: 'direction',   unit: 'Direction Générale',   date: '2019-01-08' },
    { key: 'admin',    first: 'Yasmine', last: 'Kaci',       email: 'yasmine.kaci@corp.dz',       role: 'admin',           level: 'direction',   unit: 'Direction Générale',  date: '2015-01-05' },
    { key: 'e1', first: 'Mounir',  last: 'Saidi',    email: 'mounir.saidi@corp.dz',    role: 'employe', level: 'service', unit: 'Section Recrutement',  date: '2021-03-01' },
    { key: 'e2', first: 'Amel',    last: 'Bouzid',   email: 'amel.bouzid@corp.dz',     role: 'employe', level: 'service', unit: 'Section Recrutement',  date: '2022-05-14' },
    { key: 'e3', first: 'Walid',   last: 'Ammar',    email: 'walid.ammar@corp.dz',     role: 'employe', level: 'service', unit: 'Section Paie',  date: '2020-09-19' },
    { key: 'e4', first: 'Nesrine', last: 'Kaddour',  email: 'nesrine.kaddour@corp.dz', role: 'employe', level: 'service', unit: 'Section Paie',  date: '2021-11-02' },
    { key: 'e5', first: 'Hicham',  last: 'Bendaoud', email: 'hicham.bendaoud@corp.dz', role: 'employe', level: 'service', unit: 'Section Dev',   date: '2020-06-23' },
    { key: 'e6', first: 'Sarah',   last: 'Ouali',    email: 'sarah.ouali@corp.dz',     role: 'employe', level: 'service', unit: 'Section Dev',  date: '2022-01-17' },
    { key: 'e7', first: 'Bilal',   last: 'Rahmani',  email: 'bilal.rahmani@corp.dz',   role: 'employe', level: 'service', unit: 'Section Infra', date: '2021-08-09' },
    { key: 'e8', first: 'Sami',    last: 'Grine',    email: 'sami.grine@corp.dz',      role: 'employe', level: 'service', unit: 'Section Infra', date: '2023-02-10' },
    { key: 'e9', first: 'Meriem',  last: 'Larbi',    email: 'meriem.larbi@corp.dz',    role: 'employe', level: 'service', unit: 'Section Dev',   date: '2026-08-23' },
  ];

  for (const [index, p] of roster.entries()) {
    const directionId = p.level === 'direction' ? org.directions[p.unit] : null;
    const departementId = p.level === 'departement' ? org.departements[p.unit] : null;
    const serviceId = p.level === 'service' ? org.services[p.unit] : null;

    const [result] = await conn.query(
      `INSERT INTO Employe (nom, nom_jeune_fille, prenom, email, password, date_entree, role, direction_id, departement_id, service_id, matricule, can_create_for_employee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.last, p.last, p.first, p.email, hashedPw, p.date, p.role, directionId, departementId, serviceId, 1001 + index, p.canCreate ? 1 : 0]
    );
    emp[p.key] = result.insertId;
  }

  return emp;
}

async function seedExercise(conn, emp) {
  const exercises = {};
  for (const key of Object.keys(emp)) {
    if (key === 'e9') {
      const [r2026] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance, created_at) VALUES (?, ?, ?, ?)', [emp[key], 2026, assignBalance(16) + 2.5, '2026-08-16']);
      exercises[key] = { 2026: r2026.insertId };
      continue;
    }
    const balances = key === 'e8' ? { 2024: 0, 2025: 0, 2026: 7.0 } : { 2024: 5, 2025: 30, 2026: 7.0 };
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
      const exerciseId = exercises[r.emp][r.exercise];
      const [exerciseRows] = await conn.query('SELECT balance FROM Exercise WHERE exercise_id = ?', [exerciseId]);
      const remainingAfter = Number(exerciseRows[0]?.balance ?? 0) - Number(r.duration);
      await conn.query(
        'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated, remaining_after) VALUES (?, ?, ?, ?)',
        [result.insertId, exerciseId, r.duration, remainingAfter]
      );
    }
  }

  // Chains stop at the current pending step. A bypass keeps the skipped target step
  // and adds the bypassing approver's own decision step.
  const steps = [
    // r1: waiting for the chef de service
    ['r1', [['secRecru', null, null, null]]],
    // r2: fully approved through the DRH
    ['r2', [['secRecru', 'approved', '2026-09-18 09:00:00', 'OK'], ['deptRH', 'approved', '2026-09-18 14:00:00', 'OK'], ['dg', 'approved', '2026-09-19 09:00:00', 'Validated'], ['hr', 'approved', '2026-09-19 10:00:00', 'Final approval']]],
    // r3: rejected by the chef de service
    ['r3', [['secPaie', 'rejected', '2026-09-14 11:00:00', 'Insufficient notice']]],
    // r4: chef de service approved, waiting for the chef de département
    ['r4', [['secPaie', 'approved', '2026-10-25 10:00:00', 'OK'], ['deptRH', null, null, null]]],
    // r5: approved by everyone, then cancelled by the employee
    ['r5', [['secDev', 'approved', '2026-11-20 10:00:00', 'OK'], ['deptIT', 'approved', '2026-11-20 11:00:00', 'OK'], ['dg', 'approved', '2026-11-20 12:00:00', 'Approved then cancelled by employee'], ['hr', 'approved', '2026-11-20 13:00:00', 'Final approval']]],
    // r6: bypass approved by the chef de département, waiting for the directeur
    ['r6', [['secDev', 'skipped', '2026-08-25 09:00:00', null], ['deptIT', 'approved', '2026-08-25 09:00:00', 'Approved directly by department head'], ['dg', null, null, null]]],
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