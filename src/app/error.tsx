'use client'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="login-shell" style={{ minHeight: '100vh' }}>
      <section className="login-panel" style={{ margin: 'auto' }}>
        <div className="login-card">
          <p className="page-kicker mb-2">SOMETHING WENT WRONG</p>
          <h2>We could not load this page</h2>
          <p className="text-secondary">{error.message || 'An unexpected error occurred.'}</p>
          <button type="button" className="btn btn-accent mt-3" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </section>
    </div>
  )
}
