/**
 * Makes the one immediate best-effort delete required after a failed certification.
 * It returns persistence-ready state; WP1 integrates that state into the run outcome.
 */
interface CleanupContext {
  connector: { delete(destination: any, connection: any, id: string): Promise<{ deleted: boolean }> };
  destination: any;
  connection: any;
  post: { platform_post_id: string } | null;
}

interface ImmediateCleanupResult {
  attempted: boolean;
  deleted: boolean;
  cleanup_due_at: string | null;
}

async function attemptImmediateCleanup(
  context: CleanupContext,
  now: Date,
  ttlMinutes: number
): Promise<ImmediateCleanupResult> {
  if (!context.post) return { attempted: false, deleted: false, cleanup_due_at: null };
  try {
    const result = await context.connector.delete(
      context.destination,
      context.connection,
      context.post.platform_post_id
    );
    if (result.deleted) return { attempted: true, deleted: true, cleanup_due_at: null };
  } catch {
    // The caller records cleanup_pending and lets the janitor retry later.
  }
  const dueAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  return { attempted: true, deleted: false, cleanup_due_at: dueAt };
}

export { attemptImmediateCleanup };
