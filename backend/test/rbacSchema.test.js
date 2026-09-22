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
const read = (...parts) => fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

const initSql = read('init.sql');
const rbacSql = read('migrations', '012_rbac.sql');
const foldSql = read('migrations', '013_single_user_table.sql');

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

// A fresh database must land on the shape migration 013 leaves an existing one
// in: one user table, no Student, no Admin. Recreating either here is exactly
// the drift that makes a teammate's database disagree with the code.
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
  // The audit log stored admin_id. Those have to become user_id before the
  // Admin table goes, or every historical row loses its actor.
  assert.match(foldSql, /UPDATE Admin_Audit_Log/);
  assert.ok(
    foldSql.indexOf('UPDATE Admin_Audit_Log') < foldSql.indexOf('DROP TABLE Admin;'),
    'the audit log must be remapped before Admin is dropped'
  );
});

// The split is the point: initdb creates structure and reference data, the
// migration additionally moves rows that already exist.
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
