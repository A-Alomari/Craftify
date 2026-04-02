# Test Suite Structure (MVC)

The suite is split by responsibility so searching is faster:

- Orchestrator entry: [craftify.test.js](craftify.test.js)
- Controllers aggregator: [controllers.suite.js](controllers.suite.js)
- Controller parts: [controllers](controllers)
- Models aggregator: [models.suite.js](models.suite.js)
- Model parts: [models](models)
- Views aggregator: [views.suite.js](views.suite.js)
- View parts: [views](views)
- Shared seeded context and login helpers: [testContext.js](testContext.js)

## Quick search patterns

- Model tests: `describe('MODEL TESTS'`
- Controller tests: `describe('Public Pages'` or `describe('Auth Routes'`
- View tests: `describe('VIEW / INTEGRATION TESTS'`
- Additional model coverage: `describe('ADDITIONAL MODEL COVERAGE'`
