/**
 * Drives both local APIs with credentials from the gitignored bootstrap output.
 * It prints stable ids and deletion evidence, never the credentials or JWT values.
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const valuesPath = path.join(__dirname, 'out.json');
const lemmyUrl = 'http://127.0.0.1:8536';
const ghostUrl = 'http://127.0.0.1:2368';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function ghostToken(key) {
  const [id, secret] = key.split(':');
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 300, aud: '/admin/' }));
  const signer = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  const signature = signer.update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { response, json };
}

async function verifyLemmy(values) {
  const marker = `ix-spike-${Date.now()}`;
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${values.lemmy.jwt}`
  };
  const body = {
    community_id: values.lemmy.community_id,
    name: 'Spike post',
    body: `Lemmy local verification ${marker}`
  };
  const created = await request(`${lemmyUrl}/api/v3/post`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!created.response.ok) throw new Error(`Lemmy create ${created.response.status}`);
  const id = created.json.post_view.post.id;
  const read = await request(`${lemmyUrl}/api/v3/post?id=${id}`, { headers });
  const removed = await request(`${lemmyUrl}/api/v3/post/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ post_id: id, deleted: true })
  });
  const after = await request(`${lemmyUrl}/api/v3/post?id=${id}`, { headers });
  const result = {
    lemmy: {
      post_id: id,
      read_body: read.json.post_view.post.body,
      delete_status: removed.response.status,
      gone_field: 'post_view.post.deleted',
      gone_value: after.json.post_view.post.deleted
    }
  };
  console.log(JSON.stringify(result));
}

async function verifyGhost(values) {
  const marker = `ix-spike-${Date.now()}`;
  const headers = {
    'content-type': 'application/json',
    authorization: `Ghost ${ghostToken(values.ghost.admin_api_key)}`,
    'accept-version': 'v6.0'
  };
  const create = await request(`${ghostUrl}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      posts: [{ title: 'Spike post', slug: marker, html: `<p>${marker}</p>`, status: 'draft' }]
    })
  });
  if (!create.response.ok) throw new Error(`Ghost create ${create.response.status}`);
  const id = create.json.posts[0].id;
  const read = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/?formats=html`, { headers });
  const removed = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/`, { method: 'DELETE', headers });
  const after = await request(`${ghostUrl}/ghost/api/admin/posts/${id}/`, { headers });
  const result = {
    ghost: {
      post_id: id,
      read_slug: read.json.posts[0].slug,
      delete_status: removed.response.status,
      gone_status: after.response.status
    }
  };
  console.log(JSON.stringify(result));
}

function selectedTarget() {
  const target = process.argv[2] || 'all';
  if (['all', 'lemmy', 'ghost'].includes(target)) return target;
  throw new Error('Use node spike/verify.js lemmy, ghost, or all');
}

async function main() {
  const values = JSON.parse(await fs.readFile(valuesPath, 'utf8'));
  const target = selectedTarget();
  if (target === 'all' || target === 'lemmy') await verifyLemmy(values);
  if (target === 'all' || target === 'ghost') await verifyGhost(values);
}

main().catch((error) => { console.error(`verify failed: ${error.message}`); process.exit(1); });
