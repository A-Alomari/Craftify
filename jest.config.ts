import type { Config } from 'jest';

const config: Config = {
  // Prefer .ts over .js so compiled artefacts don't shadow source files
  moduleFileExtensions: ['ts', 'json', 'js'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    // Only run ts-jest on TypeScript files; leave .js files to node's resolver
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        target: 'ES2021',
        skipLibCheck: true,
        strictNullChecks: false,
        noImplicitAny: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  // Load reflect-metadata before any test module so TypeORM decorators work
  setupFiles: ['reflect-metadata'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/app.controller.ts',
    '!src/app.service.ts',
    '!src/database/seeds/**',
    '!src/database/entities/**',
    '!src/gateways/**',
    '!src/config/**',
    '!src/**/*.dto.ts',
    '!src/**/*.decorator.ts',
    '!src/**/*.strategy.ts',
    '!src/**/*.controller.ts',
    '!src/common/filters/**',
    '!src/common/interceptors/**',
    '!src/common/middleware/**',
    '!src/common/pipes/**',
    '!src/modules/admin/**',
    '!src/modules/artisan-profiles/**',
    '!src/modules/coupons/**',
    '!src/modules/orders/**',
    '!src/modules/auctions/**',
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
  coverageDirectory: './coverage',
  testTimeout: 60000,
  maxWorkers: 1,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@entities/(.*)$': '<rootDir>/src/database/entities/$1',
  },
};

export default config;
