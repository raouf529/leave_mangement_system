const assert = require('assert');
const { resolveDepartmentHeadTarget } = require('../services/requsetServices');

const employee = { Emp_id: 12, unit_id: 4, role: 'employee' };
const employeeUnit = { unit_id: 4, type: 'section', parent_unit_id: 2 };
const headByUnit = {
  2: { Emp_id: 9, First_name: 'Amina', Last_name: 'Toumi', role: 'head', unit_id: 2 }
};

const target = resolveDepartmentHeadTarget(employee, employeeUnit, headByUnit, true);
assert.deepStrictEqual(target, headByUnit[2]);

console.log('direct department head routing test passed');
