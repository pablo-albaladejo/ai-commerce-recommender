module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Transform ESM modules that Jest can't handle natively
  transformIgnorePatterns: [
    'node_modules/(?!(@middy|@aws-lambda-powertools|ai|@ai-sdk)/)',
  ],
  // Map @middy modules to our fixture mocks for consistent types and behavior
  moduleNameMapper: {
    '^@middy/core$': '<rootDir>/src/tests/fixtures/middy-mock.ts',
    '^@middy/http-json-body-parser$':
      '<rootDir>/src/tests/fixtures/middy-http-json-body-parser-mock.ts',
    '\\.md$': '<rootDir>/src/tests/fixtures/markdown-file-mock.ts',
  },
};
