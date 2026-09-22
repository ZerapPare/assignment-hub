// Drift guard.
//
// init.sql only runs when a Docker volume is created from scratch; existing
// databases get their changes from migrations/. Every time a feature has landed
// in one file and not the other, the result has been code querying a table or
// column that does not exist on somebody's machine — Working_Hours is still
// missing from every SQL file in the repo, and time_estimate sat in init.sql
// while migrate.sh never applied the migration that added it.
//
// These assertions are cheap and catch that class of bug before it ships.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ALL_PERMISSION_CODES, ALL_ROLE_CODES } = require('../src/rbac/permissions');

const REPO_ROOT = path.join(__dirname, '..', '..');
const initSql = fs.readFileSync(path.join(REPO_ROOT, 'init.sql'), 'utf8');
const migrationSql = fs.readFileSync(
  path.join(REPO_ROOT, 'migrations', '012_rbac.sql'),
  'utf8'
);

const RBAC_TABLES = ['User_Account', 'Role', 'Permission', 'Role_Permission', 'User_Role'];

test('both SQL files create every RBAC table', () => {
  for (const table of RBAC_TABLES) {
    const create = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`);
    assert.match(initSql, create, `init.sql is missing ${table}`);
    assert.match(migrationSql, create, `012_rbac.sql is missing ${table}`);
  }
});

test('every permission code the code uses is seeded in both SQL files', () => {
  for (const code of ALL_PERMISSION_CODES) {
    assert.ok(initSql.includes(`'${code}'`), `init.sql does not seed ${code}`);
    assert.ok(migrationSql.includes(`'${code}'`), `012_rbac.sql does not seed ${code}`);
  }
});

test('every role code the code uses is seeded in both SQL files', () => {
  for (const code of ALL_ROLE_CODES) {
    assert.ok(initSql.includes(`'${code}'`), `init.sql does not seed ${code}`);
    assert.ok(migrationSql.includes(`'${code}'`), `012_rbac.sql does not seed ${code}`);
  }
});

test('both SQL files link Student and Admin to User_Account', () => {
  for (const [name, sql] of [['init.sql', initSql], ['012_rbac.sql', migrationSql]]) {
    assert.ok(sql.includes('fk_student_user_account'), `${name} is missing the Student link`);
    assert.ok(sql.includes('fk_admin_user_account'), `${name} is missing the Admin link`);
    assert.ok(sql.includes('uq_admin_user_account'), `${name} is missing Admin.user_id`);
  }
});

// The split is the point: initdb creates structure and reference data, the
// migration additionally moves rows that already exist.
test('the backfill lives in the migration and not in init.sql', () => {
  assert.ok(
    migrationSql.includes('INSERT IGNORE INTO User_Account'),
    '012_rbac.sql should backfill User_Account from Student'
  );
  assert.ok(
    migrationSql.includes('INSERT IGNORE INTO User_Role'),
    '012_rbac.sql should grant roles to existing rows'
  );
  assert.ok(
    !initSql.includes('INSERT IGNORE INTO User_Role'),
    'init.sql runs against an empty database and needs no role backfill'
  );
});

// Adding the constraint before the backfill fails against rows that have no
// User_Account row yet, so the order is load-bearing rather than cosmetic.
test('the migration backfills User_Account before adding the Student foreign key', () => {
  const backfillAt = migrationSql.indexOf('INSERT IGNORE INTO User_Account');
  const foreignKeyAt = migrationSql.indexOf('fk_student_user_account');
  assert.ok(backfillAt > -1 && foreignKeyAt > -1);
  assert.ok(
    backfillAt < foreignKeyAt,
    'fk_student_user_account must be added after the User_Account backfill'
  );
});
