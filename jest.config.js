module.exports = {
  // Sequelize sync({alter:true}) runs as a side effect of requiring
  // ../models (see models/index.js), and every integration test file
  // shares the same odyssey-test database - running them in parallel
  // workers would race that sync and stomp on each other's seeded rows.
  // Pure unit tests don't touch the DB at all, but pinning globally to 1
  // keeps this simple and correctness-first over speed for now.
  maxWorkers: 1,
  testTimeout: 20000,
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupTestDb.js'],
      // puppeteer's package entry is ESM-only and can't be parsed by Jest's
      // default CJS transform; requiring the app (routes/invoice ->
      // functions/pdf.js) pulls it in even for tests unrelated to PDF
      // generation, so stub it at the module-resolution level.
      moduleNameMapper: {
        '^puppeteer$': '<rootDir>/tests/mocks/puppeteerMock.js',
      },
    },
  ],
};
