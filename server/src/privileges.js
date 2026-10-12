export const ADMIN_EMAILS = ['divyanshut@espsofttech.org']

export const WORKSPACE_ROLES = ['Viewer', 'Developer', 'DevOps', 'Admin']

export const FULL_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'projects.manage',
  'git.view',
  'secrets.view',
  'secrets.manage',
  'network.view',
  'network.manage',
  'shortcuts.view',
  'shortcuts.manage',
  'invitations.view',
  'invitations.manage',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
  'settings.manage',
  'admin.access',
]

export const VIEWER_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'git.view',
  'network.view',
  'shortcuts.view',
  'docs.view',
  'docs.manage',
  'settings.view',
]

export const DEVELOPER_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'git.view',
  'secrets.view',
  'network.view',
  'shortcuts.view',
  'shortcuts.manage',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
]

export const DEVOPS_PRIVILEGES = [
  'dashboard.view',
  'projects.view',
  'projects.manage',
  'git.view',
  'secrets.view',
  'secrets.manage',
  'network.view',
  'network.manage',
  'shortcuts.view',
  'shortcuts.manage',
  'invitations.view',
  'drive.view',
  'drive.manage',
  'docs.view',
  'docs.manage',
  'settings.view',
]

export const MEMBER_PRIVILEGES = DEVOPS_PRIVILEGES

export function isAdminEmail(email = '', extraAdmins = []) {
  const normalized = String(email).trim().toLowerCase()
  return ADMIN_EMAILS.includes(normalized) || extraAdmins.includes(normalized)
}

export function normalizeRole(role = '') {
  if (WORKSPACE_ROLES.includes(role)) return role
  if (role === 'DevOps Member' || role === 'DevOps Lead') return 'DevOps'
  return 'Viewer'
}

export function privilegesForRole(role = 'Viewer') {
  const normalized = normalizeRole(role)
  if (normalized === 'Admin') return [...FULL_PRIVILEGES]
  if (normalized === 'DevOps') return [...DEVOPS_PRIVILEGES]
  if (normalized === 'Developer') return [...DEVELOPER_PRIVILEGES]
  return [...VIEWER_PRIVILEGES]
}

export function accessForEmail(email, extraAdmins = [], storedRole) {
  if (isAdminEmail(email, extraAdmins)) {
    return {
      role: 'Admin',
      team: 'Administration',
      privileges: [...FULL_PRIVILEGES],
    }
  }
  const role = normalizeRole(storedRole)
  const team =
    role === 'Admin'
      ? 'Administration'
      : role === 'DevOps'
        ? 'Platform Engineering'
        : role === 'Developer'
          ? 'Engineering'
          : 'Workspace'
  return {
    role,
    team,
    privileges: privilegesForRole(role),
  }
}
