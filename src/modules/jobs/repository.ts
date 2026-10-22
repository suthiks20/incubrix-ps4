/**
 * Contains SQL-only job persistence and safe concurrent queue claims.
 * Services own validation and turn absent rows into application errors.
 */
const TABLE = 'jobs';

async function insert(knex: any, row: any): Promise<any> {
  return (await knex(TABLE).insert(row).returning('*'))[0];
}

function findById(knex: any, id: string): any {
  return knex(TABLE).where({ id }).first();
}

function list(knex: any, filters: any): any {
  const { limit = 50, ...where } = filters;
  return knex(TABLE).where(where).orderBy('created_at', 'desc').limit(limit);
}

async function update(knex: any, id: string, values: any): Promise<any> {
  return (await knex(TABLE).where({ id }).update(values).returning('*'))[0];
}

async function claim(knex: any): Promise<any> {
  return knex.transaction(async (trx: any) => {
    const job = await trx(TABLE).where({ status: 'queued' }).orderBy('created_at').forUpdate().skipLocked().first();
    if (!job) return null;
    return update(trx, job.id, { status: 'running', attempts: job.attempts + 1, started_at: trx.fn.now() });
  });
}

async function recoverStale(knex: any, config: any): Promise<void> {
  const cutoff = new Date(Date.now() - config.JOBS_STALE_SECONDS * 1000);
  await knex(TABLE).where({ status: 'running' }).where('started_at', '<', cutoff)
    .where('attempts', '<', config.JOBS_MAX_ATTEMPTS).update({ status: 'queued' });
  await knex(TABLE).where({ status: 'running' }).where('started_at', '<', cutoff)
    .where('attempts', '>=', config.JOBS_MAX_ATTEMPTS).update({
      status: 'failed',
      error: { code: 'INTERNAL_ERROR', message: 'Job exceeded maximum attempts', retryable: false, details: {} }
    });
}

export { insert, findById, list, update, claim, recoverStale };
