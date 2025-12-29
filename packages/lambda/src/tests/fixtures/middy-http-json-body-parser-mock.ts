/**
 * Mock for @middy/http-json-body-parser used in tests.
 * This provides a no-op middleware since tests provide pre-parsed bodies.
 */

const httpJsonBodyParser = () => ({
  before: () => {},
});

export default httpJsonBodyParser;
