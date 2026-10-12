export type ThemeMode = 'dark' | 'light'
export type Environment = 'Development' | 'Staging' | 'Production'
export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface NavItem {
  path: string
  label: string
  icon: string
}

export interface SecretVariable {
  id: string
  key: string
  value: string
  description: string
  environment: Environment
  projectId: string
}

export interface Shortcut {
  id: string
  name: string
  description: string
  category: string
  url: string
  icon: string
}

export type WorkspaceRole = 'Viewer' | 'Developer' | 'DevOps' | 'Admin'
export type InvitationStatus = 'pending' | 'accepted'

export interface Invitation {
  id: string
  email: string
  role: WorkspaceRole
  status: InvitationStatus
  invitedBy: string
  createdAt?: string
  acceptedAt?: string | null
}

export type NotificationCategory = 'inApp' | 'deployments' | 'secrets' | 'infrastructure'

export interface AppNotification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: ToastType
  category?: NotificationCategory
}

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

export interface UserProfile {
  name: string
  email: string
  role: string
  team: string
  workspaceName: string
  timezone: string
  dateFormat: string
  privileges: string[]
  avatarUrl?: string
}

export interface NotificationPrefs {
  inApp: boolean
  email: boolean
  deployments: boolean
  secrets: boolean
  infrastructure: boolean
}

export interface AppPreferences {
  compactSidebar: boolean
  rememberSidebar: boolean
  sessionTimeoutMin: number
  itemsPerPage: number
  compactTables: boolean
  twoFactorEnabled: boolean
  showClock: boolean
}

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  path: string
  icon: string
}

export interface AccountUser {
  email: string
  name: string
  avatarUrl?: string
  role: string
  team?: string
  workspaceName?: string
  timezone?: string
  dateFormat?: string
  privileges?: string[]
  theme?: ThemeMode
  twoFactorEnabled?: boolean
  notificationPrefs?: NotificationPrefs
  preferences?: AppPreferences
  notifications?: AppNotification[]
}
