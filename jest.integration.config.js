/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/lib/db/__tests__/integration.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
      },
      diagnostics: false,
    }],
  },
  // Longer timeout for real DB + potential Redis connection attempts
  testTimeout: 30000,
  // Run integration tests serially to avoid connection pool exhaustion
  maxWorkers: 1,
};
