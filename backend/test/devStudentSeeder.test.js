const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MOCK_UNIVERSITIES,
  MOCK_USERS,
  seedMockUsers,
  validateFixtures,
  DEV_SEED_TOKEN_PREFIX,
  isDevSeedToken,
  makeDevSeedToken,
} = require('../src/services/devStudentSeeder');

const STUDENT_COLUMNS = [
  'user_id', 'student_id', 'student_name', 'university_email', 'university_id',
  'gg_access_token', 'gg_refresh_token', 'ms_access_token', 'ms_refresh_token',
  'role', 'account_status', 'created_at', 'last_login_at', 'last_seen_at',
];

const STUDENT_INDEXES = [
  { Key_name: 'university_email', Non_unique: 0, Column_name: 'university_email', Seq_in_index: 1 },
  { Key_name: 'uq_student_per_university', Non_unique: 0, Column_name: 'student_id', Seq_in_index: 1 },
  { Key_name: 'uq_student_per_university', Non_unique: 0, Column_name: 'university_id', Seq_in_index: 2 },
];

function createFakeDb({ indexes = [{ Key_name: 'uq_university_domain', Non_unique: 0, Column_name: 'email_domain', Seq_in_index: 1 }], columns = STUDENT_COLUMNS.map((Field) => ({ Field })), studentIndexes = STUDENT_INDEXES, existingEmails = new Map(), failAtInsert = null } = {}) {
  const state = {
    schemaQueries: 0,
    connectionRequests: 0,
    begins: 0,
    commits: 0,
    rollbacks: 0,
    releases: 0,
    studentInserts: 0,
    studentUpdates: 0,
    lastUpdateSql: '',
    studentRows: new Map(existingEmails),
  };
  const universityIds = new Map();
  let nextUniversityId = 1;
  let nextUserId = 1000;

  const connection = {
    async beginTransaction() {
      state.begins++;
    },
    async commit() {
      state.commits++;
    },
    async rollback() {
      state.rollbacks++;
    },
    release() {
      state.releases++;
    },
    async query(sql, params) {
      if (sql.includes('INSERT INTO University')) {
        const domain = params[1];
        if (!universityIds.has(domain)) universityIds.set(domain, nextUniversityId++);
        return [{ insertId: universityIds.get(domain) }, []];
      }
      if (sql.includes('SELECT user_id, student_id')) {
        const existing = state.studentRows.get(params[0]);
        return [existing ? [existing] : [], []];
      }
      if (sql.includes('SELECT user_id, university_email')) {
        const [studentId, universityId, excludedUserId] = params;
        const collision = [...state.studentRows.values()].find(
          (row) => row.student_id === studentId
            && row.university_id === universityId
            && String(row.user_id) !== String(excludedUserId || '')
        );
        return [collision ? [collision] : [], []];
      }
      if (sql.includes('INSERT INTO Student')) {
        state.studentInserts++;
        if (failAtInsert === state.studentInserts) throw new Error('injected student write failure');
        state.studentRows.set(params[2], {
          user_id: nextUserId++,
          student_id: params[0],
          university_id: params[3],
        });
        return [{ insertId: nextUserId - 1 }, []];
      }
      if (sql.includes('UPDATE Student')) {
        state.studentUpdates++;
        state.lastUpdateSql = sql;
        const userId = params[params.length - 1];
        const row = [...state.studentRows.values()].find((item) => String(item.user_id) === String(userId));
        if (row) {
          row.student_id = params[0];
          row.university_id = params[2];
        }
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected fake query: ${sql}`);
    },
  };

  return {
    state,
    async query(sql) {
      state.schemaQueries++;
      if (sql.includes('SHOW INDEX FROM University')) return [indexes, []];
      if (sql.includes('SHOW COLUMNS FROM Student')) return [columns, []];
      if (sql.includes('SHOW INDEX FROM Student')) return [studentIndexes, []];
      throw new Error(`Unexpected pool query: ${sql}`);
    },
    async getConnection() {
      state.connectionRequests++;
      return connection;
    },
  };
}

const DEV_ENV = { NODE_ENV: 'development', ALLOW_MOCK_DATA: '1' };
const NOW = new Date('2026-08-25T12:00:00.000Z');

test('fixture contract uses reserved domains and supported values', () => {
  assert.doesNotThrow(() => validateFixtures(MOCK_UNIVERSITIES, MOCK_USERS));
  assert.equal(new Set(MOCK_USERS.map((user) => user.email)).size, MOCK_USERS.length);
  assert.ok(MOCK_USERS.every((user) => user.email.endsWith('.test')));
});

test('provider markers use the shared dev-seed prefix and never look like real tokens', () => {
  const marker = makeDevSeedToken('google', MOCK_USERS[0].email);
  assert.equal(DEV_SEED_TOKEN_PREFIX, 'dev-seed:');
  assert.ok(isDevSeedToken(marker));
  assert.equal(isDevSeedToken('real-refresh-token'), false);
  assert.equal(isDevSeedToken(null), false);
});

test('seed refuses without explicit development confirmation before DB access', async () => {
  const db = createFakeDb();

  await assert.rejects(
    seedMockUsers({ db, env: { NODE_ENV: 'development' }, now: NOW }),
    /NODE_ENV=development and ALLOW_MOCK_DATA=1/
  );
  assert.equal(db.state.schemaQueries, 0);
  assert.equal(db.state.connectionRequests, 0);
});

test('seed refuses production even when mock data is explicitly enabled', async () => {
  const db = createFakeDb();

  await assert.rejects(
    seedMockUsers({ db, env: { NODE_ENV: 'production', ALLOW_MOCK_DATA: '1' }, now: NOW }),
    /NODE_ENV=development and ALLOW_MOCK_DATA=1/
  );
  assert.equal(db.state.schemaQueries, 0);
  assert.equal(db.state.connectionRequests, 0);
});

test('seed checks the unique university-domain migration before writing', async () => {
  const db = createFakeDb({ indexes: [] });

  await assert.rejects(
    seedMockUsers({ db, env: DEV_ENV, now: NOW }),
    /migrations\/001_identity\.sql/
  );
  assert.equal(db.state.schemaQueries, 1);
  assert.equal(db.state.connectionRequests, 0);
});

test('seed rejects a wrongly defined university index', async () => {
  const db = createFakeDb({
    indexes: [{ Key_name: 'uq_university_domain', Non_unique: 0, Column_name: 'university_name' }],
  });

  await assert.rejects(
    seedMockUsers({ db, env: DEV_ENV, now: NOW }),
    /University\.email_domain must be unique/
  );
  assert.equal(db.state.connectionRequests, 0);
});

test('seed rejects an incomplete Student schema before opening a transaction', async () => {
  const db = createFakeDb({ columns: STUDENT_COLUMNS.filter((column) => column !== 'account_status')
    .map((Field) => ({ Field })) });

  await assert.rejects(
    seedMockUsers({ db, env: DEV_ENV, now: NOW }),
    /Student schema is missing account_status/
  );
  assert.equal(db.state.connectionRequests, 0);
});

test('seed rejects missing Student identity indexes before opening a transaction', async () => {
  const db = createFakeDb({
    studentIndexes: STUDENT_INDEXES.filter((index) => index.Key_name !== 'uq_student_per_university'),
  });

  await assert.rejects(
    seedMockUsers({ db, env: DEV_ENV, now: NOW }),
    /Student identity index is missing/
  );
  assert.equal(db.state.connectionRequests, 0);
});

test('seed commits and updates an existing mock row without duplicating it', async () => {
  const existingEmail = MOCK_USERS[0].email;
  const db = createFakeDb({
    existingEmails: new Map([[existingEmail, { user_id: 77, student_id: 'MOCK-0001' }]]),
  });

  const result = await seedMockUsers({ db, env: DEV_ENV, now: NOW });

  assert.equal(result.userCount, MOCK_USERS.length);
  assert.equal(result.updatedCount, 1);
  assert.equal(result.insertedCount, MOCK_USERS.length - 1);
  assert.match(db.state.lastUpdateSql, /gg_access_token = NULL/);
  assert.match(db.state.lastUpdateSql, /ms_access_token = NULL/);
  assert.equal(db.state.begins, 1);
  assert.equal(db.state.commits, 1);
  assert.equal(db.state.rollbacks, 0);
  assert.equal(db.state.releases, 1);
});

test('two complete runs preserve fixture count and generated user IDs', async () => {
  const db = createFakeDb();

  const first = await seedMockUsers({ db, env: DEV_ENV, now: NOW });
  const firstIds = [...db.state.studentRows.values()]
    .sort((a, b) => a.user_id - b.user_id)
    .map((row) => row.user_id);
  const second = await seedMockUsers({ db, env: DEV_ENV, now: NOW });
  const secondIds = [...db.state.studentRows.values()]
    .sort((a, b) => a.user_id - b.user_id)
    .map((row) => row.user_id);

  assert.equal(first.insertedCount, MOCK_USERS.length);
  assert.equal(second.insertedCount, 0);
  assert.equal(second.updatedCount, MOCK_USERS.length);
  assert.equal(db.state.studentRows.size, MOCK_USERS.length);
  assert.deepEqual(secondIds, firstIds);
  assert.equal(db.state.commits, 2);
  assert.equal(db.state.rollbacks, 0);
  assert.equal(db.state.releases, 2);
});

test('seed rolls back and releases the connection after a write failure', async () => {
  const db = createFakeDb({ failAtInsert: 3 });

  await assert.rejects(
    seedMockUsers({ db, env: DEV_ENV, now: NOW }),
    /injected student write failure/
  );
  assert.equal(db.state.commits, 0);
  assert.equal(db.state.rollbacks, 1);
  assert.equal(db.state.releases, 1);
});
