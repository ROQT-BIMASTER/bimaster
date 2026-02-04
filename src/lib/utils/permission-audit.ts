import { supabase } from "@/integrations/supabase/client";

interface PermissionAuditEntry {
  targetUserId: string;
  targetUserName?: string;
  action: 'grant' | 'revoke' | 'sync' | 'role_change' | 'bulk_update';
  permissionType: 'screen' | 'module' | 'role';
  permissionIds?: string[];
  permissionNames?: string[];
  oldPermissions?: string[];
  newPermissions?: string[];
  oldRole?: string;
  newRole?: string;
  source: 'manual' | 'trigger' | 'sync';
}

/**
 * Logs a permission change to the audit_logs table
 * This provides additional context beyond the database triggers
 */
export async function logPermissionChange(entry: PermissionAuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const entityType = entry.permissionType === 'screen' 
      ? 'screen_permission' 
      : entry.permissionType === 'module' 
        ? 'module_permission' 
        : 'role_change';

    const oldData = entry.permissionType === 'role'
      ? { role: entry.oldRole }
      : { permissions: entry.oldPermissions || [] };

    const newData = entry.permissionType === 'role'
      ? { role: entry.newRole }
      : { permissions: entry.newPermissions || [] };

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      action: entry.action,
      entity_type: entityType,
      entity_id: entry.targetUserId,
      old_data: oldData,
      new_data: newData,
      metadata: {
        source: entry.source,
        target_user_name: entry.targetUserName,
        permission_ids: entry.permissionIds,
        permission_names: entry.permissionNames,
        permissions_added: entry.permissionType !== 'role' 
          ? (entry.newPermissions || []).filter(p => !(entry.oldPermissions || []).includes(p))
          : undefined,
        permissions_removed: entry.permissionType !== 'role'
          ? (entry.oldPermissions || []).filter(p => !(entry.newPermissions || []).includes(p))
          : undefined,
      }
    });
  } catch (error) {
    console.error('Failed to log permission change:', error);
    // Don't throw - audit logging should not block the main operation
  }
}

/**
 * Logs screen permission updates with detailed diff
 */
export async function logScreenPermissionsUpdate(
  targetUserId: string,
  targetUserName: string,
  oldScreenIds: string[],
  newScreenIds: string[],
  screenNames: { id: string; name: string }[]
): Promise<void> {
  const oldNames = oldScreenIds.map(id => screenNames.find(s => s.id === id)?.name || id);
  const newNames = newScreenIds.map(id => screenNames.find(s => s.id === id)?.name || id);

  await logPermissionChange({
    targetUserId,
    targetUserName,
    action: 'bulk_update',
    permissionType: 'screen',
    permissionIds: newScreenIds,
    permissionNames: newNames,
    oldPermissions: oldNames,
    newPermissions: newNames,
    source: 'manual'
  });
}

/**
 * Logs module permission toggle
 */
export async function logModulePermissionToggle(
  targetUserId: string,
  targetUserName: string,
  moduleId: string,
  moduleName: string,
  granted: boolean
): Promise<void> {
  await logPermissionChange({
    targetUserId,
    targetUserName,
    action: granted ? 'grant' : 'revoke',
    permissionType: 'module',
    permissionIds: [moduleId],
    permissionNames: [moduleName],
    source: 'manual'
  });
}

/**
 * Logs role change for a user
 */
export async function logRoleChange(
  targetUserId: string,
  targetUserName: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logPermissionChange({
    targetUserId,
    targetUserName,
    action: 'role_change',
    permissionType: 'role',
    oldRole,
    newRole,
    source: 'manual'
  });
}

/**
 * Logs permission sync operation
 */
export async function logPermissionSync(
  targetUserId: string,
  targetUserName: string,
  permissionType: 'screen' | 'module',
  syncedPermissions: string[]
): Promise<void> {
  await logPermissionChange({
    targetUserId,
    targetUserName,
    action: 'sync',
    permissionType,
    permissionNames: syncedPermissions,
    source: 'sync'
  });
}
