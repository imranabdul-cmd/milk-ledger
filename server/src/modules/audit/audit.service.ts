import { query } from '../../config/db.js';

export interface RecordAuditParams {
  familyId: string;
  memberId?: string | null;
  action: 'create' | 'update' | 'delete' | 'close_month' | 'correction';
  entityType: 'milk_entry' | 'payment' | 'milk_rate' | 'family_member' | 'monthly_closure';
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  client?: any; // Optional transactional client
}

export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  const sql = `
    INSERT INTO audit_logs (
      family_id, member_id, action, entity_type, entity_id, old_values, new_values, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const values = [
    params.familyId,
    params.memberId || null,
    params.action,
    params.entityType,
    params.entityId,
    params.oldValues ? JSON.stringify(params.oldValues) : null,
    params.newValues ? JSON.stringify(params.newValues) : null,
    params.ipAddress || null
  ];

  if (params.client) {
    await params.client.query(sql, values);
  } else {
    await query(sql, values);
  }
}
