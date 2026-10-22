/**
 * Registers job HTTP routes with schemas that reject malformed public input.
 * Handlers only translate Fastify requests into job service calls.
 */
import * as handlers from './handlers';
import * as schemas from './schemas';

async function routes(app: any): Promise<void> {
  app.post('/api/v1/jobs', { schema: schemas.create }, handlers.create);
  app.get('/api/v1/jobs/:id', { schema: schemas.get }, handlers.get);
  app.get('/api/v1/jobs', { schema: schemas.list }, handlers.list);
}

export = routes;
