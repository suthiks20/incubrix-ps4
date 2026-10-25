/**
 * Silences application logs in Jest before test modules load application config.
 * It pins app and LLM settings so host environment values cannot alter test results.
 */
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.API_TOKEN = '';
process.env.CONNECTORS_DISABLED = '';
process.env.SIMULATION_MODE = 'true';
process.env.SEED_DEMO = 'false';
process.env.STORAGE_DRIVER = 's3';
process.env.CONNECTION_LEMMY_LOCAL = '';
process.env.CONNECTION_GHOST_LOCAL = '';
process.env.CONNECTIONS_FILE = '/tmp/incubrix-test-connections.json';
process.env.JOBS_POLL_INTERVAL_MS = '1000';
process.env.JOBS_MAX_ATTEMPTS = '3';
process.env.JOBS_STALE_SECONDS = '300';
process.env.JOBS_CALLBACK_SECRET = 'test-callback-secret';
process.env.JOBS_CALLBACK_TIMEOUT_MS = '5000';
process.env.LLM_PROVIDER = 'mock';
process.env.GEMINI_API_KEY = '';
process.env.GROQ_API_KEY = '';
process.env.GEMINI_MODEL = '';
process.env.GROQ_MODEL = '';
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_MODEL = '';
process.env.LLM_TIMEOUT_MS = '10000';
