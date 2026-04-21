const path = require('path');

if (!process.env.CRAFTIFY_DB_PATH) {
  process.env.CRAFTIFY_DB_PATH = path.join(__dirname, '..', '..', `craftify.test.${process.pid}.db`);
}

const {
  initializeTestContext,
  getTestContext,
  loginAs,
  makeUnique,
  cleanupTestDb
} = require('../testContext');

function runLegacySuiteGroup(groupName, registerSuites) {
  beforeAll(async () => {
    await initializeTestContext();
  });

  afterAll(() => {
    cleanupTestDb();
  });

  const suiteContext = {
    getTestContext,
    loginAs,
    makeUnique
  };

  describe(groupName, () => {
    registerSuites(suiteContext);
  });
}

module.exports = {
  runLegacySuiteGroup
};
