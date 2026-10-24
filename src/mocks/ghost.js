/**
 * Simulates Ghost Admin posts and verifies the signed Ghost JWT header.
 * The fixed mock key is obviously fake and is accepted only in simulation.
 */
const crypto = require('crypto');
const scenarios = new Map();
const adminKey = 'fake-ghost-id:00112233445566778899aabbccddeeff';

function stateFor(name) {
  if (!scenarios.has(name)) {
    scenarios.set(name, { posts: [], nextId: 1, post_attempts: 0, delete_attempts: 0, rateLimited: false });
  }
  return scenarios.get(name);
}
function error(reply, status, message) { return reply.code(status).send({ errors: [message] }); }
function validToken(value) {
  if (typeof value !== 'string' || !value.startsWith('Ghost ')) return false;
  const token = value.slice(6);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const expected = crypto.createHmac('sha256', Buffer.from(adminKey.split(':')[1], 'hex')).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  try { return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected)); } catch { return false; }
}
function authenticate(request, reply) { if (validToken(request.headers.authorization)) return true; error(reply, 401, 'Admin API authentication required'); return false; }
function resetTime(seconds) { return String(Math.floor(Date.now() / 1000) + seconds); }

async function mock(app) {
  app.post('/mock/ghost/:scenario/ghost/api/admin/posts/', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.post_attempts += 1;
    const scenario = request.params.scenario;
    if (scenario === 'expired_token') return error(reply, 401, 'Admin token expired');
    if (scenario === 'unavailable') return error(reply, 503, 'Service unavailable');
    if (scenario === 'content_rejected') return error(reply, 422, 'Post rejected');
    if (scenario === 'rate_limit_long') { reply.header('X-RateLimit-Reset', resetTime(120)); return error(reply, 429, 'Rate limited'); }
    if (['rate_limit', 'rate_limit_short'].includes(scenario) && !state.rateLimited) {
      state.rateLimited = true;
      reply.header('X-RateLimit-Reset', resetTime(1));
      return error(reply, 429, 'Rate limited');
    }
    const input = request.body.posts[0];
    const post = {
      id: String(state.nextId++), slug: input.slug, html: input.html,
      views: 321, likes: 17, comments: 6, shares: 3, saves: 2, watch_time_s: 45, clicks: 9
    };
    state.posts.push(post);
    if (request.params.scenario === 'timeout_after_success') { reply.raw.destroy(); return reply; }
    if (request.params.scenario === 'renamed_field') return { posts: [{ post_id: post.id, slug: post.slug }] };
    return { posts: [post] };
  });
  app.get('/mock/ghost/:scenario/ghost/api/admin/posts/slug/:slug/', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const post = stateFor(request.params.scenario).posts.find((entry) => entry.slug === request.params.slug);
    if (!post) return error(reply, 404, 'Post not found');
    return { posts: [post] };
  });
  app.get('/mock/ghost/:scenario/ghost/api/admin/posts/:id/', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const post = stateFor(request.params.scenario).posts.find((entry) => entry.id === request.params.id);
    if (!post) return error(reply, 404, 'Post not found');
    return { posts: [post] };
  });
  app.delete('/mock/ghost/:scenario/ghost/api/admin/posts/:id/', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.delete_attempts += 1;
    if (request.params.scenario === 'delete_fails_once' && state.delete_attempts === 1) {
      return error(reply, 503, 'Service unavailable');
    }
    if (request.params.scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
      return error(reply, 503, 'Service unavailable');
    }
    const index = state.posts.findIndex((entry) => entry.id === request.params.id);
    if (index < 0) return error(reply, 404, 'Post not found');
    state.posts.splice(index, 1);
    return reply.code(204).send();
  });
  app.get('/mock/ghost/:scenario/_state', async (request) => stateFor(request.params.scenario));
  app.post('/mock/ghost/:scenario/_reset', async (request) => { scenarios.delete(request.params.scenario); return { reset: true }; });
}
module.exports = mock;
