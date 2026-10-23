/**
 * Creates local-only Lemmy and Ghost identities without printing credentials.
 * The generated values are persisted solely in gitignored bootstrap-output.json.
 */
const fs = require('fs/promises');
const path = require('path');

const output = path.join(__dirname, '..', 'bootstrap-output.json');
const lemmyUrl = process.env.LEMMY_URL || 'http://127.0.0.1:8536';
const ghostUrl = process.env.GHOST_URL || 'http://127.0.0.1:2368';
const lemmyCommunityName = 'incubrix_test';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(json)}`);
  return { json, headers: response.headers };
}

async function readOutput() {
  try { return JSON.parse(await fs.readFile(output, 'utf8')); } catch { return {}; }
}

async function writeOutput(values) {
  await fs.writeFile(output, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
}

async function bootstrapLemmy(values) {
  values.lemmy ||= { username: 'incubrixadmin', password: 'spike-lemmy-password-only-local' };
  if (!values.lemmy.jwt) {
    const login = await request(`${lemmyUrl}/api/v3/user/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username_or_email: values.lemmy.username, password: values.lemmy.password })
    });
    values.lemmy.jwt = login.json.jwt;
    if (!values.lemmy.jwt) throw new Error('Lemmy login did not return jwt');
    await writeOutput(values);
  }
  const headers = { authorization: `Bearer ${values.lemmy.jwt}` };
  try {
    const found = await request(`${lemmyUrl}/api/v3/community?name=${lemmyCommunityName}`, { headers });
    values.lemmy.community_id = found.json.community_view.community.id;
  } catch (error) {
    if (!String(error.message).startsWith('404 ')) throw error;
    const created = await request(`${lemmyUrl}/api/v3/community`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ name: lemmyCommunityName, title: 'incubrix-test', description: 'Local testing' })
    });
    values.lemmy.community_id = created.json.community_view.community.id;
  }
}

async function bootstrapGhost(values) {
  if (values.ghost?.admin_api_key) return;
  values.ghost ||= { email: 'owner@local.test', password: 'T9!rQ2@zL7#vM4$k' };
  const origin = ghostUrl;
  const status = await request(`${ghostUrl}/ghost/api/admin/authentication/setup/`, { headers: { origin } });
  if (!status.json.setup?.[0]?.status) {
    const owner = { name: 'IncuBrix Owner', email: values.ghost.email, password: values.ghost.password };
    await request(`${ghostUrl}/ghost/api/admin/authentication/setup/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ setup: [{ ...owner, blogTitle: 'IncuBrix Local' }] })
    });
  }
  const login = await request(`${ghostUrl}/ghost/api/admin/session/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ username: values.ghost.email, password: values.ghost.password })
  });
  const cookie = login.headers.get('set-cookie');
  const headers = { cookie, origin };
  const listed = await request(`${ghostUrl}/ghost/api/admin/integrations/`, { headers });
  let integration = listed.json.integrations.find((item) => item.name === 'incubrix');
  if (!integration) {
    const created = await request(`${ghostUrl}/ghost/api/admin/integrations/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ integrations: [{ name: 'incubrix', description: 'Local API testing' }] })
    });
    integration = created.json.integrations[0];
  }
  values.ghost.admin_api_key = integration.api_keys?.find((item) => item.type === 'admin')?.secret;
  if (!values.ghost.admin_api_key) throw new Error('Ghost integration did not return an admin API key');
}

async function main() {
  const values = await readOutput();
  const target = process.argv[2] || 'all';
  if (!['all', 'lemmy', 'ghost'].includes(target)) throw new Error('Use lemmy, ghost, or all');
  if (target === 'all' || target === 'lemmy') await bootstrapLemmy(values);
  if (target === 'all' || target === 'ghost') await bootstrapGhost(values);
  await writeOutput(values);
  console.log(`bootstrap ${target} completed; credentials were written without printing values`);
}

main().catch((error) => { console.error(`bootstrap failed: ${error.message}`); process.exit(1); });
