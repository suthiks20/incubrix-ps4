/**
 * Contains Knex queries for idempotency claims and stored responses only.
 * Decision making and retry timing stay in service.js.
 */
interface ClaimInput {
  key: string;
  method: string;
  path: string;
  requestHash: string;
  expiresAt: Date;
}

async function claim(knex: any, { key, method, path, requestHash, expiresAt }: ClaimInput): Promise<any> {
  const rows = await knex('idempotency_keys').insert({
    key, method, path, request_hash: requestHash, state: 'in_progress', expires_at: expiresAt
  }).onConflict(['key', 'method', 'path']).ignore().returning('*');
  return rows[0] || null;
}

function find(knex: any, key: string, method: string, path: string): any {
  return knex('idempotency_keys').where({ key, method, path }).first();
}

async function complete(knex: any, key: string, method: string, path: string, response: any): Promise<any> {
  const { status, body, contentType } = response;
  return knex('idempotency_keys').where({ key, method, path }).update({
    state: 'completed', response_status: status, response_body: body,
    response_content_type: contentType, updated_at: knex.fn.now()
  });
}

async function release(knex: any, key: string, method: string, path: string): Promise<any> {
  return knex('idempotency_keys').where({ key, method, path }).delete();
}

async function deleteIfStale(
  knex: any,
  key: string,
  method: string,
  path: string,
  lockTtlSeconds: number,
  now = new Date()
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - lockTtlSeconds * 1000);
  const deleted = await knex('idempotency_keys').where({ key, method, path }).where((query) => {
    query.where((stale) => stale.where('state', 'in_progress').where('updated_at', '<', staleBefore))
      .orWhere('expires_at', '<', now);
  }).delete();
  return deleted > 0;
}

async function purgeExpired(knex: any): Promise<number> {
  return knex('idempotency_keys').where('expires_at', '<', knex.fn.now()).delete();
}

export { claim, find, complete, release, deleteIfStale, purgeExpired };
