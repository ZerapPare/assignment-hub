const UNIVERSITY_INDEX_NAME = 'uq_university_domain';
const DEV_SEED_TOKEN_PREFIX = 'dev-seed:';
const MOCK_ID_PREFIX = 'MOCK-';
const ALLOWED_STATUSES = new Set(['active', 'suspended']);
const REQUIRED_STUDENT_COLUMNS = [
  'user_id', 'student_id', 'student_name', 'university_email', 'university_id',
  'gg_access_token', 'gg_refresh_token', 'ms_access_token', 'ms_refresh_token',
  'role', 'account_status', 'created_at', 'last_login_at', 'last_seen_at',
];

const MOCK_UNIVERSITIES = [
  { name: 'มหาวิทยาลัยตัวอย่าง', domain: 'demo.assignment-hub.test' },
  { name: 'วิทยาลัยสาธิตดิจิทัล', domain: 'digital.assignment-hub.test' },
];

const MOCK_USERS = [
  { name: 'Demo Narin', email: 'narin@demo.assignment-hub.test', studentId: 'MOCK-0001', universityDomain: 'demo.assignment-hub.test', status: 'active', google: true, microsoft: true, createdDaysAgo: 1, lastLoginDaysAgo: 0, lastSeenDaysAgo: 0 },
  { name: 'Demo Pim', email: 'pim@demo.assignment-hub.test', studentId: 'MOCK-0002', universityDomain: 'demo.assignment-hub.test', status: 'active', google: true, microsoft: false, createdDaysAgo: 3, lastLoginDaysAgo: 1, lastSeenDaysAgo: 1 },
  { name: 'Demo Kiet', email: 'kiet@demo.assignment-hub.test', studentId: 'MOCK-0003', universityDomain: 'demo.assignment-hub.test', status: 'active', google: false, microsoft: true, createdDaysAgo: 6, lastLoginDaysAgo: 0, lastSeenDaysAgo: 0 },
  { name: 'Demo Fah', email: 'fah@demo.assignment-hub.test', studentId: 'MOCK-0004', universityDomain: 'demo.assignment-hub.test', status: 'active', google: false, microsoft: false, createdDaysAgo: 9, lastLoginDaysAgo: null, lastSeenDaysAgo: 2 },
  { name: 'Demo Ton', email: 'ton@demo.assignment-hub.test', studentId: 'MOCK-0005', universityDomain: 'demo.assignment-hub.test', status: 'suspended', google: true, microsoft: false, createdDaysAgo: 14, lastLoginDaysAgo: 14, lastSeenDaysAgo: 14 },
  { name: 'Demo May', email: 'may@digital.assignment-hub.test', studentId: 'MOCK-0101', universityDomain: 'digital.assignment-hub.test', status: 'active', google: true, microsoft: true, createdDaysAgo: 21, lastLoginDaysAgo: 4, lastSeenDaysAgo: 4 },
  { name: 'Demo Bank', email: 'bank@digital.assignment-hub.test', studentId: 'MOCK-0102', universityDomain: 'digital.assignment-hub.test', status: 'suspended', google: false, microsoft: true, createdDaysAgo: 33, lastLoginDaysAgo: 33, lastSeenDaysAgo: null },
  { name: 'Demo View', email: 'view@digital.assignment-hub.test', studentId: 'MOCK-0103', universityDomain: 'digital.assignment-hub.test', status: 'active', google: true, microsoft: false, createdDaysAgo: 45, lastLoginDaysAgo: 8, lastSeenDaysAgo: 8 },
];

function validateFixtures(universities, users) {
  const universityDomains = new Set();
  for (const university of universities) {
    if (!university.domain.endsWith('.test')) {
      throw new Error(`Mock university must use a .test domain: ${university.domain}`);
    }
    if (universityDomains.has(university.domain)) {
      throw new Error(`Duplicate mock university domain: ${university.domain}`);
    }
    universityDomains.add(university.domain);
  }

  const emails = new Set();
  const studentKeys = new Set();

  for (const user of users) {
    if (!universityDomains.has(user.universityDomain)) {
      throw new Error(`Unknown mock university: ${user.universityDomain}`);
    }
    if (!user.email.endsWith(`@${user.universityDomain}`) || !user.email.endsWith('.test')) {
      throw new Error(`Mock email must use its university and a .test domain: ${user.email}`);
    }
    if (!user.studentId.startsWith(MOCK_ID_PREFIX)) {
      throw new Error(`Mock student ID must start with ${MOCK_ID_PREFIX}: ${user.studentId}`);
    }
    if (!ALLOWED_STATUSES.has(user.status)) {
      throw new Error(`Invalid mock account status: ${user.status}`);
    }
    if (emails.has(user.email)) throw new Error(`Duplicate mock email: ${user.email}`);
    const studentKey = `${user.universityDomain}:${user.studentId}`;
    if (studentKeys.has(studentKey)) throw new Error(`Duplicate mock student ID: ${studentKey}`);
    emails.add(user.email);
    studentKeys.add(studentKey);
  }
}

function assertDevSeedAllowed(env) {
  if (env?.NODE_ENV !== 'development' || env?.ALLOW_MOCK_DATA !== '1') {
    throw new Error('Refusing to seed mock users: set NODE_ENV=development and ALLOW_MOCK_DATA=1');
  }
}

function hasUniqueIndex(indexes, expectedColumns) {
  const grouped = new Map();
  for (const index of indexes) {
    if (index.Non_unique !== 0 && String(index.Non_unique) !== '0') continue;
    const keyName = String(index.Key_name);
    if (!grouped.has(keyName)) grouped.set(keyName, new Map());
    grouped.get(keyName).set(Number(index.Seq_in_index || 1), String(index.Column_name).toLowerCase());
  }

  return [...grouped.values()].some((columns) => (
    columns.size === expectedColumns.length
      && expectedColumns.every((column, position) => columns.get(position + 1) === column)
  ));
}

