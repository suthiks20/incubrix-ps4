/**
 * Provides bulk destination lookups and inserts for catalogue import.
 * The unique index remains the final guard against concurrent duplicate imports.
 */
async function findExistingPairs(knex: any, pairs: Array<[string, string]>): Promise<any[]> {
  if (!pairs.length) return [];
  return knex('destinations').select('platform_key', 'url_normalized')
    .whereIn(['platform_key', 'url_normalized'], pairs);
}

async function insert(knex: any, row: any): Promise<any> {
  const values = { ...row };
  for (const column of ['audience_tags', 'config', 'frequency_cap']) {
    if (values[column] !== undefined && values[column] !== null) {
      values[column] = JSON.stringify(values[column]);
    }
  }
  return (await knex('destinations').insert(values).returning('*'))[0];
}

export { findExistingPairs, insert };
