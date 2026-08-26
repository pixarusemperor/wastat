/**
 * A/B Option C migration: backfill `experiment_variants` from existing
 * `workflows.experiment_id` links (the v1 model where a workflow IS a variant).
 *
 * Idempotent: an experiment_variants row exists for every (experiment_id,
 * workflow_id) pair already present in `workflows`; repeated runs are no-ops.
 * Provider-aware (sqlite + supabase_postgres).
 */
import type BetterSqlite3 from "better-sqlite3";
import { queryAll, execRun, type DbClient, toDbClient } from "./client.js";

export async function backfillExperimentVariants(
  db: DbClient | BetterSqlite3.Database,
): Promise<number> {
  const dbClient = toDbClient(db);
  const linked = (await queryAll(
    dbClient,
    `SELECT DISTINCT experiment_id, id AS workflow_id
     FROM workflows
     WHERE experiment_id IS NOT NULL`,
  )) as Array<{ experiment_id: number; workflow_id: number }>;

  let inserted = 0;
  for (const row of linked) {
    const experimentId = Number(row.experiment_id);
    const workflowId = Number(row.workflow_id);
    const exists = await queryAll(
      dbClient,
      "SELECT 1 FROM experiment_variants WHERE experiment_id = ? AND workflow_id = ?",
      [experimentId, workflowId],
    );
    if (exists.length > 0) continue;
    await execRun(
      dbClient,
      "INSERT INTO experiment_variants (experiment_id, workflow_id, weight, active) VALUES (?, ?, 100, ?)",
      [experimentId, workflowId, dbClient.sql ? true : 1],
    );
    inserted += 1;
  }
  return inserted;
}
