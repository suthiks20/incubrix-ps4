/**
 * Simulates the MRSS item store and its platform failure scenarios.
 * It stores only content and opaque markers; authorization values are never returned.
 */
const feedStore = require('../modules/connectors/mrss/feedStore');

const scenarios = new Map();
function stateFor(name) {
  if (!scenarios.has(name)) {
    scenarios.set(name, { post_attempts: 0, delete_attempts: 0, rateLimited: false });
  }
  return scenarios.get(name);
}
function error(reply, status, message) { return reply.code(status).send({ error: message }); }
function authorized(request, reply) {
  if (String(request.headers.authorization || '').startsWith('Bearer ')) return true;
  error(reply, 401, 'Connection token is invalid');
  return false;
}
function itemFor(request, id) {
  return feedStore.find(request.params.scenario, request.query.destination_id, id);
}

async function mock(app) {
  app.post('/mock/mrss/:scenario/items', async (request, reply) => {
    if (!authorized(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    const scenario = request.params.scenario;
    state.post_attempts += 1;
    if (scenario === 'expired_token') return error(reply, 401, 'Token expired');
    if (scenario === 'unavailable') return error(reply, 503, 'Service unavailable');
    if (scenario === 'content_rejected') return error(reply, 422, 'Video rejected');
    if (scenario === 'rate_limit_long') {
      reply.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 120));
      return error(reply, 429, 'Rate limited');
    }
    const input = request.body;
    const prior = feedStore.list(scenario, input.destination_id).find((item) => item.guid === input.guid);
    const item = prior || feedStore.add(scenario, input.destination_id, {
      id: `mrss-${state.post_attempts}`,
      title: input.title,
      description: input.description,
      link: input.link,
      guid: input.guid,
      media_url: input.media_url,
      media_type: input.media_type
    });
    if (scenario === 'timeout_after_success') {
      reply.raw.destroy();
      return reply;
    }
    if (scenario === 'renamed_field') return { item: { video: item } };
    return { item };
  });
  app.get('/mock/mrss/:scenario/items', async (request, reply) => {
    if (!authorized(request, reply)) return reply;
    const items = feedStore.list(request.params.scenario, request.query.destination_id);
    return { items: items.filter((item) => item.guid === request.query.guid) };
  });
  app.get('/mock/mrss/:scenario/items/:id', async (request, reply) => {
    if (!authorized(request, reply)) return reply;
    const item = itemFor(request, request.params.id);
    return item ? { item } : error(reply, 404, 'Item not found');
  });
  app.delete('/mock/mrss/:scenario/items/:id', async (request, reply) => {
    if (!authorized(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.delete_attempts += 1;
    if (request.params.scenario === 'delete_fails_once' && state.delete_attempts === 1) {
      return error(reply, 503, 'Delete unavailable');
    }
    if (request.params.scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
      return error(reply, 503, 'Delete unavailable');
    }
    const deleted = feedStore.remove(request.params.scenario, request.query.destination_id, request.params.id);
    return deleted ? { deleted } : error(reply, 404, 'Item not found');
  });
  app.get('/mock/mrss/:scenario/_state', async (request) => {
    const state = stateFor(request.params.scenario);
    return { ...state, posts: feedStore.list(request.params.scenario, request.query.destination_id || '') };
  });
  app.post('/mock/mrss/:scenario/_reset', async (request) => {
    scenarios.delete(request.params.scenario);
    feedStore.resetScenario(request.params.scenario);
    return { reset: true };
  });
}

module.exports = mock;
