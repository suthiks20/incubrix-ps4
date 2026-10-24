/**
 * Creates the local Lemmy configuration and a random admin credential once.
 * Both files stay in the private shared certification volume.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const dataDirectory = process.env.CERT_DATA_DIR || '/app/data';
const adminPath = path.join(dataDirectory, 'lemmy-admin.json');
const configPath = path.join(dataDirectory, 'config.hjson');

async function readAdmin(): Promise<any> {
  try {
    const admin = JSON.parse(await fs.readFile(adminPath, 'utf8'));
    if (admin.username && admin.password) return admin;
    throw new Error('Lemmy admin file is invalid');
  } catch (error: any) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Lemmy admin file could not be read');
  }
}

async function writePrivate(filePath: string, value: any): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function lemmyConfig(admin: any): any {
  return {
    hostname: 'localhost:8536',
    bind: '0.0.0.0',
    port: 8536,
    tls_enabled: false,
    database: {
      host: process.env.LEMMY_DB_HOST || 'lemmy-db',
      port: 5432,
      database: 'lemmy',
      user: 'lemmy',
      password: process.env.LEMMY_DB_PASSWORD || 'lemmy-spike-password',
      pool_size: 5
    },
    pictrs: { url: 'http://pictrs:8080/' },
    registration_mode: 'Open',
    setup: {
      admin_username: admin.username,
      admin_password: admin.password,
      site_name: 'IncuBrix Local'
    }
  };
}

async function main(): Promise<void> {
  await fs.mkdir(dataDirectory, { recursive: true });
  const admin = await readAdmin() || {
    username: 'incubrixadmin',
    password: crypto.randomBytes(32).toString('base64url')
  };
  await writePrivate(adminPath, admin);
  await writePrivate(configPath, lemmyConfig(admin));
  process.stdout.write('local Lemmy configuration prepared\n');
}

main().catch((error: any) => {
  process.stderr.write(`Lemmy configuration failed: ${error.message}\n`);
  process.exitCode = 1;
});
