/**
 * Supplies deterministic fake Knex clients for health service unit tests.
 * No unit test needs a database connection to exercise readiness logic.
 */
function createKnexMock() { return { raw: jest.fn().mockResolvedValue({ rows: [{ value: 1 }] }) }; }
function createFailingKnexMock() { return { raw: jest.fn().mockRejectedValue(new Error('database unavailable')) }; }
module.exports = { createKnexMock, createFailingKnexMock };
