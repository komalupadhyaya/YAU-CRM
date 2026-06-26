/**
 * Centralized RBAC permissions utility.
 *
 * Usage:
 *   import { can } from '@/utils/permissions';
 *   const { currentUser } = useAuth();
 *   const permissions = can(currentUser?.role);
 *   if (permissions.manageTeam) { ... }
 */

export type UserRole = 'admin' | 'manager' | 'sales_rep' | 'view_only';

export const ROLES = {
  ADMIN: 'admin' as UserRole,
  MANAGER: 'manager' as UserRole,
  SALES_REP: 'sales_rep' as UserRole,
  VIEW_ONLY: 'view_only' as UserRole,
};

export interface Permissions {
  /** Can view the Team page (read-only list for managers) */
  viewTeam: boolean;
  /** Can add, edit, or delete team members */
  manageTeam: boolean;
  /** Can view and modify Settings */
  viewSettings: boolean;
  /** Can create or edit records (leads, tasks, follow-ups) */
  createEdit: boolean;
  /** Can delete records */
  deleteRecords: boolean;
  /** Can schedule School or HR meetings */
  scheduleMeetings: boolean;
  /** Can see all leads (admin/manager); sales_rep only sees own */
  viewAllLeads: boolean;
  /** Can create or delete campaigns, import leads */
  manageCampaigns: boolean;
  /** Can mark tasks/follow-ups as complete */
  completeItems: boolean;
  /** Can assign leads or tasks to other users */
  assignToOthers: boolean;
  /** Can view and manage Evening Activity (EA) Leads */
  viewEALeads: boolean;
  /** Is this a read-only user */
  isReadOnly: boolean;
}

export const can = (role: string | undefined): Permissions => {
  const r = (role || 'view_only') as UserRole;

  return {
    viewTeam:        r === 'admin' || r === 'manager',
    manageTeam:      r === 'admin',
    viewSettings:    r === 'admin',
    createEdit:      r === 'admin' || r === 'manager' || r === 'sales_rep',
    deleteRecords:   r === 'admin' || r === 'manager',
    scheduleMeetings: r === 'admin' || r === 'manager',
    viewAllLeads:    r === 'admin' || r === 'manager' || r === 'view_only',
    manageCampaigns: r === 'admin' || r === 'manager',
    completeItems:   r === 'admin' || r === 'manager' || r === 'sales_rep',
    assignToOthers:  r === 'admin' || r === 'manager',
    viewEALeads:     r === 'admin' || r === 'manager',
    isReadOnly:      r === 'view_only',
  };
};