async function assertSchema(db) {
  const [indexes] = await db.query(
    'SHOW INDEX FROM University WHERE Key_name = ?',
    [UNIVERSITY_INDEX_NAME]
  );
  const hasUniqueDomain = hasUniqueIndex(indexes, ['email_domain']);
  if (!hasUniqueDomain) {
    throw new Error('University.email_domain must be unique; apply migrations/001_identity.sql first');
  }

  const [columns] = await db.query('SHOW COLUMNS FROM Student');
  const availableColumns = new Set(columns.map((column) => column.Field));
  const missingColumns = REQUIRED_STUDENT_COLUMNS.filter((column) => !availableColumns.has(column));
  if (missingColumns.length) {
    throw new Error(
      `Student schema is missing ${missingColumns.join(', ')}; apply migrations/005_admin_monitoring.sql first`
    );
  }

  const [studentIndexes] = await db.query('SHOW INDEX FROM Student');
  if (!hasUniqueIndex(studentIndexes, ['university_email'])) {
    throw new Error('Student.university_email must be unique; apply the current init.sql first');
  }
  if (!hasUniqueIndex(studentIndexes, ['student_id', 'university_id'])) {
    throw new Error('Student identity index is missing; apply migrations/001_identity.sql first');
  }
}

function daysAgo(now, days) {
  if (days === null) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isDevSeedToken(token) {
  return String(token || '').startsWith(DEV_SEED_TOKEN_PREFIX);
}

function makeDevSeedToken(provider, email) {
  return `${DEV_SEED_TOKEN_PREFIX}${provider}:connection:${email}`;
}

async function seedMockUsers({
  db,
  universities = MOCK_UNIVERSITIES,
  users = MOCK_USERS,
  now = new Date(),
  env = process.env,
} = {}) {
  assertDevSeedAllowed(env);
  validateFixtures(universities, users);
  if (!db || typeof db.query !== 'function' || typeof db.getConnection !== 'function') {
    throw new Error('A MySQL pool is required to seed mock users');
  }

  await assertSchema(db);

  let connection;
  let transactionStarted = false;
  let insertedCount = 0;
  let updatedCount = 0;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const universityIds = new Map();
    for (const university of universities) {
      const [result] = await connection.query(
        `INSERT INTO University (university_name, email_domain)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE university_id = LAST_INSERT_ID(university_id)`,
        [university.name, university.domain]
      );
      universityIds.set(university.domain, result.insertId);
    }

    for (const user of users) {
      const universityId = universityIds.get(user.universityDomain);
      if (!universityId) throw new Error(`Unknown mock university: ${user.universityDomain}`);

      const [emailRows] = await connection.query(
        `SELECT user_id, student_id
         FROM Student
         WHERE university_email = ?
         LIMIT 1
         FOR UPDATE`,
        [user.email]
      );
      const existing = emailRows[0] || null;
      if (existing && !String(existing.student_id || '').startsWith(MOCK_ID_PREFIX)) {
        throw new Error(`Refusing to overwrite non-mock student: ${user.email}`);
      }

      const collisionParams = [user.studentId, universityId];
      let collisionQuery = `SELECT user_id, university_email
                            FROM Student
                            WHERE student_id = ? AND university_id = ?`;
      if (existing) {
        collisionQuery += ' AND user_id <> ?';
        collisionParams.push(existing.user_id);
      }
      collisionQuery += ' LIMIT 1 FOR UPDATE';
      const [collisions] = await connection.query(collisionQuery, collisionParams);
      if (collisions.length) {
        throw new Error(
          `Mock student ID collides with an existing account: ${user.studentId} (${user.universityDomain})`
        );
      }

      const googleToken = user.google ? makeDevSeedToken('google', user.email) : null;
      const microsoftToken = user.microsoft ? makeDevSeedToken('microsoft', user.email) : null;
      const lastLoginAt = daysAgo(now, user.lastLoginDaysAgo);
      const lastSeenAt = daysAgo(now, user.lastSeenDaysAgo);

      if (existing) {
        await connection.query(
          `UPDATE Student
           SET student_id = ?, student_name = ?, university_id = ?,
               gg_access_token = NULL, ms_access_token = NULL,
               gg_refresh_token = ?, ms_refresh_token = ?, role = 'student',
               account_status = ?, last_login_at = ?, last_seen_at = ?
           WHERE user_id = ?`,
          [user.studentId, user.name, universityId, googleToken, microsoftToken,
            user.status, lastLoginAt, lastSeenAt, existing.user_id]
        );
        updatedCount++;
      } else {
        await connection.query(
          `INSERT INTO Student (
             student_id, student_name, university_email, university_id,
             gg_refresh_token, ms_refresh_token, role, account_status,
             created_at, last_login_at, last_seen_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'student', ?, ?, ?, ?)`,
          [user.studentId, user.name, user.email, universityId, googleToken, microsoftToken,
            user.status, daysAgo(now, user.createdDaysAgo), lastLoginAt, lastSeenAt]
        );
        insertedCount++;
      }
    }

    await connection.commit();
    transactionStarted = false;
    return { insertedCount, updatedCount, userCount: users.length };
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (_) {
        // Preserve the original database error.
      }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  MOCK_UNIVERSITIES,
  MOCK_USERS,
  MOCK_ID_PREFIX,
  DEV_SEED_TOKEN_PREFIX,
  isDevSeedToken,
  makeDevSeedToken,
  assertDevSeedAllowed,
  seedMockUsers,
  validateFixtures,
};
