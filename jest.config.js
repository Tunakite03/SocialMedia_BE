const jest = require('jest');

module.exports = {
   testEnvironment: 'node',
   testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
   collectCoverageFrom: ['src/**/*.js', '!src/app.js', '!**/node_modules/**'],
   coverageDirectory: 'coverage',
   coverageReporters: ['text', 'lcov', 'html'],
   setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
   testTimeout: 10000,
};
