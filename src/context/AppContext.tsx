'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, logoutSession } from '../api/auth'
import { hasSessionFlag, setSessionFlag } from '../api/http'
import {
  createShortcut,
  deleteShortcutApi,
  fetchShortcuts,
  updateShortcutApi,
} from '../api/shortcuts'
import {
  createSecret,
  deleteSecretApi,
  fetchSecrets,
  toSecretVariable,
  updateSecretApi,
} from '../api/secrets'
import {
  markAllNotificationsRead,
  markNotificationRead as markNotificationReadApi,
  saveSettings,
  sendTestNotification,
  type SettingsPayload,
} from '../api/account'
import {
  defaultUser,
  initialCollections,
  initialNetwork,
  initialNotifications,
  initialProjects,
  initialServers,
} from '../data/mockData'
import type {
  AccountUser,
  ApiCollection,
  AppNotification,
  AppPreferences,
  NetworkResource,
  NotificationPrefs,
  Project,
  SecretVariable,
  Shortcut,
  ThemeMode,
  ToastMessage,
  ToastType,
  UserProfile,
} from '../types'
import { isAdminEmail, normalizeRole, privilegesForEmail } from '../auth/privileges'
import { uid } from '../utils'

interface AppContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
  toggleSidebar: () => void
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
  profile: UserProfile
  setProfile: (profile: UserProfile) => void
  notificationPrefs: NotificationPrefs
  setNotificationPrefs: (prefs: NotificationPrefs) => void
  preferences: AppPreferences
  setPreferences: (prefs: AppPreferences) => void
  notifications: AppNotification[]
  visibleNotifications: AppNotification[]
  markAllRead: () => void
  markOneRead: (id: string) => void
  sendTestAlert: () => Promise<void>
  persistAccount: (patch?: SettingsPayload) => Promise<void>
  applyAccount: (user: AccountUser) => void
  toasts: ToastMessage[]
  pushToast: (message: string, type?: ToastType) => void
  projects: Project[]
  addProject: (project: Omit<Project, 'id'>) => void
  updateProject: (project: Project) => void
  deleteProject: (id: string) => void
  secrets: SecretVariable[]
  addSecret: (secret: Omit<SecretVariable, 'id'>) => Promise<void>
  updateSecret: (secret: SecretVariable) => Promise<void>
  deleteSecret: (id: string) => Promise<void>
  network: NetworkResource[]
  addNetwork: (resource: Omit<NetworkResource, 'id'>) => void
  updateNetwork: (resource: NetworkResource) => void
  deleteNetwork: (id: string) => void
  shortcuts: Shortcut[]
  addShortcut: (shortcut: Omit<Shortcut, 'id'>) => Promise<void>
  updateShortcut: (shortcut: Shortcut) => Promise<void>
  deleteShortcut: (id: string) => Promise<void>
  collections: ApiCollection[]
  servers: typeof initialServers
  isAuthenticated: boolean
  ready: boolean
  isAdmin: boolean
  can: (privilege: string) => boolean
  login: (user: AccountUser) => void
  logout: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const THEME_KEY = 'esp-theme'
const SIDEBAR_KEY = 'esp-sidebar-collapsed'
const USER_KEY = 'esp-user'

function filterNotifications(items: AppNotification[], prefs: NotificationPrefs) {
  if (!prefs.inApp) return []
  return items.filter((item) => {
    if (item.category === 'deployments') return prefs.deployments
    if (item.category === 'secrets') return prefs.secrets
    if (item.category === 'infrastructure') return prefs.infrastructure
    return true
  })
}

