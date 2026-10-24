/**
 * Exposes all destination handlers through one stable import path.
 * Route definitions use this barrel to stay focused on HTTP wiring.
 */
module.exports = {
  create: require('./create'), getAll: require('./getAll'), getById: require('./getById'),
  update: require('./update'), delete: require('./delete'),
  captureRules: require('./rulesCapture'), confirmRules: require('./rulesConfirm')
};
