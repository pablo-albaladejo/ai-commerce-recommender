module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // Only use project for files that are definitely in tsconfig
    project: null, // Disable type-aware linting by default
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // STRICT RULES - NO any allowed EVER (but only warn since we can't use type-aware rules)
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // File and function size limits - VERY STRICT
    'max-lines': [
      'error',
      { max: 200, skipBlankLines: true, skipComments: true },
    ],
    'max-lines-per-function': [
      'error',
      { max: 50, skipBlankLines: true, skipComments: true },
    ],
    complexity: ['error', 5],
    'max-params': ['error', 3],
    'max-depth': ['error', 3],

    // Code quality rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-duplicate-imports': 'error',
    'prefer-arrow-callback': 'error',

    // TypeScript specific (basic rules only - no type-aware rules)
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  },
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.js',
    '*.d.ts',
    'cdk.out/',
  ],
  overrides: [
    // Fixture files - NO TYPE-AWARE LINTING + NO LENGTH RESTRICTIONS
    // This must be FIRST to handle fixture files before other overrides
    {
      files: ['**/fixtures/**/*.ts', 'packages/**/fixtures/**/*.ts'],
      rules: {
        // Disable rules that require type information
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/consistent-type-definitions': 'off',
        // Allow console in fixtures
        'no-console': 'off',
        // NO LENGTH RESTRICTIONS for fixtures
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
        'max-params': 'off',
        'max-depth': 'off',
        // Keep basic rules
        'prefer-const': 'error',
        'no-var': 'error',
        'no-duplicate-imports': 'error',
        'prefer-arrow-callback': 'error',
      },
    },
    // Test files - NO LENGTH RESTRICTIONS
    // This must be SECOND to override all other rules for test files
    {
      files: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**/*.ts',
        '**/tests/**/*.ts',
        '**/examples/**/*.ts', // Also relax rules for example files
        // Specific patterns for nested test files
        'packages/**/middleware/**/*.test.ts',
        'packages/**/middleware/**/*.spec.ts',
        'packages/**/src/**/*.test.ts',
        'packages/**/src/**/*.spec.ts',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Allow any in tests but warn
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_' },
        ],
        'no-console': 'off', // Allow console in tests
        'max-lines': 'off', // No file length limits for tests
        'max-lines-per-function': 'off', // No function length limits for tests
        complexity: 'off', // No complexity limits for tests
        'max-params': 'off', // No parameter limits for tests
        'max-depth': 'off', // No nesting depth limits for tests
        '@typescript-eslint/prefer-readonly': 'off', // Allow mutable properties in tests
      },
    },
    // Integration test files - NO LENGTH RESTRICTIONS + NO TYPE-AWARE RULES
    // These files have parsing issues so need special handling
    {
      files: [
        '**/*.integ-test.ts',
        'packages/**/middleware/**/*.integ-test.ts',
        'packages/**/src/**/*.integ-test.ts',
      ],
      rules: {
        // Disable rules that require type information
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/consistent-type-definitions': 'off',
        // Allow console in tests
        'no-console': 'off',
        // NO LENGTH RESTRICTIONS for integration tests
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
        'max-params': 'off',
        'max-depth': 'off',
        // Keep basic rules
        'prefer-const': 'error',
        'no-var': 'error',
        'no-duplicate-imports': 'error',
        'prefer-arrow-callback': 'error',
      },
    },
    // Core package - strictest rules
    {
      files: ['packages/core/src/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.integ-test.ts', '**/*.spec.ts'], // Exclude test files
      rules: {
        'no-console': 'error',
        'max-lines': [
          'error',
          { max: 150, skipBlankLines: true, skipComments: true },
        ],
        'max-lines-per-function': [
          'error',
          { max: 30, skipBlankLines: true, skipComments: true },
        ],
        complexity: ['error', 3],
        'max-params': ['error', 2],
      },
    },
    // Scripts - allow console.log
    {
      files: ['packages/scripts/src/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.integ-test.ts', '**/*.spec.ts'], // Exclude test files
      rules: {
        'no-console': 'off',
        'max-lines': [
          'error',
          { max: 250, skipBlankLines: true, skipComments: true },
        ],
        'max-lines-per-function': [
          'error',
          { max: 60, skipBlankLines: true, skipComments: true },
        ],
        complexity: ['error', 8],
        'max-params': ['error', 4],
      },
    },
    // CDK infra - slightly relaxed but still no any
    {
      files: ['packages/infra/src/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.integ-test.ts', '**/*.spec.ts'], // Exclude test files
      rules: {
        'no-console': 'warn',
        'max-lines': [
          'error',
          { max: 350, skipBlankLines: true, skipComments: true },
        ],
        'max-lines-per-function': [
          'error',
          { max: 80, skipBlankLines: true, skipComments: true },
        ],
        complexity: ['error', 10],
        'max-params': ['error', 5],
      },
    },
    // Lambda handlers - allow console.log but still strict on size
    {
      files: ['packages/lambda/src/**/*.ts'],
      excludedFiles: [
        '**/*.test.ts',
        '**/*.integ-test.ts',
        '**/*.spec.ts',
        '**/fixtures/**/*.ts',
      ], // Exclude test files and fixtures
      rules: {
        'no-console': 'off',
        'max-lines': [
          'error',
          { max: 250, skipBlankLines: true, skipComments: true },
        ],
        'max-lines-per-function': [
          'error',
          { max: 60, skipBlankLines: true, skipComments: true },
        ],
        complexity: ['error', 6],
      },
    },
    // =========================================================================
    // CLEAN ARCHITECTURE RULES - Lambda package
    // =========================================================================
    // domain/ cannot import anything from other layers
    {
      files: ['packages/lambda/src/domain/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/application/**'],
                message: 'domain cannot import application',
              },
              {
                group: ['**/infrastructure/**'],
                message: 'domain cannot import infrastructure',
              },
              {
                group: ['**/handlers/**'],
                message: 'domain cannot import handlers',
              },
              {
                group: ['**/lib/**'],
                message: 'domain cannot import lib',
              },
              {
                group: ['**/middleware/**'],
                message: 'domain cannot import middleware',
              },
            ],
          },
        ],
      },
    },
    // application/ can only import domain
    {
      files: ['packages/lambda/src/application/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/infrastructure/**'],
                message: 'application cannot import infrastructure',
              },
              {
                group: ['**/handlers/**'],
                message: 'application cannot import handlers',
              },
              {
                group: ['**/middleware/**'],
                message: 'application cannot import middleware',
              },
            ],
          },
        ],
      },
    },
    // infrastructure/ can import domain and application, but not handlers
    {
      files: ['packages/lambda/src/infrastructure/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/handlers/**'],
                message: 'infrastructure cannot import handlers',
              },
            ],
          },
        ],
      },
    },
    // middleware/ can import domain, application, infrastructure, but not handlers
    {
      files: ['packages/lambda/src/middleware/**/*.ts'],
      excludedFiles: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/handlers/**'],
                message: 'middleware cannot import handlers',
              },
              {
                group: ['**/application/use-cases/**'],
                message: 'middleware cannot import use-cases',
              },
            ],
          },
        ],
      },
    },
  ],
};
