/**
 * Collects endpoint schemas for the destination route definitions.
 * Shared resource properties live in destination.js.
 */
module.exports = {
  create: require('./create'), getAll: require('./getAll'), getById: require('./getById'),
  update: require('./update'), delete: require('./delete')
};
