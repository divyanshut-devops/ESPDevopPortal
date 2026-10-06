export function BrandLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="ESP DevOps Portal"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }}
    />
  )
}
