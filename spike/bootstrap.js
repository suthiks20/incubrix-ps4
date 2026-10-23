/**
 * Creates or reads local-only Lemmy and Ghost identities without printing secrets.
 * The generated credentials are persisted exclusively in gitignored spike/out.json.
 */
const fs = require('fs/promises');
const path = require('path');

const output = path.join(__dirname, 'out.json');
const lemmyUrl = 'http://127.0.0.1:8536';
const ghostUrl = 'http://127.0.0.1:2368';
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

function lemmyHeaders(jwt) {
  return { authorization: `Bearer ${jwt}` };
}

async function lemmyLogin(values) {
  const body = { username_or_email: values.lemmy.username, password: values.lemmy.password };
  return request(`${lemmyUrl}/api/v3/user/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function bootstrapLemmy(values) {
  values.lemmy ||= { username: 'incubrixadmin', password: 'spike-lemmy-password-only-local' };
  if (!values.lemmy.jwt) {
    const login = await lemmyLogin(values);
    values.lemmy.jwt = login.json.jwt || login.json.token;
    if (!values.lemmy.jwt) {
      throw new Error(`Lemmy login returned fields: ${Object.keys(login.json).join(',')}`);
    }
    await writeOutput(values);
  }

  try {
    const result = await request(`${lemmyUrl}/api/v3/community?name=${lemmyCommunityName}`, {
      headers: lemmyHeaders(values.lemmy.jwt)
    });
    values.lemmy.community_id = result.json.community_view.community.id;
  } catch (error) {
    if (!String(error.message).startsWith('404 ')) {
      throw error;
    }
    const body = {
      name: lemmyCommunityName,
      title: 'incubrix-test',
      description: 'Local spike community'
    };
    const result = await request(`${lemmyUrl}/api/v3/community`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...lemmyHeaders(values.lemmy.jwt) },
      body: JSON.stringify(body)
    });
    values.lemmy.community_id = result.json.community_view.community.id;
  }
}

async function ghostSetup(values) {
  values.ghost ||= { email: 'owner@local.test', password: 'T9!rQ2@zL7#vM4$k' };
  const status = await request(`${ghostUrl}/ghost/api/admin/authentication/setup/`, {
    headers: { origin: ghostUrl }
  });
  if (status.json.setup?.[0]?.status) {
    return;
  }
  const owner = {
    name: 'IncuBrix Owner',
    email: values.ghost.email,
    password: values.ghost.password,
    blogTitle: 'IncuBrix Spike'
  };
  const setup = { setup: [owner] };
  await request(`${ghostUrl}/ghost/api/admin/authentication/setup/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ghostUrl },
    body: JSON.stringify(setup)
  });
}

async function bootstrapGhost(values) {
  if (values.ghost?.admin_api_key) {
    return;
  }
  await ghostSetup(values);
  const login = await request(`${ghostUrl}/ghost/api/admin/session/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ghostUrl },
    body: JSON.stringify({ username: values.ghost.email, password: values.ghost.password })
  });
  const cookie = login.headers.get('set-cookie');
  const integrations = await request(`${ghostUrl}/ghost/api/admin/integrations/`, {
    headers: { cookie, origin: ghostUrl }
  });
  let integration = integrations.json.integrations.find((item) => item.name === 'incubrix');
  if (!integration) {
    const created = await request(`${ghostUrl}/ghost/api/admin/integrations/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: ghostUrl },
      body: JSON.stringify({ integrations: [{ name: 'incubrix', description: 'Local API spike' }] })
    });
    integration = created.json.integrations[0];
  }
  const adminKey = integration.api_keys?.find((item) => item.type === 'admin');
  if (adminKey) {
    values.ghost.admin_api_key = adminKey.secret;
  }
  if (!values.ghost.admin_api_key) {
    throw new Error('Ghost integration did not return an admin API key');
  }
}

function selectedTarget() {
  const target = process.argv[2] || 'all';
  if (['all', 'lemmy', 'ghost'].includes(target)) return target;
  throw new Error('Use node spike/bootstrap.js lemmy, ghost, or all');
}

async function main() {
  const values = await readOutput();
  const target = selectedTarget();
  if (target === 'all' || target === 'lemmy') await bootstrapLemmy(values);
  if (target === 'all' || target === 'ghost') await bootstrapGhost(values);
  await writeOutput(values);
  console.log(`bootstrap ${target} completed; local credentials were written to spike/out.json`);
}

main().catch((error) => { console.error(`bootstrap failed: ${error.message}`); process.exit(1); });
