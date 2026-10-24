/**
 * Registers the catalogue-import API endpoint.
 * The endpoint enqueues work and returns the standard durable-job response.
 */
import * as handlers from './handlers';
import { importRequest } from './schemas';

async function routes(app: any): Promise<void> {
  app.post('/api/v1/catalogue/import', {
    schema: importRequest,
    bodyLimit: 7 * 1024 * 1024
  }, handlers.create);
}

export = routes;
