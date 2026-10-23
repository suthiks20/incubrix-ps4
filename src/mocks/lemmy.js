/**
 * Simulates the Lemmy endpoints used by the native connector.
 * Each scenario requires a login-issued Bearer token and owns its state.
 */
const scenarios = new Map();

function stateFor(name) {
  if (!scenarios.has(name)) scenarios.set(name, { posts: [], nextId: 1, logins: 0, post_attempts: 0, rateLimited: false });
  return scenarios.get(name);
}
function error(reply, status, message) { return reply.code(status).send({ error: message }); }
function bearer(request, scenario) { return request.headers.authorization === `Bearer lemmy-${scenario}-jwt`; }
function authenticate(request, reply) {
  if (bearer(request, request.params.scenario)) return true;
  error(reply, 401, 'JWT is required');
  return false;
}
function resetTime(seconds) { return String(Math.floor(Date.now() / 1000) + seconds); }

async function mock(app) {
  app.post('/mock/lemmy/:scenario/api/v3/user/login', async (request, reply) => {
    const state = stateFor(request.params.scenario);
    state.logins += 1;
    if (request.params.scenario === 'expired_token' || request.body.password !== 'lemmy-password') {
      return error(reply, 401, 'Login rejected');
    }
    return { jwt: `lemmy-${request.params.scenario}-jwt` };
  });
  app.get('/mock/lemmy/:scenario/api/v3/community', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    if (request.query.name !== 'incubrix_test') return error(reply, 404, 'Community not found');
    return { community_view: { community: { id: 7, name: 'incubrix_test' } } };
  });
  app.post('/mock/lemmy/:scenario/api/v3/post', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.post_attempts += 1;
    if (request.params.scenario === 'content_rejected') return error(reply, 422, 'Post rejected');
    if (request.params.scenario === 'rate_limit_long') {
      reply.header('X-RateLimit-Reset', resetTime(120));
      return error(reply, 429, 'Rate limited');
    }
    if (request.params.scenario === 'rate_limit_short' && !state.rateLimited) {
      state.rateLimited = true;
      reply.header('X-RateLimit-Reset', resetTime(1));
      return error(reply, 429, 'Rate limited');
    }
    const post = { id: state.nextId++, body: request.body.body, deleted: false };
    state.posts.push(post);
    if (request.params.scenario === 'timeout_after_success') { reply.raw.destroy(); return reply; }
    if (request.params.scenario === 'renamed_field') return { post_view: { article: post } };
    return { post_view: { post } };
  });
  app.get('/mock/lemmy/:scenario/api/v3/post', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const post = stateFor(request.params.scenario).posts.find((entry) => String(entry.id) === String(request.query.id));
    if (!post) return error(reply, 404, 'Post not found');
    return { post_view: { post } };
  });
  app.post('/mock/lemmy/:scenario/api/v3/post/delete', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const post = stateFor(request.params.scenario).posts.find((entry) => entry.id === request.body.post_id);
    if (!post) return error(reply, 404, 'Post not found');
    post.deleted = Boolean(request.body.deleted);
    return { post_view: { post } };
  });
  app.get('/mock/lemmy/:scenario/api/v3/search', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const posts = stateFor(request.params.scenario).posts.filter((entry) => entry.body.includes(request.query.q));
    return { posts: posts.map((post) => ({ post })) };
  });
  app.get('/mock/lemmy/:scenario/_state', async (request) => stateFor(request.params.scenario));
  app.post('/mock/lemmy/:scenario/_reset', async (request) => { scenarios.delete(request.params.scenario); return { reset: true }; });
}
module.exports = mock;
