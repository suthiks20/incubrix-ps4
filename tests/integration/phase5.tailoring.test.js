/**
 * Covers the advanced tailoring, relevance and rules-capture work.
 * These tests use the in-memory app and the real Postgres test database.
 */
const { createContext, reset, createDestination } = require('./certification/helpers');
const { describe } = require('@jest/globals');

describe('phase 5 advanced items', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createContext();
  });

  beforeEach(async () => {
    await reset(ctx);
    ctx.app.ruleProposals.clear();
  });

  afterAll(async () => {
    await ctx.close();
  });

  test('tailor truncates at a word boundary', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'discourse', config: { max_title_length: 30 } },
        rendition: { title: 'This is a very long title that should be clipped cleanly', body: 'Alpha beta gamma delta' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tailored_rendition.title.length).toBeLessThanOrEqual(30);
    expect(body.tailored_rendition.title.endsWith('…')).toBe(true);
  });

  test('tailor adds canonical url for articles', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'devto', config: { max_body_length: 2000 } },
        rendition: { title: 'A useful article', body: 'We started from a clean baseline.', canonical_url: 'https://example.com/post/123' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tailored_rendition.body).toContain('https://example.com/post/123');
  });

  test('tailor reframes forum posts discussion-first', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'discourse', config: { max_title_length: 200 } },
        rendition: { title: 'Board update', body: 'Here is the plan for the next sprint.' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tailored_rendition.title.startsWith('Discussion:')).toBe(true);
    expect(body.tailored_rendition.body).toContain('discussion');
  });

  test('tailor reports every change', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'discourse', config: { max_title_length: 30 } },
        rendition: { title: 'This is definitely too long', body: 'Body text' }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().changes.length).toBeGreaterThan(0);
  });

  test('relevance score is between 1 and 5 with a reason', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'devto', config: { max_body_length: 2000 } },
        rendition: { title: 'AI tools for founders', body: 'A product and marketing launch review with video and SaaS notes.' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.relevance_score).toBeGreaterThanOrEqual(1);
    expect(body.relevance_score).toBeLessThanOrEqual(5);
    expect(body.relevance_reason).toEqual(expect.any(String));
    expect(body.relevance_reason.length).toBeGreaterThan(10);
  });

  test('capture works with no API key (mock adapter)', async () => {
    const destination = (await createDestination(ctx, 'discourse', 'normal'));
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/capture`,
      payload: { rules_text: 'No promotional content. Weekly cap 1 post per week. AI disclosure required.' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('PENDING');
    expect(response.json().rules.self_promo_allowed).toBe(false);
  });

  test('capture stores a pending proposal for the destination', async () => {
    const destination = (await createDestination(ctx, 'discourse', 'normal'));
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/capture`,
      payload: { rules_text: 'AI disclosure required. Max one link. English only.' }
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.proposal_id).toEqual(expect.any(String));
    expect(payload.rules.language).toBe('en');
  });

  test('confirming a proposal changes the next decision', async () => {
    const destination = (await createDestination(ctx, 'discourse', 'normal'));
    const capture = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/capture`,
      payload: { rules_text: 'No promotional content.' }
    });
    expect(capture.statusCode).toBe(200);
    const confirm = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/confirm`,
      payload: {}
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().status).toBe('CONFIRMED');

    const evaluate = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/rules/evaluate',
      payload: {
        destination: { ...JSON.parse(destination.config), self_promo_allowed: true },
        rendition: { title: 'Buy now', body: 'Limited offer today', is_promotional: true },
        proposed_rules: { status: 'CONFIRMED', rules: { self_promo_allowed: false } }
      }
    });
    expect(evaluate.statusCode).toBe(200);
    expect(['block', 'reschedule']).toContain(evaluate.json().decision);
  });

  test('unconfirmed proposals never affect rule decisions', async () => {
    const evaluate = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/rules/evaluate',
      payload: {
        destination: { self_promo_allowed: true },
        rendition: { title: 'Buy now', body: 'Limited offer', is_promotional: true },
        proposed_rules: { status: 'PENDING', rules: { self_promo_allowed: false } }
      }
    });
    expect(evaluate.statusCode).toBe(200);
    expect(evaluate.json().decision).toBe('allow');
  });

  test('tailor adds Dev.to tags for discoverability', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'devto', config: { max_body_length: 5000 } },
        rendition: { title: 'AI for SaaS teams', body: 'Marketing and product teams are both using AI workflows.' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tailored_rendition.body).toContain('#ai');
    expect(body.tailored_rendition.body).toContain('#saas');
  });

  test('tailor preserves article style for Ghost destinations', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'ghost', config: { max_title_length: 200 } },
        rendition: { title: 'Launch note', body: 'This is the release story.', canonical_url: 'https://ghost.example.com/launch' }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().tailored_rendition.body).toContain('https://ghost.example.com/launch');
  });

  test('capture accepts a url and stores the proposal source', async () => {
    const destination = (await createDestination(ctx, 'ghost', 'normal'));
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/capture`,
      payload: { url: 'https://example.com/rules', rules_text: 'English only. No promo. AI disclosure required.' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toBe('mock');
    expect(response.json().source).toBe('https://example.com/rules');
  });

  test('confirming a proposal records the status as confirmed', async () => {
    const destination = (await createDestination(ctx, 'lemmy', 'normal'));
    const capture = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/capture`,
      payload: { rules_text: 'No promotional content.' }
    });
    expect(capture.statusCode).toBe(200);
    const confirm = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/destinations/${destination.id}/rules/confirm`,
      payload: {}
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().status).toBe('CONFIRMED');
  });

  test('tailor keeps forum text under the destination title limit', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'lemmy', config: { max_title_length: 25 } },
        rendition: { title: 'This is a long discussion title for lemmy with too much text', body: 'The discussion body.' }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().tailored_rendition.title.length).toBeLessThanOrEqual(25);
  });

  test('tailor leaves non-article destinations without canonical links', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/tailor',
      payload: {
        destination: { platform_key: 'lemmy', config: { max_body_length: 5000 } },
        rendition: { title: 'An update', body: 'A short message.', canonical_url: 'https://example.com/alt' }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().tailored_rendition.body).not.toContain('https://example.com/alt');
  });
});
