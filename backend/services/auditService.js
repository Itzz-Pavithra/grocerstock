import AuditLog from '../models/AuditLog.js';

export async function logAdminAction({
  action,
  adminId,
  adminEmail,
  targetModel = '',
  targetId = '',
  details,
  metadata = {},
  outcome = 'success',
}) {
  try {
    const log = await AuditLog.create({
      action,
      admin: adminId,
      adminEmail: adminEmail || 'admin@grocery.com',
      targetModel,
      targetId: targetId ? targetId.toString() : '',
      details,
      metadata,
      outcome,
    });
    return log;
  } catch (err) {
    console.error('Failed to write audit log entry:', err.message);
    // Return null without breaking core administrative transactions
    return null;
  }
}
