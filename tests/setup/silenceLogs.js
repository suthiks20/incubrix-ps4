/**
 * Silences application logs in Jest before test modules load application config.
 * Production logging remains controlled by the real runtime environment.
 */
process.env.LOG_LEVEL = 'silent';
