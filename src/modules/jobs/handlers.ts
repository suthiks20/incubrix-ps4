/**
 * Translates HTTP requests into job service calls without business logic.
 * Returning a common read shape keeps job responses consistent across routes.
 */
import * as service from './service';
import * as repository from './repository';

async function create(request: any, reply: any): Promise<any> {
  const job = await service.create(request.server, request.body, request.id);
  reply.code(202);
  return { job_id: job.id, status: 'queued', progress: 0 };
}

async function selftest(request: any, reply: any): Promise<any> {
  const job = await service.create(
    request.server,
    { type: 'selftest', input: request.body || {} },
    request.id
  );
  reply.code(202);
  return { job_id: job.id, status: 'queued', progress: 0 };
}

async function get(request: any): Promise<any> {
  return service.get(request.server.knex, request.params.id);
}

async function list(request: any): Promise<any> {
  const rows = await repository.list(request.server.knex, request.query);
  return Promise.all(rows.map((row: any) => service.get(request.server.knex, row.id)));
}

async function download(request: any, reply: any): Promise<any> {
  const value = await service.download(request.server, request.params.id, request.params.kind);
  reply.type(request.params.kind === 'errors' ? 'text/csv; charset=utf-8' : 'application/json');
  return reply.send(value);
}

export { create, selftest, get, list, download };
