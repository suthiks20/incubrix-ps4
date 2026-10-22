/**
 * Registers job handlers separately from HTTP and queue plumbing.
 * Certification is the first durable operation and keeps its existing route unchanged.
 */
import { runCertification } from '../../certification/services/run';

async function certify(deps: any, input: any, progress: (value: number) => Promise<void>): Promise<any> {
  if (!input || typeof input.destination_id !== 'string') throw new Error('destination_id is required');
  await progress(10);
  const run = await runCertification(deps, input.destination_id);
  await progress(100);
  return { run_id: run.id, status: run.status, level: run.level_awarded, evidence_link: run.evidence_link };
}

const types: Record<string, any> = { certify };
export = types;
