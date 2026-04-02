const path = require('path');

// Ensure any model/config imports during suite registration use the test DB path.
if (!process.env.CRAFTIFY_DB_PATH) {
  process.env.CRAFTIFY_DB_PATH = path.join(__dirname, '..', `craftify.test.${process.pid}.db`);
}

const {
  initializeTestContext,
  getTestContext,
  loginAs,
  makeUnique,
  cleanupTestDb
} = require('./testContext');

const registerModelSuites = require('./models.suite');
const registerControllerSuites = require('./controllers.suite');
const registerViewSuites = require('./views.suite');

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

registerModelSuites(suiteContext);
registerControllerSuites(suiteContext);
registerViewSuites(suiteContext);
