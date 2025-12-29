// Jest setup file for Lambda package
// Mock AWS Lambda Powertools to avoid initialization issues in tests
jest.mock('@aws-lambda-powertools/logger');
jest.mock('@aws-lambda-powertools/tracer');
jest.mock('@aws-lambda-powertools/metrics');
