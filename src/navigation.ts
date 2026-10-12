import type { NavItem } from './types'

export const DASHBOARD_ITEM: NavItem = {
  path: '/dashboard',
  label: 'Dashboard',
  icon: 'bi-speedometer2',
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/project-inventory', label: 'My Projects', icon: 'bi-folder2-open' },
  { path: '/git-usernames', label: 'ESP Git Username', icon: 'bi-github' },
  { path: '/secrets-env', label: 'Secrets', icon: 'bi-key' },
  { path: '/network-management', label: 'Network', icon: 'bi-hdd-network' },
  { path: '/quick-access', label: 'Quick Access', icon: 'bi-lightning-charge' },
  { path: '/personal-drive', label: 'Personal Drive', icon: 'bi-cloud-arrow-up' },
  { path: '/documentation', label: 'Documentation', icon: 'bi-journal-text' },
  { path: '/settings', label: 'Settings', icon: 'bi-gear' },
]

export const ALL_NAV_ITEMS: NavItem[] = [DASHBOARD_ITEM, ...NAV_ITEMS]

export function getNavItem(pathname: string): NavItem {
  return ALL_NAV_ITEMS.find((item) => item.path === pathname) ?? DASHBOARD_ITEM
}
