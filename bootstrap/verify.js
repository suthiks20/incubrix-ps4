/**
 * Verifies marker create, read, and deletion flows against local Lemmy and Ghost.
 * It reads gitignored bootstrap output and never prints connection credentials.
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const output = path.join(__dirname, '..', 'bootstrap-output.json');
const lemmyUrl = process.env.LEMMY_URL || 'http://127.0.0.1:8536';
const ghostUrl = process.env.GHOST_URL || 'http://127.0.0.1:2368';

function ghostToken(key) {
  const [id, secret] = key.split(':');
  const iat = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`);
  return `${header}.${payload}.${signature.digest('base64url')}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { response, json };
}

async function verifyLemmy(values) {
  const marker = `ix-local-${Date.now()}`;
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${values.lemmy.jwt}` };
  const create = await request(`${lemmyUrl}/api/v3/post`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ community_id: values.lemmy.community_id, name: 'Verification', body: marker })
  });
  if (!create.response.ok) throw new Error(`Lemmy create ${create.response.status}`);
  const id = create.json.post_view.post.id;
  const read = await request(`${lemmyUrl}/api/v3/post?id=${id}`, { headers });
  const deleted = await request(`${lemmyUrl}/api/v3/post/delete`, {
    method: 'POST', headers, body: JSON.stringify({ post_id: id, deleted: true })
  });
  const after = await request(`${lemmyUrl}/api/v3/post?id=${id}`, { headers });
  console.log(JSON.stringify({ lemmy: { post_id: id, body: read.json.post_view.post.body,
    delete_status: deleted.response.status, deleted: after.json.post_view.post.deleted } }));
}

async function verifyGhost(values) {
  const marker = `ix-local-${Date.now()}`;
  const headers = { 'content-type': 'application/json', 'accept-version': 'v6.0',
    authorization: `Ghost ${ghostToken(values.ghost.admin_api_key)}` };
  const create = await request(`${ghostUrl}/ghost/api/admin/posts/?source=html`, {
    method: 'POST', headers, body: JSON.stringify({ posts: [{ title: 'Verification', slug: marker,
      html: `<p>${marker}</p>`, status: 'draft' }] })
  });
  if (!create.response.ok) throw new Error(`Ghost create ${create.response.status}`);
  const id = create.json.posts[0].id;
  const read = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/?formats=html`, { headers });
  const deleted = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/`, { method: 'DELETE', headers });
  const after = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/`, { headers });
  console.log(JSON.stringify({ ghost: { post_id: id, slug: read.json.posts[0].slug,
    delete_status: deleted.response.status, after_status: after.response.status } }));
}

async function main() {
  const values = JSON.parse(await fs.readFile(output, 'utf8'));
  const target = process.argv[2] || 'all';
  if (target === 'all' || target === 'lemmy') await verifyLemmy(values);
  if (target === 'all' || target === 'ghost') await verifyGhost(values);
}

main().catch((error) => { console.error(`verify failed: ${error.message}`); process.exit(1); });
