/**
 * Simulates the small Discourse API surface used by the connector.
 * It is registered only in simulation mode and keeps posts in scenario-local memory.
 */
const AppError = require('../shared/errors/AppError');
const scenarios = new Map();
function stateFor(name) {
  if (!scenarios.has(name)) scenarios.set(name, { posts: [], nextId: 1, rateLimited: false, post_attempts: 0 });
  return scenarios.get(name);
}
async function mock(app) {
  app.post('/mock/discourse/:scenario/posts.json', async (request, reply) => {
    const scenario = request.params.scenario;
    const state = stateFor(scenario);
    state.post_attempts += 1;
    if (!request.headers['api-key'] || !request.headers['api-username']) throw new AppError('UNAUTHORIZED', 'API credentials are required', { statusCode: 401 });
    if (scenario === 'expired_token') return reply.code(401).send({ errors: ['API key expired'] });
    if (scenario === 'revoked') return reply.code(403).send({ errors: ['API key revoked'] });
    if (scenario === 'content_rejected' || request.body.title.length < 15) return reply.code(422).send({ errors: ['Title is too short'] });
    if (scenario === 'unavailable') return reply.code(503).send({ error: 'temporarily unavailable' });
    if (scenario === 'rate_limit' && !state.rateLimited) { state.rateLimited = true; reply.header('Retry-After', '1'); return reply.code(429).send({ errors: ['rate limited'] }); }
    if (scenario === 'rate_limit_long') { reply.header('Retry-After', '120'); return reply.code(429).send({ errors: ['rate limited'] }); }
    if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 300));
    const id = state.nextId++;
    const slug = request.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const post = { id, topic_id: id, topic_slug: slug, raw: request.body.raw, title: request.body.title };
    state.posts.push(post);
    if (scenario === 'timeout_after_success') { reply.raw.destroy(); return reply; }
    if (scenario === 'renamed_field') return { id, topic_identifier: id, topic_slug: slug };
    return { id, topic_id: id, topic_slug: slug };
  });
  app.get('/mock/discourse/:scenario/t/:id.json', async (request, reply) => {
    const post = stateFor(request.params.scenario).posts.find((item) => String(item.topic_id) === request.params.id);
    if (!post) return reply.code(404).send({ errors: ['not found'] });
    return { id: post.id, slug: post.topic_slug };
  });
  app.delete('/mock/discourse/:scenario/t/:id.json', async (request, _reply) => {
    const state = stateFor(request.params.scenario);
    state.posts = state.posts.filter((item) => String(item.topic_id) !== request.params.id);
    return { success: true };
  });
  app.get('/mock/discourse/:scenario/search.json', async (request) => ({ posts: stateFor(request.params.scenario).posts.filter((post) => post.raw.includes(request.query.q.replace('ix-ref:', 'ix-ref:'))) }));
  app.get('/mock/discourse/:scenario/_state', async (request) => ({ ...stateFor(request.params.scenario) }));
  app.post('/mock/discourse/:scenario/_reset', async (request) => { scenarios.delete(request.params.scenario); return { reset: true }; });
}
module.exports = mock;
