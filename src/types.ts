export type ThemeMode = 'dark' | 'light'
export type Environment = 'Development' | 'Staging' | 'Production'
export type ProjectStatus = 'active' | 'inactive' | 'pending' | 'degraded'
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'inactive' | 'pending'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type NetworkType =
  | 'VPC'
  | 'Subnet'
  | 'Server'
  | 'Security Group'
  | 'Public IP'
  | 'Private IP'
  | 'Port'
  | 'Domain'
  | 'SSL'
export type SslStatus = 'valid' | 'expiring' | 'expired' | 'n/a'
export type ConnectionStatus = 'online' | 'offline' | 'maintenance'
export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface NavItem {
  path: string
  label: string
  icon: string
}

export interface Project {
  id: string
  name: string
  githubUrl: string
  branch: string
  techStack: string
  deploymentCloud: string
  services: string
  serverIp: string
  domain: string
  environment: Environment
  status: ProjectStatus
}

export interface SecretVariable {
  id: string
  key: string
  value: string
  description: string
  environment: Environment
  projectId: string
}

export interface NetworkResource {
  id: string
  name: string
  type: NetworkType
  vpc: string
  subnet: string
  publicIp: string
  privateIp: string
  port: string
  domain: string
  sslStatus: SslStatus
  status: HealthStatus
  region: string
  details: string
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

export interface KeyValuePair {
  key: string
  value: string
  enabled: boolean
}

export interface MockApiResponse {
  status: number
  timeMs: number
  body: string
}

export interface ApiRequestItem {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: string
  mockResponse: MockApiResponse
}

export interface ApiCollection {
  id: string
  name: string
  requests: ApiRequestItem[]
}

export interface SshServer {
  id: string
  name: string
  ip: string
  username: string
  port: number
  status: ConnectionStatus
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
