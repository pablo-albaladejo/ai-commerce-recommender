// Jest setup file for Core package

// Make builder-generated fixtures deterministic across test runs.
// (See project testing guidelines: Faker should be seeded for reproducible tests.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { faker } = require('@faker-js/faker');
faker.seed(42);
