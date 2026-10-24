/**
 * Holds local MRSS mock items and builds the public feed representation.
 * XML text and attribute values are escaped before they reach the response.
 */
export interface FeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  guid: string;
  media_url: string;
  media_type: string;
}

const itemsByFeed = new Map<string, Map<string, FeedItem>>();

function feedKey(scenario: string, destinationId: string): string {
  return `${scenario}:${destinationId}`;
}

function list(scenario: string, destinationId: string): FeedItem[] {
  return [...(itemsByFeed.get(feedKey(scenario, destinationId))?.values() || [])];
}

function find(scenario: string, destinationId: string, id: string): FeedItem | undefined {
  return itemsByFeed.get(feedKey(scenario, destinationId))?.get(id);
}

function add(scenario: string, destinationId: string, item: FeedItem): FeedItem {
  const key = feedKey(scenario, destinationId);
  if (!itemsByFeed.has(key)) itemsByFeed.set(key, new Map());
  const items = itemsByFeed.get(key) as Map<string, FeedItem>;
  const existing = [...items.values()].find((entry) => entry.guid === item.guid);
  if (existing) return existing;
  items.set(item.id, item);
  return item;
}

function remove(scenario: string, destinationId: string, id: string): boolean {
  return itemsByFeed.get(feedKey(scenario, destinationId))?.delete(id) || false;
}

function resetScenario(scenario: string): void {
  for (const key of itemsByFeed.keys()) {
    if (key.startsWith(`${scenario}:`)) itemsByFeed.delete(key);
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character] as string);
}

function renderFeed(title: string, link: string, items: FeedItem[]): string {
  const entries = items.map((item) =>
    `<item><title>${escapeXml(item.title)}</title>` +
    `<description>${escapeXml(item.description)}</description>` +
    `<link>${escapeXml(item.link)}</link>` +
    `<guid isPermaLink="false">${escapeXml(item.guid)}</guid>` +
    `<media:content url="${escapeXml(item.media_url)}" type="${escapeXml(item.media_type)}"/>` +
    '</item>'
  ).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>' +
    `<title>${escapeXml(title)}</title><link>${escapeXml(link)}</link>` +
    `<description>${escapeXml(title)}</description>${entries}</channel></rss>`;
}

export { add, escapeXml, find, list, remove, renderFeed, resetScenario };
