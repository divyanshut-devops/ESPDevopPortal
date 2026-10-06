import { getInitials } from '../utils'

export function UserAvatar({ name, src, size = 'sm' }: { name: string; src?: string; size?: 'sm' | 'md' }) {
  const className = size === 'md' ? 'avatar' : 'avatar avatar-sm'
  if (src) {
    return <span className={`${className} has-photo`}><img src={src} alt="" /></span>
  }
  return <span className={className}>{getInitials(name)}</span>
}
