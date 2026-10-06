function parseList(value) {
  return String(value || '')
    .split(/[, \n]+/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

export function corsOrigins() {
  const configured = [
    ...parseList(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS),
    ...parseList(process.env.FRONTEND_URL),
  ]
  const unique = [...new Set(configured)]
  return unique.length ? unique : ['http://localhost:3000']
}

export function corsOptions() {
  const origins = corsOrigins()
  const allowAll = origins.includes('*')
  if (process.env.NODE_ENV === 'production' && allowAll) {
    throw new Error('CORS_ORIGIN=* is not allowed in production.')
  }
  return {
    origin: allowAll ? true : origins,
    credentials: !allowAll && String(process.env.CORS_CREDENTIALS || 'true').toLowerCase() !== 'false',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }
}
