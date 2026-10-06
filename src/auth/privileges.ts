export const ADMIN_EMAILS = ['divyanshut@espsofttech.org']

export const WORKSPACE_ROLES = ['Viewer', 'Developer', 'DevOps', 'Admin'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const FULL_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'projects.manage',
  'secrets.view',
  'secrets.manage',
  'network.view',
  'network.manage',
  'postman.use',
  'shortcuts.view',
  'shortcuts.manage',
  'ssh.connect',
  'invitations.view',
  'invitations.manage',
  'generator.use',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
  'settings.manage',
  'admin.access',
] as const

export const VIEWER_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'network.view',
  'shortcuts.view',
  'docs.view',
  'docs.manage',
  'settings.view',
] as const

export const DEVELOPER_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'secrets.view',
  'network.view',
  'postman.use',
  'shortcuts.view',
  'shortcuts.manage',
  'generator.use',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
  'ssh.connect',
] as const

export const DEVOPS_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'projects.manage',
  'secrets.view',
  'secrets.manage',
  'network.view',
  'network.manage',
  'postman.use',
  'shortcuts.view',
  'shortcuts.manage',
  'ssh.connect',
  'invitations.view',
  'generator.use',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
] as const

export const MEMBER_PRIVILEGES = DEVOPS_PRIVILEGES

export type Privilege = (typeof FULL_PRIVILEGES)[number]

export function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

export function normalizeRole(role = ''): WorkspaceRole {
  if ((WORKSPACE_ROLES as readonly string[]).includes(role)) return role as WorkspaceRole
  if (role === 'DevOps Member' || role === 'DevOps Lead') return 'DevOps'
  return 'Viewer'
}

export function privilegesForRole(role?: string): string[] {
  const normalized = normalizeRole(role)
  if (normalized === 'Admin') return [...FULL_PRIVILEGES]
  if (normalized === 'DevOps') return [...DEVOPS_PRIVILEGES]
  if (normalized === 'Developer') return [...DEVELOPER_PRIVILEGES]
  return [...VIEWER_PRIVILEGES]
}

export function privilegesForEmail(email: string, role?: string): string[] {
  if (isAdminEmail(email) || role === 'Admin') return [...FULL_PRIVILEGES]
  return privilegesForRole(role)
}
