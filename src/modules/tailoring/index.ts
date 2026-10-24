/**
 * Provides pure tailoring helpers for different destination styles.
 * The functions are deterministic and require no network access.
 */

const TOPIC_KEYWORDS = {
  ai: ['ai', 'automation', 'assistant', 'model'],
  video: ['video', 'streaming', 'recording', 'demo'],
  marketing: ['marketing', 'campaign', 'launch', 'growth'],
  saas: ['saas', 'software', 'product', 'platform'],
  creators: ['creator', 'creator economy', 'creator-led'],
  founders: ['founder', 'founders', 'startup', 'build']
};

function normalizeText(value: any): string {
  return String(value || '').trim();
}

function wordBoundaryTruncate(text: string, limit: number): string {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : text.length;
  if (text.length <= safeLimit) return text;
  const short = text.slice(0, safeLimit).trim();
  const lastSpace = short.lastIndexOf(' ');
  if (lastSpace > 12) return `${short.slice(0, lastSpace).trim()}…`;
  return `${short.trim()}…`;
}

function inferPlatform(destination: any): string {
  return String(destination?.platform_key || destination?.connector_key || 'discourse').toLowerCase();
}

function applyForumReframe(title: string, body: string): { title: string; body: string } {
  const trimmedTitle = normalizeText(title);
  const trimmedBody = normalizeText(body);
  if (!trimmedTitle) return { title: trimmedTitle, body: trimmedBody };
  const discussionTitle = trimmedTitle.toLowerCase().startsWith('discussion:')
    ? trimmedTitle
    : `Discussion: ${trimmedTitle}`;
  const discussionBody = trimmedBody
    ? `I’m opening this for discussion:\n\n${trimmedBody}`
    : 'I’m opening this for discussion.';
  return { title: discussionTitle, body: discussionBody };
}

function applyArticleCanonicalUrl(body: string, canonicalUrl: string): string {
  const trimmedBody = normalizeText(body);
  const trimmedUrl = normalizeText(canonicalUrl);
  if (!trimmedUrl) return trimmedBody;
  if (trimmedBody.includes(trimmedUrl)) return trimmedBody;
  return `${trimmedBody}\n\nRead more: ${trimmedUrl}`;
}

function addPlatformTags(
  platform: string,
  body: string,
  context: string = body
): { body: string; tags: string[] } {
  const lowerContext = context.toLowerCase();
  const tags: string[] = [];
  if (platform === 'devto') {
    if (lowerContext.includes('ai')) tags.push('#ai');
    if (lowerContext.includes('saas')) tags.push('#saas');
    if (lowerContext.includes('marketing')) tags.push('#marketing');
    if (tags.length === 0) tags.push('#build');
    return { body: `${body}${tags.length ? ` ${tags.join(' ')}` : ''}`.trim(), tags };
  }
  return { body, tags: [] };
}

function normaliseTags(destination: any, body: string, context: string): { body: string; tags: string[] } {
  const platform = inferPlatform(destination);
  return addPlatformTags(platform, body, context);
}

function scoreRelevance(input: any): { relevance_score: number; relevance_reason: string } {
  const text = `${input?.title || ''} ${input?.body || ''} ${Array.isArray(input?.tags) ? input.tags.join(' ') : ''}`.toLowerCase();
  const matches = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword.toLowerCase())))
    .map(([key]) => key);
  const score = Math.max(1, Math.min(5, matches.length || 1));
  const reason = matches.length
    ? `This content overlaps with ${matches.join(', ')} and scores ${score}/5.`
    : `No strong overlap with the target themes; score ${score}/5.`;
  return { relevance_score: score, relevance_reason: reason };
}

function tailorRendition(destination: any, rendition: any): { tailored_rendition: any; changes: any[]; relevance_score: number; relevance_reason: string } {
  const platform = inferPlatform(destination);
  const input = { ...(rendition || {}) };
  const titleLimit = Number(destination?.config?.max_title_length || destination?.max_title_length || { discourse: 280, lemmy: 200, devto: 170, ghost: 200 }[platform] || 280);
  const bodyLimit = Number(destination?.config?.max_body_length || destination?.max_body_length || { discourse: 4000, lemmy: 6000, devto: 20000, ghost: 20000 }[platform] || 4000);
  let title = normalizeText(input.title);
  let body = normalizeText(input.body);
  const changes: any[] = [];

  if (platform === 'discourse' || platform === 'lemmy') {
    const before = { title, body };
    const framed = applyForumReframe(title, body);
    title = framed.title;
    body = framed.body;
    if (before.title !== title || before.body !== body) {
      changes.push({ field: 'title', before: before.title, after: title, why: 'Forum posts should open with a discussion-first framing.' });
      changes.push({ field: 'body', before: before.body, after: body, why: 'Forum posts benefit from a discussion opener before the details.' });
    }
  }

  if ((platform === 'devto' || platform === 'ghost') && input.canonical_url) {
    const before = body;
    body = applyArticleCanonicalUrl(body, input.canonical_url);
    if (before !== body) {
      changes.push({ field: 'body', before, after: body, why: 'Article-style destinations keep a clear canonical reference for the reader.' });
    }
  }

  if (platform === 'devto') {
    const before = body;
    const withTags = normaliseTags(destination, body, `${title} ${body}`);
    body = withTags.body;
    if (before !== body) {
      changes.push({ field: 'body', before, after: body, why: 'Dev.to posts use platform tags to improve discoverability.' });
    }
  }

  const truncatedTitle = wordBoundaryTruncate(title, titleLimit);
  if (truncatedTitle !== title) {
    changes.push({ field: 'title', before: title, after: truncatedTitle, why: `Title exceeds the ${titleLimit}-character platform limit.` });
    title = truncatedTitle;
  }

  const truncatedBody = wordBoundaryTruncate(body, bodyLimit);
  if (truncatedBody !== body) {
    changes.push({ field: 'body', before: body, after: truncatedBody, why: `Body exceeds the ${bodyLimit}-character platform limit.` });
    body = truncatedBody;
  }

  const tailored = {
    ...input,
    title,
    body,
    language: input.language || 'en',
    canonical_url: input.canonical_url || null,
    links: Array.isArray(input.links) ? input.links : []
  };

  const relevance = scoreRelevance({ title, body, tags: [] });
  return { tailored_rendition: tailored, changes, relevance_score: relevance.relevance_score, relevance_reason: relevance.relevance_reason };
}

export = { tailorRendition, scoreRelevance, wordBoundaryTruncate };