function profileFromAccount(user: AccountUser): UserProfile {
  const email = user.email
  const role = isAdminEmail(email) ? 'Admin' : normalizeRole(user.role)
  return {
    email,
    name: user.name || defaultUser.name,
    role,
    team: isAdminEmail(email) ? 'Administration' : user.team || defaultUser.team,
    workspaceName: user.workspaceName || defaultUser.workspaceName,
    timezone: user.timezone || defaultUser.timezone,
    dateFormat: user.dateFormat || defaultUser.dateFormat,
    privileges: user.privileges?.length ? user.privileges : privilegesForEmail(email, role),
    avatarUrl: user.avatarUrl || '',
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [theme, setThemeState] = useState<ThemeMode>('dark')
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile>(defaultUser)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    inApp: true,
    email: true,
    deployments: true,
    secrets: true,
    infrastructure: true,
  })
  const [preferences, setPreferences] = useState<AppPreferences>({
    compactSidebar: false,
    rememberSidebar: true,
    sessionTimeoutMin: 30,
    itemsPerPage: 8,
    compactTables: false,
    twoFactorEnabled: false,
    showClock: true,
  })
  const [notifications, setNotifications] = useState(initialNotifications)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [projects, setProjects] = useState(initialProjects)
  const [secrets, setSecrets] = useState<SecretVariable[]>([])
  const [network, setNetwork] = useState(initialNetwork)
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [collections] = useState(initialCollections)
  const [servers] = useState(initialServers)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') setThemeState(storedTheme)
    setSidebarCollapsedState(localStorage.getItem(SIDEBAR_KEY) === 'true')
    const storedUser = sessionStorage.getItem(USER_KEY)
    if (storedUser) {
      try {
        setProfile(profileFromAccount(JSON.parse(storedUser) as AccountUser))
      } catch {
        /* ignore */
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const applyAccount = useCallback((user: AccountUser) => {
    const nextProfile = profileFromAccount(user)
    sessionStorage.setItem(USER_KEY, JSON.stringify(nextProfile))
    setProfile(nextProfile)
    if (user.theme === 'dark' || user.theme === 'light') setThemeState(user.theme)
    if (user.notificationPrefs) setNotificationPrefs(user.notificationPrefs)
    if (user.preferences) {
      setPreferences({
        ...user.preferences,
        twoFactorEnabled: Boolean(user.twoFactorEnabled ?? user.preferences.twoFactorEnabled),
      })
    } else if (typeof user.twoFactorEnabled === 'boolean') {
      setPreferences((current) => ({ ...current, twoFactorEnabled: user.twoFactorEnabled as boolean }))
    }
    if (user.notifications) setNotifications(user.notifications)
  }, [])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    if (!hasSessionFlag()) return
    void saveSettings({ theme: next, notify: false }).catch(() => undefined)
  }, [])

  const setSidebarCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsedState(value)
    if (preferences.rememberSidebar) {
      localStorage.setItem(SIDEBAR_KEY, String(value))
    }
  }, [preferences.rememberSidebar])

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth < 992) {
      setMobileOpen((open) => !open)
      return
    }
    setSidebarCollapsed(!sidebarCollapsed)
  }, [setSidebarCollapsed, sidebarCollapsed])

  const pushToast = useCallback((message: string, type: ToastType = 'success') => {
    const toast = { id: uid(), message, type }
    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id))
    }, 2800)
  }, [])

  const persistAccount = useCallback(
    async (patch: SettingsPayload = {}) => {
      const data = await saveSettings({
        name: profile.name,
        workspaceName: profile.workspaceName,
        team: profile.team,
        timezone: profile.timezone,
        dateFormat: profile.dateFormat,
        theme,
        notificationPrefs,
        preferences,
        notify: true,
        ...patch,
      })
      applyAccount(data.user)
    },
    [applyAccount, notificationPrefs, preferences, profile, theme],
  )

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
    void markAllNotificationsRead()
      .then((data) => applyAccount(data.user))
      .catch(() => undefined)
  }, [applyAccount])

  const markOneRead = useCallback(
    (id: string) => {
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
      void markNotificationReadApi(id)
        .then((data) => applyAccount(data.user))
        .catch(() => undefined)
    },
    [applyAccount],
  )

  const sendTestAlert = useCallback(async () => {
    const data = await sendTestNotification()
    applyAccount(data.user)
  }, [applyAccount])

  const addSecret = useCallback(async (secret: Omit<SecretVariable, 'id'>) => {
    const data = await createSecret({ name: secret.key.trim(), value: secret.value })
    setSecrets((current) => [toSecretVariable(data.secret), ...current])
  }, [])

  const updateSecret = useCallback(async (secret: SecretVariable) => {
    const data = await updateSecretApi(secret.id, { name: secret.key.trim(), value: secret.value })
    const next = toSecretVariable(data.secret)
    setSecrets((current) => current.map((item) => (item.id === next.id ? next : item)))
  }, [])

  const deleteSecret = useCallback(async (id: string) => {
    await deleteSecretApi(id)
    setSecrets((current) => current.filter((item) => item.id !== id))
  }, [])

  const addShortcut = useCallback(async (shortcut: Omit<Shortcut, 'id'>) => {
    const data = await createShortcut(shortcut)
    setShortcuts((current) => [data.shortcut, ...current])
  }, [])

  const updateShortcut = useCallback(async (shortcut: Shortcut) => {
    const data = await updateShortcutApi(shortcut.id, {
      name: shortcut.name,
      description: shortcut.description,
      category: shortcut.category,
      url: shortcut.url,
      icon: shortcut.icon,
    })
    setShortcuts((current) => current.map((item) => (item.id === data.shortcut.id ? data.shortcut : item)))
  }, [])

  const deleteShortcut = useCallback(async (id: string) => {
    await deleteShortcutApi(id)
    setShortcuts((current) => current.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setSecrets([])
      setShortcuts([])
      return undefined
    }
    let cancelled = false
    void fetchSecrets()
      .then((data) => {
        if (!cancelled) setSecrets(data.secrets.map(toSecretVariable))
      })
      .catch(() => {
        if (!cancelled) setSecrets([])
      })
    void fetchShortcuts()
      .then((data) => {
        if (!cancelled) setShortcuts(data.shortcuts)
      })
      .catch(() => {
        if (!cancelled) setShortcuts([])
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    let cancelled = false
    void fetchMe()
      .then((data) => {
        if (cancelled) return
        applyAccount(data.user)
        setSessionFlag(true)
        setIsAuthenticated(true)
      })
      .catch(() => {
        if (cancelled) return
        setSessionFlag(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyAccount])

  const login = useCallback(
    (user: AccountUser) => {
      setSessionFlag(true)
      applyAccount(user)
      setIsAuthenticated(true)
    },
    [applyAccount],
  )

  const logout = useCallback(() => {
    void logoutSession()
    setSessionFlag(false)
    sessionStorage.removeItem(USER_KEY)
    setIsAuthenticated(false)
  }, [])

  const isAdmin = isAdminEmail(profile.email) || profile.role === 'Admin'
  const can = useCallback(
    (privilege: string) => isAdmin || profile.privileges.includes(privilege),
    [isAdmin, profile.privileges],
  )
  const visibleNotifications = useMemo(
    () => filterNotifications(notifications, notificationPrefs),
    [notificationPrefs, notifications],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      setTheme,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      mobileOpen,
      setMobileOpen,
      profile,
      setProfile,
      notificationPrefs,
      setNotificationPrefs,
      preferences,
      setPreferences,
      notifications,
      visibleNotifications,
      markAllRead,
      markOneRead,
      sendTestAlert,
      persistAccount,
      applyAccount,
      toasts,
      pushToast,
      projects,
      addProject: (project) => setProjects((current) => [{ ...project, id: uid() }, ...current]),
      updateProject: (project) =>
        setProjects((current) => current.map((item) => (item.id === project.id ? project : item))),
      deleteProject: (id) => setProjects((current) => current.filter((item) => item.id !== id)),
      secrets,
      addSecret,
      updateSecret,
      deleteSecret,
      network,
      addNetwork: (resource) => setNetwork((current) => [{ ...resource, id: uid() }, ...current]),
      updateNetwork: (resource) =>
        setNetwork((current) => current.map((item) => (item.id === resource.id ? resource : item))),
      deleteNetwork: (id) => setNetwork((current) => current.filter((item) => item.id !== id)),
      shortcuts,
      addShortcut,
      updateShortcut,
      deleteShortcut,
      collections,
      servers,
      isAuthenticated,
      ready,
      isAdmin,
      can,
      login,
      logout,
    }),
    [
      theme,
      setTheme,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      mobileOpen,
      profile,
      notificationPrefs,
      preferences,
      notifications,
      visibleNotifications,
      markAllRead,
      markOneRead,
      sendTestAlert,
      persistAccount,
      applyAccount,
      toasts,
      pushToast,
      projects,
      secrets,
      addSecret,
      updateSecret,
      deleteSecret,
      network,
      shortcuts,
      addShortcut,
      updateShortcut,
      deleteShortcut,
      collections,
      servers,
      isAuthenticated,
      ready,
      isAdmin,
      can,
      login,
      logout,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
