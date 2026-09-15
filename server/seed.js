const bcrypt = require('bcrypt');
const pool = require('./db');

const DEFAULT_PASSWORD = 'Passw0rd!';

async function reset(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['Request_exercise_allocation', 'Request_step', 'Leave_request', 'Exercise', 'Attendance', 'Employe', 'Service', 'Departement', 'Direction']) {
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
  // forward_drh = true only for department/direction level heads
  // NOTE: the new role enum (directeur/chef_departement/chef_service/drh/employe) has
  // no 'admin' value — 'admin' below is mapped to 'drh' as a placeholder until you decide
  // how the admin actor is represented against the external table.
  const roster = [
    { key: 'dg',       first: 'Karim',   last: 'Benali',     email: 'karim.benali@corp.dz',      role: 'directeur',       level: 'direction',   unit: 'Direction Générale',  drh: true,  date: '2015-01-12' },
    { key: 'deptRH',   first: 'Amina',   last: 'Toumi',      email: 'amina.toumi@corp.dz',        role: 'chef_departement', level: 'departement', unit: 'Département RH',      drh: true,  date: '2016-03-01' },
    { key: 'deptIT',   first: 'Yacine',  last: 'Merabet',    email: 'yacine.merabet@corp.dz',     role: 'chef_departement', level: 'departement', unit: 'Département IT',      drh: true,  date: '2016-06-20' },
    { key: 'secRecru', first: 'Sofia',   last: 'Haddad',     email: 'sofia.haddad@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Recrutement', drh: false, date: '2018-02-15' },
    { key: 'secPaie',  first: 'Riad',    last: 'Belkacem',   email: 'riad.belkacem@corp.dz',      role: 'chef_service',    level: 'service',     unit: 'Section Paie',        drh: false, date: '2018-04-10' },
    { key: 'secDev',   first: 'Nadia',   last: 'Cherif',     email: 'nadia.cherif@corp.dz',       role: 'chef_service',    level: 'service',     unit: 'Section Dev',         drh: false, date: '2017-09-05' },
    { key: 'secInfra', first: 'Farid',   last: 'Boumediene', email: 'farid.boumediene@corp.dz',   role: 'chef_service',    level: 'service',     unit: 'Section Infra',       drh: false, date: '2017-11-22' },
    { key: 'hr',       first: 'Lina',    last: 'Zerrouki',   email: 'lina.zerrouki@corp.dz',      role: 'drh',             level: 'direction',   unit: 'Direction Générale',  drh: false, date: '2019-01-08' },
    { key: 'admin',    first: 'Yasmine', last: 'Kaci',       email: 'yasmine.kaci@corp.dz',       role: 'drh',             level: 'direction',   unit: 'Direction Générale',  drh: false, date: '2015-01-05' },
    { key: 'e1', first: 'Mounir',  last: 'Saidi',    email: 'mounir.saidi@corp.dz',    role: 'employe', level: 'service', unit: 'Section Recrutement', drh: false, date: '2021-03-01' },
    { key: 'e2', first: 'Amel',    last: 'Bouzid',   email: 'amel.bouzid@corp.dz',     role: 'employe', level: 'service', unit: 'Section Recrutement', drh: false, date: '2022-05-14' },
    { key: 'e3', first: 'Walid',   last: 'Ammar',    email: 'walid.ammar@corp.dz',     role: 'employe', level: 'service', unit: 'Section Paie',        drh: false, date: '2020-09-19' },
    { key: 'e4', first: 'Nesrine', last: 'Kaddour',  email: 'nesrine.kaddour@corp.dz', role: 'employe', level: 'service', unit: 'Section Paie',        drh: false, date: '2021-11-02' },
    { key: 'e5', first: 'Hicham',  last: 'Bendaoud', email: 'hicham.bendaoud@corp.dz', role: 'employe', level: 'service', unit: 'Section Dev',         drh: false, date: '2020-06-23' },
    { key: 'e6', first: 'Sarah',   last: 'Ouali',    email: 'sarah.ouali@corp.dz',     role: 'employe', level: 'service', unit: 'Section Dev',         drh: false, date: '2022-01-17' },
    { key: 'e7', first: 'Bilal',   last: 'Rahmani',  email: 'bilal.rahmani@corp.dz',   role: 'employe', level: 'service', unit: 'Section Infra',       drh: false, date: '2021-08-09' },
  ];

  for (const p of roster) {
    const directionId = p.level === 'direction' ? org.directions[p.unit] : null;
    const departementId = p.level === 'departement' ? org.departements[p.unit] : null;
    const serviceId = p.level === 'service' ? org.services[p.unit] : null;

    // nom_jeune_fille is NOT NULL on the new table but the old roster has no such data,
    // so it's seeded as a copy of nom (placeholder, not real).
    const [result] = await conn.query(
      `INSERT INTO Employe (nom, nom_jeune_fille, prenom, email, password, date_entree, role, direction_id, departement_id, service_id, forward_drh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.last, p.last, p.first, p.email, hashedPw, p.date, p.role, directionId, departementId, serviceId, p.drh]
    );
    emp[p.key] = result.insertId;
  }

  return emp;
}

async function seedExercise(conn, emp) {
  // exercise_id keyed per (employee, key) so leave requests below can reference the right allocation
  const exercises = {};
  for (const key of Object.keys(emp)) {
    const [r2025] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, ?)', [emp[key], 2025, 6.5]);
    const [r2026] = await conn.query('INSERT INTO Exercise (Emp_id, year, balance) VALUES (?, ?, ?)', [emp[key], 2026, 30.0]);
    exercises[key] = { 2025: r2025.insertId, 2026: r2026.insertId };
  }
  return exercises;
}

async function seedAttendance(conn, emp) {
  const days = 10;
  const today = new Date();
  for (const key of Object.keys(emp)) {
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const attend = !(key === 'e5' && i === 2) && !(key === 'e3' && i === 5);
      await conn.query('INSERT INTO Attendance (Emp_id, attendance_date, attend) VALUES (?, ?, ?)', [emp[key], dateStr, attend]);
    }
  }
}

async function seedLeaveRequestsAndSteps(conn, emp, exercises) {
  const requests = [
    { key: 'r1', emp: 'e1', exercise: 2026, type: 'annual',      start: '2026-10-05', duration: 5,  status: 'pending' },
    { key: 'r2', emp: 'e2', exercise: 2026, type: 'annual',      start: '2026-09-20', duration: 3,  status: 'approved' },
    { key: 'r3', emp: 'e3', exercise: 2026, type: 'exceptional', start: '2026-09-15', duration: 2,  status: 'rejected', reason: 'family_event', justification: 'Family emergency' },
    { key: 'r4', emp: 'e4', exercise: 2025, type: 'advance',     start: '2026-11-01', duration: 4,  status: 'pending' },
    { key: 'r5', emp: 'e5', exercise: 2026, type: 'annual',      start: '2026-12-10', duration: 7,  status: 'cancelled' },
    { key: 'r6', emp: 'e6', exercise: 2026, type: 'annual',      start: '2026-09-01', duration: 10, status: 'approved' },
    { key: 'r7', emp: 'e7', exercise: 2026, type: 'exceptional', start: '2026-09-22', duration: 1,  status: 'pending', reason: 'medical', justification: 'Doctor appointment' },
  ];

  const requestIds = {};
  for (const r of requests) {
    const [result] = await conn.query(
      `INSERT INTO Leave_request (Emp_id, exercise, leave_type, start_date, duration, reason_type, justification, request_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp[r.emp], r.exercise, r.type, r.start, r.duration, r.reason || null, r.justification || null, r.status]
    );
    requestIds[r.key] = result.insertId;

    // For seed purposes, only annual requests get an allocation row, drawn entirely from
    // the request's own exercise year (no need to simulate a real FIFO split here).
    if (r.type === 'annual') {
      const exerciseId = exercises[r.emp][r.exercise];
      await conn.query(
        'INSERT INTO Request_exercise_allocation (request_id, exercise_id, days_allocated) VALUES (?, ?, ?)',
        [result.insertId, exerciseId, r.duration]
      );
    }
  }

  // Chains: unit head, then optionally forwarded further, HR only when a forward_drh head chooses to
  const steps = [
    ['r1', [['secRecru', null, null, null]]],
    ['r2', [['secRecru', 'approved', '2026-09-18 09:00:00', 'OK'], ['hr', 'approved', '2026-09-18 14:00:00', 'Validated by HR']]],
    ['r3', [['secPaie', 'rejected', '2026-09-14 11:00:00', 'Insufficient notice']]],
    ['r4', [['secPaie', 'approved', '2026-10-25 10:00:00', 'Forwarded up'], ['deptRH', null, null, null]]],
    ['r5', [['secDev', 'approved', '2026-11-20 10:00:00', 'Approved then cancelled by employee']]],
    ['r6', [['secDev', 'approved', '2026-08-25 09:00:00', 'OK'], ['hr', 'approved', '2026-08-26 10:00:00', 'Validated by HR']]],
    ['r7', [['secInfra', null, null, null]]],
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
    console.log('Seeding attendance...');
    await seedAttendance(conn, emp);
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