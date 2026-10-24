/**
 * Simulates Slack chat and history methods with isolated workspace scenarios.
 * Failure responses use Slack's HTTP-200 { ok: false } shape where applicable.
 */
const workspaces = new Map();

function stateFor(name) {
  if (!workspaces.has(name)) {
    workspaces.set(name, { messages: [], nextId: 1, post_attempts: 0, delete_attempts: 0 });
  }
  return workspaces.get(name);
}
function fault(reply, status, code) {
  if (status === 429) reply.header('Retry-After', '120');
  return reply.code(status).send({ ok: false, error: code });
}
function auth(request, reply) {
  if (String(request.headers.authorization || '').startsWith('Bearer ')) return true;
  fault(reply, 200, 'invalid_auth');
  return false;
}
function renamed(message) {
  const { ts, ...rest } = message;
  return { ...rest, timestamp: ts };
}

async function mock(app) {
  app.post('/mock/slack/:scenario/api/chat.postMessage', async (request, reply) => {
    if (!auth(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    const scenario = request.params.scenario;
    state.post_attempts += 1;
    if (scenario === 'expired_token') return fault(reply, 200, 'token_revoked');
    if (scenario === 'unavailable') return fault(reply, 503, 'server_error');
    if (scenario === 'rate_limit_long') return fault(reply, 429, 'ratelimited');
    if (scenario === 'content_rejected') return fault(reply, 200, 'invalid_blocks');
    const marker = request.body.metadata.event_payload.marker;
    let message = state.messages.find((item) => item.metadata.event_payload.marker === marker);
    if (!message) {
      const ts = `1700000000.${String(state.nextId++).padStart(6, '0')}`;
      message = {
        ts,
        channel: request.body.channel,
        text: request.body.text,
        metadata: request.body.metadata,
        user: 'U_TEST'
      };
      state.messages.push(message);
    }
    if (scenario === 'timeout_after_success') {
      reply.raw.destroy();
      return reply;
    }
    if (scenario === 'renamed_field') return { ok: true, message: renamed(message) };
    return { ok: true, message };
  });
  app.post('/mock/slack/:scenario/api/conversations.history', async (request, reply) => {
    if (!auth(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    if (request.params.scenario === 'expired_token') return fault(reply, 200, 'invalid_auth');
    if (request.params.scenario === 'unavailable') return fault(reply, 503, 'server_error');
    if (request.params.scenario === 'rate_limit_long') return fault(reply, 429, 'ratelimited');
    const messages = state.messages.filter((item) => item.channel === request.body.channel);
    return { ok: true, messages: request.params.scenario === 'renamed_field' ? messages.map(renamed) : messages };
  });
  app.post('/mock/slack/:scenario/api/chat.delete', async (request, reply) => {
    if (!auth(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.delete_attempts += 1;
    if (request.params.scenario === 'delete_fails_once' && state.delete_attempts === 1) {
      return fault(reply, 503, 'server_error');
    }
    if (request.params.scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
      return fault(reply, 503, 'server_error');
    }
    const index = state.messages.findIndex((item) =>
      item.ts === request.body.ts && item.channel === request.body.channel
    );
    if (index < 0) return fault(reply, 200, 'message_not_found');
    state.messages.splice(index, 1);
    return { ok: true, channel: request.body.channel, ts: request.body.ts };
  });
  app.get('/mock/slack/:scenario/_state', async (request) => stateFor(request.params.scenario));
  app.post('/mock/slack/:scenario/_reset', async (request) => {
    workspaces.delete(request.params.scenario);
    return { reset: true };
  });
}

module.exports = mock;
