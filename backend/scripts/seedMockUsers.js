const pool = require('../src/db');
const { seedMockUsers } = require('../src/services/devStudentSeeder');
const { seedMockBusinessAnalytics } = require('../src/services/devBusinessAnalyticsSeeder');

async function main() {
  try {
    const result = await seedMockUsers({ db: pool });
    const analytics = await seedMockBusinessAnalytics({ db: pool });
    console.log(
      `Seeded ${result.userCount} mock student users `
      + `(${result.insertedCount} inserted, ${result.updatedCount} updated).`
    );
    console.log(
      `Seeded ${analytics.eventCount} mock business analytics events `
      + `for ${analytics.userCount} mock users.`
    );
    console.log('Mock provider markers are not real OAuth credentials.');
  } catch (error) {
    console.error(`[seed-mock-users] ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}

module.exports = { main };
