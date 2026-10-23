/**
 * Simulates the Dev.to article endpoints used by the native connector.
 * State is per fault scenario and exists only when simulation mode mounts this module.
 */
const scenarios = new Map();

function stateFor(name) {
  if (!scenarios.has(name)) {
    scenarios.set(name, {
      articles: [],
      nextId: 1,
      post_attempts: 0,
      delete_attempts: 0,
      rateLimited: false
    });
  }
  return scenarios.get(name);
}

function apiUrl(request, id) {
  return `${request.protocol}://${request.headers.host}/mock/devto/${request.params.scenario}/api/articles/${id}`;
}

function error(reply, status, text) {
  return reply.code(status).send({ error: text, status });
}

function authenticate(request, reply) {
  if (request.headers['api-key']) return true;
  error(reply, 401, 'API key is required');
  return false;
}

async function mock(app) {
  app.post('/mock/devto/:scenario/api/articles', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    const scenario = request.params.scenario;
    state.post_attempts += 1;
    if (scenario === 'expired_token') return error(reply, 401, 'API key expired');
    if (scenario === 'content_rejected' || request.body.article.title.length < 5) {
      return error(reply, 422, 'Article content was rejected');
    }
    if (scenario === 'unavailable') return error(reply, 503, 'Service unavailable');
    if (scenario === 'rate_limit_long') {
      reply.header('Retry-After', '120');
      return error(reply, 429, 'Rate limited');
    }
    if (scenario === 'rate_limit_short' && !state.rateLimited) {
      state.rateLimited = true;
      reply.header('Retry-After', '1');
      return error(reply, 429, 'Rate limited');
    }
    const id = state.nextId++;
    const article = {
      id,
      url: apiUrl(request, id),
      published: request.body.article.published,
      body_markdown: request.body.article.body_markdown,
      title: request.body.article.title
    };
    state.articles.push(article);
    if (scenario === 'timeout_after_success') {
      reply.raw.destroy();
      return reply;
    }
    if (scenario === 'renamed_field') return { id, article_url: article.url };
    return { id, url: article.url };
  });

  app.get('/mock/devto/:scenario/api/articles/me/all', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    return stateFor(request.params.scenario).articles;
  });

  app.get('/mock/devto/:scenario/api/articles/:id', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const article = stateFor(request.params.scenario).articles.find((item) => String(item.id) === request.params.id);
    if (!article) return error(reply, 404, 'Article not found');
    return article;
  });

  app.put('/mock/devto/:scenario/api/articles/:id', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const state = stateFor(request.params.scenario);
    state.delete_attempts += 1;
    if (request.params.scenario === 'delete_fails_once' && state.delete_attempts === 1) {
      return error(reply, 503, 'Service unavailable');
    }
    if (request.params.scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
      return error(reply, 503, 'Service unavailable');
    }
    const article = state.articles.find((item) => String(item.id) === request.params.id);
    if (!article) return error(reply, 404, 'Article not found');
    article.published = request.body.article.published;
    return article;
  });

  app.get('/mock/devto/:scenario/_state', async (request) => ({ ...stateFor(request.params.scenario) }));
  app.post('/mock/devto/:scenario/_reset', async (request) => {
    scenarios.delete(request.params.scenario);
    return { reset: true };
  });
}

module.exports = mock;
