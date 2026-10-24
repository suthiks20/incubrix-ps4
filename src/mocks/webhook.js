/**
 * Simulates a signed partner endpoint for integration tests in simulation mode.
 * It uses an explicitly fake test secret and stores posts only in memory.
 */
const { sign } = require('../modules/connectors/webhook/sign');
const states = new Map();
const TEST_SECRET = 'test-signing-secret';
function stateFor(name) {
  if (!states.has(name)) {
    states.set(name, { posts: [], nextId: 1, post_attempts: 0, delete_attempts: 0, rateLimited: false });
  }
  return states.get(name);
}
function authorized(request) {
  const timestamp = request.headers['x-incubrix-timestamp'];
  const signature = request.headers['x-incubrix-signature'];
  const raw = request.body === undefined ? '' : JSON.stringify(request.body);
  return timestamp && Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) <= 300 && signature === sign(TEST_SECRET, timestamp, raw);
}
async function mock(app) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/mock/webhook/') || request.url.includes('/_state') || request.url.includes('/_reset')) return;
    if (!authorized(request)) return reply.code(401).send({ error: 'bad signature' });
  });
  app.post('/mock/webhook/:scenario/posts', async (request, reply) => {
    const scenario = request.params.scenario; const state = stateFor(scenario); state.post_attempts += 1;
    if (scenario === 'bad_signature') return reply.code(401).send({ error: 'bad signature' });
    if (scenario === 'expired_token') return reply.code(401).send({ error: 'partner token expired' });
    if (scenario === 'partner_revoked' || scenario === 'revoked') return reply.code(403).send({ error: 'permission revoked by partner' });
    if (scenario === 'content_rejected') return reply.code(422).send({ error: 'content rejected' });
    if (scenario === 'unavailable') return reply.code(503).send({ error: 'temporarily unavailable' });
    if (scenario === 'rate_limit_long') { reply.header('Retry-After', '120'); return reply.code(429).send({ error: 'rate limited' }); }
    if (scenario === 'rate_limit' && !state.rateLimited) {
      state.rateLimited = true;
      reply.header('Retry-After', '1');
      return reply.code(429).send({ error: 'rate limited' });
    }
    const id = state.nextId++; const post = { id, ...request.body, url: `${request.protocol}://${request.hostname}/mock/webhook/${scenario}/posts/${id}` }; state.posts.push(post);
    if (scenario === 'timeout_after_success') { reply.raw.destroy(); return reply; }
    if (scenario === 'renamed_field') return { id, post_url: post.url };
    return { id, url: post.url };
  });
  app.get('/mock/webhook/:scenario/posts', async (request) => ({ posts: stateFor(request.params.scenario).posts.filter((post) => post.ix_ref === request.query.ix_ref) }));
  app.get('/mock/webhook/:scenario/posts/:id', async (request, reply) => { const post = stateFor(request.params.scenario).posts.find((item) => String(item.id) === request.params.id); return post ? { id: post.id, url: post.url } : reply.code(404).send({ error: 'not found' }); });
  app.delete('/mock/webhook/:scenario/posts/:id', async (request, reply) => {
    const state = stateFor(request.params.scenario);
    state.delete_attempts += 1;
    if (request.params.scenario === 'delete_fails_once' && state.delete_attempts === 1) {
      return reply.code(503).send({ error: 'temporarily unavailable' });
    }
    if (request.params.scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
      return reply.code(503).send({ error: 'temporarily unavailable' });
    }
    state.posts = state.posts.filter((post) => String(post.id) !== request.params.id);
    return { deleted: true };
  });
  app.get('/mock/webhook/:scenario/_state', async (request) => stateFor(request.params.scenario));
  app.post('/mock/webhook/:scenario/_reset', async (request) => { states.delete(request.params.scenario); return { reset: true }; });
}
module.exports = mock;
