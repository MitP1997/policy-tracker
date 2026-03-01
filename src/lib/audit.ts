export type AuditAction = "create" | "update" | "delete";

export interface WriteAuditLogParams {
  agencyId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  db: D1Database,
  params: WriteAuditLogParams
): Promise<void> {
  const id = crypto.randomUUID();
  const metadataJson = params.metadata
    ? JSON.stringify(params.metadata)
    : null;

  await db
    .prepare(
      `INSERT INTO audit_log (id, agency_id, actor_user_id, entity_type, entity_id, action, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      params.agencyId,
      params.actorUserId,
      params.entityType,
      params.entityId,
      params.action,
      metadataJson
    )
    .run();
}
