/**
 * Simulates the Hashnode GraphQL mutations and post lookup for certification.
 * Scenario state is isolated and never includes authorization data.
 */
const publications = new Map();

function stateFor(name) {
  if (!publications.has(name)) {
    publications.set(name, { posts: [], nextId: 1, post_attempts: 0, delete_attempts: 0 });
  }
  return publications.get(name);
}
function error(reply, status, message) {
  if (status === 429) reply.header('Retry-After', '120');
  return reply.code(status).send({ errors: [{ message }] });
}
function authenticated(request, reply) {
  if (typeof request.headers.authorization === 'string' && request.headers.authorization) return true;
  error(reply, 401, 'Unauthorized: invalid auth');
  return false;
}
function renamed(post) {
  const { slug, ...rest } = post;
  return { ...rest, postSlug: slug };
}

async function mock(app) {
  app.post('/mock/hashnode/:scenario', async (request, reply) => {
    if (!authenticated(request, reply)) return reply;
    const scenario = request.params.scenario;
    const state = stateFor(scenario);
    const query = request.body.query || '';
    if (scenario === 'expired_token') return error(reply, 200, 'Token revoked');
    if (scenario === 'unavailable') return error(reply, 503, 'Service unavailable');
    if (scenario === 'rate_limit_long') return error(reply, 429, 'Rate limit exceeded');
    if (scenario === 'content_rejected' && query.includes('publishPost')) {
      return error(reply, 200, 'Content rejected');
    }
    if (query.includes('publishPost')) {
      state.post_attempts += 1;
      const input = request.body.variables.input;
      let post = state.posts.find((item) => item.slug === input.slug);
      if (!post) {
        post = {
          id: `hashnode-${state.nextId++}`,
          slug: input.slug,
          title: input.title,
          contentMarkdown: input.contentMarkdown,
          url: `https://hashnode.example.test/${input.slug}`
        };
        state.posts.push(post);
      }
      if (scenario === 'timeout_after_success') {
        reply.raw.destroy();
        return reply;
      }
      return {
        data: {
          publishPost: { post: scenario === 'renamed_field' ? renamed(post) : post }
        }
      };
    }
    if (query.includes('postBySlug')) {
      const post = state.posts.find((item) => item.slug === request.body.variables.slug);
      return {
        data: {
          postBySlug: post
            ? scenario === 'renamed_field' ? renamed(post) : post
            : null
        }
      };
    }
    if (query.includes('removePost')) {
      state.delete_attempts += 1;
      if (scenario === 'delete_fails_once' && state.delete_attempts === 1) {
        return error(reply, 503, 'Service unavailable');
      }
      if (scenario === 'delete_fails_twice' && state.delete_attempts <= 2) {
        return error(reply, 503, 'Service unavailable');
      }
      const id = request.body.variables.input.postId;
      const index = state.posts.findIndex((item) => item.id === id);
      if (index < 0) return error(reply, 200, 'Post not found');
      const [post] = state.posts.splice(index, 1);
      return { data: { removePost: { post: { id: post.id } } } };
    }
    if (query.includes('post(')) {
      const post = state.posts.find((item) => item.id === request.body.variables.id);
      return {
        data: {
          post: post
            ? scenario === 'renamed_field' ? renamed(post) : post
            : null
        }
      };
    }
    return error(reply, 400, 'Unknown GraphQL operation');
  });
  app.get('/mock/hashnode/:scenario/_state', async (request) => stateFor(request.params.scenario));
  app.post('/mock/hashnode/:scenario/_reset', async (request) => {
    publications.delete(request.params.scenario);
    return { reset: true };
  });
}

module.exports = mock;
