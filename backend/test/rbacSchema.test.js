// Drift guard. init.sql runs only on a fresh volume; existing databases get
// their changes from migrations/. Whenever a change landed in one and not the
// other, somebody's machine ended up missing a table the code queries.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ALL_PERMISSION_CODES, ALL_ROLE_CODES } = require('../src/rbac/permissions');

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

const initSql = read('init.sql');
// The fold (013) and the admin rename (014) are merged into 012, which is why
// both names below read the same file.
const rbacSql = read('migrations', '012_rbac.sql');
const foldSql = rbacSql;

const RBAC_TABLES = ['Role', 'Permission', 'Role_Permission', 'User_Role'];

test('both SQL files create every RBAC table', () => {
  for (const table of RBAC_TABLES) {
    const create = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`);
    assert.match(initSql, create, `init.sql is missing ${table}`);
    assert.match(rbacSql, create, `012_rbac.sql is missing ${table}`);
  }
});

test('every permission code the code uses is seeded in both SQL files', () => {
  for (const code of ALL_PERMISSION_CODES) {
    assert.ok(initSql.includes(`'${code}'`), `init.sql does not seed ${code}`);
    assert.ok(rbacSql.includes(`'${code}'`), `012_rbac.sql does not seed ${code}`);
  }
});

test('every role code the code uses is seeded in both SQL files', () => {
  for (const code of ALL_ROLE_CODES) {
    assert.ok(initSql.includes(`'${code}'`), `init.sql does not seed ${code}`);
    assert.ok(rbacSql.includes(`'${code}'`), `012_rbac.sql does not seed ${code}`);
  }
});

// A fresh database must land where the fold leaves an existing one: one user
// table, no Student, no Admin.
test('init.sql builds the single-table model', () => {
  assert.match(initSql, /CREATE TABLE User_Account \(/);
  assert.ok(!/CREATE TABLE Student\b/.test(initSql), 'init.sql must not recreate Student');
  assert.ok(!/CREATE TABLE Admin\b/.test(initSql), 'init.sql must not recreate Admin');
  for (const column of ['student_id', 'full_name', 'email', 'user_type', 'account_status']) {
    assert.ok(initSql.includes(column), `User_Account is missing ${column}`);
  }
});

test('nothing in init.sql still points a foreign key at the folded tables', () => {
  assert.ok(!/REFERENCES Student\(/.test(initSql), 'a foreign key still references Student');
  assert.ok(!/REFERENCES Admin\(/.test(initSql), 'a foreign key still references Admin');
});

test('the fold migration preserves ids rather than copying rows', () => {
  assert.match(foldSql, /RENAME TABLE Student TO User_Account/);
  // admin_id must become user_id before Admin goes, or rows lose their actor.
  assert.match(foldSql, /UPDATE Admin_Audit_Log/);
  assert.ok(
    foldSql.indexOf('UPDATE Admin_Audit_Log') < foldSql.indexOf('DROP TABLE Admin;'),
    'the audit log must be remapped before Admin is dropped'
  );
});

// initdb creates structure and reference data; the migration also moves rows.
test('row backfills live in the migrations and not in init.sql', () => {
  assert.ok(
    rbacSql.includes('INSERT IGNORE INTO User_Role'),
    '012_rbac.sql should grant roles to existing rows'
  );
  assert.ok(
    !initSql.includes('INSERT IGNORE INTO User_Role'),
    'init.sql runs against an empty database and needs no role backfill'
  );
});
