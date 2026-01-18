export default {
  // Use Babel to transform ES modules
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Test file patterns
  testMatch: [
    '**/packages/**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/apps/',
    '/tools/'
  ],

  // Module resolution
  moduleFileExtensions: ['js', 'json'],

  // Inject Jest globals
  injectGlobals: true,

  // Coverage configuration
  collectCoverageFrom: [
    'packages/**/*.js',
    '!packages/**/index.js',
    '!packages/**/*.test.js',
    '!packages/**/__mocks__/**'
  ],

  coverageDirectory: 'coverage',

  // Coverage thresholds per tested file (not global)
  // Add more files here as tests are written
  coverageThreshold: {
    './packages/neon-cloud/utils.js': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100
    },
    './packages/neon-cloud/diff.js': {
      statements: 95,
      branches: 85,
      functions: 100,
      lines: 95
    },
    './packages/neon-cloud/commit-generator.js': {
      statements: 95,
      branches: 90,
      functions: 100,
      lines: 95
    },
    './packages/neon-ui/utils.js': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100
    },
    './packages/neon-fx/base.js': {
      statements: 95,
      branches: 80,
      functions: 100,
      lines: 95
    }
  },

  // Environment per project
  projects: [
    {
      displayName: 'neon-cloud',
      testMatch: ['<rootDir>/packages/neon-cloud/**/*.test.js'],
      testEnvironment: 'node',
      injectGlobals: true,
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    },
    {
      displayName: 'neon-ui',
      testMatch: ['<rootDir>/packages/neon-ui/**/*.test.js'],
      testEnvironment: 'jsdom',
      injectGlobals: true,
      transform: {
        '^.+\\.js$': 'babel-jest'
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    },
    {
      displayName: 'neon-fx',
      testMatch: ['<rootDir>/packages/neon-fx/**/*.test.js'],
      testEnvironment: 'node',
      injectGlobals: true,
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    }
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true
};
